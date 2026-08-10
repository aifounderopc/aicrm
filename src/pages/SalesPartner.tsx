import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Bot, CalendarDays, Check, ChevronRight, Clock3, MessageCircle, PanelRight, Send, Sparkles, TriangleAlert, Users, X } from 'lucide-react'
import { useStore } from '../store'
import { amountLabel, daysUntil } from '../utils'
import type { Opportunity } from '../types'

type ChatMessage = { role: 'assistant' | 'user'; text: string }
type SignalChannel = 'all' | 'feishu' | 'email' | 'meeting' | 'jingme'
type SideTab = 'processing' | 'stable' | 'suggestions'

const channelMeta: Record<Exclude<SignalChannel, 'all'>, { label: string; color: string; bg: string }> = {
  feishu: { label: '飞书', color: '#2563eb', bg: '#eff6ff' },
  email: { label: '邮件', color: '#059669', bg: '#ecfdf5' },
  meeting: { label: '会议', color: '#7c3aed', bg: '#f5f3ff' },
  jingme: { label: '京 Me', color: '#0891b2', bg: '#ecfeff' },
}

function scoreFor(opp: Opportunity) {
  let score = 48
  if (opp.stage === 'signing') score += 30
  if (opp.stage === 'signed' || opp.stage === 'delivery') score += 38
  if (opp.contact?.encryptedName) score += 8
  if (opp.requirementDescription.length > 25) score += 6
  if (opp.evidenceFiles.length) score += 5
  if (!opp.lockedPermanently && daysUntil(opp.releaseAt) <= 7) score -= 18
  return Math.max(20, Math.min(96, score))
}

function stageText(stage: Opportunity['stage']) {
  return ({ reporting: '初接触', signing: '签约中', signed: '已签约', delivery: '交付中', released: '已释放' } as const)[stage]
}

function greetingText(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 11) return '上午好'
  if (hour >= 11 && hour < 14) return '中午好'
  if (hour >= 14 && hour < 18) return '下午好'
  return '晚上好'
}

