import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, ChevronDown, ChevronUp, Clock3, Link2, Mail, MessageSquare, RefreshCw, Settings2, Sparkles, Users, Video } from 'lucide-react'
import { useStore } from '../store'

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
  { id: 'dingtalk', name: '钉钉', type: 'IM', status: 'disabled', syncStatus: 'paused', authUser: '系统配置', scope: '客户群、项目群、销售转发消息', sharedTo: '按商机归属共享摘要信号', lastSync: '未启用', nextSync: 'P1 启用', signalCount: 0, syncedItems: 0, desc: 'P1 连接器占位，用于客户沟通和项目群巡检。' },
  { id: 'jingme', name: '京 Me', type: 'IM', status: 'disabled', syncStatus: 'paused', authUser: '系统配置', scope: '内部协同群、客户项目群、转发线索', sharedTo: '仅生成商机上下文摘要', lastSync: '未启用', nextSync: 'P1 启用', signalCount: 0, syncedItems: 0, desc: 'P1 连接器占位，用于线索流转和项目协同。' },
  { id: 'email', name: '邮箱', type: '邮件', status: 'not_connected', syncStatus: 'pending_auth', authUser: '未授权', scope: '收件箱白名单、客户域名、报价 / 方案文件夹', sharedTo: '仅生成线索草稿，敏感正文默认不共享', lastSync: '未同步', nextSync: '完成授权后', signalCount: 0, syncedItems: 0, desc: '待授权企业邮箱，支持限定文件夹和客户域名白名单。' },
  { id: 'meeting', name: '会议', type: '会议纪要', status: 'connected', syncStatus: 'warning', authUser: '当前账号', scope: '飞书妙记、手动上传纪要、Demo 会议摘要', sharedTo: '关联商机团队可见纪要摘要', lastSync: '昨天 18:10', nextSync: '待补充会议链接', signalCount: 5, syncedItems: 9, desc: '会议纪要已接入，最近一次 Demo 会议缺少客户名称。' },
  { id: 'form', name: '表单', type: '表单', status: 'disabled', syncStatus: 'paused', authUser: '系统配置', scope: '活动报名、官网试用、渠道提交表单', sharedTo: '按线索归属规则分配给销售', lastSync: '未启用', nextSync: 'P1 启用', signalCount: 0, syncedItems: 0, desc: 'P1 连接器占位，用于接收活动报名和官网表单。' },
]

const iconFor = (id: string) => id === 'email' ? Mail : id === 'meeting' ? Video : id === 'form' ? Users : MessageSquare

