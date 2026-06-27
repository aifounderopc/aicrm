// 鉴权中间件：校验 JWT cookie，解析真实登录者与代理身份，挂到 req.auth
import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../db.js'
import { COOKIE_NAME, verifyToken } from '../util/token.js'
import { ApiError } from './error.js'

export interface AuthContext {
  authUserId: string                 // 真实登录账号
  authRole: string
  // 当前生效身份（代理时为被代理账号，否则同 authUser）
  user: { id: string; name: string; email: string; role: string; channelId: string | null; isJdManager: boolean }
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

    const authUser = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!authUser || authUser.disabled) throw new ApiError(401, '账号不可用')

    // 代理访问：取目标账号作为生效身份
    let effective = authUser
    let isProxying = false
    if (payload.actAs && payload.actAs !== authUser.id) {
      const target = await prisma.user.findUnique({ where: { id: payload.actAs } })
      if (target && !target.disabled) { effective = target; isProxying = true }
    }

    req.auth = {
      authUserId: authUser.id,
      authRole: authUser.role,
      isProxying,
      user: {
        id: effective.id, name: effective.name, email: effective.email,
        role: effective.role, channelId: effective.channelId, isJdManager: effective.isJdManager,
      },
    }
    next()
  } catch (e) {
    next(e instanceof ApiError ? e : new ApiError(401, '登录已过期，请重新登录'))
  }
}