export default function SalesPartner() {
  const { currentUser, opportunities } = useStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<SignalChannel>('all')
  const [input, setInput] = useState('')
  const [done, setDone] = useState<string[]>([])
  const [dailyOpen, setDailyOpen] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const [sideTab, setSideTab] = useState<SideTab>('processing')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: '我会结合 CRM 商机、连接器上下文、保护状态和跟进记录，帮你判断今天该推进谁、怎么推进。' },
  ])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.body.classList.add('ai-partner-open')
    return () => document.body.classList.remove('ai-partner-open')
  }, [])

  const visibleOpps = useMemo(() => {
    if (['admin', 'sales_admin'].includes(currentUser.role)) return opportunities
    return opportunities.filter(o => o.salesOwnerId === currentUser.id || o.saOwnerId === currentUser.id)
  }, [currentUser, opportunities])

  const active = visibleOpps.filter(o => o.stage !== 'released')
  const ranked = [...active].sort((a, b) => scoreFor(b) - scoreFor(a))
  const urgent = [...active].sort((a, b) => daysUntil(a.releaseAt) - daysUntil(b.releaseAt))
  const channels: Exclude<SignalChannel, 'all'>[] = ['jingme', 'feishu', 'email', 'meeting']
  const signals = active.slice(0, 10).map((opp, index) => {
    const channel = channels[index % channels.length]
    const expiring = !opp.lockedPermanently && daysUntil(opp.releaseAt) <= 7
    return {
      id: `${opp.id}-${channel}`,
      opportunityId: opp.id,
      channel,
      time: index < 3 ? `今天 ${String(10 + index).padStart(2, '0')}:${index ? '20' : '05'}` : `${index - 2} 天前`,
      title: opp.customerName,
      tag: expiring ? '保护到期' : opp.stage === 'signing' ? '签约推进' : '需求更新',
      summary: expiring
        ? `商机保护期仅剩 ${Math.max(daysUntil(opp.releaseAt), 0)} 天，建议尽快补充进展或申请续期。`
        : `${stageText(opp.stage)} 阶段出现新进展：${opp.requirementDescription.slice(0, 54)}${opp.requirementDescription.length > 54 ? '…' : ''}`,
    }
  })
  const visibleSignals = signals.filter(s => filter === 'all' || s.channel === filter)

  const suggestions = [
    ranked[0] && { id: 'priority', dimension: '优先推进', title: '先约关键沟通', opp: ranked[0], reason: `健康度 ${scoreFor(ranked[0])} 分，需求与金额区间已明确。`, action: '生成邀约话术' },
    urgent[0] && { id: 'risk', dimension: '风险处理', title: '检查保护期', opp: urgent[0], reason: urgent[0].lockedPermanently ? '商机已持续锁定，建议同步最新交付进展。' : `距保护期结束还有 ${Math.max(daysUntil(urgent[0].releaseAt), 0)} 天。`, action: '查看商机详情' },
    active.find(o => !o.contact.encryptedName) && (() => { const opp = active.find(o => !o.contact.encryptedName)!; return { id: 'fields', dimension: '资料补齐', title: '补齐关键联系人', opp, reason: '联系人信息不完整，会影响跟进和归属判断。', action: '打开资料页' } })(),
  ].filter(Boolean) as { id: string; dimension: string; title: string; opp: Opportunity; reason: string; action: string }[]
  const processing = active.filter(o => (!o.lockedPermanently && daysUntil(o.releaseAt) <= 7) || scoreFor(o) < 60).slice(0, 10)
  const stable = ranked.filter(o => scoreFor(o) >= 75).slice(0, 10)
  const yesterday = new Date(Date.now() - 86400_000)
  const yesterdayLabel = yesterday.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
  const stageData = (['reporting', 'signing', 'signed', 'delivery'] as Opportunity['stage'][]).map(stage => ({
    label: stageText(stage), value: visibleOpps.filter(o => o.stage === stage).length,
  }))
  const maxStage = Math.max(1, ...stageData.map(item => item.value))
  const industryData = Object.entries(visibleOpps.reduce<Record<string, number>>((result, opp) => {
    result[opp.industry] = (result[opp.industry] || 0) + 1
    return result
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const openSide = (tab: SideTab) => {
    setSideTab(tab)
    setSideOpen(true)
  }

  const ask = (question = input) => {
    const q = question.trim()
    if (!q) return
    const top = ranked[0]
    const risk = urgent.find(o => !o.lockedPermanently)
    let answer = '我可以帮你查商机、生成跟进话术、分析风险，也可以基于连接器上下文给出下一步建议。'
    if (q.includes('优先') || q.includes('今天') || q.includes('跟谁')) {
      answer = top ? `今天建议优先推进「${top.customerName}」：健康度 ${scoreFor(top)} 分，当前处于${stageText(top.stage)}。建议先确认决策链和下一个明确时间点。` : '当前没有可推进的活跃商机。'
    } else if (q.includes('话术') || q.includes('消息')) {
      answer = top ? `可发送：您好，关于「${top.customerName}」的${top.requirementDescription.slice(0, 18)}需求，我们已整理了针对性方案。想邀请您用 30 分钟一起确认范围、时间节点和交付标准，您看哪个时间方便？` : answer
    } else if (q.includes('风险') || q.includes('到期') || q.includes('卡')) {
      answer = risk ? `当前最需关注「${risk.customerName}」：保护期剩余 ${Math.max(daysUntil(risk.releaseAt), 0)} 天。请先补充最新进展，再判断是否申请续期。` : '当前没有即将到期的活跃商机。'
    } else if (q.includes('下一步') || q.includes('怎么推')) {
      answer = top ? `「${top.customerName}」的下一步：结合${amountLabel(top.amountRange)}的金额预期，先确认决策人、时间节点与交付边界，然后将结论写入进展记录。` : answer
    }
    setMessages(items => [...items, { role: 'user', text: q }, { role: 'assistant', text: answer }])
    setInput('')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  const renderSideList = () => {
    if (sideTab === 'suggestions') return suggestions.map(item => (
      <button key={item.id} className="ai-side-item suggestions" onClick={() => navigate(`/opportunity/${item.opp.id}`)}>
        <strong>{item.opp.customerName}</strong><p>{item.reason} · {item.action}</p>
      </button>
    ))
    const list = sideTab === 'processing' ? processing : stable
    return list.map(opp => (
      <button key={opp.id} className={`ai-side-item ${sideTab}`} onClick={() => navigate(`/opportunity/${opp.id}`)}>
        <strong>{opp.customerName}</strong><p>{sideTab === 'processing' ? `${stageText(opp.stage)}待确认 · 建议补齐关键字段并尽快完成审批处理。` : `${stageText(opp.stage)} · 健康度 ${scoreFor(opp)} 分，按当前节奏持续推进。`}</p>
      </button>
    ))
  }

  return (
    <div className={`ai-partner-page ${sideOpen ? 'with-side' : ''}`}>
      <aside className="ai-signal-panel glass-panel">
        <div className="ai-panel-title"><div><span className="ai-kicker"><Sparkles size={13} /> LIVE CONTEXT</span><h2>商机实时信号</h2></div><b>{visibleSignals.length} 条</b></div>
        <div className="ai-filter-row">{(['all', 'jingme', 'feishu', 'email', 'meeting'] as SignalChannel[]).map(id => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{id === 'all' ? '全部' : channelMeta[id].label}</button>)}</div>
        <div className="ai-signal-list">
          {visibleSignals.length ? visibleSignals.map(item => { const meta = channelMeta[item.channel]; return <button key={item.id} className="ai-signal-item" onClick={() => navigate(`/opportunity/${item.opportunityId}`)}><span className="ai-signal-time">{item.time}</span><i style={{ background: meta.color }} /><div><div className="ai-signal-tags"><em style={{ color: meta.color, background: meta.bg }}>{meta.label}</em><span>{item.tag}</span></div><strong>{item.title}</strong><p>{item.summary}</p></div></button> }) : <div className="ai-empty">该渠道暂无新信号</div>}
        </div>
      </aside>

      <section className="ai-conversation glass-panel">
        <header className="ai-conversation-head">
          <button className="ai-head-action" onClick={() => setDailyOpen(true)}><CalendarDays size={15} /><strong>商机日报</strong></button>
          <button className={`ai-side-toggle ${sideOpen ? 'active' : ''}`} onClick={() => setSideOpen(v => !v)} aria-label="展开销售伙伴侧边栏" title="侧边栏"><PanelRight size={17} /></button>
        </header>
        <div className="ai-conversation-main">
          <div className="ai-chat-column">
            <div className="ai-chat-scroll">
              <div className="ai-greeting"><div className="ai-bot-avatar"><Sparkles size={21} /></div><div><h1>{greetingText()}，{currentUser.name}，这是我为你整理的商机进展</h1><p>{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })} · 数据来自 CRM 商机和已授权连接器</p></div></div>
              <div className="ai-summary-card"><div className="ai-summary-intro"><Bot size={18} /><p>你不在的这段时间，我继续盯着 Pipeline。当前有 <b>{active.length}</b> 个活跃商机，<b>{suggestions.length}</b> 个需重点推进项。</p></div><div className="ai-snapshot-grid"><button className="ai-snapshot-card progress" onClick={() => openSide('processing')}><span className="ai-snapshot-icon"><Clock3 size={15} /></span><div><small>需审批项</small><strong>{processing.length}</strong></div><em>待处理</em></button><button className="ai-snapshot-card urgent" onClick={() => openSide('suggestions')}><span className="ai-snapshot-icon"><TriangleAlert size={15} /></span><div><small>需重点推进</small><strong>{suggestions.length}</strong></div><em>优先推进</em></button><button className="ai-snapshot-card stable" onClick={() => openSide('stable')}><span className="ai-snapshot-icon"><Check size={15} /></span><div><small>顺利推进中</small><strong>{stable.length}</strong></div><em>健康度 ≥ 75</em></button></div></div>
              <div className="ai-section-title"><span>今日处理建议</span><b>{suggestions.length}</b></div>
              <div className="ai-suggestion-grid">{suggestions.map((item, index) => <article key={item.id} className={done.includes(item.id) ? 'done' : ''}><div className="ai-suggestion-index">0{index + 1}</div><em>{item.dimension}</em><h3>{item.title}</h3><strong>{item.opp.customerName}</strong><p>{item.reason}</p><button onClick={() => { setDone(v => v.includes(item.id) ? v : [...v, item.id]); if (item.id === 'priority') ask('帮我写跟进话术'); else navigate(`/opportunity/${item.opp.id}`) }}>{done.includes(item.id) ? <><Check size={14} /> 已处理</> : <>{item.action}<ChevronRight size={14} /></>}</button></article>)}</div>
              {messages.map((message, index) => <div key={index} className={`ai-message ${message.role}`}><span>{message.role === 'assistant' ? <Bot size={16} /> : <Users size={16} />}</span><p>{message.text}</p></div>)}
            </div>
            <div className="ai-input-area"><div className="ai-quick-questions">{['今天优先跟谁？', '哪些商机有风险？', '帮我写跟进话术', '下一步怎么推？'].map(q => <button key={q} onClick={() => ask(q)}>{q}</button>)}</div><div className="ai-inputbar"><MessageCircle size={18} /><input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="你有什么商机进展 / 推进问题，都可以问我…" /><button onClick={() => ask()} aria-label="发送"><Send size={17} /></button></div><div className="ai-data-note">Scale X 仅基于你有权访问的 CRM 与连接器数据提供商机分析和推进支持</div></div>
          </div>
        </div>
        {sideOpen && <aside className="ai-detail-side"><div className="ai-side-head"><strong>商机跟进</strong><button onClick={() => setSideOpen(false)} aria-label="关闭侧边栏"><X size={15} /></button></div><div className="ai-side-tabs"><button className={sideTab === 'processing' ? 'active' : ''} onClick={() => setSideTab('processing')}><span>需审批/处理</span><b>{processing.length}</b></button><button className={sideTab === 'stable' ? 'active' : ''} onClick={() => setSideTab('stable')}><span>顺利推进中</span><b>{stable.length}</b></button><button className={sideTab === 'suggestions' ? 'active' : ''} onClick={() => setSideTab('suggestions')}><span>今日处理建议</span><b>{suggestions.length}</b></button></div><div className="ai-side-list">{renderSideList()}</div></aside>}
      </section>

      {dailyOpen && <div className="ai-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDailyOpen(false)}><section className="ai-daily-modal"><header><div><span><BarChart3 size={17} /> 昨日商机日报</span><p>{yesterdayLabel} · 基于已授权 CRM 与连接器数据</p></div><button onClick={() => setDailyOpen(false)}><X size={17} /></button></header><div className="ai-daily-body"><div className="ai-daily-summary"><Sparkles size={18} /><p>昨日共跟踪 <b>{active.length}</b> 个活跃商机，{stable.length} 个稳定推进，{processing.length} 个需优先处理。建议今日优先跟进「{ranked[0]?.customerName || '暂无'}」。</p></div><div className="ai-daily-metrics"><div><span>活跃商机</span><strong>{active.length}</strong><small>当前 Pipeline</small></div><div><span>稳定推进</span><strong>{stable.length}</strong><small>健康度 ≥ 75</small></div><div><span>需处理</span><strong>{processing.length}</strong><small>到期或高风险</small></div><div><span>已签约/交付</span><strong>{visibleOpps.filter(o => ['signed', 'delivery'].includes(o.stage)).length}</strong><small>持续锁定</small></div></div><div className="ai-daily-charts"><section><h3>商机阶段分布</h3><div className="ai-bar-chart">{stageData.map((item, index) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${Math.max(8, item.value / maxStage * 100)}%`, background: ['#36a8bd', '#f0aa3c', '#28a879', '#7867ce'][index] }} /></i><strong>{item.value}</strong></div>)}</div></section><section><h3>Top 行业分布</h3><div className="ai-industry-list">{industryData.map(([name, value], index) => <div key={name}><i style={{ background: ['#12a4b7', '#6e7fd1', '#e8a23c', '#38a77a', '#d16f87', '#8a72c9'][index] }} /><span>{name}</span><strong>{value} 个</strong></div>)}</div></section></div><div className="ai-daily-focus"><h3>昨日重点与今日建议</h3>{ranked.slice(0, 4).map((opp, index) => <button key={opp.id} onClick={() => { setDailyOpen(false); navigate(`/opportunity/${opp.id}`) }}><b>0{index + 1}</b><div><strong>{opp.customerName}</strong><p>{stageText(opp.stage)} · {opp.requirementDescription.slice(0, 42)}…</p></div><span>健康度 {scoreFor(opp)}</span><ChevronRight size={14} /></button>)}</div></div></section></div>}
    </div>
  )
}
