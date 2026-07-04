import { useState, useEffect } from 'react'
import { LayoutDashboard, BarChart2, FileText, Settings, Bot, Download, Lock, X, LogOut, Eye, EyeOff } from 'lucide-react'
import logoPAA from './assets/logo_port.png'
import Sidebar        from './components/Layout/Sidebar'
import DashboardPage  from './pages/DashboardPage'
import GraphiquesPage from './pages/GraphiquesPage'
import RapportsPage   from './pages/RapportsPage'
import AdminPage      from './pages/AdminPage'
import IAPage         from './pages/IAPage'
import ExportPage     from './pages/ExportPage'
import { useAuth }    from './hooks/useAuth'
import { useIsMobile } from './hooks/useIsMobile'
import { logOut, signIn } from './services/auth'
import { C }          from './styles/tokens'
import ConsentBanner, { CONSENT_KEY } from './components/shared/ConsentBanner'
import InstallPWA from './components/shared/InstallPWA'

const PAGES = {
  dashboard:  DashboardPage,
  graphiques: GraphiquesPage,
  rapports:   RapportsPage,
  admin:      AdminPage,
  ia:         IAPage,
  export:     ExportPage,
}

// Pages interdites sans connexion
const RESTRICTED  = ['rapports', 'export', 'graphiques']
const ADMIN_ONLY  = ['admin']

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  'auth/user-not-found':     'Aucun compte avec cet email.',
  'auth/wrong-password':     'Mot de passe incorrect.',
  'auth/too-many-requests':  'Trop de tentatives. Réessayez plus tard.',
}

// ── Navigation mobile (labels courts) ────────────────────
const MOB_PUBLIC = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Accueil' },
  { id: 'ia',        icon: Bot,             label: 'IA'      },
]
const MOB_USER = [
  { id: 'dashboard',  icon: LayoutDashboard, label: 'Accueil' },
  { id: 'graphiques', icon: BarChart2,        label: 'Graphes' },
  { id: 'rapports',   icon: FileText,         label: 'Rapports'},
  { id: 'export',     icon: Download,         label: 'Export'  },
  { id: 'ia',         icon: Bot,              label: 'IA'      },
]
const MOB_ADMIN = [
  ...MOB_USER,
  { id: 'admin', icon: Settings, label: 'Admin' },
]

// ── Modale de connexion ───────────────────────────────────
function LoginModal({ onClose }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
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
        background: 'rgba(10,35,66,0.65)', backdropFilter: 'blur(4px)',
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
              <input type="email" className="fp-input" placeholder="admin@portabidjan.ci"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="fp-label">Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} className="fp-input" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required
                  style={{ paddingRight: '2.6rem' }} />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  title={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', color: C.textMuted,
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <div style={{ padding: '0.65rem 0.9rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px' }}>
                <p style={{ fontSize: 12, color: C.danger, margin: 0 }}>{error}</p>
              </div>
            )}
            <button type="submit" className="fp-btn fp-btn-primary"
              style={{ justifyContent: 'center', padding: '0.75rem', fontSize: 14, opacity: loading ? 0.7 : 1 }}
              disabled={loading}>
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

