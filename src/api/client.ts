// 统一 API 请求客户端
// - JWT 走 httpOnly cookie（credentials: 'include'），前端不持有令牌
// - 统一错误处理：非 2xx 抛 ApiError；401 触发登出回调
// - baseURL 由 Vite 环境变量注入：VITE_API_BASE（如 https://crm.example.com/api）

const BASE_URL = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// 401 未授权时的全局处理（由 App 注册：跳登录页）
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn }

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(BASE_URL.replace(/\/$/, '') + path, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = opts
  let res: Response
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include', // 携带 httpOnly cookie
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch {
    throw new ApiError('网络连接失败，请检查网络后重试', 0)
  }

  if (res.status === 401) {
    onUnauthorized?.()
    throw new ApiError('登录已过期，请重新登录', 401)
  }

  // 204 / 空响应
  if (res.status === 204) return undefined as T

  let data: unknown = null
  const text = await res.text()
  if (text) { try { data = JSON.parse(text) } catch { data = text } }

  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'message' in data)
      ? String((data as { message: unknown }).message)
      : `请求失败（${res.status}）`
    const code = (data && typeof data === 'object' && 'code' in data)
      ? String((data as { code: unknown }).code) : undefined
    throw new ApiError(msg, res.status, code)
  }

  return data as T
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
}
