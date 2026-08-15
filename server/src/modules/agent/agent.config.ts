import { config } from '../../config.js'
import { prisma } from '../../db.js'
import { decryptField, encryptField } from '../../util/crypto.js'
import { assembleAgentSystemPrompt, DEFAULT_BUSINESS_PROMPT, DEFAULT_RESPONSE_PROMPT, DEFAULT_SOUL_PROMPT } from './agent.prompts.js'

export type AgentRuntimeConfig = {
  model: string
  baseUrl: string
  apiKey: string
  soulPrompt: string
  businessPrompt: string
  responsePrompt: string
  systemPrompt: string
}

export async function loadAgentRuntimeConfig(): Promise<AgentRuntimeConfig> {
  const stored = await prisma.agentConfiguration.findUnique({ where: { id: 'default' } })
  const editable = {
    soulPrompt: stored?.soulPrompt ?? DEFAULT_SOUL_PROMPT,
    businessPrompt: stored?.businessPrompt ?? DEFAULT_BUSINESS_PROMPT,
    responsePrompt: stored?.responsePrompt ?? DEFAULT_RESPONSE_PROMPT,
  }
  const runtime = {
    model: stored?.model ?? config.deepseekModel,
    baseUrl: stored?.baseUrl ?? config.deepseekBaseUrl,
    apiKey: stored ? decryptField(stored.encryptedApiKey) : (config.deepseekApiKey ?? ''),
    ...editable,
  }
  return { ...runtime, systemPrompt: assembleAgentSystemPrompt(editable) }
}

export async function persistEnvironmentAgentConfig(): Promise<void> {
  if (!config.deepseekApiKey) return
  await prisma.agentConfiguration.upsert({
    where: { id: 'default' },
    create: {
      id: 'default', model: config.deepseekModel, baseUrl: config.deepseekBaseUrl,
      encryptedApiKey: encryptField(config.deepseekApiKey), soulPrompt: DEFAULT_SOUL_PROMPT,
      businessPrompt: DEFAULT_BUSINESS_PROMPT, responsePrompt: DEFAULT_RESPONSE_PROMPT,
    },
    update: {},
  })
}

export const agentPromptDefaults = {
  soulPrompt: DEFAULT_SOUL_PROMPT,
  businessPrompt: DEFAULT_BUSINESS_PROMPT,
  responsePrompt: DEFAULT_RESPONSE_PROMPT,
}
