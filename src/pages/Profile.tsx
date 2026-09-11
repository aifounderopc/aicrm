import { useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { authApi, ApiError } from '../api'
import { useStore } from '../store'
import type { User } from '../types'
import { PASSWORD_RULE_HINT, passwordStrength, roleName, validatePassword } from '../utils'
import './Profile.css'

const USE_API = import.meta.env.VITE_USE_API === 'true'

export default function Profile() {
  const { currentUser, authUserId, users } = useStore()
  const [profile, setProfile] = useState<User>(() => users.find(user => user.id === authUserId) ?? currentUser)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!USE_API) {
      setProfile(users.find(user => user.id === authUserId) ?? currentUser)
      return
    }
    authApi.me().then(({ authUser }) => setProfile(authUser as User)).catch(() => undefined)
  }, [authUserId, currentUser, users])

  const strength = useMemo(() => passwordStrength(newPassword), [newPassword])
  const tenantName = profile.tenantName || 'JoyMarketing 声访'
  const tenantNo = profile.tenantNo || 100001

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setFeedback(null)
    if (!oldPassword) return setFeedback({ type: 'error', text: '请输入当前密码' })
    const checked = validatePassword(newPassword)
    if (!checked.valid) return setFeedback({ type: 'error', text: checked.error || '新密码不符合安全要求' })
    if (newPassword !== confirmPassword) return setFeedback({ type: 'error', text: '两次输入的新密码不一致' })
    if (oldPassword === newPassword) return setFeedback({ type: 'error', text: '新密码不能与当前密码相同' })

    setSubmitting(true)
    try {
      if (USE_API) {
        await authApi.changePassword(oldPassword, newPassword)
      } else {
        const state = useStore.getState()
        const owner = state.users.find(user => user.id === state.authUserId) ?? state.currentUser
        if ((owner.password || '') !== oldPassword) throw new Error('原密码错误')
        const updated = { ...owner, password: newPassword }
        useStore.setState({
          users: state.users.map(user => user.id === owner.id ? updated : user),
          currentUser: state.currentUser.id === owner.id ? updated : state.currentUser,
        })
      }
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setFeedback({ type: 'success', text: '密码修改成功，下次登录请使用新密码' })
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof ApiError || error instanceof Error ? error.message : '密码修改失败，请稍后重试' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-heading">
        <div>
          <span className="profile-eyebrow">ACCOUNT CENTER</span>
          <h1>个人中心</h1>
          <p>查看企业归属与账号信息，管理个人登录安全。</p>
        </div>
        <div className="profile-heading-avatar" aria-hidden="true">{profile.name.slice(0, 1)}</div>
      </div>

      <section className="profile-tenant-card">
        <div className="profile-tenant-icon"><Building2 size={24} /></div>
        <div className="profile-tenant-copy">
          <span>所属企业租户</span>
          <strong>{tenantName}</strong>
          <code className="profile-tenant-id">企业租户 ID：{tenantNo}</code>
          <p>你的商机、连接器和 AI 分析均在该企业的数据边界内运行。</p>
        </div>
        <span className="profile-status"><i /> 正常使用</span>
      </section>

      <div className="profile-grid">
        <section className="profile-panel">
          <div className="profile-panel-title">
            <div className="profile-panel-icon"><UserRound size={19} /></div>
            <div><h2>账号信息</h2><p>当前登录账号的基础资料</p></div>
          </div>

          <div className="profile-account-card">
            <div className="profile-large-avatar">{profile.name.slice(0, 1)}</div>
            <div>
              <h3>{profile.name}</h3>
              <span>{roleName(profile.role)}</span>
            </div>
          </div>

          <dl className="profile-info-list">
            <div><dt><Mail size={16} /> 登录账号</dt><dd>{profile.email}</dd></div>
            <div><dt><ShieldCheck size={16} /> 账号角色</dt><dd><span className="profile-role-chip">{roleName(profile.role)}</span></dd></div>
            <div><dt><Building2 size={16} /> 企业租户</dt><dd>{tenantName}</dd></div>
            <div><dt><Building2 size={16} /> 企业租户 ID</dt><dd><code className="profile-inline-id">{tenantNo}</code></dd></div>
          </dl>

          <div className="profile-data-note">
            <ShieldCheck size={17} />
            <span>Scale X 仅基于你有权访问的商机与连接器数据提供分析和推进支持。</span>
          </div>
        </section>

        <section className="profile-panel">
          <div className="profile-panel-title">
            <div className="profile-panel-icon profile-panel-icon--key"><KeyRound size={19} /></div>
            <div><h2>修改密码</h2><p>定期更新密码，保护账号安全</p></div>
          </div>

          <form className="profile-password-form" onSubmit={submitPassword}>
            <PasswordField label="当前密码" value={oldPassword} onChange={setOldPassword} visible={showOld} onVisibleChange={setShowOld} autoComplete="current-password" />
            <PasswordField label="新密码" value={newPassword} onChange={setNewPassword} visible={showNew} onVisibleChange={setShowNew} autoComplete="new-password" />

            {newPassword && (
              <div className="profile-strength">
                <div className="profile-strength-head"><span>密码强度</span><b>{strength.label}</b></div>
                <div className="profile-strength-bars">
                  {[1, 2, 3, 4].map(level => <i key={level} className={level <= strength.score ? `active level-${strength.score}` : ''} />)}
                </div>
              </div>
            )}

            <PasswordField label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} visible={showNew} onVisibleChange={setShowNew} autoComplete="new-password" hideToggle />
            <p className="profile-password-hint">{PASSWORD_RULE_HINT}</p>

            {feedback && (
              <div className={`profile-feedback ${feedback.type}`}>
                {feedback.type === 'success' ? <CheckCircle2 size={17} /> : <span>!</span>}
                {feedback.text}
              </div>
            )}

            <button className="profile-submit" type="submit" disabled={submitting}>
              {submitting ? '正在更新…' : '确认修改密码'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

function PasswordField({ label, value, onChange, visible, onVisibleChange, autoComplete, hideToggle = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  visible: boolean
  onVisibleChange: (value: boolean) => void
  autoComplete: string
  hideToggle?: boolean
}) {
  return (
    <label className="profile-field">
      <span>{label}</span>
      <div className="profile-input-wrap">
        <KeyRound size={16} />
        <input type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} autoComplete={autoComplete} placeholder={`请输入${label}`} />
        {!hideToggle && (
          <button type="button" onClick={() => onVisibleChange(!visible)} aria-label={visible ? '隐藏密码' : '显示密码'}>
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </label>
  )
}
