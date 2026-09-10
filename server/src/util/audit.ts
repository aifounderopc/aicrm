// 审计日志写入（真实 IP / UA，由后端记录）
import type { Request } from 'express'
import { prisma } from '../db.js'
import { DEFAULT_TENANT_ID } from '../tenant.js'

export async function writeLog(req: Request, params: {
  actorId: string
  actorName: string
  action: string
  detail: string
  targetType?: string
  targetId?: string
}) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress || 'unknown'
  const userAgent = (req.headers['user-agent'] as string) || 'unknown'
  await prisma.operationLog.create({
    data: { ...params, tenantId: req.auth?.user.tenantId || DEFAULT_TENANT_ID, ip, userAgent },
  }).catch(e => console.error('[audit] 写日志失败', e))
}
