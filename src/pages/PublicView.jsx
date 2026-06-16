// ============================================================
// PublicView.jsx — Interface Grand Public
// Affiche : KPI live (I1, I3, I5, I7) + carte temps réel
// ============================================================

import MapView  from '../components/Map/MapView'
import KPICard  from '../components/Dashboard/KPICard'
import { useTrafficLive } from '../hooks/useTrafficLive'
import { tokens }         from '../styles/tokens'

function PublicView() {
  const { mesures, lastUpdate, loading, refresh } = useTrafficLive()

  // Données des 4 routes pour les KPI
  const routes = [
    { id: 'axe1_aller',  label: 'CARENA → Palm Beach' },
    { id: 'axe1_retour', label: 'Palm Beach → CARENA'  },
    { id: 'axe2_aller',  label: 'Toyota CFAO → PB'     },
    { id: 'axe3_aller',  label: 'SODECI → Palm Beach'  },
  ]

  return (
    <div style={{
      padding:  tokens.spacing.section,
      maxWidth: '1200px',
      margin:   '0 auto',
    }}>

      {/* En-tête */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   tokens.spacing.gap,
      }}>
        <div>
          <h1 style={{ color: tokens.colors.text.primary, fontSize: '1.5rem', fontWeight: 'bold' }}>
            Trafic en temps réel
          </h1>
          <p style={{ color: tokens.colors.text.secondary, fontSize: '0.85rem' }}>
            {lastUpdate
              ? `Mise à jour : ${lastUpdate.toLocaleTimeString('fr-FR')}`
              : 'Connexion en cours...'}
          </p>
        </div>

        {/* Bouton rafraîchir */}
        <button
          onClick={refresh}
          style={{
            background:   tokens.colors.accent.primary,
            color:        '#fff',
            border:       'none',
            borderRadius: tokens.radius.sm,
            padding:      '0.5rem 1rem',
            cursor:       'pointer',
            fontSize:     '0.85rem',
            fontWeight:   'bold',
          }}
        >
          🔄 Actualiser
        </button>
      </div>

      {/* KPI Cards — I1 (temps), I3 (retard), I5 (vitesse), I7 (niveau) */}
      <div style={{
        display:       'flex',
        gap:           tokens.spacing.gap,
        marginBottom:  tokens.spacing.gap,
        flexWrap:      'wrap',
      }}>
        {routes.map(route => {
          const m = mesures[route.id]
          return (
            <KPICard
              key={route.id}
              label={route.label}
              valeur={m?.I1  ?? null}
              unite="min"
              reference={m?.I2 ?? null}
              tendance={m?.I3 ?? null}
              niveau={m?.I7  ?? 0}
            />
          )
        })}
      </div>

      {/* Carte interactive */}
      <MapView mesures={mesures} />

      {/* Légende */}
      <div style={{ display: 'flex', gap: tokens.spacing.gap, marginTop: tokens.spacing.gap, flexWrap: 'wrap' }}>
        {[
          { label: 'Fluide',       color: tokens.colors.traffic.fluid    },
          { label: 'Modéré',       color: tokens.colors.traffic.moderate },
          { label: 'Dense',        color: tokens.colors.traffic.dense    },
          { label: 'Congestionné', color: tokens.colors.traffic.blocked  },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '4px', background: item.color, borderRadius: '2px' }} />
            <span style={{ color: tokens.colors.text.secondary, fontSize: '0.85rem' }}>{item.label}</span>
          </div>
        ))}
      </div>

    </div>
  )
}

export default PublicView