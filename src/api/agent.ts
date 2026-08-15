import { ApiError, api, buildApiUrl } from './client'

export type AgentSignal = {
  id: string
  opportunityId?: string
  channel: 'feishu'
  time: string
  title: string
  tag: string
  summary: string
  confidence: number
  processingSource: 'deepseek-harness' | 'rules'
  opportunityUpdated: boolean
  chatId: string
  chatName: string
  senderName: string
  sourceCount: number
}

export type AgentStatus = {
  ok: boolean
  configured: boolean
  framework: string
  sdkVersion?: string
  model: string
}

export type AgentPromptLayers = {
  soulPrompt: string
  businessPrompt: string
  responsePrompt: string
}

export type AgentConfiguration = AgentPromptLayers & {
  provider: string
  model: string
  baseUrl: string
  hasApiKey: boolean
  keyHint: string
  defaults: AgentPromptLayers
  updatedAt: string | null
}

export type AgentConfigurationInput = AgentPromptLayers & {
  model: string
  baseUrl: string
  apiKey?: string
}

export type AgentStreamEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'progress'; stage: 'reading' | 'reasoning' | 'writing'; label: string }
  | { type: 'delta'; content: string }
  | { type: 'done'; sessionId: string; fallback?: boolean }
  | { type: 'error'; message: string }

export type OpportunityAdvisorContext = {
  opportunityId: string
  fields: number
  progress: number
  signals: number
  evidence: number
  latestProgressAt: string | null
  latestSignalAt: string | null
}

export type OpportunityInspection = {
  opportunityId: string
  enabled: boolean
  mode: 'automatic' | 'hybrid'
  frequency: string
  range: string
  output: string
  groups: Array<{
    manualId?: string
    channel: 'feishu' | 'wecom' | 'dingtalk' | 'jingme'
    sourceGroupId: string | null
    groupId: string
    groupName: string
    hasSecret: boolean
    origin: 'automatic' | 'manual'
    signalCount: number
    lastSignalAt: string
  }>
  signalCount: number
  latestSignalAt: string | null
}

export type AgentDashboard = {
  analyzedAt: string
  cacheExpiresAt: string
  cacheHit: boolean
  summary: { active: number; processing: number; priority: number; stable: number; releasingSoon: number }
  suggestions: Array<{ id: string; dimension: string; title: string; opportunityId: string; customerName: string; reason: string; action: string; query: string }>
  processing: Array<{ opportunityId: string; customerName: string; stage: string; score: number; reason: string }>
  stable: Array<{ opportunityId: string; customerName: string; stage: string; score: number; reason: string }>
}

async function streamFrom(
  path: string,
  input: { message: string; sessionId?: string },
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST', credentials: 'include', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(input),
  })
  if (!response.ok || !response.body) throw new ApiError('AI 销售伙伴暂时无法响应', response.status)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const processFrame = (frame: string) => {
    const data = frame.split('\n').find(line => line.startsWith('data: '))?.slice(6)
    if (!data) return
    onEvent(JSON.parse(data) as AgentStreamEvent)
  }
  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) processFrame(frame)
    if (done) break
  }
  if (buffer.trim()) processFrame(buffer)
}

export const agentApi = {
  dashboard: () => api.get<AgentDashboard>('/agent/dashboard'),
  config: () => api.get<AgentConfiguration>('/agent/config'),
  testConfig: (input: AgentConfigurationInput) => api.post<{ ok: boolean; content: string; latencyMs: number; model: string }>('/agent/config/test', input),
  updateConfig: (input: AgentConfigurationInput) => api.put<{ ok: boolean; model: string; baseUrl: string; updatedAt: string }>('/agent/config', input),
  status: async () => {
    const response = await fetch(buildApiUrl('/agent/status'), { credentials: 'include' })
    if (!response.ok) throw new ApiError('无法读取 Agent 状态', response.status)
    return response.json() as Promise<AgentStatus>
  },
  signals: async (limit = 50) => {
    const response = await fetch(`${buildApiUrl('/agent/signals')}?limit=${limit}`, { credentials: 'include' })
    if (!response.ok) throw new ApiError('无法读取商机信号', response.status)
    return response.json() as Promise<AgentSignal[]>
  },
  opportunityContext: (opportunityId: string) => api.get<OpportunityAdvisorContext>(`/agent/opportunities/${encodeURIComponent(opportunityId)}/context`),
  opportunityInspection: (opportunityId: string, signal?: AbortSignal) =>
    api.get<OpportunityInspection>(`/agent/opportunities/${encodeURIComponent(opportunityId)}/inspection`, undefined, signal),
  updateOpportunityInspection: (opportunityId: string, input: { groups: Array<{
    manualId?: string
    channel: 'feishu' | 'wecom' | 'dingtalk' | 'jingme'
    sourceGroupId?: string | null
    groupId: string
    groupName: string
    secret?: string
  }> }) => api.put<OpportunityInspection>(`/agent/opportunities/${encodeURIComponent(opportunityId)}/inspection`, input),
  streamChat: (input: { message: string; sessionId?: string }, onEvent: (event: AgentStreamEvent) => void, signal?: AbortSignal) =>
    streamFrom('/agent/chat/stream', input, onEvent, signal),
  streamOpportunityChat: (opportunityId: string, input: { message: string; sessionId?: string }, onEvent: (event: AgentStreamEvent) => void, signal?: AbortSignal) =>
    streamFrom(`/agent/opportunities/${encodeURIComponent(opportunityId)}/chat/stream`, input, onEvent, signal),
}
