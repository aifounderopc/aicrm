import { Router } from 'express'
import { z } from 'zod'
import { config } from '../../config.js'
import { prisma } from '../../db.js'
import { requireAuth } from '../../middleware/auth.js'
import { ApiError, ah } from '../../middleware/error.js'
import { isAdminRole, requireRole } from '../../middleware/roles.js'
import { writeLog } from '../../util/audit.js'
import { decryptField, encryptField } from '../../util/crypto.js'
import { activateFeishuReceiver } from '../feishu/feishu.service.js'
import { getFeishuReceiverStatus, verifyFeishuCredentials } from '../feishu/feishu.receiver.js'
import { DEFAULT_TENANT_ID } from '../../tenant.js'

export const integrationRouter = Router()
integrationRouter.use(requireAuth)

const configSchema = z.object({
  appId: z.string().trim().min(4, '请输入有效的飞书 App ID').max(120),
  appSecret: z.string().trim().max(240).optional(),
})

const draftImProviders = ['wecom', 'dingtalk', 'jingme'] as const
const draftImProviderSchema = z.enum(draftImProviders)
const draftImConfigSchema = z.object({
  appId: z.string().trim().min(2, '请输入有效的应用标识').max(120),
  appSecret: z.string().trim().max(240).optional(),
})
const draftImNames: Record<(typeof draftImProviders)[number], string> = {
  wecom: '企微', dingtalk: '钉钉', jingme: '京 Me',
}

integrationRouter.get('/im/:provider', ah(async (req, res) => {
  const provider = draftImProviderSchema.parse(req.params.provider)
  const tenantId = req.auth!.user.tenantId
  const connection = await prisma.integrationConnection.findUnique({ where: { tenantId_provider: { tenantId, provider } } })
  res.json({
    provider,
    configured: Boolean(connection),
    appId: connection?.appId ?? '',
    hasSecret: Boolean(connection?.encryptedAppSecret),
    status: connection ? 'configured' : 'not_configured',
    updatedAt: connection?.updatedAt ?? null,
  })
}))

integrationRouter.put('/im/:provider', requireRole(isAdminRole), ah(async (req, res) => {
  const auth = req.auth!
  const provider = draftImProviderSchema.parse(req.params.provider)
  const input = draftImConfigSchema.parse(req.body)
  const tenantId = auth.user.tenantId
  const existing = await prisma.integrationConnection.findUnique({ where: { tenantId_provider: { tenantId, provider } } })
  const appSecret = input.appSecret || (existing ? decryptField(existing.encryptedAppSecret) : '')
  if (!appSecret) throw new ApiError(400, `请输入${draftImNames[provider]}应用密钥`)

  const connection = await prisma.integrationConnection.upsert({
    where: { tenantId_provider: { tenantId, provider } },
    create: {
      tenantId, provider, appId: input.appId, encryptedAppSecret: encryptField(appSecret),
      status: 'configured', updatedBy: auth.user.id,
    },
    update: {
      appId: input.appId, encryptedAppSecret: encryptField(appSecret), status: 'configured',
      lastError: null, updatedBy: auth.user.id,
    },
  })
  await writeLog(req, {
    actorId: auth.user.id,
    actorName: auth.user.name,
    action: `配置${draftImNames[provider]}连接器`,
    detail: `${draftImNames[provider]}应用 ${input.appId} 的配置已安全保存，等待 SDK 接入`,
    targetType: 'integration',
    targetId: connection.id,
  })
  res.json({ provider, configured: true, appId: connection.appId, hasSecret: true, status: 'configured', updatedAt: connection.updatedAt })
}))

