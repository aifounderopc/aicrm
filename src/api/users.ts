// 用户/账号模块 API —— 对应 store 的 createUser / updateUser / toggleUserDisabled / deleteUser
// 后端校验角色越权：sales_admin 只能管 sales、channel_admin 只能管 channel、admin 不限
import { api } from './client'
import type { User, UserRole } from '../types'
import type { AuthUser } from './auth'

export interface UserListQuery {
  role?: UserRole
  q?: string
}

// 创建账号入参（密码强度由后端校验，哈希入库）
export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: 'sales' | 'admin' | 'channel_admin' | 'sales_admin'
  group?: string
}

// 销售带统计的列表项
export interface SalesUserWithStats extends AuthUser {
  total: number
  signed: number
  rate: number
}

export const userApi = {
  // GET /users?role=&q=
  list: (query: UserListQuery = {}) =>
    api.get<AuthUser[]>('/users', query as Record<string, string>),

  // GET /users?role=sales（带商机统计）
  listSalesWithStats: () =>
    api.get<SalesUserWithStats[]>('/users', { role: 'sales', withStats: 'true' }),

  // POST /users —— 创建（角色越权校验在后端）
  create: (input: CreateUserInput) => api.post<AuthUser>('/users', input),

  // PATCH /users/:id —— 更新（含改密、改邮箱；密码留空则不改）
  update: (
    id: string,
    updates: Partial<Pick<User, 'name' | 'email' | 'group'>> & { password?: string },
  ) => api.patch<AuthUser>(`/users/${id}`, updates),

  // POST /users/:id/toggle —— 启用/停用
  toggleDisabled: (id: string) => api.post<AuthUser>(`/users/${id}/toggle`),

  // DELETE /users/:id —— 名下有商机则后端返回 409 拒绝
  remove: (id: string) => api.del<void>(`/users/${id}`),
}
