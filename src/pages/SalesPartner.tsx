import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, Check, ChevronRight, Clock3, Mail, MessageCircle, Send, Sparkles, TriangleAlert, Users } from 'lucide-react'
import { useStore } from '../store'
import { amountLabel, daysUntil } from '../utils'
import type { Opportunity } from '../types'

type ChatMessage = { role: 'assistant' | 'user'; text: string }
type SignalChannel = 'all' | 'feishu' | 'email' | 'meeting' | 'jingme'

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
  if (opp.contact.encryptedName) score += 8
  if (opp.requirementDescription.length > 25) score += 6
  if (opp.evidenceFiles.length) score += 5
  if (!opp.lockedPermanently && daysUntil(opp.releaseAt) <= 7) score -= 18
  return Math.max(20, Math.min(96, score))
}

function stageText(stage: Opportunity['stage']) {
  return ({ reporting: '初接触', signing: '签约中', signed: '已签约', delivery: '交付中', released: '已释放' } as const)[stage]
}

export default function SalesPartner() {
  const { currentUser, opportunities } = useStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<SignalChannel>('all')
  const [input, setInput] = useState('')
  const [done, setDone] = useState<string[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: '我会结合 CRM 商机、连接器上下文、保护状态和跟进记录，帮你判断今天该推进谁、怎么推进。' },
  ])
  const inputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="ai-partner-page">
      <aside className="ai-signal-panel glass-panel">
        <div className="ai-panel-title"><div><span className="ai-kicker"><Sparkles size={13} /> LIVE CONTEXT</span><h2>商机实时信号</h2></div><b>{visibleSignals.length} 条</b></div>
        <div className="ai-filter-row">
          {(['all', 'jingme', 'feishu', 'email', 'meeting'] as SignalChannel[]).map(id => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{id === 'all' ? '全部' : channelMeta[id].label}</button>)}
        </div>
        <div className="ai-signal-list">
          {visibleSignals.length ? visibleSignals.map(item => {
            const meta = channelMeta[item.channel]
            return <button key={item.id} className="ai-signal-item" onClick={() => navigate(`/opportunity/${item.opportunityId}`)}>
              <span className="ai-signal-time">{item.time}</span><i style={{ background: meta.color }} />
              <div><div className="ai-signal-tags"><em style={{ color: meta.color, background: meta.bg }}>{meta.label}</em><span>{item.tag}</span></div><strong>{item.title}</strong><p>{item.summary}</p></div>
            </button>
          }) : <div className="ai-empty">该渠道暂无新信号</div>}
        </div>
      </aside>

      <section className="ai-conversation glass-panel">
        <header className="ai-conversation-head"><div><span><Bot size={17} /> AI 销售伙伴</span><p>正在分析 {active.length} 个活跃商机</p></div><div className="ai-online"><i /> 已同步</div></header>
        <div className="ai-chat-scroll">
          <div className="ai-greeting"><div className="ai-bot-avatar"><Sparkles size={21} /></div><div><h1>你好，{currentUser.name}，这是我为你整理的商机进展</h1><p>{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })} · 数据来自 CRM 商机和已授权连接器</p></div></div>
          <div className="ai-summary-card">
            <div className="ai-summary-intro"><Bot size={18} /><p>你不在的这段时间，我继续盯着 Pipeline。当前有 <b>{active.length}</b> 个活跃商机，<b>{urgent.filter(o => !o.lockedPermanently && daysUntil(o.releaseAt) <= 7).length}</b> 个保护期风险项。</p></div>
            <div className="ai-snapshot-grid">
              <div><span><Clock3 size={15} /> 推进中</span><strong>{active.filter(o => ['reporting', 'signing'].includes(o.stage)).length}</strong><small>需持续跟进</small></div>
              <div><span><TriangleAlert size={15} /> 需处理</span><strong>{suggestions.length}</strong><small>已生成建议</small></div>
              <div><span><Check size={15} /> 稳定推进</span><strong>{active.filter(o => scoreFor(o) >= 75).length}</strong><small>健康度 ≥ 75</small></div>
            </div>
          </div>
          <div className="ai-section-title"><span>今日处理建议</span><b>{suggestions.length}</b></div>
          <div className="ai-suggestion-grid">
            {suggestions.map((item, index) => <article key={item.id} className={done.includes(item.id) ? 'done' : ''}>
              <div className="ai-suggestion-index">0{index + 1}</div><em>{item.dimension}</em><h3>{item.title}</h3><strong>{item.opp.customerName}</strong><p>{item.reason}</p>
              <button onClick={() => { setDone(v => v.includes(item.id) ? v : [...v, item.id]); if (item.id === 'priority') ask('帮我写跟进话术'); else navigate(`/opportunity/${item.opp.id}`) }}>{done.includes(item.id) ? <><Check size={14} /> 已处理</> : <>{item.action}<ChevronRight size={14} /></>}</button>
            </article>)}
          </div>
          {messages.map((message, index) => <div key={index} className={`ai-message ${message.role}`}><span>{message.role === 'assistant' ? <Bot size={16} /> : <Users size={16} />}</span><p>{message.text}</p></div>)}
        </div>
        <div className="ai-input-area">
          <div className="ai-quick-questions">{['今天优先跟谁？', '哪些商机有风险？', '帮我写跟进话术', '下一步怎么推？'].map(q => <button key={q} onClick={() => ask(q)}>{q}</button>)}</div>
          <div className="ai-inputbar"><MessageCircle size={18} /><input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} placeholder="你有什么商机进展 / 推进问题，都可以问我…" /><button onClick={() => ask()} aria-label="发送"><Send size={17} /></button></div>
          <div className="ai-data-note"><Mail size={12} /> AI 建议仅基于你有权访问的 CRM 与连接器数据 <button onClick={() => navigate('/connectors')}>管理连接器 <ArrowRight size={12} /></button></div>
        </div>
      </section>
    </div>
  )
}
