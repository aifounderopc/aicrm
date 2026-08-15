import { prisma } from '../../db.js'
import { handleFeishuMessage } from './feishu.handler.js'
import { readableContent, type FeishuCredentials, type FeishuInboundMessage } from './feishu.receiver.js'

type FeishuResponse<T> = { code?: number; msg?: string; data?: T }
type ChatItem = { chat_id?: string; name?: string }
type MessageItem = {
  message_id?: string
  chat_id?: string
  msg_type?: string
  create_time?: string
  sender?: { id?: string; id_type?: string; sender_type?: string }
  body?: { content?: string }
}

let pollTimer: NodeJS.Timeout | undefined
let currentCredentials: FeishuCredentials | undefined
let syncing = false
let cachedToken = ''
let tokenExpiresAt = 0
let credentialSignature = ''
const senderNames = new Map<string, string>()

async function feishuJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  })
  const result = await response.json() as FeishuResponse<T>
  if (!response.ok || result.code !== 0 || !result.data) {
    throw new Error(result.msg || `飞书接口请求失败（${response.status}）`)
  }
  return result.data
}

async function tenantToken(credentials: FeishuCredentials): Promise<string> {
  const signature = `${credentials.appId}:${credentials.appSecret}`
  if (cachedToken && credentialSignature === signature && Date.now() < tokenExpiresAt) return cachedToken
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: credentials.appId, app_secret: credentials.appSecret }),
    signal: AbortSignal.timeout(10_000),
  })
  const result = await response.json() as { code?: number; msg?: string; tenant_access_token?: string; expire?: number }
  if (!response.ok || result.code !== 0 || !result.tenant_access_token) throw new Error(result.msg || '飞书鉴权失败')
  cachedToken = result.tenant_access_token
  credentialSignature = signature
  tokenExpiresAt = Date.now() + Math.max(60, (result.expire ?? 7200) - 300) * 1000
  return cachedToken
}

async function listChats(token: string): Promise<ChatItem[]> {
  const result: ChatItem[] = []
  let pageToken = ''
  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({ page_size: '100' })
    if (pageToken) query.set('page_token', pageToken)
    const data = await feishuJson<{ items?: ChatItem[]; has_more?: boolean; page_token?: string }>(
      `https://open.feishu.cn/open-apis/im/v1/chats?${query}`, token,
    )
    result.push(...(data.items ?? []))
    if (!data.has_more || !data.page_token) break
    pageToken = data.page_token
  }
  return result
}

async function senderName(token: string, sender?: MessageItem['sender']): Promise<string> {
  if (!sender?.id) return '未知发送人'
  const cached = senderNames.get(sender.id)
  if (cached) return cached
  try {
    const data = await feishuJson<{ user?: { name?: string } }>(
      `https://open.feishu.cn/open-apis/contact/v3/users/${encodeURIComponent(sender.id)}?user_id_type=${encodeURIComponent(sender.id_type || 'open_id')}`,
      token,
    )
    const name = data.user?.name || '未知发送人'
    senderNames.set(sender.id, name)
    return name
  } catch {
    return '未知发送人'
  }
}

async function listRecentMessages(token: string, chatId: string): Promise<MessageItem[]> {
  const query = new URLSearchParams({
    container_id_type: 'chat', container_id: chatId,
    sort_type: 'ByCreateTimeDesc', page_size: '50',
  })
  const data = await feishuJson<{ items?: MessageItem[] }>(
    `https://open.feishu.cn/open-apis/im/v1/messages?${query}`, token,
  )
  return data.items ?? []
}

export async function syncFeishuHistory(credentials: FeishuCredentials): Promise<number> {
  if (syncing) return 0
  syncing = true
  try {
    const token = await tenantToken(credentials)
    const chats = await listChats(token)
    const candidates: Array<{ chat: ChatItem; item: MessageItem }> = []
    for (const chat of chats) {
      if (!chat.chat_id) continue
      const items = await listRecentMessages(token, chat.chat_id)
      for (const item of items) {
        if (item.message_id && item.sender?.sender_type === 'user' && item.msg_type !== 'system') candidates.push({ chat, item })
      }
    }

    const ids = candidates.map(entry => entry.item.message_id!).filter(Boolean)
    const existing = ids.length
      ? await prisma.feishuMessage.findMany({ where: { id: { in: ids } }, select: { id: true } })
      : []
    const known = new Set(existing.map(item => item.id))
    const pending = candidates
      .filter(entry => !known.has(entry.item.message_id!))
      .sort((a, b) => Number(a.item.create_time ?? 0) - Number(b.item.create_time ?? 0))

    for (const { chat, item } of pending) {
      const contentRaw = item.body?.content ?? ''
      const createdAt = new Date(Number(item.create_time))
      const message: FeishuInboundMessage = {
        id: item.message_id!,
        chatId: item.chat_id || chat.chat_id!,
        chatName: chat.name || '未知飞书群',
        senderId: item.sender?.id || 'unknown',
        senderName: await senderName(token, item.sender),
        messageType: item.msg_type || 'unknown',
        contentRaw,
        contentText: readableContent(contentRaw, item.msg_type || 'unknown'),
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      }
      await handleFeishuMessage(message)
    }

    await prisma.integrationConnection.updateMany({
      where: { provider: 'feishu' },
      data: { status: 'connected', lastError: null, lastConnectedAt: new Date() },
    })
    if (pending.length) console.info('[feishu] history sync completed', { chats: chats.length, inserted: pending.length })
    return pending.length
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : '飞书消息同步失败'
    await prisma.integrationConnection.updateMany({
      where: { provider: 'feishu' }, data: { status: 'failed', lastError: message },
    }).catch(() => undefined)
    console.error('[feishu] history sync failed', message)
    return 0
  } finally {
    syncing = false
  }
}

export function startFeishuHistorySync(credentials: FeishuCredentials) {
  currentCredentials = credentials
  if (pollTimer) clearInterval(pollTimer)
  void syncFeishuHistory(credentials)
  pollTimer = setInterval(() => {
    if (currentCredentials) void syncFeishuHistory(currentCredentials)
  }, 20_000)
  pollTimer.unref()
}
