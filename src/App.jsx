// ============================================================
// App.jsx — Routeur principal PortFlow
// Jour 6 : protection de /admin par rôle, navbar dynamique
// selon l'état de connexion (Connexion / Déconnexion).
// ============================================================

import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import PublicView      from './pages/PublicView'
import AdminView       from './pages/AdminView'
import LoginPage       from './pages/LoginPage'
import ProtectedRoute  from './components/shared/ProtectedRoute'
import { useAuth }     from './hooks/useAuth'
import { logOut }      from './services/auth'
import { tokens }      from './styles/tokens'

// Navbar séparée pour avoir accès à useNavigate et useAuth
function Navbar() {
  const { isLoggedIn, role } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logOut()
    navigate('/')
  }

  return (
    <nav style={{
      background: tokens.colors.bg.surface, borderBottom: `1px solid ${tokens.colors.bg.border}`,
      padding: '0.75rem 1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center',
    }}>
      <span style={{ color: tokens.colors.accent.primary, fontWeight: 'bold', fontSize: '1.1rem' }}>
        PortFlow
      </span>

      <Link to="/" style={{ color: tokens.colors.text.secondary, textDecoration: 'none' }}>
        Carte publique
      </Link>

      {/* Visible seulement si connecté avec le rôle admin */}
      {isLoggedIn && role === 'admin' && (
        <Link to="/admin" style={{ color: tokens.colors.text.secondary, textDecoration: 'none' }}>
          Administration
        </Link>
      )}

      <div style={{ marginLeft: 'auto' }}>
        {isLoggedIn ? (
          <button onClick={handleLogout} style={{
            background: 'transparent', border: `1px solid ${tokens.colors.bg.border}`,
            color: tokens.colors.text.secondary, borderRadius: tokens.radius.sm,
            padding: '0.4rem 0.9rem', cursor: 'pointer', fontSize: '0.85rem',
          }}>
            Déconnexion
          </button>
        ) : (
          <Link to="/login" style={{ color: tokens.colors.accent.primary, textDecoration: 'none', fontWeight: 'bold' }}>
            Connexion
          </Link>
        )}
      </div>
    </nav>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<PublicView />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminView />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App