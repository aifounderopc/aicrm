import * as Lark from '@larksuiteoapi/node-sdk'

export type FeishuMessageEvent = Parameters<NonNullable<Lark.EventHandles['im.message.receive_v1']>>[0]

export type FeishuInboundMessage = {
  id: string
  chatId: string
  chatName: string
  senderId: string
  senderName: string
  messageType: string
  contentRaw: string
  contentText: string
  createdAt: Date
}

export type FeishuCredentials = { appId: string; appSecret: string }
export type FeishuReceiverState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
export type FeishuMessageHandler = (message: FeishuInboundMessage, event: FeishuMessageEvent) => Promise<void>

type FeishuUserIdType = 'open_id' | 'user_id' | 'union_id'
type SenderIdentity = { id: string; type: FeishuUserIdType }

let activeClient: Lark.WSClient | null = null
let receiverState: FeishuReceiverState = 'idle'
let receiverError: string | null = null

function senderIdentity(event: FeishuMessageEvent): SenderIdentity | undefined {
  const senderId = event.sender.sender_id
  if (senderId?.open_id) return { id: senderId.open_id, type: 'open_id' }
  if (senderId?.user_id) return { id: senderId.user_id, type: 'user_id' }
  if (senderId?.union_id) return { id: senderId.union_id, type: 'union_id' }
}

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : '飞书长连接异常'
}

function readableContent(raw: string, messageType: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed.text === 'string') return parsed.text
    if (typeof parsed.title === 'string') return parsed.title
  } catch { /* 保留消息类型占位，原始内容仍单独入库 */ }
  const labels: Record<string, string> = {
    image: '[图片消息]', file: '[文件消息]', audio: '[音频消息]', media: '[视频消息]', sticker: '[表情消息]', post: '[富文本消息]', interactive: '[卡片消息]',
  }
  return labels[messageType] ?? `[${messageType || '未知类型'}消息]`
}

async function getGroupName(client: Lark.Client, groupId: string): Promise<string> {
  try {
    const response = await client.im.chat.get({ path: { chat_id: groupId } })
    if (response.data?.name) return response.data.name
    console.warn('[feishu] group name lookup failed', { group_id: groupId, response_code: response.code })
  } catch (error) {
    console.warn('[feishu] group name lookup failed', { group_id: groupId, error_type: errorType(error) })
  }
  return '未知飞书群'
}

async function getSenderName(client: Lark.Client, sender: SenderIdentity | undefined): Promise<string> {
  if (!sender) return '未知发送人'
  try {
    const response = await client.contact.user.get({
      path: { user_id: sender.id },
      params: { user_id_type: sender.type },
    })
    if (response.data?.user?.name) return response.data.user.name
    console.warn('[feishu] sender name lookup failed', { sender_id: sender.id, response_code: response.code })
  } catch (error) {
    console.warn('[feishu] sender name lookup failed', { sender_id: sender.id, error_type: errorType(error) })
  }
  return '未知发送人'
}

export function getFeishuReceiverStatus() {
  const sdkState = activeClient?.getConnectionStatus().state
  return { state: (sdkState ?? receiverState) as FeishuReceiverState, error: receiverError }
}

export async function verifyFeishuCredentials(credentials: FeishuCredentials): Promise<void> {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: credentials.appId, app_secret: credentials.appSecret }),
    signal: AbortSignal.timeout(10_000),
  })
  const result = await response.json() as { code?: number; msg?: string; tenant_access_token?: string }
  if (!response.ok || result.code !== 0 || !result.tenant_access_token) {
    throw new Error(result.msg || `飞书鉴权失败（${response.status}）`)
  }
}

export async function startFeishuMessageReceiver(
  credentials: FeishuCredentials,
  handler: FeishuMessageHandler,
): Promise<void> {
  activeClient?.close({ force: true })
  activeClient = null
  receiverState = 'connecting'
  receiverError = null

  const client = new Lark.Client({
    appId: credentials.appId,
    appSecret: credentials.appSecret,
    loggerLevel: Lark.LoggerLevel.error,
  })

  const eventDispatcher = new Lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (event) => {
      if (event.message.chat_type !== 'group' || event.sender.sender_type !== 'user') return
      const sender = senderIdentity(event)
      const chatId = event.message.chat_id
      const senderId = sender?.id ?? 'unknown'
      const [chatName, senderName] = await Promise.all([
        getGroupName(client, chatId),
        getSenderName(client, sender),
      ])
      const contentRaw = event.message.content ?? ''
      const createdAt = new Date(Number(event.message.create_time))
      const message: FeishuInboundMessage = {
        id: event.message.message_id,
        chatId,
        chatName,
        senderId,
        senderName,
        messageType: event.message.message_type,
        contentRaw,
        contentText: readableContent(contentRaw, event.message.message_type),
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      }

      console.info('[feishu] message received', {
        message_id: message.id,
        group_name: message.chatName,
        group_id: message.chatId,
        sender_name: message.senderName,
        sender_id: message.senderId,
        message_type: message.messageType,
        message_time: message.createdAt.toISOString(),
      })

      try {
        await handler(message, event)
      } catch (error) {
        console.error('[feishu] message handler failed', {
          message_id: message.id,
          group_id: message.chatId,
          error_type: errorType(error),
        })
        throw new Error('Feishu message handler failed')
      }
    },
  })

  const wsClient = new Lark.WSClient({
    appId: credentials.appId,
    appSecret: credentials.appSecret,
    loggerLevel: Lark.LoggerLevel.error,
    onReady: () => { receiverState = 'connected'; receiverError = null },
    onReconnecting: () => { receiverState = 'reconnecting' },
    onReconnected: () => { receiverState = 'connected'; receiverError = null },
    onError: error => { receiverState = 'failed'; receiverError = errorMessage(error) },
    handshakeTimeoutMs: 10_000,
  })
  activeClient = wsClient

  try {
    await wsClient.start({ eventDispatcher })
  } catch (error) {
    receiverState = 'failed'
    receiverError = errorMessage(error)
    throw error
  }
}
