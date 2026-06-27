// 操作日志模块 API —— 只读，仅管理类角色可访问
// 日志由后端写入（真实 IP/UA/时间），前端无写权限；支持分页与筛选
import { api } from './client'
import type { OperationLog } from '../types'
import type { PageResult } from './opportunities'

export interface LogQuery {
  actorId?: string
  action?: string
  from?: string   // ISO 日期
  to?: string
  page?: number
  pageSize?: number
}

export const logApi = {
  // GET /logs?actor=&action=&from=&to=&page=
  list: (query: LogQuery = {}) =>
    api.get<PageResult<OperationLog>>('/logs', query as Record<string, string | number>),
}
