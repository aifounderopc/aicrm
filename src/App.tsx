import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Query from './pages/Query'
import Report from './pages/Report'
import MyOpportunities from './pages/MyOpportunities'
import Admin from './pages/Admin'
import OpportunityDetail from './pages/OpportunityDetail'
import LogsPage from './pages/Logs'
import Login from './pages/Login'
import SalesPartner from './pages/SalesPartner'
import Connectors from './pages/Connectors'
import { useStore } from './store'
import { useEffect, useState } from 'react'
import { setUnauthorizedHandler } from './api'

const USE_API = import.meta.env.VITE_USE_API === 'true'

export default function App() {
  const authUserId = useStore(s => s.authUserId)
  const bootstrap = useStore(s => s.bootstrap)
  const [ready, setReady] = useState(!USE_API)

  useEffect(() => {
    if (!USE_API) return
    // 401 时清空登录态，回到登录页
    setUnauthorizedHandler(() => useStore.setState({ authUserId: null, bootstrapped: false }))
    // 启动时用 cookie 尝试恢复会话并加载数据
    bootstrap().finally(() => setReady(true))
  }, [bootstrap])

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7aabb8', fontSize: 14 }}>
        加载中…
      </div>
    )
  }

  if (!authUserId) return <Login />

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/query" element={<Query />} />
          <Route path="/report" element={<Report />} />
          <Route path="/my" element={<MyOpportunities />} />
          <Route path="/sales-partner" element={<SalesPartner />} />
          <Route path="/connectors" element={<Connectors />} />
          <Route path="/opportunity/:id" element={<OpportunityDetail />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
