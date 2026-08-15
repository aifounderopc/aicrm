import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { stageName, formatDate, daysUntil, amountLabel, validatePassword, passwordStrength, PASSWORD_RULE_HINT, roleName, isAdminRole, canManageChannels, canManageSales, canManageAdmins } from '../utils'
import type { Opportunity } from '../types'
import { Shield, Users, FileText, GitBranch, UserCheck, Bot, BrainCircuit, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Plus, RotateCcw, Save, TestTube2, Trash2 } from 'lucide-react'
import { useMobile } from '../hooks/useMobile'
import { agentApi, type AgentConfiguration, type AgentConfigurationInput, type AgentModelConfiguration } from '../api/agent'
import { ApiError } from '../api/client'

const thStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#6b7280',
  textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(0,0,0,0.06)',
  background: 'rgba(236,248,252,0.55)',
}
const tdStyle: React.CSSProperties = {
  padding: '13px 14px', fontSize: 13, color: '#111111', verticalAlign: 'middle',
  borderBottom: '1px solid rgba(0,0,0,0.05)',
}

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: '1.5px solid #e5e5e5', borderRadius: 10, outline: 'none',
  background: '#fafafa', color: '#111111', boxSizing: 'border-box' as const,
}

const sc: Record<string, { bg: string; text: string }> = {
  reporting: { bg: '#e5e5e5', text: '#111111' },
  signing: { bg: '#fef3c7', text: '#d97706' },
  delivery: { bg: '#e0f2fe', text: '#0369a1' },
  signed: { bg: '#d1fae5', text: '#065f46' },
  released: { bg: '#f3f4f6', text: '#6b7280' },
}

// 密码强度可视化条
function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password)
  const colors = ['#ff6b6b', '#ff6b6b', '#f4a261', '#0e9dbf', '#2ec4b6']
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= score ? colors[score] : '#e5e7eb', transition: 'background 0.2s' }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: score >= 3 ? '#0e7a9a' : '#9ca3af' }}>密码强度：{label}</div>
    </div>
  )
}

