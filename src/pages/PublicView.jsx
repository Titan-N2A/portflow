// ============================================================
// PublicView.jsx — Interface Grand Public
// Jour 5 : ajoute la vue globale (I8/I9/I10) et l'export CSV.
// ============================================================

import MapView    from '../components/Map/MapView'
import KPICard    from '../components/Dashboard/KPICard'
import GlobalKPI  from '../components/Dashboard/GlobalKPI'
import { useTrafficLive } from '../hooks/useTrafficLive'
import { exportMesuresCSV } from '../utils/exportCSV'
import { tokens } from '../styles/tokens'

function PublicView() {
  const { mesures, lastUpdate, refresh, I8, I9, I10 } = useTrafficLive()

  const routes = [
    { id: 'axe1_aller',  label: 'CARENA → Palm Beach' },
    { id: 'axe1_retour', label: 'Palm Beach → CARENA'  },
    { id: 'axe2_aller',  label: 'Toyota CFAO → PB'     },
    { id: 'axe3_aller',  label: 'SODECI → Palm Beach'  },
  ]

  return (
    <div style={{ padding: tokens.spacing.section, maxWidth: '1200px', margin: '0 auto' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.gap }}>
        <div>
          <h1 style={{ color: tokens.colors.text.primary, fontSize: '1.5rem', fontWeight: 'bold' }}>
            Trafic en temps réel
          </h1>
          <p style={{ color: tokens.colors.text.secondary, fontSize: '0.85rem' }}>
            {lastUpdate ? `Mise à jour : ${lastUpdate.toLocaleTimeString('fr-FR')}` : 'Connexion en cours...'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {/* Bouton export CSV */}
          <button
            onClick={() => exportMesuresCSV(mesures)}
            style={{
              background: tokens.colors.bg.elevated, color: tokens.colors.text.primary,
              border: `1px solid ${tokens.colors.bg.border}`, borderRadius: tokens.radius.sm,
              padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
            }}
          >
            📥 Export CSV
          </button>

          {/* Bouton rafraîchir */}
          <button
            onClick={refresh}
            style={{
              background: tokens.colors.accent.primary, color: '#fff', border: 'none',
              borderRadius: tokens.radius.sm, padding: '0.5rem 1rem', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 'bold',
            }}
          >
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* Vue globale — I8, I9, I10 */}
      <GlobalKPI I8={I8} I9={I9} I10={I10} />

      {/* KPI par axe — I1, I3, I5, I7 */}
      <div style={{ display: 'flex', gap: tokens.spacing.gap, marginBottom: tokens.spacing.gap, flexWrap: 'wrap' }}>
        {routes.map(route => {
          const m = mesures[route.id]
          return (
            <KPICard
              key={route.id}
              label={route.label}
              valeur={m?.I1 ?? null}
              unite="min"
              reference={m?.I2 ?? null}
              tendance={m?.I3 ?? null}
              niveau={m?.I7 ?? 0}
            />
          )
        })}
      </div>

      {/* Carte interactive avec zoom intelligent */}
      <p style={{ color: tokens.colors.text.muted, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
        💡 Cliquez sur un axe pour zoomer automatiquement sur son tracé.
      </p>
      <MapView mesures={mesures} />

      {/* Légende */}
      <div style={{ display: 'flex', gap: tokens.spacing.gap, marginTop: tokens.spacing.gap, flexWrap: 'wrap' }}>
        {[
          { label: 'Fluide', color: tokens.colors.traffic.fluid },
          { label: 'Modéré', color: tokens.colors.traffic.moderate },
          { label: 'Dense', color: tokens.colors.traffic.dense },
          { label: 'Congestionné', color: tokens.colors.traffic.blocked },
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