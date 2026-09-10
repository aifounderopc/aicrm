// 认证模块：login / logout / me / impersonate / change-password
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, ah } from '../../middleware/error.js'
import { requireAuth } from '../../middleware/auth.js'
import { signToken, COOKIE_NAME, cookieOptions } from '../../util/token.js'
import { verifyPassword, hashPassword, validatePasswordStrength } from '../../util/password.js'
import { writeLog } from '../../util/audit.js'

export const authRouter = Router()

// 登录限频：同 IP 10 分钟最多 10 次
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false })

function publicUser(u: { id: string; name: string; email: string; role: string; channelId: string | null; isJdManager: boolean; tenantId: string; isPlatformAdmin: boolean; tenant?: { name: string }; mustChangePwd?: boolean }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, channelId: u.channelId, isJdManager: u.isJdManager, tenantId: u.tenantId, tenantName: u.tenant?.name, isPlatformAdmin: u.isPlatformAdmin }
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })

authRouter.post('/login', loginLimiter, ah(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { tenant: true } })
  if (!user) throw new ApiError(401, '账号或密码错误')
  if (user.disabled) throw new ApiError(403, '该账号已被停用，请联系管理员')
  if (user.tenant.status !== 'active') throw new ApiError(403, '所属企业租户已停用，请联系平台管理员')
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw new ApiError(401, '账号或密码错误')

  res.cookie(COOKIE_NAME, signToken({ sub: user.id, role: user.role }), cookieOptions())
  await writeLog(req, { actorId: user.id, actorName: user.name, action: '登录', detail: `账号 ${user.email} 登录系统` })
  res.json({ user: publicUser(user), authUser: publicUser(user), isProxying: false, mustChangePwd: user.mustChangePwd })
}))

authRouter.post('/logout', ah(async (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' })
  // 生产可将 jti 加入 Redis 黑名单
  res.status(204).end()
}))

authRouter.get('/me', requireAuth, ah(async (req, res) => {
  const a = req.auth!
  const authUser = await prisma.user.findUnique({ where: { id: a.authUserId }, include: { tenant: true } })
  res.json({ user: a.user, authUser: authUser && publicUser(authUser), isProxying: a.isProxying })
}))

// 代理访问：超管任意 / 渠道管理员仅 channel / 销售管理员仅 sales
const impSchema = z.object({ userId: z.string() })
authRouter.post('/impersonate', requireAuth, ah(async (req, res) => {
  const a = req.auth!
  const { userId } = impSchema.parse(req.body)
  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) throw new ApiError(404, '账号不存在')
  const allowed =
    (a.authRole === 'admin' && (a.authIsPlatformAdmin || target.tenantId === a.authTenantId)) ||
    (a.authRole === 'channel_admin' && target.role === 'channel') ||
    (a.authRole === 'sales_admin' && target.role === 'sales')
  if (!allowed) throw new ApiError(403, '无权代理访问该账号')

  res.cookie(COOKIE_NAME, signToken({ sub: a.authUserId, role: a.authRole, actAs: target.id }), cookieOptions())
  await writeLog(req, { actorId: a.authUserId, actorName: a.user.name, action: '代理访问', detail: `代理账号 ${target.email}（${target.name}）`, targetType: 'user', targetId: target.id })
  res.json({ ok: true })
}))

authRouter.post('/stop-impersonate', requireAuth, ah(async (req, res) => {
  const a = req.auth!
  res.cookie(COOKIE_NAME, signToken({ sub: a.authUserId, role: a.authRole }), cookieOptions())
  res.json({ ok: true })
}))

const changePwdSchema = z.object({ oldPassword: z.string(), newPassword: z.string() })
authRouter.post('/change-password', requireAuth, ah(async (req, res) => {
  const a = req.auth!
  const { oldPassword, newPassword } = changePwdSchema.parse(req.body)
  const user = await prisma.user.findUnique({ where: { id: a.authUserId } })
  if (!user || !(await verifyPassword(oldPassword, user.passwordHash))) throw new ApiError(400, '原密码错误')
  const pv = validatePasswordStrength(newPassword)
  if (!pv.valid) throw new ApiError(400, pv.error!)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), mustChangePwd: false } })
  await writeLog(req, { actorId: user.id, actorName: user.name, action: '修改密码', detail: '自助修改登录密码' })
  res.status(204).end()
}))
