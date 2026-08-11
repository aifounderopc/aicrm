import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, ChevronLeft, ChevronRight, Clock3, LayoutGrid, List, Search, Sparkles, TrendingUp } from 'lucide-react'
import { useStore } from '../store'
import { daysUntil, formatDate, formatSignedAmount, isAdminRole, stageName } from '../utils'
import type { Opportunity } from '../types'

type PoolFilter = 'all' | 'high' | 'conflict' | 'incomplete' | 'expiring'
type PoolView = 'card' | 'list'

const PAGE_SIZE = 20
const stageOrder = ['reporting', 'contacting', 'proposal', 'negotiation', 'signed', 'delivery'] as const
const stageColors: Record<string, string> = {
  reporting: '#5b8def', contacting: '#30a9c2', proposal: '#7869d8', negotiation: '#ef9f38', signed: '#22a875', delivery: '#0d8fa6',
}
const budgetMidpoint: Record<string, number> = { under5: 3, '5to10': 7.5, '10to20': 15, '20to50': 35, above50: 60 }

function normalized(value?: string) {
  return (value || '').replace(/有限公司|股份有限公司|集团|科技|网络|信息|技术|\s/g, '').toLowerCase()
}

function completeness(opportunity: Opportunity) {
  const values = [
    opportunity.customerName,
    opportunity.companyName,
    opportunity.industry,
    opportunity.requirementDescription,
    opportunity.amountRange,
    opportunity.contact?.department,
    opportunity.contact?.level,
    opportunity.contact?.encryptedName,
  ]
  return Math.round(values.filter(Boolean).length / values.length * 100)
}

function healthScore(opportunity: Opportunity) {
  const stageBase: Record<string, number> = { reporting: 58, contacting: 65, proposal: 72, negotiation: 79, signing: 82, signed: 94, delivery: 96, closed: 35, released: 28 }
  const freshDays = Math.max(0, Math.floor((Date.now() - new Date(opportunity.updatedAt).getTime()) / 86400000))
  return Math.max(28, Math.min(98, (stageBase[opportunity.stage] || 55) + Math.round(completeness(opportunity) / 10) - Math.min(18, freshDays)))
}

function protectionText(opportunity: Opportunity) {
  if (opportunity.stage === 'released') return '已释放'
  if (opportunity.lockedPermanently) return '持续保护中'
  const days = daysUntil(opportunity.releaseAt)
  return days > 0 ? `保护中 · 剩余 ${days} 天` : '保护已到期'
}

