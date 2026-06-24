import { tokens, getTrafficColor, getTrafficLabel } from '../../styles/tokens'

function GlobalKPI({ I8, I9, I10 }) {
  const niveauGlobal = I9 ? Math.round(I9) : 0
  const couleurI9    = getTrafficColor(niveauGlobal)
  const couleurI10   = I10 > 0 ? (I10 >= 67 ? tokens.colors.traffic.blocked : tokens.colors.traffic.moderate) : tokens.colors.traffic.fluid

  return (
    <div style={{
      display:      'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap:          tokens.spacing.gap,
      marginBottom: tokens.spacing.gap,
    }}>

      {/* I9 — Congestion globale */}
      <div
        className="pf-card"
        style={{
          background:   tokens.colors.bg.surface,
          borderRadius: tokens.radius.md,
          padding:      tokens.spacing.card,
          border:       `1px solid ${tokens.colors.bg.border}`,
          position:     'relative',
          overflow:     'hidden',
        }}
      >
        {/* Top accent teal */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, transparent, ${couleurI9}, transparent)`,
        }} />

        <p style={{
          color: tokens.colors.text.secondary, fontSize: '0.68rem',
          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
          marginBottom: '0.6rem',
        }}>
          Congestion globale
        </p>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{
            fontFamily:  tokens.fonts.data,
            fontSize:    '2.4rem',
            lineHeight:  1,
            color:       I9 ? couleurI9 : tokens.colors.text.muted,
            textShadow:  I9 ? `0 0 24px ${couleurI9}60` : 'none',
          }}>
            {I9 ?? '—'}
          </span>
          <span style={{ color: tokens.colors.text.muted, fontSize: '0.85rem', fontFamily: tokens.fonts.data }}>
            / 5
          </span>
        </div>

        {/* Barre de progression niveau */}
        {I9 && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{
              height: '4px', background: tokens.colors.bg.elevated,
              borderRadius: tokens.radius.full, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${(I9 / 5) * 100}%`,
                background: `linear-gradient(90deg, ${couleurI9}80, ${couleurI9})`,
                borderRadius: tokens.radius.full,
                boxShadow: `0 0 8px ${couleurI9}50`,
                transition: 'width 0.8s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              {['Fluide', '', '', 'Dense', 'Congestionné'].map((label, i) => (
                <span key={i} style={{ color: tokens.colors.text.muted, fontSize: '0.58rem', letterSpacing: '0.05em' }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* I10 — Taux d'axes congestionnés */}
      <div
        className="pf-card"
        style={{
          background:   tokens.colors.bg.surface,
          borderRadius: tokens.radius.md,
          padding:      tokens.spacing.card,
          border:       `1px solid ${tokens.colors.bg.border}`,
          position:     'relative',
          overflow:     'hidden',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, transparent, ${couleurI10}, transparent)`,
        }} />

        <p style={{
          color: tokens.colors.text.secondary, fontSize: '0.68rem',
          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
          marginBottom: '0.6rem',
        }}>
          Axes congestionnés
        </p>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{
            fontFamily: tokens.fonts.data,
            fontSize:   '2.4rem',
            lineHeight: 1,
            color:      I10 !== null ? couleurI10 : tokens.colors.text.muted,
            textShadow: I10 !== null ? `0 0 24px ${couleurI10}60` : 'none',
          }}>
            {I10 ?? '—'}
          </span>
          <span style={{ color: tokens.colors.text.muted, fontSize: '0.85rem', fontFamily: tokens.fonts.data }}>
            %
          </span>
        </div>

        <div style={{
          marginTop: '0.75rem',
          padding: '6px 10px',
          background: I10 === 0
            ? 'rgba(0,229,160,0.08)'
            : I10 >= 67
            ? 'rgba(255,51,102,0.08)'
            : 'rgba(245,158,11,0.08)',
          borderRadius: tokens.radius.sm,
          border: `1px solid ${couleurI10}25`,
        }}>
          <span style={{ color: couleurI10, fontSize: '0.72rem', fontWeight: 600 }}>
            {I10 === 0
              ? '✓ Tous les axes sont fluides'
              : I10 >= 67
              ? '⚠ Réseau fortement impacté'
              : '◐ Perturbations localisées'}
          </span>
        </div>
      </div>

      {/* I8 — Point le plus critique */}
      <div
        className="pf-card"
        style={{
          background:   tokens.colors.bg.surface,
          borderRadius: tokens.radius.md,
          padding:      tokens.spacing.card,
          border:       `1px solid ${tokens.colors.bg.border}`,
          position:     'relative',
          overflow:     'hidden',
          gridColumn:   'span 1',
        }}
      >
        {I8 && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
            background: `linear-gradient(90deg, transparent, ${getTrafficColor(I8.niveau)}, transparent)`,
          }} />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
          <p style={{
            color: tokens.colors.text.secondary, fontSize: '0.68rem',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
          }}>
            Point critique (I8)
          </p>
          {I8?.provisoire && (
            <span style={{
              color: tokens.colors.text.muted,
              fontSize: '0.6rem',
              fontFamily: tokens.fonts.data,
              background: tokens.colors.bg.elevated,
              padding: '2px 6px',
              borderRadius: tokens.radius.full,
              border: `1px solid ${tokens.colors.bg.border}`,
            }}>
              POC · niveau axe
            </span>
          )}
        </div>

        {I8 ? (
          <div>
            <div style={{
              color:      tokens.colors.text.primary,
              fontWeight: 600,
              fontSize:   '0.9rem',
              marginBottom: '6px',
            }}>
              {I8.nom}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          '5px',
                padding:      '3px 10px',
                borderRadius: tokens.radius.full,
                background:   getTrafficColor(I8.niveau) + '18',
                border:       `1px solid ${getTrafficColor(I8.niveau)}50`,
                color:        getTrafficColor(I8.niveau),
                fontSize:     '0.72rem',
                fontWeight:   700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <span style={{
                  width: '5px', height: '5px',
                  background: getTrafficColor(I8.niveau),
                  borderRadius: '50%',
                  boxShadow: `0 0 6px ${getTrafficColor(I8.niveau)}`,
                  display: 'inline-block',
                }} />
                {getTrafficLabel(I8.niveau)}
              </span>
              <span style={{
                color: tokens.colors.text.secondary,
                fontSize: '0.78rem',
                fontFamily: tokens.fonts.data,
              }}>
                {I8.retard > 0 ? '+' : ''}{I8.retard} min
              </span>
            </div>
          </div>
        ) : (
          <p style={{ color: tokens.colors.text.muted, fontSize: '0.85rem' }}>
            Calcul en cours...
          </p>
        )}
      </div>
    </div>
  )
}

export default GlobalKPI
