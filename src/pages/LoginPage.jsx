// ============================================================
// LoginPage.jsx
// Page de connexion — réservée aux administrateurs PAA.
// Utilise Firebase Authentication (email + mot de passe).
// ============================================================

import { tokens } from '../styles/tokens'

function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: tokens.colors.bg.app,
    }}>
      <div style={{
        background: tokens.colors.bg.surface,
        borderRadius: tokens.radius.lg,
        padding: '2.5rem',
        width: '100%',
        maxWidth: '400px',
        boxShadow: tokens.shadows.panel,
      }}>
        <h1 style={{
          color: tokens.colors.accent.primary,
          fontFamily: tokens.fonts.ui,
          fontSize: '1.5rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          PortFlow — Connexion Admin
        </h1>
        <p style={{ color: tokens.colors.text.muted, textAlign: 'center' }}>
          (Formulaire Firebase Auth — Sprint A Jour 6)
        </p>
      </div>
    </div>
  )
}

export default LoginPage