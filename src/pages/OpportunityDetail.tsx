import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { stageName, formatDate, daysUntil, amountLabel, formatSignedAmount, isAdminRole } from '../utils'
import { ChevronLeft, Lock, FileText, Send, Shield, ImageIcon, Upload, X, Unlock, Snowflake, XCircle, Sparkles, Users, Phone, Mail, MessageCircle, Plus, Trash2, Eye, CircleHelp } from 'lucide-react'
import type { ProgressStatus } from '../types'
import { useMobile } from '../hooks/useMobile'
import { opportunityApi, ApiError } from '../api'

const stageConfig: Record<string, { bg: string; text: string; bar: string }> = {
  reporting: { bg: '#f3f4f6', text: '#374151', bar: '#9ca3af' },
  contacting: { bg: '#e7f8fb', text: '#08758d', bar: '#25a9c2' },
  proposal: { bg: '#eef0ff', text: '#5356b8', bar: '#7478dc' },
  negotiation: { bg: '#fef3c7', text: '#b96508', bar: '#e9a529' },
  signing:   { bg: '#fef3c7', text: '#d97706', bar: '#fbbf24' },
  delivery:  { bg: '#e0f2fe', text: '#0369a1', bar: '#38bdf8' },
  signed:    { bg: '#d1fae5', text: '#065f46', bar: '#34d399' },
  closed:    { bg: '#eef1f3', text: '#66737b', bar: '#98a5ad' },
  released:  { bg: '#f3f4f6', text: '#6b7280', bar: '#d1d5db' },
}

// Visual pipeline stages (for display only)
const pipeline = [
  { key: 'reporting', label: '初接触' },
  { key: 'contacting', label: '需求沟通' },
  { key: 'proposal', label: '方案确认' },
  { key: 'negotiation', label: '报价谈判' },
  { key: 'signed',    label: '已签约' },
  { key: 'delivery',  label: '已交付' },
]
const pipelineOrder: Record<string, number> = { reporting: 0, contacting: 1, proposal: 2, negotiation: 3, signing: 3, signed: 4, delivery: 5, closed: 6, released: 6 }

type GroupBinding = { channel: string; groupId: string; groupName: string }
type GroupInspectionConfig = { enabled: boolean; frequency: string; time: string; range: string; output: string; groups: GroupBinding[] }

const inputStyle = {
  width: '100%', padding: '10px 13px', fontSize: 13,
  border: '1.5px solid #e5e5e5', borderRadius: 10,
  outline: 'none', background: '#fafafa', color: '#111111',
  boxSizing: 'border-box' as const, fontFamily: 'inherit',
}