function OpportunityMgmt() {
  const { opportunities, releaseOpportunity, approveEvidence, rejectEvidence } = useStore()
  const isMobile = useMobile()
  const [releaseModal, setReleaseModal] = useState<Opportunity | null>(null)
  const [releaseReason, setReleaseReason] = useState('')
  const [rejectModal, setRejectModal] = useState<Opportunity | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [filterStage, setFilterStage] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = filterStage === 'all' ? opportunities : opportunities.filter(o => o.stage === filterStage)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: isMobile ? 4 : 0 }}>
        {['all', 'reporting', 'signing', 'delivery', 'signed', 'released'].map(s => (
          <button key={s} onClick={() => setFilterStage(s)} style={{
            padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, flexShrink: 0,
            background: filterStage === s ? 'linear-gradient(135deg, #111111, #444444)' : 'rgba(255,255,255,0.85)',
            color: filterStage === s ? 'white' : '#4b5563',
            boxShadow: filterStage === s ? '0 3px 8px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.07)',
          }}>
            {s === 'all' ? '全部' : stageName(s)} ({s === 'all' ? opportunities.length : opportunities.filter(o => o.stage === s).length})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(opp => {
          const c = sc[opp.stage] || sc.released
          const days = daysUntil(opp.releaseAt)
          const isExpanded = expandedId === opp.id
          return (
            <div key={opp.id} style={{
              background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
              borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 2px 16px rgba(80,140,160,0.08)',
              border: opp.isFrozen ? '1.5px solid #fecaca' : '1px solid rgba(255,255,255,0.9)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, padding: isMobile ? '12px 14px' : '14px 20px', cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : opp.id)}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, color: c.text,
                }}>
                  {opp.customerName[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>
                    {opp.customerName}
                    {opp.isFrozen && <span style={{ marginLeft: 8, fontSize: 11, color: '#ff6b6b', background: '#fff1f1', padding: '2px 8px', borderRadius: 8 }}>已冻结</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {opp.industry} · {amountLabel(opp.amountRange)}
                    {!isMobile && ` · 负责人：${opp.salesOwnerName}`}
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: c.bg, color: c.text, fontWeight: 600, flexShrink: 0 }}>
                  {stageName(opp.stage)}
                </span>
                {!isMobile && (
                  <div style={{ fontSize: 12, color: opp.lockedPermanently ? '#2ec4b6' : days <= 3 ? '#ff6b6b' : '#6b7280', fontWeight: 600, flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
                    {opp.stage === 'released' ? '—' : opp.lockedPermanently ? '持续' : `${days}天`}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {opp.stage !== 'released' && (
                    <button onClick={() => { setReleaseModal(opp); setReleaseReason('') }} style={{
                      fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none',
                      background: '#fff1f1', color: '#e05555', cursor: 'pointer', fontWeight: 600,
                    }}>释放</button>
                  )}
                  {opp.isFrozen ? (
                    <button onClick={() => approveEvidence(opp.id)} style={{
                      fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none',
                      background: '#d1fae5', color: '#065f46', cursor: 'pointer', fontWeight: 600,
                    }}>解冻</button>
                  ) : opp.stage !== 'released' && (
                    <button onClick={() => { setRejectModal(opp); setRejectReason('') }} style={{
                      fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none',
                      background: '#fff8f0', color: '#d97706', cursor: 'pointer', fontWeight: 600,
                    }}>驳回</button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ background: '#fafafa', borderTop: '1px solid #efefef', padding: isMobile ? '12px 14px' : '14px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 10, fontSize: 13 }}>
                    <div><span style={{ color: '#6b7280' }}>联系人：</span><span style={{ fontWeight: 600, color: '#111111' }}>{opp.contact.encryptedName || '—'}</span></div>
                    <div><span style={{ color: '#6b7280' }}>联系方式：</span><span style={{ fontWeight: 600, color: '#111111' }}>{opp.contact.encryptedContact || '—'}</span></div>
                    <div><span style={{ color: '#6b7280' }}>首次接触：</span><span style={{ color: '#111111' }}>{formatDate(opp.firstContactDate)}</span></div>
                    <div><span style={{ color: '#6b7280' }}>报备时间：</span><span style={{ color: '#111111' }}>{formatDate(opp.reportedAt)}</span></div>
                    <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#6b7280' }}>需求：</span><span style={{ color: '#111111' }}>{opp.requirementDescription}</span></div>
                    {opp.releaseReason && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#6b7280' }}>释放原因：</span><span style={{ color: '#e05555' }}>{opp.releaseReason}</span></div>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {releaseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: isMobile ? '20px 20px 0 0' : 20, padding: '28px', width: isMobile ? '100%' : 400, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111111', marginBottom: 6 }}>确认释放商机</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>客户：{releaseModal.customerName}</div>
            <textarea value={releaseReason} onChange={e => setReleaseReason(e.target.value)}
              placeholder="请填写释放原因（必填）" rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setReleaseModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', fontSize: 13, color: '#4b5563' }}>取消</button>
              <button disabled={!releaseReason.trim()} onClick={() => { releaseOpportunity(releaseModal.id, releaseReason); setReleaseModal(null) }}
                style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: '#ff6b6b', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: releaseReason.trim() ? 1 : 0.5 }}>
                确认释放
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: isMobile ? '20px 20px 0 0' : 20, padding: '28px', width: isMobile ? '100%' : 400, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111111', marginBottom: 6 }}>驳回举证</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>商机将被释放：{rejectModal.customerName}</div>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="驳回原因（必填）" rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRejectModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', fontSize: 13, color: '#4b5563' }}>取消</button>
              <button disabled={!rejectReason.trim()} onClick={() => { rejectEvidence(rejectModal.id, rejectReason); setRejectModal(null) }}
                style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: '#f4a261', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: rejectReason.trim() ? 1 : 0.5 }}>
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────
function DeleteConfirm({
  title, desc, blocked, blockedMsg, onConfirm, onClose,
}: {
  title: string; desc: string; blocked: boolean; blockedMsg: string
  onConfirm: () => void; onClose: () => void
}) {
  const isMobile = useMobile()
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 70, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '22px 22px 0 0' : 20, padding: '28px 28px 24px', width: isMobile ? '100%' : 400, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111111', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
          {blocked ? <span style={{ color: '#e05555' }}>{blockedMsg}</span> : desc}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', fontSize: 13, color: '#4b5563' }}>取消</button>
          {!blocked && (
            <button onClick={() => { onConfirm(); onClose() }} style={{ flex: 1, padding: '10px', borderRadius: 12, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>确认删除</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Account modal (create or edit) ──────────────────────────────────────────
type AccountModalMode =
  | { type: 'create_with_channel' }           // 新建渠道时同步建账号
  | { type: 'add_to_channel'; channelId: string; channelName: string }  // 为已有渠道补建账号
  | { type: 'edit'; userId: string; channelName: string }               // 编辑已有账号

function AccountModal({
  mode,
  onClose,
  prefillEmail,
  nameField,
  title: titleOverride,
}: {
  mode: AccountModalMode
  onClose: (result?: { name: string; email: string; password: string }) => void
  prefillEmail?: string
  nameField?: { label: string; placeholder: string; value?: string }
  title?: string
}) {
  const { createChannelAccount, updateChannelAccount, users } = useStore()
  const [form, setForm] = useState(() => {
    if (mode.type === 'edit') {
      const u = users.find(u => u.id === mode.userId)
      return { name: u?.name || '', email: u?.email || '', password: '', confirmPassword: '' }
    }
    return { name: nameField?.value || '', email: prefillEmail || '', password: '', confirmPassword: '' }
  })
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')

  const isEdit = mode.type === 'edit'
  const title = titleOverride ?? (isEdit ? '编辑账号信息' : mode.type === 'create_with_channel' ? '同时创建登录账号' : `补建账号 · ${(mode as { type: 'add_to_channel'; channelName: string }).channelName}`)

  const validate = () => {
    if (nameField && !form.name.trim()) return `请输入${nameField.label}`
    if (!form.email.trim() || !form.email.includes('@')) return '请输入有效邮箱'
    if (!isEdit && !form.password) return '请输入密码'
    if (form.password) {
      const pv = validatePassword(form.password)
      if (!pv.valid) return pv.error!
    }
    if (form.password && form.password !== form.confirmPassword) return '两次密码不一致'
    return ''
  }

  const submit = () => {
    const err = validate()
    if (err) { setError(err); return }

    if (mode.type === 'create_with_channel') {
      onClose({ name: form.name || form.email, email: form.email, password: form.password })
      return
    }
    if (mode.type === 'add_to_channel') {
      const result = createChannelAccount(mode.channelId, { name: form.email, email: form.email, password: form.password })
      if (!result.success) { setError(result.error || '操作失败'); return }
      onClose()
      return
    }
    if (mode.type === 'edit') {
      const updates: Record<string, string> = { email: form.email }
      if (form.password) updates.password = form.password
      const result = updateChannelAccount(mode.userId, updates)
      if (!result.success) { setError(result.error || '操作失败'); return }
      onClose()
    }
  }

  const isMobile = useMobile()
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '22px 22px 0 0' : 22, padding: '28px 32px', width: isMobile ? '100%' : 440, maxHeight: isMobile ? '92vh' : 'none', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111111' }}>{title}</div>
            {!isEdit && mode.type !== 'create_with_channel' && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>账号创建后即可登录系统</div>
            )}
          </div>
          <button onClick={() => onClose()} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f5f4fb', cursor: 'pointer', color: '#6b7280', fontSize: 15 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {nameField && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>{nameField.label} *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={nameField.placeholder} style={inputStyle} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>登录邮箱 *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="example@company.com" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
              {isEdit ? '新密码（留空则不修改）' : '登录密码 *'}
              <button onClick={() => setShowPwd(v => !v)} style={{ fontSize: 11, color: '#111111', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                {showPwd ? '隐藏' : '显示'}
              </button>
            </label>
            <input type={showPwd ? 'text' : 'password'} value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? '留空则不修改密码' : PASSWORD_RULE_HINT}
              style={inputStyle} />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{PASSWORD_RULE_HINT}</div>
          </div>
          {form.password && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>确认密码 *</label>
              <input type={showPwd ? 'text' : 'password'} value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="再次输入密码" style={{
                  ...inputStyle,
                  borderColor: form.confirmPassword && form.confirmPassword !== form.password ? '#fca5a5' : '#e5e5e5',
                }} />
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <div style={{ fontSize: 11, color: '#e05555', marginTop: 3 }}>两次密码不一致</div>
              )}
            </div>
          )}

          {/* Password strength indicator */}
          {form.password && <StrengthMeter password={form.password} />}

          {error && (
            <div style={{ background: '#fff1f1', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#e05555' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={() => onClose()} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', fontSize: 13, color: '#4b5563' }}>取消</button>
          <button onClick={submit} style={{
            flex: 2, padding: '11px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #111111, #444444)',
            color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            {isEdit ? '保存修改' : '创建账号'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Channel edit modal (channel info + account) ──────────────────────────────
function ChannelEditModal({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const { channels, users, updateChannel, updateChannelAccount } = useStore()
  const isMobile = useMobile()
  const channel = channels.find(c => c.id === channelId)!
  const account = users.find(u => u.channelId === channelId && u.role === 'channel' && !u.isJdManager)
  const jdAccount = users.find(u => u.channelId === channelId && u.role === 'channel' && u.isJdManager)

  const [form, setForm] = useState({
    name: channel.name, fullName: channel.fullName || '', contactName: channel.contactName,
    jdManagerName: channel.jdManagerName || '',
    email: account?.email || '', password: '', confirmPassword: '',
    jdEmail: jdAccount?.email || '', jdPassword: '', jdConfirmPassword: '',
  })
  const [showPwd, setShowPwd] = useState(false)
  const [showJdPwd, setShowJdPwd] = useState(false)
  const [error, setError] = useState('')

  const submit = () => {
    if (!form.name.trim() || !form.fullName.trim() || !form.contactName.trim()) { setError('渠道名称、公司全称、联系人均为必填'); return }
    if (account && (!form.email.trim() || !form.email.includes('@'))) { setError('请输入有效的渠道登录邮箱'); return }
    if (form.password) {
      const pv = validatePassword(form.password)
      if (!pv.valid) { setError(pv.error!); return }
      if (form.password !== form.confirmPassword) { setError('两次密码不一致'); return }
    }
    if (jdAccount && (!form.jdEmail.trim() || !form.jdEmail.includes('@'))) { setError('请输入有效的京东渠道经理登录邮箱'); return }
    if (form.jdPassword) {
      const pv = validatePassword(form.jdPassword)
      if (!pv.valid) { setError('京东渠道经理密码：' + pv.error!); return }
      if (form.jdPassword !== form.jdConfirmPassword) { setError('京东渠道经理两次密码不一致'); return }
    }
    const r1 = updateChannel(channelId, { name: form.name, fullName: form.fullName || undefined, contactName: form.contactName, jdManagerName: form.jdManagerName || undefined })
    if (!r1.success) { setError(r1.error || '操作失败'); return }
    if (account) {
      const updates: Record<string, string> = { email: form.email }
      if (form.password) updates.password = form.password
      const r2 = updateChannelAccount(account.id, updates)
      if (!r2.success) { setError(r2.error || '操作失败'); return }
    }
    if (jdAccount) {
      const updates: Record<string, string> = { email: form.jdEmail }
      if (form.jdPassword) updates.password = form.jdPassword
      const r3 = updateChannelAccount(jdAccount.id, updates)
      if (!r3.success) { setError(r3.error || '操作失败'); return }
    }
    onClose()
  }

  const field = (label: string, key: 'name' | 'fullName' | 'contactName' | 'jdManagerName' | 'email', placeholder?: string) => (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>{label}</label>
      <input value={form[key]} onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setError('') }} placeholder={placeholder} style={inputStyle} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: isMobile ? 0 : '40px 20px', boxSizing: 'border-box' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '22px 22px 0 0' : 22, padding: '28px 32px', width: isMobile ? '100%' : 560, maxHeight: isMobile ? '92vh' : '100%', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111111' }}>编辑渠道 · {channel.name}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f5f5f5', cursor: 'pointer', color: '#6b7280', fontSize: 15 }}>✕</button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>渠道信息</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {field('渠道名称（简称）*', 'name')}
          {field('渠道伙伴公司全称 *', 'fullName', '如：杭州小能科技有限公司')}
          {field('渠道联系人 *', 'contactName')}
          {field('京东渠道经理', 'jdManagerName', '如：王经理')}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>渠道登录账号</div>
        {account ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {field('登录邮箱 *', 'email')}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
                新密码（留空则不修改）
                <button onClick={() => setShowPwd(v => !v)} style={{ fontSize: 11, color: '#111111', background: 'none', border: 'none', cursor: 'pointer' }}>{showPwd ? '隐藏' : '显示'}</button>
              </label>
              <input type={showPwd ? 'text' : 'password'} value={form.password}
                onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError('') }}
                placeholder={PASSWORD_RULE_HINT} style={inputStyle} />
            </div>
            {form.password && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>确认密码</label>
                <input type={showPwd ? 'text' : 'password'} value={form.confirmPassword}
                  onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="再次输入密码" style={{ ...inputStyle, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? '#fca5a5' : '#e5e5e5' }} />
              </div>
            )}
            {form.password && <StrengthMeter password={form.password} />}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>该渠道暂无登录账号</div>
        )}

        {/* 京东渠道经理账号 */}
        {jdAccount && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1657c8', margin: '20px 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>京东渠道经理账号</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>登录邮箱 *</label>
                <input value={form.jdEmail} onChange={e => { setForm(f => ({ ...f, jdEmail: e.target.value })); setError('') }} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
                  新密码（留空则不修改）
                  <button onClick={() => setShowJdPwd(v => !v)} style={{ fontSize: 11, color: '#111111', background: 'none', border: 'none', cursor: 'pointer' }}>{showJdPwd ? '隐藏' : '显示'}</button>
                </label>
                <input type={showJdPwd ? 'text' : 'password'} value={form.jdPassword}
                  onChange={e => { setForm(f => ({ ...f, jdPassword: e.target.value })); setError('') }}
                  placeholder={PASSWORD_RULE_HINT} style={inputStyle} />
              </div>
              {form.jdPassword && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>确认密码</label>
                  <input type={showJdPwd ? 'text' : 'password'} value={form.jdConfirmPassword}
                    onChange={e => setForm(f => ({ ...f, jdConfirmPassword: e.target.value }))}
                    placeholder="再次输入密码" style={{ ...inputStyle, borderColor: form.jdConfirmPassword && form.jdConfirmPassword !== form.jdPassword ? '#fca5a5' : '#e5e5e5' }} />
                </div>
              )}
              {form.jdPassword && <StrengthMeter password={form.jdPassword} />}
            </div>
          </>
        )}

        {error && (
          <div style={{ marginTop: 14, background: '#fff1f1', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#e05555' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', fontSize: 13, color: '#4b5563' }}>取消</button>
          <button onClick={submit} style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #111111, #444444)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>保存修改</button>
        </div>
      </div>
    </div>
  )
}

// ─── New channel form ─────────────────────────────────────────────────────────
function NewChannelForm({ onClose }: { onClose: () => void }) {
  const isMobile = useMobile()
  const { addChannel } = useStore()
  const [channelForm, setChannelForm] = useState({ name: '', fullName: '' })
  const [createAccount, setCreateAccount] = useState(true)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [accountDraft, setAccountDraft] = useState<{ name: string; email: string; password: string } | null>(null)
  // 京东渠道经理独立登录账号（必须启用）
  const createJdAccount = true
  const [showJdModal, setShowJdModal] = useState(false)
  const [jdDraft, setJdDraft] = useState<{ name: string; email: string; password: string } | null>(null)

  const canSubmit = channelForm.name.trim() && channelForm.fullName.trim()

  const handleSubmit = () => {
    if (!canSubmit) return
    if (createAccount && !accountDraft) { setShowAccountModal(true); return }
    if (createJdAccount && !jdDraft) { setShowJdModal(true); return }
    addChannel(
      {
        name: channelForm.name, fullName: channelForm.fullName || undefined,
        contactName: accountDraft?.name || '', email: accountDraft?.email || '', phone: '', status: 'active',
        jdManagerName: jdDraft?.name || undefined,
      },
      accountDraft || undefined,
      jdDraft || undefined,
    )
    onClose()
  }

  const handleAccountSet = (result?: { name: string; email: string; password: string }) => {
    setShowAccountModal(false)
    if (result) setAccountDraft(result)
  }
  const handleJdSet = (result?: { name: string; email: string; password: string }) => {
    setShowJdModal(false)
    if (result) setJdDraft(result)
  }

  return (
    <>
      <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', borderRadius: 18, padding: '22px 24px', marginBottom: 16, boxShadow: '0 2px 16px rgba(80,140,160,0.08)', border: '1px solid rgba(255,255,255,0.9)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111111', marginBottom: 16 }}>新增渠道伙伴</div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {([['渠道名称（简称）*', 'name', '如：小能科技'], ['渠道伙伴公司全称 *', 'fullName', '如：杭州小能科技有限公司']] as const).map(([label, key, ph]) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: '#4b5563', marginBottom: 4, display: 'block', fontWeight: 600 }}>{label}</label>
              <input value={channelForm[key]} onChange={e => setChannelForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={ph} style={inputStyle} />
            </div>
          ))}
        </div>

        {/* Account creation toggle */}
        <div style={{ background: createAccount ? '#f9f9f9' : '#f9f9fb', borderRadius: 14, padding: '14px 16px', marginBottom: 16, border: `1.5px solid ${createAccount ? '#d1d5db' : '#e5e5e5'}` }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: createAccount ? 12 : 0 }}>
            <div onClick={() => { setCreateAccount(v => !v); setAccountDraft(null) }} style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
              background: createAccount ? 'linear-gradient(90deg,#111111,#444444)' : '#d1d5db',
              transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{ position: 'absolute', top: 2, left: createAccount ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>同时创建系统登录账号</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>渠道伙伴凭此账号登录 CRM 报备和查看商机</div>
            </div>
          </label>

          {createAccount && (
            <div style={{ paddingTop: 12, borderTop: '1px solid #e5e5e5' }}>
              {accountDraft ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                      @
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>{accountDraft.name}<span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>{accountDraft.email}</span></div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>密码已设置</div>
                    </div>
                  </div>
                  <button onClick={() => setShowAccountModal(true)} style={{ fontSize: 12, color: '#111111', background: '#e5e5e5', border: 'none', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>修改</button>
                </div>
              ) : (
                <button onClick={() => setShowAccountModal(true)} style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  border: '1.5px dashed #d1d5db', background: 'rgba(0,0,0,0.04)',
                  color: '#111111', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>+ 填写账号信息（邮箱 + 密码）</button>
              )}
            </div>
          )}
        </div>

        {/* JD channel manager account — 必填 */}
        <div style={{ background: '#f7faff', borderRadius: 14, padding: '14px 16px', marginBottom: 16, border: '1.5px solid #bfd4f5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#1657c8,#2e80f0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>京</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', display: 'flex', alignItems: 'center', gap: 6 }}>
                京东渠道经理独立登录账号
                <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: 'rgba(220,38,38,0.1)', padding: '1px 7px', borderRadius: 6 }}>必填</span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>京东渠道经理凭独立账号登录，与渠道伙伴账号分开管理同一渠道商机</div>
            </div>
          </div>

          {createJdAccount && (
            <div style={{ paddingTop: 12, borderTop: '1px solid #e5e9f0' }}>
              {jdDraft ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1657c8' }}>京</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>{jdDraft.name}<span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>{jdDraft.email}</span></div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>密码已设置</div>
                    </div>
                  </div>
                  <button onClick={() => setShowJdModal(true)} style={{ fontSize: 12, color: '#1657c8', background: '#dbeafe', border: 'none', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>修改</button>
                </div>
              ) : (
                <button onClick={() => setShowJdModal(true)} style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  border: '1.5px dashed #bfd4f5', background: 'rgba(22,87,200,0.04)',
                  color: '#1657c8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>+ 填写京东渠道经理账号（邮箱 + 密码）</button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', fontSize: 13, color: '#4b5563' }}>取消</button>
          <button onClick={handleSubmit} disabled={!canSubmit || (createAccount && !accountDraft) || (createJdAccount && !jdDraft)} style={{
            flex: 1, padding: '10px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #111111, #444444)',
            color: 'white', cursor: canSubmit && (!createAccount || accountDraft) && (!createJdAccount || jdDraft) ? 'pointer' : 'not-allowed',
            fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            opacity: canSubmit && (!createAccount || accountDraft) && (!createJdAccount || jdDraft) ? 1 : 0.5,
          }}>
            {createAccount && !accountDraft ? '请先填写渠道账号' : createJdAccount && !jdDraft ? '请先填写京东渠道经理账号' : '确认添加'}
          </button>
        </div>
      </div>

      {showAccountModal && (
        <AccountModal
          mode={{ type: 'create_with_channel' }}
          title="渠道伙伴登录账号"
          nameField={{ label: '渠道联系人', placeholder: '如：张三', value: accountDraft?.name }}
          onClose={handleAccountSet}
        />
      )}
      {showJdModal && (
        <AccountModal
          mode={{ type: 'create_with_channel' }}
          title="京东渠道经理账号"
          nameField={{ label: '京东渠道经理', placeholder: '如：王经理', value: jdDraft?.name }}
          onClose={handleJdSet}
        />
      )}
    </>
  )
}

// ─── Channel management main ──────────────────────────────────────────────────
function ChannelMgmt({ desc }: { desc: string }) {
  const { channels, opportunities, users, toggleChannel, deleteChannel, switchUser } = useStore()
  const navigate = useNavigate()
  const proxyAccess = async (id: string) => { const r = await switchUser(id); if (r.success) navigate('/') }
  const isMobile = useMobile()
  const [showAdd, setShowAdd] = useState(false)
  const [addAccountFor, setAddAccountFor] = useState<{ channelId: string; channelName: string } | null>(null)
  const [editAccount, setEditAccount] = useState<{ userId: string; channelName: string } | null>(null)
  const [editChannelId, setEditChannelId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const stats = channels.map(c => {
    const opps = opportunities.filter(o => o.channelId === c.id)
    const signed = opps.filter(o => o.stage === 'signed')
    const linkedUser = users.find(u => u.channelId === c.id && u.role === 'channel' && !u.isJdManager)
    const jdUser = users.find(u => u.channelId === c.id && u.role === 'channel' && u.isJdManager)
    return { ...c, total: opps.length, signed: signed.length, rate: opps.length ? Math.round(signed.length / opps.length * 100) : 0, linkedUser, jdUser }
  })


  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>{desc}</p>
        <button onClick={() => setShowAdd(v => !v)} style={{
          background: showAdd ? '#f5f5f5' : 'linear-gradient(135deg, #111111, #444444)',
          color: showAdd ? '#111111' : 'white',
          border: showAdd ? '1.5px solid #e5e5e5' : 'none',
          padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', boxShadow: showAdd ? 'none' : '0 4px 10px rgba(0,0,0,0.3)', flexShrink: 0,
        }}>
          {showAdd ? '收起' : '+ 新增渠道'}
        </button>
      </div>

      {showAdd && <NewChannelForm onClose={() => setShowAdd(false)} />}

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', borderRadius: 16, boxShadow: '0 2px 16px rgba(80,140,160,0.08)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.9)' }}>
        {!isMobile ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>渠道名称</th>
                <th style={thStyle}>渠道联系人 &amp; 账号</th>
                <th style={thStyle}>京东渠道经理 &amp; 账号</th>
                <th style={thStyle}>签约 / 报备</th>
                <th style={thStyle}>转化率</th>
                <th style={thStyle}>状态</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(c => {
                const u = c.linkedUser
                const isExpanded = expandedId === c.id
                return (
                  <>
                    <tr key={c.id}
                      onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = '#fafafa' }}
                      onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: c.status === 'active' ? '#9ca3af' : '#d1d5db', flexShrink: 0 }}>
                            {c.name[0]}
                          </div>
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                        </div>
                      </td>
                      {/* 渠道联系人 & 账号 */}
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: '#111111' }}>{c.contactName || '—'}</div>
                        {c.linkedUser ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.linkedUser.disabled ? '#d1d5db' : '#10b981', flexShrink: 0 }} />
                            <span style={{ fontSize: 11.5, color: c.linkedUser.disabled ? '#9ca3af' : '#6b7280' }}>{c.linkedUser.email}</span>
                          </div>
                        ) : (
                          <span style={{ display: 'inline-block', marginTop: 3, fontSize: 11, color: '#f59e0b', background: '#fef3c7', padding: '1px 8px', borderRadius: 6, fontWeight: 600 }}>未建账号</span>
                        )}
                      </td>
                      {/* 京东渠道经理 & 账号 */}
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: '#111111' }}>{c.jdManagerName || '—'}</div>
                        {c.jdUser ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.jdUser.disabled ? '#d1d5db' : '#1657c8', flexShrink: 0 }} />
                            <span style={{ fontSize: 11.5, color: c.jdUser.disabled ? '#9ca3af' : '#6b7280' }}>{c.jdUser.email}</span>
                          </div>
                        ) : (
                          <span style={{ display: 'inline-block', marginTop: 3, fontSize: 11, color: '#9ca3af' }}>未开通账号</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 700, color: '#059669' }}>{c.signed}</span>
                        <span style={{ color: '#6b7280', margin: '0 4px' }}>/</span>
                        <span style={{ fontWeight: 700 }}>{c.total}</span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 56, height: 4, background: '#e5e5e5', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#111111', borderRadius: 2, width: `${c.rate}%` }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{c.rate}%</span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, background: c.status === 'active' ? '#d1fae5' : '#f3f4f6', color: c.status === 'active' ? '#065f46' : '#6b7280' }}>
                          {c.status === 'active' ? '启用' : '停用'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => u && proxyAccess(u.id)} disabled={!u || u.disabled}
                            title={u ? '以该渠道账号身份访问系统' : '该渠道暂无登录账号'}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid rgba(14,120,160,0.25)', background: 'rgba(14,157,191,0.06)', color: (!u || u.disabled) ? '#c4c4c4' : '#0e7a9a', cursor: (!u || u.disabled) ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                            <UserCheck size={12} /> 代理访问
                          </button>
                          <button onClick={() => setExpandedId(isExpanded ? null : c.id)}
                            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e5e5', background: isExpanded ? '#e5e5e5' : 'white', color: '#111111', cursor: 'pointer', fontWeight: 600 }}>
                            {isExpanded ? '收起' : '详情'}
                          </button>
                          <button onClick={() => setEditChannelId(c.id)}
                            title="编辑渠道信息及登录账号"
                            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e5e5', background: 'white', color: '#111111', cursor: 'pointer', fontWeight: 600 }}>
                            编辑
                          </button>
                          <button onClick={() => toggleChannel(c.id)}
                            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: c.status === 'active' ? '#fff1f1' : '#d1fae5', color: c.status === 'active' ? '#e05555' : '#065f46' }}>
                            {c.status === 'active' ? '停用' : '启用'}
                          </button>
                          <button onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={c.id + '-exp'}>
                        <td colSpan={7} style={{ padding: '14px 20px', background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                            {/* Account block */}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>登录账号</div>
                              {u ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <div style={{ width: 34, height: 34, borderRadius: 10, background: u.disabled ? '#f3f4f6' : 'linear-gradient(135deg, #1f2937, #4b5563)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: u.disabled ? '#aaa' : 'white', flexShrink: 0 }}>
                                    {u.name[0]}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111111' }}>{u.name}</div>
                                    <div style={{ fontSize: 12, color: '#6b7280' }}>{u.email} · 创建于 {u.createdAt ? u.createdAt.slice(0, 10) : '—'}</div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff8f0', borderRadius: 10, padding: '10px 14px', border: '1.5px dashed #fed7aa' }}>
                                  <span style={{ fontSize: 13, color: '#d97706', fontWeight: 600 }}>暂无登录账号</span>
                                  <button onClick={() => setAddAccountFor({ channelId: c.id, channelName: c.name })}
                                    style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: 'none', background: '#f59e0b', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                    + 补建账号
                                  </button>
                                </div>
                              )}
                            </div>
                            {/* Detail block */}
                            <div style={{ minWidth: 200, fontSize: 12, color: '#374151' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>渠道信息</div>
                              {[['公司全称', c.fullName || '—'], ['加入时间', c.createdAt.slice(0, 10)], ['京东渠道经理', c.jdManagerName || '—']].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', gap: 8, padding: '3px 0' }}>
                                  <span style={{ color: '#9ca3af', minWidth: 80 }}>{k}</span>
                                  <span style={{ fontWeight: 500 }}>{v}</span>
                                </div>
                              ))}
                              {/* 京东渠道经理登录账号 */}
                              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e5e9f0' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>京东渠道经理账号</div>
                                {c.jdUser ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 24, height: 24, borderRadius: 7, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1657c8', flexShrink: 0 }}>京</span>
                                    <span style={{ fontSize: 12, color: c.jdUser.disabled ? '#9ca3af' : '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.jdUser.name} · {c.jdUser.email}</span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 12, color: '#9ca3af' }}>未开通独立登录账号</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {stats.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>暂无渠道数据</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          /* Mobile: simple rows */
          <div>
            {stats.map(c => {
              const u = c.linkedUser
              return (
                <div key={c.id} style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#374151', flexShrink: 0 }}>
                      {c.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{c.contactName}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, background: c.status === 'active' ? '#d1fae5' : '#f3f4f6', color: c.status === 'active' ? '#065f46' : '#6b7280' }}>
                      {c.status === 'active' ? '启用' : '停用'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    {u && !u.disabled && (
                      <button onClick={() => proxyAccess(u.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid rgba(14,120,160,0.25)', background: 'rgba(14,157,191,0.06)', color: '#0e7a9a', cursor: 'pointer', fontWeight: 600 }}>
                        <UserCheck size={12} /> 代理
                      </button>
                    )}
                    {!u && (
                      <button onClick={() => setAddAccountFor({ channelId: c.id, channelName: c.name })}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', background: '#fef3c7', color: '#d97706', cursor: 'pointer', fontWeight: 600 }}>补建账号</button>
                    )}
                    <button onClick={() => toggleChannel(c.id)}
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: c.status === 'active' ? '#fff1f1' : '#d1fae5', color: c.status === 'active' ? '#e05555' : '#065f46' }}>
                      {c.status === 'active' ? '停用' : '启用'}
                    </button>
                  </div>
                </div>
              )
            })}
            {stats.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>暂无渠道数据</div>
            )}
          </div>
        )}
      </div>

      {addAccountFor && (
        <AccountModal
          mode={{ type: 'add_to_channel', channelId: addAccountFor.channelId, channelName: addAccountFor.channelName }}
          onClose={() => setAddAccountFor(null)}
        />
      )}
      {editAccount && (
        <AccountModal
          mode={{ type: 'edit', userId: editAccount.userId, channelName: editAccount.channelName }}
          onClose={() => setEditAccount(null)}
        />
      )}
      {editChannelId && (
        <ChannelEditModal channelId={editChannelId} onClose={() => setEditChannelId(null)} />
      )}
      {deleteTarget && (() => {
        const hasData = opportunities.some(o => o.channelId === deleteTarget.id)
        return (
          <DeleteConfirm
            title={`删除渠道「${deleteTarget.name}」`}
            desc="删除后该渠道及其登录账号将被移除，此操作不可恢复。"
            blocked={hasData}
            blockedMsg="该渠道已有关联商机数据，无法删除。"
            onConfirm={() => deleteChannel(deleteTarget.id)}
            onClose={() => setDeleteTarget(null)}
          />
        )
      })()}
    </div>
  )
}

// ─── User modal (sales / admin) ──────────────────────────────────────────────
function UserModal({
  role,
  editUser,
  onClose,
}: {
  role: 'sales' | 'admin'
  editUser?: { id: string; name: string; email: string; group?: string }
  onClose: () => void
}) {
  const { createUser, updateUser, users } = useStore()
  const isMobile = useMobile()
  const isEdit = !!editUser
  const [form, setForm] = useState({
    name: editUser?.name || '',
    email: editUser?.email || '',
    group: editUser?.group || '',
    password: '',
    confirmPassword: '',
  })
  // 新增管理员时可选具体管理角色
  const [adminRole, setAdminRole] = useState<'admin' | 'channel_admin' | 'sales_admin'>('channel_admin')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')

  const emailTaken = !isEdit && form.email && users.some(u => u.email === form.email)

  const submit = () => {
    if (!form.name.trim()) { setError('请输入姓名'); return }
    if (!form.email.trim() || !form.email.includes('@')) { setError('请输入有效邮箱'); return }
    if (!isEdit && !form.password) { setError('请设置登录密码'); return }
    if (form.password) {
      const pv = validatePassword(form.password)
      if (!pv.valid) { setError(pv.error!); return }
    }
    if (form.password && form.password !== form.confirmPassword) { setError('两次密码不一致'); return }
    if (emailTaken) { setError('该邮箱已被使用'); return }

    if (isEdit) {
      const updates: Record<string, string> = { name: form.name, email: form.email, group: form.group }
      if (form.password) updates.password = form.password
      const result = updateUser(editUser!.id, updates)
      if (!result.success) { setError(result.error || '操作失败'); return }
      onClose()
    } else {
      const finalRole = role === 'admin' ? adminRole : role
      const result = createUser({ name: form.name, email: form.email, password: form.password, role: finalRole, group: form.group || undefined })
      if (!result.success) { setError(result.error || '操作失败'); return }
      onClose()
    }
  }

  const roleLabel = role === 'sales' ? '直客销售' : '管理员'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'white', borderRadius: isMobile ? '22px 22px 0 0' : 22, padding: '28px 32px', width: isMobile ? '100%' : 440, maxHeight: isMobile ? '92vh' : 'none', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111111' }}>{isEdit ? `编辑${roleLabel}账号` : `新增${roleLabel}`}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f5f5f5', cursor: 'pointer', color: '#6b7280', fontSize: 15 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>姓名 *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="真实姓名" style={inputStyle} />
          </div>
          {/* 管理角色选择（仅新增管理员时） */}
          {role === 'admin' && !isEdit && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 6, display: 'block' }}>管理角色 *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  ['channel_admin', '渠道管理员', '可管理 / 创建 / 代理访问所有渠道账号'],
                  ['sales_admin', '直客销售管理员', '可管理 / 创建 / 代理访问所有直客销售账号'],
                  ['admin', '超级管理员', '拥有全局最大权限，可管理所有账号与设置'],
                ] as const).map(([val, label, hint]) => {
                  const active = adminRole === val
                  return (
                    <label key={val} onClick={() => setAdminRole(val)} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', borderRadius: 12, cursor: 'pointer',
                      border: `1.5px solid ${active ? '#0e9dbf' : '#e5e5e5'}`,
                      background: active ? 'rgba(14,157,191,0.06)' : 'white', transition: 'all 0.15s',
                    }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        border: `2px solid ${active ? '#0e9dbf' : '#cbd5e1'}`,
                        background: active ? '#0e9dbf' : 'white',
                        boxShadow: active ? 'inset 0 0 0 2.5px white' : 'none',
                      }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#0a4a62' : '#111111' }}>{label}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{hint}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          {role === 'sales' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>所属组别</label>
              <input value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))} placeholder="例：华东一组、大快消组" style={inputStyle} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>登录邮箱 *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="example@company.com"
              style={{ ...inputStyle, borderColor: emailTaken ? '#fca5a5' : '#e5e5e5' }} />
            {emailTaken && <div style={{ fontSize: 11, color: '#e05555', marginTop: 3 }}>该邮箱已被使用</div>}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
              {isEdit ? '新密码（留空则不修改）' : '登录密码 *'}
              <button onClick={() => setShowPwd(v => !v)} style={{ fontSize: 11, color: '#111111', background: 'none', border: 'none', cursor: 'pointer' }}>{showPwd ? '隐藏' : '显示'}</button>
            </label>
            <input type={showPwd ? 'text' : 'password'} value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? '留空则不修改' : PASSWORD_RULE_HINT} style={inputStyle} />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{PASSWORD_RULE_HINT}</div>
          </div>
          {form.password && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#111111', marginBottom: 5, display: 'block' }}>确认密码 *</label>
              <input type={showPwd ? 'text' : 'password'} value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="再次输入密码"
                style={{ ...inputStyle, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? '#fca5a5' : '#e5e5e5' }} />
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <div style={{ fontSize: 11, color: '#e05555', marginTop: 3 }}>两次密码不一致</div>
              )}
            </div>
          )}
          {form.password && <StrengthMeter password={form.password} />}
          {error && (
            <div style={{ background: '#fff1f1', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#e05555' }}>{error}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1.5px solid #e5e5e5', background: 'white', cursor: 'pointer', fontSize: 13, color: '#4b5563' }}>取消</button>
          <button onClick={submit} style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #111111, #444444)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            {isEdit ? '保存修改' : `创建${roleLabel}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sales management ─────────────────────────────────────────────────────────
function SalesMgmt({ desc }: { desc: string }) {
  const { users, opportunities, toggleUserDisabled, deleteUser, switchUser } = useStore()
  const navigate = useNavigate()
  const proxyAccess = async (id: string) => { const r = await switchUser(id); if (r.success) navigate('/') }
  const isMobile = useMobile()
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<{ id: string; name: string; email: string; group?: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const salesUsers = users.filter(u => u.role === 'sales').map(u => {
    const opps = opportunities.filter(o => o.salesOwnerId === u.id)
    const signed = opps.filter(o => o.stage === 'signed').length
    const rate = opps.length ? Math.round(signed / opps.length * 100) : 0
    return { ...u, total: opps.length, signed, rate }
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>{desc}</p>
        <button onClick={() => setShowAdd(true)} style={{
          background: 'linear-gradient(135deg, #111111, #444444)', color: 'white',
          border: 'none', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', flexShrink: 0,
        }}>+ 新增直客销售</button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', borderRadius: 16, boxShadow: '0 2px 16px rgba(80,140,160,0.08)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.9)' }}>
        {!isMobile ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>姓名</th>
                <th style={thStyle}>所属组别</th>
                <th style={thStyle}>签约 / 报备</th>
                <th style={thStyle}>转化率</th>
                <th style={thStyle}>登录账号</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>创建时间</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {salesUsers.map(u => (
                <tr key={u.id}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: u.disabled ? '#d1d5db' : '#9ca3af', flexShrink: 0 }}>
                        {u.name[0]}
                      </div>
                      <span style={{ fontWeight: 600 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {u.group ? <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 20, background: '#f3f4f6', color: '#374151', fontWeight: 600 }}>{u.group}</span> : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: '#059669' }}>{u.signed}</span>
                    <span style={{ color: '#6b7280', margin: '0 4px' }}>/</span>
                    <span style={{ fontWeight: 700 }}>{u.total}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 56, height: 4, background: '#e5e5e5', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: '#111111', borderRadius: 2, width: `${u.rate}%` }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{u.rate}%</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: '#6b7280' }}>{u.email}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, background: u.disabled ? '#f3f4f6' : '#d1fae5', color: u.disabled ? '#6b7280' : '#065f46' }}>
                      {u.disabled ? '已停用' : '正常'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#9ca3af', fontSize: 12 }}>{u.createdAt ? u.createdAt.slice(0, 10) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => proxyAccess(u.id)} disabled={u.disabled}
                        title="以该账号身份访问系统"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid rgba(14,120,160,0.25)', background: 'rgba(14,157,191,0.06)', color: u.disabled ? '#c4c4c4' : '#0e7a9a', cursor: u.disabled ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                        <UserCheck size={12} /> 代理访问
                      </button>
                      <button onClick={() => setEditUser({ id: u.id, name: u.name, email: u.email, group: u.group })}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e5e5', background: 'white', color: '#111111', cursor: 'pointer', fontWeight: 600 }}>编辑</button>
                      <button onClick={() => toggleUserDisabled(u.id)}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: u.disabled ? '#d1fae5' : '#fff1f1', color: u.disabled ? '#065f46' : '#e05555' }}>
                        {u.disabled ? '启用' : '停用'}
                      </button>
                      <button onClick={() => setDeleteTarget({ id: u.id, name: u.name })}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {salesUsers.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>暂无直客销售账号</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <div>
            {salesUsers.map(u => (
              <div key={u.id} style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{u.group || u.email}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => proxyAccess(u.id)} disabled={u.disabled}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid rgba(14,120,160,0.25)', background: 'rgba(14,157,191,0.06)', color: u.disabled ? '#c4c4c4' : '#0e7a9a', cursor: u.disabled ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                    <UserCheck size={12} /> 代理
                  </button>
                  <button onClick={() => setEditUser({ id: u.id, name: u.name, email: u.email, group: u.group })}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e5e5', background: 'white', color: '#111111', cursor: 'pointer', fontWeight: 600 }}>编辑</button>
                  <button onClick={() => toggleUserDisabled(u.id)}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: u.disabled ? '#d1fae5' : '#fff1f1', color: u.disabled ? '#065f46' : '#e05555' }}>
                    {u.disabled ? '启用' : '停用'}
                  </button>
                </div>
              </div>
            ))}
            {salesUsers.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>暂无直客销售账号</div>}
          </div>
        )}
      </div>

      {showAdd && <UserModal role="sales" onClose={() => setShowAdd(false)} />}
      {editUser && <UserModal role="sales" editUser={editUser} onClose={() => setEditUser(null)} />}
      {deleteTarget && (() => {
        const hasData = opportunities.some(o => o.salesOwnerId === deleteTarget.id)
        return (
          <DeleteConfirm
            title={`删除销售「${deleteTarget.name}」`}
            desc="删除后该账号将被移除，此操作不可恢复。"
            blocked={hasData}
            blockedMsg="该销售名下已有商机数据，无法删除。"
            onConfirm={() => deleteUser(deleteTarget.id)}
            onClose={() => setDeleteTarget(null)}
          />
        )
      })()}
    </div>
  )
}

