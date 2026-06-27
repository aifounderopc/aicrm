// 商机模块 API —— 对应 store 的 addOpportunity / detectCollision / updateStage 等
// 重点：列表与详情由后端按角色过滤；报备时后端二次撞单检测，保证数据安全与一致性
import { api } from './client'
import type { Opportunity, OpportunityStage, ProgressReport } from '../types'

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface OpportunityListQuery {
  stage?: OpportunityStage | 'all'
  q?: string          // 客户名搜索
  page?: number
  pageSize?: number
  sort?: string       // 如 'reportedAt:desc'
}

// 撞单预检结果（对应 detectCollision 返回）
export interface CollisionResult {
  collision?: Opportunity
  similar: Opportunity[]
  crossIndustry: Opportunity[]
}

// 新建商机入参：与 store.addOpportunity 一致，服务端生成 id/时间/保护期/锁定状态
export type NewOpportunityInput = Omit<
  Opportunity,
  'id' | 'reportedAt' | 'updatedAt' | 'releaseAt' | 'progressReports' | 'renewalRequests' | 'isFrozen' | 'lockedPermanently'
>

export const opportunityApi = {
  // GET /opportunities —— 后端已按当前用户权限过滤（销售只见自己，管理类见全量）
  list: (query: OpportunityListQuery = {}, signal?: AbortSignal) =>
    api.get<PageResult<Opportunity>>('/opportunities', query as Record<string, string | number>, signal),

  // GET /opportunities/:id
  detail: (id: string) => api.get<Opportunity>(`/opportunities/${id}`),

  // POST /opportunities/check-collision —— 报备前预检
  checkCollision: (input: { customerName: string; industry: string; companyName?: string }) =>
    api.post<CollisionResult>('/opportunities/check-collision', input),

  // POST /opportunities —— 创建（后端再次撞单 + 事务）；撞单时返回 409 + collision
  create: (input: NewOpportunityInput) =>
    api.post<{ opportunity: Opportunity }>('/opportunities', input),

  // PATCH /opportunities/:id/stage —— signed/delivery 时后端自动置永久锁定
  updateStage: (id: string, stage: OpportunityStage, signingInfo?: {
    contractNo: string; signedDate: string; signedAmount: number; contractFileKey?: string
  }) => api.patch<Opportunity>(`/opportunities/${id}/stage`, { stage, signingInfo }),

  release: (id: string, reason: string) =>
    api.post<Opportunity>(`/opportunities/${id}/release`, { reason }),

  freeze: (id: string, reason: string) =>
    api.post<Opportunity>(`/opportunities/${id}/freeze`, { reason }),

  remove: (id: string) => api.del<void>(`/opportunities/${id}`),

  // 解密联系人 —— 仅报备人/管理员，后端 KMS 解密 + 记审计
  getContact: (id: string) =>
    api.get<{ name: string; contact?: string }>(`/opportunities/${id}/contact`),

  // 举证审核
  approveEvidence: (id: string, fileId: string) =>
    api.post<void>(`/opportunities/${id}/evidence/${fileId}/approve`),
  rejectEvidence: (id: string, fileId: string, reason: string) =>
    api.post<void>(`/opportunities/${id}/evidence/${fileId}/reject`, { reason }),

  // 续期
  requestRenewal: (id: string) =>
    api.post<void>(`/opportunities/${id}/renewals`),
  approveRenewal: (id: string, renewalId: string) =>
    api.post<void>(`/opportunities/${id}/renewals/${renewalId}/approve`),
  rejectRenewal: (id: string, renewalId: string, reason: string) =>
    api.post<void>(`/opportunities/${id}/renewals/${renewalId}/reject`, { reason }),

  // 进展上报
  addProgress: (id: string, report: Omit<ProgressReport, 'id' | 'createdAt' | 'opportunityId'>) =>
    api.post<ProgressReport>(`/opportunities/${id}/progress`, report),
}
