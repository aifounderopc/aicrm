import { api } from './client'

export type FeishuConnectionStatus = {
  configured: boolean
  appId: string
  hasSecret: boolean
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
  error: string | null
  lastConnectedAt: string | null
  messageCount: number
  latestMessageAt: string | null
}

export type FeishuMessage = {
  id: string
  chatId: string
  chatName: string
  senderId: string
  senderName: string
  messageType: string
  content: string
  createdAt: string
}

export type DraftImProvider = 'wecom' | 'dingtalk' | 'jingme'

export type DraftImConnectionStatus = {
  provider: DraftImProvider
  configured: boolean
  appId: string
  hasSecret: boolean
  status: 'configured' | 'not_configured'
  updatedAt: string | null
}

export const integrationApi = {
  feishuStatus: () => api.get<FeishuConnectionStatus>('/integrations/feishu'),
  configureFeishu: (input: { appId: string; appSecret?: string }) =>
    api.put<FeishuConnectionStatus>('/integrations/feishu', input),
  imStatus: (provider: DraftImProvider) => api.get<DraftImConnectionStatus>(`/integrations/im/${provider}`),
  configureIm: (provider: DraftImProvider, input: { appId: string; appSecret?: string }) =>
    api.put<DraftImConnectionStatus>(`/integrations/im/${provider}`, input),
  feishuMessages: (limit = 50) => api.get<FeishuMessage[]>('/integrations/feishu/messages', { limit }),
}
