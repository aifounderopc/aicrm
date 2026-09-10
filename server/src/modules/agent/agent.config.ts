import { config } from '../../config.js'
import { prisma } from '../../db.js'
import { decryptField, encryptField } from '../../util/crypto.js'
import { assembleAgentSystemPrompt, DEFAULT_BUSINESS_PROMPT, DEFAULT_RESPONSE_PROMPT, DEFAULT_SOUL_PROMPT } from './agent.prompts.js'
import { DEFAULT_TENANT_ID } from '../../tenant.js'

export type AgentRuntimeConfig = {
  id?: string
  name?: string
  model: string
  baseUrl: string
  apiKey: string
  soulPrompt: string
  businessPrompt: string
  responsePrompt: string
  systemPrompt: string
}

export async function loadAgentRuntimeConfigs(tenantId = DEFAULT_TENANT_ID): Promise<AgentRuntimeConfig[]> {
  const [stored, models] = await Promise.all([
    prisma.agentConfiguration.findUnique({ where: { tenantId } }),
    prisma.agentModelConfiguration.findMany({
      where: { tenantId, enabled: true },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }, { createdAt: 'asc' }],
    }),
  ])
  const editable = {
    soulPrompt: stored?.soulPrompt ?? DEFAULT_SOUL_PROMPT,
    businessPrompt: stored?.businessPrompt ?? DEFAULT_BUSINESS_PROMPT,
    responsePrompt: stored?.responsePrompt ?? DEFAULT_RESPONSE_PROMPT,
  }
  const systemPrompt = assembleAgentSystemPrompt(editable)
  const rankedModels = [...models].sort((a, b) => {
    const statusRank = (status: string | null) => status === 'healthy' ? 0 : status === 'failed' ? 2 : 1
    return statusRank(a.lastStatus) - statusRank(b.lastStatus)
      || Number(b.isDefault) - Number(a.isDefault)
      || a.priority - b.priority
      || a.createdAt.getTime() - b.createdAt.getTime()
  })
  if (rankedModels.length) return rankedModels.map(item => ({
    id: item.id, name: item.name, model: item.model, baseUrl: item.baseUrl,
    apiKey: decryptField(item.encryptedApiKey), ...editable, systemPrompt,
  }))
  return [{
    id: 'environment-default', name: '环境默认模型',
    model: stored?.model ?? config.deepseekModel,
    baseUrl: stored?.baseUrl ?? config.deepseekBaseUrl,
    apiKey: stored ? decryptField(stored.encryptedApiKey) : (config.deepseekApiKey ?? ''),
    ...editable, systemPrompt,
  }]
}

export async function loadAgentRuntimeConfig(tenantId = DEFAULT_TENANT_ID): Promise<AgentRuntimeConfig> {
  return (await loadAgentRuntimeConfigs(tenantId))[0]
}

export async function persistEnvironmentAgentConfig(): Promise<void> {
  if (!config.deepseekApiKey) return
  await prisma.agentConfiguration.upsert({
    where: { tenantId: DEFAULT_TENANT_ID },
    create: {
      id: 'default', tenantId: DEFAULT_TENANT_ID, model: config.deepseekModel, baseUrl: config.deepseekBaseUrl,
      encryptedApiKey: encryptField(config.deepseekApiKey), soulPrompt: DEFAULT_SOUL_PROMPT,
      businessPrompt: DEFAULT_BUSINESS_PROMPT, responsePrompt: DEFAULT_RESPONSE_PROMPT,
    },
    update: {},
  })
  const existingModels = await prisma.agentModelConfiguration.count({ where: { tenantId: DEFAULT_TENANT_ID } })
  if (!existingModels) await prisma.agentModelConfiguration.create({ data: {
    tenantId: DEFAULT_TENANT_ID, name: '环境默认模型', model: config.deepseekModel, baseUrl: config.deepseekBaseUrl,
    encryptedApiKey: encryptField(config.deepseekApiKey), enabled: true, isDefault: true, priority: 0,
  } })
}

export const agentPromptDefaults = {
  soulPrompt: DEFAULT_SOUL_PROMPT,
  businessPrompt: DEFAULT_BUSINESS_PROMPT,
  responsePrompt: DEFAULT_RESPONSE_PROMPT,
}
