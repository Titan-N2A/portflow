import { tokens, getTrafficColor, getTrafficLabel } from '../../styles/tokens'

function KPICard({ label, valeur, unite, reference, niveau, tendance }) {
  const couleurNiveau = getTrafficColor(niveau)
  const hasTendance   = tendance !== null && tendance !== undefined
  const isPositif     = tendance > 0
  const isNegatif     = tendance < 0

  return (
    <div
      className="pf-card"
      style={{
        background:    tokens.colors.bg.surface,
        borderRadius:  tokens.radius.md,
        padding:       tokens.spacing.card,
        border:        `1px solid ${tokens.colors.bg.border}`,
        borderTop:     `1px solid ${tokens.colors.bg.border}`,
        boxShadow:     tokens.shadows.card,
        minWidth:      '160px',
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           '0.5rem',
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* Barre de couleur latérale (indicateur de niveau) */}
      <div style={{
        position:     'absolute',
        left:         0, top: 0, bottom: 0,
        width:        '3px',
        background:   `linear-gradient(180deg, ${couleurNiveau} 0%, transparent 100%)`,
        borderRadius: '4px 0 0 4px',
        opacity:      niveau > 0 ? 0.8 : 0.25,
      }} />

      {/* Label */}
      <p style={{
        color:         tokens.colors.text.secondary,
        fontSize:      '0.7rem',
        fontFamily:    tokens.fonts.ui,
        fontWeight:    600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        margin:        0,
      }}>
        {label}
      </p>

      {/* Valeur principale */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <span
          className="pf-kpi-value"
          style={{
            fontSize:   '2.2rem',
            lineHeight: 1,
            color:      valeur !== null ? tokens.colors.text.data : tokens.colors.text.muted,
            textShadow: valeur !== null ? `0 0 20px ${tokens.colors.accent.glowText}` : 'none',
          }}
        >
          {valeur !== null ? valeur : '—'}
        </span>
        {valeur !== null && (
          <span style={{ color: tokens.colors.text.muted, fontSize: '0.85rem', fontFamily: tokens.fonts.data }}>
            {unite}
          </span>
        )}
      </div>

      {/* Référence PAA + delta */}
      {reference && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: tokens.colors.text.muted, fontSize: '0.75rem' }}>
            réf. {reference}{unite}
          </span>
          {hasTendance && (
            <span style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          '2px',
              padding:      '1px 7px',
              borderRadius: tokens.radius.full,
              fontSize:     '0.72rem',
              fontFamily:   tokens.fonts.data,
              fontWeight:   700,
              background:   isPositif
                              ? 'rgba(255,51,102,0.12)'
                              : isNegatif
                              ? 'rgba(0,229,160,0.12)'
                              : 'rgba(255,255,255,0.06)',
              color:        isPositif
                              ? tokens.colors.traffic.blocked
                              : isNegatif
                              ? tokens.colors.traffic.fluid
                              : tokens.colors.text.muted,
            }}>
              {isPositif ? '▲' : isNegatif ? '▼' : '●'}{' '}
              {isPositif ? `+${tendance}` : tendance}
            </span>
          )}
        </div>
      )}

      {/* Badge niveau */}
      {niveau > 0 && (
        <div style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          '5px',
          padding:      '3px 9px',
          borderRadius: tokens.radius.full,
          background:   couleurNiveau + '18',
          border:       `1px solid ${couleurNiveau}50`,
          fontSize:     '0.7rem',
          color:        couleurNiveau,
          fontWeight:   700,
          fontFamily:   tokens.fonts.ui,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          width:        'fit-content',
          marginTop:    '2px',
        }}>
          <span style={{
            width: '5px', height: '5px',
            borderRadius: '50%',
            background: couleurNiveau,
            display: 'inline-block',
            boxShadow: `0 0 6px ${couleurNiveau}`,
          }} />
          {getTrafficLabel(niveau)}
        </div>
      )}
    </div>
  )
}

export default KPICard
