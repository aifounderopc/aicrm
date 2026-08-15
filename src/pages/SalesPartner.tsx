import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, CalendarDays, Check, ChevronRight, CircleCheckBig, Clock3, Copy, Download, FileSearch, ListChecks, MessageCircle, PanelRight, Quote, Send, Sparkles, Target, TriangleAlert, Unlock, X } from 'lucide-react'
import { useStore } from '../store'
import { daysUntil } from '../utils'
import type { Opportunity } from '../types'
import { agentApi, integrationApi, type AgentDashboard, type AgentSignal as ApiAgentSignal, type FeishuMessage } from '../api'

type ChatMessage = { role: 'assistant' | 'user'; text: string }
type AiHandoff = {
  nonce: string
  opportunityId: string
  customerName: string
  question: string
  context: { stage: string; amount: string; requirement: string; latestProgress: string; risks: string[]; actions: string[] }
}
type SignalChannel = 'all' | 'feishu' | 'email' | 'meeting' | 'jingme'
type SideTab = 'processing' | 'stable' | 'suggestions'
type ThinkingPhase = 'reading' | 'reasoning' | 'writing'
type SalesSignal = { id: string; opportunityId?: string; channel: Exclude<SignalChannel, 'all'>; time: string; title: string; tag: string; summary: string; sourceCount?: number }

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
  return ({ reporting: '初接触', contacting: '需求沟通', proposal: '方案确认', negotiation: '报价谈判', signing: '报价谈判', signed: '已签约', delivery: '已交付', closed: '已关闭', released: '已释放' } as const)[stage]
}

function greetingText(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 11) return '上午好'
  if (hour >= 11 && hour < 14) return '中午好'
  if (hour >= 14 && hour < 18) return '下午好'
  return '晚上好'
}

function signalTime(value: string) {
  const updatedAt = new Date(value)
  const now = new Date()
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const dayDiff = Math.max(0, Math.round((startOfDay(now) - startOfDay(updatedAt)) / 86_400_000))
  const time = updatedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${dayDiff === 0 ? '今天' : `${dayDiff} 天前`} ${time}`
}

function feishuSignalType(content: string) {
  if (/签约|合同|盖章|交付/.test(content)) return '签约推进'
  if (/报价|预算|价格|采购/.test(content)) return '报价谈判'
  if (/确认|同意|通过|排期/.test(content)) return '需求确认'
  return '需求更新'
}

function cleanAnswerInline(value: string) {
  return value
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

const answerLabels = '核心判断|结论|回答|关键依据|关键进展|风险提醒|风险判断|赢单机会|优先建议|为什么现在|推进方案|行动计划|立即行动|下一步(?:行动|建议)?|建议|沟通目标|可直接发送的话术|建议话术|备选回应|会议目标|建议议程|需要确认|成功标准|注意事项|使用提醒'
type AnswerKind = 'risk' | 'speech' | 'evidence' | 'action' | 'conclusion'
type AnswerBlock = { type: 'section'; label: string; kind: AnswerKind; items: string[] } | { type: 'heading' | 'bullet' | 'paragraph'; text: string }

function answerLines(text: string) {
  const normalized = text
    .replace(/```[\s\S]*?```/g, block => block.replace(/```\w*/g, '').replace(/```/g, ''))
    .replace(new RegExp(`\\s*(?=(${answerLabels})[：:])`, 'g'), '\n')
    .replace(/([。！？；])\s*(?=(?:[-*•]|\d+[.)、]))/g, '$1\n')
  return normalized.split('\n').flatMap(raw => {
    const line = raw.trim()
    if (!line || line.length <= 96 || new RegExp(`^(${answerLabels})[：:]`).test(cleanAnswerInline(line)) || /^(?:[-*•]|\d+[.)、])/.test(line)) return [line]
    return line.match(/[^。！？；]+[。！？；]?/g)?.map(item => item.trim()).filter(Boolean) ?? [line]
  })
}

function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  let current: Extract<AnswerBlock, { type: 'section' }> | null = null
  for (const raw of answerLines(text)) {
    const line = raw.trim()
    if (!line || /^\|?\s*:?-{3,}/.test(line)) continue
    const heading = line.match(/^#{1,6}\s+(.+)/)
    if (heading) { current = null; blocks.push({ type: 'heading', text: heading[1] }); continue }
    const labeled = cleanAnswerInline(line).match(new RegExp(`^(${answerLabels})[：:]\\s*(.*)$`))
    if (labeled) {
      const kind: AnswerKind = /风险|提醒|注意/.test(labeled[1]) ? 'risk' : /话术|回应|沟通/.test(labeled[1]) ? 'speech' : /依据|进展|为什么|确认/.test(labeled[1]) ? 'evidence' : /方案|行动|下一步|建议|成功/.test(labeled[1]) ? 'action' : 'conclusion'
      current = { type: 'section', label: labeled[1], kind, items: [] }
      const inlineItems = labeled[2].match(/[^。！？；]+[。！？；]?/g)?.map(item => item.trim()).filter(Boolean) ?? []
      current.items.push(...inlineItems)
      blocks.push(current)
      continue
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)、])\s*(.+)$/)
    const content = bullet?.[1] ?? (line.includes('|') ? line.split('|').map(cleanAnswerInline).filter(Boolean).join(' · ') : line)
    if (current) { current.items.push(content); continue }
    blocks.push({ type: bullet ? 'bullet' : 'paragraph', text: content })
  }
  return blocks
}

function renderAnswerInline(value: string) {
  const cleaned = value.replace(/\[([^\]]+)]\([^)]*\)/g, '$1').replace(/__([^_]+)__/g, '**$1**').replace(/`([^`]+)`/g, '$1')
  return cleaned.split(/(\*\*[^*]+\*\*|「[^」]+」|“[^”]+”|(?:今天|明天|本周|本月|\d+\s*(?:天|小时|分钟)))/g).filter(Boolean).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong className="ai-answer-emphasis" key={index}>{part.slice(2, -2)}</strong>
    if (/^(?:「[^」]+」|“[^”]+”|今天|明天|本周|本月|\d+\s*(?:天|小时|分钟))$/.test(part)) return <mark key={index}>{part}</mark>
    return part
  })
}

