import { useState } from 'react'
import Sidebar        from './components/Layout/Sidebar'
import DashboardPage  from './pages/DashboardPage'
import GraphiquesPage from './pages/GraphiquesPage'
import RapportsPage   from './pages/RapportsPage'
import AdminPage      from './pages/AdminPage'
import IAPage         from './pages/IAPage'
import ExportPage     from './pages/ExportPage'
import { useAuth }    from './hooks/useAuth'
import { logOut, signIn } from './services/auth'
import { C }          from './styles/tokens'
import { Activity, Lock, X } from 'lucide-react'

const PAGES = {
  dashboard:  DashboardPage,
  graphiques: GraphiquesPage,
  rapports:   RapportsPage,
  admin:      AdminPage,
  ia:         IAPage,
  export:     ExportPage,
}

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  'auth/user-not-found':     'Aucun compte avec cet email.',
  'auth/wrong-password':     'Mot de passe incorrect.',
  'auth/too-many-requests':  'Trop de tentatives. Réessayez dans quelques minutes.',
}

function LoginModal({ onClose }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      onClose()
    } catch (err) {
      setError(AUTH_ERRORS[err.code] ?? 'Erreur de connexion. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(10,35,66,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '380px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={15} color={C.primary} />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Connexion administrateur</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="fp-label">Adresse email</label>
              <input
                type="email" className="fp-input" placeholder="admin@portabidjan.ci"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus
              />
            </div>
            <div>
              <label className="fp-label">Mot de passe</label>
              <input
                type="password" className="fp-input" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div style={{ padding: '0.65rem 0.9rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px' }}>
                <p style={{ fontSize: 12, color: C.danger, margin: 0 }}>{error}</p>
              </div>
            )}
            <button
              type="submit" className="fp-btn fp-btn-primary"
              style={{ justifyContent: 'center', padding: '0.75rem', fontSize: 14, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>
          <p style={{ textAlign: 'center', fontSize: 11, color: C.textLight, marginTop: '1rem' }}>
            Accès réservé aux agents autorisés PAA
          </p>
        </div>
      </div>
    </div>
  )
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
        Chargement...
      </p>
    </div>
  )
}

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [showLogin,   setShowLogin]   = useState(false)
  const { user, isAdmin, loading }    = useAuth()

  if (loading) return <Spinner />

  const page = currentPage === 'admin' && !isAdmin ? 'dashboard' : currentPage
  const Page = PAGES[page] ?? DashboardPage

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F4F4' }}>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      <Sidebar
        currentPage={page}
        onNavigate={setCurrentPage}
        isAdmin={isAdmin}
        onLogout={logOut}
        onLogin={() => setShowLogin(true)}
        user={user}
      />
      <main style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Page />
      </main>
    </div>
  )
}

export default App
