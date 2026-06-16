// ============================================================
// AdminView.jsx — Interface Administrateur
// Contient le bouton de seed (import données PAA) — usage unique.
// ============================================================

import { useState }                       from 'react'
import { seedAll }                        from '../services/seed'
import { tokens }                         from '../styles/tokens'

function AdminView() {
  const [status,   setStatus]   = useState('idle')    // idle | loading | done | error
  const [progress, setProgress] = useState(0)
  const [message,  setMessage]  = useState('')

  // Lance l'import complet des données PAA dans Firestore
  async function handleSeed() {
    setStatus('loading')
    setProgress(0)
    setMessage('Import en cours...')
    try {
      await seedAll((pct) => {
        setProgress(pct)
        setMessage(`Import des mesures... ${pct}%`)
      })
      setStatus('done')
      setMessage('✅ Import terminé — 2 016 mesures dans Firestore !')
    } catch (err) {
      setStatus('error')
      setMessage(`❌ Erreur : ${err.message}`)
      console.error(err)
    }
  }

  return (
    <div style={{ padding: tokens.spacing.section, maxWidth: '800px', margin: '0 auto' }}>

      <h1 style={{ color: tokens.colors.accent.primary, fontSize: '1.5rem', marginBottom: '2rem' }}>
        Interface Administrateur
      </h1>

      {/* Section Import données PAA */}
      <div style={{
        background:    tokens.colors.bg.surface,
        borderRadius:  tokens.radius.md,
        padding:       tokens.spacing.card,
        border:        `1px solid ${tokens.colors.bg.border}`,
      }}>
        <h2 style={{ color: tokens.colors.text.primary, marginBottom: '0.5rem' }}>
          Import données réelles PAA
        </h2>
        <p style={{ color: tokens.colors.text.secondary, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Charge les 2 016 mesures (février 2025) + axes + références dans Firestore.
          À exécuter une seule fois.
        </p>

        {/* Barre de progression */}
        {status === 'loading' && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              background:    tokens.colors.bg.elevated,
              borderRadius:  tokens.radius.full,
              height:        '8px',
              overflow:      'hidden',
            }}>
              <div style={{
                width:         `${progress}%`,
                height:        '100%',
                background:    tokens.colors.accent.primary,
                transition:    tokens.transition.normal,
                borderRadius:  tokens.radius.full,
              }} />
            </div>
            <p style={{ color: tokens.colors.text.muted, fontSize: '0.8rem', marginTop: '0.5rem' }}>
              {progress}%
            </p>
          </div>
        )}

        {/* Message de statut */}
        {message && (
          <p style={{
            color:         status === 'error' ? tokens.colors.traffic.blocked
                         : status === 'done'  ? tokens.colors.traffic.fluid
                         : tokens.colors.text.secondary,
            marginBottom:  '1rem',
            fontSize:      '0.9rem',
          }}>
            {message}
          </p>
        )}

        {/* Bouton */}
        <button
          onClick={handleSeed}
          disabled={status === 'loading' || status === 'done'}
          style={{
            background:    status === 'done' ? tokens.colors.traffic.fluid
                         : tokens.colors.accent.primary,
            color:         '#fff',
            border:        'none',
            borderRadius:  tokens.radius.sm,
            padding:       '0.75rem 1.5rem',
            cursor:        status === 'loading' || status === 'done' ? 'not-allowed' : 'pointer',
            fontWeight:    'bold',
            fontSize:      '0.95rem',
            opacity:       status === 'loading' ? 0.7 : 1,
            transition:    tokens.transition.fast,
          }}
        >
          {status === 'idle'    && '🚀 Lancer l\'import PAA'}
          {status === 'loading' && '⏳ Import en cours...'}
          {status === 'done'    && '✅ Import terminé'}
          {status === 'error'   && '🔁 Réessayer'}
        </button>
      </div>

    </div>
  )
}

export default AdminView