function AnalysisProgress({ phase, status, seconds }: { phase: ThinkingPhase; status: string; seconds: number }) {
  const steps: Array<{ id: ThinkingPhase; label: string }> = [
    { id: 'reading', label: '理解问题' }, { id: 'reasoning', label: '核对上下文' }, { id: 'writing', label: '生成方案' },
  ]
  const current = steps.findIndex(item => item.id === phase)
  return <div className="ai-analysis-progress"><div>{steps.map((step, index) => <span key={step.id} className={index < current ? 'done' : index === current ? 'active' : ''}><i>{index < current ? '✓' : index + 1}</i>{step.label}</span>)}</div><small>{status} · {seconds} 秒</small></div>
}

function AnalysisComplete({ seconds }: { seconds: number }) {
  return <div className="ai-analysis-complete"><Sparkles size={12} /><span>已结合最新 CRM 与商机信号分析</span><small>{Math.max(seconds, 1)} 秒</small></div>
}

function AnswerSectionIcon({ kind }: { kind: AnswerKind }) {
  const Icon = kind === 'risk' ? TriangleAlert : kind === 'speech' ? Quote : kind === 'evidence' ? FileSearch : kind === 'action' ? ListChecks : Target
  return <Icon size={14} />
}

function FormattedAssistantAnswer({ text, loading, status, phase, seconds, showProcess }: { text: string; loading: boolean; status?: string; phase: ThinkingPhase; seconds: number; showProcess: boolean }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return <div className="ai-answer-loading">{loading ? <AnalysisProgress phase={phase} status={status || '正在分析 CRM 字段与关键进展…'} seconds={seconds} /> : '本次未收到有效回复，请重新提问。'}</div>
  const blocks = answerBlocks(text)
  const shouldCollapse = !loading && text.length > 650
  return <div className="ai-answer-content">{loading ? <AnalysisProgress phase={phase} status={status || '正在生成推进建议…'} seconds={seconds} /> : showProcess && <AnalysisComplete seconds={seconds} />}<div className={`ai-answer-body ${shouldCollapse && !expanded ? 'compact' : ''}`}>{blocks.map((block, index) => {
    if (block.type === 'heading') return <h4 key={index}>{renderAnswerInline(block.text)}</h4>
    if (block.type === 'section') return <section className={`ai-answer-section ${block.kind}`} key={index}>
        <header><span><AnswerSectionIcon kind={block.kind} /></span><strong>{block.label}</strong></header>
        {block.kind === 'action'
          ? <div className="ai-answer-action-grid">{block.items.map((item, itemIndex) => <article key={itemIndex}><i>{itemIndex + 1}</i><p>{renderAnswerInline(item)}</p></article>)}</div>
          : block.kind === 'speech'
            ? <blockquote>{block.items.map((item, itemIndex) => <p key={itemIndex}>{renderAnswerInline(item)}</p>)}</blockquote>
            : <div className="ai-answer-section-copy">{block.items.map((item, itemIndex) => <p key={itemIndex}>{block.kind === 'conclusion' && itemIndex === 0 && <CircleCheckBig size={14} />}{renderAnswerInline(item)}</p>)}</div>}
      </section>
    if (block.type === 'bullet') return <div className="ai-answer-bullet" key={index}><i /> <span>{renderAnswerInline(block.text)}</span></div>
    return <p key={index}>{renderAnswerInline(block.text)}</p>
  })}</div>{shouldCollapse && <button type="button" className="ai-answer-expand" onClick={() => setExpanded(value => !value)}>{expanded ? '收起详细内容' : '展开详细分析'}</button>}</div>
}