export default function Connectors() {
  const currentUser = useStore(s => s.currentUser)
  const [connectors, setConnectors] = useState<Connector[]>(() => {
    try { const saved = localStorage.getItem('jm-crm-connectors'); return saved ? JSON.parse(saved) : initialConnectors } catch { return initialConnectors }
  })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string[]>([])
  const [toast, setToast] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [policy, setPolicy] = useState({ mode: '助手模式', keywords: '预算、Demo、报价、合同、试点、采购', protectionDays: 30 })

  useEffect(() => { localStorage.setItem('jm-crm-connectors', JSON.stringify(connectors)) }, [connectors])
  const stats = useMemo(() => ({ connected: connectors.filter(c => c.status === 'connected').length, healthy: connectors.filter(c => c.syncStatus === 'healthy').length, warnings: connectors.filter(c => c.syncStatus === 'warning' || c.status === 'not_connected').length, signals: connectors.reduce((sum, c) => sum + c.signalCount, 0) }), [connectors])

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200) }
  const authorize = (id: string) => {
    const target = connectors.find(c => c.id === id)
    if (!target || target.status === 'disabled') { notify(`${target?.name ?? ''} 为后续能力，当前仅展示规划与配置入口`); return }
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

  const renderGroup = (title: string, subtitle: string, ids: string[]) => <section className="connector-group">
    <div className="connector-group-title"><div><h2>{title}</h2><p>{subtitle}</p></div><span>{connectors.filter(c => ids.includes(c.id) && c.status === 'connected').length}/{ids.length} 已连接</span></div>
    <div className="connector-list">{connectors.filter(c => ids.includes(c.id)).map(item => {
      const Icon = iconFor(item.id); const isSyncing = syncing.includes(item.id); const open = expanded === item.id
      return <article key={item.id} className={`connector-card ${item.syncStatus}`}>
        <div className="connector-card-main">
          <div className="connector-logo"><Icon size={22} /></div>
          <div className="connector-copy"><div><span>{item.type}</span><h3>{item.name}</h3></div><p>{item.desc}</p></div>
          <div className="connector-state"><span className={`connector-status ${item.status}`}>{item.status === 'connected' ? <CheckCircle2 size={13} /> : item.status === 'disabled' ? <Clock3 size={13} /> : <AlertCircle size={13} />}{item.status === 'connected' ? '已连接' : item.status === 'disabled' ? '占位' : '未连接'}</span><span className={`sync-status ${item.syncStatus}`}>{item.syncStatus === 'healthy' ? '同步正常' : item.syncStatus === 'warning' ? '待处理' : item.syncStatus === 'pending_auth' ? '等待授权' : '未启用'}</span></div>
          <div className="connector-meta"><div><span>授权账号</span><strong>{item.authUser}</strong></div><div><span>最近同步</span><strong>{item.lastSync}</strong></div><div><span>识别信号</span><strong>{item.signalCount} 条</strong></div></div>
          <div className="connector-actions"><button className={item.status === 'connected' ? 'secondary' : 'primary'} onClick={() => authorize(item.id)}>{item.status === 'connected' ? '重新测试' : item.status === 'disabled' ? '查看规划' : `授权${item.name}`}</button><button className="secondary" disabled={item.status !== 'connected' || isSyncing} onClick={() => sync([item.id])}><RefreshCw size={13} className={isSyncing ? 'spin' : ''} /> {isSyncing ? '同步中' : '立即同步'}</button><button className="ghost" onClick={() => setExpanded(open ? null : item.id)}>范围设置 {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button></div>
        </div>
        {open && <div className="connector-scope"><div><span>同步范围</span><p>{item.scope}</p></div><div><span>共享范围</span><p>{item.sharedTo}</p></div><div><span>下次同步</span><p>{item.nextSync}</p></div><div><span>已处理记录</span><p>{item.syncedItems} 条</p></div></div>}
      </article>
    })}</div>
  </section>

  return <div className="connectors-page">
    <header className="connectors-header"><div><span className="ai-kicker"><Link2 size={13} /> DATA CONNECTIONS</span><h1>商机连接器</h1><p>管理 IM、邮箱、会议和表单的授权、同步状态与上下文共享范围。</p></div><div><button className="connector-settings-btn" onClick={() => setSettingsOpen(v => !v)}><Settings2 size={16} /> 追踪与报备策略</button><button className="connector-sync-all" onClick={() => sync(connectors.map(c => c.id))} disabled={syncing.length > 0}><RefreshCw size={16} className={syncing.length ? 'spin' : ''} /> 全部同步</button></div></header>
    {settingsOpen && <section className="connector-policy glass-card"><div><span><Sparkles size={16} /> AI 策略配置</span><p>规则仅作用于已授权渠道。</p></div><label>默认策略<select value={policy.mode} onChange={e => setPolicy(v => ({ ...v, mode: e.target.value }))}><option>提醒模式</option><option>助手模式</option><option>自动模式</option></select></label><label>识别关键词<input value={policy.keywords} onChange={e => setPolicy(v => ({ ...v, keywords: e.target.value }))} /></label><label>默认保护期<div><input type="number" min={1} max={180} value={policy.protectionDays} onChange={e => setPolicy(v => ({ ...v, protectionDays: Number(e.target.value) }))} /><span>天</span></div></label><button onClick={() => { setSettingsOpen(false); notify('连接器策略已保存') }}><Check size={15} /> 保存策略</button></section>}
    <div className="connector-metrics"><div><span><Link2 size={17} /> 已授权渠道</span><strong>{stats.connected}</strong><p>共 {connectors.length} 类销售上下文</p></div><div><span><CheckCircle2 size={17} /> 健康同步</span><strong>{stats.healthy}</strong><p>可持续生成 AI 信号</p></div><div><span><AlertCircle size={17} /> 待处理</span><strong>{stats.warnings}</strong><p>需要授权或补充信息</p></div><div><span><Sparkles size={17} /> 本周识别信号</span><strong>{stats.signals}</strong><p>来自 IM、邮件与会议</p></div></div>
    <div className="connector-advice-card"><div><span>配置建议</span><h3>优先补齐邮箱授权</h3><p>接入邮箱后可自动识别方案、报价和合同往来，并增强撞单证据链。</p></div><button onClick={() => authorize('email')}> 授权邮箱</button></div>
    {renderGroup('IM 渠道', '客户沟通、群聊巡检与线索转发', ['feishu', 'wecom', 'dingtalk', 'jingme'])}
    {renderGroup('其他数据源', '邮件、会议纪要与营销表单', ['email', 'meeting', 'form'])}
    {toast && <div className="connector-toast"><CheckCircle2 size={16} /> {toast}</div>}
  </div>
}
