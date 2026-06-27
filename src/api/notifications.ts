// 通知模块 API —— 对应 store 的 markNotificationRead
// 列表仅返回当前用户的通知；登录时高优事项由后端产出（结合保护期到期/撞单/举证审核等）
import { api } from './client'
import type { Notification } from '../types'

export const notificationApi = {
  // GET /notifications?unreadOnly= —— 仅本人通知
  list: (unreadOnly = false) =>
    api.get<Notification[]>('/notifications', { unreadOnly }),

  // GET /notifications/high-priority —— 登录时弹卡片的高优事项（error/warning）
  highPriority: () => api.get<Notification[]>('/notifications/high-priority'),

  // PATCH /notifications/:id/read
  markRead: (id: string) => api.patch<void>(`/notifications/${id}/read`),

  // POST /notifications/read-all
  markAllRead: () => api.post<void>('/notifications/read-all'),
}
