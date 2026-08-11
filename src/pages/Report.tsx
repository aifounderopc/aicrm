import { useState, useRef } from 'react'
import { useStore } from '../store'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Upload, ChevronRight, ChevronLeft, ChevronDown, Lock, X, ImageIcon, Bot, CheckCircle2, FileText, MessageSquare, RefreshCw, Save, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { formatDate, daysUntil } from '../utils'
import type { IndustryType, AmountRange, ContactLevel, Opportunity } from '../types'
import { useMobile } from '../hooks/useMobile'

const industries: IndustryType[] = [
  '3C / 数码', '家电 / 智能硬件', '美妆 / 护肤', '食品 / 饮料', '酒水',
  '母婴 / 儿童', '大健康 / 医疗', '汽车 / 出行', '服装 / 时尚', '家居 / 家装',
  '宠物', '运动 / 户外', '餐饮 / 本地生活', '互联网 / 科技', '金融 / 保险',
  '教育 / 培训', '旅游 / 酒店', '娱乐 / 游戏', '奢侈品', '工业 / 制造', '房产 / 物业', '其他',
]

const amounts: { value: AmountRange; label: string }[] = [
  { value: 'under5',  label: '5万以下' },
  { value: '5to10',  label: '5～10万' },
  { value: '10to20', label: '10～20万' },
  { value: '20to50', label: '20～50万' },
  { value: 'above50', label: '50万以上' },
]

const contactTypeOptions = [
  { value: 'phone' as const,  label: '手机' },
  { value: 'wechat' as const, label: '微信' },
  { value: 'email' as const,  label: '企业邮箱' },
]

const steps = ['商家字段', '联系人信息', '需求与举证']

type ReportMode = 'ai' | 'manual'
type AiStatus = 'idle' | 'analyzing' | 'ready'
type AiDraft = {
  customerName: string
  companyName: string
  industry: IndustryType
  productInterest: 'JM 声访' | 'JM 外呼'
  source: 'direct' | 'channel'
  amountRange: AmountRange
  requirementDescription: string
  contactDepartment: string
  contactLevel: ContactLevel
  contactName: string
  contactTypes: ('phone' | 'email' | 'wechat')[]
  firstContactDate: string
  confidence: number
}

const sampleContext = '杭州某消费品客户想做新品试吃回访，对 JM 声访感兴趣，希望 7 月中旬前看方案，预算大概 20 万。飞书群里王总让我们尽快约 Demo，需求由市场部牵头。'

const inputStyle = {
  width: '100%', padding: '11px 14px', fontSize: 14,
  border: '1.5px solid rgba(14,120,160,0.18)', borderRadius: 12,
  outline: 'none', background: 'rgba(236,248,252,0.7)', color: '#111111',
  boxSizing: 'border-box' as const, fontFamily: 'inherit',
}

const labelStyle = { fontSize: 13, fontWeight: 600, color: '#2a5a70', marginBottom: 6, display: 'block' as const }

const readonlyBadge = (text: string) => (
  <div style={{
    padding: '11px 14px', fontSize: 14, fontWeight: 600, color: '#2a5a70',
    background: 'rgba(14,120,160,0.06)', borderRadius: 12, border: '1.5px solid rgba(14,120,160,0.15)',
  }}>{text}</div>
)

