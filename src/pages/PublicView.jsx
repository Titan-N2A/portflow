import MapView   from '../components/Map/MapView'
import KPICard   from '../components/Dashboard/KPICard'
import GlobalKPI from '../components/Dashboard/GlobalKPI'
import { useTrafficLive }  from '../hooks/useTrafficLive'
import { exportMesuresCSV } from '../utils/exportCSV'
import { tokens, getTrafficColor, getTrafficLabel } from '../styles/tokens'

const ROUTES = [
  { id: 'axe1_aller',  label: 'CARENA → Palm Beach'  },
  { id: 'axe1_retour', label: 'Palm Beach → CARENA'  },
  { id: 'axe2_aller',  label: 'Toyota CFAO → PB'     },
  { id: 'axe3_aller',  label: 'SODECI → Palm Beach'  },
]

const LEGENDE = [
  { label: 'Fluide',       color: tokens.colors.traffic.fluid    },
  { label: 'Modéré',       color: tokens.colors.traffic.moderate },
  { label: 'Dense',        color: tokens.colors.traffic.dense    },
  { label: 'Congestionné', color: tokens.colors.traffic.blocked  },
]

function PublicView() {
  const { mesures, lastUpdate, refresh, I8, I9, I10 } = useTrafficLive()

  // Résumé quick : nombre d'axes par niveau
  const routesData = ROUTES.map(r => mesures[r.id]).filter(Boolean)
  const niveaux    = routesData.map(m => m.I7 ?? 0)
  const nFluides   = niveaux.filter(n => n <= 2 && n > 0).length
  const nDenses    = niveaux.filter(n => n >= 4).length

  return (
    <div style={{
      height:         '100vh',
      display:        'flex',
      flexDirection:  'column',
      overflow:       'hidden',
      background:     tokens.colors.bg.app,
    }}>

      {/* ── Top header bar (inspiré Kemetra / Haulix) ──────── */}
      <div style={{
        flexShrink:     0,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0.65rem 1.25rem',
        background:     tokens.colors.bg.surface,
        borderBottom:   `1px solid ${tokens.colors.bg.border}`,
        gap:            '1rem',
        flexWrap:       'wrap',
      }}>
        {/* Titre + sous-titre */}
        <div>
          <h1 style={{
            color:         tokens.colors.text.primary,
            fontSize:      '1rem',
            fontFamily:    tokens.fonts.ui,
            fontWeight:    700,
            margin:        0,
            letterSpacing: '-0.01em',
          }}>
            Axes d'accès — Port d'Abidjan
          </h1>
          <p style={{
            color:      tokens.colors.text.muted,
            fontSize:   '0.65rem',
            fontFamily: tokens.fonts.data,
            margin:     0,
            marginTop:  '1px',
          }}>
            {lastUpdate
              ? `Mise à jour ${lastUpdate.toLocaleTimeString('fr-FR')}`
              : 'Connexion...'}
          </p>
        </div>

        {/* Pills de statut (style Haulix) */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusPill
            dot="#00E5A0"
            label={`${routesData.length} axes actifs`}
          />
          {nFluides > 0 && (
            <StatusPill dot={tokens.colors.traffic.fluid} label={`${nFluides} fluide(s)`} />
          )}
          {nDenses > 0 && (
            <StatusPill dot={tokens.colors.traffic.blocked} label={`${nDenses} congestionné(s)`} />
          )}
          {I9 && (
            <StatusPill
              dot={getTrafficColor(Math.round(I9))}
              label={`Congestion globale : ${I9}/5`}
            />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          <button onClick={() => exportMesuresCSV(mesures)} className="pf-btn-secondary"
            style={{ padding: '0.38rem 0.85rem', fontSize: '0.75rem' }}>
            ↓ CSV
          </button>
          <button onClick={refresh} className="pf-btn-primary"
            style={{ padding: '0.38rem 0.85rem', fontSize: '0.75rem' }}>
            ↺ Actualiser
          </button>
        </div>
      </div>

      {/* ── Corps : Map gauche + Data droite (layout Kemetra) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Carte fond blanc ─────────────────────────────── */}
        <div style={{ flex: '1 1 60%', position: 'relative', minWidth: 0 }}>
          <MapView mesures={mesures} height="100%" />

          {/* Légende flottante sur la carte */}
          <div style={{
            position:     'absolute',
            bottom:       '48px',
            left:         '12px',
            zIndex:       1000,
            background:   'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            borderRadius: tokens.radius.md,
            padding:      '0.6rem 0.85rem',
            border:       '1px solid rgba(0,0,0,0.08)',
            boxShadow:    '0 4px 16px rgba(0,0,0,0.1)',
            display:      'flex',
            flexDirection: 'column',
            gap:          '5px',
          }}>
            <p style={{
              color:         '#666',
              fontSize:      '0.6rem',
              fontFamily:    tokens.fonts.ui,
              fontWeight:    700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              margin:        0,
              marginBottom:  '2px',
            }}>
              Niveaux de trafic
            </p>
            {LEGENDE.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{
                  width:        '20px',
                  height:       '4px',
                  background:   item.color,
                  borderRadius: '2px',
                  boxShadow:    `0 0 4px ${item.color}60`,
                }} />
                <span style={{ color: '#444', fontSize: '0.72rem', fontFamily: tokens.fonts.ui }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Panneau data droite ───────────────────────────── */}
        <div style={{
          width:        '380px',
          flexShrink:   0,
          display:      'flex',
          flexDirection: 'column',
          background:   tokens.colors.bg.app,
          borderLeft:   `1px solid ${tokens.colors.bg.border}`,
          overflowY:    'auto',
          overflowX:    'hidden',
        }}>
          {/* Section: Vue globale */}
          <div style={{
            padding:      '1rem',
            borderBottom: `1px solid ${tokens.colors.bg.border}`,
          }}>
            <SectionLabel label="Vue globale réseau" />
            <GlobalKPI I8={I8} I9={I9} I10={I10} />
          </div>

          {/* Section: Temps de traversée */}
          <div style={{
            padding:      '1rem',
            borderBottom: `1px solid ${tokens.colors.bg.border}`,
          }}>
            <SectionLabel label="Temps de traversée" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ROUTES.map(route => {
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
          </div>

          {/* Section: Infos bas */}
          <div style={{ padding: '0.75rem 1rem' }}>
            <p style={{
              color:      tokens.colors.text.muted,
              fontSize:   '0.65rem',
              fontFamily: tokens.fonts.data,
              letterSpacing: '0.04em',
              lineHeight: 1.6,
            }}>
              Données TomTom · Mise à jour toutes les 10 min · Références PAA fév. 2025
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sous-composants ────────────────────────────────────────

function StatusPill({ dot, label }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '5px',
      padding:      '3px 10px',
      background:   `${dot}12`,
      border:       `1px solid ${dot}30`,
      borderRadius: tokens.radius.full,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dot, flexShrink: 0,
        boxShadow: `0 0 5px ${dot}80`,
      }} />
      <span style={{
        color:         tokens.colors.text.secondary,
        fontSize:      '0.68rem',
        fontFamily:    tokens.fonts.ui,
        fontWeight:    500,
        whiteSpace:    'nowrap',
      }}>
        {label}
      </span>
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           '8px',
      marginBottom:  '0.65rem',
    }}>
      <span style={{
        color:         tokens.colors.text.muted,
        fontSize:      '0.62rem',
        fontFamily:    tokens.fonts.ui,
        fontWeight:    700,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
      }}>
        {label}
      </span>
      <div style={{
        flex:       1,
        height:     '1px',
        background: `linear-gradient(90deg, ${tokens.colors.bg.border}, transparent)`,
      }} />
    </div>
  )
}

export default PublicView
