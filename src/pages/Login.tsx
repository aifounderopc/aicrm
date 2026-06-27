import { useState } from 'react'
import { useStore } from '../store'
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import { useMobile } from '../hooks/useMobile'

export default function Login() {
  const login = useStore(s => s.login)
  const isMobile = useMobile()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email.trim() || !password) { setError('请输入账号和密码'); return }
    setLoading(true)
    setError('')
    const res = await login(email, password)
    if (!res.success) { setError(res.error || '登录失败'); setLoading(false) }
    // 成功后由 App 路由守卫自动进入系统
  }

  const inputWrap: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(236,248,252,0.7)',
    border: '1.5px solid rgba(14,120,160,0.18)',
    borderRadius: 14, padding: '0 16px', height: 50,
    transition: 'border-color 0.15s, background 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? 16 : 32,
      background: `
        radial-gradient(circle at 12% 18%, rgba(14,157,191,0.12), transparent 42%),
        radial-gradient(circle at 88% 82%, rgba(34,197,180,0.12), transparent 45%),
        linear-gradient(135deg, #eef6f9 0%, #eaf5f2 100%)`,
    }}>
      <div style={{
        width: '100%', maxWidth: 1080,
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid rgba(255,255,255,0.7)',
        borderRadius: 28, padding: isMobile ? '28px 22px 32px' : '36px 40px 44px',
        boxShadow: '0 20px 70px rgba(14,120,160,0.14)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: isMobile ? 24 : 8 }}>
          <img src="/logo.png" alt="JoyMarketing" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontWeight: 700, fontSize: 11.5, letterSpacing: '1.2px', color: '#1657c8',
            padding: '4px 11px', border: '1px solid rgba(22,87,200,0.22)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(220,235,255,0.45))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)', borderRadius: 4, transform: 'skewX(-12deg)',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, transform: 'skewX(12deg)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'conic-gradient(from 220deg, #38bdf8, #8b5cf6, #ec4899, #f97316, #38bdf8)', boxShadow: '0 0 6px rgba(236,72,153,0.45)' }} />
              CRM
            </span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 48 }}>
          {/* ── Left: form ── */}
          <div style={{ flex: '1 1 0', maxWidth: 400, margin: isMobile ? '0 auto' : '0', width: '100%' }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0a3a4a', textAlign: 'center', margin: '8px 0 4px' }}>欢迎登录</h1>
            <p style={{ fontSize: 13, color: '#6b8a96', textAlign: 'center', margin: '0 0 26px' }}>JoyMarketing 商机报备与管理系统</p>

            {/* Email */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2a5a70', display: 'block', marginBottom: 7 }}>账号邮箱</label>
            <div style={inputWrap}
              onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0e9dbf'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.95)' }}
              onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,120,160,0.18)'; (e.currentTarget as HTMLElement).style.background = 'rgba(236,248,252,0.7)' }}
            >
              <Mail size={16} style={{ color: '#7aaabb', flexShrink: 0 }} />
              <input
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="请输入您的邮箱账号"
                autoFocus
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#0a3a4a', fontFamily: 'inherit' }}
              />
            </div>

            {/* Password */}
            <label style={{ fontSize: 12, fontWeight: 600, color: '#2a5a70', display: 'block', margin: '16px 0 7px' }}>密码</label>
            <div style={inputWrap}
              onFocusCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0e9dbf'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.95)' }}
              onBlurCapture={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,120,160,0.18)'; (e.currentTarget as HTMLElement).style.background = 'rgba(236,248,252,0.7)' }}
            >
              <Lock size={16} style={{ color: '#7aaabb', flexShrink: 0 }} />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="请输入密码"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: '#0a3a4a', fontFamily: 'inherit' }}
              />
              <button onClick={() => setShowPwd(s => !s)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7aaabb', display: 'flex', padding: 0 }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Remember */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 4px' }}>
              <label onClick={() => setRemember(r => !r)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <span style={{
                  width: 17, height: 17, borderRadius: 5, flexShrink: 0,
                  border: `2px solid ${remember ? '#0e9dbf' : 'rgba(14,120,160,0.3)'}`,
                  background: remember ? '#0e9dbf' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                }}>
                  {remember && <svg width="9" height="9" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                <span style={{ fontSize: 12.5, color: '#5a8090' }}>记住登录状态</span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14, padding: '9px 13px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10 }}>
                <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: '#dc2626', fontWeight: 500 }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button onClick={submit} disabled={loading} style={{
              width: '100%', marginTop: 22, height: 50, borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)', color: 'white',
              fontWeight: 700, fontSize: 15, cursor: loading ? 'default' : 'pointer',
              boxShadow: '0 6px 18px rgba(14,120,160,0.32)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading ? 0.75 : 1, transition: 'opacity 0.2s',
            }}>
              {loading ? '登录中…' : <>登录 <ArrowRight size={17} /></>}
            </button>

          </div>

          {/* ── Right: illustration ── */}
          {!isMobile && (
            <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoginArt />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Cyan-themed illustration: person relaxing with laptop
function LoginArt() {
  return (
    <svg width="380" height="340" viewBox="0 0 380 340" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Floor shadow */}
      <ellipse cx="190" cy="300" rx="150" ry="18" fill="rgba(14,157,191,0.08)" />
      {/* Window frame */}
      <rect x="248" y="40" width="110" height="150" rx="4" fill="none" stroke="#0a3a4a" strokeWidth="4" />
      <line x1="303" y1="40" x2="303" y2="190" stroke="#0a3a4a" strokeWidth="4" />
      <line x1="248" y1="115" x2="358" y2="115" stroke="#0a3a4a" strokeWidth="4" />
      <rect x="252" y="44" width="47" height="67" fill="rgba(14,157,191,0.08)" />
      <rect x="307" y="44" width="47" height="67" fill="rgba(14,157,191,0.05)" />
      {/* Floor lamp */}
      <line x1="60" y1="120" x2="60" y2="270" stroke="#0a3a4a" strokeWidth="3.5" />
      <path d="M44 120 L76 120 L70 95 L50 95 Z" fill="#0a3a4a" />
      <rect x="48" y="268" width="24" height="6" rx="2" fill="#0a3a4a" />
      {/* Bean bag */}
      <ellipse cx="180" cy="240" rx="78" ry="58" fill="#0e9dbf" />
      <ellipse cx="180" cy="232" rx="70" ry="48" fill="#14b3d6" />
      {/* Person body */}
      <path d="M150 200 Q145 165 175 160 Q210 158 212 195 L208 235 L155 235 Z" fill="#1f3a4a" />
      {/* Head */}
      <circle cx="182" cy="140" r="22" fill="#fde0c0" />
      {/* Hair */}
      <path d="M161 135 Q160 116 183 115 Q205 116 203 134 Q198 122 182 122 Q168 122 161 135 Z" fill="#1f3a4a" />
      {/* Glasses */}
      <circle cx="176" cy="140" r="5" fill="none" stroke="#0a3a4a" strokeWidth="1.6" />
      <circle cx="190" cy="140" r="5" fill="none" stroke="#0a3a4a" strokeWidth="1.6" />
      <line x1="181" y1="140" x2="185" y2="140" stroke="#0a3a4a" strokeWidth="1.6" />
      {/* Legs */}
      <path d="M158 232 Q120 250 105 278" stroke="#5a6a72" strokeWidth="17" strokeLinecap="round" />
      <path d="M205 232 Q230 252 218 280" stroke="#5a6a72" strokeWidth="17" strokeLinecap="round" />
      {/* Shoes */}
      <ellipse cx="102" cy="282" rx="16" ry="8" fill="#0a3a4a" transform="rotate(-18 102 282)" />
      <ellipse cx="220" cy="284" rx="15" ry="8" fill="#0a3a4a" />
      {/* Laptop */}
      <path d="M150 210 L196 204 L200 224 L150 230 Z" fill="#e8f4f8" stroke="#0a3a4a" strokeWidth="2" />
      {/* Arm */}
      <path d="M205 185 Q224 198 214 214" stroke="#1f3a4a" strokeWidth="13" strokeLinecap="round" />
      {/* Floating doc / news */}
      <rect x="214" y="120" width="56" height="72" rx="5" fill="white" stroke="#0a3a4a" strokeWidth="2.5" transform="rotate(6 242 156)" />
      <line x1="224" y1="140" x2="258" y2="138" stroke="#0e9dbf" strokeWidth="2.5" strokeLinecap="round" transform="rotate(6 242 156)" />
      <line x1="224" y1="150" x2="258" y2="148" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" transform="rotate(6 242 156)" />
      <line x1="224" y1="160" x2="252" y2="158" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" transform="rotate(6 242 156)" />
      <rect x="246" y="164" width="18" height="18" rx="2" fill="rgba(14,157,191,0.18)" transform="rotate(6 242 156)" />
      {/* Coffee cup */}
      <path d="M236 250 L240 270 Q241 276 248 276 Q255 276 256 270 L260 250 Z" fill="white" stroke="#0a3a4a" strokeWidth="2" />
      <path d="M244 244 Q242 240 246 238 M250 244 Q248 240 252 238" stroke="#7aaabb" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* Plant */}
      <path d="M324 300 L330 260 L342 260 L348 300 Z" fill="#0e9dbf" />
      <path d="M336 260 Q322 235 318 218 M336 260 Q350 238 356 222 M336 262 L336 240" stroke="#14b3d6" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <ellipse cx="318" cy="216" rx="7" ry="11" fill="#14b3d6" transform="rotate(-30 318 216)" />
      <ellipse cx="356" cy="220" rx="7" ry="11" fill="#14b3d6" transform="rotate(30 356 220)" />
      <ellipse cx="336" cy="236" rx="6" ry="10" fill="#0e9dbf" />
    </svg>
  )
}
