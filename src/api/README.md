# 前端 API 数据层

把 `useStore` 从「数据源」改造为「视图缓存」，真正的数据读写走后端 API。

## 结构
- `client.ts` — 统一 fetch 客户端（httpOnly cookie 携带 JWT、统一错误 `ApiError`、401 全局处理）
- `auth.ts` — 认证模块（login/logout/me/impersonate/changePassword…）
- `opportunities.ts` — 商机模块（list/detail/checkCollision/create/updateStage…）
- 后续按同样方式补：`channels.ts` / `users.ts` / `notifications.ts` / `logs.ts`

## 配置
`.env` 注入后端地址（开发可用 Vite proxy 转发 `/api`）：
```
VITE_API_BASE=https://crm.example.com/api
```

## 接入步骤
1. 在 `App.tsx` 注册 401 处理（跳登录页）：
```ts
import { setUnauthorizedHandler } from './api'
setUnauthorizedHandler(() => { /* 清缓存，渲染 <Login /> */ })
```

2. 用 `/auth/me` 替代前端 `currentUser` / `authUserId`：
```ts
const { user, authUser, isProxying } = await authApi.me()
```

## 改造示范：store action → API 调用

**改造前（直接改本地状态）：**
```ts
login: (email, password) => {
  const user = get().users.find(u => u.email === email)
  if (!user || user.password !== password) return { success: false, error: '...' }
  set({ authUserId: user.id, currentUser: user })
  return { success: true }
}
```

**改造后（调后端，store 仅缓存结果）：**
```ts
login: async (email, password) => {
  try {
    const { user, authUser } = await authApi.login(email, password)
    set({ currentUser: user, authUser, authUserId: authUser.id })
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof ApiError ? e.message : '登录失败' }
  }
}
```

**商机报备（撞单交给后端，避免前端绕过）：**
```ts
addOpportunity: async (input) => {
  try {
    const { opportunity } = await opportunityApi.create(input)
    set(s => ({ opportunities: [opportunity, ...s.opportunities] }))
    return { success: true }
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      // 后端返回撞单
      return { success: false, collision: (e as any).collision }
    }
    return { success: false, error: e instanceof ApiError ? e.message : '报备失败' }
  }
}
```

## 要点
- action 全部变 `async`，调用方加 `await` 并处理 loading / 错误。
- 列表页改服务端分页：`opportunityApi.list({ stage, q, page })`。
- 密码、加密联系人**永不在前端持久化**；`User` 类型移除 `password`。
- 删除 `seed.ts` 注入，初始数据由后端种子脚本提供。
