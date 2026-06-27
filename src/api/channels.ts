// 渠道模块 API —— 对应 store 的 addChannel / updateChannel / toggleChannel / createChannelAccount 等
// 仅渠道管理员 / 超级管理员可访问；后端做角色校验
import { api } from './client'
import type { ChannelPartner } from '../types'
import type { AuthUser } from './auth'

// 账号草稿（新建渠道时同步建渠道伙伴账号 / 京东渠道经理账号）
export interface AccountDraft {
  name: string
  email: string
  password: string
}

// 列表项：渠道 + 统计 + 关联登录账号
export interface ChannelWithStats extends ChannelPartner {
  total: number          // 报备商机数
  signed: number         // 已签约数
  rate: number           // 转化率
  linkedUser?: AuthUser  // 渠道伙伴登录账号
  jdUser?: AuthUser      // 京东渠道经理登录账号
}

export const channelApi = {
  // GET /channels —— 含统计与关联账号
  list: () => api.get<ChannelWithStats[]>('/channels'),

  // POST /channels —— 事务：建渠道 + 渠道账号 + 京东经理账号
  create: (
    channel: Omit<ChannelPartner, 'id' | 'createdAt'>,
    account?: AccountDraft,
    jdAccount?: AccountDraft,
  ) => api.post<ChannelWithStats>('/channels', { channel, account, jdAccount }),

  // PATCH /channels/:id —— 更新渠道信息
  update: (
    id: string,
    updates: Partial<Pick<ChannelPartner, 'name' | 'fullName' | 'contactName' | 'phone' | 'jdManagerName'>>,
  ) => api.patch<ChannelWithStats>(`/channels/${id}`, updates),

  // POST /channels/:id/toggle —— 启用/停用（同时停用关联账号）
  toggle: (id: string) => api.post<ChannelWithStats>(`/channels/${id}/toggle`),

  // POST /channels/:id/account —— 为已有渠道补建登录账号
  createAccount: (id: string, account: AccountDraft) =>
    api.post<AuthUser>(`/channels/${id}/account`, account),

  // DELETE /channels/:id —— 有关联商机数据则后端返回 409 拒绝
  remove: (id: string) => api.del<void>(`/channels/${id}`),
}
