import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { requireAuth } from '../../middleware/auth.js'
import { ApiError, ah } from '../../middleware/error.js'
import { hashPassword, validatePasswordStrength } from '../../util/password.js'
import { writeLog } from '../../util/audit.js'

export const tenantRouter = Router()
tenantRouter.use(requireAuth)

function requirePlatformAdmin(req: Parameters<Parameters<typeof ah>[0]>[0]) {
  if (!req.auth?.authIsPlatformAdmin) throw new ApiError(403, '仅平台管理员可管理企业租户')
}

tenantRouter.get('/', ah(async (req, res) => {
  requirePlatformAdmin(req)
  const tenants = await prisma.tenant.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: {
      _count: { select: { users: true, channels: true, opportunities: true } },
      users: { where: { role: 'admin' }, select: { id: true, name: true, email: true, disabled: true }, take: 1, orderBy: { createdAt: 'asc' } },
    },
  })
  res.json(tenants.map(({ users, ...tenant }) => ({ ...tenant, primaryAdmin: users[0] || null })))
}))
const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,39}$/, '租户编码仅支持 2-40 位小写字母、数字、下划线和短横线'),
  adminName: z.string().trim().min(1).max(40),
  adminEmail: z.string().email(),
  adminPassword: z.string(),
})

tenantRouter.post('/', ah(async (req, res) => {
  requirePlatformAdmin(req)
  const input = createSchema.parse(req.body)
  const password = validatePasswordStrength(input.adminPassword)
  if (!password.valid) throw new ApiError(400, password.error!)
  const [codeExists, emailExists] = await Promise.all([
    prisma.tenant.findUnique({ where: { code: input.code } }),
    prisma.user.findUnique({ where: { email: input.adminEmail.toLowerCase() } }),
  ])
  if (codeExists) throw new ApiError(409, '租户编码已存在')
  if (emailExists) throw new ApiError(409, '管理员邮箱已被使用')

  const created = await prisma.$transaction(async tx => {
    const tenant = await tx.tenant.create({ data: { name: input.name, code: input.code } })
    const admin = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name: input.adminName,
        email: input.adminEmail.toLowerCase(),
        passwordHash: await hashPassword(input.adminPassword),
        role: 'admin',
        mustChangePwd: true,
      },
      select: { id: true, name: true, email: true, disabled: true },
    })
    return { ...tenant, primaryAdmin: admin, _count: { users: 1, channels: 0, opportunities: 0 } }
  })
  await writeLog(req, { actorId: req.auth!.authUserId, actorName: req.auth!.user.name, action: '新增企业租户', detail: `${input.name}（${input.code}）`, targetType: 'tenant', targetId: created.id })
  res.status(201).json(created)
}))

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,39}$/).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

tenantRouter.patch('/:id', ah(async (req, res) => {
  requirePlatformAdmin(req)
  const input = updateSchema.parse(req.body)
  const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } })
  if (!tenant) throw new ApiError(404, '企业租户不存在')
  if (tenant.isDefault && input.status === 'disabled') throw new ApiError(409, '默认租户不能停用')
  if (req.auth!.authTenantId === tenant.id && input.status === 'disabled') throw new ApiError(409, '不能停用当前登录账号所属租户')
  if (input.code && input.code !== tenant.code && await prisma.tenant.findUnique({ where: { code: input.code } })) throw new ApiError(409, '租户编码已存在')
  const updated = await prisma.tenant.update({ where: { id: tenant.id }, data: input })
  await writeLog(req, { actorId: req.auth!.authUserId, actorName: req.auth!.user.name, action: '更新企业租户', detail: `${updated.name}（${updated.code}）`, targetType: 'tenant', targetId: updated.id })
  res.json(updated)
}))
