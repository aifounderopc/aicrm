import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 后端地址：开发时默认转发到本地后端 http://localhost:3000
  // 可用 .env.development 覆盖：DEV_API_TARGET=http://内网后端:端口
  const apiTarget = env.DEV_API_TARGET || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // 前端用相对路径 '/api' 调接口（见 src/api/client.ts 默认 VITE_API_BASE=/api）
        // 开发时由 Vite 转发到后端，规避跨域 + 让 httpOnly cookie 同源生效
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false, // 后端为自签名 https 时允许
          // 如后端路由不带 /api 前缀，可去掉前缀：
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // 文件直传/下载等其他后端路由按需添加，例如：
        // '/oss': { target: apiTarget, changeOrigin: true },
      },
    },
  }
})
