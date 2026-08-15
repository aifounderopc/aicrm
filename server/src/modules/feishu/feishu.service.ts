import { config } from '../../config.js'
import { prisma } from '../../db.js'
import { decryptField } from '../../util/crypto.js'
import { handleFeishuMessage } from './feishu.handler.js'
import { startFeishuMessageReceiver, type FeishuCredentials } from './feishu.receiver.js'

export async function loadFeishuCredentials(): Promise<FeishuCredentials | undefined> {
  const stored = await prisma.integrationConnection.findUnique({ where: { provider: 'feishu' } })
  if (stored) {
    return { appId: stored.appId, appSecret: decryptField(stored.encryptedAppSecret) }
  }
  if (config.feishuAppId && config.feishuAppSecret) {
    return { appId: config.feishuAppId, appSecret: config.feishuAppSecret }
  }
}

export async function activateFeishuReceiver(credentials?: FeishuCredentials): Promise<boolean> {
  const resolved = credentials ?? await loadFeishuCredentials()
  if (!resolved) return false
  await startFeishuMessageReceiver(resolved, handleFeishuMessage)
  return true
}
