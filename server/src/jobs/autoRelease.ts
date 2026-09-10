// 保护期自动释放 + 即将到期提醒
// 扫描到期的 reporting/signing(非永久锁定)商机 → released + 通知 + 日志
// 生产建议用独立 cron/定时任务触发；此处提供函数 + 简易定时器
import { prisma } from '../db.js'

export async function runAutoRelease() {
  const now = new Date()
  const expired = await prisma.opportunity.findMany({
    where: { stage: { in: ['reporting', 'contacting', 'proposal', 'negotiation', 'signing'] }, lockedPermanently: false, releaseAt: { lt: now } },
    select: { id: true, tenantId: true, customerName: true, salesOwnerId: true },
  })

  for (const o of expired) {
    await prisma.$transaction([
      prisma.opportunity.update({ where: { id: o.id }, data: { stage: 'released', releasedAt: now, releaseReason: '保护期到期自动释放', releasedBy: 'system' } }),
      prisma.notification.create({ data: { userId: o.salesOwnerId, title: '商机已自动释放', body: `「${o.customerName}」保护期到期，已自动释放`, type: 'warning' } }),
      prisma.operationLog.create({ data: { tenantId: o.tenantId, actorId: 'system', actorName: '系统', action: '自动释放', detail: `「${o.customerName}」保护期到期`, targetType: 'opportunity', targetId: o.id, ip: 'system', userAgent: 'cron' } }),
    ]).catch(e => console.error('[autoRelease] 释放失败', o.id, e))
  }

  // 即将到期（≤7 天）提醒：每个商机每天最多提醒一次（按当天是否已存在同类通知粗略判断）
  const soon = await prisma.opportunity.findMany({
    where: {
      stage: { in: ['reporting', 'contacting', 'proposal', 'negotiation', 'signing'] }, lockedPermanently: false,
      releaseAt: { gte: now, lte: new Date(now.getTime() + 7 * 86400_000) },
    },
    select: { id: true, customerName: true, salesOwnerId: true, releaseAt: true },
  })
  for (const o of soon) {
    const days = Math.ceil((o.releaseAt.getTime() - now.getTime()) / 86400_000)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dup = await prisma.notification.findFirst({ where: { userId: o.salesOwnerId, opportunityId: o.id, type: 'warning', createdAt: { gte: startOfDay } } })
    if (!dup) {
      await prisma.notification.create({ data: { userId: o.salesOwnerId, opportunityId: o.id, title: '商机即将到期', body: `「${o.customerName}」保护期仅剩 ${days} 天，请尽快推进或申请续期`, type: 'warning' } })
    }
  }

  if (expired.length || soon.length) console.log(`[autoRelease] 释放 ${expired.length}，到期提醒 ${soon.length}`)
}

// 简易定时器（开发用）：每小时跑一次。生产请改用系统 cron / 京东云定时任务调用本函数。
export function scheduleAutoRelease() {
  runAutoRelease().catch(console.error)
  setInterval(() => runAutoRelease().catch(console.error), 60 * 60 * 1000)
}
