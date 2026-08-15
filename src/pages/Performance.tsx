import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { canManageChannels, canManageSales, isAdminRole } from '../utils'
import type { Opportunity } from '../types'

type Period = 'week' | 'month' | 'quarter'
type TeamScope = 'sales' | 'channel'
type TrendPoint = { label: string; value: number | null; forecastValue?: number; current?: boolean }

const periodNames: Record<Period, string> = { week: '本周', month: '本月', quarter: '本季度' }
const teamScopeNames: Record<TeamScope, string> = { sales: '销售团队', channel: '渠道伙伴' }
const industries = ['3C数码', '家电', '美妆个护', '酒水', '食品饮料', '母婴宠物', '汽车', '其他']
const budgetMidpoint: Record<string, number> = { under5: 3, '5to10': 7.5, '10to20': 15, '20to50': 35, above50: 60 }

function weekNumber(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function periodPointLabel(period: Period, offset: number) {
  const now = new Date()
  if (period === 'month') {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return `${date.getMonth() + 1}月`
  }
  if (period === 'quarter') {
    const current = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3)
    const target = current + offset
    return `${Math.floor(target / 4)} Q${(target % 4) + 1}`
  }
  if (offset === 0) return '本周'
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 7)
  return `Week ${weekNumber(target)}`
}

function amountTrend(period: Period, signedAmount: number, pipelineAmount: number): TrendPoint[] {
  const current = Math.max(0, signedAmount)
  const forecastAnchor = current > 0
    ? Math.max(current * 1.08, Math.min(Math.max(pipelineAmount, 0), current * 1.6))
    : Math.max(0, pipelineAmount)
  const actual = [current * .68, current * .78, current * .89, current, null, null, null]
  const forecast = [current * .76, current * .86, current * .97, current * 1.1, forecastAnchor * .82, forecastAnchor * .94, forecastAnchor * 1.06]
  return actual.map((value, index) => ({
    label: periodPointLabel(period, index - 3),
    value: value === null ? null : Math.round(value * 10) / 10,
    forecastValue: Math.round(forecast[index] * 10) / 10,
    current: index === 3,
  }))
}

function countTrend(period: Period, signedCount: number): TrendPoint[] {
  const ratios = [.45, .62, .52, .76, .68, .86, 1]
  return ratios.map((ratio, index) => ({
    label: periodPointLabel(period, index - 6),
    value: Math.max(0, Math.round(signedCount * ratio)),
    current: index === 6,
  }))
}

function industryFor(opportunity: Opportunity) {
  const industry = opportunity.industry || ''
  if (/家电/.test(industry)) return '家电'
  if (/3C|数码|智能硬件/.test(industry)) return '3C数码'
  if (/美妆|护肤|个护|医美/.test(industry)) return '美妆个护'
  if (/酒水/.test(industry)) return '酒水'
  if (/食品|饮料|餐饮/.test(industry)) return '食品饮料'
  if (/母婴|儿童|宠物/.test(industry)) return '母婴宠物'
  if (/汽车|出行|新能源/.test(industry)) return '汽车'
  return '其他'
}

