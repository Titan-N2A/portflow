// ============================================================
// GlobalKPI.jsx — Vue d'ensemble du trafic PAA
// Affiche I8 (tronçon critique, POC niveau axe), I9 (congestion
// globale) et I10 (taux d'axes congestionnés).
// ============================================================

import { tokens, getTrafficColor, getTrafficLabel } from '../../styles/tokens'

function GlobalKPI({ I8, I9, I10 }) {
  return (
    <div style={{
      display:      'flex',
      gap:          tokens.spacing.gap,
      marginBottom: tokens.spacing.gap,
      flexWrap:     'wrap',
    }}>

      {/* I9 — Congestion globale */}
      <div style={{
        background:   tokens.colors.bg.elevated,
        borderRadius: tokens.radius.md,
        padding:      tokens.spacing.card,
        flex:         1,
        minWidth:     '200px',
      }}>
        <p style={{ color: tokens.colors.text.secondary, fontSize: '0.78rem', textTransform: 'uppercase' }}>
          Congestion globale (I9)
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '0.4rem' }}>
          <span style={{
            fontFamily: tokens.fonts.data,
            fontSize:   '1.8rem',
            color:      I9 ? getTrafficColor(Math.round(I9)) : tokens.colors.text.muted,
          }}>
            {I9 ?? '—'}
          </span>
          <span style={{ color: tokens.colors.text.muted, fontSize: '0.85rem' }}>/ 5</span>
        </div>
      </div>

      {/* I10 — Taux d'axes congestionnés */}
      <div style={{
        background:   tokens.colors.bg.elevated,
        borderRadius: tokens.radius.md,
        padding:      tokens.spacing.card,
        flex:         1,
        minWidth:     '200px',
      }}>
        <p style={{ color: tokens.colors.text.secondary, fontSize: '0.78rem', textTransform: 'uppercase' }}>
          Axes congestionnés (I10)
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '0.4rem' }}>
          <span style={{
            fontFamily: tokens.fonts.data,
            fontSize:   '1.8rem',
            color:      I10 > 0 ? tokens.colors.traffic.dense : tokens.colors.traffic.fluid,
          }}>
            {I10 ?? '—'}
          </span>
          <span style={{ color: tokens.colors.text.muted, fontSize: '0.85rem' }}>%</span>
        </div>
      </div>

      {/* I8 — Tronçon critique (provisoire) */}
      <div style={{
        background:   tokens.colors.bg.elevated,
        borderRadius: tokens.radius.md,
        padding:      tokens.spacing.card,
        flex:         2,
        minWidth:     '260px',
      }}>
        <p style={{ color: tokens.colors.text.secondary, fontSize: '0.78rem', textTransform: 'uppercase' }}>
          Point le plus critique (I8)
          {I8?.provisoire && (
            <span style={{
              marginLeft: '6px',
              color:      tokens.colors.text.muted,
              fontStyle:  'italic',
              fontSize:   '0.7rem',
            }}>
              · POC niveau axe
            </span>
          )}
        </p>
        {I8 ? (
          <div style={{ marginTop: '0.4rem' }}>
            <span style={{ color: tokens.colors.text.primary, fontWeight: 'bold' }}>
              {I8.nom}
            </span>
            <span style={{
              marginLeft:   '8px',
              padding:      '2px 8px',
              borderRadius: tokens.radius.full,
              background:   getTrafficColor(I8.niveau) + '33',
              color:        getTrafficColor(I8.niveau),
              fontSize:     '0.75rem',
              fontWeight:   'bold',
            }}>
              {getTrafficLabel(I8.niveau)}
            </span>
            <p style={{ color: tokens.colors.text.muted, fontSize: '0.8rem', marginTop: '4px' }}>
              Retard : {I8.retard > 0 ? `+${I8.retard}` : I8.retard} min
            </p>
          </div>
        ) : (
          <p style={{ color: tokens.colors.text.muted, marginTop: '0.4rem' }}>Calcul en cours...</p>
        )}
      </div>

    </div>
  )
}

export default GlobalKPI