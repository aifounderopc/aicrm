// 统一错误类型与错误处理中间件
import type { Request, Response, NextFunction } from 'express'

export class ApiError extends Error {
  status: number
  code?: string
  extra?: Record<string, unknown>
  constructor(status: number, message: string, code?: string, extra?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message, code: err.code, ...err.extra })
  }
  console.error('[unhandled]', err)
  return res.status(500).json({ message: '服务器内部错误' })
}

// 包装 async 路由，自动转发异常到 errorHandler
export function ah<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next)
}
