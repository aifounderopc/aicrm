import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { Send, Loader2, Zap, TrendingUp, Search, Clock, BarChart2, ChevronRight } from 'lucide-react'
import { stageName, daysUntil, amountLabel } from '../utils'
import { useMobile } from '../hooks/useMobile'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_ACTIONS = [
  { icon: Search,     label: '查询客户报备状态',   q: '帮我查一下华为有没有被报备' },
  { icon: Clock,      label: '即将到期的商机',      q: '我名下哪些商机快到期了？' },
  { icon: TrendingUp, label: '本月商机概况',        q: '本月新增了几个商机？' },
  { icon: BarChart2,  label: '活跃商机汇总',        q: '给我一份商机数据统计概览' },
]

function processQuery(query: string, state: ReturnType<typeof useStore.getState>): string {
  const { currentUser, opportunities } = state
  const q = query.toLowerCase()
  const myOpps = currentUser.role === 'admin'
    ? opportunities
    : opportunities.filter(o => o.salesOwnerId === currentUser.id)

  const nameQuery = (() => {
    const match = q.match(/查.*?([^\s查找看一下帮我]+[公司集团科技网络电器物流保险])/)
    if (match) return match[1]
    if (q.includes('查')) {
      const cleaned = q.replace(/帮我|查一下|查询|有没有|是否|被报备/g, '').trim()
      if (cleaned.length > 1) return cleaned
    }
    return null
  })()

  if (nameQuery && (q.includes('查') || q.includes('报备'))) {
    const found = opportunities.filter(o => o.customerName.includes(nameQuery) && o.stage !== 'released')
    if (found.length === 0) return `✅ 客户「${nameQuery}」目前没有活跃报备记录，可以直接接触并发起报备。`
    const f = found[0]
    const days = daysUntil(f.releaseAt)
    if (currentUser.role === 'channel')
      return `🔒 客户「${f.customerName}」目前处于锁定状态，${f.lockedPermanently ? '持续锁定' : `剩余 ${days} 天`}。如有争议，请联系您的 JD 渠道业务经理协调。`
    return `🔒 客户「${f.customerName}」已被锁定\n\n• 报备人：${f.salesOwnerName}\n• 当前阶段：${stageName(f.stage)}\n• 保护状态：${f.lockedPermanently ? '持续锁定' : `剩余 ${days} 天`}\n\n如需协调，请联系该负责人。`
  }

  if (q.includes('到期') || q.includes('快到') || q.includes('即将')) {
    const expiring = myOpps.filter(o => !o.lockedPermanently && o.stage !== 'released' && daysUntil(o.releaseAt) <= 7)
    if (expiring.length === 0) return `✅ 好消息！您名下没有 7 天内即将到期的商机，目前运营状态良好。`
    return `⚠️ 以下 ${expiring.length} 个商机将在 7 天内到期，请及时跟进：\n\n${expiring.map(o => `• ${o.customerName}（${stageName(o.stage)}）— 剩余 ${daysUntil(o.releaseAt)} 天`).join('\n')}\n\n建议优先推进签约，或联系管理员申请续期。`
  }

  const stageMap: Record<string, string> = { '报备中': 'reporting', '初接触': 'reporting', '签约中': 'signing', '交付': 'delivery', '已签约': 'signed' }
  for (const [label, stage] of Object.entries(stageMap)) {
    if (q.includes(label)) {
      const filtered = myOpps.filter(o => o.stage === stage)
      if (filtered.length === 0) return `目前暂无处于「${label}」阶段的商机。`
      return `📋 「${label}」商机共 ${filtered.length} 个：\n\n${filtered.map(o => `• ${o.customerName}（${o.industry} · ${amountLabel(o.amountRange)}）`).join('\n')}`
    }
  }

  if (q.includes('本月') || q.includes('这个月')) {
    const now = new Date()
    const thisMonth = myOpps.filter(o => {
      const d = new Date(o.reportedAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    return `📊 ${now.getMonth() + 1} 月数据概览\n\n• 本月新增报备：${thisMonth.length} 个\n• 已签约：${myOpps.filter(o => o.stage === 'signed').length} 个\n• 活跃商机总数：${myOpps.filter(o => o.stage !== 'released').length} 个`
  }

  if (q.includes('概览') || q.includes('总览') || q.includes('汇总') || q.includes('统计')) {
    const active = myOpps.filter(o => o.stage !== 'released')
    return `📊 商机数据汇总\n\n• 活跃商机：${active.length} 个\n• 初接触：${myOpps.filter(o => o.stage === 'reporting').length} 个\n• 签约中：${myOpps.filter(o => o.stage === 'signing').length} 个\n• 交付中：${myOpps.filter(o => o.stage === 'delivery').length} 个\n• 已签约：${myOpps.filter(o => o.stage === 'signed').length} 个\n• 已释放：${myOpps.filter(o => o.stage === 'released').length} 个`
  }

  return `我可以帮您处理以下事项：\n\n• 🔍 查询客户报备状态\n• ⏰ 查看即将到期商机\n• 📋 按阶段筛选商机列表\n• 📊 统计本月或整体数据\n\n请告诉我您需要了解什么？`
}

// Avatar SVG component
function AvaAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="14" fill="url(#ava-grad)" />
      {/* Face */}
      <circle cx="20" cy="17" r="7" fill="rgba(255,255,255,0.15)" />
      {/* Eyes */}
      <circle cx="17" cy="16" r="1.5" fill="white" />
      <circle cx="23" cy="16" r="1.5" fill="white" />
      {/* Smile */}
      <path d="M17 19.5 Q20 22 23 19.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* Signal bars (data insight icon) */}
      <rect x="13" y="28" width="3" height="5" rx="1" fill="rgba(255,255,255,0.5)" />
      <rect x="17.5" y="26" width="3" height="7" rx="1" fill="rgba(255,255,255,0.7)" />
      <rect x="22" y="24" width="3" height="9" rx="1" fill="white" />
      <defs>
        <linearGradient id="ava-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0a6a82" />
          <stop offset="100%" stopColor="#0e9dbf" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function AIAssistant() {
  const state = useStore()
  const isMobile = useMobile()
  const { currentUser } = state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasMessages = messages.length > 0

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text?: string) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: q }])
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    setMessages(m => [...m, { role: 'assistant', content: processQuery(q, state) }])
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: `calc(100vh - ${isMobile ? '80px' : '120px'})` }}>

      {/* Welcome screen — shown when no messages */}
      {!hasMessages && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '0 16px' : '0 24px' }}>

          {/* Avatar + name */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <AvaAvatar size={72} />
              <div style={{
                position: 'absolute', bottom: -4, right: -4,
                width: 20, height: 20, borderRadius: '50%',
                background: '#22c55e', border: '2.5px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={10} color="white" fill="white" />
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0a4a62', letterSpacing: '-0.3px' }}>Ava</div>
            <div style={{ fontSize: 12, color: '#7aabb8', marginTop: 2, fontWeight: 500 }}>销售数字员工 · AI CRM</div>
          </div>

          {/* Greeting */}
          <div style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(14,120,160,0.12)',
            borderRadius: 20, padding: '20px 24px',
            maxWidth: 460, width: '100%', marginBottom: 24,
            boxShadow: '0 4px 20px rgba(14,120,160,0.08)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0a4a62', marginBottom: 6 }}>
              你好，{currentUser.name} 👋
            </div>
            <div style={{ fontSize: 13, color: '#5a8a9a', lineHeight: 1.7 }}>
              我是 Ava，您的专属销售数字员工。<br />
              帮您查商机、看数据、抓风险，随时待命。
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ width: '100%', maxWidth: 460 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>快速提问</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {QUICK_ACTIONS.map(({ icon: Icon, label, q }) => (
                <button key={q} onClick={() => send(q)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(255,255,255,0.82)',
                  backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(14,120,160,0.12)',
                  borderRadius: 14, padding: '13px 16px',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  boxShadow: '0 1px 6px rgba(14,120,160,0.06)',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(14,157,191,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,120,160,0.25)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.82)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,120,160,0.12)' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(14,157,191,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color="#0e7a9a" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#1a4a5a', flex: 1 }}>{label}</span>
                  <ChevronRight size={14} color="#9ca3af" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat messages */}
      {hasMessages && (
        <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px 14px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
              {/* Avatar */}
              {msg.role === 'assistant' ? (
                <div style={{ flexShrink: 0 }}><AvaAvatar size={32} /></div>
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #374151, #6b7280)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 13,
                }}>
                  {currentUser.name[0]}
                </div>
              )}
              <div style={{
                maxWidth: isMobile ? '85%' : '72%',
                padding: '12px 16px', borderRadius: 18,
                borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 18,
                borderBottomRightRadius: msg.role === 'user' ? 4 : 18,
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #0a6a82, #0e9dbf)'
                  : 'rgba(255,255,255,0.9)',
                border: msg.role === 'assistant' ? '1px solid rgba(14,120,160,0.1)' : 'none',
                color: msg.role === 'user' ? 'white' : '#1a3a4a',
                boxShadow: msg.role === 'user'
                  ? '0 4px 12px rgba(14,120,160,0.3)'
                  : '0 2px 8px rgba(14,120,160,0.08)',
                fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-line',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flexShrink: 0 }}><AvaAvatar size={32} /></div>
              <div style={{ padding: '13px 18px', background: 'rgba(255,255,255,0.9)', borderRadius: 18, borderBottomLeftRadius: 4, border: '1px solid rgba(14,120,160,0.1)', boxShadow: '0 2px 8px rgba(14,120,160,0.08)', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#0e9dbf',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input bar */}
      <div style={{
        padding: isMobile ? '10px 14px 14px' : '14px 24px 18px',
        maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(14,120,160,0.18)',
          borderRadius: 18, padding: '8px 8px 8px 16px',
          boxShadow: '0 4px 20px rgba(14,120,160,0.1)',
          transition: 'border-color 0.15s',
        }}
          onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,157,191,0.5)'}
          onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,120,160,0.18)'}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="向 Ava 提问，例如：帮我查一下华为有没有被报备…"
            disabled={loading}
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 14,
              background: 'transparent', color: '#1a3a4a', fontFamily: 'inherit',
            }}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} style={{
            width: 38, height: 38, borderRadius: 12, border: 'none', flexShrink: 0,
            background: input.trim() && !loading ? 'linear-gradient(135deg, #0a6a82, #0e9dbf)' : 'rgba(14,120,160,0.08)',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: input.trim() && !loading ? '0 3px 10px rgba(14,120,160,0.3)' : 'none',
            transition: 'all 0.2s',
          }}>
            {loading
              ? <Loader2 size={16} color="#0e9dbf" style={{ animation: 'spin 1s linear infinite' }} />
              : <Send size={16} color={input.trim() ? 'white' : '#9ca3af'} />
            }
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
          Ava 仅读取您有权限查看的数据
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
