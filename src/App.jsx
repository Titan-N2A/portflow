// ============================================================
// App.jsx — Routeur principal PortFlow
// Gère la navigation entre les 2 profils :
//   /       → Vue publique (sans connexion)
//   /admin  → Interface admin (connexion requise)
//   /login  → Page de connexion
// ============================================================

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import PublicView from './pages/PublicView'
import AdminView  from './pages/AdminView'
import LoginPage  from './pages/LoginPage'
import { tokens } from './styles/tokens'

function App() {
  return (
    <BrowserRouter>

      {/* Barre de navigation principale */}
      <nav style={{
        background:   tokens.colors.bg.surface,
        borderBottom: `1px solid ${tokens.colors.bg.border}`,
        padding:      '0.75rem 1.5rem',
        display:      'flex',
        gap:          '1.5rem',
        alignItems:   'center',
      }}>

        {/* Logo */}
        <span style={{
          color:      tokens.colors.accent.primary,
          fontWeight: 'bold',
          fontSize:   '1.1rem',
        }}>
          PortFlow
        </span>

        {/* Liens de navigation */}
        <Link to="/"      style={{ color: tokens.colors.text.secondary, textDecoration: 'none' }}>
          Carte publique
        </Link>
        <Link to="/admin" style={{ color: tokens.colors.text.secondary, textDecoration: 'none' }}>
          Administration
        </Link>
        <Link to="/login" style={{ color: tokens.colors.text.secondary, textDecoration: 'none' }}>
          Connexion
        </Link>

      </nav>

      {/* Contenu des pages selon l'URL */}
      <Routes>
        <Route path="/"      element={<PublicView />} />
        <Route path="/admin" element={<AdminView />}  />
        <Route path="/login" element={<LoginPage />}  />
      </Routes>

    </BrowserRouter>
  )
}

export default App