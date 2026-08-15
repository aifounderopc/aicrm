import 'dotenv/config' // 必须最先执行：加载 .env 到 process.env
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config.js'
import { errorHandler } from './middleware/error.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { opportunityRouter } from './modules/opportunities/opportunities.routes.js'
import { channelRouter } from './modules/channels/channels.routes.js'
import { userRouter } from './modules/users/users.routes.js'
import { notificationRouter } from './modules/notifications/notifications.routes.js'
import { logRouter } from './modules/logs/logs.routes.js'
import { integrationRouter } from './modules/integrations/integrations.routes.js'
import { activateFeishuReceiver } from './modules/feishu/feishu.service.js'
import { agentRouter } from './modules/agent/agent.routes.js'
import { scheduleSignalProcessing } from './modules/agent/agent.service.js'
import { persistEnvironmentAgentConfig } from './modules/agent/agent.config.js'
import { scheduleAutoRelease } from './jobs/autoRelease.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: config.corsOrigins, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// 业务路由（统一 /api 前缀，与前端 VITE_API_BASE=/api 对应）
app.use('/api/auth', authRouter)
app.use('/api/opportunities', opportunityRouter)
app.use('/api/channels', channelRouter)
app.use('/api/users', userRouter)
app.use('/api/notifications', notificationRouter)
app.use('/api/logs', logRouter)
app.use('/api/integrations', integrationRouter)
app.use('/api/agent', agentRouter)

app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`✅ JoyMarketing CRM API 已启动: http://localhost:${config.port}/api`)
  // 保护期自动释放（开发用内置定时器；生产改用京东云定时任务调用 runAutoRelease）
  scheduleAutoRelease()
  void persistEnvironmentAgentConfig().catch(error => {
    console.error('[agent] model config bootstrap failed', error instanceof Error ? error.message : 'unknown error')
  })
  scheduleSignalProcessing()
  void activateFeishuReceiver().catch(error => {
    console.error('[feishu] receiver startup failed', error instanceof Error ? error.message : 'unknown error')
  })
})
