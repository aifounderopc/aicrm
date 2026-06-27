// 发送站内通知（写 notifications 表）
import { prisma } from '../db.js'

export async function notify(params: {
  userId: string
  title: string
  body: string
  type?: 'info' | 'warning' | 'success' | 'error'
  opportunityId?: string
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      title: params.title,
      body: params.body,
      type: params.type ?? 'info',
      opportunityId: params.opportunityId,
    },
  }).catch(e => console.error('[notify] 发送失败', e))
}

// 给所有管理员发通知（如续期申请待审批）
export async function notifyAdmins(params: { title: string; body: string; type?: 'info' | 'warning' | 'success' | 'error'; opportunityId?: string }) {
  const admins = await prisma.user.findMany({ where: { role: 'admin', disabled: false }, select: { id: true } })
  await Promise.all(admins.map(a => notify({ userId: a.id, ...params })))
}
