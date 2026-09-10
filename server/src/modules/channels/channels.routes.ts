// 渠道模块：仅渠道管理员/超管。建渠道(事务+两账号)/改信息/启停/补建账号/删除
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, ah } from '../../middleware/error.js'
import { requireAuth } from '../../middleware/auth.js'
import { requireRole, canManageChannels } from '../../middleware/roles.js'
import { hashPassword, validatePasswordStrength } from '../../util/password.js'
import { writeLog } from '../../util/audit.js'

export const channelRouter = Router()
channelRouter.use(requireAuth, requireRole(canManageChannels))

const pub = (u: { id: string; name: string; email: string; role: string; channelId: string | null; isJdManager: boolean; disabled: boolean }) =>
  ({ id: u.id, name: u.name, email: u.email, role: u.role, channelId: u.channelId, isJdManager: u.isJdManager, disabled: u.disabled })

// GET /channels —— 含统计与关联账号
channelRouter.get('/', ah(async (req, res) => {
  const tenantId = req.auth!.user.tenantId
  const channels = await prisma.channel.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
  const result = await Promise.all(channels.map(async (c) => {
    const [total, signed, users] = await Promise.all([
      prisma.opportunity.count({ where: { tenantId, channelId: c.id } }),
      prisma.opportunity.count({ where: { tenantId, channelId: c.id, stage: 'signed' } }),
      prisma.user.findMany({ where: { tenantId, channelId: c.id, role: 'channel' } }),
    ])
    const linkedUser = users.find(u => !u.isJdManager)
    const jdUser = users.find(u => u.isJdManager)
    return { ...c, total, signed, rate: total ? Math.round(signed / total * 100) : 0, linkedUser: linkedUser && pub(linkedUser), jdUser: jdUser && pub(jdUser) }
  }))
  res.json(result)
}))

const accountSchema = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string() })
const createSchema = z.object({
  channel: z.object({
    name: z.string().min(1), fullName: z.string().min(1), contactName: z.string().min(1),
    phone: z.string().optional(), jdManagerName: z.string().optional(),
  }),
  account: accountSchema.optional(),
  jdAccount: accountSchema.optional(),
})

// POST /channels —— 事务：建渠道 + 渠道账号 + 京东经理账号
channelRouter.post('/', ah(async (req, res) => {
  const auth = req.auth!
  const { channel, account, jdAccount } = createSchema.parse(req.body)
  for (const a of [account, jdAccount]) {
    if (a) {
      const pv = validatePasswordStrength(a.password)
      if (!pv.valid) throw new ApiError(400, pv.error!)
      const exists = await prisma.user.findUnique({ where: { email: a.email.toLowerCase() } })
      if (exists) throw new ApiError(409, `邮箱 ${a.email} 已被使用`)
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const ch = await tx.channel.create({ data: { ...channel, tenantId: auth.user.tenantId, status: 'active' } })
    if (account) {
      await tx.user.create({ data: { tenantId: auth.user.tenantId, name: account.name, email: account.email.toLowerCase(), passwordHash: await hashPassword(account.password), role: 'channel', channelId: ch.id, mustChangePwd: true } })
    }
    if (jdAccount) {
      await tx.user.create({ data: { tenantId: auth.user.tenantId, name: jdAccount.name, email: jdAccount.email.toLowerCase(), passwordHash: await hashPassword(jdAccount.password), role: 'channel', channelId: ch.id, isJdManager: true, mustChangePwd: true } })
    }
    return ch
  })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '新建渠道', detail: `渠道：${channel.name}`, targetType: 'channel', targetId: created.id })
  res.status(201).json(created)
}))

// PATCH /channels/:id
const updateSchema = z.object({ name: z.string().optional(), fullName: z.string().optional(), contactName: z.string().optional(), phone: z.string().optional(), jdManagerName: z.string().optional() })
channelRouter.patch('/:id', ah(async (req, res) => {
  const auth = req.auth!
  const updates = updateSchema.parse(req.body)
  const existing = await prisma.channel.findFirst({ where: { id: req.params.id, tenantId: auth.user.tenantId } })
  if (!existing) throw new ApiError(404, '渠道不存在')
  const ch = await prisma.channel.update({ where: { id: existing.id }, data: updates })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '编辑渠道信息', detail: `渠道：${ch.name}`, targetType: 'channel', targetId: ch.id })
  res.json(ch)
}))

// POST /channels/:id/toggle —— 启停渠道并同步停用关联账号
channelRouter.post('/:id/toggle', ah(async (req, res) => {
  const auth = req.auth!
  const ch = await prisma.channel.findFirst({ where: { id: req.params.id, tenantId: auth.user.tenantId } })
  if (!ch) throw new ApiError(404, '渠道不存在')
  const next = ch.status === 'active' ? 'disabled' : 'active'
  const [updated] = await prisma.$transaction([
    prisma.channel.update({ where: { id: ch.id }, data: { status: next } }),
    prisma.user.updateMany({ where: { tenantId: auth.user.tenantId, channelId: ch.id }, data: { disabled: next === 'disabled' } }),
  ])
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: next === 'disabled' ? '停用渠道' : '启用渠道', detail: `渠道：${ch.name}`, targetType: 'channel', targetId: ch.id })
  res.json(updated)
}))

// POST /channels/:id/account —— 补建渠道账号
channelRouter.post('/:id/account', ah(async (req, res) => {
  const auth = req.auth!
  const account = accountSchema.parse(req.body)
  const channel = await prisma.channel.findFirst({ where: { id: req.params.id, tenantId: auth.user.tenantId } })
  if (!channel) throw new ApiError(404, '渠道不存在')
  const existing = await prisma.user.findFirst({ where: { tenantId: auth.user.tenantId, channelId: req.params.id, role: 'channel', isJdManager: false } })
  if (existing) throw new ApiError(409, '该渠道已有登录账号')
  const pv = validatePasswordStrength(account.password)
  if (!pv.valid) throw new ApiError(400, pv.error!)
  if (await prisma.user.findUnique({ where: { email: account.email.toLowerCase() } })) throw new ApiError(409, '邮箱已被使用')
  const u = await prisma.user.create({ data: { tenantId: auth.user.tenantId, name: account.name, email: account.email.toLowerCase(), passwordHash: await hashPassword(account.password), role: 'channel', channelId: req.params.id, mustChangePwd: true } })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '补建渠道账号', detail: account.email, targetType: 'channel', targetId: req.params.id })
  res.status(201).json(pub(u))
}))

// DELETE /channels/:id —— 有商机数据则拒绝
channelRouter.delete('/:id', ah(async (req, res) => {
  const auth = req.auth!
  const channel = await prisma.channel.findFirst({ where: { id: req.params.id, tenantId: auth.user.tenantId } })
  if (!channel) throw new ApiError(404, '渠道不存在')
  const hasData = await prisma.opportunity.count({ where: { tenantId: auth.user.tenantId, channelId: req.params.id } })
  if (hasData) throw new ApiError(409, '该渠道已有关联商机数据，无法删除')
  await prisma.$transaction([
    prisma.user.deleteMany({ where: { tenantId: auth.user.tenantId, channelId: req.params.id } }),
    prisma.channel.delete({ where: { id: req.params.id } }),
  ])
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '删除渠道', detail: `渠道 ID：${req.params.id}`, targetType: 'channel', targetId: req.params.id })
  res.status(204).end()
}))
