import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { stageName, formatDate, daysUntil, amountLabel, formatSignedAmount, isAdminRole } from '../utils'
import { ChevronLeft, Lock, FileText, Send, Shield, ImageIcon, Upload, X, Unlock, Snowflake, XCircle, Sparkles, Target, Users, Link2, MessageSquareText } from 'lucide-react'
import type { ProgressStatus } from '../types'
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
  const [previewEvidence, setPreviewEvidence] = useState<{ url: string; name: string } | null>(null)
  const [groupBound, setGroupBound] = useState(false)

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

  const contactOpportunityId = opp?.id
  const encryptedContactName = opp?.contact?.encryptedName
  useEffect(() => {
    if (!contactOpportunityId || !canViewContact || !encryptedContactName) {
      setDecryptedContact(null)
      setContactError('')
      return
    }

    let cancelled = false
    setContactLoading(true)
    setContactError('')
    opportunityApi.getContact(contactOpportunityId)
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
  }, [contactOpportunityId, canViewContact, encryptedContactName])

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

  // 推进状态配色：与青蓝背景协调
  const statusMeta: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    normal:     { label: '正常推进', dot: '#0e9dbf', bg: 'rgba(14,157,191,0.1)',  text: '#0a6a82' },
    evaluating: { label: '评估中',   dot: '#7c6ef5', bg: 'rgba(124,110,245,0.1)', text: '#4c3dc0' },
    paused:     { label: '暂缓',     dot: '#e8a020', bg: 'rgba(232,160,32,0.1)',  text: '#9a6210' },
    blocked:    { label: '遇到障碍', dot: '#e05050', bg: 'rgba(224,80,80,0.1)',   text: '#a02020' },
  }

  const completenessFields = [opp.customerName, opp.companyName, opp.industry, opp.requirementDescription, opp.amountRange, contact.department, contact.level, contact.encryptedName, evidenceFiles.length]
  const completenessScore = Math.round(completenessFields.filter(Boolean).length / completenessFields.length * 100)
  const healthScore = Math.max(35, Math.min(98,
    52 + (opp.stage === 'signing' ? 16 : opp.stage === 'signed' || opp.stage === 'delivery' ? 28 : 5)
    + (evidenceFiles.length ? 8 : 0) + (progressReports.length ? 8 : 0) + (days > 7 || opp.lockedPermanently ? 8 : -10)
  ))
  const healthTone = healthScore >= 80 ? 'healthy' : healthScore >= 65 ? 'watch' : healthScore >= 50 ? 'risk' : 'danger'
  const intentLevel = opp.amountRange === 'above50' || opp.amountRange === '20to50' ? '高意向' : opp.amountRange === '10to20' ? '中意向' : '培育中'
  const nextAction = opp.stage === 'reporting' ? '确认关键需求与预算，预约下一轮沟通' : opp.stage === 'signing' ? '推进合同条款确认与签约时间' : opp.stage === 'signed' ? '同步交付计划与关键里程碑' : opp.stage === 'delivery' ? '跟进项目交付与客户反馈' : '确认是否重新激活商机'
  const productInterest = `${opp.industry.replace(/\s*\/\s*/g, ' · ')}解决方案`
  const riskText = !opp.lockedPermanently && days <= 7 ? `保护期仅剩 ${Math.max(days, 0)} 天，需要及时续期或补充进展。` : progressReports.length === 0 ? '尚未沉淀结构化推进记录，建议补充最近沟通结果。' : '当前未识别到高优先级风险。'
  const contactName = !canViewContact ? '无权限查看' : contactLoading ? '解密中…' : decryptedContact?.name || (contactError ? '••••' : '已加密')
  const timelineItems = [
    ...progressReports.slice().reverse().map(item => ({ id: item.id, time: formatDate(item.createdAt), title: statusMeta[item.status]?.label || '推进更新', body: item.description, type: item.status === 'blocked' ? 'risk' : 'manual', label: '销售操作' })),
    { id: 'created', time: formatDate(opp.reportedAt), title: '商机创建', body: `${opp.source === 'channel' ? '渠道报备' : '销售报备'}完成，进入商机保护并开始持续跟进。`, type: 'context', label: '商机上下文' },
  ]

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
                      <button key={s} onClick={() => { setShowStageMenu(false); if (s !== opp.stage) { if (s === 'signed') setShowSigningModal(true); else updateStage(opp.id, s) } }}
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

      <section className="sx-detail-summary">
        <div className="sx-summary-main">
          <div className="sx-account-mark">{initial}</div>
          <div className="sx-account-copy">
            <span className="sx-eyebrow">OPPORTUNITY PROFILE</span>
            <h1>{opp.customerName}</h1>
            <p>{opp.companyName || opp.customerName}</p>
            <div className="sx-summary-tags">
              <span style={{ background: sc.bg, color: sc.text }}>{stageName(opp.stage)}</span>
              <span className="intent">{intentLevel}</span>
              <span>{opp.industry}</span>
              <span>{opp.source === 'channel' ? `渠道 · ${opp.channelName || '合作伙伴'}` : '直客商机'}</span>
              <span className="complete">完整度 {completenessScore}%</span>
            </div>
          </div>
        </div>
        <div className={`sx-health-ring ${healthTone}`} style={{ '--score': `${healthScore * 3.6}deg` } as React.CSSProperties}>
          <strong>{healthScore}</strong><span>健康度</span>
        </div>
        <div className="sx-stage-bar">
          {pipeline.map((item, index) => {
            const state = index < currentPipelineIdx ? 'done' : index === currentPipelineIdx ? 'active' : ''
            const stageDate = item.key === 'reporting' ? opp.reportedAt : item.key === 'signed' && opp.signedDate ? opp.signedDate : state ? opp.updatedAt : ''
            return <div key={item.key} className={state}><i /><b>{item.label}</b><em>{stageDate ? formatDate(stageDate) : '—'}</em></div>
          })}
        </div>
      </section>

      <section className="sx-detail-workspace">
        <div className="sx-detail-main">
          <article className="sx-panel">
            <header className="sx-panel-head"><div><span>核心信息</span><h2>商机字段</h2></div><small>AI 抽取 + 人工确认</small></header>
            <div className="sx-field-grid">
              <div className="sx-field"><label>商机名称</label><strong>{opp.customerName}</strong><small>{opp.companyName || '公司全称待补充'}</small></div>
              <div className="sx-field"><label>产品兴趣</label><strong>{productInterest}</strong></div>
              <div className="sx-field wide"><label>需求场景</label><strong>{opp.requirementDescription || '待补充'}</strong></div>
              <div className={`sx-field ${!opp.amountRange ? 'warn' : ''}`}><label>预算</label><strong>{amountLabel(opp.amountRange)}</strong></div>
              <div className="sx-field"><label>需求部门</label><strong>{contact.department || '待补充'}</strong></div>
              <div className="sx-field"><label>商机类型</label><strong>{opp.source === 'channel' ? '渠道商机' : '直客商机'}</strong></div>
              <div className="sx-field"><label>联系人 · {contact.level}</label><strong className="with-lock"><Lock size={12} />{contactName}</strong></div>
              <div className="sx-field"><label>联系方式</label><strong>{contact.contactTypes.map(t => t === 'phone' ? '手机' : t === 'wechat' ? '微信' : '邮箱').join(' · ') || '待补充'}</strong></div>
            </div>
            <div className="sx-owner-strip">
              <div><span>销售负责人</span><strong>{users.find(u => u.id === opp.salesOwnerId)?.name ?? opp.salesOwnerName}</strong></div>
              <div><span>协作人 / SA</span><strong>{opp.saOwnerName || '待分配'}</strong></div>
              <div><span>首次接触</span><strong>{formatDate(opp.firstContactDate)}</strong></div>
              <div><span>下一步动作</span><strong>{nextAction}</strong></div>
            </div>
            {(opp.stage === 'signed' || opp.stage === 'delivery') && opp.signedDate && <div className="sx-signed-strip"><div><span>签约金额</span><strong>{typeof opp.signedAmount === 'number' ? formatSignedAmount(opp.signedAmount) : '—'}<small> 万元</small></strong></div><div><span>签约时间</span><strong>{formatDate(opp.signedDate)}</strong></div><div><span>合同编号</span><strong>{opp.contractNo || '待补充'}</strong></div></div>}
          </article>

          <article className="sx-panel">
            <header className="sx-panel-head"><div><span>证据与来源</span><h2>来源与上下文</h2></div><small>{evidenceFiles.length} 份附件</small></header>
            <div className="sx-context-grid">
              <div><Link2 size={16} /><span>来源渠道</span><strong>{opp.source === 'channel' ? opp.channelName || '渠道伙伴' : 'Web 报备工作台'}</strong></div>
              <div><MessageSquareText size={16} /><span>原文摘要</span><strong>{opp.requirementDescription}</strong></div>
              <div><Target size={16} /><span>预算与决策</span><strong>{amountLabel(opp.amountRange)} · {contact.level}</strong></div>
            </div>
            <div className="sx-evidence-row">
              {evidenceFiles.length ? evidenceFiles.map(file => <button key={file.id} onClick={() => file.url && setPreviewEvidence({ url: file.url, name: file.name })}><span>{file.url ? <img src={file.url} alt="" /> : <ImageIcon size={18} />}</span><b>{file.name}</b><small>{formatDate(file.uploadedAt)}</small></button>) : <div className="sx-empty-evidence"><ImageIcon size={20} />暂无举证材料</div>}
            </div>
          </article>

          <article className="sx-panel">
            <header className="sx-panel-head sx-progress-head"><div><span>PROCESS TIMELINE</span><h2>商机推进</h2></div><div className="sx-head-actions">{canEdit && opp.stage !== 'released' && !opp.isFrozen && <button onClick={() => setShowProgressModal(true)}><FileText size={13} />推进信息补充</button>}<button className={groupBound ? 'bound' : ''} onClick={() => setGroupBound(value => !value)}><Users size={13} />{groupBound ? '群巡检已开启' : '绑定商机群'}</button></div></header>
            <div className="sx-progress-axis">
              {timelineItems.map((item, index) => <div key={item.id} className={`sx-progress-item ${item.type}`}><time>{item.time}</time><i>{index < timelineItems.length - 1 && <span />}</i><div><header><strong>{item.title}</strong><em>{item.label}</em></header><p>{item.body}</p></div></div>)}
            </div>
          </article>
        </div>

        <aside className="sx-detail-side">
          <article className="sx-panel sx-protection-panel">
            <header className="sx-panel-head"><div><span>PROTECTION</span><h2>商机保护状态</h2></div>{canEdit && !opp.lockedPermanently && days <= 7 && isOwner && opp.stage !== 'released' && <button className="sx-renew" onClick={() => { requestRenewal(opp.id); navigate('/my') }}>申请续期</button>}</header>
            {(() => {
              const released = opp.stage === 'released', expired = !opp.lockedPermanently && !released && days <= 0, urgent = !opp.lockedPermanently && !released && days <= 7
              const color = released ? '#8b98a8' : expired || urgent ? '#d99212' : opp.lockedPermanently ? '#1657c8' : '#00a36c'
              const label = released ? '已释放' : expired ? '保护已到期' : urgent ? '即将到期' : opp.lockedPermanently ? '永久锁定' : '保护中'
              return <div className="sx-protection-card" style={{ '--protect': color } as React.CSSProperties}><div className="sx-protect-ring"><Donut pct={opp.lockedPermanently ? 1 : Math.max(0, Math.min(1, days / 30))} color={color} size={88} /><span><strong>{opp.lockedPermanently ? '∞' : released || expired ? '—' : days}</strong>{!opp.lockedPermanently && !released && !expired && <small>天</small>}</span></div><div><h3>{label}</h3><p>{opp.lockedPermanently ? '永久保护，无需续期' : `保护到期 ${formatDate(opp.releaseAt)}`}</p><b>{released ? '保护已终止' : urgent ? `仅剩 ${Math.max(days, 0)} 天` : '保护有效'}</b></div></div>
            })()}
            <div className="sx-protection-meta"><div><span>保护负责人</span><strong>{opp.salesOwnerName}</strong></div><div><span>报备时间</span><strong>{formatDate(opp.reportedAt)}</strong></div><div><span>来源类型</span><strong>{opp.source === 'channel' ? '渠道伙伴' : '销售自报'}</strong></div><div><span>渠道经理</span><strong>{opp.channelManagerName || '—'}</strong></div></div>
          </article>

          <article className="sx-panel sx-ai-panel">
            <header className="sx-panel-head"><div><span>OPPORTUNITY X-RAY</span><h2>Scale X 商机参谋</h2></div><Sparkles size={18} /></header>
            <section className="hero"><h3>商机解读</h3><p>{opp.customerName}当前处于{stageName(opp.stage)}阶段，{intentLevel}，健康度 {healthScore} 分。</p></section>
            <section><h3>赢单机会</h3><ul><li>{productInterest}与客户当前需求场景匹配。</li><li>预算口径为{amountLabel(opp.amountRange)}。</li></ul></section>
            <section className="risk"><h3>风险提醒</h3><ul><li>{riskText}</li></ul></section>
            <section><h3>下一步行动</h3><ul><li>{nextAction}</li><li>{groupBound ? '持续关注商机群巡检报告。' : '建议绑定商机群，自动沉淀客户上下文。'}</li></ul></section>
            <button className="sx-script-btn" onClick={() => navigate(`/?prompt=${encodeURIComponent(`帮我为${opp.customerName}生成跟进话术`)}`)}><Sparkles size={14} />生成跟进话术</button>
          </article>
        </aside>
      </section>

      {previewEvidence && (
        <div
          onClick={() => setPreviewEvidence(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 16 : 32, cursor: 'zoom-out' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(980px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: 'white' }}>
              <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewEvidence.name}</div>
              <button onClick={() => setPreviewEvidence(null)} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.16)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
            <img src={previewEvidence.url} alt={previewEvidence.name} style={{ maxWidth: '100%', maxHeight: 'calc(92vh - 48px)', objectFit: 'contain', borderRadius: 14, background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }} />
          </div>
        </div>
      )}

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
