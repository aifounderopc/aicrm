import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Link2, Mail, MessageSquare, PlayCircle, RefreshCw, Rocket, Settings2, Sparkles, Users, Video, X } from 'lucide-react'
import { useStore } from '../store'
import { roleName } from '../utils'

type ConnectorStatus = 'connected' | 'not_connected' | 'disabled'
type SyncStatus = 'healthy' | 'warning' | 'pending_auth' | 'paused'
type Connector = {
  id: string; name: string; type: string; status: ConnectorStatus; syncStatus: SyncStatus
  authUser: string; scope: string; sharedTo: string; lastSync: string; nextSync: string
  signalCount: number; syncedItems: number; desc: string
}

const initialConnectors: Connector[] = [
  { id: 'feishu', name: '飞书', type: 'IM', status: 'connected', syncStatus: 'healthy', authUser: '当前账号', scope: '私聊、客户群 @、转发消息、指定项目群巡检', sharedTo: '本人商机、管理员可见聚合信号', lastSync: '今天 13:48', nextSync: '15 分钟后', signalCount: 18, syncedItems: 126, desc: '已授权个人身份，可在授权范围内识别客户上下文。' },
  { id: 'wecom', name: '企微', type: 'IM', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未授权', scope: '客户群、外部联系人、会话存档授权范围', sharedTo: '仅同步客户信号摘要', lastSync: '未同步', nextSync: '完成授权后', signalCount: 0, syncedItems: 0, desc: '待接入企微客户群与外部联系人。' },
  { id: 'dingtalk', name: '钉钉', type: 'IM', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未授权', scope: '客户群、项目群、销售转发消息', sharedTo: '按商机归属共享摘要信号', lastSync: '未同步', nextSync: '完成授权后', signalCount: 0, syncedItems: 0, desc: '接入钉钉客户沟通与项目群巡检，持续识别商机进展。' },
  { id: 'jingme', name: '京 Me', type: 'IM', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未授权', scope: '内部协同群、客户项目群、转发线索', sharedTo: '仅生成商机上下文摘要', lastSync: '未同步', nextSync: '完成授权后', signalCount: 0, syncedItems: 0, desc: '接入京 Me 线索流转与项目协同，形成可追踪商机上下文。' },
  { id: 'email', name: '邮箱', type: '邮件', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未授权', scope: '收件箱白名单、客户域名、报价 / 方案文件夹', sharedTo: '仅生成线索草稿，敏感正文默认不共享', lastSync: '未同步', nextSync: '完成授权后', signalCount: 0, syncedItems: 0, desc: '待授权企业邮箱，支持限定文件夹和客户域名白名单。' },
  { id: 'meeting', name: '会议', type: '会议纪要', status: 'connected', syncStatus: 'warning', authUser: '当前账号', scope: '飞书妙记、手动上传纪要、Demo 会议摘要', sharedTo: '关联商机团队可见纪要摘要', lastSync: '昨天 18:10', nextSync: '待补充会议链接', signalCount: 5, syncedItems: 9, desc: '会议纪要已接入，最近一次 Demo 会议缺少客户名称。' },
  { id: 'form', name: '表单', type: '表单', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未授权', scope: '活动报名、官网试用、渠道提交表单', sharedTo: '按线索归属规则分配给销售', lastSync: '未同步', nextSync: '完成授权后', signalCount: 0, syncedItems: 0, desc: '接收活动报名、官网试用和渠道表单，自动生成线索草稿。' },
]

const normalizeConnectors = (items: Connector[]) => items.map(item => {
  const base = initialConnectors.find(connector => connector.id === item.id)
  if (!base) return item
  if (item.status === 'disabled') return base
  return item
})

const iconFor = (id: string) => id === 'email' ? Mail : id === 'meeting' ? Video : id === 'form' ? Users : MessageSquare

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
  const [setup, setSetup] = useState({
    reportMode: '人工确认后报备', trackingGroups: '重点客户群、项目交付群', keyAccounts: '核心品牌客户、重点续约客户', keywords: '预算、Demo、报价、合同、试点、采购',
    triggers: ['群聊 @', '转发消息', '私聊识别', '每日巡检'], autoDraft: '开启', autoOpportunity: '需销售确认', conflictPolicy: '疑似撞单人工确认', protectionDays: 30,
    testText: '客户计划本月启动品牌营销项目，预算约 50 万，希望下周确认方案和交付周期。',
  })

  useEffect(() => { localStorage.setItem('jm-crm-connectors', JSON.stringify(connectors)) }, [connectors])
  const stats = useMemo(() => ({ connected: connectors.filter(c => c.status === 'connected').length, healthy: connectors.filter(c => c.syncStatus === 'healthy').length, warnings: connectors.filter(c => c.syncStatus === 'warning' || c.status === 'not_connected').length, signals: connectors.reduce((sum, c) => sum + c.signalCount, 0) }), [connectors])

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200) }
  const authorize = (id: string) => {
    const target = connectors.find(c => c.id === id)
    if (!target) return
    setConnectors(items => items.map(c => c.id === id ? { ...c, status: 'connected', syncStatus: 'healthy', authUser: currentUser.name, lastSync: '刚刚', nextSync: '15 分钟后', signalCount: c.signalCount || (id === 'email' ? 6 : 3), desc: `${c.name} 连接健康，AI 可在授权范围内识别客户上下文。` } : c))
    notify(`${target.name} 授权和连接测试成功`)
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
    if (wizardStep === 1) return <div className="connector-wizard-channel-grid">{connectors.map(item => { const Icon = iconFor(item.id); return <article key={item.id} className={item.status}><div><span><Icon size={19} /></span><div><strong>{item.name}</strong><small>{item.type}</small></div><b>{item.status === 'connected' ? '已连接' : '未连接'}</b></div><p>{item.desc}</p><button className={item.status === 'connected' ? 'secondary' : 'primary'} onClick={() => authorize(item.id)}>{item.status === 'connected' ? '重新测试' : `授权${item.name}`}</button></article> })}</div>
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
      const Icon = iconFor(item.id); const isSyncing = syncing.includes(item.id); const open = expanded === item.id
      return <article key={item.id} className={`connector-card ${item.syncStatus}`}>
        <div className="connection-head"><div className="connector-identity"><div className="connector-logo"><Icon size={22} /></div><div><span>{item.type}</span><h3>{item.name}</h3></div></div><div className="connector-state"><span className={`connector-status ${item.status}`}>{item.status === 'connected' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}{item.status === 'connected' ? '已连接' : '未连接'}</span><span className={`sync-status ${item.syncStatus}`}>{item.syncStatus === 'healthy' ? '同步正常' : item.syncStatus === 'warning' ? '待处理' : '等待授权'}</span></div></div>
        <p className="connector-description">{item.desc}</p>
        <div className="connector-meta"><div><span>授权账号</span><strong>{item.authUser}</strong></div><div><span>最近同步</span><strong>{item.lastSync}</strong></div><div><span>下次同步</span><strong>{item.nextSync}</strong></div><div><span>识别信号</span><strong>{item.signalCount} 条</strong></div></div>
        <div className={`connector-scope ${open ? 'open' : ''}`}><div><span>同步范围</span><p>{item.scope}</p></div><div><span>共享范围</span><p>{item.sharedTo}</p></div><div><span>已处理记录</span><p>{item.syncedItems} 条</p></div></div>
        <div className="connector-actions"><button className={item.status === 'connected' ? 'secondary' : 'primary'} onClick={() => authorize(item.id)}>{item.status === 'connected' ? '重新测试' : `授权${item.name}`}</button><button className="secondary" disabled={item.status !== 'connected' || isSyncing} onClick={() => sync([item.id])}><RefreshCw size={13} className={isSyncing ? 'spin' : ''} /> {isSyncing ? '同步中' : '立即同步'}</button><button className="ghost" onClick={() => setExpanded(open ? null : item.id)}>范围设置 {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button></div>
      </article>
    })}</div>
  </section>

  const wizardSteps = ['确认身份', '连接渠道', '追踪范围', '报备策略', '试跑验证']

  return <div className="connectors-page">
    <header className="connectors-header"><div><span className="ai-kicker"><Link2 size={13} /> DATA CONNECTIONS</span><h1>商机连接器</h1><p>管理 IM、邮箱、会议和表单的授权、同步状态与上下文共享范围。</p></div><div><button className="connector-wizard-entry" onClick={() => { setWizardStep(0); setWizardOpen(true) }}><Rocket size={16} /> 进入配置向导</button><button className="connector-settings-btn" onClick={() => setSettingsOpen(v => !v)}><Settings2 size={16} /> 追踪与报备策略</button><button className="connector-sync-all" onClick={() => sync(connectors.map(c => c.id))} disabled={syncing.length > 0}><RefreshCw size={16} className={syncing.length ? 'spin' : ''} /> 全部同步</button></div></header>
    {settingsOpen && <section className="connector-policy glass-card"><div><span><Sparkles size={16} /> AI 策略配置</span><p>规则仅作用于已授权渠道。</p></div><label>默认策略<select value={policy.mode} onChange={e => setPolicy(v => ({ ...v, mode: e.target.value }))}><option>提醒模式</option><option>助手模式</option><option>自动模式</option></select></label><label>识别关键词<input value={policy.keywords} onChange={e => setPolicy(v => ({ ...v, keywords: e.target.value }))} /></label><label>默认保护期<div><input type="number" min={1} max={180} value={policy.protectionDays} onChange={e => setPolicy(v => ({ ...v, protectionDays: Number(e.target.value) }))} /><span>天</span></div></label><button onClick={() => { setSettingsOpen(false); notify('连接器策略已保存') }}><Check size={15} /> 保存策略</button></section>}
    <div className="connector-metrics"><div><span><Link2 size={17} /> 已授权渠道</span><strong>{stats.connected}</strong><p>共 {connectors.length} 类销售上下文</p></div><div><span><CheckCircle2 size={17} /> 健康同步</span><strong>{stats.healthy}</strong><p>可持续生成 AI 信号</p></div><div><span><AlertCircle size={17} /> 待处理</span><strong>{stats.warnings}</strong><p>需要授权或补充信息</p></div><div><span><Sparkles size={17} /> 本周识别信号</span><strong>{stats.signals}</strong><p>来自 IM、邮件与会议</p></div></div>
    <div className="connector-advice-card"><div><span>配置建议</span><h3>优先补齐邮箱授权</h3><p>接入邮箱后可自动识别方案、报价和合同往来，并增强撞单证据链。</p></div><button onClick={() => authorize('email')}> 授权邮箱</button></div>
    {renderGroup('IM 渠道', '客户沟通、群聊巡检与线索转发', ['feishu', 'wecom', 'dingtalk', 'jingme'])}
    {renderGroup('其他数据源', '邮件、会议纪要与营销表单', ['email', 'meeting', 'form'])}
    {wizardOpen && <div className="connector-wizard-backdrop" onMouseDown={event => event.target === event.currentTarget && setWizardOpen(false)}><section className="connector-wizard-modal"><header><div><span><Rocket size={18} /> Scale X 配置向导</span><p>5 步完成渠道授权、追踪范围、报备策略与试跑验证</p></div><div><button onClick={() => setWizardStep(4)}>跳到试跑</button><button className="close" onClick={() => setWizardOpen(false)} aria-label="关闭配置向导"><X size={18} /></button></div></header><div className="connector-wizard-layout"><aside>{wizardSteps.map((label, index) => <button key={label} className={index === wizardStep ? 'active' : index < wizardStep ? 'done' : ''} onClick={() => setWizardStep(index)}><i>{index < wizardStep ? <Check size={14} /> : index + 1}</i><span>{label}</span></button>)}</aside><main><div className="connector-wizard-title"><div><b>步骤 {wizardStep + 1}/5</b><h2>{wizardSteps[wizardStep]}</h2></div><span>{['确认账号权限和默认工作模式', '授权需要进入商机上下文的工作渠道', '设置需要持续关注的群聊、客户与关键词', '选择线索草稿、正式报备与撞单保护规则', '用一条客户线索验证 AI 报备流程'][wizardStep]}</span></div>{renderWizardStep()}<footer><button className="secondary" disabled={wizardStep === 0} onClick={() => setWizardStep(step => Math.max(0, step - 1))}><ArrowLeft size={15} /> 上一步</button><button className="primary" onClick={() => wizardStep === wizardSteps.length - 1 ? finishWizard() : setWizardStep(step => step + 1)}>{wizardStep === wizardSteps.length - 1 ? <><Check size={15} /> 完成配置</> : <>下一步 <ArrowRight size={15} /></>}</button></footer></main></div></section></div>}
    {toast && <div className="connector-toast"><CheckCircle2 size={16} /> {toast}</div>}
  </div>
}
