import { useMemo } from 'react'
import { useStore } from '../store'
import { daysUntil, amountLabel } from '../utils'
import { AlertTriangle, CheckCircle, Clock, ArrowUpRight, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Opportunity } from '../types'
import { useMobile } from '../hooks/useMobile'

// 活跃商机卡片配色：与青蓝背景形成冷暖对比
const STAGE_CARD: Record<string, {
  bg: string; bgHover: string;
  accent: string; text: string; sub: string;
  badge: string; badgeText: string;
  line: string; lineFade: string;
  shadow: string;
}> = {
  reporting: {
    bg:        'linear-gradient(145deg, #ddf3fa 0%, #b8e8f7 100%)',
    bgHover:   'linear-gradient(145deg, #ceeef8 0%, #a8e0f4 100%)',
    accent:    '#0e7a9a', text: '#0a4a62', sub: '#2a9abf',
    badge: 'rgba(255,255,255,0.7)', badgeText: '#0a4a62',
    line: '#14a0c8', lineFade: 'rgba(20,160,200,0.2)',
    shadow: 'rgba(14,120,160,0.18)',
  },
  signing: {
    bg:        'linear-gradient(145deg, #fef4c0 0%, #fce878 100%)',
    bgHover:   'linear-gradient(145deg, #fef0a8 0%, #fbe060 100%)',
    accent:    '#9a6e00', text: '#6b4a00', sub: '#b08020',
    badge: 'rgba(255,255,255,0.65)', badgeText: '#6b4a00',
    line: '#c89800', lineFade: 'rgba(200,152,0,0.2)',
    shadow: 'rgba(160,120,0,0.18)',
  },
  signed: {
    bg:        'linear-gradient(145deg, #c8f5e4 0%, #96eacb 100%)',
    bgHover:   'linear-gradient(145deg, #b8f0d8 0%, #82e4bc 100%)',
    accent:    '#0a7a52', text: '#055038', sub: '#2a9468',
    badge: 'rgba(255,255,255,0.65)', badgeText: '#055038',
    line: '#10a06a', lineFade: 'rgba(16,160,106,0.2)',
    shadow: 'rgba(10,120,80,0.18)',
  },
  delivery: {
    bg:        'linear-gradient(145deg, #ddd8fc 0%, #c4bbf8 100%)',
    bgHover:   'linear-gradient(145deg, #d4cefb 0%, #b8aff6 100%)',
    accent:    '#4830b8', text: '#32208a', sub: '#6050c8',
    badge: 'rgba(255,255,255,0.65)', badgeText: '#32208a',
    line: '#5840cc', lineFade: 'rgba(88,64,204,0.2)',
    shadow: 'rgba(70,48,180,0.18)',
  },
  released: {
    bg: '#f3f4f6', bgHover: '#eeeff2',
    accent: '#9ca3af', text: '#6b7280', sub: '#9ca3af',
    badge: '#e5e7eb', badgeText: '#6b7280',
    line: '#d1d5db', lineFade: 'rgba(209,213,219,0.3)',
    shadow: 'rgba(0,0,0,0.06)',
  },
}
STAGE_CARD.contacting = STAGE_CARD.reporting
STAGE_CARD.proposal = STAGE_CARD.reporting
STAGE_CARD.negotiation = STAGE_CARD.signing
STAGE_CARD.closed = STAGE_CARD.released

const PIPELINE = ['reporting', 'contacting', 'proposal', 'negotiation', 'signed', 'delivery'] as const
const PIPELINE_LABEL: Record<string, string> = {
  reporting: '初接触', contacting: '需求沟通', proposal: '方案确认', negotiation: '报价谈判', signing: '报价谈判', signed: '已签约', delivery: '已交付', closed: '已关闭',
}