function nextAction(opportunity: Opportunity) {
  const latest = [...opportunity.progressReports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (latest?.description) return latest.description
  const actions: Record<string, string> = {
    reporting: '补齐联系人与需求信息，完成商机报备确认', contacting: '确认需求范围与关键决策人，约定下一次沟通', proposal: '推进方案评审，确认产品组合与交付范围', negotiation: '跟进报价反馈，锁定合同条款与签约时间', signing: '完成合同审批并推进签署', signed: '同步项目启动计划与交付负责人', delivery: '跟踪交付里程碑与客户验收', released: '商机已释放，可重新认领跟进', closed: '商机已关闭',
  }
  return actions[opportunity.stage] || '持续跟进商机最新进展'
}

export default function OpportunityPool() {
  const { opportunities, currentUser } = useStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<PoolFilter>('all')
  const [view, setView] = useState<PoolView>('card')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const visible = useMemo(() => {
    if (isAdminRole(currentUser.role)) return opportunities
    if (currentUser.role === 'channel') return opportunities.filter(item => item.channelId === currentUser.channelId)
    return opportunities.filter(item => item.salesOwnerId === currentUser.id)
  }, [opportunities, currentUser])

  const duplicateIds = useMemo(() => {
    const buckets = new Map<string, string[]>()
    visible.forEach(item => {
      const keys = [normalized(item.customerName), normalized(item.companyName), item.contact?.phoneHash || ''].filter(key => key.length > 2)
      keys.forEach(key => buckets.set(key, [...(buckets.get(key) || []), item.id]))
    })
    return new Set([...buckets.values()].filter(ids => ids.length > 1).flat())
  }, [visible])

  const isHigh = (item: Opportunity) => ['20to50', 'above50'].includes(item.amountRange) && !['released', 'closed'].includes(item.stage)
  const isIncomplete = (item: Opportunity) => completeness(item) < 88 && !['released', 'closed'].includes(item.stage)
  const isExpiring = (item: Opportunity) => !item.lockedPermanently && !['released', 'closed'].includes(item.stage) && daysUntil(item.releaseAt) <= 7
  const addedThisMonth = visible.filter(item => {
    const date = new Date(item.reportedAt), now = new Date()
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).length
  const pendingCount = visible.filter(item => item.stage === 'reporting' || isIncomplete(item)).length
  const metrics = [
    { label: '新增商机', value: addedThisMonth, note: '本月新进入商机池', icon: Sparkles, tone: 'blue' },
    { label: '高意向', value: visible.filter(isHigh).length, note: '预算 20 万以上', icon: TrendingUp, tone: 'green', target: 'high' as PoolFilter },
    { label: '疑似撞单', value: duplicateIds.size, note: '客户主体或联系人重复', icon: AlertTriangle, tone: 'red', target: 'conflict' as PoolFilter },
    { label: '待确认线索', value: pendingCount, note: '待确认或补充关键信息', icon: CheckCircle2, tone: 'violet', target: 'incomplete' as PoolFilter },
    { label: '即将到期释放', value: visible.filter(isExpiring).length, note: '保护期剩余 7 天内', icon: Clock3, tone: 'orange', target: 'expiring' as PoolFilter },
  ]

  const stageData = stageOrder.map(stage => ({ stage, label: stageName(stage), count: visible.filter(item => item.stage === stage || (stage === 'negotiation' && item.stage === 'signing')).length }))
  const maxStage = Math.max(1, ...stageData.map(item => item.count))
  const signed = visible.filter(item => ['signed', 'delivery'].includes(item.stage))
  const released = visible.filter(item => item.stage === 'released')
  const running = visible.filter(item => !['signed', 'delivery', 'released', 'closed'].includes(item.stage))
  const signedAmount = signed.reduce((sum, item) => sum + (item.signedAmount ?? budgetMidpoint[item.amountRange] ?? 0), 0)
  const signedEnd = Math.round(signed.length / Math.max(1, visible.length) * 100)
  const runningEnd = Math.round((signed.length + running.length) / Math.max(1, visible.length) * 100)

  const filtered = visible.filter(item => {
    const keyword = query.trim().toLowerCase()
    if (keyword && ![item.customerName, item.companyName, item.industry, item.salesOwnerName].some(value => value?.toLowerCase().includes(keyword))) return false
    if (filter === 'high') return isHigh(item)
    if (filter === 'conflict') return duplicateIds.has(item.id)
    if (filter === 'incomplete') return item.stage === 'reporting' || isIncomplete(item)
    if (filter === 'expiring') return isExpiring(item)
    return true
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const changeFilter = (value: PoolFilter) => { setFilter(value); setPage(1) }

  return <main className="opportunity-pool-page">
    <header className="pool-page-head">
      <div><span className="pool-eyebrow">OPPORTUNITY PIPELINE</span><h1>商机池</h1><p>集中查看全量商机状态，识别高意向、撞单风险与即将释放的机会。</p></div>
      <button className="pool-ai-report" onClick={() => navigate('/report')}><Bot size={17}/><span>AI 报备</span><ArrowRight size={15}/></button>
    </header>

    <section className="pool-metrics" aria-label="商机概览">
      {metrics.map(({ label, value, note, icon: Icon, tone, target }) => <button key={label} className={`pool-metric ${tone} ${target && filter === target ? 'selected' : ''}`} onClick={() => target && changeFilter(target)} disabled={!target}>
        <span className="pool-metric-icon"><Icon size={18}/></span><span className="pool-metric-copy"><small>{label}</small><strong>{value}</strong><em>{note}</em></span>
      </button>)}
    </section>

    <section className="pool-insights">
      <article className="pool-insight-card stage-card">
        <header><div><span>PIPELINE STAGES</span><h2>阶段分布</h2></div><strong>{visible.length}<small>全部商机</small></strong></header>
        <div className="pool-stage-chart">{stageData.map(item => <div className="pool-stage-column" key={item.stage}><div className="pool-stage-track"><span style={{ height: `${Math.max(item.count ? 16 : 3, item.count / maxStage * 100)}%`, background: stageColors[item.stage] }}><b>{item.count}</b></span></div><strong>{item.label}</strong></div>)}</div>
      </article>
      <article className="pool-insight-card signing-card">
        <header><div><span>SIGNING PROGRESS</span><h2>签约进度</h2></div><em>累计签约</em></header>
        <div className="pool-signing-content">
          <div className="pool-donut" style={{ '--signed': `${signedEnd}%`, '--running': `${runningEnd}%` } as React.CSSProperties}><div><strong>{signedEnd}%</strong><span>签约率</span></div></div>
          <div className="pool-signing-summary"><small>累计签约金额</small><strong>{formatSignedAmount(signedAmount)}<em> 万元</em></strong><div><span><i className="signed"/>已签约 <b>{signed.length}</b></span><span><i className="running"/>推进中 <b>{running.length}</b></span><span><i className="released"/>已释放 <b>{released.length}</b></span></div></div>
        </div>
      </article>
    </section>

    <section className="pool-board">
      <div className="pool-toolbar">
        <div className="pool-filters">{([
          ['all','全部'], ['high','高意向'], ['conflict','疑似撞单'], ['incomplete','待补全'], ['expiring','即将释放'],
        ] as [PoolFilter,string][]).map(([value,label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => changeFilter(value)}>{label}</button>)}</div>
        <div className="pool-tools"><label><Search size={15}/><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="搜索客户、公司或负责人"/><span>{filtered.length} 条</span></label><div className="pool-view-switch"><button aria-label="卡片视图" className={view === 'card' ? 'active' : ''} onClick={() => setView('card')}><LayoutGrid size={16}/></button><button aria-label="列表视图" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={17}/></button></div></div>
      </div>

      {paged.length === 0 ? <div className="pool-empty"><Search size={28}/><strong>没有符合条件的商机</strong><span>调整筛选条件或搜索关键词后再试</span></div> : view === 'card' ? <div className="pool-card-grid">
        {paged.map(item => {
          const health = healthScore(item), stageIndex = Math.max(0, stageOrder.findIndex(stage => stage === item.stage || (stage === 'negotiation' && item.stage === 'signing')))
          const conflict = duplicateIds.has(item.id)
          const cardStage = item.stage === 'released' ? '初接触' : stageName(item.stage)
          return <article className={`pool-opportunity-card pool-reference-card stage-${item.stage} ${conflict ? 'possible-conflict' : ''}`} key={item.id} onClick={() => navigate(`/opportunity/${item.id}`)}>
            <header className="pool-reference-top"><span className="pool-reference-tag stage">{cardStage}</span></header>
            <h3>{item.customerName}</h3>
            <p className="pool-reference-meta">{item.industry} · JM 声访</p>
            <div className="pool-reference-timeline">{stageOrder.map((stage, index) => <span key={stage} className={index <= stageIndex ? 'on' : ''}/>)}</div>
            <p className="pool-reference-action">{nextAction(item)}</p>
            <footer className="pool-reference-foot"><span className={`pool-reference-tag health ${health >= 80 ? 'healthy' : health >= 60 ? 'watch' : 'risk'}`}>健康度 · {health}分</span><span className="pool-reference-tag owner">{item.salesOwnerName}</span></footer>
          </article>
        })}
      </div> : <div className="pool-list-wrap"><div className="pool-list-head"><span>客户 / 产品</span><span>阶段</span><span>保护状态</span><span>健康度</span><span>负责人</span><span>最新进展</span><span>下一步推进建议</span></div>{paged.map(item => {
        const latest = [...item.progressReports].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        const health = healthScore(item)
        return <button className="pool-list-row" key={item.id} onClick={() => navigate(`/opportunity/${item.id}`)}><span className="account"><strong>{item.customerName}</strong><small>JM 声访 · {item.industry}</small></span><span><em className={`pool-stage-pill ${item.stage}`}>{stageName(item.stage)}</em></span><span className={isExpiring(item) ? 'expire' : ''}>{protectionText(item)}</span><span><b className={`pool-health ${health >= 80 ? 'healthy' : health >= 65 ? 'normal' : 'risk'}`}>{health}</b></span><span>{item.salesOwnerName}</span><span className="progress"><strong>{latest?.description || `更新至${stageName(item.stage)}阶段`}</strong><small>{formatDate(item.updatedAt)}</small></span><span className="advice">{nextAction(item)}<ArrowRight size={14}/></span></button>
      })}</div>}

      <div className="pool-pagination"><span>共 {filtered.length} 条 · 每页 {PAGE_SIZE} 条</span><div><button disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={16}/></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map(value => <button key={value} className={value === currentPage ? 'active' : ''} onClick={() => setPage(value)}>{value}</button>)}<button disabled={currentPage === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}><ChevronRight size={16}/></button></div></div>
    </section>
  </main>
}
