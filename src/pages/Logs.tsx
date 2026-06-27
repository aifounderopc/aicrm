import { useStore } from '../store'
import { formatDate } from '../utils'
import { Shield } from 'lucide-react'
import { useMobile } from '../hooks/useMobile'
import { useNavigate } from 'react-router-dom'

export default function LogsPage() {
  const { currentUser, logs } = useStore()
  const isMobile = useMobile()
  const navigate = useNavigate()

  if (currentUser.role !== 'admin') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#d1d5db' }}>
        <Shield size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
        <div style={{ fontSize: 15, color: '#6b7280' }}>无权限访问操作日志</div>
        <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#111', color: 'white', cursor: 'pointer', fontSize: 13 }}>返回首页</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111111', margin: '0 0 4px' }}>操作日志</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>共 {logs.length} 条记录</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {logs.map(log => {
          const actionBg = log.action.includes('释放') ? '#fff1f1' : log.action.includes('拒绝') || log.action.includes('驳回') ? '#fff8f0' : log.action.includes('批准') ? '#d1fae5' : '#e5e5e5'
          const actionColor = log.action.includes('释放') ? '#e05555' : log.action.includes('拒绝') || log.action.includes('驳回') ? '#d97706' : log.action.includes('批准') ? '#065f46' : '#111111'
          return (
            <div key={log.id} style={{
              background: 'rgba(255,255,255,0.88)', borderRadius: 14, padding: isMobile ? '12px 14px' : '12px 18px',
              display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 6 : 14,
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
            }}>
              {isMobile ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, flexShrink: 0, background: actionBg, color: actionColor }}>{log.action}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>{log.operatorName}</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#4b5563' }}>{log.detail}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{formatDate(log.createdAt)}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: '#aaa', minWidth: 80 }}>{formatDate(log.createdAt)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', minWidth: 80 }}>{log.operatorName}</div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, flexShrink: 0, background: actionBg, color: actionColor }}>{log.action}</span>
                  <div style={{ fontSize: 13, color: '#4b5563', flex: 1 }}>{log.detail}</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{log.ip}</div>
                </>
              )}
            </div>
          )
        })}
        {logs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#d1d5db' }}>
            <Shield size={36} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
            <div style={{ fontSize: 14, color: '#6b7280' }}>暂无操作日志</div>
          </div>
        )}
      </div>
    </div>
  )
}