function timelineStamp(value: string) {
  const date = new Date(value)
  const hasTime = /T\d{2}:\d{2}/.test(value)
  const clock = hasTime && !Number.isNaN(date.getTime())
    ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : '12:00'
  return { date: formatDate(value), clock }
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isMobile = useMobile()
  const {
    opportunities, currentUser, updateStage, requestRenewal, addProgressReport,
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
  const [signingError, setSigningError] = useState('')
  const [signingSubmitting, setSigningSubmitting] = useState(false)
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
  const [showContactConfirm, setShowContactConfirm] = useState(false)
  const [previewEvidence, setPreviewEvidence] = useState<{ url: string; name: string } | null>(null)
  const [showGroupInspection, setShowGroupInspection] = useState(false)
  const [groupSaved, setGroupSaved] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [groupConfig, setGroupConfig] = useState<GroupInspectionConfig>({ enabled: true, frequency: '每日', time: '20:00', range: '最近 24 小时消息', output: '生成商机维护报告', groups: [{ channel: '飞书', groupId: '', groupName: '' }] })

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
  useEffect(() => {
    setDecryptedContact(null)
    setContactError('')
    setShowContactConfirm(false)
  }, [contactOpportunityId])

  useEffect(() => {
    if (!contactOpportunityId) return
    const saved = window.localStorage.getItem(`group-inspection-${contactOpportunityId}`)
    if (!saved) return
    try {
      setGroupConfig(JSON.parse(saved) as GroupInspectionConfig)
      setGroupSaved(true)
    } catch { /* 忽略损坏的本地配置 */ }
  }, [contactOpportunityId])

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
  const displayPipeline = opp.stage === 'closed' ? [...pipeline, { key: 'closed', label: '已关闭' }] : pipeline

  const submitReport = () => {
    addProgressReport({ opportunityId: opp.id, reporterId: currentUser.id, ...report })
    setShowProgressModal(false)
  }

  const saveGroupInspection = () => {
    const invalid = groupConfig.groups.some(group => !group.groupId.trim() || !group.groupName.trim())
    if (!groupConfig.groups.length || invalid) {
      setGroupError('请完整填写至少一个商机群的群 ID 和群名称')
      return
    }
    window.localStorage.setItem(`group-inspection-${opp.id}`, JSON.stringify(groupConfig))
    setGroupSaved(true)
    setGroupError('')
    setShowGroupInspection(false)
  }

  const decryptContact = async () => {
    setShowContactConfirm(false)
    setContactLoading(true)
    setContactError('')
    try {
      setDecryptedContact(await opportunityApi.getContact(opp.id))
    } catch (error) {
      setContactError(error instanceof ApiError ? error.message : '联系人解密失败')
    } finally {
      setContactLoading(false)
    }
  }


  const submitSigning = async () => {
    const signedAmount = Number(signing.signedAmount)
    if (!signing.signedDate || !Number.isFinite(signedAmount) || signedAmount <= 0) {
      setSigningError('请填写有效的签约时间和大于 0 的签约金额')
      return
    }
    setSigningSubmitting(true)
    setSigningError('')
    try {
      await updateStage(opp.id, 'signed', {
        contractNo: signing.contractNo.trim(),
        signedDate: signing.signedDate,
        signedAmount,
        contractFileUrl: contractFile?.url,
      })
      setShowSigningModal(false)
      setSigning({ contractNo: '', signedDate: '', signedAmount: '' })
      setContractFile(null)
    } catch (error) {
      setSigningError(error instanceof ApiError ? error.message : '签约信息提交失败，请稍后重试')
    } finally {
      setSigningSubmitting(false)
    }
  }

  const loadContractFile = (files: FileList | null) => {
    if (!files?.[0]) return
    const file = files[0]
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSigningError('仅支持 JPG、PNG 或 WebP 图片')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setSigningError('图片大小不能超过 4MB')
      return
    }
    setSigningError('')
    const reader = new FileReader()
    reader.onerror = () => setSigningError('图片读取失败，请重新上传')
    reader.onload = e => setContractFile({ url: e.target?.result as string, name: file.name })
    reader.readAsDataURL(file)
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
    52 + (['contacting', 'proposal', 'negotiation', 'signing'].includes(opp.stage) ? 16 : opp.stage === 'signed' || opp.stage === 'delivery' ? 28 : 5)
    + (evidenceFiles.length ? 8 : 0) + (progressReports.length ? 8 : 0) + (days > 7 || opp.lockedPermanently ? 8 : -10)
  ))
  const healthTone = healthScore >= 80 ? 'healthy' : healthScore >= 65 ? 'watch' : healthScore >= 50 ? 'risk' : 'danger'
  const intentLevel = opp.amountRange === 'above50' || opp.amountRange === '20to50' ? '高意向' : opp.amountRange === '10to20' ? '中意向' : '培育中'
  const nextAction = opp.stage === 'reporting' ? '确认关键需求与预算，预约下一轮沟通' : ['contacting', 'proposal'].includes(opp.stage) ? '完善需求方案并推动客户确认' : ['negotiation', 'signing'].includes(opp.stage) ? '推进报价谈判与签约时间' : opp.stage === 'signed' ? '同步交付计划与关键里程碑' : opp.stage === 'delivery' ? '跟进交付验收与客户反馈' : '确认是否重新激活商机'
  const productInterestOptions = ['JM 声访', 'JM 外呼']
  const productInterests = opp.productInterests?.filter(item => productInterestOptions.includes(item)) || [productInterestOptions[0]]
  const productInterest = productInterests.join('、')
  const demandDescription = opp.requirementDescription?.trim() || ''
  const demandDescriptionChars = Array.from(demandDescription)
  const demandDescriptionDisplay = demandDescriptionChars.length > 120 ? `${demandDescriptionChars.slice(0, 120).join('')}…` : demandDescription
  const riskText = !opp.lockedPermanently && days <= 7 ? `保护期仅剩 ${Math.max(days, 0)} 天，需要及时续期或补充进展。` : progressReports.length === 0 ? '尚未沉淀结构化推进记录，建议补充最近沟通结果。' : '当前未识别到高优先级风险。'
  const contactName = !canViewContact ? '无权限查看' : contactLoading ? '解密中…' : decryptedContact?.name || (contactError || contact.encryptedName ? '••••' : '待补充')
  const signedTimelineItem = opp.signedDate && typeof opp.signedAmount === 'number'
    ? [{ id: 'signed-update', at: opp.signedDate, title: '签约信息已确认', body: `签约金额 ${formatSignedAmount(opp.signedAmount)} 万元，签约时间 ${formatDate(opp.signedDate)}${opp.contractNo ? `，合同编号 ${opp.contractNo}` : ''}${opp.contractFileId ? '，已上传签约凭证' : ''}。`, type: 'manual', label: '销售更新' }]
    : []
  const progressTimelineItems = progressReports.map(item => ({ id: item.id, at: item.createdAt, title: `商机进度更新 · ${statusMeta[item.status]?.label || '推进更新'}`, body: item.description, type: item.status === 'blocked' ? 'risk' : 'manual', label: '销售更新' }))
  const salesTimelineItems = [...signedTimelineItem, ...progressTimelineItems, ...(!signedTimelineItem.length && !progressTimelineItems.length ? [{ id: 'stage-update', at: opp.updatedAt, title: '商机进度更新', body: `销售已将商机推进至「${stageName(opp.stage)}」，建议下一步：${nextAction}。`, type: 'manual', label: '销售更新' }] : [])]
  const timelineItems = [
    ...salesTimelineItems,
    { id: 'ai-summary', at: opp.updatedAt, title: 'AI 销售伙伴总结', body: `${opp.customerName}当前处于「${stageName(opp.stage)}」，商机健康度 ${healthScore} 分。${riskText}`, type: 'ai', label: 'AI 总结' },
    { id: 'context', at: opp.reportedAt, title: `${opp.source === 'channel' ? opp.channelName || '渠道报备' : '销售报备'} · 商机上下文`, body: opp.requirementDescription || `${opp.customerName}的商机信息已进入上下文，等待补充具体需求。`, type: 'context', label: '商机上下文' },
  ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()).map(item => ({ ...item, ...timelineStamp(item.at) }))

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
          {canEdit && !['released', 'closed'].includes(opp.stage) && !opp.isFrozen && (
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
                    {(['reporting','contacting','proposal','negotiation','signed','delivery','closed'] as const).filter(s => pipelineOrder[s] >= pipelineOrder[opp.stage]).map(s => (
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
        <div className="sx-health-block">
          <div className={`sx-health-ring ${healthTone}`} style={{ '--score': `${healthScore * 3.6}deg` } as React.CSSProperties}>
            <strong>{healthScore}</strong>
          </div>
          <span>商机健康度 <button className="sx-health-help" aria-label="查看商机健康度评估规则" data-tooltip="综合评估商机阶段、销售推进活跃度、上下文与举证完整度、保护期状态；分数越高，表示商机推进越健康。"><CircleHelp size={13} /></button></span>
        </div>
        <div className="sx-stage-bar" style={{ gridTemplateColumns: `repeat(${displayPipeline.length}, minmax(0, 1fr))` }}>
          {displayPipeline.map((item, index) => {
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
              <div className={`sx-field ${!opp.customerName || !opp.companyName ? 'warn' : ''}`}><label>商机名称</label><strong>{opp.customerName || '待补充'}</strong><small>{opp.companyName || '公司全称待补充'}</small></div>
              <div className="sx-field"><label>产品兴趣</label><strong className="sx-product-tags">{productInterests.map(item => <span key={item}>{item}</span>)}</strong></div>
              <div className={`sx-field ${!opp.amountRange ? 'warn' : ''}`}><label>预算</label><strong>{amountLabel(opp.amountRange)}</strong></div>
              <div className={`sx-field ${!contact.department ? 'warn' : ''}`}><label>需求部门</label><strong>{contact.department || '待补充'}</strong></div>
              <div className="sx-field"><label>商机类型</label><strong>{opp.source === 'channel' ? '渠道商机' : '直客商机'}</strong></div>
              <div className={`sx-field sx-contact-field ${!contact.encryptedName ? 'warn' : ''}`}><div><label>联系人 · {contact.level || '层级待补充'}</label><strong className="with-lock"><Lock size={12} />{contactName}{canViewContact && contact.encryptedName && !decryptedContact && <button className="sx-contact-eye" onClick={() => setShowContactConfirm(true)} disabled={contactLoading} aria-label="查看联系人" title="解密查看联系人"><Eye size={14} /></button>}</strong>{decryptedContact?.contact && <small className="sx-contact-value">{decryptedContact.contact}</small>}{contactError && <small className="sx-contact-error">{contactError}</small>}</div><span className="sx-contact-methods"><i className={contact.contactTypes.includes('wechat') ? 'active' : ''} title="微信"><MessageCircle size={15} /></i><i className={contact.contactTypes.includes('phone') ? 'active' : ''} title="手机号"><Phone size={15} /></i><i className={contact.contactTypes.includes('email') ? 'active' : ''} title="邮箱"><Mail size={15} /></i></span></div>
              <div className={`sx-field wide sx-demand-field ${!demandDescription ? 'warn' : ''}`}><label>需求场景</label><strong>{demandDescriptionDisplay || '待补充，最多支持 120 字'}</strong></div>
            </div>
            {(opp.stage === 'signed' || opp.stage === 'delivery') && opp.signedDate && <div className="sx-signed-strip"><div><span>签约金额</span><strong>{typeof opp.signedAmount === 'number' ? formatSignedAmount(opp.signedAmount) : '—'}<small> 万元</small></strong></div><div><span>签约时间</span><strong>{formatDate(opp.signedDate)}</strong></div><div><span>合同编号</span><strong>{opp.contractNo || '待补充'}</strong></div><div><span>签约凭证</span>{opp.contractFileId ? <button className="sx-contract-proof" onClick={() => setPreviewEvidence({ url: opp.contractFileId!, name: opp.contractNo ? `${opp.contractNo} 签约凭证` : '签约凭证' })}><ImageIcon size={14} />查看图片</button> : <strong>未上传</strong>}</div></div>}
          </article>

          <article className="sx-panel">
            <header className="sx-panel-head sx-progress-head"><div><span>PROCESS TIMELINE</span><h2>商机推进</h2></div><div className="sx-head-actions">{canEdit && !['released', 'closed'].includes(opp.stage) && !opp.isFrozen && <button onClick={() => setShowProgressModal(true)}><FileText size={13} />推进信息补充</button>}<button className={groupSaved && groupConfig.enabled ? 'bound' : ''} onClick={() => setShowGroupInspection(true)}><Users size={13} />商机群巡检{groupSaved ? <em>{groupConfig.enabled ? `已开启 · ${groupConfig.groups.length} 个群` : '已暂停'}</em> : null}</button></div></header>
            <div className="sx-progress-axis">
              {timelineItems.map((item, index) => <div key={item.id} className={`sx-progress-item ${item.type} ${index === 0 ? 'latest' : ''}`}><time><span>{item.date}</span><b>{item.clock}</b></time><i>{index < timelineItems.length - 1 && <span />}</i><div><header><strong>{item.title}</strong><em>{item.label}</em></header><p>{item.body}</p></div></div>)}
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
            <div className="sx-protection-meta"><div><span>销售负责人</span><strong>{opp.salesOwnerName}</strong></div><div><span>报备时间</span><strong>{formatDate(opp.reportedAt)}</strong></div><div><span>来源类型</span><strong>{opp.source === 'channel' ? '渠道伙伴' : '销售自报'}</strong></div><div><span>渠道经理</span><strong>{opp.channelManagerName || '—'}</strong></div></div>
          </article>

          <article className="sx-panel sx-ai-panel">
            <header className="sx-panel-head"><div><span>OPPORTUNITY X-RAY</span><h2>Scale X 商机参谋</h2></div><Sparkles size={18} /></header>
            <section className="hero"><h3>商机解读</h3><p>{opp.customerName}当前处于{stageName(opp.stage)}阶段，{intentLevel}，健康度 {healthScore} 分。</p></section>
            <section><h3>赢单机会</h3><ul><li>{productInterest}与客户当前需求场景匹配。</li><li>预算口径为{amountLabel(opp.amountRange)}。</li></ul></section>
            <section className="risk"><h3>风险提醒</h3><ul><li>{riskText}</li></ul></section>
            <section><h3>下一步行动</h3><ul><li>{nextAction}</li><li>{groupSaved ? '持续关注商机群巡检报告。' : '建议配置商机群巡检，自动沉淀客户上下文。'}</li></ul></section>
            <button className="sx-script-btn" onClick={() => navigate(`/?prompt=${encodeURIComponent(`帮我为${opp.customerName}生成跟进话术`)}`)}><Sparkles size={14} />生成跟进话术</button>
          </article>
        </aside>
      </section>

      {showContactConfirm && <div className="sx-contact-confirm-backdrop" onMouseDown={event => event.target === event.currentTarget && setShowContactConfirm(false)}><section className="sx-contact-confirm"><div className="sx-contact-confirm-icon"><Eye size={20} /></div><h2>确认查看联系人？</h2><p>联系人姓名及联系方式属于敏感信息。确认查看后，本次解密操作将计入审计日志。</p><div><button onClick={() => setShowContactConfirm(false)}>取消</button><button className="primary" onClick={decryptContact}>确认查看</button></div></section></div>}

      {showGroupInspection && <div className="sx-inspection-backdrop" onMouseDown={event => event.target === event.currentTarget && setShowGroupInspection(false)}>
        <section className="sx-inspection-modal">
          <header><div><span className={groupSaved && groupConfig.enabled ? 'active' : groupSaved ? 'paused' : ''}>{groupSaved ? groupConfig.enabled ? '巡检已开启' : '巡检已暂停' : '巡检未配置'}</span><h2>商机群巡检配置</h2><p>自动读取已授权商机群的新消息，提取进展与风险，并生成需要销售确认的维护报告。</p></div><button onClick={() => setShowGroupInspection(false)} aria-label="关闭"><X size={17} /></button></header>
          <div className="sx-inspection-summary"><div><span>关联商机</span><strong>{opp.customerName}</strong></div><div><span>当前状态</span><strong>{groupSaved ? groupConfig.enabled ? `正常巡检 · ${groupConfig.groups.length} 个群` : `已暂停 · ${groupConfig.groups.length} 个群` : '待配置'}</strong></div></div>
          <div className="sx-group-section">
            <div className="sx-group-head"><div><strong>绑定商机群 <b>*</b></strong><p>支持京 ME、飞书、企微、钉钉，可同时绑定多个群聊</p></div><button onClick={() => setGroupConfig(config => ({ ...config, groups: [...config.groups, { channel: '飞书', groupId: '', groupName: '' }] }))}><Plus size={13} />添加商机群</button></div>
            <div className="sx-group-labels"><span>群渠道来源</span><span>群 ID</span><span>群名称</span><span>操作</span></div>
            <div className="sx-group-list">{groupConfig.groups.map((group, index) => <div className="sx-group-row" key={index}><select value={group.channel} onChange={event => setGroupConfig(config => ({ ...config, groups: config.groups.map((item, itemIndex) => itemIndex === index ? { ...item, channel: event.target.value } : item) }))}>{['京 ME','飞书','企微','钉钉'].map(channel => <option key={channel}>{channel}</option>)}</select><input value={group.groupId} placeholder="请输入群 ID" onChange={event => setGroupConfig(config => ({ ...config, groups: config.groups.map((item, itemIndex) => itemIndex === index ? { ...item, groupId: event.target.value } : item) }))} /><input value={group.groupName} placeholder="请输入群名称" onChange={event => setGroupConfig(config => ({ ...config, groups: config.groups.map((item, itemIndex) => itemIndex === index ? { ...item, groupName: event.target.value } : item) }))} /><button disabled={groupConfig.groups.length === 1} onClick={() => setGroupConfig(config => ({ ...config, groups: config.groups.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={13} />移除</button></div>)}</div>
          </div>
          <div className="sx-inspection-grid">
            <label><span>配置状态</span><select value={groupConfig.enabled ? 'enabled' : 'paused'} onChange={event => setGroupConfig(config => ({ ...config, enabled: event.target.value === 'enabled' }))}><option value="enabled">开启巡检</option><option value="paused">暂停巡检</option></select><em>暂停后保留已有配置和历史报告</em></label>
            <label><span>巡检频率</span><select value={groupConfig.frequency} onChange={event => setGroupConfig(config => ({ ...config, frequency: event.target.value }))}>{['每日','工作日','每周一'].map(item => <option key={item}>{item}</option>)}</select><em>按所选周期自动执行</em></label>
            <label><span>巡检时间</span><input type="time" value={groupConfig.time} onChange={event => setGroupConfig(config => ({ ...config, time: event.target.value }))} /><em>采用当前账号所在时区</em></label>
            <label><span>消息范围</span><select value={groupConfig.range} onChange={event => setGroupConfig(config => ({ ...config, range: event.target.value }))}>{['最近 24 小时消息','上次巡检后的新消息','最近 7 天消息'].map(item => <option key={item}>{item}</option>)}</select><em>用于生成本次进展摘要</em></label>
            <label className="wide"><span>巡检输出</span><select value={groupConfig.output} onChange={event => setGroupConfig(config => ({ ...config, output: event.target.value }))}>{['生成商机维护报告','仅生成群消息摘要','生成报告并提醒负责人'].map(item => <option key={item}>{item}</option>)}</select><em>所有字段更新仍需销售确认后生效</em></label>
          </div>
          {groupError && <div className="sx-inspection-error">{groupError}</div>}
          <footer><button className="secondary" onClick={() => setShowGroupInspection(false)}>取消</button><button className="primary" onClick={saveGroupInspection}>保存配置</button></footer>
        </section>
      </div>}

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
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#111111', marginBottom: 6, display: 'block' }}>合同编号</label>
                <input value={signing.contractNo} onChange={e => setSigning(s => ({ ...s, contractNo: e.target.value }))} placeholder="请输入合同编号（选填）" style={{ ...inputStyle, background: 'white', border: '1.5px solid #e5e5e5', borderRadius: 14 }} />
              </div>
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
                  <label htmlFor="contract-file-upload"
                    style={{ height: 100, border: '1.5px dashed #d1d5db', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', background: '#fafafa', color: '#9ca3af', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fafafa')}>
                    <Upload size={20} />
                    <span style={{ fontSize: 13 }}>点击上传截图</span>
                    <small style={{ fontSize: 10 }}>JPG、PNG、WebP，最大 4MB</small>
                  </label>
                )}
                <input id="contract-file-upload" ref={contractFileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                  onChange={e => { loadContractFile(e.target.files); e.target.value = '' }} />
              </div>
            </div>

            {signingError && <div style={{ marginTop: 14, padding: '10px 13px', color: '#b42318', border: '1px solid #fecaca', borderRadius: 10, background: '#fff1f2', fontSize: 12 }}>{signingError}</div>}

            {needsReview && signing.signedAmount !== '' && (
              <div style={{ marginTop: 16, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#d97706', fontWeight: 600 }}>
                ⚠ 签约金额与预算差异超过 20%，提交后将触发审核流程
              </div>
            )}

            {/* 确认签约 button */}
            {(() => {
              const ready = !!signing.signedDate && Number(signing.signedAmount) > 0 && !signingSubmitting
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
                    {signingSubmitting ? '提交中…' : '确认签约'}
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
