import { prisma } from '../../db.js'
import type { FeishuInboundMessage, FeishuMessageEvent } from './feishu.receiver.js'

export async function handleFeishuMessage(
  message: FeishuInboundMessage,
  _event: FeishuMessageEvent,
): Promise<void> {
  await prisma.feishuMessage.upsert({
    where: { id: message.id },
    create: message,
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
}
