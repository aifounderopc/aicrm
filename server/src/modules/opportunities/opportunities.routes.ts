// 商机模块：列表(按角色过滤) / 撞单预检 / 创建(服务端二次撞单+事务) / 改阶段 / 解密联系人
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, ah } from '../../middleware/error.js'
import { requireAuth } from '../../middleware/auth.js'
import { isAdminRole } from '../../middleware/roles.js'
import { notify, notifyAdmins } from '../../util/notify.js'
import { normalizeName, detectCollision, type CollisionCandidate } from '../../util/collision.js'
import { encryptField, decryptField, sha256 } from '../../util/crypto.js'
import { writeLog } from '../../util/audit.js'

export const opportunityRouter = Router()
opportunityRouter.use(requireAuth)

const opportunityInclude = {
  contact: true,
  evidenceFiles: { orderBy: { uploadedAt: 'desc' as const } },
  progressReports: { orderBy: { createdAt: 'desc' as const } },
  renewalRequests: { orderBy: { createdAt: 'desc' as const } },
}

type OpportunityWithRelations = Awaited<ReturnType<typeof prisma.opportunity.findFirst<typeof opportunityIncludeArgs>>>
const opportunityIncludeArgs = { include: opportunityInclude }

function toClientOpportunity(opp: NonNullable<OpportunityWithRelations>) {
  return {
    ...opp,
    contact: opp.contact && {
      level: opp.contact.level,
      department: opp.contact.department,
      contactTypes: opp.contact.contactTypes,
      encryptedName: opp.contact.encName ? 'encrypted' : undefined,
      encryptedContact: opp.contact.encContact ? 'encrypted' : undefined,
      phoneHash: opp.contact.phoneHash ?? undefined,
    },
    evidenceFiles: opp.evidenceFiles.map(f => ({
      id: f.id,
      name: f.name,
      url: f.ossKey,
      uploadedAt: f.uploadedAt,
      uploadedBy: f.uploadedBy,
    })),
    progressReports: opp.progressReports,
    renewalRequests: opp.renewalRequests,
    contractFileId: opp.contractFileKey ?? undefined,
  }
}

// 按当前身份构造可见范围：销售/渠道只见自己名下，管理类见全量
function visibilityWhere(auth: NonNullable<import('../../middleware/auth.js').AuthContext>) {
  if (isAdminRole(auth.user.role)) return {}
  if (auth.user.role === 'channel') return { channelId: auth.user.channelId ?? '__none__' }
  return { salesOwnerId: auth.user.id }
}

