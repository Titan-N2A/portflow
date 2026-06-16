// ============================================================
// PublicView.jsx — Interface Grand Public
// Accessible sans connexion. Affiche la carte temps réel
// et les indicateurs clés (I1, I3, I5, I7, I9).
// ============================================================

import MapView from '../components/Map/MapView'
import { tokens } from '../styles/tokens'

function PublicView() {
  return (
    <div style={{
      padding:   tokens.spacing.section,
      maxWidth:  '1200px',
      margin:    '0 auto',
    }}>

      {/* En-tête de page */}
      <div style={{ marginBottom: tokens.spacing.gap }}>
        <h1 style={{
          color:      tokens.colors.text.primary,
          fontSize:   '1.5rem',
          fontWeight: 'bold',
        }}>
          Trafic en temps réel
        </h1>
        <p style={{ color: tokens.colors.text.secondary, marginTop: '0.25rem' }}>
          Port Autonome d'Abidjan — 3 axes surveillés
        </p>
      </div>

      {/* Carte interactive */}
      <MapView />

      {/* Légende des niveaux */}
      <div style={{
        display:       'flex',
        gap:           tokens.spacing.gap,
        marginTop:     tokens.spacing.gap,
        flexWrap:      'wrap',
      }}>
        {[
          { label: 'Fluide',        color: tokens.colors.traffic.fluid    },
          { label: 'Modéré',        color: tokens.colors.traffic.moderate },
          { label: 'Dense',         color: tokens.colors.traffic.dense    },
          { label: 'Congestionné',  color: tokens.colors.traffic.blocked  },
        ].map(item => (
          <div key={item.label} style={{
            display:    'flex',
            alignItems: 'center',
            gap:        '6px',
          }}>
            <div style={{
              width:        '24px',
              height:       '4px',
              background:   item.color,
              borderRadius: '2px',
            }} />
            <span style={{
              color:    tokens.colors.text.secondary,
              fontSize: '0.85rem',
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}

export default PublicView