// ── Shell mobile (header + contenu scrollable + bottom nav) ──
function MobileShell({ page, onNavigate, user, isAdmin, onLogin, children }) {
  const NAV = isAdmin ? MOB_ADMIN : user ? MOB_USER : MOB_PUBLIC

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: C.bg, overflow: 'hidden' }}>

      {/* Header fixe */}
      <header style={{
        flexShrink: 0,
        background: C.sidebar,
        padding: '0 1rem',
        height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.sidebarBorder}`,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(255,255,255,0.93)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, overflow: 'hidden',
          }}>
            <img src={logoPAA} alt="PAA" style={{ width: 27, height: 27, objectFit: 'contain' }} />
          </div>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: "'Inter',sans-serif" }}>FlowPort</span>
          <span style={{ color: C.sidebarMuted, fontSize: 11, fontFamily: "'Inter',sans-serif" }}>· PAA</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <InstallPWA variant="mobile" />
          {user ? (
            <button
              onClick={logOut}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(192,57,43,0.2)', border: '1px solid rgba(192,57,43,0.35)',
                borderRadius: '6px', color: '#e57373', fontSize: 11, padding: '5px 10px',
                cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              }}
            >
              <LogOut size={11} />
              {isAdmin ? 'Admin' : 'Déconnexion'}
            </button>
          ) : (
            <button
              onClick={onLogin}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px', color: '#fff', fontSize: 11, padding: '5px 10px',
                cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              }}
            >
              <Lock size={11} />
              Connexion
            </button>
          )}
        </div>
      </header>

      {/* Contenu scrollable */}
      <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {children}
      </main>

      {/* Bottom nav fixe */}
      <nav style={{
        flexShrink: 0,
        height: 64,
        background: C.sidebar,
        borderTop: `1px solid ${C.sidebarBorder}`,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 100,
      }}>
        {NAV.map(item => {
          const Icon  = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                color: active ? '#fff' : C.sidebarMuted,
                fontSize: 10, fontFamily: "'Inter',sans-serif",
                padding: '4px 8px', flex: 1,
              }}
            >
              <Icon size={20} color={active ? '#fff' : C.sidebarMuted} />
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function SplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: C.sidebar,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '1.25rem',
    }}>
      <style>{`
        @keyframes fp-splash-fade { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }
        @keyframes fp-dot-bounce  { 0%,100% { opacity:.35; transform:translateY(0) } 50% { opacity:1; transform:translateY(-6px) } }
      `}</style>
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        background: 'rgba(255,255,255,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fp-splash-fade 0.5s ease', flexShrink: 0,
        overflow: 'hidden',
      }}>
        <img src={logoPAA} alt="Port Autonome d'Abidjan" style={{ width: 112, height: 112, objectFit: 'contain' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color:'#fff', fontWeight:800, fontSize:22, fontFamily:"'Inter',sans-serif", letterSpacing:'-0.5px', margin:0 }}>FlowPort</p>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontFamily:"'Inter',sans-serif", marginTop:4 }}>Port Autonome d'Abidjan · Système de Trafic Routier</p>
      </div>
      <div style={{ display:'flex', gap:6, marginTop:4 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width:8, height:8, borderRadius:'50%', background: '#fff',
            animation: `fp-dot-bounce 1s ${i*0.18}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

function App() {
  const [currentPage,  setCurrentPage]  = useState('dashboard')
  const [showLogin,    setShowLogin]    = useState(false)
  const [splashDone,   setSplashDone]   = useState(false)
  // État consentement : seule la MISE À JOUR compte (re-render d'App à la
  // décision) — la valeur est lue depuis sessionStorage par les consommateurs.
  const [, setGeoConsent]               = useState(() => sessionStorage.getItem(CONSENT_KEY))
  const { user, isAdmin, loading }      = useAuth()
  const isMobile                        = useIsMobile()

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 2000)
    return () => clearTimeout(t)
  }, [])

  if (loading || !splashDone) return <SplashScreen />

  let page = currentPage
  if (ADMIN_ONLY.includes(page)  && !isAdmin) page = 'dashboard'
  if (RESTRICTED.includes(page)  && !user)    page = 'dashboard'

  const Page = PAGES[page] ?? DashboardPage

  if (isMobile) {
    return (
      <>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
        <ConsentBanner onDecision={setGeoConsent} />
        <MobileShell
          page={page}
          onNavigate={setCurrentPage}
          user={user}
          isAdmin={isAdmin}
          onLogin={() => setShowLogin(true)}
        >
          <Page />
        </MobileShell>
      </>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F4F4' }}>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      <ConsentBanner onDecision={setGeoConsent} />
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