export default function Report() {
  const { currentUser, addOpportunity, channels, detectCollision } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<ReportMode>('ai')
  const [aiText, setAiText] = useState(sampleContext)
  const [aiStatus, setAiStatus] = useState<AiStatus>('idle')
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null)
  const [aiCollision, setAiCollision] = useState<Opportunity | null>(null)
  const [aiSimilar, setAiSimilar] = useState<Opportunity[]>([])
  const [aiCrossIndustry, setAiCrossIndustry] = useState<Opportunity[]>([])
  const [aiSaved, setAiSaved] = useState(false)
  const [step, setStep] = useState(0)
  const [collision, setCollision] = useState<Opportunity | null>(null)
  const [similar, setSimilar] = useState<Opportunity[]>([])
  const [crossIndustry, setCrossIndustry] = useState<Opportunity[]>([])
  const [success, setSuccess] = useState(false)

  const isMobile = useMobile()
  const isAdmin = currentUser.role === 'admin'
  const isChannel = currentUser.role === 'channel'
  const myChannel = isChannel ? channels.find(c => c.id === currentUser.channelId) : null

  const [evidenceFiles, setEvidenceFiles] = useState<{ id: string; name: string; url: string; size: number }[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = e => {
        setEvidenceFiles(prev => [...prev, {
          id: Math.random().toString(36).slice(2),
          name: file.name,
          url: e.target?.result as string,
          size: file.size,
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeFile = (id: string) => setEvidenceFiles(prev => prev.filter(f => f.id !== id))

  const [form, setForm] = useState({
    customerName: params.get('name') || '',
    companyName: '',
    industry: '' as IndustryType | '',
    productInterest: 'JM 声访' as 'JM 声访' | 'JM 外呼',
    source: (isChannel ? 'channel' : 'direct') as 'direct' | 'channel',
    channelId: myChannel?.id || '',
    channelName: myChannel?.name || '',
    channelManagerName: '',
    amountRange: '' as AmountRange | '',
    firstContactDate: '',
    requirementDescription: '',
    contactLevel: '执行层' as ContactLevel,
    contactDepartment: '',
    contactTypes: [] as ('phone' | 'email' | 'wechat')[],
    encryptedName: '',
    isSubsidiary: false,
    parentCompanyName: '',
  })

  const upd = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const inferIndustry = (text: string): IndustryType => {
    if (/美妆|护肤|会员/.test(text)) return '美妆 / 护肤'
    if (/汽车|车主|试驾/.test(text)) return '汽车 / 出行'
    if (/家电|硬件|3C|数码/.test(text)) return /家电/.test(text) ? '家电 / 智能硬件' : '3C / 数码'
    if (/酒|白酒|啤酒/.test(text)) return '酒水'
    if (/母婴|儿童/.test(text)) return '母婴 / 儿童'
    if (/食品|饮料|试吃|消费品/.test(text)) return '食品 / 饮料'
    return '其他'
  }

  const inferAmount = (text: string): AmountRange => {
    const matched = text.match(/(\d+(?:\.\d+)?)\s*万/)
    const amount = Number(matched?.[1] || 0)
    if (amount >= 50) return 'above50'
    if (amount >= 20) return '20to50'
    if (amount >= 10) return '10to20'
    if (amount >= 5) return '5to10'
    return 'under5'
  }

  const inferCustomerName = (text: string) => {
    const explicit = text.match(/(?:客户|品牌|公司)[：:\s]*([^，。；;\n]{2,22})/)
    if (explicit?.[1] && !/想|希望|需要|对/.test(explicit[1])) return explicit[1].trim()
    const leading = text.match(/^([^，。；;\n]{2,20}?(?:客户|品牌|集团|公司))/)
    return leading?.[1]?.trim() || text.split(/[，。；;\n]/)[0].slice(0, 16).trim()
  }

  const runAiDetection = () => {
    if (aiText.trim().length < 10) return
    setAiStatus('analyzing'); setAiDraft(null); setAiSaved(false)
    window.setTimeout(() => {
      const productInterest = /外呼|电销|线索触达/.test(aiText) ? 'JM 外呼' : 'JM 声访'
      const customerName = inferCustomerName(aiText)
      const industry = inferIndustry(aiText)
      const contactName = aiText.match(/([王李张刘陈赵周吴郑孙][总经理老师])/i)?.[1] || ''
      const contactTypes: ('phone' | 'email' | 'wechat')[] = /邮件|邮箱/.test(aiText) ? ['email'] : /电话|手机/.test(aiText) ? ['phone'] : ['wechat']
      const requirement = Array.from(aiText.trim()).slice(0, 120).join('')
      const draft: AiDraft = {
        customerName,
        companyName: '',
        industry,
        productInterest,
        source: isChannel ? 'channel' : 'direct',
        amountRange: inferAmount(aiText),
        requirementDescription: requirement,
        contactDepartment: aiText.match(/([^，。]{2,10}部)(?:牵头|负责|提出)?/)?.[1] || '市场部',
        contactLevel: /总|负责人|决策/.test(aiText) ? '决策层' : '执行层',
        contactName,
        contactTypes,
        firstContactDate: new Date().toISOString().slice(0, 10),
        confidence: contactName && /\d+\s*万/.test(aiText) ? 92 : 78,
      }
      const result = detectCollision(customerName, industry)
      setAiDraft(draft)
      setAiCollision(result.collision || null)
      setAiSimilar(result.similar)
      setAiCrossIndustry(result.crossIndustry)
      setAiStatus('ready')
    }, 650)
  }

  const updateAiDraft = <K extends keyof AiDraft>(key: K, value: AiDraft[K]) => setAiDraft(draft => draft ? ({ ...draft, [key]: value }) : draft)
  const aiHasConflict = !!aiCollision || aiSimilar.length > 0 || aiCrossIndustry.length > 0
  const aiMissing = aiDraft ? [
    !aiDraft.customerName && '客户名称', !aiDraft.industry && '所属行业', aiDraft.requirementDescription.length < 30 && '需求场景（至少 30 字）',
    !aiDraft.contactDepartment && '需求部门', !aiDraft.contactName && '联系人', !aiDraft.contactTypes.length && '联系方式',
  ].filter(Boolean) as string[] : []

  const createFromAiDraft = () => {
    if (!aiDraft || aiHasConflict || aiMissing.length) return
    setForm(formValue => ({ ...formValue,
      customerName: aiDraft.customerName, companyName: aiDraft.companyName, industry: aiDraft.industry,
      productInterest: aiDraft.productInterest, source: aiDraft.source, amountRange: aiDraft.amountRange,
      firstContactDate: aiDraft.firstContactDate, requirementDescription: aiDraft.requirementDescription,
      contactDepartment: aiDraft.contactDepartment, contactLevel: aiDraft.contactLevel,
      contactTypes: aiDraft.contactTypes, encryptedName: aiDraft.contactName,
    }))
    const result = addOpportunity({
      customerName: aiDraft.customerName,
      companyName: aiDraft.companyName || undefined,
      industry: aiDraft.industry,
      productInterests: [aiDraft.productInterest],
      source: aiDraft.source,
      channelId: aiDraft.source === 'channel' ? myChannel?.id : undefined,
      channelName: aiDraft.source === 'channel' ? myChannel?.name : undefined,
      channelManagerName: aiDraft.source === 'channel' ? currentUser.name : undefined,
      saOwnerId: currentUser.id, saOwnerName: currentUser.name,
      salesOwnerId: currentUser.id, salesOwnerName: currentUser.name,
      stage: 'reporting',
      contact: { level: aiDraft.contactLevel, department: aiDraft.contactDepartment, contactTypes: aiDraft.contactTypes, encryptedName: aiDraft.contactName },
      firstContactDate: aiDraft.firstContactDate,
      requirementDescription: aiDraft.requirementDescription,
      amountRange: aiDraft.amountRange,
      evidenceFiles: [],
      isSubsidiary: false,
    })
    if (result.success) setSuccess(true)
    else if (result.collision) setAiCollision(result.collision)
  }

  const toggleContactType = (t: 'phone' | 'email' | 'wechat') =>
    upd('contactTypes', form.contactTypes.includes(t)
      ? form.contactTypes.filter(x => x !== t)
      : [...form.contactTypes, t])

  const checkCollision = () => {
    if (!form.customerName || !form.industry) return
    const { collision: c, similar: s, crossIndustry: ci } = detectCollision(form.customerName, form.industry, form.companyName || undefined)
    setCollision(c || null)
    setSimilar(s)
    setCrossIndustry(ci)
  }

  const nextStep = () => {
    if (step === 0) {
      if (!form.customerName || !form.industry) return
      if (form.source === 'channel' && !form.channelManagerName.trim()) return
      const { collision: c, similar: s, crossIndustry: ci } = detectCollision(form.customerName, form.industry, form.companyName || undefined)
      setCollision(c || null)
      setSimilar(s)
      setCrossIndustry(ci)
      if (c || s.length > 0 || ci.length > 0) return
    }
    if (step === 1) {
      if (!form.contactDepartment.trim() || !form.encryptedName.trim() || form.contactTypes.length === 0) return
    }
    setStep(s => Math.min(s + 1, 2))
  }

  const submit = () => {
    if (!form.customerName || !form.industry || !form.amountRange || evidenceFiles.length === 0) return
    const result = addOpportunity({
      customerName: form.customerName,
      companyName: form.companyName || undefined,
      industry: form.industry as IndustryType,
      productInterests: [form.productInterest],
      source: form.source,
      channelId: form.channelId || undefined,
      channelName: form.channelName || undefined,
      channelManagerName: form.source === 'channel' ? form.channelManagerName : undefined,
      saOwnerId: currentUser.id,
      saOwnerName: currentUser.name,
      salesOwnerId: currentUser.id,
      salesOwnerName: currentUser.name,
      stage: 'reporting',
      contact: {
        level: form.contactLevel,
        department: form.contactDepartment,
        contactTypes: form.contactTypes,
        encryptedName: form.encryptedName,
        encryptedContact: undefined,
      },
      firstContactDate: form.firstContactDate,
      requirementDescription: form.requirementDescription,
      amountRange: form.amountRange as AmountRange,
      evidenceFiles: evidenceFiles.map(f => ({ id: f.id, name: f.name, url: f.url, uploadedAt: new Date().toISOString(), uploadedBy: currentUser.id })),
      isSubsidiary: form.isSubsidiary,
      parentCompanyName: form.parentCompanyName || undefined,
    })
    if (result.success) setSuccess(true)
    else if (result.collision) setCollision(result.collision)
  }

  if (success) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111111', margin: '0 0 8px' }}>报备成功！</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 28px' }}>
          客户「{form.customerName}」已锁定 30 天
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={() => navigate('/my')} style={{
            background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)', color: 'white',
            border: 'none', padding: '12px 24px', borderRadius: 14,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(14,120,160,0.3)',
          }}>查看我的商机</button>
          <button onClick={() => { setSuccess(false); setStep(0); setForm(f => ({ ...f, customerName: '', companyName: '', industry: '' as IndustryType | '' })) }}
            style={{
              background: 'rgba(0,0,0,0.08)', color: '#111111',
              border: 'none', padding: '12px 24px', borderRadius: 14,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>继续报备</button>
        </div>
      </div>
    )
  }

  if (mode === 'ai') {
    const collisionMatches = [
      ...(aiCollision ? [aiCollision] : []),
      ...aiSimilar,
      ...aiCrossIndustry,
    ]
    return <main className="ai-report-page">
      <header className="ai-report-head">
        <div><span><Sparkles size={14}/> AI RECOMMENDED</span><h1>AI 商机报备</h1><p>粘贴飞书、企微、邮件或拜访记录，AI 自动抽取商机字段并完成撞单预检。</p></div>
        <div className="report-mode-switch"><button className="active"><Bot size={15}/>AI 报备<em>推荐</em></button><button onClick={() => setMode('manual')}><FileText size={15}/>人工填写</button></div>
      </header>

      <section className="ai-report-flow" aria-label="AI 报备流程">
        {[['1','输入上下文'],['2','AI 字段抽取'],['3','撞单预检'],['4','人工确认']].map(([number,label], index) => {
          const active = aiStatus === 'idle' ? index === 0 : aiStatus === 'analyzing' ? index <= 1 : index <= 3
          const completed = aiStatus === 'ready' && index < 3
          return <div className={`${active ? 'active' : ''} ${completed ? 'completed' : ''}`} key={number}><i>{completed ? <CheckCircle2 size={14}/> : number}</i><span>{label}</span>{index < 3 && <b/>}</div>
        })}
      </section>

      <section className="ai-report-layout">
        <div className="ai-report-main">
          <article className="ai-report-card ai-context-card">
            <header><div><span>STEP 01 · CONTEXT</span><h2>输入商机上下文</h2><p>推荐直接粘贴包含客户、需求、预算、联系人与时间节点的原始沟通内容。</p></div><button onClick={() => { setAiText(sampleContext); setAiStatus('idle'); setAiDraft(null) }}><RefreshCw size={14}/>使用示例</button></header>
            <div className="ai-context-input"><MessageSquare size={18}/><textarea value={aiText} onChange={event => { setAiText(event.target.value); setAiStatus('idle'); setAiDraft(null) }} placeholder="粘贴飞书群聊、企微沟通、邮件或拜访纪要…"/><span>{Array.from(aiText).length} 字</span></div>
            <footer><span className={`ai-detect-status ${aiStatus}`}><i/>{aiStatus === 'idle' ? '等待识别' : aiStatus === 'analyzing' ? '正在理解上下文并预检撞单…' : 'AI 草稿已生成'}</span><button className="ai-primary" onClick={runAiDetection} disabled={aiText.trim().length < 10 || aiStatus === 'analyzing'}>{aiStatus === 'analyzing' ? <><span className="ai-spinner"/>正在识别</> : <><Sparkles size={16}/>识别并检测撞单</>}</button></footer>
          </article>

          {aiStatus !== 'ready' || !aiDraft ? <article className="ai-report-card ai-waiting-card"><Bot size={28}/><h3>AI 将生成可编辑的商机草稿</h3><p>自动提取客户名称、产品兴趣、需求场景、预算、联系人和需求部门；创建前仍需由你确认。</p></article> : <>
            <article className="ai-report-card ai-draft-card">
              <header><div><span>STEP 02 · DRAFT</span><h2>商机草稿</h2><p>AI 置信度 {aiDraft.confidence}%，所有字段均可在创建前修改。</p></div><em>可编辑</em></header>
              <div className="ai-draft-grid">
                <label><span>客户名称 *</span><input value={aiDraft.customerName} onChange={event => updateAiDraft('customerName',event.target.value)}/></label>
                <label><span>公司全称</span><input value={aiDraft.companyName} onChange={event => updateAiDraft('companyName',event.target.value)} placeholder="选填，用于区分子公司"/></label>
                <label><span>所属行业 *</span><select value={aiDraft.industry} onChange={event => updateAiDraft('industry',event.target.value as IndustryType)}>{industries.map(item => <option key={item}>{item}</option>)}</select></label>
                <label><span>商机类型</span><input value={aiDraft.source === 'channel' ? '渠道商机' : '直客商机'} readOnly/></label>
                <label className="wide"><span>产品兴趣 *</span><div className="ai-product-options">{(['JM 声访','JM 外呼'] as const).map(item => <button type="button" key={item} className={aiDraft.productInterest === item ? 'active' : ''} onClick={() => updateAiDraft('productInterest',item)}>{item}</button>)}</div></label>
                <label><span>需求部门 *</span><input value={aiDraft.contactDepartment} onChange={event => updateAiDraft('contactDepartment',event.target.value)}/></label>
                <label><span>预算区间 *</span><select value={aiDraft.amountRange} onChange={event => updateAiDraft('amountRange',event.target.value as AmountRange)}>{amounts.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label><span>联系人 *</span><input value={aiDraft.contactName} onChange={event => updateAiDraft('contactName',event.target.value)} className={!aiDraft.contactName ? 'warn' : ''} placeholder="需要人工补充"/></label>
                <label><span>联系人层级</span><select value={aiDraft.contactLevel} onChange={event => updateAiDraft('contactLevel',event.target.value as ContactLevel)}>{(['决策层','执行层','技术评估层'] as ContactLevel[]).map(item => <option key={item}>{item}</option>)}</select></label>
                <label className="wide"><span>联系方式 *</span><div className="ai-contact-options">{contactTypeOptions.map(item => <button type="button" key={item.value} className={aiDraft.contactTypes.includes(item.value) ? 'active' : ''} onClick={() => updateAiDraft('contactTypes',aiDraft.contactTypes.includes(item.value) ? aiDraft.contactTypes.filter(type => type !== item.value) : [...aiDraft.contactTypes,item.value])}>{item.label}</button>)}</div></label>
                <label className="wide"><span>需求场景 * <em>{Array.from(aiDraft.requirementDescription).length}/120</em></span><textarea maxLength={120} value={aiDraft.requirementDescription} onChange={event => updateAiDraft('requirementDescription',event.target.value)}/></label>
              </div>
            </article>

            <article className={`ai-report-card ai-collision-card ${aiHasConflict ? 'conflict' : 'clear'}`}>
              <header><div><span>STEP 03 · COLLISION CHECK</span><h2>撞单预检</h2></div><em>{aiHasConflict ? <><AlertTriangle size={13}/>发现潜在冲突</> : <><ShieldCheck size={13}/>未发现冲突</>}</em></header>
              {aiHasConflict ? <div className="ai-conflict-list">{collisionMatches.slice(0,3).map(item => <div key={item.id}><strong>{item.customerName}</strong><span>{item.industry} · {item.salesOwnerName} · {item.lockedPermanently ? '持续保护' : `保护期剩余 ${Math.max(0,daysUntil(item.releaseAt))} 天`}</span></div>)}</div> : <p>未发现同客户、同主体或高度相似的保护中商机；正式创建时服务端仍会再次检测。</p>}
            </article>

            <article className="ai-report-card ai-confirm-card">
              <div><span>STEP 04 · HUMAN REVIEW</span><h2>确认创建并进入保护期</h2><p>AI 不会直接落库。由你确认后，系统才会创建正式商机并锁定客户 30 天。</p>{aiMissing.length > 0 && <div className="ai-missing"><AlertTriangle size={14}/>还需补充：{aiMissing.join('、')}</div>}{aiSaved && <div className="ai-saved"><CheckCircle2 size={14}/>已保存为待确认草稿</div>}</div>
              <div className="ai-confirm-actions"><button onClick={() => setAiSaved(true)}><Save size={15}/>保存草稿</button><button className="ai-primary" onClick={createFromAiDraft} disabled={aiHasConflict || aiMissing.length > 0}><Send size={15}/>确认创建并保护</button></div>
            </article>
          </>}
        </div>

        <aside className="ai-report-aside">
          <article><span><Bot size={15}/>AI 报备原则</span><h2>先生成草稿，再由你确认</h2><ul><li><CheckCircle2 size={14}/>AI 自动抽取并允许逐项编辑</li><li><CheckCircle2 size={14}/>创建前完成撞单预检</li><li><CheckCircle2 size={14}/>服务端创建时再次检查冲突</li><li><CheckCircle2 size={14}/>联系人等敏感字段加密存储</li></ul></article>
          <article className="ai-report-manual"><FileText size={20}/><h3>上下文信息不完整？</h3><p>可切换到人工填写，按字段逐项完成报备。</p><button onClick={() => setMode('manual')}>使用人工填写<ChevronRight size={14}/></button></article>
        </aside>
      </section>
    </main>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
    <div style={{ width: '100%', maxWidth: 780 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111111', margin: '0 0 6px' }}>报备商机</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 12px' }}>人工逐项填写商机字段，完成报备后将进入保护期。</p>
        <button className="manual-back-ai" onClick={() => setMode('ai')}><Sparkles size={14}/>返回 AI 报备（推荐）</button>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, padding: '4px 0' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: i < step ? 'linear-gradient(135deg, #0a6a82, #0e9dbf)' : i === step ? 'rgba(14,157,191,0.12)' : 'rgba(0,0,0,0.04)',
                color: i < step ? 'white' : i === step ? '#0e9dbf' : '#c4c4c4',
                border: i === step ? '2px solid #0e9dbf' : i > step ? '2px solid #e0e0e0' : 'none',
                boxShadow: i < step ? '0 2px 8px rgba(14,120,160,0.3)' : 'none',
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 13, whiteSpace: 'nowrap',
                fontWeight: i === step ? 700 : 400,
                color: i < step ? '#0e9dbf' : i === step ? '#0a6a82' : '#c4c4c4',
              }}>
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < step ? 'linear-gradient(90deg, #0a6a82, #0e9dbf)' : 'rgba(0,0,0,0.08)', margin: '0 12px', borderRadius: 1, minWidth: 16 }} />
            )}
          </div>
        ))}
      </div>

      {/* Collision modal */}
      {collision && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: isMobile ? '24px 24px 0 0' : 24, padding: '32px 32px 28px', width: isMobile ? '100%' : 480, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff1f1', border: '2px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <AlertTriangle size={30} style={{ color: '#e05555' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#c0392b', marginBottom: 8 }}>商机冲撞！</div>
            <div style={{ fontSize: 14, color: '#4b5563', marginBottom: 20, lineHeight: 1.6 }}>
              {collision.lockedPermanently
                ? '该客户已进入签约/交付阶段，处于持续保护期，无法报备'
                : `该客户处于保护期内，还剩 ${daysUntil(collision.releaseAt)} 天到期，无法重复报备`}
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '16px 20px', textAlign: 'left', marginBottom: 24 }}>
              {[
                ['客户名称', `「${collision.customerName}」`],
                ...(collision.companyName ? [['公司全称', collision.companyName]] : []),
                ['商机阶段', collision.stage === 'reporting' ? '初接触' : collision.stage === 'signing' ? '签约中' : collision.stage === 'delivery' ? '项目交付' : '已签约'],
                ['保护状态', collision.lockedPermanently ? '持续锁定（已签约/交付）' : `剩余 ${daysUntil(collision.releaseAt)} 天`],
                ...(!collision.lockedPermanently ? [['到期释放', formatDate(collision.releaseAt)]] : []),
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>{k}</span>
                  <span style={{ fontWeight: 700, color: '#c0392b' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>如有争议，请联系 JoyMarketing 业务经理处理</div>
            <button onClick={() => setCollision(null)} style={{
              width: '100%', padding: '13px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #111111, #444444)', color: 'white',
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>返回修改</button>
          </div>
        </div>
      )}

      {similar.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#d97706', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} /> 发现相似商机
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
              以下商机与您填写的客户高度相似，无法继续报备。如有争议，请联系 JoyMarketing 业务经理处理。
            </div>
            {similar.map(o => (
              <div key={o.id} style={{ background: '#fffbf0', border: '1px solid #fcd34d', borderRadius: 10, padding: '8px 14px', marginBottom: 8, fontSize: 13, color: '#92400e', fontWeight: 500 }}>
                {o.customerName}（{o.industry}）— {o.stage === 'reporting' ? '初接触' : o.stage === 'signing' ? '签约中' : o.stage === 'delivery' ? '项目交付' : '已签约'}
              </div>
            ))}
            <button onClick={() => setSimilar([])} style={{ marginTop: 16, width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#111111,#444444)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              返回修改
            </button>
          </div>
        </div>
      )}

      {/* Cross-industry collision modal */}
      {crossIndustry.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '28px 28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#7c3aed', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} /> 跨行业同名客户提醒
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
              该客户名称已在其他行业被锁定。如系同一客户，请修改行业分类后重试；如为不同客户，请补充公司全称以区分。
            </div>
            {crossIndustry.map(o => (
              <div key={o.id} style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 10, padding: '8px 14px', marginBottom: 8, fontSize: 13, color: '#5b21b6', fontWeight: 500 }}>
                {o.customerName}（{o.industry}）— {o.stage === 'reporting' ? '初接触' : o.stage === 'signing' ? '签约中' : o.stage === 'delivery' ? '项目交付' : '已签约'}
              </div>
            ))}
            <button onClick={() => setCrossIndustry([])} style={{ marginTop: 16, width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#111111,#444444)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              返回修改
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px) saturate(1.5)', WebkitBackdropFilter: 'blur(20px) saturate(1.5)', borderRadius: 20, padding: isMobile ? '20px 16px' : '32px 40px', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 16px rgba(80,140,160,0.08)' }}>

        {/* ── Step 0: 客户基础信息 ── */}
        {step === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '20px 32px' }}>
            <div>
              <label style={labelStyle}>客户名称（简称）*</label>
              <input value={form.customerName} onChange={e => upd('customerName', e.target.value)}
                onBlur={checkCollision} placeholder="常用简称，如：腾讯" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>公司全称</label>
              <input value={form.companyName} onChange={e => upd('companyName', e.target.value)}
                onBlur={checkCollision}
                placeholder="如：腾讯科技（深圳）有限公司" style={inputStyle} />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5, lineHeight: 1.5 }}>
                填写合作的具体公司全称；子公司商机不与母公司冲撞
              </div>
            </div>
            <div>
              <label style={labelStyle}>所属行业 *</label>
              <div style={{ position: 'relative' }}>
                <select value={form.industry} onChange={e => { upd('industry', e.target.value); checkCollision() }}
                  style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: 40 }}>
                  <option value="">请选择行业</option>
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <ChevronDown size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#7aabb8', pointerEvents: 'none' }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>产品兴趣 *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['JM 声访', 'JM 外呼'] as const).map(item => <button type="button" key={item} onClick={() => upd('productInterest', item)} style={{ flex: 1, padding: '11px 12px', borderRadius: 12, cursor: 'pointer', border: `1.5px solid ${form.productInterest === item ? '#0e9dbf' : 'rgba(14,120,160,0.18)'}`, background: form.productInterest === item ? 'rgba(14,157,191,0.1)' : 'rgba(236,248,252,0.7)', color: form.productInterest === item ? '#0a6a82' : '#4b5563', fontWeight: 650 }}>{item}</button>)}
              </div>
            </div>
            <div>
              <label style={labelStyle}>客户来源</label>
              {isAdmin ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['direct', 'channel'] as const).map(src => (
                    <label key={src} style={{
                      flex: 1, padding: '11px 16px', borderRadius: 12, cursor: 'pointer',
                      border: `1.5px solid ${form.source === src ? '#0e9dbf' : 'rgba(14,120,160,0.18)'}`,
                      background: form.source === src ? 'rgba(14,157,191,0.1)' : 'rgba(236,248,252,0.7)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <input type="radio" value={src} checked={form.source === src} onChange={() => upd('source', src)} style={{ accentColor: '#0e9dbf' }} />
                      <span style={{ fontSize: 14, fontWeight: form.source === src ? 600 : 400, color: form.source === src ? '#0a6a82' : '#374151' }}>
                        {src === 'direct' ? '直客' : '渠道'}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                readonlyBadge(isChannel ? '渠道' : '直客')
              )}
            </div>
            {(isChannel || (isAdmin && form.source === 'channel')) && (
              <div>
                <label style={labelStyle}>渠道名称</label>
                {isAdmin ? (
                  <div style={{ position: 'relative' }}>
                    <select value={form.channelId} onChange={e => {
                      const ch = channels.find(c => c.id === e.target.value)
                      upd('channelId', e.target.value); upd('channelName', ch?.name || '')
                    }} style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: 40 }}>
                      <option value="">请选择渠道</option>
                      {channels.filter(c => c.status === 'active').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#7aabb8', pointerEvents: 'none' }} />
                  </div>
                ) : (
                  readonlyBadge(myChannel?.name || '—')
                )}
              </div>
            )}
            {(isChannel || (isAdmin && form.source === 'channel')) && (
              <div>
                <label style={labelStyle}>JD 渠道经理 <span style={{ color: '#e05555' }}>*</span></label>
                <input
                  value={form.channelManagerName}
                  onChange={e => upd('channelManagerName', e.target.value)}
                  placeholder="请填写负责对接您的 JD 渠道业务经理"
                  style={inputStyle}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: 联系人信息 ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* AES-256 notice */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(255,247,237,0.9)', border: '1.5px solid rgba(234,88,12,0.22)', borderRadius: 14, padding: '14px 18px' }}>
              <Lock size={16} style={{ color: '#ea580c', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: '#9a3412', lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700 }}>联系信息 AES-256 加密存储</span>，仅报备人/管理员审核可解密查看。请如实填写，信息不会对其他人可见。
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '20px 32px' }}>
              {/* 需求部门在前 */}
              <div>
                <label style={labelStyle}>需求部门 <span style={{ color: '#ef4444' }}>*</span></label>
                <input value={form.contactDepartment} onChange={e => upd('contactDepartment', e.target.value)}
                  placeholder="如：电商部、营销部、IT 部" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>联系人职位层级</label>
                <div style={{ position: 'relative' }}>
                  <select value={form.contactLevel} onChange={e => upd('contactLevel', e.target.value)}
                    style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: 40 }}>
                    {(['决策层', '执行层', '技术评估层'] as ContactLevel[]).map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <ChevronDown size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#7aabb8', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            {/* Encrypted section */}
            <div style={{ background: 'rgba(14,157,191,0.04)', borderRadius: 16, padding: '22px 24px', border: '1.5px dashed rgba(14,120,160,0.25)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>联系人姓名 <span style={{ color: '#ef4444' }}>*</span></label>
                  <input value={form.encryptedName} onChange={e => upd('encryptedName', e.target.value)}
                    placeholder="联系人真实姓名" style={{ ...inputStyle, background: 'white' }} />
                </div>
                <div>
                  <label style={labelStyle}>联系方式（可多选）<span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {contactTypeOptions.map(({ value, label }) => {
                      const checked = form.contactTypes.includes(value)
                      return (
                        <label key={value} onClick={() => toggleContactType(value)} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '6px 0', cursor: 'pointer',
                          transition: 'all 0.15s', userSelect: 'none',
                        }}>
                          {/* 自定义复选框 */}
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            border: `2px solid ${checked ? '#0e9dbf' : 'rgba(14,120,160,0.3)'}`,
                            background: checked ? '#0e9dbf' : 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}>
                            {checked && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: checked ? '#0a6a82' : '#4b5563' }}>
                            {label}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: 商机举证 ── */}
        {step === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '16px' : '20px 32px' }}>
            <div>
              <label style={labelStyle}>首次接触时间 *</label>
              <input type="date" value={form.firstContactDate} max={new Date().toISOString().split('T')[0]}
                onChange={e => upd('firstContactDate', e.target.value)} style={inputStyle} />
            </div>
            <div /> {/* spacer */}

            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                需求描述 *
                <span style={{
                  fontWeight: 600, fontSize: 12,
                  color: form.requirementDescription.length === 0 ? '#aaa' : form.requirementDescription.length >= 30 ? '#2ec4b6' : '#e05555',
                }}>
                  {form.requirementDescription.length} / 120 字
                  {form.requirementDescription.length > 0 && form.requirementDescription.length < 30 && (
                    <span style={{ marginLeft: 6 }}>（还需 {30 - form.requirementDescription.length} 字）</span>
                  )}
                </span>
              </label>
              <textarea value={form.requirementDescription} maxLength={120} onChange={e => upd('requirementDescription', e.target.value)}
                rows={4} placeholder="请详细描述客户需求、痛点和当前进展..."
                style={{
                  ...inputStyle, resize: 'none',
                  borderColor: form.requirementDescription.length > 0 && form.requirementDescription.length < 30 ? '#fca5a5' : '#e5e5e5',
                  transition: 'border-color 0.2s',
                }} />
              {form.requirementDescription.length > 0 && form.requirementDescription.length < 30 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: '#e05555' }}>
                  <AlertTriangle size={13} />
                  需求描述不足 30 字，无法提交，请补充描述客户需求详情
                </div>
              )}
            </div>

            {/* 沟通截图 */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>
                沟通截图 *
                <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6 }}>（至少 1 张，支持微信/邮件截图、拜访照片）</span>
              </label>

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                style={{
                  border: `2px dashed ${dragOver ? '#0e9dbf' : 'rgba(14,120,160,0.25)'}`,
                  borderRadius: 14, padding: '28px 0', textAlign: 'center',
                  background: dragOver ? 'rgba(14,157,191,0.07)' : 'rgba(236,248,252,0.5)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                <Upload size={26} style={{ color: dragOver ? '#0e9dbf' : 'rgba(14,120,160,0.3)', margin: '0 auto 10px', display: 'block', transition: 'color 0.15s' }} />
                <div style={{ fontSize: 14, color: '#6b7280' }}>点击上传或拖拽图片至此处</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>支持 JPG、PNG、WEBP、GIF，单张不超过 10 MB</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => { addFiles(e.target.files); e.target.value = '' }}
              />

              {/* Preview grid */}
              {evidenceFiles.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, marginTop: 12 }}>
                  {evidenceFiles.map(f => (
                    <div key={f.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1', background: '#f0f0f0', border: '1.5px solid #e5e5e5' }}>
                      <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <button
                        onClick={() => removeFile(f.id)}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 20, height: 20, borderRadius: '50%', border: 'none',
                          background: 'rgba(0,0,0,0.55)', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', padding: 0,
                        }}>
                        <X size={11} />
                      </button>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', padding: '3px 6px' }}>
                        <div style={{ fontSize: 10, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      </div>
                    </div>
                  ))}
                  {/* Add more tile */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      aspectRatio: '1', borderRadius: 10, border: '2px dashed #d1d5db',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#aaa', background: '#fafafa', gap: 4,
                    }}>
                    <ImageIcon size={20} />
                    <span style={{ fontSize: 11 }}>添加</span>
                  </div>
                </div>
              )}

              {evidenceFiles.length === 0 && (
                <div style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>请至少上传 1 张截图</div>
              )}
            </div>

            {/* 客户预算金额区间 — 截图下方 */}
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>客户预算金额区间 *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {amounts.map(({ value, label }) => (
                  <label key={value} style={{
                    flex: 1, padding: '12px 8px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                    border: `1.5px solid ${form.amountRange === value ? '#0e9dbf' : 'rgba(14,120,160,0.18)'}`,
                    background: form.amountRange === value ? 'rgba(14,157,191,0.12)' : 'rgba(236,248,252,0.7)',
                    transition: 'all 0.15s',
                  }}>
                    <input type="radio" value={value} checked={form.amountRange === value} onChange={() => upd('amountRange', value)} style={{ display: 'none' }} />
                    <div style={{ fontSize: 13, fontWeight: form.amountRange === value ? 700 : 500, color: form.amountRange === value ? '#0a6a82' : '#374151' }}>{label}</div>
                  </label>
                ))}
              </div>
            </div>

            {/* 确认摘要 */}
            <div style={{ gridColumn: '1/-1', background: 'rgba(14,157,191,0.05)', borderRadius: 14, padding: '18px 22px', border: '1px solid rgba(14,120,160,0.12)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0a6a82', marginBottom: 12 }}>报备信息确认</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                {[
                  ['客户名称', form.customerName],
                  ['公司全称', form.companyName || '—'],
                  ['行业', form.industry],
                  ['产品兴趣', form.productInterest],
                  ['来源', form.source === 'direct' ? '直客' : `渠道：${form.channelName}`],
                  ['预算区间', amounts.find(a => a.value === form.amountRange)?.label || '—'],
                  ['联系层级', form.contactLevel],
                  ['报备人', currentUser.name],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <span style={{ fontSize: 12, color: '#7aabb8', width: 72, flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111111' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: '1/-1', background: 'rgba(14,157,191,0.08)', borderRadius: 12, padding: '11px 14px', fontSize: 12, color: '#0a6a82', border: '1px solid rgba(14,120,160,0.15)' }}>
              提交后系统将自动锁定该客户 30 天，期间其他人无法报备同一客户
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 22, borderTop: '1px solid rgba(14,120,160,0.1)' }}>
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#7aabb8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
              <ChevronLeft size={16} /> 上一步
            </button>
          ) : <div />}

          {step < 2 ? (
            <button onClick={nextStep} disabled={!!collision} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)',
              color: 'white', border: 'none', padding: '12px 28px',
              borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(14,120,160,0.3)',
              opacity: collision ? 0.5 : 1,
            }}>
              下一步 <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={submit} disabled={form.requirementDescription.length < 30 || !form.amountRange || evidenceFiles.length === 0} style={{
              background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)',
              color: 'white', border: 'none', padding: '12px 32px',
              borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(14,120,160,0.3)',
              opacity: (form.requirementDescription.length < 30 || !form.amountRange || evidenceFiles.length === 0) ? 0.5 : 1,
            }}>
              ✓ 确认提交
            </button>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
