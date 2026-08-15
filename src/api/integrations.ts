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

export const integrationApi = {
  feishuStatus: () => api.get<FeishuConnectionStatus>('/integrations/feishu'),
  configureFeishu: (input: { appId: string; appSecret?: string }) =>
    api.put<FeishuConnectionStatus>('/integrations/feishu', input),
  feishuMessages: (limit = 50) => api.get<FeishuMessage[]>('/integrations/feishu/messages', { limit }),
}
