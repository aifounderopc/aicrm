export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// 密码强度规则：8-32 位，至少包含大写字母、小写字母、数字、特殊符号中的 3 类，且不含空格
export const PASSWORD_RULE_HINT = '8–32 位，需含大写字母、小写字母、数字、特殊符号中至少 3 类'

export function validatePassword(pwd: string): { valid: boolean; error?: string } {
  if (!pwd) return { valid: false, error: '请输入密码' }
  if (pwd.length < 8) return { valid: false, error: '密码至少 8 位' }
  if (pwd.length > 32) return { valid: false, error: '密码不能超过 32 位' }
  if (/\s/.test(pwd)) return { valid: false, error: '密码不能包含空格' }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(re => re.test(pwd)).length
  if (classes < 3) return { valid: false, error: '需含大写、小写、数字、特殊符号中至少 3 类' }
  // 常见弱密码黑名单
  const weak = ['password', '12345678', 'qwertyui', 'joy123456', 'admin123', '11111111', 'abcd1234']
  if (weak.includes(pwd.toLowerCase())) return { valid: false, error: '密码过于常见，请更换' }
  return { valid: true }
}

// 密码强度评分 0-4，用于可视化强度条
export function passwordStrength(pwd: string): { score: number; label: string } {
  if (!pwd) return { score: 0, label: '' }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(re => re.test(pwd)).length
  if (classes >= 3) score++
  if (classes === 4) score++
  score = Math.min(4, score)
  const labels = ['很弱', '弱', '一般', '较强', '强']
  return { score, label: labels[score] }
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function daysUntil(iso: string): number {
  const now = new Date()
  const target = new Date(iso)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function editDistance(a: string, b: string): number {
  // strip common suffixes for better matching
  const clean = (s: string) => s.replace(/有限公司|股份有限公司|集团|科技|网络|信息|技术/g, '').trim()
  a = clean(a); b = clean(b)
  if (!a || !b) return 99
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[a.length][b.length]
}

export function stageName(stage: string): string {
  const map: Record<string, string> = {
    reporting: '初接触',
    signing: '签约中',
    delivery: '项目交付',
    signed: '已签约',
    released: '已释放',
  }
  return map[stage] ?? stage
}

export function stageColor(stage: string): string {
  const map: Record<string, string> = {
    reporting: 'bg-blue-100 text-blue-700',
    signing: 'bg-yellow-100 text-yellow-700',
    delivery: 'bg-purple-100 text-purple-700',
    signed: 'bg-green-100 text-green-700',
    released: 'bg-gray-100 text-gray-500',
  }
  return map[stage] ?? 'bg-gray-100 text-gray-500'
}

export function amountLabel(r: string): string {
  const map: Record<string, string> = {
    under5:  '5万元以下',
    '5to10': '5～10万元',
    '10to20':'10～20万元',
    '20to50':'20～50万元',
    above50: '50万元以上',
  }
  return map[r] ?? r
}

export function formatSignedAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}

export function signedAmountLabel(amount: number): string {
  return `${formatSignedAmount(amount)}万元`
}

export function roleName(role: string): string {
  const map: Record<string, string> = {
    admin: '超级管理员',
    channel_admin: '渠道管理员',
    sales_admin: '直客销售管理员',
    sales: '直客销售',
    channel: '渠道伙伴',
  }
  return map[role] ?? role
}

// ── 角色权限能力 ──
// 是否为任意管理类角色（可进入管理后台）
export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'channel_admin' || role === 'sales_admin'
}
// 可管理/创建/代理 渠道账号
export function canManageChannels(role: string): boolean {
  return role === 'admin' || role === 'channel_admin'
}
// 可管理/创建/代理 直客销售账号
export function canManageSales(role: string): boolean {
  return role === 'admin' || role === 'sales_admin'
}
// 可管理管理员账号（仅超级管理员）
export function canManageAdmins(role: string): boolean {
  return role === 'admin'
}
