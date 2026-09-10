// 操作日志模块：只读查询，日志写入统一由服务端审计工具完成
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db.js'
import { ApiError, ah } from '../../middleware/error.js'
import { requireAuth } from '../../middleware/auth.js'
import { isAdminRole } from '../../middleware/roles.js'

export const logRouter = Router()
logRouter.use(requireAuth)

const querySchema = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

function toClientLog(log: {
  id: string
  actorId: string
  actorName: string
  action: string
  detail: string
  targetId: string | null
  ip: string
  userAgent: string
  createdAt: Date
}) {
  return {
    id: log.id,
    opportunityId: log.targetId ?? '',
    operatorId: log.actorId,
    operatorName: log.actorName,
    action: log.action,
    detail: log.detail,
    ip: log.ip,
    device: log.userAgent,
    createdAt: log.createdAt,
  }
}

// GET /logs?actorId=&action=&from=&to=&page=&pageSize=
logRouter.get('/', ah(async (req, res) => {
  const auth = req.auth!
  if (!isAdminRole(auth.authRole)) throw new ApiError(403, '无权限查看操作日志')

  const query = querySchema.parse(req.query)
  const where: Record<string, unknown> = { tenantId: auth.user.tenantId }
  if (query.actorId) where.actorId = query.actorId
  if (query.action) where.action = { contains: query.action }
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    }
  }

  const [items, total] = await Promise.all([
    prisma.operationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.operationLog.count({ where }),
  ])

  res.json({ items: items.map(toClientLog), total, page: query.page, pageSize: query.pageSize })
}))
