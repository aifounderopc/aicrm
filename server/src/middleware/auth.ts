// 鉴权中间件：校验 JWT cookie，解析真实登录者与代理身份，挂到 req.auth
import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../db.js'
import { COOKIE_NAME, verifyToken } from '../util/token.js'
import { ApiError } from './error.js'

export interface AuthContext {
  authUserId: string                 // 真实登录账号
  authRole: string
  authTenantId: string
  authIsPlatformAdmin: boolean
  // 当前生效身份（代理时为被代理账号，否则同 authUser）
  user: { id: string; name: string; email: string; role: string; channelId: string | null; isJdManager: boolean; tenantId: string; tenantNo: number; tenantName: string; isPlatformAdmin: boolean }
  isProxying: boolean
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { auth?: AuthContext }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_NAME]
    if (!token) throw new ApiError(401, '未登录')
    const payload = verifyToken(token)

    const authUser = await prisma.user.findUnique({ where: { id: payload.sub }, include: { tenant: true } })
    if (!authUser || authUser.disabled || authUser.tenant.status !== 'active') throw new ApiError(401, '账号或所属企业不可用')

    // 代理访问：取目标账号作为生效身份
    let effective = authUser
    let isProxying = false
    if (payload.actAs && payload.actAs !== authUser.id) {
      const target = await prisma.user.findUnique({ where: { id: payload.actAs }, include: { tenant: true } })
      const canCrossTenant = authUser.isPlatformAdmin
      if (target && !target.disabled && target.tenant.status === 'active' && (canCrossTenant || target.tenantId === authUser.tenantId)) { effective = target; isProxying = true }
    }

    req.auth = {
      authUserId: authUser.id,
      authRole: authUser.role,
      authTenantId: authUser.tenantId,
      authIsPlatformAdmin: authUser.isPlatformAdmin,
      isProxying,
      user: {
        id: effective.id, name: effective.name, email: effective.email,
        role: effective.role, channelId: effective.channelId, isJdManager: effective.isJdManager,
        tenantId: effective.tenantId, tenantNo: effective.tenant.tenantNo, tenantName: effective.tenant.name, isPlatformAdmin: effective.isPlatformAdmin,
      },
    }
    next()
  } catch (e) {
    next(e instanceof ApiError ? e : new ApiError(401, '登录已过期，请重新登录'))
  }
}
