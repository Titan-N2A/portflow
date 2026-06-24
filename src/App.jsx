import { useState } from 'react'
import Sidebar        from './components/Layout/Sidebar'
import DashboardPage  from './pages/DashboardPage'
import GraphiquesPage from './pages/GraphiquesPage'
import RapportsPage   from './pages/RapportsPage'
import AdminPage      from './pages/AdminPage'
import IAPage         from './pages/IAPage'
import ExportPage     from './pages/ExportPage'

const PAGES = {
  dashboard:  DashboardPage,
  graphiques: GraphiquesPage,
  rapports:   RapportsPage,
  admin:      AdminPage,
  ia:         IAPage,
  export:     ExportPage,
}

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const Page = PAGES[currentPage] ?? DashboardPage

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F4F4' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} isAdmin={true} />
      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Page />
      </main>
    </div>
  )
}

export default App
