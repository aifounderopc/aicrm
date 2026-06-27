// 认证模块 API —— 对应 store 的 login / logout / switchUser
// 后端用 httpOnly cookie 下发 JWT，前端不接触令牌；当前用户通过 /auth/me 获取
import { api } from './client'
import type { User } from '../types'

// 后端返回的「当前用户」绝不包含 password；代理访问时 actingAs 表示真实登录者
export type AuthUser = Omit<User, 'password'>

export interface MeResponse {
  user: AuthUser            // 当前生效身份（可能是被代理的账号）
  authUser: AuthUser        // 真实登录账号
  isProxying: boolean       // 是否正在代理访问
}

export const authApi = {
  // POST /auth/login —— 成功后 cookie 已种，返回当前用户
  login: (email: string, password: string) =>
    api.post<MeResponse>('/auth/login', { email, password }),

  // POST /auth/logout —— 后端将令牌加入黑名单并清 cookie
  logout: () => api.post<void>('/auth/logout'),

  // GET /auth/me —— 拉取当前用户（替代前端 currentUser / authUserId）
  me: () => api.get<MeResponse>('/auth/me'),

  // POST /auth/impersonate —— 代理访问；后端校验角色权限（admin 任意 / 子管理员限对应类型）
  impersonate: (userId: string) =>
    api.post<MeResponse>('/auth/impersonate', { userId }),

  // POST /auth/stop-impersonate —— 退出代理，返回本人
  stopImpersonate: () => api.post<MeResponse>('/auth/stop-impersonate'),

  // POST /auth/change-password —— 自助改密（旧密码校验 + 强度校验在后端）
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post<void>('/auth/change-password', { oldPassword, newPassword }),

  // POST /auth/forgot-password —— 发送找回邮件
  forgotPassword: (email: string) =>
    api.post<void>('/auth/forgot-password', { email }),

  // POST /auth/reset-password —— 凭邮件令牌重置
  resetPassword: (token: string, newPassword: string) =>
    api.post<void>('/auth/reset-password', { token, newPassword }),
}