function TaskCard({ opp, isAdmin }: { opp: Opportunity; isAdmin: boolean }) {
  const navigate = useNavigate()
  const days = daysUntil(opp.releaseAt)
  const sc = STAGE_CARD[opp.stage] ?? STAGE_CARD.reporting
  const currentIdx = PIPELINE.indexOf(opp.stage as typeof PIPELINE[number])

  return (
    <div
      onClick={() => navigate(`/opportunity/${opp.id}`)}
      style={{
        borderRadius: 20, padding: '16px 18px 18px',
        cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s',
        boxShadow: `0 2px 14px ${sc.shadow}`,
        background: sc.bg, minWidth: 0, position: 'relative',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-3px)'
        el.style.boxShadow = `0 10px 28px ${sc.shadow.replace('0.18', '0.28')}`
        el.style.background = sc.bgHover
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = ''
        el.style.boxShadow = `0 2px 14px ${sc.shadow}`
        el.style.background = sc.bg
      }}
    >
      {/* Top row: stage badge + admin reporter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
          background: sc.badge, color: sc.badgeText, letterSpacing: '0.2px',
        }}>
          {PIPELINE_LABEL[opp.stage] ?? opp.stage}
        </span>
        {isAdmin && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: sc.sub,
            background: 'rgba(255,255,255,0.5)', borderRadius: 20,
            padding: '2px 8px', maxWidth: 72, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {opp.salesOwnerName}
          </span>
        )}
      </div>

      {/* Customer name */}
      <div style={{ fontSize: 16, fontWeight: 700, color: sc.text, lineHeight: 1.3, marginBottom: 3 }}>
        {opp.customerName.length > 10 ? opp.customerName.slice(0, 10) + '…' : opp.customerName}
      </div>
      <div style={{ fontSize: 12, color: sc.sub, marginBottom: 14 }}>
        {opp.industry} · {amountLabel(opp.amountRange)}
      </div>

      {/* Stage timeline */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {PIPELINE.map((stage, i) => (
            <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
              {/* dot */}
              <div style={{
                width: i === currentIdx ? 10 : 7,
                height: i === currentIdx ? 10 : 7,
                borderRadius: '50%', flexShrink: 0,
                background: i <= currentIdx ? sc.line : sc.lineFade,
                border: i === currentIdx ? `2px solid ${sc.accent}` : 'none',
                boxShadow: i === currentIdx ? `0 0 0 3px ${sc.lineFade}` : 'none',
                transition: 'all 0.2s',
              }} />
              {/* connector line */}
              {i < 3 && (
                <div style={{
                  flex: 1, height: 2, borderRadius: 1,
                  background: i < currentIdx
                    ? `linear-gradient(90deg, ${sc.line}, ${sc.line})`
                    : sc.lineFade,
                }} />
              )}
            </div>
          ))}
        </div>
        {/* stage labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          {PIPELINE.map((stage, i) => (
            <span key={stage} style={{
              fontSize: 9, fontWeight: i === currentIdx ? 700 : 400,
              color: i === currentIdx ? sc.accent : sc.lineFade.replace('0.2)', '0.6)'),
              lineHeight: 1,
            }}>
              {PIPELINE_LABEL[stage]}
            </span>
          ))}
        </div>
      </div>

      {/* Protection days */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.line, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: sc.text, fontWeight: 600, opacity: 0.85 }}>
          {opp.lockedPermanently ? '持续锁定' : days > 0 ? `保护期剩 ${days} 天` : '保护期已到'}
        </span>
      </div>
    </div>
  )
}

const DONUT_COLORS = {
  done:       { stroke: '#10b981', glow: 'rgba(16,185,129,0.35)' },
  inProgress: { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.3)'  },
  backlog:    { stroke: '#a78bfa', glow: 'rgba(167,139,250,0.25)' },
}

function DonutChart({ done, inProgress, backlog }: { done: number; inProgress: number; backlog: number }) {
  const r = 48, cx = 65, cy = 65, sw = 13
  const circ = 2 * Math.PI * r
  const gapPx = 2.5 // small visual gap between segments (arc length units)

  const segs = [
    { pct: done,       color: DONUT_COLORS.done.stroke,       glow: DONUT_COLORS.done.glow },
    { pct: inProgress, color: DONUT_COLORS.inProgress.stroke, glow: DONUT_COLORS.inProgress.glow },
    { pct: backlog,    color: DONUT_COLORS.backlog.stroke,     glow: DONUT_COLORS.backlog.glow },
  ].filter(s => s.pct > 0)

  // Each segment occupies its true fraction of the full circle.
  // We position it by rotating a full circle so the dash starts at the
  // cumulative angle (−90° puts the very first segment at the top).
  // Segments therefore always tile the circle perfectly = 100% closed.
  const multi = segs.length > 1
  let cumulative = 0
  const rendered = segs.map(s => {
    const frac = s.pct / 100
    const fullArc = frac * circ
    // shrink each arc a touch to leave a visual gap (only when >1 segment)
    const arcLen = multi ? Math.max(0, fullArc - gapPx) : fullArc
    const rotation = cumulative * 360 - 90
    cumulative += frac
    return { ...s, arcLen, rotation }
  })

  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      {rendered.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth={sw}
          strokeDasharray={`${s.arcLen} ${circ - s.arcLen}`}
          strokeLinecap="butt"
          transform={`rotate(${s.rotation} ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 5px ${s.glow})` }} />
      ))}
      <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: '#111111' }}>{done}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: 10, fontWeight: 500, fill: '#6b7280' }}>已签约</text>
    </svg>
  )
}

