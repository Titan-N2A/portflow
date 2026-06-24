import { useState } from 'react'
import Sidebar        from './components/Layout/Sidebar'
import DashboardPage  from './pages/DashboardPage'
import GraphiquesPage from './pages/GraphiquesPage'
import RapportsPage   from './pages/RapportsPage'
import AdminPage      from './pages/AdminPage'
import IAPage         from './pages/IAPage'
import ExportPage     from './pages/ExportPage'
import LoginPage      from './pages/LoginPage'
import { useAuth }    from './hooks/useAuth'
import { logOut }     from './services/auth'
import { C }          from './styles/tokens'

const PAGES = {
  dashboard:  { component: DashboardPage,  adminOnly: false },
  graphiques: { component: GraphiquesPage, adminOnly: false },
  rapports:   { component: RapportsPage,   adminOnly: false },
  admin:      { component: AdminPage,      adminOnly: true  },
  ia:         { component: IAPage,         adminOnly: false },
  export:     { component: ExportPage,     adminOnly: false },
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F4F4F4' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="fp-spin" style={{
          width: 40, height: 40, borderRadius: '50%',
          border: `3px solid ${C.primary}20`,
          borderTopColor: C.primary,
          margin: '0 auto 12px',
        }} />
        <p style={{ color: C.textMuted, fontSize: 13 }}>Chargement…</p>
      </div>
    </div>
  )
}

function App() {
  const { user, isAdmin, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState('dashboard')

  if (loading) return <LoadingScreen />

  if (!user) return <LoginPage />

  const pageDef = PAGES[currentPage] ?? PAGES.dashboard

  // Redirection si page admin et pas admin
  if (pageDef.adminOnly && !isAdmin) {
    const Page = PAGES.dashboard.component
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F4F4' }}>
        <Sidebar currentPage="dashboard" onNavigate={setCurrentPage} onLogout={logOut} isAdmin={isAdmin} />
        <main style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Page />
        </main>
      </div>
    )
  }

  const Page = pageDef.component

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F4F4' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} onLogout={logOut} isAdmin={isAdmin} />
      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Page />
      </main>
    </div>
  )
}

export default App
