import { useState } from 'react'
import { Activity, Lock } from 'lucide-react'
import { signIn } from '../services/auth'
import { C } from '../styles/tokens'

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  'auth/user-not-found':     'Aucun compte avec cet email.',
  'auth/wrong-password':     'Mot de passe incorrect.',
  'auth/too-many-requests':  'Trop de tentatives. Réessayez dans quelques minutes.',
}

function LoginPage() {
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
      // useAuth() dans App.jsx détecte le changement et affiche le dashboard
    } catch (err) {
      setError(AUTH_ERRORS[err.code] ?? 'Erreur de connexion. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg, padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '14px',
            background: C.sidebarActive,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: `0 4px 20px ${C.sidebarActive}40`,
          }}>
            <Activity size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.3px', margin: 0 }}>
            FlowPort
          </h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4, letterSpacing: '0.05em' }}>
            Port Autonome d'Abidjan · Accès sécurisé
          </p>
        </div>

        {/* Card formulaire */}
        <div className="fp-card" style={{ padding: '2rem', borderRadius: '12px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' }}>
            <Lock size={15} color={C.primary} />
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Connexion</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="fp-label">Adresse email</label>
              <input
                type="email"
                className="fp-input"
                placeholder="admin@portabidjan.ci"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="fp-label">Mot de passe</label>
              <input
                type="password"
                className="fp-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{
                padding: '0.65rem 0.9rem',
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: '8px',
              }}>
                <p style={{ fontSize: 12, color: C.danger, margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="fp-btn fp-btn-primary"
              style={{ justifyContent: 'center', padding: '0.75rem', fontSize: 14, marginTop: '0.25rem', opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.textLight, marginTop: '1rem' }}>
          Accès réservé aux agents autorisés PAA
        </p>
      </div>
    </div>
  )
}

export default LoginPage
