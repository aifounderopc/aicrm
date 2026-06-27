// 撞单检测（服务端权威实现，移植自前端算法）
// 归一化客户名（去城市前缀 + 公司后缀）→ 品牌核心；再做精确/相似/跨行业判断
const SUFFIXES = ['有限公司', '股份有限公司', '集团有限公司', '科技有限公司', '技术有限公司', '集团', '科技', '技术', '电子', '信息', '网络', '控股', '企业', '公司']
const CITIES = ['北京', '上海', '深圳', '广州', '杭州', '成都', '南京', '武汉', '西安', '重庆', '天津', '苏州', '宁波', '青岛', '厦门', '长沙', '郑州', '合肥', '济南', '福州']

function stripSuffix(s: string): string {
  for (const sfx of SUFFIXES) if (s.endsWith(sfx) && s.length > sfx.length) return s.slice(0, -sfx.length)
  return s
}

// 对外：生成入库的归一化名（落库到 customer_name_norm）
export function normalizeName(s: string): string {
  let r = s.trim()
  for (const city of CITIES) if (r.startsWith(city) && r.length > city.length) { r = r.slice(city.length); break }
  return stripSuffix(r).toLowerCase()
}

// 编辑距离（用于相似度）
function editDistance(a: string, b: string): number {
  if (!a || !b) return 99
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[a.length][b.length]
}

export interface CollisionCandidate {
  id: string
  customerNameNorm: string
  industry: string
  stage: string
}

// 在活跃商机（未释放）中判断撞单
export function detectCollision(
  inputName: string,
  inputIndustry: string,
  actives: CollisionCandidate[],
) {
  const norm = normalizeName(inputName)
  let collision: CollisionCandidate | undefined
  const similar: CollisionCandidate[] = []
  const crossIndustry: CollisionCandidate[] = []

  for (const o of actives) {
    const dist = editDistance(norm, o.customerNameNorm)
    const sameCore = norm === o.customerNameNorm
    if (sameCore && o.industry === inputIndustry) { collision = o; continue }      // 精确撞单
    if (sameCore && o.industry !== inputIndustry) { crossIndustry.push(o); continue } // 同名不同行业
    if (dist > 0 && dist <= 2) similar.push(o)                                       // 相似
  }
  return { collision, similar, crossIndustry }
}
