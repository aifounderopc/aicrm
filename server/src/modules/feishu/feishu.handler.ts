import { prisma } from '../../db.js'
import type { FeishuInboundMessage, FeishuMessageEvent } from './feishu.receiver.js'
import { processFeishuMessageSignal } from '../agent/agent.service.js'
import { DEFAULT_TENANT_ID } from '../../tenant.js'

export async function handleFeishuMessage(
  message: FeishuInboundMessage,
  _event?: FeishuMessageEvent,
): Promise<void> {
  const saved = await prisma.feishuMessage.upsert({
    where: { id: message.id },
    create: { ...message, tenantId: DEFAULT_TENANT_ID },
    update: {
      chatId: message.chatId,
      chatName: message.chatName,
      senderId: message.senderId,
      senderName: message.senderName,
      messageType: message.messageType,
      contentRaw: message.contentRaw,
      contentText: message.contentText,
      createdAt: message.createdAt,
    },
  })
  // 飞书事件必须快速确认；结构化处理异步执行，并由定时扫描保障最终补偿。
  void processFeishuMessageSignal(saved.id).catch(error => {
    console.error('[agent] feishu signal processing failed', error instanceof Error ? error.message : error)
  })
}
