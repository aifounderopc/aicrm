// JWT 签发与校验。payload 含真实登录者 sub 与（可选）代理身份 actAs
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export interface TokenPayload {
  sub: string       // 真实登录账号 id
  role: string      // 真实账号角色
  actAs?: string    // 代理访问时的目标账号 id
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions)
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload
}

export const COOKIE_NAME = 'jwt'
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax' as const,
    maxAge: 1000 * 60 * 60 * 8, // 8h（刷新令牌另行实现）
    path: '/',
  }
}
