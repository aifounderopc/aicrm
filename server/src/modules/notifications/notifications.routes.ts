// 通知模块：仅返回当前用户通知；标记已读；登录高优事项
import { Router } from 'express'
import { prisma } from '../../db.js'
import { ah } from '../../middleware/error.js'
import { requireAuth } from '../../middleware/auth.js'

export const notificationRouter = Router()
notificationRouter.use(requireAuth)

// GET /notifications?unreadOnly=
notificationRouter.get('/', ah(async (req, res) => {
  const auth = req.auth!
  const unreadOnly = req.query.unreadOnly === 'true'
  const list = await prisma.notification.findMany({
    where: { userId: auth.user.id, ...(unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: 'desc' }, take: 50,
  })
  res.json(list)
}))

// GET /notifications/high-priority —— 登录卡片用（未读 error/warning）
notificationRouter.get('/high-priority', ah(async (req, res) => {
  const auth = req.auth!
  const list = await prisma.notification.findMany({
    where: { userId: auth.user.id, read: false, type: { in: ['error', 'warning'] } },
    orderBy: { createdAt: 'desc' }, take: 3,
  })
  res.json(list)
}))

// PATCH /notifications/:id/read
notificationRouter.patch('/:id/read', ah(async (req, res) => {
  const auth = req.auth!
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: auth.user.id }, data: { read: true } })
  res.status(204).end()
}))

// POST /notifications/read-all
notificationRouter.post('/read-all', ah(async (req, res) => {
  const auth = req.auth!
  await prisma.notification.updateMany({ where: { userId: auth.user.id, read: false }, data: { read: true } })
  res.status(204).end()
}))