// GET /opportunities
opportunityRouter.get('/', ah(async (req, res) => {
  const auth = req.auth!
  const stage = req.query.stage as string | undefined
  const q = (req.query.q as string | undefined)?.trim()
  const page = Math.max(1, Number(req.query.page ?? 1))
  const pageSize = Math.min(100, Number(req.query.pageSize ?? 20))

  const where: Record<string, unknown> = { ...visibilityWhere(auth) }
  if (stage && stage !== 'all') where.stage = stage
  if (q) where.customerName = { contains: q, mode: 'insensitive' }

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({ where, include: opportunityInclude, orderBy: { reportedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.opportunity.count({ where }),
  ])
  res.json({ items: items.map(toClientOpportunity), total, page, pageSize })
}))

// 活跃商机候选（撞单用）
async function activeCandidates(industry?: string): Promise<CollisionCandidate[]> {
  const rows = await prisma.opportunity.findMany({
    where: { stage: { notIn: ['released', 'closed'] } },
    select: { id: true, customerNameNorm: true, industry: true, stage: true },
  })
  return industry ? rows : rows
}

const checkSchema = z.object({ customerName: z.string().min(1), industry: z.string().min(1), companyName: z.string().optional() })
opportunityRouter.post('/check-collision', ah(async (req, res) => {
  const { customerName, industry } = checkSchema.parse(req.body)
  const result = detectCollision(customerName, industry, await activeCandidates())
  res.json(result)
}))

// GET /opportunities/:id —— 商机详情，按当前身份校验可见范围
opportunityRouter.get('/:id', ah(async (req, res) => {
  const auth = req.auth!
  const opp = await prisma.opportunity.findUnique({
    where: { id: req.params.id },
    include: opportunityInclude,
  })
  if (!opp) throw new ApiError(404, '商机不存在')

  const canView =
    isAdminRole(auth.user.role) ||
    opp.salesOwnerId === auth.user.id ||
    (auth.user.role === 'channel' && opp.channelId === auth.user.channelId)
  if (!canView) throw new ApiError(403, '无权查看该商机')

  res.json(toClientOpportunity(opp))
}))

const createSchema = z.object({
  customerName: z.string().min(1),
  companyName: z.string().optional(),
  industry: z.string().min(1),
  productInterests: z.array(z.enum(['JM 声访', 'JM 外呼'])).min(1).optional(),
  source: z.enum(['direct', 'channel']),
  channelId: z.string().optional(),
  channelName: z.string().optional(),
  channelManagerName: z.string().optional(),
  amountRange: z.string(),
  firstContactDate: z.string().optional(),
  requirementDescription: z.string().min(30, '需求描述至少 30 字'),
  contact: z.object({
    level: z.string(),
    department: z.string().min(1),
    contactTypes: z.array(z.enum(['phone', 'email', 'wechat'])).min(1),
    name: z.string().min(1),        // 明文联系人姓名（仅本次请求，加密入库）
    contactValue: z.string().optional(),
  }),
  isSubsidiary: z.boolean().optional(),
  parentCompanyName: z.string().optional(),
  evidenceFiles: z.array(z.object({
    name: z.string().min(1),
    url: z.string().min(1),
    size: z.number().optional(),
  })).optional(),
})

// POST /opportunities —— 事务内二次撞单 + 加密联系人 + 写日志
opportunityRouter.post('/', ah(async (req, res) => {
  const auth = req.auth!
  const input = createSchema.parse(req.body)

  const opp = await prisma.$transaction(async (tx) => {
    const actives = await tx.opportunity.findMany({
      where: { stage: { notIn: ['released', 'closed'] } },
      select: { id: true, customerNameNorm: true, industry: true, stage: true },
    })
    const { collision } = detectCollision(input.customerName, input.industry, actives)
    if (collision) throw new ApiError(409, '该客户已被报备，存在撞单', 'COLLISION', { collisionId: collision.id })

    const releaseAt = new Date(Date.now() + 30 * 86400_000) // 默认 30 天保护
    return tx.opportunity.create({
      data: {
        customerName: input.customerName,
        customerNameNorm: normalizeName(input.customerName),
        companyName: input.companyName,
        industry: input.industry,
        productInterests: input.productInterests ?? ['JM 声访'],
        source: input.source,
        channelId: input.channelId,
        channelName: input.channelName,
        channelManagerName: input.channelManagerName,
        saOwnerId: auth.user.id, saOwnerName: auth.user.name,
        salesOwnerId: auth.user.id, salesOwnerName: auth.user.name,
        stage: 'reporting',
        releaseAt,
        lockedPermanently: false,
        amountRange: input.amountRange,
        firstContactDate: input.firstContactDate ? new Date(input.firstContactDate) : null,
        requirementDescription: input.requirementDescription,
        isSubsidiary: input.isSubsidiary ?? false,
        parentCompanyName: input.parentCompanyName,
        contact: {
          create: {
            level: input.contact.level,
            department: input.contact.department,
            contactTypes: input.contact.contactTypes,
            encName: encryptField(input.contact.name),
            encContact: input.contact.contactValue ? encryptField(input.contact.contactValue) : null,
            phoneHash: input.contact.contactValue ? sha256(input.contact.contactValue) : null,
          },
        },
        evidenceFiles: input.evidenceFiles?.length ? {
          create: input.evidenceFiles.map(file => ({
            name: file.name,
            ossKey: file.url,
            size: file.size ?? 0,
            uploadedBy: auth.user.id,
          })),
        } : undefined,
      },
    })
  })

  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '报备商机', detail: `报备客户「${input.customerName}」`, targetType: 'opportunity', targetId: opp.id })
  res.status(201).json({ opportunity: opp })
}))

// PATCH /opportunities/:id/stage —— signed/delivery 自动永久锁定
const stageSchema = z.object({
  stage: z.enum(['reporting', 'contacting', 'proposal', 'negotiation', 'signing', 'delivery', 'signed', 'closed', 'released']),
  signingInfo: z.object({ contractNo: z.string(), signedDate: z.string(), signedAmount: z.number(), contractFileKey: z.string().optional() }).optional(),
})
opportunityRouter.patch('/:id/stage', ah(async (req, res) => {
  const auth = req.auth!
  const { stage, signingInfo } = stageSchema.parse(req.body)
  const opp = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
  if (!opp) throw new ApiError(404, '商机不存在')
  if (!isAdminRole(auth.user.role) && opp.salesOwnerId !== auth.user.id) throw new ApiError(403, '无权操作该商机')

  const locked = stage === 'signed' || stage === 'delivery'
  const updated = await prisma.opportunity.update({
    where: { id: opp.id },
    data: {
      stage,
      lockedPermanently: locked || opp.lockedPermanently,
      ...(signingInfo ? {
        contractNo: signingInfo.contractNo,
        signedDate: new Date(signingInfo.signedDate),
        signedAmount: signingInfo.signedAmount,
        contractFileKey: signingInfo.contractFileKey,
      } : {}),
    },
  })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '更新阶段', detail: `「${opp.customerName}」→ ${stage}`, targetType: 'opportunity', targetId: opp.id })
  res.json(updated)
}))

