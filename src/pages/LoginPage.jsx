// ============================================================
// LoginPage.jsx — Page de connexion administrateur
// Formulaire email + mot de passe via Firebase Auth.
// Redirige vers /admin après connexion réussie.
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '../services/auth'
import { tokens } from '../styles/tokens'

function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/admin')
    } catch (err) {
      const messages = {
        'auth/invalid-credential': 'Email ou mot de passe incorrect.',
        'auth/user-not-found':     'Aucun compte avec cet email.',
        'auth/wrong-password':     'Mot de passe incorrect.',
        'auth/too-many-requests':  'Trop de tentatives. Réessayez plus tard.',
      }
      setError(messages[err.code] || 'Erreur de connexion. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: tokens.colors.bg.app,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: tokens.colors.bg.surface, borderRadius: tokens.radius.lg,
        padding: '2.5rem', width: '100%', maxWidth: '400px',
        boxShadow: tokens.shadows.panel,
      }}>
        <h1 style={{
          color: tokens.colors.accent.primary, fontFamily: tokens.fonts.ui,
          fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center',
        }}>
          PortFlow — Connexion Admin
        </h1>

        <label style={{ color: tokens.colors.text.secondary, fontSize: '0.85rem' }}>Email</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          style={{
            width: '100%', padding: '0.6rem', marginTop: '0.3rem', marginBottom: '1rem',
            background: tokens.colors.bg.elevated, border: `1px solid ${tokens.colors.bg.border}`,
            borderRadius: tokens.radius.sm, color: tokens.colors.text.primary, fontSize: '0.9rem',
          }}
        />

        <label style={{ color: tokens.colors.text.secondary, fontSize: '0.85rem' }}>Mot de passe</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
          style={{
            width: '100%', padding: '0.6rem', marginTop: '0.3rem', marginBottom: '1.2rem',
            background: tokens.colors.bg.elevated, border: `1px solid ${tokens.colors.bg.border}`,
            borderRadius: tokens.radius.sm, color: tokens.colors.text.primary, fontSize: '0.9rem',
          }}
        />

        {error && (
          <p style={{ color: tokens.colors.traffic.blocked, fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        <button
          type="submit" disabled={loading}
          style={{
            width: '100%', background: tokens.colors.accent.primary, color: '#fff',
            border: 'none', borderRadius: tokens.radius.sm, padding: '0.75rem',
            cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold',
            fontSize: '0.95rem', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}

export default LoginPage