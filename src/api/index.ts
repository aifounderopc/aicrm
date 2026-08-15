// API 数据层统一出口
export { api, request, ApiError, setUnauthorizedHandler } from './client'

export { authApi } from './auth'
export type { AuthUser, MeResponse } from './auth'

export { opportunityApi } from './opportunities'
export type { PageResult, OpportunityListQuery, CollisionResult, NewOpportunityInput } from './opportunities'

export { channelApi } from './channels'
export type { ChannelWithStats, AccountDraft } from './channels'

export { userApi } from './users'
export type { UserListQuery, CreateUserInput, SalesUserWithStats } from './users'

export { notificationApi } from './notifications'

export { logApi } from './logs'
export type { LogQuery } from './logs'

export { integrationApi } from './integrations'
export type { FeishuConnectionStatus, FeishuMessage } from './integrations'
export { agentApi } from './agent'
export type { AgentSignal, AgentStatus, AgentStreamEvent } from './agent'