export default function SalesPartner() {
  const { currentUser, opportunities, bootstrap } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [filter, setFilter] = useState<SignalChannel>('all')
  const [input, setInput] = useState('')
  const [done, setDone] = useState<string[]>([])
  const [dailyOpen, setDailyOpen] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const [sideTab, setSideTab] = useState<SideTab>('processing')
  const [reportAction, setReportAction] = useState<'copied' | 'exported' | null>(null)
  const [dashboard, setDashboard] = useState<AgentDashboard | null>(null)
  const [feishuMessages, setFeishuMessages] = useState<FeishuMessage[]>([])
  const [agentSignals, setAgentSignals] = useState<ApiAgentSignal[]>([])
  const [agentSignalsLoaded, setAgentSignalsLoaded] = useState(false)
  const [agentConfigured, setAgentConfigured] = useState<boolean | null>(null)
  const [isResponding, setIsResponding] = useState(false)
  const [thinkingStatus, setThinkingStatus] = useState('')
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>('reading')
  const [thinkingSeconds, setThinkingSeconds] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: '我会结合 CRM 商机、连接器上下文、保护状态和跟进记录，帮你判断今天该推进谁、怎么推进。' },
  ])
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionIdRef = useRef<string | undefined>(undefined)
  const chatAbortRef = useRef<AbortController | undefined>(undefined)
  const signalIdsRef = useRef(new Set<string>())
  const handoffHandledRef = useRef<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const askRef = useRef<(question: string, displayQuestion?: string) => Promise<void>>(async () => {})

  useEffect(() => {
    document.body.classList.add('ai-partner-open')
    return () => document.body.classList.remove('ai-partner-open')
  }, [])

  useEffect(() => {
    if (!isResponding) return
    const timer = window.setInterval(() => setThinkingSeconds(value => value + 1), 1_000)
    return () => window.clearInterval(timer)
  }, [isResponding])

  useEffect(() => {
    let active = true
    const refreshDashboard = async () => {
      await bootstrap().catch(() => undefined)
      const result = await agentApi.dashboard().catch(() => null)
      if (active && result) setDashboard(result)
    }
    void refreshDashboard()
    return () => { active = false }
  }, [bootstrap])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [structured, raw, status] = await Promise.all([
          agentApi.signals(50).catch(() => []),
          integrationApi.feishuMessages(50).catch(() => []),
          agentApi.status().catch(() => null),
        ])
        if (active) {
          const hadNewUpdate = structured.some(signal => signal.opportunityUpdated && !signalIdsRef.current.has(signal.id))
          signalIdsRef.current = new Set(structured.map(signal => signal.id))
          setAgentSignals(structured)
          setAgentSignalsLoaded(true)
          setFeishuMessages(raw)
          setAgentConfigured(status?.configured ?? false)
          if (hadNewUpdate) void bootstrap()
        }
      } catch { /* 本地演示模式保留 CRM 模拟信号 */ }
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 5_000)
    return () => { active = false; window.clearInterval(timer); chatAbortRef.current?.abort() }
  }, [bootstrap])

  const visibleOpps = useMemo(() => {
    if (['admin', 'sales_admin'].includes(currentUser.role)) return opportunities
    return opportunities.filter(o => o.salesOwnerId === currentUser.id || o.saOwnerId === currentUser.id)
  }, [currentUser, opportunities])

  const active = visibleOpps.filter(o => !['released', 'closed'].includes(o.stage))
  const ranked = [...active].sort((a, b) => scoreFor(b) - scoreFor(a))
  const urgent = [...active].sort((a, b) => daysUntil(a.releaseAt) - daysUntil(b.releaseAt))
  const channels: Exclude<SignalChannel, 'all'>[] = ['jingme', 'feishu', 'email', 'meeting']
  const signalTypes = ['需求更新', '需求确认', '报价谈判', '签约推进']
  const opportunitySignals: SalesSignal[] = [...active]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((opp, index) => {
      const channel = channels[index % channels.length]
      const expiring = !opp.lockedPermanently && daysUntil(opp.releaseAt) <= 7
      return {
        id: `${opp.id}-${channel}`,
        opportunityId: opp.id,
        channel,
        time: signalTime(opp.updatedAt),
        title: opp.customerName,
        tag: signalTypes[index % signalTypes.length],
        summary: expiring
          ? `「${stageText(opp.stage)}」商机保护期仅剩 ${Math.max(daysUntil(opp.releaseAt), 0)} 天，建议尽快补充进展或申请续期。`
          : `「${stageText(opp.stage)}」${opp.requirementDescription.slice(0, 54)}${opp.requirementDescription.length > 54 ? '…' : ''}`,
      }
    })
  const rawFeishuSignals: SalesSignal[] = feishuMessages.map(message => {
    const matchedOpportunity = active.find(opp =>
      message.chatName.includes(opp.customerName)
      || message.content.includes(opp.customerName)
      || (opp.companyName && (message.chatName.includes(opp.companyName) || message.content.includes(opp.companyName))),
    )
    const detail = `${message.senderName}：${message.content}`
    return {
      id: `feishu-${message.id}`,
      opportunityId: matchedOpportunity?.id,
      channel: 'feishu',
      time: signalTime(message.createdAt),
      title: message.chatName,
      tag: feishuSignalType(message.content),
      summary: `${detail.slice(0, 90)}${detail.length > 90 ? '…' : ''}`,
    }
  })
  const liveFeishuSignals: SalesSignal[] = agentSignalsLoaded
    ? agentSignals.map(signal => ({
        id: `agent-${signal.id}`,
        opportunityId: signal.opportunityId,
        channel: 'feishu',
        time: signalTime(signal.time),
        title: signal.title,
        tag: signal.tag,
        summary: signal.summary,
        sourceCount: signal.sourceCount,
      }))
    : rawFeishuSignals
  const liveOpportunityIds = new Set(liveFeishuSignals.map(signal => signal.opportunityId).filter(Boolean))
  const fallbackSignals = opportunitySignals.filter(signal => !signal.opportunityId || !liveOpportunityIds.has(signal.opportunityId))
  const signals: SalesSignal[] = (agentSignalsLoaded
    ? liveFeishuSignals
    : liveFeishuSignals.length ? [...liveFeishuSignals, ...fallbackSignals] : opportunitySignals
  ).slice(0, 50)
  const visibleSignals = signals.filter(s => filter === 'all' || s.channel === filter)

  const fallbackSuggestions = [
    ranked[0] && { id: 'priority', dimension: '优先推进', title: '先约关键沟通', opp: ranked[0], reason: `健康度 ${scoreFor(ranked[0])} 分，需求与金额区间已明确。`, action: '生成邀约话术' },
    urgent[0] && { id: 'risk', dimension: '风险处理', title: '检查保护期', opp: urgent[0], reason: urgent[0].lockedPermanently ? '商机已持续锁定，建议同步最新交付进展。' : `距保护期结束还有 ${Math.max(daysUntil(urgent[0].releaseAt), 0)} 天。`, action: '查看商机详情' },
    active.find(o => !o.contact.encryptedName) && (() => { const opp = active.find(o => !o.contact.encryptedName)!; return { id: 'fields', dimension: '资料补齐', title: '补齐关键联系人', opp, reason: '联系人信息不完整，会影响跟进和归属判断。', action: '打开资料页' } })(),
  ].filter(Boolean) as { id: string; dimension: string; title: string; opp: Opportunity; reason: string; action: string }[]
  const approvalOpportunities = active.filter(o => !o.lockedPermanently && daysUntil(o.releaseAt) <= 7)
  const handlingOpportunities = active.filter(o =>
    !approvalOpportunities.some(item => item.id === o.id)
    && !o.lockedPermanently
    && o.progressReports.length === 0
  ).slice(0, 4)
  const fallbackProcessing = [...approvalOpportunities, ...handlingOpportunities].slice(0, 10)
  const fallbackStable = ranked.filter(o => scoreFor(o) >= 75).slice(0, 10)
  const releasingSoon = active.filter(o => !o.lockedPermanently && daysUntil(o.releaseAt) >= 0 && daysUntil(o.releaseAt) <= 7)
  const suggestions = dashboard?.suggestions.map(item => ({
    ...item,
    opp: active.find(opp => opp.id === item.opportunityId),
  })).filter((item): item is typeof item & { opp: Opportunity } => Boolean(item.opp)) ?? fallbackSuggestions.map(item => ({
    ...item,
    query: `请针对商机“${item.opp.customerName}”分析“${item.dimension}”。当前阶段：${stageText(item.opp.stage)}；${item.reason}请给出有事实依据的判断、下一步动作、负责人建议和时间点。`,
  }))
  const processing = dashboard?.processing ?? fallbackProcessing.map(opp => ({
    opportunityId: opp.id, customerName: opp.customerName, stage: stageText(opp.stage), score: scoreFor(opp),
    reason: !opp.lockedPermanently && daysUntil(opp.releaseAt) <= 7 ? `保护期剩余 ${Math.max(daysUntil(opp.releaseAt), 0)} 天` : '尚无结构化跟进记录',
  }))
  const stable = dashboard?.stable ?? fallbackStable.map(opp => ({
    opportunityId: opp.id, customerName: opp.customerName, stage: stageText(opp.stage), score: scoreFor(opp), reason: '关键字段和近期进展相对完整',
  }))
  const summary = dashboard?.summary ?? { active: active.length, processing: processing.length, priority: suggestions.length, stable: stable.length, releasingSoon: releasingSoon.length }
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

  const dailyReportText = () => [
    '今日商机日报',
    `统计周期：昨日（${yesterdayLabel}）`,
    `活跃商机：${summary.active} 个`,
    `顺利推进：${summary.stable} 个`,
    `需重点推进：${summary.processing} 个`,
    `已签约/交付：${visibleOpps.filter(o => ['signed', 'delivery'].includes(o.stage)).length} 个`,
    `今日建议：优先跟进「${ranked[0]?.customerName || '暂无'}」`,
    '',
    ...ranked.slice(0, 4).map((opp, index) => `${index + 1}. ${opp.customerName}｜${stageText(opp.stage)}｜健康度 ${scoreFor(opp)} 分`),
  ].join('\n')

  const flashReportAction = (action: 'copied' | 'exported') => {
    setReportAction(action)
    window.setTimeout(() => setReportAction(null), 1800)
  }

  const copyDailyReport = async () => {
    const text = dailyReportText()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    flashReportAction('copied')
  }

  const exportDailyReport = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 1380
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const card = (x: number, y: number, width: number, height: number, fill = '#ffffff') => {
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, 24)
      ctx.fill()
    }
    const text = (value: string, x: number, y: number, size: number, color: string, weight = 400) => {
      ctx.fillStyle = color
      ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`
      ctx.fillText(value, x, y)
    }
    const gradient = ctx.createLinearGradient(0, 0, 1200, 1380)
    gradient.addColorStop(0, '#eaf8fb')
    gradient.addColorStop(1, '#f9fcfc')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    text('Scale X', 70, 78, 24, '#0c91a8', 800)
    text('今日商机日报', 70, 145, 48, '#092f3a', 800)
    text(`统计周期：昨日 · ${yesterdayLabel}`, 70, 190, 22, '#688890', 500)
    card(70, 230, 1060, 110, '#def5f7')
    text(`昨日共跟踪 ${active.length} 个活跃商机，${stable.length} 个顺利推进，${processing.length} 个需重点推进。`, 100, 285, 24, '#244e58', 600)
    text(`今日建议优先跟进「${ranked[0]?.customerName || '暂无'}」。`, 100, 320, 22, '#0c829b', 700)
    const metrics = [
      ['活跃商机', active.length, '当前 Pipeline'],
      ['顺利推进', stable.length, '健康度 ≥ 75'],
      ['需重点推进', processing.length, '到期或高风险'],
      ['已签约/交付', visibleOpps.filter(o => ['signed', 'delivery'].includes(o.stage)).length, '持续锁定'],
    ] as const
    metrics.forEach(([label, value, note], index) => {
      const x = 70 + index * 270
      card(x, 375, 250, 150)
      text(label, x + 24, 415, 20, '#69868e', 600)
      text(String(value), x + 24, 472, 42, '#123e49', 800)
      text(note, x + 24, 505, 17, '#8ca3a8', 500)
    })
    card(70, 565, 640, 320)
    text('商机阶段分布', 100, 610, 25, '#234e59', 750)
    stageData.forEach((item, index) => {
      const y = 660 + index * 52
      text(item.label, 100, y, 19, '#607f87', 600)
      ctx.fillStyle = '#edf3f4'
      ctx.fillRect(220, y - 17, 390, 16)
      ctx.fillStyle = ['#36a8bd', '#f0aa3c', '#28a879', '#7867ce'][index]
      ctx.fillRect(220, y - 17, Math.max(24, item.value / maxStage * 390), 16)
      text(String(item.value), 630, y, 19, '#315863', 700)
    })
    card(735, 565, 395, 320)
    text('Top 行业分布', 765, 610, 25, '#234e59', 750)
    industryData.forEach(([name, value], index) => {
      const y = 658 + index * 37
      ctx.fillStyle = ['#12a4b7', '#6e7fd1', '#e8a23c', '#38a77a', '#d16f87', '#8a72c9'][index]
      ctx.beginPath(); ctx.arc(775, y - 6, 6, 0, Math.PI * 2); ctx.fill()
      text(name, 795, y, 18, '#526f78', 600)
      text(`${value} 个`, 1055, y, 18, '#315863', 700)
    })
    card(70, 925, 1060, 360)
    text('昨日重点与今日建议', 100, 975, 26, '#234e59', 750)
    ranked.slice(0, 4).forEach((opp, index) => {
      const y = 1035 + index * 60
      text(`0${index + 1}`, 100, y, 18, '#9db2b7', 800)
      text(opp.customerName, 155, y, 21, '#234e59', 700)
      text(`${stageText(opp.stage)} · 健康度 ${scoreFor(opp)} 分`, 750, y, 18, '#0c829b', 650)
      ctx.strokeStyle = '#e5eef0'; ctx.beginPath(); ctx.moveTo(100, y + 23); ctx.lineTo(1100, y + 23); ctx.stroke()
    })
    text('由 Scale X 基于授权 CRM 与连接器数据生成', 70, 1340, 18, '#8ca3a8', 500)
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `今日商机日报-${new Date().toISOString().slice(0, 10)}.png`
      link.click()
      URL.revokeObjectURL(url)
      flashReportAction('exported')
    }, 'image/png')
  }

  const ask = async (question = input, displayQuestion?: string) => {
    const q = question.trim()
    if (!q || isResponding) return
    setMessages(items => [...items, { role: 'user', text: displayQuestion || q }, { role: 'assistant', text: '' }])
    setInput('')
    setIsResponding(true)
    setThinkingStatus('正在读取全部商机和最新信号…')
    setThinkingPhase('reading')
    setThinkingSeconds(0)
    const controller = new AbortController()
    chatAbortRef.current = controller
    let receivedText = false
    let streamError = ''
    try {
      await agentApi.streamChat({ message: q, sessionId: sessionIdRef.current }, event => {
        if (event.type === 'session') {
          sessionIdRef.current = event.sessionId
          setThinkingStatus('正在核对商机阶段、风险和关键进展…')
          setThinkingPhase('reasoning')
        }
        if (event.type === 'progress') {
          setThinkingPhase(event.stage)
          setThinkingStatus(event.label)
        }
        if (event.type === 'delta') {
          receivedText = receivedText || Boolean(event.content)
          setThinkingStatus('正在生成判断和下一步建议…')
          setThinkingPhase('writing')
          setMessages(items => items.map((item, index) => index === items.length - 1 ? { ...item, text: item.text + event.content } : item))
        }
        if (event.type === 'error') streamError = event.message
      }, controller.signal)
      if (!receivedText) {
        setMessages(items => items.map((item, index) => index === items.length - 1
          ? { ...item, text: streamError ? `AI 销售伙伴暂时无法完成分析：${streamError}` : '本次对话流未返回有效内容，请重新提问；系统已记录该异常。' } : item))
      }
    } catch {
      setMessages(items => items.map((item, index) => index === items.length - 1
        ? { ...item, text: item.text || 'AI 销售伙伴暂时无法响应，请稍后重试。' } : item))
    } finally {
      setIsResponding(false)
      setThinkingStatus('')
      chatAbortRef.current = undefined
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }
  askRef.current = ask

  useEffect(() => {
    const handoff = (location.state as { aiHandoff?: AiHandoff } | null)?.aiHandoff
    if (!handoff || handoffHandledRef.current === handoff.nonce) return
    handoffHandledRef.current = handoff.nonce
    const prompt = [
      `请仅针对商机“${handoff.customerName}”（ID: ${handoff.opportunityId}）回答：${handoff.question}。`,
      `当前阶段：${handoff.context.stage}；预算：${handoff.context.amount}。`,
      `需求场景：${handoff.context.requirement}。`,
      `最新关键进展：${handoff.context.latestProgress}。`,
      `当前风险：${handoff.context.risks.join('；') || '暂无明确高优先级风险'}。`,
      `详情页建议：${handoff.context.actions.join('；')}。`,
      '请结合服务端最新授权上下文继续分析，先给结论，再给关键依据和可执行下一步。不要输出 Markdown 标记或表格。',
    ].join('\n')
    void askRef.current(prompt, `继续分析「${handoff.customerName}」：${handoff.question}`)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const renderSideList = () => {
    if (sideTab === 'suggestions') return suggestions.map(item => (
      <button key={item.id} className="ai-side-item suggestions" onClick={() => void ask(item.query, `分析「${item.opp.customerName}」的${item.dimension}`)}>
        <strong>{item.opp.customerName}</strong><p>{item.reason} · {item.action}</p>
      </button>
    ))
    if (sideTab === 'processing') return processing.map(item => {
      const isApproval = /保护期/.test(item.reason)
      const taskTitle = isApproval ? '保护期推进判断' : '关键事项待处理'
      return (
        <article key={item.opportunityId} className={`ai-side-item processing ${isApproval ? 'approval' : 'handling'}`}>
          <button className="ai-side-card-link" onClick={() => navigate(`/opportunity/${item.opportunityId}`)}>
            <span className="ai-approval-card-head"><strong>{item.customerName}</strong><span><i className={isApproval ? 'approval' : 'handling'}>{isApproval ? '需判断' : '需处理'}</i><em>{item.stage}</em></span></span>
            <span className="ai-approval-subject"><b>{taskTitle}</b></span>
            <p>{item.reason}</p>
          </button>
          <div className="ai-approval-actions">
            <button className="handle" onClick={() => void ask(`请分析商机“${item.customerName}”当前为什么需要处理。已知：阶段${item.stage}，健康度${item.score}分，${item.reason}。请给出关键判断、优先动作、负责人建议和时间点。`, `分析「${item.customerName}」的待处理事项`)}>让 AI 分析<ChevronRight size={12} /></button>
          </div>
        </article>
      )
    })
    return stable.map(item => (
      <button key={item.opportunityId} className="ai-side-item stable" onClick={() => navigate(`/opportunity/${item.opportunityId}`)}>
        <strong>{item.customerName}</strong><p>{item.stage} · 健康度 {item.score} 分，{item.reason}。</p>
      </button>
    ))
  }

  return (
    <div className={`ai-partner-page ${sideOpen ? 'with-side' : ''}`}>
      <aside className="ai-signal-panel glass-panel">
        <div className="ai-panel-title"><span className="ai-kicker"><Sparkles size={14} /> 商机实时信号</span><b>{visibleSignals.length} 条</b></div>
        <div className="ai-filter-row">{(['all', 'jingme', 'feishu', 'email', 'meeting'] as SignalChannel[]).map(id => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{id === 'all' ? '全部' : channelMeta[id].label}</button>)}</div>
        <div className="ai-signal-list">
          {visibleSignals.length ? visibleSignals.map(item => { const meta = channelMeta[item.channel]; return <button key={item.id} className={`ai-signal-item ${item.opportunityId ? '' : 'source-only'}`} onClick={() => item.opportunityId && navigate(`/opportunity/${item.opportunityId}`)}><span className="ai-signal-time">{item.time}</span><i style={{ background: meta.color }} /><div><div className="ai-signal-tags"><em style={{ color: meta.color, background: meta.bg }}>{meta.label}</em><span>{item.tag}</span>{item.sourceCount && item.sourceCount > 1 ? <small>汇总 {item.sourceCount} 条</small> : null}</div><strong>{item.title}</strong><p>{item.summary}</p></div></button> }) : <div className="ai-empty">暂无与商机推进相关的新信号</div>}
        </div>
      </aside>

      <section className="ai-conversation glass-panel">
        <header className="ai-conversation-head">
          <button className="ai-head-action" onClick={() => setDailyOpen(true)}><CalendarDays size={15} /><strong>商机日报</strong></button>
          {!sideOpen && <button className="ai-side-toggle" onClick={() => setSideOpen(true)} aria-label="展开销售伙伴侧边栏" title="侧边栏"><PanelRight size={17} /></button>}
        </header>
        <div className="ai-conversation-main">
          <div className="ai-chat-column">
            <div className="ai-chat-scroll" ref={chatScrollRef}>
              <div className="ai-greeting"><div className="ai-bot-avatar"><img src="/ai-sales-avatar.png" alt="AI 销售伙伴" /></div><div><h1>{greetingText()}，{currentUser.name}，这是我为你整理的商机进展</h1><p>{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })} · 数据来自 CRM 商机和已授权连接器</p></div></div>
              <div className="ai-summary-card"><div className="ai-summary-intro"><p>我已分析当前权限范围内全部商机。当前有 <b>{summary.active}</b> 个活跃商机，<b>{summary.priority}</b> 个需重点推进项。{dashboard && <small>更新于 {new Date(dashboard.analyzedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · 缓存 30 分钟</small>}</p></div><div className="ai-snapshot-grid"><button className="ai-snapshot-card progress" onClick={() => openSide('processing')}><span className="ai-snapshot-icon"><Clock3 size={15} /></span><div><small>需审批/处理</small><strong>{summary.processing}</strong></div><em>待办事项</em></button><button className="ai-snapshot-card urgent" onClick={() => openSide('suggestions')}><span className="ai-snapshot-icon"><TriangleAlert size={15} /></span><div><small>需重点推进</small><strong>{summary.priority}</strong></div><em>优先推进</em></button><button className="ai-snapshot-card stable" onClick={() => openSide('stable')}><span className="ai-snapshot-icon"><Check size={15} /></span><div><small>顺利推进中</small><strong>{summary.stable}</strong></div><em>健康度 ≥ 75</em></button><div className="ai-snapshot-card release"><span className="ai-snapshot-icon"><Unlock size={15} /></span><div><small>即将释放</small><strong>{summary.releasingSoon}</strong></div><em>7 天内</em></div></div></div>
              <div className="ai-section-title"><span>今日处理建议</span><b>{suggestions.length}</b></div>
              <div className="ai-suggestion-grid">{suggestions.map((item, index) => <article key={item.id} className={done.includes(item.id) ? 'done' : ''}><div className="ai-suggestion-index">0{index + 1}</div><em>{item.dimension}</em><h3>{item.title}</h3><strong>{item.opp.customerName}</strong><p>{item.reason}</p><button disabled={isResponding} onClick={() => { setDone(v => v.includes(item.id) ? v : [...v, item.id]); void ask(item.query, `${item.action}：${item.opp.customerName}`) }}>{done.includes(item.id) ? <><Check size={14} /> 已分析</> : <>{item.action}<ChevronRight size={14} /></>}</button></article>)}</div>
              {messages.map((message, index) => <div key={index} className={`ai-message ${message.role}`}><span>{message.role === 'assistant' ? <img src="/ai-sales-avatar.png" alt="AI 销售伙伴" /> : <b>{currentUser.name.slice(0, 1)}</b>}</span>{message.role === 'assistant' ? <FormattedAssistantAnswer text={message.text} loading={isResponding && index === messages.length - 1} status={thinkingStatus} phase={thinkingPhase} seconds={thinkingSeconds} showProcess={index === messages.length - 1 && messages.some(item => item.role === 'user')} /> : <p>{message.text}</p>}</div>)}
            </div>
            <div className="ai-input-area"><div className="ai-quick-questions">{['今天优先跟谁？', '哪些商机有风险？', '帮我写跟进话术', '下一步怎么推？'].map(q => <button key={q} disabled={isResponding} onClick={() => void ask(q)}>{q}</button>)}</div><div className={`ai-inputbar ${isResponding ? 'responding' : ''}`}><MessageCircle size={18} /><input ref={inputRef} disabled={isResponding} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && void ask()} placeholder={isResponding ? 'AI 销售伙伴正在分析…' : '你有什么商机进展 / 推进问题，都可以问我…'} /><button disabled={isResponding} onClick={() => void ask()} aria-label="发送"><Send size={17} /></button></div><div className="ai-data-note"><i className={agentConfigured ? 'online' : 'fallback'} />{agentConfigured ? 'DeepSeek Harness 已连接 · ' : '规则模式 · '}Scale X 仅基于你有权访问的 CRM 与连接器数据提供商机分析和推进支持</div></div>
          </div>
        </div>
        {sideOpen && <aside className="ai-detail-side"><div className="ai-side-head"><strong>商机跟进</strong><button onClick={() => setSideOpen(false)} aria-label="关闭侧边栏"><X size={15} /></button></div><div className="ai-side-tabs"><button className={sideTab === 'processing' ? 'active' : ''} onClick={() => setSideTab('processing')}><span>需审批/处理</span><b>{processing.length}</b></button><button className={sideTab === 'stable' ? 'active' : ''} onClick={() => setSideTab('stable')}><span>顺利推进中</span><b>{stable.length}</b></button><button className={sideTab === 'suggestions' ? 'active' : ''} onClick={() => setSideTab('suggestions')}><span>今日处理建议</span><b>{suggestions.length}</b></button></div><div className="ai-side-list">{renderSideList()}</div></aside>}
      </section>

      {dailyOpen && <div className="ai-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setDailyOpen(false)}><section className="ai-daily-modal"><header><div className="ai-daily-heading"><span><BarChart3 size={20} /> 今日商机日报</span><p>统计周期：昨日 · {yesterdayLabel}</p></div><div className="ai-daily-header-actions"><button onClick={copyDailyReport}><Copy size={15} />{reportAction === 'copied' ? '已复制' : '一键复制'}</button><button onClick={exportDailyReport}><Download size={15} />{reportAction === 'exported' ? '已导出' : '导出图片'}</button><button className="close" onClick={() => setDailyOpen(false)} aria-label="关闭日报"><X size={18} /></button></div></header><div className="ai-daily-body"><div className="ai-daily-summary"><Sparkles size={20} /><p>昨日共跟踪 <b>{active.length}</b> 个活跃商机，{stable.length} 个顺利推进，{processing.length} 个需重点推进。建议今日优先跟进「{ranked[0]?.customerName || '暂无'}」。</p></div><div className="ai-daily-metrics"><div><span>活跃商机</span><strong>{active.length}</strong><small>当前 Pipeline</small></div><div><span>顺利推进</span><strong>{stable.length}</strong><small>健康度 ≥ 75</small></div><div><span>需重点推进</span><strong>{processing.length}</strong><small>到期或高风险</small></div><div><span>已签约/交付</span><strong>{visibleOpps.filter(o => ['signed', 'delivery'].includes(o.stage)).length}</strong><small>持续锁定</small></div></div><div className="ai-daily-charts"><section><h3>商机阶段分布</h3><div className="ai-bar-chart">{stageData.map((item, index) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${Math.max(8, item.value / maxStage * 100)}%`, background: ['#36a8bd', '#f0aa3c', '#28a879', '#7867ce'][index] }} /></i><strong>{item.value}</strong></div>)}</div></section><section><h3>Top 行业分布</h3><div className="ai-industry-list">{industryData.map(([name, value], index) => <div key={name}><i style={{ background: ['#12a4b7', '#6e7fd1', '#e8a23c', '#38a77a', '#d16f87', '#8a72c9'][index] }} /><span>{name}</span><strong>{value} 个</strong></div>)}</div></section></div><div className="ai-daily-focus"><h3>昨日重点与今日建议</h3>{ranked.slice(0, 4).map((opp, index) => <button key={opp.id} onClick={() => { setDailyOpen(false); navigate(`/opportunity/${opp.id}`) }}><b>0{index + 1}</b><div><strong>{opp.customerName}</strong><p>{stageText(opp.stage)} · {opp.requirementDescription.slice(0, 42)}…</p></div><span>健康度 {scoreFor(opp)}</span><ChevronRight size={16} /></button>)}</div></div></section></div>}
    </div>
  )
}
