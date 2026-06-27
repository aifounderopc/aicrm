// 密码哈希（bcrypt）+ 强度校验（与前端 utils/validatePassword 规则保持一致）
import bcrypt from 'bcryptjs'

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// 8–32 位，含大写/小写/数字/特殊符号中至少 3 类，禁空格，黑名单
export function validatePasswordStrength(pwd: string): { valid: boolean; error?: string } {
  if (!pwd) return { valid: false, error: '请输入密码' }
  if (pwd.length < 8) return { valid: false, error: '密码至少 8 位' }
  if (pwd.length > 32) return { valid: false, error: '密码不能超过 32 位' }
  if (/\s/.test(pwd)) return { valid: false, error: '密码不能包含空格' }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(re => re.test(pwd)).length
  if (classes < 3) return { valid: false, error: '需含大写、小写、数字、特殊符号中至少 3 类' }
  const weak = ['password', '12345678', 'qwertyui', 'joy123456', 'admin123', '11111111', 'abcd1234']
  if (weak.includes(pwd.toLowerCase())) return { valid: false, error: '密码过于常见，请更换' }
  return { valid: true }
}
