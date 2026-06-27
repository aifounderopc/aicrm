// 角色守卫 + 能力判断（服务端权威，前端判断仅用于 UI）
import type { Request, Response, NextFunction } from 'express'
import { ApiError } from './error.js'

export function isAdminRole(role: string) {
  return role === 'admin' || role === 'channel_admin' || role === 'sales_admin'
}
export function canManageChannels(role: string) {
  return role === 'admin' || role === 'channel_admin'
}
export function canManageSales(role: string) {
  return role === 'admin' || role === 'sales_admin'
}
export function canManageAdmins(role: string) {
  return role === 'admin'
}

// 用「真实登录角色」判断管理权限（代理身份不应提升权限）
export function requireRole(check: (role: string) => boolean) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.auth?.authRole
    if (!role || !check(role)) return next(new ApiError(403, '无权限执行此操作'))
    next()
  }
}
