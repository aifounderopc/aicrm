import { type ReactNode, useEffect } from 'react'
import TopNav from './TopNav'
import { useMobile } from '../../hooks/useMobile'
import { useStore } from '../../store'

export default function Layout({ children }: { children: ReactNode }) {
  const isMobile = useMobile()
  const processAutoReleases = useStore(s => s.processAutoReleases)
  useEffect(() => { processAutoReleases() }, [])
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav />
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '16px 16px 32px' : '24px 28px 40px' }}>
        {children}
      </main>
    </div>
  )
}
