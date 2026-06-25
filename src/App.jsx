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
import { Activity }   from 'lucide-react'

const PAGES = {
  dashboard:  DashboardPage,
  graphiques: GraphiquesPage,
  rapports:   RapportsPage,
  admin:      AdminPage,
  ia:         IAPage,
  export:     ExportPage,
}

function Spinner() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', background: C.bg, gap: '1rem',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '12px', background: C.sidebarActive,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Activity size={24} color="#fff" />
      </div>
      <p style={{ fontSize: 13, color: C.textMuted, fontFamily: "'Inter', sans-serif" }}>
        Vérification de la session...
      </p>
    </div>
  )
}

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const { user, isAdmin, loading }    = useAuth()

  if (loading) return <Spinner />
  if (!user)   return <LoginPage />

  // Un utilisateur non-admin ne peut pas accéder à la page admin
  const page = currentPage === 'admin' && !isAdmin ? 'dashboard' : currentPage
  const Page = PAGES[page] ?? DashboardPage

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F4F4' }}>
      <Sidebar
        currentPage={page}
        onNavigate={setCurrentPage}
        isAdmin={isAdmin}
        onLogout={logOut}
        user={user}
      />
      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Page />
      </main>
    </div>
  )
}

export default App
