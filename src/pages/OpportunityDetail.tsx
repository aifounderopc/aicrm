import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { stageName, formatDate, daysUntil, amountLabel, isAdminRole } from '../utils'
import { ChevronLeft, Lock, FileText, Clock, Send, Shield, ImageIcon, Upload, X, Unlock, Snowflake, XCircle } from 'lucide-react'
import type { OpportunityStage, ProgressStatus } from '../types'
import { useMobile } from '../hooks/useMobile'
import { opportunityApi, ApiError } from '../api'

const stageConfig: Record<string, { bg: string; text: string; bar: string }> = {
  reporting: { bg: '#f3f4f6', text: '#374151', bar: '#9ca3af' },
  signing:   { bg: '#fef3c7', text: '#d97706', bar: '#fbbf24' },
  delivery:  { bg: '#e0f2fe', text: '#0369a1', bar: '#38bdf8' },
  signed:    { bg: '#d1fae5', text: '#065f46', bar: '#34d399' },
  released:  { bg: '#f3f4f6', text: '#6b7280', bar: '#d1d5db' },
}

// Visual pipeline stages (for display only)
const pipeline = [
  { key: 'reporting', label: '初接触' },
  { key: 'signing',   label: '签约中' },
  { key: 'signed',    label: '已签约' },
  { key: 'delivery',  label: '项目交付' },
]
const pipelineOrder: Record<string, number> = { reporting: 0, signing: 1, signed: 2, delivery: 3, released: 4 }

const inputStyle = {
  width: '100%', padding: '10px 13px', fontSize: 13,
  border: '1.5px solid #e5e5e5', borderRadius: 10,
  outline: 'none', background: '#fafafa', color: '#111111',
  boxSizing: 'border-box' as const, fontFamily: 'inherit',
}

const sectionCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(22px) saturate(1.6)',
  WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
  border: '1px solid rgba(255,255,255,0.85)',
  borderRadius: 20,
  boxShadow: '0 2px 16px rgba(80,140,160,0.09), 0 1px 3px rgba(0,0,0,0.04)',
  padding: '24px 26px', marginBottom: 16,
}

const sectionTitle = {
  fontSize: 13, fontWeight: 700, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase' as const,
  marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8,
}

// Field displayed as a row: label left, value right
const fieldRow = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '11px 0', borderBottom: '1px solid rgba(14,120,160,0.1)',
} as const

