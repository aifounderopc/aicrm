// 用户/账号模块：管理类角色。创建(越权校验)/更新/启停/删除/列表
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, ah } from '../../middleware/error.js'
import { requireAuth } from '../../middleware/auth.js'
import { isAdminRole, canManageSales, canManageAdmins } from '../../middleware/roles.js'
import { hashPassword, validatePasswordStrength } from '../../util/password.js'
import { writeLog } from '../../util/audit.js'

export const userRouter = Router()
userRouter.use(requireAuth)

const pub = (u: { id: string; name: string; email: string; role: string; channelId: string | null; isJdManager: boolean; disabled: boolean; groupName: string | null; createdAt: Date }) =>
  ({ id: u.id, name: u.name, email: u.email, role: u.role, channelId: u.channelId, isJdManager: u.isJdManager, disabled: u.disabled, group: u.groupName, createdAt: u.createdAt })

// 创建者能否创建该角色：超管不限；sales_admin 仅 sales；channel_admin 仅 channel
function canCreate(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'admin') return true
  if (actorRole === 'sales_admin') return targetRole === 'sales'
  if (actorRole === 'channel_admin') return targetRole === 'channel'
  return false
}

// GET /users?role=&withStats=
userRouter.get('/', ah(async (req, res) => {
  const auth = req.auth!
  if (!isAdminRole(auth.authRole)) throw new ApiError(403, '无权限')
  const role = req.query.role as string | undefined
  const users = await prisma.user.findMany({ where: role ? { role: role as never } : {}, orderBy: { createdAt: 'desc' } })

  if (req.query.withStats === 'true' && role === 'sales') {
    const withStats = await Promise.all(users.map(async (u) => {
      const [total, signed] = await Promise.all([
        prisma.opportunity.count({ where: { salesOwnerId: u.id } }),
        prisma.opportunity.count({ where: { salesOwnerId: u.id, stage: 'signed' } }),
      ])
      return { ...pub(u), total, signed, rate: total ? Math.round(signed / total * 100) : 0 }
    }))
    return res.json(withStats)
  }
  res.json(users.map(pub))
}))

const createSchema = z.object({
  name: z.string().min(1), email: z.string().email(), password: z.string(),
  role: z.enum(['sales', 'admin', 'channel_admin', 'sales_admin']), group: z.string().optional(),
})
// POST /users
userRouter.post('/', ah(async (req, res) => {
  const auth = req.auth!
  const input = createSchema.parse(req.body)
  // 管理员角色只能超管建；sales 需 sales_admin/超管
  if (input.role === 'sales' ? !canManageSales(auth.authRole) : !canManageAdmins(auth.authRole))
    throw new ApiError(403, '无权创建该角色账号')
  if (!canCreate(auth.authRole, input.role)) throw new ApiError(403, '无权创建该角色账号')
  const pv = validatePasswordStrength(input.password)
  if (!pv.valid) throw new ApiError(400, pv.error!)
  if (await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })) throw new ApiError(409, '该邮箱已被使用')

  const u = await prisma.user.create({ data: { name: input.name, email: input.email.toLowerCase(), passwordHash: await hashPassword(input.password), role: input.role, groupName: input.group, mustChangePwd: true } })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '新增账号', detail: `${input.role}：${input.name}（${input.email}）`, targetType: 'user', targetId: u.id })
  res.status(201).json(pub(u))
}))

const updateSchema = z.object({ name: z.string().optional(), email: z.string().email().optional(), password: z.string().optional(), group: z.string().optional() })
// PATCH /users/:id
userRouter.patch('/:id', ah(async (req, res) => {
  const auth = req.auth!
  if (!isAdminRole(auth.authRole)) throw new ApiError(403, '无权限')
  const updates = updateSchema.parse(req.body)
  const data: Record<string, unknown> = {}
  if (updates.name) data.name = updates.name
  if (updates.group !== undefined) data.groupName = updates.group
  if (updates.email) {
    const taken = await prisma.user.findFirst({ where: { email: updates.email.toLowerCase(), id: { not: req.params.id } } })
    if (taken) throw new ApiError(409, '该邮箱已被使用')
    data.email = updates.email.toLowerCase()
  }
  if (updates.password) {
    const pv = validatePasswordStrength(updates.password)
    if (!pv.valid) throw new ApiError(400, pv.error!)
    data.passwordHash = await hashPassword(updates.password)
  }
  const u = await prisma.user.update({ where: { id: req.params.id }, data })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '编辑账号', detail: `${u.name}（${u.email}）`, targetType: 'user', targetId: u.id })
  res.json(pub(u))
}))

// POST /users/:id/toggle
userRouter.post('/:id/toggle', ah(async (req, res) => {
  const auth = req.auth!
  if (!isAdminRole(auth.authRole)) throw new ApiError(403, '无权限')
  const u = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!u) throw new ApiError(404, '账号不存在')
  const updated = await prisma.user.update({ where: { id: u.id }, data: { disabled: !u.disabled } })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: updated.disabled ? '停用账号' : '启用账号', detail: `${u.email}`, targetType: 'user', targetId: u.id })
  res.json(pub(updated))
}))

// DELETE /users/:id —— 名下有商机则拒绝
userRouter.delete('/:id', ah(async (req, res) => {
  const auth = req.auth!
  if (!isAdminRole(auth.authRole)) throw new ApiError(403, '无权限')
  const hasData = await prisma.opportunity.count({ where: { salesOwnerId: req.params.id } })
  if (hasData) throw new ApiError(409, '该账号名下已有商机数据，无法删除')
  await prisma.user.delete({ where: { id: req.params.id } })
  await writeLog(req, { actorId: auth.user.id, actorName: auth.user.name, action: '删除账号', detail: `账号 ID：${req.params.id}`, targetType: 'user', targetId: req.params.id })
  res.status(204).end()
}))
