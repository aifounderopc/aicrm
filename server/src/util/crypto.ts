// 字段级加密（AES-256-GCM）+ 不可逆哈希
// 生产环境主密钥应由京东云 KMS 信封加密管理，这里用环境变量作开发实现
import crypto from 'node:crypto'
import { config } from '../config.js'

const KEY = Buffer.from(config.fieldEncKey, 'hex') // 32 字节

if (KEY.length !== 32) {
  // 启动即暴露配置错误，避免上线后才发现
  throw new Error('FIELD_ENC_KEY 必须为 32 字节（64 位 hex）')
}

// 加密 → base64(iv + authTag + ciphertext)
export function encryptField(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

// 解密 base64(iv + authTag + ciphertext) → 明文
export function decryptField(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

// 手机号等查重用：SHA-256（归一化后）
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value.replace(/\D/g, '')).digest('hex')
}