// GET /opportunities/:id/contact —— 解密联系人，仅报备人/管理员，记审计
opportunityRouter.get('/:id/contact', ah(async (req, res) => {
  const auth = req.auth!
  const opp = await prisma.opportunity.findUnique({ where: { id: req.params.id }, include: { contact: true } })
  if (!opp || !opp.contact) throw new ApiError(404, '联系人不存在')
  const allowed = isAdminRole(auth.authRole) || opp.salesOwnerId === auth.user.id
  if (!allowed) throw new ApiError(403, '无权查看加密联系人')

  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '解密联系人', detail: `查看「${opp.customerName}」联系人`, targetType: 'opportunity', targetId: opp.id })
  res.json({
    name: opp.contact.encName ? decryptField(opp.contact.encName) : '',
    contact: opp.contact.encContact ? decryptField(opp.contact.encContact) : undefined,
  })
}))

// 取商机 + 权限校验（owner 或管理员）
async function getOwnedOrAdmin(req: import('express').Request, requireAdmin = false) {
  const auth = req.auth!
  const opp = await prisma.opportunity.findUnique({ where: { id: req.params.id } })
  if (!opp) throw new ApiError(404, '商机不存在')
  if (requireAdmin) {
    if (!isAdminRole(auth.authRole)) throw new ApiError(403, '仅管理员可操作')
  } else if (!isAdminRole(auth.user.role) && opp.salesOwnerId !== auth.user.id) {
    throw new ApiError(403, '无权操作该商机')
  }
  return { auth, opp }
}

// POST /:id/release —— 管理员释放
opportunityRouter.post('/:id/release', ah(async (req, res) => {
  const { auth, opp } = await getOwnedOrAdmin(req, true)
  const reason = String(req.body?.reason ?? '管理员释放')
  const updated = await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: 'released', releasedAt: new Date(), releaseReason: reason, releasedBy: auth.user.id } })
  await notify({ userId: opp.salesOwnerId, title: '商机已被释放', body: `「${opp.customerName}」已释放：${reason}`, type: 'warning', opportunityId: opp.id })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '释放商机', detail: `「${opp.customerName}」：${reason}`, targetType: 'opportunity', targetId: opp.id })
  res.json(updated)
}))

// POST /:id/freeze —— 管理员冻结
opportunityRouter.post('/:id/freeze', ah(async (req, res) => {
  const { auth, opp } = await getOwnedOrAdmin(req, true)
  const reason = String(req.body?.reason ?? '管理员冻结')
  const updated = await prisma.opportunity.update({ where: { id: opp.id }, data: { isFrozen: true, frozenReason: reason } })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '冻结商机', detail: `「${opp.customerName}」：${reason}`, targetType: 'opportunity', targetId: opp.id })
  res.json(updated)
}))

// DELETE /:id —— 管理员删除
opportunityRouter.delete('/:id', ah(async (req, res) => {
  const { auth, opp } = await getOwnedOrAdmin(req, true)
  await prisma.opportunity.delete({ where: { id: opp.id } })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '删除商机', detail: `「${opp.customerName}」`, targetType: 'opportunity', targetId: opp.id })
  res.status(204).end()
}))

// POST /:id/renewals —— 报备人申请续期（通知管理员审批）
opportunityRouter.post('/:id/renewals', ah(async (req, res) => {
  const { auth, opp } = await getOwnedOrAdmin(req)
  const existing = await prisma.renewalRequest.findFirst({ where: { opportunityId: opp.id, status: 'pending' } })
  if (existing) throw new ApiError(409, '已有待处理的续期申请')
  const r = await prisma.renewalRequest.create({ data: { opportunityId: opp.id, requesterId: auth.user.id, status: 'pending', reason: req.body?.reason } })
  await notifyAdmins({ title: '续期申请待审批', body: `${auth.user.name} 申请「${opp.customerName}」续期`, type: 'info', opportunityId: opp.id })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '申请续期', detail: `「${opp.customerName}」`, targetType: 'opportunity', targetId: opp.id })
  res.status(201).json(r)
}))

