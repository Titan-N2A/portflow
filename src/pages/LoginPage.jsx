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
      minHeight:       'calc(100vh - 56px)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '2rem',
    }}>
      {/* Card de connexion */}
      <div style={{
        width:        '100%',
        maxWidth:     '400px',
        animation:    'fadeSlideUp 0.35s ease both',
      }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
            <polygon
              points="16,2 28,9 28,23 16,30 4,23 4,9"
              fill="rgba(0,245,212,0.08)"
              stroke="#00F5D4"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <text x="16" y="20" textAnchor="middle" fill="#00F5D4" fontSize="9" fontFamily="Space Mono, monospace" fontWeight="700">PF</text>
          </svg>
          <h1 style={{
            color:         tokens.colors.text.primary,
            fontFamily:    tokens.fonts.ui,
            fontSize:      '1.3rem',
            fontWeight:    700,
            letterSpacing: '0.05em',
            margin:        0,
          }}>
            PORT<span style={{ color: tokens.colors.accent.primary }}>FLOW</span>
          </h1>
          <p style={{
            color:         tokens.colors.text.muted,
            fontSize:      '0.72rem',
            fontFamily:    tokens.fonts.data,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop:     '4px',
          }}>
            Accès Administration
          </p>
        </div>

        {/* Form card */}
        <div style={{
          background:    tokens.colors.bg.surface,
          borderRadius:  tokens.radius.lg,
          padding:       '2rem',
          border:        `1px solid ${tokens.colors.bg.border}`,
          boxShadow:     `${tokens.shadows.panel}, 0 0 60px rgba(0,245,212,0.04)`,
          position:      'relative',
          overflow:      'hidden',
        }}>
          {/* Top accent */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent 0%, ${tokens.colors.accent.primary} 50%, transparent 100%)`,
          }} />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{
                color:         tokens.colors.text.secondary,
                fontSize:      '0.75rem',
                fontFamily:    tokens.fonts.ui,
                fontWeight:    600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display:       'block',
                marginBottom:  '6px',
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="pf-input"
                placeholder="admin@portflow.ci"
              />
            </div>

            <div>
              <label style={{
                color:         tokens.colors.text.secondary,
                fontSize:      '0.75rem',
                fontFamily:    tokens.fonts.ui,
                fontWeight:    600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display:       'block',
                marginBottom:  '6px',
              }}>
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="pf-input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div style={{
                padding:      '0.6rem 0.9rem',
                background:   'rgba(255,51,102,0.08)',
                border:       '1px solid rgba(255,51,102,0.25)',
                borderRadius: tokens.radius.sm,
              }}>
                <p style={{
                  color:      tokens.colors.traffic.blocked,
                  fontSize:   '0.82rem',
                  margin:     0,
                  fontFamily: tokens.fonts.ui,
                }}>
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="pf-btn-primary"
              style={{
                width:      '100%',
                padding:    '0.75rem',
                fontSize:   '0.9rem',
                marginTop:  '0.25rem',
                opacity:    loading ? 0.65 : 1,
                cursor:     loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '⏳ Connexion...' : 'Se connecter →'}
            </button>
          </form>
        </div>

        <p style={{
          textAlign:  'center',
          color:      tokens.colors.text.muted,
          fontSize:   '0.68rem',
          fontFamily: tokens.fonts.data,
          marginTop:  '1.25rem',
          letterSpacing: '0.04em',
        }}>
          Port Autonome d'Abidjan — accès réservé
        </p>
      </div>
    </div>
  )
}

export default LoginPage
