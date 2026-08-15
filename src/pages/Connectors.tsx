import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff, KeyRound, Link2, Mail, MessageSquare, PlayCircle, RefreshCw, Rocket, Settings2, ShieldCheck, Sparkles, Users, Video, X } from 'lucide-react'
import { useStore } from '../store'
import { roleName } from '../utils'
import { ApiError, integrationApi, type DraftImConnectionStatus, type DraftImProvider, type FeishuConnectionStatus } from '../api'

type ConnectorStatus = 'connected' | 'configured' | 'not_connected' | 'disabled'
type SyncStatus = 'healthy' | 'warning' | 'pending_auth' | 'paused'
type Connector = {
  id: string; name: string; type: string; status: ConnectorStatus; syncStatus: SyncStatus
  authUser: string; scope: string; sharedTo: string; lastSync: string; nextSync: string
  signalCount: number; syncedItems: number; desc: string
}

const initialConnectors: Connector[] = [
  { id: 'feishu', name: '飞书', type: 'IM', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未配置', scope: '机器人所在群聊的用户消息', sharedTo: '按商机归属权关联展示，管理员可见聚合信号', lastSync: '未接收', nextSync: '长连接实时接收', signalCount: 0, syncedItems: 0, desc: '配置飞书机器人 App ID 与 App Secret 后，通过官方长连接实时接收群消息。' },
  { id: 'wecom', name: '企微', type: 'IM', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未配置', scope: '客户群、外部联系人与会话存档授权范围', sharedTo: '按商机归属关联客户信号摘要', lastSync: '尚未接入', nextSync: 'SDK 接入后实时同步', signalCount: 0, syncedItems: 0, desc: '配置企业 ID 与应用 Secret，提前完成企微客户群信号接入准备。' },
  { id: 'dingtalk', name: '钉钉', type: 'IM', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未配置', scope: '客户群、项目群与销售转发消息', sharedTo: '按商机归属关联项目协同摘要', lastSync: '尚未接入', nextSync: 'SDK 接入后实时同步', signalCount: 0, syncedItems: 0, desc: '配置钉钉应用 Client ID 与 Client Secret，提前完成项目群巡检接入准备。' },
  { id: 'jingme', name: '京 Me', type: 'IM', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未配置', scope: '内部协同群、客户项目群与转发线索', sharedTo: '按商机归属生成实时上下文摘要', lastSync: '尚未接入', nextSync: 'SDK 接入后实时同步', signalCount: 0, syncedItems: 0, desc: '配置京 Me 应用标识与应用密钥，提前完成线索流转和项目协同接入准备。' },
  { id: 'email', name: '邮箱', type: '邮件', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未授权', scope: '收件箱白名单、客户域名、报价 / 方案文件夹', sharedTo: '仅生成线索草稿，敏感正文默认不共享', lastSync: '未同步', nextSync: '完成授权后', signalCount: 0, syncedItems: 0, desc: '待授权企业邮箱，支持限定文件夹和客户域名白名单。' },
  { id: 'meeting', name: '会议', type: '会议纪要', status: 'connected', syncStatus: 'warning', authUser: '当前账号', scope: '飞书妙记、手动上传纪要、Demo 会议摘要', sharedTo: '关联商机团队可见纪要摘要', lastSync: '昨天 18:10', nextSync: '待补充会议链接', signalCount: 5, syncedItems: 9, desc: '会议纪要已接入，最近一次 Demo 会议缺少客户名称。' },
  { id: 'form', name: '表单', type: '表单', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未授权', scope: '活动报名、官网试用、渠道提交表单', sharedTo: '按线索归属规则分配给销售', lastSync: '未同步', nextSync: '完成授权后', signalCount: 0, syncedItems: 0, desc: '接收活动报名、官网试用和渠道表单，自动生成线索草稿。' },
]

const normalizeConnectors = (items: Connector[]) => items.map(item => {
  const base = initialConnectors.find(connector => connector.id === item.id)
  if (!base) return item
  if (['wecom', 'dingtalk', 'jingme'].includes(item.id)) return base
  if (item.status === 'disabled') return base
  return { ...item, desc: base.desc, scope: base.scope, sharedTo: base.sharedTo }
})

const iconFor = (id: string) => id === 'email' ? Mail : id === 'meeting' ? Video : id === 'form' ? Users : MessageSquare

const draftImProviders: DraftImProvider[] = ['wecom', 'dingtalk', 'jingme']
const imCredentialMeta: Record<DraftImProvider, { title: string; idLabel: string; idPlaceholder: string; secretLabel: string; description: string }> = {
  wecom: { title: '企微应用配置', idLabel: '企业 ID（Corp ID）', idPlaceholder: 'wwxxxxxxxxxxxxxxxx', secretLabel: '应用 Secret', description: '配置将加密保存；当前用于完成数据准备，企微 SDK 接入后即可启用实时同步。' },
  dingtalk: { title: '钉钉应用配置', idLabel: 'Client ID（AppKey）', idPlaceholder: 'dingxxxxxxxxxxxxxxxx', secretLabel: 'Client Secret', description: '配置将加密保存；当前用于完成数据准备，钉钉 SDK 接入后即可启用项目群巡检。' },
  jingme: { title: '京 Me 应用配置', idLabel: '应用 ID（App ID）', idPlaceholder: '请输入京 Me 应用标识', secretLabel: '应用密钥', description: '配置将加密保存；当前用于完成数据准备，京 Me SDK 接入后即可启用线索与协同信号同步。' },
}

function ConnectorBrandLogo({ id }: { id: string }) {
  if (id === 'feishu') return <svg className="connector-brand-logo" viewBox="0 0 48 48" aria-label="飞书 Logo"><path fill="#3370ff" d="M9 25.5 24.2 9.8c1.4-1.5 3.8-1.5 5.2 0l3.2 3.3-15.8 16.4H9v-4Z"/><path fill="#00d6b9" d="m15.7 31 17-17.6 4.3 4.4-17 17.6h-4.3V31Z"/><path fill="#ff5b67" d="M9 31h12.4l-6.2 6.4c-1.4 1.5-3.8 1.5-5.2 0L7 34.2 9 31Z"/><path fill="#ffc60a" d="m30.6 28.8 6.4-6.6 3.8 4c1.4 1.4 1.4 3.8 0 5.2l-3.1 3.2-7.1-5.8Z"/></svg>
  if (id === 'wecom') return <svg className="connector-brand-logo" viewBox="0 0 48 48" aria-label="企微 Logo"><path fill="#2aae67" d="M5 19.4C5 11.5 12.6 5 22 5s17 6.5 17 14.4-7.6 14.4-17 14.4c-1.8 0-3.5-.2-5.1-.7L9 37l2.3-6.4C7.4 28 5 24 5 19.4Z"/><path fill="#1686e8" d="M24 26.5c0-6.3 6-11.5 13.4-11.5 1.8 0 3.5.3 5.1.8.3 1.1.5 2.3.5 3.6 0 7.9-7.6 14.4-17 14.4h-.7c-.8-2.2-1.3-4.7-1.3-7.3Z"/><circle cx="16" cy="19" r="2" fill="white"/><circle cx="26" cy="19" r="2" fill="white"/></svg>
  if (id === 'dingtalk') return <svg className="connector-brand-logo" viewBox="0 0 48 48" aria-label="钉钉 Logo"><path fill="#1677ff" d="M38.7 8.5c-7.1 2.8-19.3 1.7-27.9.4l8.1 7.7-5.8 1.4 6.4 6.1-4.1 1.6 7.2 5.1-4.7 8.7c-.4.8.6 1.6 1.3 1l10.1-8.7c5.8-5 9.4-12.6 10.7-21.4.2-1.3-.3-2.3-1.3-1.9Z"/><path fill="white" d="m22 17.2 9.3-1.6-5.8 6.6 5.3.9-8.3 7 2.8-5.7-5-1.7 4.4-2.5-2.7-3Z"/></svg>
  if (id === 'jingme') return <span className="connector-brand-logo jingme-logo" aria-label="京 Me Logo"><b>京</b><i>ME</i></span>
  const Icon = iconFor(id)
  return <Icon size={22} />
}

function connectorTime(value: string | null) {
  if (!value) return '未接收'
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function Connectors() {
  const currentUser = useStore(s => s.currentUser)
  const [connectors, setConnectors] = useState<Connector[]>(() => {
    try { const saved = localStorage.getItem('jm-crm-connectors'); return saved ? normalizeConnectors(JSON.parse(saved)) : initialConnectors } catch { return initialConnectors }
  })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string[]>([])
  const [toast, setToast] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [policy, setPolicy] = useState({ mode: '助手模式', keywords: '预算、Demo、报价、合同、试点、采购', protectionDays: 30 })
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [testResult, setTestResult] = useState(false)
  const [feishuStatus, setFeishuStatus] = useState<FeishuConnectionStatus | null>(null)
  const [feishuForm, setFeishuForm] = useState({ appId: '', appSecret: '' })
  const [showFeishuSecret, setShowFeishuSecret] = useState(false)
  const [savingFeishu, setSavingFeishu] = useState(false)
  const [draftImStatuses, setDraftImStatuses] = useState<Partial<Record<DraftImProvider, DraftImConnectionStatus>>>({})
  const [draftImForms, setDraftImForms] = useState<Record<DraftImProvider, { appId: string; appSecret: string }>>({
    wecom: { appId: '', appSecret: '' }, dingtalk: { appId: '', appSecret: '' }, jingme: { appId: '', appSecret: '' },
  })
  const [showDraftImSecret, setShowDraftImSecret] = useState<Partial<Record<DraftImProvider, boolean>>>({})
  const [savingDraftIm, setSavingDraftIm] = useState<DraftImProvider | null>(null)
  const [wizardChannel, setWizardChannel] = useState<string | null>(null)
  const [setup, setSetup] = useState({
    reportMode: '人工确认后报备', trackingGroups: '重点客户群、项目交付群', keyAccounts: '核心品牌客户、重点续约客户', keywords: '预算、Demo、报价、合同、试点、采购',
    triggers: ['群聊 @', '转发消息', '私聊识别', '每日巡检'], autoDraft: '开启', autoOpportunity: '需销售确认', conflictPolicy: '疑似撞单人工确认', protectionDays: 30,
    testText: '客户计划本月启动品牌营销项目，预算约 50 万，希望下周确认方案和交付周期。',
  })

  const applyFeishuStatus = useCallback((status: FeishuConnectionStatus) => {
    setFeishuStatus(status)
    setFeishuForm(current => ({ ...current, appId: current.appId || status.appId }))
    const running = status.configured && ['connected', 'connecting', 'reconnecting'].includes(status.status)
    setConnectors(items => items.map(item => item.id === 'feishu' ? {
      ...item,
      status: running ? 'connected' : 'not_connected',
      syncStatus: status.status === 'connected' ? 'healthy' : status.status === 'failed' ? 'warning' : 'pending_auth',
      authUser: status.configured ? '飞书自建应用' : '未配置',
      lastSync: connectorTime(status.latestMessageAt),
      nextSync: running ? '长连接实时接收' : '完成配置后',
      signalCount: status.messageCount,
      syncedItems: status.messageCount,
      desc: status.error
        ? `飞书连接异常：${status.error}`
        : running
          ? '飞书机器人长连接已启用，群消息将实时进入 AI 销售伙伴。'
          : '配置飞书机器人 App ID 与 App Secret 后，通过官方长连接实时接收群消息。',
    } : item))
  }, [])

  const refreshFeishu = useCallback(async () => {
    try { applyFeishuStatus(await integrationApi.feishuStatus()) } catch { /* 本地演示模式保持卡片默认状态 */ }
  }, [applyFeishuStatus])

  const applyDraftImStatus = useCallback((status: DraftImConnectionStatus) => {
    const provider = status.provider
    setDraftImStatuses(current => ({ ...current, [provider]: status }))
    setDraftImForms(current => ({ ...current, [provider]: { ...current[provider], appId: current[provider].appId || status.appId } }))
    setConnectors(items => items.map(item => item.id === provider ? {
      ...item,
      status: status.configured ? 'configured' : 'not_connected',
      syncStatus: 'pending_auth',
      authUser: status.configured ? '应用配置已保存' : '未配置',
      lastSync: status.configured ? '等待 SDK 接入' : '尚未接入',
      nextSync: 'SDK 接入后实时同步',
      desc: status.configured
        ? `${item.name}应用配置已安全保存；当前为数据配置状态，尚未启用真实消息同步。`
        : initialConnectors.find(connector => connector.id === provider)?.desc ?? item.desc,
    } : item))
  }, [])

  const refreshDraftIm = useCallback(async () => {
    const results = await Promise.all(draftImProviders.map(async provider => {
      try { return await integrationApi.imStatus(provider) } catch { return null }
    }))
    results.forEach(status => { if (status) applyDraftImStatus(status) })
  }, [applyDraftImStatus])

  useEffect(() => {
    void refreshFeishu()
    void refreshDraftIm()
    const timer = window.setInterval(() => { void refreshFeishu() }, 10_000)
    return () => window.clearInterval(timer)
  }, [refreshDraftIm, refreshFeishu])

  useEffect(() => { localStorage.setItem('jm-crm-connectors', JSON.stringify(connectors)) }, [connectors])
  const stats = useMemo(() => ({ connected: connectors.filter(c => c.status === 'connected').length, healthy: connectors.filter(c => c.syncStatus === 'healthy').length, warnings: connectors.filter(c => c.syncStatus === 'warning' || c.status === 'not_connected' || c.status === 'configured').length, signals: connectors.reduce((sum, c) => sum + c.signalCount, 0) }), [connectors])

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200) }
  const authorize = (id: string) => {
    const target = connectors.find(c => c.id === id)
    if (!target) return
    if (id === 'feishu' || draftImProviders.includes(id as DraftImProvider)) {
      setExpanded(id)
      notify(`请完成${target.name}连接配置`)
      return
    }
    setConnectors(items => items.map(c => c.id === id ? { ...c, status: 'connected', syncStatus: 'healthy', authUser: currentUser.name, lastSync: '刚刚', nextSync: '15 分钟后', signalCount: c.signalCount || (id === 'email' ? 6 : 3), desc: `${c.name} 连接健康，AI 可在授权范围内识别客户上下文。` } : c))
    notify(`${target.name} 授权和连接测试成功`)
  }
  const saveFeishu = async () => {
    if (!feishuForm.appId.trim()) { notify('请输入飞书 App ID'); return }
    if (!feishuStatus?.hasSecret && !feishuForm.appSecret.trim()) { notify('请输入飞书 App Secret'); return }
    setSavingFeishu(true)
    try {
      await integrationApi.configureFeishu({
        appId: feishuForm.appId.trim(),
        appSecret: feishuForm.appSecret.trim() || undefined,
      })
      setFeishuForm(current => ({ ...current, appSecret: '' }))
      notify('飞书鉴权成功，群消息长连接已启用')
      await refreshFeishu()
    } catch (error) {
      notify(error instanceof ApiError ? error.message : '飞书连接失败，请检查凭证和应用权限')
    } finally {
      setSavingFeishu(false)
    }
  }
  const saveDraftIm = async (provider: DraftImProvider) => {
    const form = draftImForms[provider]
    const status = draftImStatuses[provider]
    const meta = imCredentialMeta[provider]
    if (!form.appId.trim()) { notify(`请输入${meta.idLabel}`); return }
    if (!status?.hasSecret && !form.appSecret.trim()) { notify(`请输入${meta.secretLabel}`); return }
    setSavingDraftIm(provider)
    try {
      const result = await integrationApi.configureIm(provider, {
        appId: form.appId.trim(), appSecret: form.appSecret.trim() || undefined,
      })
      setDraftImForms(current => ({ ...current, [provider]: { ...current[provider], appSecret: '' } }))
      applyDraftImStatus(result)
      notify(`${initialConnectors.find(item => item.id === provider)?.name}配置已保存，等待 SDK 接入`)
    } catch (error) {
      notify(error instanceof ApiError ? error.message : `${meta.title}保存失败，请检查后重试`)
    } finally {
      setSavingDraftIm(null)
    }
  }

  const renderCredentialPanel = (id: string, compact = false) => {
    if (id === 'feishu') return <div className={`feishu-credential-panel connector-credential-panel ${compact ? 'compact' : ''}`}>
      <div className="feishu-credential-heading"><span><ShieldCheck size={16} /> 飞书机器人凭证</span><p>App Secret 仅会加密保存在服务端，不会回传到浏览器。</p></div>
      <div className="feishu-credential-fields">
        <label><span>App ID</span><input value={feishuForm.appId} onChange={event => setFeishuForm(current => ({ ...current, appId: event.target.value }))} placeholder="cli_xxxxxxxxxxxxxxxx" autoComplete="off" /></label>
        <label><span>App Secret</span><div className="feishu-secret-input"><input type={showFeishuSecret ? 'text' : 'password'} value={feishuForm.appSecret} onChange={event => setFeishuForm(current => ({ ...current, appSecret: event.target.value }))} placeholder={feishuStatus?.hasSecret ? '已安全保存，留空表示不修改' : '请输入 App Secret'} autoComplete="new-password" /><button type="button" onClick={() => setShowFeishuSecret(value => !value)} aria-label={showFeishuSecret ? '隐藏 App Secret' : '显示 App Secret'}>{showFeishuSecret ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
      </div>
      <div className="feishu-credential-footer"><div><i className={feishuStatus?.status ?? 'idle'} /><span>{feishuStatus?.status === 'connected' ? '长连接正常' : feishuStatus?.status === 'connecting' ? '正在建立长连接' : feishuStatus?.status === 'reconnecting' ? '正在重连' : feishuStatus?.status === 'failed' ? '连接异常' : '待配置'}</span></div><button className="feishu-save-button" onClick={() => void saveFeishu()} disabled={savingFeishu}><KeyRound size={14} /> {savingFeishu ? '验证并连接中…' : feishuStatus?.configured ? '保存并重新测试' : '保存并连接'}</button></div>
    </div>
    if (!draftImProviders.includes(id as DraftImProvider)) return null
    const provider = id as DraftImProvider
    const meta = imCredentialMeta[provider]
    const form = draftImForms[provider]
    const status = draftImStatuses[provider]
    const showSecret = showDraftImSecret[provider]
    return <div className={`feishu-credential-panel connector-credential-panel connector-credential-${provider} ${compact ? 'compact' : ''}`}>
      <div className="feishu-credential-heading"><span><ShieldCheck size={16} /> {meta.title}</span><p>{meta.description}</p></div>
      <div className="connector-config-notice"><Sparkles size={13} /><span>配置准备模式</span><p>先保存接入参数，不会请求渠道接口或接收真实消息。</p></div>
      <div className="feishu-credential-fields">
        <label><span>{meta.idLabel}</span><input value={form.appId} onChange={event => setDraftImForms(current => ({ ...current, [provider]: { ...current[provider], appId: event.target.value } }))} placeholder={meta.idPlaceholder} autoComplete="off" /></label>
        <label><span>{meta.secretLabel}</span><div className="feishu-secret-input"><input type={showSecret ? 'text' : 'password'} value={form.appSecret} onChange={event => setDraftImForms(current => ({ ...current, [provider]: { ...current[provider], appSecret: event.target.value } }))} placeholder={status?.hasSecret ? '已安全保存，留空表示不修改' : `请输入${meta.secretLabel}`} autoComplete="new-password" /><button type="button" onClick={() => setShowDraftImSecret(current => ({ ...current, [provider]: !current[provider] }))} aria-label={showSecret ? `隐藏${meta.secretLabel}` : `显示${meta.secretLabel}`}>{showSecret ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
      </div>
      <div className="feishu-credential-footer"><div><i className={status?.configured ? 'configured' : 'idle'} /><span>{status?.configured ? '配置已保存 · SDK 待接入' : '等待填写配置'}</span></div><button className="feishu-save-button" onClick={() => void saveDraftIm(provider)} disabled={savingDraftIm === provider}><KeyRound size={14} /> {savingDraftIm === provider ? '安全保存中…' : status?.configured ? '更新配置' : '保存配置'}</button></div>
    </div>
  }
  const sync = (ids: string[]) => {
    const valid = connectors.filter(c => ids.includes(c.id) && c.status === 'connected').map(c => c.id)
    if (!valid.length) return
    setSyncing(valid)
    window.setTimeout(() => {
      setConnectors(items => items.map(c => valid.includes(c.id) ? { ...c, syncStatus: 'healthy', lastSync: '刚刚', nextSync: '15 分钟后', syncedItems: c.syncedItems + 2, signalCount: c.signalCount + 1, desc: `${c.name} 已完成手动同步，新上下文会进入 AI 销售伙伴分析。` } : c))
      setSyncing([]); notify(valid.length > 1 ? '已同步所有已授权连接器' : '连接器同步完成')
    }, 700)
  }

  const toggleTrigger = (value: string) => setSetup(current => ({
    ...current,
    triggers: current.triggers.includes(value) ? current.triggers.filter(item => item !== value) : [...current.triggers, value],
  }))

  const finishWizard = () => {
    setPolicy(current => ({ ...current, mode: policy.mode, keywords: setup.keywords, protectionDays: setup.protectionDays }))
    setWizardOpen(false)
    setWizardStep(0)
    setWizardChannel(null)
    setTestResult(false)
    notify('配置向导已完成，追踪与报备规则已生效')
  }

  const renderWizardStep = () => {
    if (wizardStep === 0) return <div className="connector-wizard-fields">
      <label className="readonly"><span>当前账号</span><strong>{currentUser.name}</strong><em>当前登录身份</em></label>
      <label className="readonly"><span>角色与团队</span><strong>{roleName(currentUser.role)} · Scale X 销售团队</strong><em>决定商机与上下文可见范围</em></label>
      <label><span>默认策略</span><select value={policy.mode} onChange={e => setPolicy(current => ({ ...current, mode: e.target.value }))}><option>提醒模式</option><option>助手模式</option><option>自动模式</option></select><em>控制 AI 销售伙伴的自动化程度</em></label>
      <label><span>商机报备模式</span><select value={setup.reportMode} onChange={e => setSetup(current => ({ ...current, reportMode: e.target.value }))}><option>人工确认后报备</option><option>AI 直接报备</option></select><em>正式报备仍会执行撞单与权限校验</em></label>
    </div>
    if (wizardStep === 1) return <div className="connector-wizard-channel-step"><div className="connector-wizard-channel-grid">{connectors.map(item => {
      const isImConfigurable = item.id === 'feishu' || draftImProviders.includes(item.id as DraftImProvider)
      const statusLabel = item.status === 'connected' ? '已连接' : item.status === 'configured' ? '已配置 · 待接入' : '未配置'
      return <article key={item.id} className={`${item.status} connector-channel-${item.id} ${wizardChannel === item.id ? 'selected' : ''}`}><div><span><ConnectorBrandLogo id={item.id} /></span><div><strong>{item.name}</strong>{item.type !== 'IM' && <small>{item.type}</small>}</div><b>{statusLabel}</b></div><p>{item.desc}</p><button className={item.status === 'not_connected' ? 'primary' : 'secondary'} onClick={() => isImConfigurable ? setWizardChannel(item.id) : authorize(item.id)}>{isImConfigurable ? '连接配置' : item.status === 'connected' ? '重新测试' : `授权${item.name}`}</button></article>
    })}</div>{wizardChannel && (wizardChannel === 'feishu' || draftImProviders.includes(wizardChannel as DraftImProvider)) && <div className="connector-wizard-inline-config"><div className="connector-wizard-inline-head"><span>正在配置：{connectors.find(item => item.id === wizardChannel)?.name}</span><button type="button" onClick={() => setWizardChannel(null)}><X size={14} /> 收起</button></div>{renderCredentialPanel(wizardChannel, true)}</div>}</div>
    if (wizardStep === 2) return <div className="connector-wizard-fields">
      <label><span>追踪群聊</span><textarea value={setup.trackingGroups} onChange={e => setSetup(current => ({ ...current, trackingGroups: e.target.value }))} /><em>多个群聊用顿号分隔</em></label>
      <label><span>重点客户</span><textarea value={setup.keyAccounts} onChange={e => setSetup(current => ({ ...current, keyAccounts: e.target.value }))} /><em>优先识别这些客户的商机信号</em></label>
      <label className="wide"><span>识别关键词</span><input value={setup.keywords} onChange={e => setSetup(current => ({ ...current, keywords: e.target.value }))} /><em>支持使用逗号或顿号分隔</em></label>
      <div className="connector-wizard-checks wide"><span>触发方式（可多选）</span><div>{['群聊 @', '转发消息', '私聊识别', '每日巡检'].map(item => <label key={item}><input type="checkbox" checked={setup.triggers.includes(item)} onChange={() => toggleTrigger(item)} /><i /><b>{item}</b></label>)}</div><em>至少选择一种信号触发方式</em></div>
    </div>
    if (wizardStep === 3) return <div className="connector-wizard-fields">
      <label><span>自动生成线索草稿</span><select value={setup.autoDraft} onChange={e => setSetup(current => ({ ...current, autoDraft: e.target.value }))}><option>开启</option><option>关闭</option></select><em>识别结果先保存为可编辑草稿</em></label>
      <label><span>自动创建正式商机</span><select value={setup.autoOpportunity} onChange={e => setSetup(current => ({ ...current, autoOpportunity: e.target.value }))}><option>关闭</option><option>需销售确认</option><option>AI 直接报备</option></select><em>直接报备会自动申请保护</em></label>
      <label><span>撞单保护</span><select value={setup.conflictPolicy} onChange={e => setSetup(current => ({ ...current, conflictPolicy: e.target.value }))}><option>疑似撞单人工确认</option><option>所有撞单均人工确认</option><option>仅提醒，不自动拦截</option></select><em>正式落库前执行服务端撞单校验</em></label>
      <label><span>默认保护期</span><div className="connector-number-input"><input type="number" min={1} max={180} value={setup.protectionDays} onChange={e => setSetup(current => ({ ...current, protectionDays: Number(e.target.value) }))} /><b>天</b></div><em>支持 1–180 天</em></label>
    </div>
    return <div className="connector-test-run"><textarea value={setup.testText} onChange={e => { setTestResult(false); setSetup(current => ({ ...current, testText: e.target.value })) }} /><button onClick={() => setTestResult(true)}><PlayCircle size={16} /> 试跑 AI 报备</button><span>不会创建正式商机</span>{testResult && <section><div><CheckCircle2 size={20} /><strong>识别完成，可进入人工确认</strong></div><p><b>客户：</b>示例品牌客户　<b>预算：</b>20–50 万　<b>阶段：</b>初步接触</p><p><b>识别依据：</b>预算、方案、交付周期　<b>撞单预检：</b>未发现已保护商机</p></section>}</div>
  }

  const renderGroup = (title: string, subtitle: string, ids: string[]) => <section className="connector-group">
    <div className="connector-group-title"><div><h2>{title}</h2><p>{subtitle}</p></div><span>{connectors.filter(c => ids.includes(c.id) && c.status === 'connected').length}/{ids.length} 已连接</span></div>
    <div className="connector-list">{connectors.filter(c => ids.includes(c.id)).map(item => {
      const isSyncing = syncing.includes(item.id); const open = expanded === item.id
      return <article key={item.id} className={`connector-card connector-channel-${item.id} ${item.syncStatus}`}>
        <div className="connection-head"><div className="connector-identity"><div className="connector-logo"><ConnectorBrandLogo id={item.id} /></div><div>{item.type !== 'IM' && <span>{item.type}</span>}<h3>{item.name}</h3></div></div><div className="connector-state"><span className={`connector-status ${item.status}`}>{item.status === 'connected' ? <CheckCircle2 size={13} /> : item.status === 'configured' ? <Settings2 size={13} /> : <AlertCircle size={13} />}{item.status === 'connected' ? '已连接' : item.status === 'configured' ? '已配置' : '未连接'}</span><span className={`sync-status ${item.syncStatus}`}>{item.syncStatus === 'healthy' ? '同步正常' : item.syncStatus === 'warning' ? '待处理' : item.status === 'configured' ? 'SDK 待接入' : '等待授权'}</span></div></div>
        <p className="connector-description">{item.desc}</p>
        <div className="connector-meta"><div><span>授权账号</span><strong>{item.authUser}</strong></div><div><span>最近同步</span><strong>{item.lastSync}</strong></div><div><span>下次同步</span><strong>{item.nextSync}</strong></div><div><span>识别信号</span><strong>{item.signalCount} 条</strong></div></div>
        <div className={`connector-scope ${open ? 'open' : ''}`}><div><span>同步范围</span><p>{item.scope}</p></div><div><span>共享范围</span><p>{item.sharedTo}</p></div><div><span>已处理记录</span><p>{item.syncedItems} 条</p></div></div>
        {(item.id === 'feishu' || draftImProviders.includes(item.id as DraftImProvider)) && open && renderCredentialPanel(item.id)}
        <div className="connector-actions"><button className={item.status === 'connected' || item.status === 'configured' ? 'secondary' : 'primary'} onClick={() => authorize(item.id)}>{item.id === 'feishu' || draftImProviders.includes(item.id as DraftImProvider) ? '连接配置' : item.status === 'connected' ? '重新测试' : `授权${item.name}`}</button><button className="secondary" disabled={item.id !== 'feishu' && (item.status !== 'connected' || isSyncing)} onClick={() => item.id === 'feishu' ? void refreshFeishu() : sync([item.id])}><RefreshCw size={13} className={isSyncing ? 'spin' : ''} /> {item.id === 'feishu' ? '刷新状态' : item.status === 'configured' ? 'SDK 待接入' : isSyncing ? '同步中' : '立即同步'}</button><button className="ghost" onClick={() => setExpanded(open ? null : item.id)}>范围设置 {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button></div>
      </article>
    })}</div>
  </section>

  const wizardSteps = ['确认身份', '连接渠道', '追踪范围', '报备策略', '试跑验证']

  return <div className="connectors-page">
    <header className="connectors-header"><div><span className="ai-kicker"><Link2 size={13} /> DATA CONNECTIONS</span><h1>商机连接器</h1><p>管理 IM、邮箱、会议和表单的授权、同步状态与上下文共享范围。</p></div><div><button className="connector-wizard-entry" onClick={() => { setWizardStep(0); setWizardChannel(null); setWizardOpen(true) }}><Rocket size={16} /> 进入配置向导</button><button className="connector-settings-btn" onClick={() => setSettingsOpen(v => !v)}><Settings2 size={16} /> 追踪与报备策略</button><button className="connector-sync-all" onClick={() => sync(connectors.map(c => c.id))} disabled={syncing.length > 0}><RefreshCw size={16} className={syncing.length ? 'spin' : ''} /> 全部同步</button></div></header>
    {settingsOpen && <section className="connector-policy glass-card"><div><span><Sparkles size={16} /> AI 策略配置</span><p>规则仅作用于已授权渠道。</p></div><label>默认策略<select value={policy.mode} onChange={e => setPolicy(v => ({ ...v, mode: e.target.value }))}><option>提醒模式</option><option>助手模式</option><option>自动模式</option></select></label><label>识别关键词<input value={policy.keywords} onChange={e => setPolicy(v => ({ ...v, keywords: e.target.value }))} /></label><label>默认保护期<div><input type="number" min={1} max={180} value={policy.protectionDays} onChange={e => setPolicy(v => ({ ...v, protectionDays: Number(e.target.value) }))} /><span>天</span></div></label><button onClick={() => { setSettingsOpen(false); notify('连接器策略已保存') }}><Check size={15} /> 保存策略</button></section>}
    <div className="connector-metrics"><div><span><Link2 size={17} /> 已授权渠道</span><strong>{stats.connected}</strong><p>共 {connectors.length} 类销售上下文</p></div><div><span><CheckCircle2 size={17} /> 健康同步</span><strong>{stats.healthy}</strong><p>可持续生成 AI 信号</p></div><div><span><AlertCircle size={17} /> 待处理</span><strong>{stats.warnings}</strong><p>需要授权或补充信息</p></div><div><span><Sparkles size={17} /> 本周识别信号</span><strong>{stats.signals}</strong><p>来自 IM、邮件与会议</p></div></div>
    <div className="connector-advice-card"><div><span>配置建议</span><h3>优先补齐邮箱授权</h3><p>接入邮箱后可自动识别方案、报价和合同往来，并增强撞单证据链。</p></div><button onClick={() => authorize('email')}> 授权邮箱</button></div>
    {renderGroup('IM 渠道', '客户沟通、群聊巡检与线索转发', ['feishu', 'wecom', 'dingtalk', 'jingme'])}
    {renderGroup('其他数据源', '邮件、会议纪要与营销表单', ['email', 'meeting', 'form'])}
    {wizardOpen && <div className="connector-wizard-backdrop" onMouseDown={event => event.target === event.currentTarget && setWizardOpen(false)}><section className="connector-wizard-modal"><header><div><span><Rocket size={18} /> Scale X 配置向导</span><p>5 步完成渠道授权、追踪范围、报备策略与试跑验证</p></div><div><button onClick={() => setWizardStep(4)}>跳到试跑</button><button className="close" onClick={() => setWizardOpen(false)} aria-label="关闭配置向导"><X size={18} /></button></div></header><div className="connector-wizard-layout"><aside>{wizardSteps.map((label, index) => <button key={label} className={index === wizardStep ? 'active' : index < wizardStep ? 'done' : ''} onClick={() => setWizardStep(index)}><i>{index < wizardStep ? <Check size={14} /> : index + 1}</i><span>{label}</span></button>)}</aside><main><div className="connector-wizard-title"><div><b>步骤 {wizardStep + 1}/5</b><h2>{wizardSteps[wizardStep]}</h2></div><span>{['确认账号权限和默认工作模式', '授权需要进入商机上下文的工作渠道', '设置需要持续关注的群聊、客户与关键词', '选择线索草稿、正式报备与撞单保护规则', '用一条客户线索验证 AI 报备流程'][wizardStep]}</span></div>{renderWizardStep()}<footer><button className="secondary" disabled={wizardStep === 0} onClick={() => setWizardStep(step => Math.max(0, step - 1))}><ArrowLeft size={15} /> 上一步</button><button className="primary" onClick={() => wizardStep === wizardSteps.length - 1 ? finishWizard() : setWizardStep(step => step + 1)}>{wizardStep === wizardSteps.length - 1 ? <><Check size={15} /> 完成配置</> : <>下一步 <ArrowRight size={15} /></>}</button></footer></main></div></section></div>}
    {toast && <div className="connector-toast"><CheckCircle2 size={16} /> {toast}</div>}
  </div>
}