// ─── Admin account management ─────────────────────────────────────────────────
function AdminMgmt({ desc }: { desc: string }) {
  const { users, currentUser, toggleUserDisabled } = useStore()
  const isMobile = useMobile()
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<{ id: string; name: string; email: string } | null>(null)

  const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'channel_admin' || u.role === 'sales_admin')
  const roleBadge = (r: string) => {
    const map: Record<string, { bg: string; color: string }> = {
      admin: { bg: '#fde8d4', color: '#b45309' },
      channel_admin: { bg: '#dbeafe', color: '#1657c8' },
      sales_admin: { bg: '#d1fae5', color: '#065f46' },
    }
    const s = map[r] ?? { bg: '#f3f4f6', color: '#6b7280' }
    return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, background: s.bg, color: s.color }}>{roleName(r)}</span>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>{desc}</p>
        <button onClick={() => setShowAdd(true)} style={{
          background: 'linear-gradient(135deg, #111111, #444444)', color: 'white',
          border: 'none', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', flexShrink: 0,
        }}>+ 新增管理员</button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', borderRadius: 16, boxShadow: '0 2px 16px rgba(80,140,160,0.08)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.9)' }}>
        {!isMobile ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>姓名</th>
                <th style={thStyle}>角色</th>
                <th style={thStyle}>登录邮箱</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>创建时间</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map(u => {
                const isSelf = u.id === currentUser.id
                return (
                  <tr key={u.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: u.disabled ? '#d1d5db' : '#9ca3af', flexShrink: 0 }}>
                          {u.name[0]}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{u.name}</span>
                          {isSelf && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 6, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>当前账号</span>}
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{roleBadge(u.role)}</td>
                    <td style={{ ...tdStyle, color: '#6b7280' }}>{u.email}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, background: u.disabled ? '#f3f4f6' : '#d1fae5', color: u.disabled ? '#6b7280' : '#065f46' }}>
                        {u.disabled ? '已停用' : '正常'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#9ca3af', fontSize: 12 }}>{u.createdAt ? u.createdAt.slice(0, 10) : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditUser({ id: u.id, name: u.name, email: u.email })}
                          style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e5e5', background: 'white', color: '#111111', cursor: 'pointer', fontWeight: 600 }}>编辑</button>
                        {!isSelf && (
                          <button onClick={() => toggleUserDisabled(u.id)}
                            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: u.disabled ? '#d1fae5' : '#fff1f1', color: u.disabled ? '#065f46' : '#e05555' }}>
                            {u.disabled ? '启用' : '停用'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {adminUsers.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>暂无管理员账号</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <div>
            {adminUsers.map(u => {
              const isSelf = u.id === currentUser.id
              return (
                <div key={u.id} style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>{u.name}</span>
                      {roleBadge(u.role)}
                      {isSelf && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 6, background: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }}>当前</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setEditUser({ id: u.id, name: u.name, email: u.email })}
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1.5px solid #e5e5e5', background: 'white', color: '#111111', cursor: 'pointer', fontWeight: 600 }}>编辑</button>
                    {!isSelf && (
                      <button onClick={() => toggleUserDisabled(u.id)}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: u.disabled ? '#d1fae5' : '#fff1f1', color: u.disabled ? '#065f46' : '#e05555' }}>
                        {u.disabled ? '启用' : '停用'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {adminUsers.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>暂无管理员账号</div>}
          </div>
        )}
      </div>

      {showAdd && <UserModal role="admin" onClose={() => setShowAdd(false)} />}
      {editUser && <UserModal role="admin" editUser={editUser} onClose={() => setEditUser(null)} />}
    </div>
  )
}

function Logs({ desc }: { desc: string }) {
  const { logs } = useStore()
  const isMobile = useMobile()

  const sortedLogs = [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const actionColor = (action: string) => {
    if (action.includes('释放') || action.includes('删除')) return '#e05555'
    if (action.includes('拒绝') || action.includes('驳回')) return '#d97706'
    if (action.includes('批准') || action.includes('启用')) return '#059669'
    return '#6b7280'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>{desc}</p>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', borderRadius: 16, boxShadow: '0 2px 16px rgba(80,140,160,0.08)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.9)' }}>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid rgba(200,230,240,0.4)', background: 'rgba(236,248,252,0.6)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', minWidth: 130, flexShrink: 0, letterSpacing: '0.3px' }}>时间</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', minWidth: 72, flexShrink: 0, letterSpacing: '0.3px' }}>操作人</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', minWidth: 80, flexShrink: 0, letterSpacing: '0.3px' }}>动作</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', flex: 1, letterSpacing: '0.3px' }}>详情</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', flexShrink: 0, marginLeft: 12, minWidth: 90, textAlign: 'right', letterSpacing: '0.3px' }}>IP</div>
          </div>
        )}
        {sortedLogs.map((log, i) => (
          <div key={log.id}
            style={{
              display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? 4 : 0,
              padding: isMobile ? '13px 16px' : '13px 20px',
              borderBottom: i < sortedLogs.length - 1 ? '1px solid #f3f4f6' : 'none',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <div style={{ fontSize: 12, color: '#9ca3af', minWidth: isMobile ? undefined : 130, flexShrink: 0 }}>{formatDate(log.createdAt)}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', minWidth: isMobile ? undefined : 72, flexShrink: 0 }}>{log.operatorName}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: actionColor(log.action), minWidth: isMobile ? undefined : 80, flexShrink: 0 }}>{log.action}</div>
            <div style={{ fontSize: 13, color: '#4b5563', flex: 1 }}>{log.detail}</div>
            {!isMobile && <div style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0, marginLeft: 12, minWidth: 90, textAlign: 'right' }}>{log.ip}</div>}
          </div>
        ))}
        {logs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 14, color: '#9ca3af' }}>暂无操作日志</div>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentConfigSettings({ desc }: { desc: string }) {
  const isMobile = useMobile()
  const [configData, setConfigData] = useState<AgentConfiguration | null>(null)
  const [form, setForm] = useState<AgentConfigurationInput>({ models: [], soulPrompt: '', businessPrompt: '', responsePrompt: '' })
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({})
  const [busy, setBusy] = useState<string | null>('load')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = async () => {
    setBusy('load')
    try {
      const data = await agentApi.config()
      setConfigData(data)
      setForm({
        models: data.models.map(model => ({ ...model, apiKey: '' })),
        soulPrompt: data.soulPrompt, businessPrompt: data.businessPrompt, responsePrompt: data.responsePrompt,
      })
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof ApiError ? error.message : 'Agent 配置加载失败' })
    } finally { setBusy(null) }
  }

  useEffect(() => { void load() }, [])

  const testModel = async (index: number) => {
    setBusy(`test-${index}`)
    setNotice(null)
    try {
      const result = await agentApi.testModel(form.models[index])
      setNotice({ type: 'success', text: `连接成功 · ${result.model} · ${result.latencyMs}ms` })
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof ApiError ? error.message : '模型连接失败，请检查地址、模型和 Key' })
    } finally { setBusy(null) }
  }

  const save = async () => {
    setBusy('save')
    setNotice(null)
    try {
      await agentApi.updateConfig(form)
      setNotice({ type: 'success', text: '配置已保存并即时生效；默认模型不可用时将按优先级自动切换。' })
      await load()
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof ApiError ? error.message : '保存失败，请稍后重试' })
      setBusy(null)
    }
  }

  const updatePrompt = (key: keyof AgentPromptValues, value: string) => setForm(current => ({ ...current, [key]: value }))
  const updateModel = (index: number, patch: Partial<AgentModelConfiguration>) => setForm(current => ({
    ...current,
    models: current.models.map((model, modelIndex) => modelIndex === index ? { ...model, ...patch } : model),
  }))
  const addModel = () => setForm(current => ({
    ...current,
    models: [...current.models, {
      name: `备用模型 ${current.models.length + 1}`, model: '', baseUrl: '', apiKey: '', enabled: true,
      isDefault: current.models.length === 0, priority: current.models.length * 10,
    }],
  }))
  const removeModel = (index: number) => setForm(current => {
    const removedDefault = current.models[index]?.isDefault
    const models = current.models.filter((_, modelIndex) => modelIndex !== index)
    if (removedDefault && models[0]) models[0] = { ...models[0], enabled: true, isDefault: true }
    return { ...current, models }
  })
  const setDefaultModel = (index: number) => setForm(current => ({
    ...current,
    models: current.models.map((model, modelIndex) => ({ ...model, enabled: modelIndex === index ? true : model.enabled, isDefault: modelIndex === index })),
  }))
  type AgentPromptValues = Pick<AgentConfigurationInput, 'soulPrompt' | 'businessPrompt' | 'responsePrompt'>
  const promptLayers: { key: 'soulPrompt' | 'businessPrompt' | 'responsePrompt'; title: string; badge: string; description: string; rows: number }[] = [
    { key: 'soulPrompt', title: '角色与风格', badge: 'Soul', description: '定义 Agent 的身份、目标、表达风格与判断原则。', rows: 8 },
    { key: 'businessPrompt', title: '业务策略', badge: 'Business', description: '定义数据优先级、商机判断方法和销售推进准则。', rows: 10 },
    { key: 'responsePrompt', title: '回答规范', badge: 'Response', description: '定义回答结构、篇幅、语言与可读性。', rows: 6 },
  ]

  if (busy === 'load' && !configData) return (
    <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: 10 }}>
      <LoaderCircle size={19} className="spin" /> 正在读取 Agent 配置…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: isMobile ? '17px 16px' : '20px 22px', borderRadius: 18, background: 'linear-gradient(135deg, #f0fbff 0%, #f8fbff 52%, #f5f3ff 100%)', border: '1px solid #dceff5', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #06b6d4, #2563eb)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(37,99,235,.22)' }}><BrainCircuit size={23} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 750, color: '#0f172a' }}>Harness Agent 运行配置</div>
          <div style={{ marginTop: 4, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{desc}。保存前会自动连接校验，成功后立即热切换。</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderRadius: 99, background: configData?.models.some(model => model.enabled && model.hasApiKey) ? '#dcfce7' : '#fff7ed', color: configData?.models.some(model => model.enabled && model.hasApiKey) ? '#15803d' : '#c2410c', fontSize: 12, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
          {configData?.models.length ? `默认：${configData.models.find(model => model.isDefault)?.name ?? '未设置'} · ${configData.models.filter(model => model.enabled).length} 个启用` : '待配置'}
        </div>
      </div>

      {notice && <div style={{ padding: '11px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: notice.type === 'success' ? '#ecfdf5' : '#fff1f2', color: notice.type === 'success' ? '#047857' : '#be123c', border: `1px solid ${notice.type === 'success' ? '#a7f3d0' : '#fecdd3'}` }}>
        {notice.type === 'success' ? <CheckCircle2 size={16} /> : <Shield size={16} />}{notice.text}
      </div>}

      <section style={{ padding: isMobile ? 16 : 22, borderRadius: 18, background: 'rgba(255,255,255,.9)', border: '1px solid #e8eef2', boxShadow: '0 5px 20px rgba(30,70,90,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
          <KeyRound size={18} color="#0e9dbf" /><span style={{ flex: 1, fontSize: 15, fontWeight: 750, color: '#0f172a' }}>模型配置与故障切换</span>
          <button type="button" onClick={addModel} disabled={Boolean(busy) || form.models.length >= 8} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', borderRadius: 9, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><Plus size={14} />新增模型</button>
        </div>
        <div style={{ marginBottom: 14, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>请求先使用默认模型；失败时按优先级数值从小到大依次尝试已启用的备用模型。</div>
        <datalist id="agent-model-options"><option value="deepseek-v4-flash-0731" /><option value="DeepSeek-V4-Flash" /><option value="DeepSeek-V4-Pro" /><option value="deepseek-v4-flash" /></datalist>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {form.models.map((model, index) => (
            <div key={model.id ?? `new-${index}`} style={{ padding: 15, borderRadius: 14, border: model.isDefault ? '1.5px solid #38bdf8' : '1px solid #e2e8f0', background: model.isDefault ? '#f6fcff' : '#fbfdfe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13, flexWrap: 'wrap' }}>
                <input value={model.name} onChange={event => updateModel(index, { name: event.target.value })} placeholder="配置名称" style={{ ...inputStyle, width: isMobile ? '100%' : 260, background: 'white', fontWeight: 650 }} />
                <button type="button" onClick={() => setDefaultModel(index)} style={{ padding: '6px 9px', borderRadius: 99, border: model.isDefault ? '1px solid #7dd3fc' : '1px solid #cbd5e1', background: model.isDefault ? '#e0f2fe' : 'white', color: model.isDefault ? '#0369a1' : '#64748b', fontSize: 11, fontWeight: 750, cursor: 'pointer' }}>{model.isDefault ? '默认模型' : '设为默认'}</button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569', cursor: 'pointer' }}><input type="checkbox" checked={model.enabled} onChange={event => updateModel(index, { enabled: event.target.checked })} disabled={model.isDefault} />启用</label>
                {model.lastStatus && <span title={model.lastError ?? undefined} style={{ marginLeft: isMobile ? 0 : 'auto', padding: '5px 8px', borderRadius: 99, background: model.lastStatus === 'healthy' ? '#dcfce7' : '#ffe4e6', color: model.lastStatus === 'healthy' ? '#15803d' : '#be123c', fontSize: 11, fontWeight: 700 }}>{model.lastStatus === 'healthy' ? '连接正常' : '连接失败'}</span>}
                <button type="button" title="删除配置" disabled={form.models.length <= 1 || Boolean(busy)} onClick={() => removeModel(index)} style={{ width: 31, height: 31, marginLeft: model.lastStatus ? 0 : (isMobile ? 0 : 'auto'), borderRadius: 8, border: '1px solid #fecdd3', background: 'white', color: '#e11d48', cursor: 'pointer' }}><Trash2 size={14} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(170px,.8fr) minmax(260px,1.4fr) 90px', gap: 11 }}>
                <label style={{ fontSize: 12, color: '#475569', fontWeight: 650 }}>模型名称<input list="agent-model-options" value={model.model} onChange={event => updateModel(index, { model: event.target.value })} placeholder="deepseek-v4-flash-0731" style={{ ...inputStyle, marginTop: 6, background: 'white' }} /></label>
                <label style={{ fontSize: 12, color: '#475569', fontWeight: 650 }}>API 地址<input value={model.baseUrl} onChange={event => updateModel(index, { baseUrl: event.target.value })} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" style={{ ...inputStyle, marginTop: 6, background: 'white' }} /></label>
                <label style={{ fontSize: 12, color: '#475569', fontWeight: 650 }}>优先级<input type="number" min={0} max={999} value={model.priority} onChange={event => updateModel(index, { priority: Number(event.target.value) })} style={{ ...inputStyle, marginTop: 6, background: 'white' }} /></label>
                <label style={{ gridColumn: isMobile ? undefined : '1 / -1', fontSize: 12, color: '#475569', fontWeight: 650 }}>API Key
                  <div style={{ display: 'flex', gap: 9, marginTop: 6 }}>
                    <div style={{ position: 'relative', flex: 1 }}><input type={showKeys[index] ? 'text' : 'password'} value={model.apiKey ?? ''} onChange={event => updateModel(index, { apiKey: event.target.value })} placeholder={model.hasApiKey ? `${model.keyHint ?? '已配置'}（留空则沿用）` : '请输入 API Key'} autoComplete="new-password" style={{ ...inputStyle, paddingRight: 44, background: 'white' }} /><button type="button" onClick={() => setShowKeys(value => ({ ...value, [index]: !value[index] }))} aria-label="显示或隐藏 Key" style={{ position: 'absolute', right: 8, top: 5, width: 32, height: 32, border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}>{showKeys[index] ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                    <button type="button" disabled={Boolean(busy)} onClick={() => void testModel(index)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', borderRadius: 9, border: '1px solid #cbd5e1', background: 'white', color: '#334155', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy === `test-${index}` ? <LoaderCircle className="spin" size={15} /> : <TestTube2 size={15} />}测试</button>
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 11 }}>所有 Key 均采用 AES-256-GCM 加密保存，页面不会返回明文。</div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        {promptLayers.map(layer => (
          <section key={layer.key} style={{ padding: 18, borderRadius: 18, background: 'rgba(255,255,255,.92)', border: '1px solid #e8eef2', boxShadow: '0 5px 20px rgba(30,70,90,.05)', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}><span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 7, background: '#e6f8fc', color: '#087d9b', fontSize: 10, fontWeight: 800, letterSpacing: '.04em' }}>{layer.badge}</span><div style={{ marginTop: 8, fontSize: 15, fontWeight: 750, color: '#0f172a' }}>{layer.title}</div></div>
              <button type="button" title="恢复默认" onClick={() => configData && updatePrompt(layer.key, configData.defaults[layer.key])} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #e2e8f0', color: '#64748b', background: 'white', cursor: 'pointer' }}><RotateCcw size={14} /></button>
            </div>
            <p style={{ margin: '7px 0 11px', minHeight: isMobile ? undefined : 38, fontSize: 12, lineHeight: 1.55, color: '#64748b' }}>{layer.description}</p>
            <textarea value={form[layer.key]} onChange={event => updatePrompt(layer.key, event.target.value)} rows={layer.rows} style={{ ...inputStyle, resize: 'vertical', background: '#fbfdfe', lineHeight: 1.65, fontFamily: 'inherit', minHeight: 140 }} />
            <div style={{ marginTop: 6, textAlign: 'right', fontSize: 10, color: '#94a3b8' }}>{form[layer.key].length.toLocaleString()} 字符</div>
          </section>
        ))}
      </div>

      <section style={{ padding: isMobile ? 16 : '17px 20px', borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontSize: 13, fontWeight: 750 }}><LockKeyhole size={16} />系统保护层 · 不可编辑</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
          {['权限与数据隔离', '提示注入防护', '密钥与隐私保护', '飞书信号结构化协议', '高影响操作人工确认'].map(item => <span key={item} style={{ padding: '6px 10px', borderRadius: 9, background: 'white', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 12 }}>{item}</span>)}
        </div>
      </section>

      <div style={{ position: 'sticky', bottom: 12, zIndex: 5, display: 'flex', justifyContent: 'flex-end', gap: 10, padding: 10, borderRadius: 15, background: 'rgba(255,255,255,.88)', backdropFilter: 'blur(16px)', border: '1px solid rgba(226,232,240,.9)', boxShadow: '0 10px 30px rgba(15,23,42,.1)' }}>
        <button disabled={Boolean(busy) || form.models.length === 0} onClick={() => void save()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 17px', borderRadius: 10, border: 0, background: 'linear-gradient(135deg, #06a8c7, #2563eb)', color: 'white', fontSize: 13, fontWeight: 750, cursor: busy ? 'wait' : 'pointer', boxShadow: '0 5px 14px rgba(37,99,235,.22)' }}>{busy === 'save' ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}保存并应用</button>
      </div>
    </div>
  )
}

const allTabs = [
  { key: 'channels', label: '渠道管理',   icon: GitBranch, desc: '管理渠道伙伴信息及其登录账号', can: (r: string) => canManageChannels(r) },
  { key: 'sales',    label: '直客销售',   icon: Users,     desc: '管理 JD 直客销售人员信息、所属组别及登录账号', can: (r: string) => canManageSales(r) },
  { key: 'admins',   label: '管理员账号', icon: Shield,    desc: '管理系统管理员账号，支持多账号添加', can: (r: string) => canManageAdmins(r) },
  { key: 'agent',    label: 'Agent 配置', icon: Bot,       desc: '配置模型连接与可开放的 Harness Prompt 分层', can: (r: string) => canManageAdmins(r) },
  { key: 'logs',     label: '操作日志',   icon: FileText,  desc: '查看所有用户的操作的记录', can: (r: string) => isAdminRole(r) },
]

export default function Admin() {
  const { currentUser } = useStore()
  const isMobile = useMobile()
  const tabs = allTabs.filter(t => t.can(currentUser.role))
  const [tab, setTab] = useState(tabs[0]?.key ?? 'logs')

  if (!isAdminRole(currentUser.role)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#d1d5db' }}>
        <Shield size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
        <div style={{ fontSize: 15, color: '#6b7280' }}>无权限访问管理后台</div>
      </div>
    )
  }

  const currentTab = (tabs.find(t => t.key === tab) ?? tabs[0])!

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#111111', margin: '0 0 2px' }}>管理后台</h1>
        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>系统账号、渠道及操作日志管理</p>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.85)', borderRadius: 14, padding: 5, width: isMobile ? '100%' : 'fit-content', maxWidth: '100%', overflowX: 'auto', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'all 0.2s', flex: isMobile ? '0 0 auto' : undefined,
            background: tab === key ? 'linear-gradient(135deg, #111111, #444444)' : 'transparent',
            color: tab === key ? 'white' : '#4b5563',
            boxShadow: tab === key ? '0 3px 10px rgba(0,0,0,0.3)' : 'none',
          }}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'channels' && <ChannelMgmt desc={currentTab.desc} />}
      {tab === 'sales' && <SalesMgmt desc={currentTab.desc} />}
      {tab === 'admins' && <AdminMgmt desc={currentTab.desc} />}
      {tab === 'agent' && <AgentConfigSettings desc={currentTab.desc} />}
      {tab === 'logs' && <Logs desc={currentTab.desc} />}
    </div>
  )
}