const fieldLabel = { fontSize: 12, color: '#7a9aaa', fontWeight: 500 }
const fieldValue = { fontSize: 13, fontWeight: 600, color: '#111111', textAlign: 'right' as const }

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const {
    opportunities, users, currentUser, updateStage, requestRenewal, addProgressReport,
    releaseOpportunity, freezeOpportunity, approveEvidence, rejectEvidence,
    approveRenewal, rejectRenewal, deleteOpportunity,
  } = useStore()

  const opp = opportunities.find(o => o.id === id)

  const [newStage, setNewStage] = useState<OpportunityStage>(opp?.stage ?? 'reporting')
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [showSigningModal, setShowSigningModal] = useState(false)
  const [report, setReport] = useState({
    status: 'normal' as ProgressStatus,
    lastContactDate: new Date().toISOString().split('T')[0],
    description: '',
    estimatedSignDate: '',
    needsSupport: false,
  })
  const [signing, setSigning] = useState({ contractNo: '', signedDate: '', signedAmount: '' })
  const [contractFile, setContractFile] = useState<{ url: string; name: string } | null>(null)
  const contractFileRef = useRef<HTMLInputElement>(null)
  const [adminAction, setAdminAction] = useState<'release' | 'freeze' | 'rejectEvidence' | 'delete' | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [adminReason, setAdminReason] = useState('')
  const [rejectRenewalId, setRejectRenewalId] = useState<string | null>(null)
  const [rejectRenewalReason, setRejectRenewalReason] = useState('')
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [decryptedContact, setDecryptedContact] = useState<{ name: string; contact?: string } | null>(null)
  const [contactLoading, setContactLoading] = useState(false)
  const [contactError, setContactError] = useState('')

  // 每天 0 点自动刷新剩余天数（页面长时间挂着也能跨天更新）
  const [, setDayTick] = useState(0)
  useEffect(() => {
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    let interval: ReturnType<typeof setInterval>
    const timeout = setTimeout(() => {
      setDayTick(t => t + 1)
      interval = setInterval(() => setDayTick(t => t + 1), 24 * 60 * 60 * 1000)
    }, nextMidnight.getTime() - now.getTime())
    return () => { clearTimeout(timeout); if (interval) clearInterval(interval) }
  }, [])

  const canViewContact = !!opp && (opp.salesOwnerId === currentUser.id || isAdminRole(currentUser.role))

  useEffect(() => {
    if (!opp || !canViewContact || !opp.contact?.encryptedName) {
      setDecryptedContact(null)
      setContactError('')
      return
    }

    let cancelled = false
    setContactLoading(true)
    setContactError('')
    opportunityApi.getContact(opp.id)
      .then(contact => {
        if (!cancelled) setDecryptedContact(contact)
      })
      .catch(e => {
        if (!cancelled) setContactError(e instanceof ApiError ? e.message : '联系人解密失败')
      })
      .finally(() => {
        if (!cancelled) setContactLoading(false)
      })

    return () => { cancelled = true }
  }, [opp?.id, canViewContact, opp?.contact?.encryptedName])

  if (!opp) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
        <Shield size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
        <div style={{ fontSize: 15 }}>商机不存在或已被删除</div>
        <button onClick={() => navigate('/my')} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#111111', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          返回我的商机
        </button>
      </div>
    )
  }

  const days = daysUntil(opp.releaseAt)
  const isAdmin = currentUser.role === 'admin'
  const _isChannel = currentUser.role === 'channel'; void _isChannel
  const canEdit = opp.salesOwnerId === currentUser.id || isAdmin
  const isOwner = opp.salesOwnerId === currentUser.id
  const sc = stageConfig[opp.stage] || stageConfig.released
  const contact = opp.contact ?? { level: '—', department: '—', contactTypes: [] }
  const progressReports = opp.progressReports ?? []
  const renewalRequests = opp.renewalRequests ?? []
  const evidenceFiles = opp.evidenceFiles ?? []
  const pendingRenewals = renewalRequests.filter(r => r.status === 'pending')
  const currentPipelineIdx = pipelineOrder[opp.stage] ?? 0

  const submitReport = () => {
    addProgressReport({ opportunityId: opp.id, reporterId: currentUser.id, ...report })
    setShowProgressModal(false)
  }


  const submitSigning = () => {
    if (!signing.signedDate || !signing.signedAmount) return
    updateStage(opp.id, 'signed', {
      contractNo: '',
      signedDate: signing.signedDate,
      signedAmount: Number(signing.signedAmount),
      contractFileUrl: contractFile?.url,
    })
    setShowSigningModal(false)
  }

  const loadContractFile = (files: FileList | null) => {
    if (!files?.[0]) return
    const reader = new FileReader()
    reader.onload = e => setContractFile({ url: e.target?.result as string, name: files[0].name })
    reader.readAsDataURL(files[0])
  }

  // Budget deviation check
  const budgetMap: Record<string, number> = { under5: 2.5, '5to10': 7.5, '10to20': 15, '20to50': 35, above50: 60 }
  const budgetMid = budgetMap[opp.amountRange] ?? 0
  const signedAmt = Number(signing.signedAmount)
  const deviation = budgetMid > 0 && signedAmt > 0 ? Math.abs(signedAmt - budgetMid) / budgetMid : 0
  const needsReview = deviation > 0.2

  const confirmAdminAction = () => {
    if (adminAction === 'delete') {
      deleteOpportunity(opp.id)
      navigate('/my')
      return
    }
    if (!adminReason.trim()) return
    if (adminAction === 'release') releaseOpportunity(opp.id, adminReason)
    else if (adminAction === 'freeze') freezeOpportunity(opp.id, adminReason)
    else if (adminAction === 'rejectEvidence') rejectEvidence(opp.id, adminReason)
    navigate('/my')
  }

  const initial = opp.customerName.charAt(0)

  // Donut SVG helper
  const Donut = ({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) => {
    const r = size / 2 - 5, c = 2 * Math.PI * r
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(14,120,160,0.12)" strokeWidth={5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${c * Math.min(1,pct)} ${c * (1 - Math.min(1,pct))}`}
          strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${color}55)` }}/>
      </svg>
    )
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(22px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
    border: '1px solid rgba(255,255,255,0.85)',
    borderRadius: 18,
    boxShadow: '0 2px 16px rgba(80,140,160,0.09), 0 1px 3px rgba(0,0,0,0.04)',
    padding: '22px 24px', marginBottom: 16,
  }

  // Status colors for info rows
  const infoRow = { display: 'flex', alignItems: 'flex-start', gap: 0, padding: '7px 0', borderBottom: '1px solid rgba(14,120,160,0.08)' } as const
  const infoLabel = { fontSize: 12, color: '#7a9aaa', width: 72, flexShrink: 0, paddingTop: 1 }
  const infoVal = { fontSize: 13, color: '#1a1a1a', fontWeight: 500, flex: 1 }
  const cardTitle = { fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' as const }
  // 推进状态配色：与青蓝背景协调
  const statusMeta: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    normal:     { label: '正常推进', dot: '#0e9dbf', bg: 'rgba(14,157,191,0.1)',  text: '#0a6a82' },
    evaluating: { label: '评估中',   dot: '#7c6ef5', bg: 'rgba(124,110,245,0.1)', text: '#4c3dc0' },
    paused:     { label: '暂缓',     dot: '#e8a020', bg: 'rgba(232,160,32,0.1)',  text: '#9a6210' },
    blocked:    { label: '遇到障碍', dot: '#e05050', bg: 'rgba(224,80,80,0.1)',   text: '#a02020' },
  }

  return (
    <div>

      {/* ── Top nav bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/my')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, border: '1.5px solid #e8eaed', background: 'white', cursor: 'pointer', color: '#555', flexShrink: 0 }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>我的商机 / 商机详情</div>
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canEdit && opp.stage !== 'released' && !opp.isFrozen && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowStageMenu(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)', fontSize: 13, fontWeight: 600, color: 'white', cursor: 'pointer', boxShadow: '0 3px 12px rgba(14,157,191,0.35)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                商机进度更新
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {showStageMenu && (
                <>
                  <div onClick={() => setShowStageMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '1px solid #f0f2f5', minWidth: 160, zIndex: 100, overflow: 'hidden' }}>
                    {(['reporting','signing','signed','delivery'] as const).filter(s => pipelineOrder[s] >= pipelineOrder[opp.stage]).map(s => (
                      <button key={s} onClick={() => { setShowStageMenu(false); setNewStage(s); if (s !== opp.stage) { if (s === 'signed') setShowSigningModal(true); else updateStage(opp.id, s) } }}
                        style={{ display: 'block', width: '100%', padding: '11px 16px', textAlign: 'left', border: 'none', background: s === opp.stage ? '#f0f0f0' : 'transparent', fontSize: 13, fontWeight: s === opp.stage ? 700 : 500, color: s === opp.stage ? '#111111' : '#374151', cursor: 'pointer' }}>
                        {stageName(s)}{s === opp.stage && ' ✓'}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {isAdmin && (
            <button onClick={() => setShowAdminModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', fontSize: 13, fontWeight: 600, color: '#0a6a82', cursor: 'pointer', position: 'relative', border: '1.5px solid rgba(14,157,191,0.35)', boxShadow: '0 1px 6px rgba(14,157,191,0.12)' } as React.CSSProperties}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
              管理员操作
              {pendingRenewals.length > 0 && <span style={{ background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '0 5px', lineHeight: '16px', minWidth: 16, textAlign: 'center' }}>{pendingRenewals.length}</span>}
            </button>
          )}
        </div>
      </div>

      {/* Frozen banner */}
      {opp.isFrozen && (
        <div style={{ background: '#fff1f1', border: '1.5px solid #fecaca', borderRadius: 14, padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c', marginBottom: 1 }}>商机已冻结</div><div style={{ fontSize: 13, color: '#7f1d1d' }}>{opp.frozenReason}</div></div>
        </div>
      )}

      {/* ════════════════════════════════════════
          主布局：左列(2/3) + 右列(1/3)
          ════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>

        {/* 左列：客户信息 + 商机进度 + 举证材料 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 客户信息卡片 */}
        <div style={card}>
          {/* Hero: 客户名 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid #f0f2f5' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: 'white', flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.18)', letterSpacing: '-1px' }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: 8 }}>{opp.customerName}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: sc.bg, color: sc.text }}>{stageName(opp.stage)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: '1px solid #e5e7eb', color: '#374151' }}>{opp.industry}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: `1px solid ${opp.source === 'channel' ? '#bbf7d0' : '#bae6fd'}`, color: opp.source === 'channel' ? '#065f46' : '#0369a1' }}>{opp.source === 'direct' ? '直客' : '渠道'}</span>
              </div>
            </div>
          </div>

          {/* Info grid — 去掉报备人和报备时间 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 16 }}>
            {[
              { label: '公司全称', value: opp.companyName || '—' },
              { label: '渠道名称', value: opp.channelName || '—', hide: opp.source !== 'channel' },
              { label: '客户预算', value: amountLabel(opp.amountRange) + ' 万元' },
              { label: '首次接触', value: formatDate(opp.firstContactDate) },
            ].filter(f => !f.hide).map((f, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '9px 0', borderBottom: i < arr.length - 2 ? '1px solid #f5f6fa' : 'none' }}>
                <span style={{ fontSize: 12, color: '#9ca3af', width: 72, flexShrink: 0, paddingTop: 1 }}>{f.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111', flex: 1 }}>{f.value}</span>
              </div>
            ))}
          </div>

          {/* 联系人：职位层级 + 需求部门 重点显示 */}
          <div style={{ borderTop: '1px solid #f0f2f5', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>职位层级</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{contact.level}</div>
                </div>
                <div style={{ width: 1, height: 28, background: '#e5e7eb' }} />
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 3 }}>需求部门</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{contact.department || '—'}</div>
                </div>
              </div>
              {/* 联系人姓名 + 联系方式 合并居右 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                {canViewContact && contact.encryptedName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Lock size={10} style={{ color: '#9ca3af' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                      {contactLoading ? '解密中…' : decryptedContact?.name || (contactError ? '解密失败' : '已加密')}
                    </span>
                  </div>
                )}
                {canViewContact && decryptedContact?.contact && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{decryptedContact.contact}</div>
                )}
                <div style={{ display: 'flex', gap: 4 }}>
                  {contact.contactTypes.map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: '1px solid #e5e7eb', color: '#9ca3af' }}>
                      {t === 'phone' ? '手机' : t === 'wechat' ? '微信' : '邮箱'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Signing info */}
          {(opp.stage === 'signed' || opp.stage === 'delivery') && opp.signedDate && (
            <div style={{
              marginTop: 16, borderRadius: 14, padding: '16px 18px',
              background: 'linear-gradient(135deg, rgba(14,157,191,0.1) 0%, rgba(16,185,129,0.08) 100%)',
              border: '1.5px solid rgba(14,157,191,0.22)',
              display: 'flex', gap: 0,
            }}>
              <div style={{ flex: 1, borderRight: '1.5px solid rgba(14,157,191,0.18)', paddingRight: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0a8aaa', marginBottom: 6, letterSpacing: '0.3px' }}>签约金额</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#0a5e72', letterSpacing: '-1.5px', lineHeight: 1 }}>
                  {opp.signedAmount?.toLocaleString()}
                  <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 5, color: '#3a8a9a' }}>万元</span>
                </div>
              </div>
              <div style={{ flex: 1, paddingLeft: 18, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0a8aaa', marginBottom: 6, letterSpacing: '0.3px' }}>签约时间</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0a5e72' }}>{formatDate(opp.signedDate)}</div>
              </div>
            </div>
          )}

        </div>

        {/* 商机进度卡片 */}
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 20 }}>商机进度</div>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {pipeline.map((p, i) => {
              const done = i < currentPipelineIdx
              const active = i === currentPipelineIdx
              const reached = done || active
              const isLast = i === pipeline.length - 1
              const stageDate = p.key === 'reporting' ? opp.reportedAt : p.key === 'signed' && opp.signedDate ? opp.signedDate : active || done ? opp.updatedAt : null
              // 青蓝主色
              const TEAL = '#0e9dbf'
              const TEAL_LIGHT = 'rgba(14,157,191,0.12)'
              return (
                <div key={p.key} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? 0 : 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: done ? TEAL : active ? 'white' : 'rgba(200,225,235,0.4)',
                      border: active ? `2.5px solid ${TEAL}` : done ? 'none' : '2px solid rgba(14,157,191,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: active ? `0 0 0 5px ${TEAL_LIGHT}` : done ? `0 2px 8px rgba(14,157,191,0.22)` : 'none',
                    }}>
                      {done
                        ? <svg width="13" height="13" viewBox="0 0 12 10" fill="none"><polyline points="1 5 5 9 11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : active
                          ? <div style={{ width: 10, height: 10, borderRadius: '50%', background: TEAL }} />
                          : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(14,157,191,0.3)' }} />}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? TEAL : done ? '#1f2937' : '#9ca3af', whiteSpace: 'nowrap' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: reached ? '#5a8a9a' : 'rgba(14,157,191,0.3)', marginTop: 2, whiteSpace: 'nowrap' }}>{reached && stageDate ? formatDate(stageDate) : '—'}</div>
                    </div>
                  </div>
                  {!isLast && (
                    <div style={{
                      flex: 1, height: 2, margin: '15px 8px 0', borderRadius: 2,
                      background: done
                        ? `linear-gradient(90deg, ${TEAL}, ${TEAL})`
                        : 'rgba(14,157,191,0.15)',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

          {/* 举证材料 — 移入左列底部 */}
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={cardTitle}>举证材料</div>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{evidenceFiles.length} 份附件</span>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.4px', marginBottom: 8 }}>客户需求描述</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, borderLeft: '3px solid #e5e7eb', paddingLeft: 14 }}>{opp.requirementDescription || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.4px', marginBottom: 10 }}>客户沟通 / 拜访举证</div>
              {evidenceFiles.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px,1fr))', gap: 8 }}>
                  {evidenceFiles.map(f => (
                    <div key={f.id} style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#f5f6fa', border: '1px solid #e8eaed' }}>
                      {f.url
                        ? <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <ImageIcon size={18} style={{ color: '#d1d5db' }} />
                            <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', padding: '0 4px' }}>{f.name}</div>
                          </div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ height: 72, display: 'flex', alignItems: 'center', gap: 10, color: '#d1d5db' }}>
                  <ImageIcon size={22} /><span style={{ fontSize: 13 }}>暂无举证截图</span>
                </div>
              )}
            </div>
          </div>

        </div>{/* end 左列 */}

        {/* 右列：商机状态 + 推进进展 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 商机状态卡片 */}
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={{ ...cardTitle, marginBottom: 14 }}>商机状态 & 来源</div>

          {/* Protection status */}
          {(() => {
            const isReleased = opp.stage === 'released'
            const isLocked = opp.lockedPermanently
            const isExpired = !isLocked && !isReleased && days <= 0
            const isUrgent  = !isLocked && !isReleased && days >= 1 && days <= 7

            let accentColor: string, bgTint: string, borderColor: string, statusLabel: string, subText: string, badgeLabel: string, pct: number
            if (isReleased) {
              accentColor = '#8aacb8'; bgTint = 'rgba(200,220,230,0.25)'; borderColor = 'rgba(14,120,160,0.2)'
              statusLabel = '已释放'; badgeLabel = '保护已终止'
              subText = opp.releasedAt ? `释放于 ${formatDate(opp.releasedAt)}` : `释放于 ${formatDate(opp.releaseAt)}`
              pct = 0
            } else if (isLocked) {
              accentColor = '#0e9dbf'; bgTint = 'rgba(14,157,191,0.1)'; borderColor = 'rgba(14,157,191,0.32)'
              statusLabel = '永久锁定'; badgeLabel = '持续锁定'
              subText = '永久保护，无需续期'; pct = 1
            } else if (isExpired) {
              accentColor = '#d97706'; bgTint = 'rgba(217,119,6,0.1)'; borderColor = 'rgba(217,119,6,0.3)'
              statusLabel = '保护已到期'; badgeLabel = '已到期'
              subText = `已于 ${formatDate(opp.releaseAt)} 到期`; pct = 0
            } else if (isUrgent) {
              accentColor = '#e05050'; bgTint = 'rgba(224,80,80,0.1)'; borderColor = 'rgba(224,80,80,0.32)'
              statusLabel = '保护即将到期'; badgeLabel = `⚠ 仅剩 ${days} 天`
              subText = `到期 ${formatDate(opp.releaseAt)}`
              pct = Math.max(0, Math.min(1, days / 30))
            } else {
              accentColor = '#059669'; bgTint = 'rgba(5,150,105,0.09)'; borderColor = 'rgba(5,150,105,0.3)'
              statusLabel = '保护中'; badgeLabel = '保护有效'
              subText = `到期 ${formatDate(opp.releaseAt)}`
              pct = Math.max(0, Math.min(1, days / 30))
            }

            return (
              <div style={{ background: bgTint, borderRadius: 14, border: `1.5px solid ${borderColor}`, padding: '16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Donut pct={pct} color={accentColor} size={84} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: (isReleased || isExpired) ? 18 : isLocked ? 22 : 28, fontWeight: 900, color: accentColor, lineHeight: 1 }}>
                        {isLocked ? '∞' : (isReleased || isExpired) ? '—' : days}
                      </div>
                      {!isReleased && !isExpired && !isLocked && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, opacity: 0.75, marginTop: 2 }}>天</div>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: accentColor, marginBottom: 3, letterSpacing: '-0.2px' }}>{statusLabel}</div>
                    <div style={{ fontSize: 12, color: accentColor, opacity: 0.75, marginBottom: 8, lineHeight: 1.5 }}>{subText}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 20, background: 'rgba(255,255,255,0.7)', border: `1.5px solid ${accentColor}`, color: accentColor }}>
                      {badgeLabel}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* 报备人信息 — 移到此处 */}
          <div style={{ borderTop: '1px solid rgba(14,120,160,0.1)', paddingTop: 12 }}>
            {[
              { label: '报备人', value: users.find(u => u.id === opp.salesOwnerId)?.name ?? opp.salesOwnerName },
              { label: '角色', value: opp.source === 'channel' ? '渠道' : '直客销售' },
              opp.channelName ? { label: '渠道', value: opp.channelName } : null,
              { label: '报备时间', value: formatDate(opp.reportedAt) },
            ].filter(Boolean).map((item, i, arr) => item && (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(14,120,160,0.08)' : 'none' }}>
                <span style={{ fontSize: 12, color: '#7a9aaa', width: 60, flexShrink: 0 }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Renewal button */}
          {canEdit && !opp.lockedPermanently && days <= 7 && isOwner && opp.stage !== 'released' && (
            <button onClick={() => { requestRenewal(opp.id); navigate('/my') }} style={{ marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 10, border: '1.5px solid #fcd34d', background: 'transparent', color: '#d97706', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Clock size={13} /> 申请续期 +30天
            </button>
          )}
        </div>

        {/* 推进进展 — 垂直时间轴 */}
        <div style={{ ...card, marginBottom: 0, maxHeight: 520, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ ...cardTitle, marginBottom: 0 }}>推进信息补充</div>
            {canEdit && opp.stage !== 'signed' && opp.stage !== 'delivery' && opp.stage !== 'released' && !opp.isFrozen && (
              <button onClick={() => setShowProgressModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)', border: 'none', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(14,157,191,0.3)' }}>
                <FileText size={12} /> 新增
              </button>
            )}
          </div>
          {progressReports.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, color: '#d1d5db', gap: 8 }}>
              <Send size={22} />
              <span style={{ fontSize: 13 }}>暂无推进记录</span>
            </div>
          ) : (
            <div>
              {progressReports.slice().reverse().map((r, idx, arr) => {
                const meta = statusMeta[r.status] || statusMeta.normal
                const isLast = idx === arr.length - 1
                return (
                  <div key={r.id} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.dot, marginTop: 4, flexShrink: 0, boxShadow: `0 0 0 3px ${meta.dot}22` }} />
                      {!isLast && <div style={{ width: 2, flex: 1, background: 'rgba(14,120,160,0.15)', margin: '4px 0' }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: meta.bg, color: meta.text }}>{meta.label}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatDate(r.createdAt)}</span>
                        {r.estimatedSignDate && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>预计签约 {formatDate(r.estimatedSignDate)}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, borderLeft: `2px solid ${meta.dot}`, paddingLeft: 10 }}>{r.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        </div>{/* end 右列 */}
      </div>{/* end 主布局 grid */}

      {/* ── Progress report modal ── */}
      {showProgressModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: isMobile ? '20px 20px 0 0' : 20, padding: '28px 28px 24px', width: isMobile ? '100%' : 480, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111111', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} /> 商机推进信息补充
              </div>
              <button onClick={() => setShowProgressModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f3f4f6', cursor: 'pointer', color: '#6b7280', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, display: 'block' }}>推进状态</label>
                <select value={report.status} onChange={e => setReport(r => ({ ...r, status: e.target.value as ProgressStatus }))} style={inputStyle}>
                  <option value="normal">正常推进</option>
                  <option value="evaluating">客户在评估</option>
                  <option value="paused">暂缓（客户原因）</option>
                  <option value="blocked">遇到障碍</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, display: 'block' }}>最近联系时间</label>
                <input type="date" value={report.lastContactDate} max={new Date().toISOString().split('T')[0]}
                  onChange={e => setReport(r => ({ ...r, lastContactDate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
                  关键进展描述 *
                  <span style={{ fontWeight: 400, color: report.description.length >= 10 ? '#2ec4b6' : '#aaa' }}>{report.description.length}/10字</span>
                </label>
                <textarea rows={3} value={report.description}
                  onChange={e => setReport(r => ({ ...r, description: e.target.value }))}
                  placeholder="请描述本阶段关键进展…"
                  style={{ ...inputStyle, resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowProgressModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', fontSize: 13, cursor: 'pointer', color: '#6b7280', fontWeight: 500 }}>取消</button>
                <button onClick={submitReport} disabled={report.description.length < 10}
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: report.description.length >= 10 ? 'linear-gradient(135deg,#111111,#444444)' : '#e5e5e5', color: report.description.length >= 10 ? 'white' : '#aaa', border: 'none', padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: report.description.length >= 10 ? 'pointer' : 'default' }}>
                  <Send size={13} /> 提交进展
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Signing info modal ── */}
      {showSigningModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: isMobile ? '20px 20px 0 0' : 20, padding: '28px 28px 24px', width: isMobile ? '100%' : 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color="#059669" /> 签约信息
              </div>
              <button onClick={() => setShowSigningModal(false)} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f3f4f6', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px 24px' }}>
              {/* 签约金额 */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 6, display: 'block' }}>
                  签约金额（万元）<span style={{ color: '#e05555' }}>*</span>
                </label>
                <input type="number" min={0} value={signing.signedAmount} onChange={e => setSigning(s => ({ ...s, signedAmount: e.target.value }))}
                  placeholder="" style={{ ...inputStyle, background: 'white', border: '1.5px solid #e5e5e5', borderRadius: 14 }} />
                <div style={{ fontSize: 11, color: needsReview && signing.signedAmount !== '' ? '#d97706' : '#9ca3af', marginTop: 5 }}>
                  与预算差异&gt;20% 将触发审核
                </div>
              </div>

              {/* 签约时间 */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 6, display: 'block' }}>
                  签约时间 <span style={{ color: '#e05555' }}>*</span>
                </label>
                <input type="date" value={signing.signedDate} onChange={e => setSigning(s => ({ ...s, signedDate: e.target.value }))}
                  style={{ ...inputStyle, background: 'white', border: '1.5px solid #e5e5e5', borderRadius: 14 }} />
              </div>

              {/* 签约信息补充截图 — full width */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 6, display: 'block' }}>
                  签约信息补充
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>（可选，合同首页等截图）</span>
                </label>
                {contractFile ? (
                  <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: '1.5px solid #e5e5e5', height: 120 }}>
                    <img src={contractFile.url} alt={contractFile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => setContractFile(null)} style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X size={12} />
                    </button>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.35)', padding: '4px 10px' }}>
                      <div style={{ fontSize: 11, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contractFile.name}</div>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => contractFileRef.current?.click()}
                    style={{ height: 100, border: '1.5px dashed #d1d5db', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', background: '#fafafa', color: '#9ca3af', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fafafa')}>
                    <Upload size={20} />
                    <span style={{ fontSize: 13 }}>点击上传截图</span>
                  </div>
                )}
                <input ref={contractFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { loadContractFile(e.target.files); e.target.value = '' }} />
              </div>
            </div>

            {needsReview && signing.signedAmount !== '' && (
              <div style={{ marginTop: 16, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#d97706', fontWeight: 600 }}>
                ⚠ 签约金额与预算差异超过 20%，提交后将触发审核流程
              </div>
            )}

            {/* 确认签约 button */}
            {(() => {
              const ready = !!signing.signedDate && !!signing.signedAmount
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 26 }}>
                  <button onClick={submitSigning} disabled={!ready} style={{
                    padding: '13px 32px', borderRadius: 14, border: 'none',
                    background: ready ? 'linear-gradient(135deg, #059669, #10b981)' : '#e5e7eb',
                    color: ready ? 'white' : '#6b7280',
                    fontSize: 15, fontWeight: 700, cursor: ready ? 'pointer' : 'default',
                    boxShadow: ready ? '0 6px 20px rgba(5,150,105,0.4)' : 'none',
                    transition: 'all 0.2s',
                    letterSpacing: '0.5px',
                  }}>
                    确认签约
                  </button>
                  <button onClick={() => setShowSigningModal(false)} style={{ background: 'none', border: 'none', fontSize: 14, color: '#6b7280', cursor: 'pointer', fontWeight: 500 }}>
                    取消
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── 管理员操作弹窗 ── */}
      {showAdminModal && (
        <div onClick={() => { if (!adminAction) setShowAdminModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>管理员操作</div>
              <button onClick={() => { setShowAdminModal(false); setAdminAction(null); setAdminReason('') }} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '18px 24px 24px' }}>
              {/* Pending renewals */}
              {pendingRenewals.length > 0 && (
                <div style={{ background: '#fffbf0', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 10 }}>待审续期申请（{pendingRenewals.length}）</div>
                  {pendingRenewals.map(r => (
                    <div key={r.id}>
                      {rejectRenewalId === r.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                          <textarea rows={2} value={rejectRenewalReason} onChange={e => setRejectRenewalReason(e.target.value)} placeholder="驳回原因（必填）" style={{ ...inputStyle, resize: 'none', borderColor: '#fcd34d' }} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setRejectRenewalId(null)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1.5px solid #e5e5e5', background: 'white', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>取消</button>
                            <button disabled={!rejectRenewalReason.trim()} onClick={() => { rejectRenewal(r.id, opp.id, rejectRenewalReason); setRejectRenewalId(null) }} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: '#f4a261', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: rejectRenewalReason.trim() ? 1 : 0.5 }}>确认驳回</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: '#92400e' }}>
                          <span>申请续期 +30天</span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => approveRenewal(r.id, opp.id)} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#d1fae5', color: '#065f46', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>批准</button>
                            <button onClick={() => { setRejectRenewalId(r.id); setRejectRenewalReason('') }} style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#fff1f1', color: '#e05555', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>驳回</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Admin action form or action buttons */}
              {adminAction === 'delete' ? (
                <div>
                  <div style={{ background: '#fff1f1', border: '1.5px solid #fecaca', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', marginBottom: 6 }}>⚠ 此操作不可撤销</div>
                    <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.6 }}>
                      删除后，该商机及所有相关记录将从系统中永久移除，无法恢复。
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
                    请输入客户名称 <strong>「{opp.customerName}」</strong> 确认删除：
                  </div>
                  <input
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder={opp.customerName}
                    style={{ ...inputStyle, marginBottom: 14, borderColor: deleteConfirmText === opp.customerName ? '#ef4444' : '#e5e5e5' }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setAdminAction(null); setDeleteConfirmText('') }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e5e5', background: 'white', fontSize: 13, cursor: 'pointer', color: '#6b7280', fontWeight: 600 }}>取消</button>
                    <button
                      disabled={deleteConfirmText !== opp.customerName}
                      onClick={confirmAdminAction}
                      style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, cursor: deleteConfirmText === opp.customerName ? 'pointer' : 'default', background: deleteConfirmText === opp.customerName ? '#dc2626' : '#e5e5e5', color: deleteConfirmText === opp.customerName ? 'white' : '#aaa', transition: 'all 0.2s' }}
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              ) : adminAction ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 10 }}>
                    {adminAction === 'release' ? '释放原因（必填）' : adminAction === 'freeze' ? '冻结原因（必填）' : '驳回原因（必填）'}
                  </div>
                  <textarea rows={4} value={adminReason} onChange={e => setAdminReason(e.target.value)} placeholder="请填写原因..." style={{ ...inputStyle, resize: 'none', marginBottom: 12 }} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setAdminAction(null); setAdminReason('') }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e5e5', background: 'white', fontSize: 13, cursor: 'pointer', color: '#6b7280', fontWeight: 600 }}>取消</button>
                    <button disabled={!adminReason.trim()} onClick={confirmAdminAction} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#e05555', color: 'white', opacity: adminReason.trim() ? 1 : 0.5 }}>
                      {adminAction === 'release' ? '确认释放' : adminAction === 'freeze' ? '确认冻结' : '确认驳回'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {opp.stage !== 'released' && (
                    <button onClick={() => { setAdminAction('release'); setAdminReason('') }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff5f5'; (e.currentTarget as HTMLElement).style.borderColor = '#fca5a5' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5' }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff1f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Unlock size={16} style={{ color: '#e05555' }} /></div>
                      <div><div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>释放商机</div><div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>解除保护期，允许他人重新报备</div></div>
                    </button>
                  )}
                  {opp.isFrozen ? (
                    <button onClick={() => { approveEvidence(opp.id); setShowAdminModal(false); navigate('/my') }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0fdf4'; (e.currentTarget as HTMLElement).style.borderColor = '#6ee7b7' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5' }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Shield size={16} style={{ color: '#059669' }} /></div>
                      <div><div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>解冻商机</div><div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>通过举证审核，恢复商机正常状态</div></div>
                    </button>
                  ) : opp.stage !== 'released' && (
                    <>
                      <button onClick={() => { setAdminAction('freeze'); setAdminReason('') }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fffbeb'; (e.currentTarget as HTMLElement).style.borderColor = '#fcd34d' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5' }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Snowflake size={16} style={{ color: '#d97706' }} /></div>
                        <div><div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>冻结商机</div><div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>暂停商机保护，等待进一步核查</div></div>
                      </button>
                      <button onClick={() => { setAdminAction('rejectEvidence'); setAdminReason('') }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fffbeb'; (e.currentTarget as HTMLElement).style.borderColor = '#fcd34d' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5' }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><XCircle size={16} style={{ color: '#d97706' }} /></div>
                        <div><div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>驳回举证</div><div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>举证材料不符，要求重新提交</div></div>
                      </button>
                    </>
                  )}
                  {/* 删除商机 — 危险操作，置底分隔 */}
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10, marginTop: 2 }}>
                    <button onClick={() => { setAdminAction('delete'); setDeleteConfirmText('') }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f1'; (e.currentTarget as HTMLElement).style.borderColor = '#fecaca' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.borderColor = '#e5e5e5' }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>删除商机</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>永久删除，此操作不可撤销</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