function StatPill({ label, value, color }: { label: string; value?: string | number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0' }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}88` }} />
      <div style={{ fontSize: 13, color: '#4b5563', flex: 1 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#111111' }}>{value}%</div>
    </div>
  )
}

export default function Dashboard() {
  const { currentUser, opportunities, notifications, channels, approveRenewal, rejectRenewal, markNotificationRead } = useStore()
  const navigate = useNavigate()
  const isMobile = useMobile()

  const myOpps = useMemo(() => {
    if (currentUser.role === 'admin') return opportunities
    return opportunities.filter(o => o.salesOwnerId === currentUser.id)
  }, [opportunities, currentUser])

  const active = myOpps.filter(o => !['released', 'closed'].includes(o.stage))
  const protected_ = myOpps.filter(o => !['released', 'closed'].includes(o.stage) && (o.lockedPermanently || daysUntil(o.releaseAt) > 0))
  const thisMonth = myOpps.filter(o => {
    const d = new Date(o.reportedAt)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const signed = myOpps.filter(o => o.stage === 'signed' || o.stage === 'delivery')
  const expiringSoon = active.filter(o => !o.lockedPermanently && daysUntil(o.releaseAt) <= 7)
  const myNotifs = notifications.filter(n => n.userId === currentUser.id && !n.read)

  const pendingRenewals = opportunities.flatMap(o =>
    o.renewalRequests.filter(r => r.status === 'pending').map(r => ({ opp: o, req: r }))
  )

  // 重要提醒/待处理 总数：未读通知 + 即将到期商机 +（管理员）续期审批
  const totalPending = myNotifs.length + expiringSoon.length + (currentUser.role === 'admin' ? pendingRenewals.length : 0)

  const total = myOpps.length || 1
  const donePct = Math.round((signed.length / total) * 100)
  const inProgressPct = Math.round((myOpps.filter(o => ['reporting', 'signing'].includes(o.stage)).length / total) * 100)
  const backlogPct = 100 - donePct - inProgressPct

  const glass: React.CSSProperties = {
    background: 'rgba(255,255,255,0.74)',
    backdropFilter: 'blur(24px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
    border: '1px solid rgba(255,255,255,0.9)',
    boxShadow: '0 2px 16px rgba(80,140,160,0.09), 0 1px 3px rgba(0,0,0,0.03)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 14 : 0 }}>
        <div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 2 }}>
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111111', margin: 0 }}>
            欢迎回来，{(() => {
              if (currentUser.role === 'channel' && currentUser.channelId) {
                const ch = channels.find(c => c.id === currentUser.channelId)
                if (ch) return <>{ch.contactName}<span style={{ fontSize: 14, fontWeight: 500, color: '#6b7280', marginLeft: 4 }}>（{ch.name}）</span></>
              }
              return currentUser.name
            })()}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto' }}>
          {expiringSoon.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flex: isMobile ? 1 : 'none', justifyContent: 'center',
              background: 'rgba(255,107,107,0.12)', borderRadius: 12, padding: '8px 14px',
            }}>
              <AlertTriangle size={14} style={{ color: '#ff6b6b', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e05555' }}>{expiringSoon.length} 个商机即将到期释放</span>
            </div>
          )}
          <button onClick={() => navigate('/report')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 20px', borderRadius: 14,
              border: 'none', background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)',
              color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(14,120,160,0.32)', flexShrink: 0,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 18px rgba(14,120,160,0.42)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(14,120,160,0.32)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.22)' }}>
              <Plus size={12} strokeWidth={2.8} />
            </span>
            报备新商机
          </button>
        </div>
      </div>

      {/* Stat cards row */}
      {(() => {
        const statCards = [
          {
            label: '保护中', value: protected_.length,
            // 强调色：深蓝，实心背景
            iconBg: 'linear-gradient(135deg, #1e40af, #3b82f6)',
            shadow: 'rgba(59,130,246,0.35)',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"/>
              </svg>
            ),
          },
          {
            label: '本月新增', value: thisMonth.length,
            // 辅助色：浅紫，淡背景
            iconBg: 'rgba(139,92,246,0.12)',
            shadow: 'none',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
            ),
          },
          {
            label: '已签约', value: signed.length,
            // 辅助色：青绿，淡背景
            iconBg: 'rgba(16,185,129,0.12)',
            shadow: 'none',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ),
          },
          {
            label: '即将到期释放', value: expiringSoon.length,
            // 强调色：橙红，实心背景（有数据时）
            iconBg: expiringSoon.length > 0 ? 'linear-gradient(135deg, #ff3b30, #ff9500)' : 'rgba(0,0,0,0.06)',
            shadow: expiringSoon.length > 0 ? 'rgba(255,59,48,0.45)' : 'none',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={expiringSoon.length > 0 ? 'white' : '#9ca3af'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <polyline points="12 7 12 12 15.5 15.5"/>
              </svg>
            ),
          },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16 }}>
            {statCards.map((s, i) => (
              <div key={i} style={{
                ...glass, borderRadius: 20, padding: '20px 22px',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 13,
                  background: s.iconBg,
                  boxShadow: s.shadow !== 'none' ? `0 6px 16px ${s.shadow}` : undefined,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#111111', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 20 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Today's Tasks */}
          <div style={{ ...glass, borderRadius: 20, padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#111111' }}>活跃商机</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>点击查看详情</div>
              </div>
              <button
                onClick={() => navigate('/opportunities')}
                style={{
                  fontSize: 13, color: '#111111', fontWeight: 600,
                  background: 'rgba(0,0,0,0.08)', border: 'none',
                  padding: '6px 14px', borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                查看全部 <ArrowUpRight size={13} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
              {active.slice(0, 6).map((opp) => <TaskCard key={opp.id} opp={opp} isAdmin={currentUser.role === 'admin'} />)}
              {active.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: '#aaa' }}>
                  暂无活跃商机
                </div>
              )}
            </div>
          </div>

          {/* Rank performance - recent activity */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
            {/* Top performers */}
            <div style={{ ...glass, borderRadius: 20, padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111111' }}>近期动态</div>
                <button onClick={() => navigate('/opportunities')} style={{ fontSize: 12, color: '#111111', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>查看全部</button>
              </div>
              {myOpps.slice(0, 5).map((opp, i) => {
                const COLORS = ['#111111','#f4a261','#2ec4b6','#ff6b6b']
                const BG = ['#f0f0f0','#fde9d9','#d8f5f0','#fce8e8']
                const STAGE_COLORS: Record<string, string> = { reporting: '#9ca3af', signing: '#f4a261', signed: '#10b981', delivery: '#38bdf8' }
                const stageLabel = opp.stage === 'reporting' ? '初接触' : opp.stage === 'signing' ? '签约中' : opp.stage === 'signed' ? '已签约' : '项目交付'
                const updatedDays = Math.floor((Date.now() - new Date(opp.updatedAt).getTime()) / 86400000)
                const timeStr = updatedDays === 0 ? '今天' : updatedDays === 1 ? '昨天' : updatedDays <= 3 ? `${updatedDays}天前` : new Date(opp.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
                const stageColor = STAGE_COLORS[opp.stage] ?? '#9ca3af'
                return (
                  <div key={opp.id}
                    onClick={() => navigate(`/opportunity/${opp.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 8px', borderRadius: 10, marginBottom: i < 4 ? 2 : 0,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                      background: BG[i % 4],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: COLORS[i % 4],
                    }}>
                      {opp.customerName[0]}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {opp.customerName.length > 8 ? opp.customerName.slice(0, 8) + '…' : opp.customerName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{timeStr}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: stageColor + '22', color: stageColor,
                      }}>{stageLabel}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Stage breakdown bar chart */}
            <div style={{ ...glass, borderRadius: 20, padding: '20px 22px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111111' }}>阶段分布</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['#d1d5db','初接触'],['#fb923c','签约中'],['#7dd3fc','已签约'],['#6ee7b7','项目交付']].map(([color, label]) => (
                    <span key={label} style={{ fontSize: 10, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />{label}
                    </span>
                  ))}
                </div>
              </div>
              {(() => {
                const stages = [
                  ['reporting', '初接触', '#d1d5db'],
                  ['signing',   '签约中', '#fb923c'],
                  ['signed',    '已签约', '#7dd3fc'],
                  ['delivery',  '项目交付', '#6ee7b7'],
                ] as const
                const counts = stages.map(([s]) => myOpps.filter(o => o.stage === s).length)
                const maxCnt = Math.max(...counts, 1)
                const BAR_H = 80
                return (
                  <div style={{ marginTop: 'auto', padding: '0 8px' }}>
                    {/* counts row */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                      {stages.map(([stage], i) => (
                        <div key={stage} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#111111' }}>{counts[i]}</div>
                      ))}
                    </div>
                    {/* bars row — fixed height, bars grow from bottom */}
                    <div style={{ display: 'flex', gap: 10, height: BAR_H, alignItems: 'flex-end' }}>
                      {stages.map(([stage,, color], i) => (
                        <div key={stage} style={{ flex: 1, height: Math.max(6, Math.round((counts[i] / maxCnt) * BAR_H)), borderRadius: 8, background: color }} />
                      ))}
                    </div>
                    {/* labels row */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                      {stages.map(([stage, label]) => (
                        <div key={stage} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#6b7280' }}>{label}</div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Project Completed donut */}
          <div style={{ ...glass, borderRadius: 20, padding: '22px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111111' }}>签约进度</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>总商机 {myOpps.length}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                {[
                  { label: '已签约', pct: donePct,      color: DONUT_COLORS.done.stroke },
                  { label: '进行中', pct: inProgressPct, color: DONUT_COLORS.inProgress.stroke },
                  { label: '已释放', pct: backlogPct,    color: DONUT_COLORS.backlog.stroke },
                ].map(s => (
                  <div key={s.label}>
                    <StatPill label={s.label} value={s.pct} color={s.color} />
                    {s.label !== '已释放' && <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />}
                  </div>
                ))}
              </div>
              <DonutChart done={donePct} inProgress={inProgressPct} backlog={backlogPct} />
            </div>
          </div>

          {/* Notifications / pending */}
          <div style={{ ...glass, borderRadius: 20, padding: '20px 22px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111111', display: 'flex', alignItems: 'center' }}>
                重要提醒 / 待处理
                {totalPending > 0 && (
                  <span style={{
                    marginLeft: 6, fontSize: 11, fontWeight: 700, color: 'white',
                    background: '#ff6b6b', borderRadius: 20, padding: '2px 7px',
                  }}>{totalPending}</span>
                )}
              </div>
            </div>

            {totalPending === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#d1d5db' }}>
                <CheckCircle size={32} style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: 13, color: '#6b7280' }}>暂无需要关注的事项</div>
              </div>
            )}

            {/* 即将到期商机 — 重点关注 */}
            {expiringSoon.slice(0, 3).map(opp => {
              const dleft = daysUntil(opp.releaseAt)
              return (
                <div key={'exp-' + opp.id} onClick={() => navigate(`/opportunity/${opp.id}`)}
                  style={{
                    marginBottom: 10, padding: '12px 14px', borderRadius: 14,
                    background: 'rgba(255,107,107,0.08)', borderLeft: '3px solid #ff6b6b', cursor: 'pointer',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 2 }}>
                    <AlertTriangle size={13} style={{ color: '#ff6b6b', flexShrink: 0 }} />
                    商机即将到期释放
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                    「{opp.customerName}」保护期仅剩 {dleft} 天，请尽快推进或申请续期
                  </div>
                </div>
              )
            })}

            {myNotifs.slice(0, 4).map(n => (
              <div key={n.id} style={{
                marginBottom: 10, padding: '12px 14px', borderRadius: 14,
                background: n.type === 'error' ? '#fff1f1' : n.type === 'warning' ? '#fff8f0' : n.type === 'success' ? '#f0fff8' : '#f9f9f9',
                borderLeft: `3px solid ${n.type === 'error' ? '#ff6b6b' : n.type === 'warning' ? '#f4a261' : n.type === 'success' ? '#2ec4b6' : '#111111'}`,
                cursor: 'pointer',
              }}
                onClick={() => markNotificationRead(n.id)}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>{n.body}</div>
              </div>
            ))}

            {/* Renewal approvals for admin */}
            {currentUser.role === 'admin' && pendingRenewals.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} style={{ color: '#f4a261' }} />
                  续期申请 ({pendingRenewals.length})
                </div>
                {pendingRenewals.map(({ opp, req }) => (
                  <div key={req.id} style={{ background: '#fff8f0', borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 6 }}>
                      {opp.customerName.length > 8 ? opp.customerName.slice(0, 8) + '…' : opp.customerName}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => approveRenewal(req.id, opp.id)}
                        style={{
                          flex: 1, padding: '5px 0', borderRadius: 8, border: 'none',
                          background: 'linear-gradient(135deg, #2ec4b6, #5ee7df)',
                          color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >批准</button>
                      <button
                        onClick={() => rejectRenewal(req.id, opp.id, '资源调配')}
                        style={{
                          flex: 1, padding: '5px 0', borderRadius: 8, border: 'none',
                          background: 'linear-gradient(135deg, #ff6b6b, #ff9f9f)',
                          color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >拒绝</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
