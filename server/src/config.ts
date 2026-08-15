// 环境配置集中读取
import 'dotenv/config' // 加载 .env 到 process.env

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined) throw new Error(`缺少环境变量 ${name}`)
  return v
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  fieldEncKey: required('FIELD_ENC_KEY', '0'.repeat(64)), // 32 字节 hex
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  isProd: process.env.NODE_ENV === 'production',
  feishuAppId: process.env.FEISHU_APP_ID,
  feishuAppSecret: process.env.FEISHU_APP_SECRET,
  agentHarnessUrl: process.env.AGENT_HARNESS_URL ?? 'http://agent-harness:8090',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
  deepseekModel: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
}
