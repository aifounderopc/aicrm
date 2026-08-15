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

export const integrationRouter = Router()
integrationRouter.use(requireAuth)

const configSchema = z.object({
  appId: z.string().trim().min(4, '请输入有效的飞书 App ID').max(120),
  appSecret: z.string().trim().max(240).optional(),
})

integrationRouter.get('/feishu', ah(async (_req, res) => {
  const [connection, messageCount, latest] = await Promise.all([
    prisma.integrationConnection.findUnique({ where: { provider: 'feishu' } }),
    prisma.feishuMessage.count(),
    prisma.feishuMessage.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ])
  const runtime = getFeishuReceiverStatus()
  const configured = Boolean(connection || (config.feishuAppId && config.feishuAppSecret))
  res.json({
    configured,
    appId: connection?.appId ?? config.feishuAppId ?? '',
    hasSecret: Boolean(connection?.encryptedAppSecret || config.feishuAppSecret),
    status: runtime.state,
    error: runtime.error ?? connection?.lastError ?? null,
    lastConnectedAt: connection?.lastConnectedAt ?? null,
    messageCount,
    latestMessageAt: latest?.createdAt ?? null,
  })
}))

integrationRouter.put('/feishu', requireRole(isAdminRole), ah(async (req, res) => {
  const auth = req.auth!
  const input = configSchema.parse(req.body)
  const existing = await prisma.integrationConnection.findUnique({ where: { provider: 'feishu' } })
  const appSecret = input.appSecret || (existing ? decryptField(existing.encryptedAppSecret) : '')
  if (!appSecret) throw new ApiError(400, '请输入飞书 App Secret')

  try {
    await verifyFeishuCredentials({ appId: input.appId, appSecret })
    await activateFeishuReceiver({ appId: input.appId, appSecret })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : '飞书连接失败'
    if (existing) {
      await prisma.integrationConnection.update({ where: { provider: 'feishu' }, data: { status: 'failed', lastError: message } })
    }
    throw new ApiError(400, `飞书连接测试失败：${message}`)
  }

  const connection = await prisma.integrationConnection.upsert({
    where: { provider: 'feishu' },
    create: {
      provider: 'feishu', appId: input.appId, encryptedAppSecret: encryptField(appSecret),
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
  const recent = await prisma.feishuMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  let visible = recent

  if (!isAdminRole(auth.user.role)) {
    const opportunityWhere = auth.user.role === 'channel'
      ? { channelId: auth.user.channelId ?? '__none__' }
      : { salesOwnerId: auth.user.id }
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