// POST /:id/renewals/:rid/approve —— 管理员批准，保护期 +30 天
opportunityRouter.post('/:id/renewals/:rid/approve', ah(async (req, res) => {
  const { auth, opp } = await getOwnedOrAdmin(req, true)
  const r = await prisma.renewalRequest.findUnique({ where: { id: req.params.rid } })
  if (!r || r.status !== 'pending') throw new ApiError(404, '续期申请不存在或已处理')
  const newRelease = new Date(Math.max(opp.releaseAt.getTime(), Date.now()) + 30 * 86400_000)
  await prisma.$transaction([
    prisma.renewalRequest.update({ where: { id: r.id }, data: { status: 'approved', processedAt: new Date(), processedBy: auth.user.id } }),
    prisma.opportunity.update({ where: { id: opp.id }, data: { releaseAt: newRelease } }),
  ])
  await notify({ userId: r.requesterId, title: '续期已批准', body: `「${opp.customerName}」保护期已延长 30 天`, type: 'success', opportunityId: opp.id })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '批准续期', detail: `「${opp.customerName}」+30天`, targetType: 'opportunity', targetId: opp.id })
  res.json({ ok: true })
}))

// POST /:id/renewals/:rid/reject
opportunityRouter.post('/:id/renewals/:rid/reject', ah(async (req, res) => {
  const { auth, opp } = await getOwnedOrAdmin(req, true)
  const reason = String(req.body?.reason ?? '资源调配')
  const r = await prisma.renewalRequest.findUnique({ where: { id: req.params.rid } })
  if (!r || r.status !== 'pending') throw new ApiError(404, '续期申请不存在或已处理')
  await prisma.renewalRequest.update({ where: { id: r.id }, data: { status: 'rejected', rejectionReason: reason, processedAt: new Date(), processedBy: auth.user.id } })
  await notify({ userId: r.requesterId, title: '续期被拒绝', body: `「${opp.customerName}」续期未通过：${reason}`, type: 'error', opportunityId: opp.id })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '拒绝续期', detail: `「${opp.customerName}」：${reason}`, targetType: 'opportunity', targetId: opp.id })
  res.json({ ok: true })
}))

// POST /:id/evidence/:fid/approve | reject —— 管理员审核举证
opportunityRouter.post('/:id/evidence/:fid/approve', ah(async (req, res) => {
  const { auth, opp } = await getOwnedOrAdmin(req, true)
  await prisma.evidenceFile.update({ where: { id: req.params.fid }, data: { status: 'approved' } })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '通过举证', detail: `「${opp.customerName}」举证审核通过`, targetType: 'opportunity', targetId: opp.id })
  res.json({ ok: true })
}))
opportunityRouter.post('/:id/evidence/:fid/reject', ah(async (req, res) => {
  const { auth, opp } = await getOwnedOrAdmin(req, true)
  const reason = String(req.body?.reason ?? '材料不符')
  await prisma.evidenceFile.update({ where: { id: req.params.fid }, data: { status: 'rejected', rejectReason: reason } })
  await notify({ userId: opp.salesOwnerId, title: '举证被驳回', body: `「${opp.customerName}」举证未通过：${reason}`, type: 'warning', opportunityId: opp.id })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '驳回举证', detail: `「${opp.customerName}」：${reason}`, targetType: 'opportunity', targetId: opp.id })
  res.json({ ok: true })
}))

// POST /:id/progress —— 进展上报
const progressSchema = z.object({
  status: z.string(),
  lastContactDate: z.string(),
  description: z.string().min(1),
  estimatedSignDate: z.string().optional(),
  needsSupport: z.boolean().optional(),
})
opportunityRouter.post('/:id/progress', ah(async (req, res) => {
  const { auth, opp } = await getOwnedOrAdmin(req)
  const input = progressSchema.parse(req.body)
  const pr = await prisma.progressReport.create({
    data: {
      opportunityId: opp.id, reporterId: auth.user.id, status: input.status,
      lastContactDate: new Date(input.lastContactDate), description: input.description,
      estimatedSignDate: input.estimatedSignDate ? new Date(input.estimatedSignDate) : null,
      needsSupport: input.needsSupport ?? false,
    },
  })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '上报进展', detail: `「${opp.customerName}」`, targetType: 'opportunity', targetId: opp.id })
  res.status(201).json(pr)
}))
