import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Search, PlusCircle, List, Settings, FileText } from 'lucide-react'
import { useStore } from '../../store'
import { roleName } from '../../utils'
import type { UserRole } from '../../types'

const userNavItems = [
  { to: '/', icon: LayoutDashboard, label: '首页看板' },
  { to: '/query', icon: Search, label: '商机查询' },
  { to: '/report', icon: PlusCircle, label: '报备商机' },
  { to: '/my', icon: List, label: '我的商机' },
]

const adminNavItems = [
  { to: '/', icon: LayoutDashboard, label: '首页看板' },
  { to: '/query', icon: Search, label: '商机查询' },
  { to: '/report', icon: PlusCircle, label: '报备商机' },
  { to: '/my', icon: List, label: '我的商机' },
  { to: '/admin', icon: Settings, label: '管理后台' },
]

const navItems: Record<UserRole, typeof userNavItems> = {
  admin: adminNavItems,
  channel_admin: adminNavItems,
  sales_admin: adminNavItems,
  sales: userNavItems,
  channel: userNavItems,
}

export default function Sidebar() {
  const { currentUser, users, switchUser, notifications } = useStore()
  const unread = notifications.filter(n => n.userId === currentUser.id && !n.read).length
  const items = navItems[currentUser.role]

  return (
    <div className="w-56 min-h-screen bg-gray-900 text-white flex flex-col fixed left-0 top-0">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <FileText size={16} />
          </div>
          <span className="font-bold text-sm">AI CRM</span>
        </div>
        <div className="mt-3 text-xs text-gray-400">当前账号</div>
        <select
          value={currentUser.id}
          onChange={e => switchUser(e.target.value)}
          className="mt-1 w-full bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600"
        >
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}（{roleName(u.role)}）</option>
          ))}
        </select>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
            {label === '首页看板' && unread > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">
            {currentUser.name[0]}
          </div>
          <div>
            <div className="text-xs font-medium">{currentUser.name}</div>
            <div className="text-xs text-gray-400">{roleName(currentUser.role)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
