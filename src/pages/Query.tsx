import { useState } from 'react'
import { useStore } from '../store'
import { daysUntil, stageName, formatDate } from '../utils'
import { Search, CheckCircle, Lock, PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Opportunity } from '../types'

const stageColors: Record<string, { bg: string; text: string }> = {
  reporting: { bg: 'rgba(184,92,32,0.12)', text: '#b85c20' },
  contacting:{ bg: 'rgba(14,157,191,0.12)', text: '#08758d' },
  proposal:  { bg: 'rgba(83,86,184,0.12)', text: '#5356b8' },
  negotiation:{ bg: 'rgba(154,110,0,0.12)', text: '#9a6e00' },
  signing:   { bg: 'rgba(154,110,0,0.12)',  text: '#9a6e00' },
  delivery:  { bg: 'rgba(72,48,184,0.12)',  text: '#4830b8' },
  signed:    { bg: 'rgba(10,122,82,0.12)',  text: '#0a7a52' },
  closed:    { bg: 'rgba(107,114,128,0.1)', text: '#6b7280' },
  released:  { bg: 'rgba(107,114,128,0.1)', text: '#6b7280' },
}

export default function Query() {
  const { currentUser, opportunities } = useStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ active: Opportunity[]; released: Opportunity[] } | null>(null)
  const navigate = useNavigate()

  const search = () => {
    if (!query.trim()) return
    const q = query.trim().toLowerCase()
    const now = new Date().toISOString()
    const isExpiredOrReleased = (o: Opportunity) => ['released', 'closed'].includes(o.stage) || (!o.lockedPermanently && o.releaseAt < now)
    const active = opportunities.filter(o => !isExpiredOrReleased(o) && o.customerName.toLowerCase().includes(q))
    const released = opportunities.filter(o => isExpiredOrReleased(o) && o.customerName.toLowerCase().includes(q))
    setResults({ active, released })
  }

  const canSeeOwner = currentUser.role !== 'channel'

  return (
    <div>
      {/* 搜索区：无结果时垂直居中 */}
      <div style={results ? { maxWidth: 680, margin: '0 auto' } : { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 160px)' }}>
      <div style={{ width: '100%', maxWidth: 680 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 20, textAlign: results ? 'left' : 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111111', margin: '0 0 2px' }}>商机查询</h1>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>查询客户是否已被报备，确认是否可接触</p>
      </div>

      {/* 搜索框 */}
      <div style={{
        background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
        borderRadius: 20, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.9)',
        boxShadow: '0 2px 16px rgba(80,140,160,0.08)', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#7aaabb', pointerEvents: 'none' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="输入客户名称（支持模糊搜索）"
              style={{
                width: '100%', paddingLeft: 42, paddingRight: 16, paddingTop: 13, paddingBottom: 13,
                fontSize: 14, border: '1.5px solid rgba(14,120,160,0.18)', borderRadius: 14,
                outline: 'none', background: 'rgba(236,248,252,0.7)', color: '#111111',
                boxSizing: 'border-box', transition: 'border-color 0.15s, background 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#0e9dbf'; e.target.style.background = 'rgba(255,255,255,0.95)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(14,120,160,0.18)'; e.target.style.background = 'rgba(236,248,252,0.7)' }}
            />
          </div>
          <button
            onClick={search}
            style={{
              background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)',
              color: 'white', border: 'none', padding: '13px 24px',
              borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(14,120,160,0.3)', display: 'flex', alignItems: 'center', gap: 8,
              flexShrink: 0,
            }}
          >
            <Search size={15} /> 查询
          </button>
        </div>
      </div>

      {!results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111111', marginBottom: 4 }}>查询结果说明</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13, color: '#6b7280' }}>
            <CheckCircle size={13} style={{ color: '#10b981', flexShrink: 0, position: 'relative', top: 1 }} />
            <span><strong style={{ color: '#111111' }}>可接触</strong> — 未被锁定，可直接报备</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 13, color: '#6b7280' }}>
            <Lock size={13} style={{ color: '#e05555', flexShrink: 0, position: 'relative', top: 1 }} />
            <span><strong style={{ color: '#111111' }}>已锁定</strong> — 处于保护期内，不可报备，如有争议请联系您的 JD 渠道业务经理</span>
          </div>
        </div>
      )}
      </div>
      </div>

      {results && (
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, marginTop: 0 }}>
          {results.active.length === 0 && results.released.length === 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
              borderRadius: 20, padding: '40px 32px', border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: '0 2px 16px rgba(80,140,160,0.08)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111111', marginBottom: 6 }}>客户可接触</div>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                未找到「{query}」的活跃商机，可以直接报备
              </div>
              <button
                onClick={() => navigate(`/report?name=${encodeURIComponent(query)}`)}
                style={{
                  background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)',
                  color: 'white', border: 'none', padding: '11px 24px',
                  borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(14,120,160,0.3)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <PlusCircle size={15} /> 立即报备
              </button>
            </div>
          )}
          {results.active.map(opp => {
            const isLocked = opp.lockedPermanently || daysUntil(opp.releaseAt) > 0
            const days = daysUntil(opp.releaseAt)
            const isMyOpp = opp.salesOwnerId === currentUser.id
            const isChannel = currentUser.role === 'channel'
            const sc = stageColors[opp.stage] || stageColors.released
            return (
              <div key={opp.id} style={{
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
                border: `1px solid ${isLocked ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.9)'}`,
                borderRadius: 18,
                boxShadow: isLocked
                  ? '0 2px 16px rgba(239,68,68,0.1), 0 1px 3px rgba(0,0,0,0.04)'
                  : '0 2px 16px rgba(80,140,160,0.08), 0 1px 3px rgba(0,0,0,0.04)',
                padding: '18px 22px',
              }}>
                {/* 客户信息行 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: isLocked ? 'rgba(239,68,68,0.1)' : 'rgba(14,157,191,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700,
                      color: isLocked ? '#ef4444' : '#0e9dbf',
                    }}>
                      {opp.customerName[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111111' }}>{opp.customerName}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{opp.industry}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {isMyOpp && (
                      <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(14,157,191,0.1)', color: '#0e7a9a', padding: '3px 9px', borderRadius: 8 }}>本人负责</span>
                    )}
                    {!isChannel && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.text }}>
                        {stageName(opp.stage)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 分割线 */}
                <div style={{ height: 1, background: isLocked ? 'rgba(239,68,68,0.12)' : 'rgba(14,157,191,0.1)', marginBottom: 12 }} />

                {/* 状态行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isLocked ? (
                    <>
                      <Lock size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>商机保护中</div>
                        {canSeeOwner && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>报备人：{opp.salesOwnerName}</div>}
                      </div>
                      <div style={{ marginLeft: 'auto', flexShrink: 0, position: 'relative', width: 72, height: 72 }}>
                        <svg width="72" height="72" viewBox="0 0 72 72" style={{ position: 'absolute', top: 0, left: 0 }}>
                          <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(239,68,68,0.15)" strokeWidth="6" />
                          <circle cx="36" cy="36" r="30" fill="none" stroke="#ef4444" strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 30}`}
                            strokeDashoffset={opp.lockedPermanently ? 0 : Math.max(0, 2 * Math.PI * 30 * (1 - Math.min(days, 90) / 90))}
                            transform="rotate(-90 36 36)"
                          />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', opacity: 0.7 }}>剩余</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444', lineHeight: 1.1 }}>
                            {opp.lockedPermanently ? '∞' : `${days}`}
                          </div>
                          <div style={{ fontSize: 9, fontWeight: 600, color: '#ef4444', opacity: 0.7 }}>
                            {opp.lockedPermanently ? '永久' : '天'}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>锁定期已过，可重新接触</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {results.released.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
              border: '1px solid rgba(255,255,255,0.9)', borderRadius: 20, padding: '20px 24px',
              boxShadow: '0 2px 16px rgba(80,140,160,0.08)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', marginBottom: 12 }}>
                已释放记录（{results.released.length} 条）
              </div>
              {results.released.map(opp => (
                <div key={opp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f0fc' }}>
                  <div>
                    <span style={{ fontSize: 14, color: '#4b5563', fontWeight: 500 }}>{opp.customerName}</span>
                    <span style={{ fontSize: 12, color: '#aaa', marginLeft: 8 }}>{opp.industry}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>释放于 {opp.releasedAt ? formatDate(opp.releasedAt) : '—'}</div>
                </div>
              ))}
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={14} style={{ color: '#2ec4b6' }} />
                <span style={{ fontSize: 13, color: '#0d9488' }}>已释放的客户可重新报备</span>
                <button
                  onClick={() => navigate(`/report?name=${encodeURIComponent(query)}`)}
                  style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  立即报备
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