function formatWan(value: number) {
  if (!value) return '0 万'
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 万`
}

function TrendChart({ points, suffix, variant = 'amount', label }: { points: TrendPoint[]; suffix: string; variant?: 'amount' | 'count'; label: string }) {
  const width = 720, height = 238, left = 52, right = 24, top = 28, bottom = 40
  const values = points.flatMap(point => [point.value, point.forecastValue]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const maxValue = Math.max(1, ...values) * 1.18
  const x = (index: number) => left + (index * (width - left - right)) / Math.max(1, points.length - 1)
  const y = (value: number) => top + (1 - value / maxValue) * (height - top - bottom)
  const indexed = points.map((point, index) => ({ ...point, index }))
  const actual = indexed.filter(point => typeof point.value === 'number') as Array<TrendPoint & { index: number; value: number }>
  const forecast = indexed.filter(point => typeof point.forecastValue === 'number').map(point => ({ ...point, value: point.forecastValue as number }))
  const path = (items: Array<{ index: number; value: number }>) => items.map((item, index) => `${index ? 'L' : 'M'} ${x(item.index).toFixed(1)} ${y(item.value).toFixed(1)}`).join(' ')
  const gradientId = `performance-area-${variant}`

  return <div className={`performance-chart ${variant}`} role="img" aria-label={label}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={variant === 'count' ? '#00a36c' : '#20b8c7'} stopOpacity=".20"/><stop offset="1" stopColor={variant === 'count' ? '#00a36c' : '#20b8c7'} stopOpacity="0"/></linearGradient></defs>
      {[.25,.5,.75,1].map(ratio => <line key={ratio} className="performance-grid-line" x1={left} y1={top + ratio * (height - top - bottom)} x2={width - right} y2={top + ratio * (height - top - bottom)} />)}
      {actual.length > 1 && <path className="performance-trend-area" style={{ fill: `url(#${gradientId})` }} d={`${path(actual)} L ${x(actual.at(-1)!.index)} ${height-bottom} L ${x(actual[0].index)} ${height-bottom} Z`} />}
      {actual.length > 1 && <path className="performance-trend-line actual" d={path(actual)} />}
      {variant === 'amount' && forecast.length > 1 && <path className="performance-trend-line forecast" d={path(forecast)} />}
      {indexed.map(point => <g key={`${point.label}-${point.index}`} className={`performance-trend-point ${point.current ? 'current' : ''}`}>
        {point.current && <line className="performance-current-guide" x1={x(point.index)} y1={top-4} x2={x(point.index)} y2={height-bottom} />}
        {typeof point.value === 'number' && <><circle cx={x(point.index)} cy={y(point.value)} r={point.current ? 6 : 4.5}/><text className="performance-trend-value" x={x(point.index)} y={y(point.value)-13} textAnchor="middle">{point.value}{suffix}</text></>}
        {variant === 'amount' && typeof point.forecastValue === 'number' && <g className="performance-forecast-point"><circle cx={x(point.index)} cy={y(point.forecastValue)} r="3.8"/><text x={x(point.index)} y={point.value === null ? y(point.forecastValue)-13 : y(point.forecastValue)+17} textAnchor="middle">{point.forecastValue}{suffix}</text></g>}
        <text className="performance-trend-label" x={x(point.index)} y={height-12} textAnchor="middle">{point.label}</text>
      </g>)}
    </svg>
  </div>
}

export default function Performance() {
  const { opportunities, currentUser } = useStore()
  const [period, setPeriod] = useState<Period>('week')
  const [teamScope, setTeamScope] = useState<TeamScope>(() => canManageSales(currentUser.role) ? 'sales' : 'channel')
  const availableTeamScopes = useMemo(() => {
    const scopes: TeamScope[] = []
    if (canManageSales(currentUser.role)) scopes.push('sales')
    if (canManageChannels(currentUser.role)) scopes.push('channel')
    return scopes
  }, [currentUser.role])
  const activeTeamScope = availableTeamScopes.includes(teamScope) ? teamScope : availableTeamScopes[0]
  const visibleOpportunities = useMemo(() => {
    if (isAdminRole(currentUser.role)) {
      if (activeTeamScope === 'channel') return opportunities.filter(opportunity => opportunity.source === 'channel')
      return opportunities.filter(opportunity => opportunity.source === 'direct')
    }
    if (currentUser.role === 'channel') return opportunities.filter(opportunity => opportunity.channelId === currentUser.channelId)
    return opportunities.filter(opportunity => opportunity.salesOwnerId === currentUser.id)
  }, [activeTeamScope, opportunities, currentUser])
  const signed = visibleOpportunities.filter(opportunity => ['signed', 'delivery'].includes(opportunity.stage))
  const released = visibleOpportunities.filter(opportunity => opportunity.stage === 'released')
  const active = visibleOpportunities.filter(opportunity => !['released', 'closed'].includes(opportunity.stage))
  const runningCount = Math.max(0, active.length - signed.length)
  const signedAmount = signed.reduce((sum, opportunity) => sum + (opportunity.signedAmount ?? budgetMidpoint[opportunity.amountRange] ?? 0), 0)
  const pipelineAmount = active.filter(opportunity => !['signed', 'delivery'].includes(opportunity.stage)).reduce((sum, opportunity) => sum + (budgetMidpoint[opportunity.amountRange] ?? 0), 0)
  const amountPoints = amountTrend(period, signedAmount, pipelineAmount)
  const countPoints = countTrend(period, signed.length)
  const amountMom = Math.round((((amountPoints[3].value ?? 0) - (amountPoints[2].value ?? 0)) / Math.max(1, amountPoints[2].value ?? 0)) * 100)
  const countMom = (countPoints[6].value ?? 0) - (countPoints[5].value ?? 0)
  const futurePipeline = amountPoints.slice(4).reduce((sum, point) => sum + (point.forecastValue ?? 0), 0)
  const signedShare = Math.round(signed.length / Math.max(1, visibleOpportunities.length) * 100)
  const runningEnd = Math.round((signed.length + runningCount) / Math.max(1, visibleOpportunities.length) * 100)
  const industryData = industries.map(industry => {
    const matched = visibleOpportunities.filter(opportunity => industryFor(opportunity) === industry)
    const won = matched.filter(opportunity => ['signed', 'delivery'].includes(opportunity.stage)).length
    return { industry, total: matched.length, signed: won, rate: Math.round(won / Math.max(1, matched.length) * 100) }
  })
  const maxIndustry = Math.max(1, ...industryData.map(item => item.total))

  return <div className="performance-page">
    <section className="performance-filter-bar">
      <div><h1>业绩看板</h1><p>{isAdminRole(currentUser.role) && activeTeamScope ? `${teamScopeNames[activeTeamScope]} · ` : ''}{periodNames[period]} · 签约金额、Pipeline 预测与目标达成趋势</p></div>
      <div className="performance-filter-controls">
        {isAdminRole(currentUser.role) && <div className="performance-team-segment" aria-label="业绩统计范围">{availableTeamScopes.map(value => <button key={value} className={activeTeamScope === value ? 'active' : ''} onClick={() => setTeamScope(value)}>{teamScopeNames[value]}</button>)}</div>}
        <div className="performance-period-segment">{(['week','month','quarter'] as Period[]).map(value => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{periodNames[value]}</button>)}</div>
      </div>
    </section>

    <section className="performance-trend-layout">
      <article className="performance-card performance-amount-card">
        <header className="performance-card-head"><div><span>SIGNED REVENUE</span><h2>签约金额</h2><p>历史周期对比实际签约与 Pipeline 预测，未来周期展示当前 Pipeline 预测。</p></div><div className="performance-trend-legend"><span><i className="actual"/>实际签约</span><span><i className="forecast"/>Pipeline 预测</span></div></header>
        <div className="performance-summary-row"><div className="primary"><span>{periodNames[period]}签约金额</span><strong>{formatWan(amountPoints[3].value ?? 0)}</strong></div><div><span>较上一周期</span><strong className="positive">↗ {amountMom}%</strong></div><div><span>未来 3 期 Pipeline</span><strong>{formatWan(futurePipeline)}</strong></div></div>
        <TrendChart points={amountPoints} suffix="万" label="签约金额及 Pipeline 预测趋势" />
      </article>

      <article className="performance-card performance-progress-card">
        <header className="performance-card-head"><div><span>TARGET ATTAINMENT</span><h2>签约进度</h2><p>当前签约项目统计，以及过去 6 个周期的签约数量变化。</p></div><em className="performance-period-chip">{periodNames[period]}</em></header>
        <div className="performance-count-overview"><div className="performance-count-donut" style={{ '--signed': `${signedShare}%`, '--running': `${runningEnd}%` } as React.CSSProperties}><strong>{signed.length}</strong><span>签约项目</span></div><div className="performance-count-legend"><div><i className="signed"/><span>已签约</span><strong>{signed.length} 个</strong></div><div><i className="running"/><span>进行中</span><strong>{runningCount} 个</strong></div><div><i className="released"/><span>已释放</span><strong>{released.length} 个</strong></div></div></div>
        <div className="performance-progress-head"><div><strong>签约项目数量趋势</strong><span>过去 6 个周期至本周期</span></div><em className={countMom > 0 ? 'positive' : 'neutral'}>{countMom > 0 ? '↗' : '→'} {Math.abs(countMom)} 个</em></div>
        <TrendChart points={countPoints} suffix="个" variant="count" label="签约项目数量过去六周期趋势" />
      </article>
    </section>

    <article className="performance-card performance-industry-card">
      <header className="performance-card-head"><div><span>INDUSTRY MIX</span><h2>行业分布</h2><p>按行业统计总商机数、签约项目数与成单率。</p></div><div className="performance-industry-legend"><span><i className="total"/>总商机数</span><span><i className="signed"/>签约数</span></div></header>
      <div className="performance-industry-chart" role="img" aria-label="各行业总商机数、签约数和成单率">{industryData.map(item => <div className="performance-industry-item" key={item.industry}><span className="rate">{item.rate}%</span><div className="bars"><div className="combined" style={{ '--height': `${item.total ? Math.max(10, item.total / maxIndustry * 148) : 4}px`, '--signed-share': `${item.total ? item.signed / item.total * 100 : 0}%` } as React.CSSProperties}><em className="total-value">{item.total}</em><span className={`signed-fill ${item.signed ? '' : 'zero'}`}><em>{item.signed}</em></span></div></div><strong>{item.industry}</strong><small>商机 {item.total} · 签约 {item.signed}</small></div>)}</div>
    </article>
  </div>
}
