import { NavLink, useNavigate } from 'react-router-dom'
import { Bell, Plus, ChevronDown, Menu, X, LogOut, Repeat } from 'lucide-react'
import { useStore } from '../../store'
import { roleName, isAdminRole } from '../../utils'
import { useState, useEffect } from 'react'
import { useMobile } from '../../hooks/useMobile'

const navItems = [
  { to: '/', label: 'AI 销售伙伴', end: true, icon: '✨' },
  { to: '/opportunities', label: '商机池', end: false, icon: '🗂️' },
  { to: '/performance', label: '业绩看板', end: false, icon: '📈' },
  { to: '/connectors', label: '连接器', end: false, icon: '🔗' },
  { to: '/admin',  label: '管理后台', end: false, icon: '⚙️', adminOnly: true },
]

export default function TopNav() {
  const { currentUser, users, channels, switchUser, notifications, authUserId, logout, markNotificationRead } = useStore()
  const navigate = useNavigate()
  const isMobile = useMobile()
  // 登录的真实账号（仅管理员可模拟切换）；正在代理访问他人时显示返回入口
  const isProxying = !!authUserId && currentUser.id !== authUserId
  const myNotifs = notifications.filter(n => n.userId === currentUser.id && !n.read)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const unread = myNotifs.length
  const displayName = currentUser.role === 'channel' && currentUser.channelId
    ? (channels.find(c => c.id === currentUser.channelId)?.contactName ?? currentUser.name)
    : currentUser.name
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 登录时触发：高优先级事项（error/warning）卡片提醒，每次登录仅弹一次
  const highPriority = myNotifs.filter(n => n.type === 'error' || n.type === 'warning')
  const [toasts, setToasts] = useState<typeof myNotifs>([])
  useEffect(() => {
    if (!authUserId) return
    const flagKey = `notif-shown-${authUserId}`
    if (sessionStorage.getItem(flagKey)) return
    sessionStorage.setItem(flagKey, '1')
    if (highPriority.length > 0) setToasts(highPriority.slice(0, 3))
  }, [authUserId]) // eslint-disable-line react-hooks/exhaustive-deps
  const dismissToast = (id: string) => setToasts(t => t.filter(n => n.id !== id))
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const visibleItems = navItems.filter(i => !i.adminOnly || isAdminRole(currentUser.role))

  // Lock body scroll when drawer open
  useEffect(() => {
    if (drawerOpen) document.body.classList.add('drawer-open')
    else document.body.classList.remove('drawer-open')
    return () => document.body.classList.remove('drawer-open')
  }, [drawerOpen])

  // Close drawer on resize to desktop
  useEffect(() => { if (!isMobile) setDrawerOpen(false) }, [isMobile])

  const activeStyle = {
    padding: '7px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
    textDecoration: 'none', color: 'white',
    background: '#111111',
  } as const
  const inactiveStyle = {
    padding: '7px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
    textDecoration: 'none', color: '#6b7280', background: 'transparent',
  } as const

  return (
    <>
      <header style={{
        background: scrolled ? 'rgba(234,246,249,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(1.5)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(1.5)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(14,120,160,0.1)' : 'none',
        transition: 'background 0.25s, backdrop-filter 0.25s, border-color 0.25s',
        position: 'sticky', top: 0, zIndex: 100,
        padding: isMobile ? '12px 16px 10px' : '20px 28px 14px',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', height: isMobile ? 44 : 48 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, minWidth: 150 }}>
            <img src="/scale-x-logo-20260813.png" alt="Scale X" style={{ width: isMobile ? 108 : 120, height: 'auto', flexShrink: 0, objectFit: 'contain' }} />
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontWeight: 700, fontSize: 9.5, letterSpacing: '.1px',
              padding: '5px 10px', lineHeight: 1.3, whiteSpace: 'nowrap',
              color: '#1657c8',
              border: '1px solid rgba(22,87,200,0.22)',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(220,235,255,0.45))',
              backdropFilter: 'blur(8px) saturate(1.4)', WebkitBackdropFilter: 'blur(8px) saturate(1.4)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 5px rgba(22,87,200,0.1)',
              borderRadius: 4, transform: 'skewX(-12deg)',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, transform: 'skewX(12deg)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'conic-gradient(from 220deg, #38bdf8, #8b5cf6, #ec4899, #f97316, #38bdf8)', flexShrink: 0, boxShadow: '0 0 6px rgba(236,72,153,0.45)' }} />
                AI 驱动的新一代企业销售增长引擎
              </span>
            </span>
          </div>

          {/* Desktop nav — centered pill group */}
          {!isMobile && (
            <nav style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                background: 'rgba(0,0,0,0.04)', borderRadius: 24,
                padding: '4px',
              }}>
                {visibleItems.map(({ to, label, end }) => (
                  <NavLink key={to} to={to} end={end}
                    style={({ isActive }) => isActive ? activeStyle : inactiveStyle}>
                    {label}
                  </NavLink>
                ))}
              </div>
            </nav>
          )}

          {/* Spacer on mobile */}
          {isMobile && <div style={{ flex: 1 }} />}

          {/* Right — notification + user card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minWidth: isMobile ? 'auto' : 140, justifyContent: 'flex-end' }}>
            <style>{`
              @keyframes usermenu-in {
                from { opacity: 0; transform: translateY(-6px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes toast-in {
                from { opacity: 0; transform: translateX(20px); }
                to { opacity: 1; transform: translateX(0); }
              }
            `}</style>

            {/* Bell + notifications dropdown */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowNotif(v => !v)} style={{
                position: 'relative', width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: showNotif ? 'rgba(14,157,191,0.1)' : 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151',
              }}>
                <Bell size={15} />
                {unread > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 3, minWidth: 14, height: 14, padding: '0 3px',
                    borderRadius: 8, background: '#ef4444', border: '1.5px solid white',
                    fontSize: 9, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{unread > 9 ? '9+' : unread}</span>
                )}
              </button>

              {showNotif && (
                <>
                  <div onClick={() => setShowNotif(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 320, zIndex: 200,
                    background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px) saturate(1.6)', WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                    borderRadius: 16, border: '1px solid rgba(255,255,255,0.9)',
                    boxShadow: '0 12px 36px rgba(20,80,110,0.16)', overflow: 'hidden', animation: 'usermenu-in 0.16s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0a3a4a' }}>通知提醒</span>
                      {unread > 0 && (
                        <button onClick={() => myNotifs.forEach(n => markNotificationRead(n.id))}
                          style={{ fontSize: 11, color: '#0e7a9a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>全部已读</button>
                      )}
                    </div>
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                      {myNotifs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '36px 0', color: '#9ca3af', fontSize: 13 }}>暂无未读通知</div>
                      ) : myNotifs.map(n => {
                        const c = n.type === 'error' ? '#ef4444' : n.type === 'warning' ? '#f59e0b' : n.type === 'success' ? '#10b981' : '#0e9dbf'
                        return (
                          <div key={n.id} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 5 }} />
                            <div style={{ flex: 1, minWidth: 0, cursor: n.opportunityId ? 'pointer' : 'default' }}
                              onClick={() => { if (n.opportunityId) { navigate(`/opportunity/${n.opportunityId}`); setShowNotif(false) } }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 2 }}>{n.title}</div>
                              <div style={{ fontSize: 11.5, color: '#6b7280', lineHeight: 1.5 }}>{n.body}</div>
                            </div>
                            <button onClick={() => markNotificationRead(n.id)} title="标记已读"
                              style={{ width: 20, height: 20, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                              <X size={13} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User — desktop dropdown (hover) */}
            {!isMobile && (
              <div style={{ position: 'relative' }}
                onMouseEnter={() => setShowUserMenu(true)}
                onMouseLeave={() => setShowUserMenu(false)}
              >
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none',
                  cursor: 'pointer', padding: '4px 0',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #374151, #6b7280)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0,
                  }}>{displayName[0]}</div>
                  <div style={{ textAlign: 'left', lineHeight: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111111' }}>{displayName}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{roleName(currentUser.role)}</div>
                  </div>
                  <ChevronDown size={12} style={{ color: '#9ca3af' }} />
                </button>

                {showUserMenu && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, paddingTop: 10, zIndex: 200, animation: 'usermenu-in 0.16s ease' }}>
                  <div style={{
                    width: 236,
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(20px) saturate(1.6)', WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                    borderRadius: 18,
                    boxShadow: '0 12px 36px rgba(20,80,110,0.16), 0 2px 8px rgba(0,0,0,0.04)',
                    border: '1px solid rgba(255,255,255,0.9)', overflow: 'hidden', padding: 6,
                  }}>
                    {/* User header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px 12px' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #0a6a82, #0e9dbf)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 15,
                        boxShadow: '0 3px 10px rgba(14,120,160,0.3)',
                      }}>{displayName[0]}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0a3a4a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                        <div style={{ fontSize: 11, color: '#7aabb8', marginTop: 1 }}>{roleName(currentUser.role)}</div>
                      </div>
                    </div>

                    {isProxying && (
                      <div style={{ margin: '0 6px 6px', padding: '9px 11px', borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <div style={{ fontSize: 11, color: '#b45309', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} /> 正在代理访问
                        </div>
                        <button onClick={() => { switchUser(authUserId!); setShowUserMenu(false) }} style={{
                          display: 'flex', alignItems: 'center', gap: 7, width: '100%', marginTop: 8,
                          padding: '7px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                          background: 'rgba(14,157,191,0.1)', color: '#0e7a9a', fontSize: 12.5, fontWeight: 600,
                        }}>
                          <Repeat size={14} /> 退出代理，返回本人
                        </button>
                      </div>
                    )}

                    <button onClick={() => { logout() }} style={{
                      display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                      padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: 'transparent', color: '#dc2626', fontSize: 13.5, fontWeight: 600,
                      transition: 'background 0.12s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <LogOut size={14} />
                      </span>
                      退出登录
                    </button>
                  </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile hamburger */}
            {isMobile && (
              <button onClick={() => setDrawerOpen(true)} style={{
                width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.08)',
                background: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151',
              }}>
                <Menu size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {isMobile && (
        <>
          {/* Backdrop */}
          {drawerOpen && (
            <div onClick={() => setDrawerOpen(false)} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              zIndex: 200, backdropFilter: 'blur(2px)',
            }} />
          )}
          {/* Drawer panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '80vw', maxWidth: 300,
            background: 'white', zIndex: 201, overflowY: 'auto',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <img src="/scale-x-logo-20260813.png" alt="Scale X" style={{ width: 112, height: 'auto', objectFit: 'contain' }} />
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontWeight: 700, fontSize: 9.5, letterSpacing: '.1px',
                  padding: '5px 10px', lineHeight: 1.3, whiteSpace: 'nowrap',
                  color: '#1657c8',
                  border: '1px solid rgba(22,87,200,0.22)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(220,235,255,0.45))',
                  backdropFilter: 'blur(8px) saturate(1.4)', WebkitBackdropFilter: 'blur(8px) saturate(1.4)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 5px rgba(22,87,200,0.1)',
                  borderRadius: 4, transform: 'skewX(-12deg)',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, transform: 'skewX(12deg)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'conic-gradient(from 220deg, #38bdf8, #8b5cf6, #ec4899, #f97316, #38bdf8)', flexShrink: 0, boxShadow: '0 0 6px rgba(236,72,153,0.45)' }} />
                    AI 驱动的新一代企业销售增长引擎
                  </span>
                </span>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#f5f5f5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                <X size={16} />
              </button>
            </div>

            {/* User info */}
            <div style={{ margin: '0 16px 16px', background: '#f9f9f9', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #111111, #d1d5db)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                {displayName[0]}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>{displayName}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{roleName(currentUser.role)}</div>
              </div>
            </div>

            {/* Nav links */}
            <nav style={{ padding: '0 12px', flex: 1 }}>
              {visibleItems.map(({ to, label, end, icon }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setDrawerOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 14px', borderRadius: 12, marginBottom: 4,
                    textDecoration: 'none', fontSize: 15, fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#111111' : '#4b5563',
                    background: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
                  })}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Report CTA */}
            <div style={{ padding: '16px' }}>
              <button onClick={() => { navigate('/report'); setDrawerOpen(false) }} style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #111111, #444444)', color: 'white',
                fontWeight: 700, fontSize: 15, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}>
                + 报备商机
              </button>
            </div>

            {/* 代理访问中 — 返回本人 */}
            {isProxying && (
              <div style={{ padding: '0 16px 12px' }}>
                <button onClick={() => { switchUser(authUserId!); setDrawerOpen(false) }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
                  padding: '12px', borderRadius: 12, border: '1.5px solid rgba(14,120,160,0.25)', cursor: 'pointer',
                  background: 'rgba(14,157,191,0.06)', color: '#0e7a9a', fontSize: 14, fontWeight: 600,
                }}>
                  <Repeat size={15} /> 退出代理，返回本人
                </button>
              </div>
            )}

            {/* Logout */}
            <div style={{ padding: '0 16px 32px' }}>
              <button onClick={() => logout()} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
                padding: '12px', borderRadius: 12, border: '1.5px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                background: 'rgba(239,68,68,0.05)', color: '#dc2626', fontSize: 14, fontWeight: 600,
              }}>
                <LogOut size={15} /> 退出登录
              </button>
            </div>
          </div>
        </>
      )}

      {/* 登录时高优事项卡片提醒 */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: isMobile ? 70 : 84, right: isMobile ? 12 : 24, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 10, width: isMobile ? 'calc(100% - 24px)' : 340 }}>
          {toasts.map(n => {
            const c = n.type === 'error' ? '#ef4444' : '#f59e0b'
            return (
              <div key={n.id} style={{
                background: 'white', borderRadius: 14, padding: '14px 16px',
                borderLeft: `4px solid ${c}`,
                boxShadow: '0 10px 30px rgba(20,80,110,0.18)',
                animation: 'toast-in 0.3s ease', display: 'flex', gap: 10,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0, cursor: n.opportunityId ? 'pointer' : 'default' }}
                  onClick={() => { if (n.opportunityId) { navigate(`/opportunity/${n.opportunityId}`); dismissToast(n.id) } }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{n.body}</div>
                </div>
                <button onClick={() => dismissToast(n.id)}
                  style={{ width: 22, height: 22, borderRadius: 7, border: 'none', background: 'rgba(0,0,0,0.04)', cursor: 'pointer', color: '#9ca3af', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