integrationRouter.get('/feishu', ah(async (req, res) => {
  const tenantId = req.auth!.user.tenantId
  const [connection, messageCount, latest] = await Promise.all([
    prisma.integrationConnection.findUnique({ where: { tenantId_provider: { tenantId, provider: 'feishu' } } }),
    prisma.feishuMessage.count({ where: { tenantId } }),
    prisma.feishuMessage.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ])
  const runtime = getFeishuReceiverStatus()
  const useEnvironmentDefault = tenantId === DEFAULT_TENANT_ID
  const configured = Boolean(connection || (useEnvironmentDefault && config.feishuAppId && config.feishuAppSecret))
  res.json({
    configured,
    appId: connection?.appId ?? (useEnvironmentDefault ? config.feishuAppId : '') ?? '',
    hasSecret: Boolean(connection?.encryptedAppSecret || (useEnvironmentDefault && config.feishuAppSecret)),
    status: configured ? runtime.state : 'idle',
    error: configured ? runtime.error ?? connection?.lastError ?? null : null,
    lastConnectedAt: connection?.lastConnectedAt ?? null,
    messageCount,
    latestMessageAt: latest?.createdAt ?? null,
  })
}))

integrationRouter.put('/feishu', requireRole(isAdminRole), ah(async (req, res) => {
  const auth = req.auth!
  const tenantId = auth.user.tenantId
  const input = configSchema.parse(req.body)
  const existing = await prisma.integrationConnection.findUnique({ where: { tenantId_provider: { tenantId, provider: 'feishu' } } })
  const appSecret = input.appSecret || (existing ? decryptField(existing.encryptedAppSecret) : '')
  if (!appSecret) throw new ApiError(400, '请输入飞书 App Secret')

  try {
    await verifyFeishuCredentials({ appId: input.appId, appSecret })
    await activateFeishuReceiver({ appId: input.appId, appSecret })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : '飞书连接失败'
    if (existing) {
      await prisma.integrationConnection.update({ where: { tenantId_provider: { tenantId, provider: 'feishu' } }, data: { status: 'failed', lastError: message } })
    }
    throw new ApiError(400, `飞书连接测试失败：${message}`)
  }

  const connection = await prisma.integrationConnection.upsert({
    where: { tenantId_provider: { tenantId, provider: 'feishu' } },
    create: {
      tenantId, provider: 'feishu', appId: input.appId, encryptedAppSecret: encryptField(appSecret),
      status: 'connected', lastConnectedAt: new Date(), updatedBy: auth.user.id,
    },
    update: {
      appId: input.appId, encryptedAppSecret: encryptField(appSecret), status: 'connected',
      lastError: null, lastConnectedAt: new Date(), updatedBy: auth.user.id,
    },
  })
  await writeLog(req, {
    actorId: auth.user.id,
    actorName: auth.user.name,
    action: '配置飞书连接器',
    detail: `飞书应用 ${input.appId} 已完成鉴权与长连接测试`,
    targetType: 'integration',
    targetId: connection.id,
  })
  res.json({ configured: true, appId: connection.appId, hasSecret: true, status: getFeishuReceiverStatus().state, error: null })
}))

const messageQuerySchema = z.object({ limit: z.coerce.number().int().positive().max(50).default(50) })

integrationRouter.get('/feishu/messages', ah(async (req, res) => {
  const auth = req.auth!
  const { limit } = messageQuerySchema.parse(req.query)
  const recent = await prisma.feishuMessage.findMany({ where: { tenantId: auth.user.tenantId }, orderBy: { createdAt: 'desc' }, take: 200 })
  let visible = recent

  if (!isAdminRole(auth.user.role)) {
    const opportunityWhere = auth.user.role === 'channel'
      ? { tenantId: auth.user.tenantId, channelId: auth.user.channelId ?? '__none__' }
      : { tenantId: auth.user.tenantId, salesOwnerId: auth.user.id }
    const opportunities = await prisma.opportunity.findMany({
      where: opportunityWhere,
      select: { customerName: true, companyName: true },
    })
    visible = recent.filter(message => opportunities.some(opp =>
      message.chatName.includes(opp.customerName)
      || message.contentText.includes(opp.customerName)
      || (opp.companyName && (message.chatName.includes(opp.companyName) || message.contentText.includes(opp.companyName))),
    ))
  }

  res.json(visible.slice(0, limit).map(message => ({
    id: message.id,
    chatId: message.chatId,
    chatName: message.chatName,
    senderId: message.senderId,
    senderName: message.senderName,
    messageType: message.messageType,
    content: message.contentText,
    createdAt: message.createdAt,
  })))
}))
