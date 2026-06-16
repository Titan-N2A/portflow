// ============================================================
// KPICard.jsx — Carte indicateur clé (KPI)
// Affiche un indicateur PAA avec valeur live, référence,
// tendance et niveau de congestion.
// ============================================================

import { tokens, getTrafficColor, getTrafficLabel } from '../../styles/tokens'

function KPICard({ label, valeur, unite, reference, niveau, tendance }) {
  const couleurNiveau = getTrafficColor(niveau)

  return (
    <div style={{
      background:    tokens.colors.bg.surface,
      borderRadius:  tokens.radius.md,
      padding:       tokens.spacing.card,
      borderLeft:    `4px solid ${couleurNiveau}`,
      boxShadow:     tokens.shadows.card,
      minWidth:      '160px',
      flex:          1,
    }}>

      {/* Label de l'indicateur */}
      <p style={{
        color:        tokens.colors.text.secondary,
        fontSize:     '0.78rem',
        marginBottom: '0.5rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </p>

      {/* Valeur principale */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{
          fontFamily: tokens.fonts.data,
          fontSize:   '2rem',
          color:      valeur !== null ? tokens.colors.text.data : tokens.colors.text.muted,
          lineHeight: 1,
        }}>
          {valeur !== null ? valeur : '—'}
        </span>
        <span style={{
          color:    tokens.colors.text.muted,
          fontSize: '0.85rem',
        }}>
          {unite}
        </span>
      </div>

      {/* Référence PAA + tendance */}
      {reference && (
        <p style={{
          color:     tokens.colors.text.muted,
          fontSize:  '0.78rem',
          marginTop: '0.4rem',
        }}>
          Réf. : {reference} {unite}
          {tendance !== null && (
            <span style={{
              color:      tendance > 0 ? tokens.colors.traffic.blocked
                        : tendance < 0 ? tokens.colors.traffic.fluid
                        : tokens.colors.text.muted,
              marginLeft: '6px',
              fontWeight: 'bold',
            }}>
              {tendance > 0 ? `+${tendance}` : tendance}
            </span>
          )}
        </p>
      )}

      {/* Badge niveau de congestion */}
      {niveau > 0 && (
        <div style={{
          display:      'inline-block',
          marginTop:    '0.6rem',
          padding:      '2px 8px',
          borderRadius: tokens.radius.full,
          background:   couleurNiveau + '22',
          border:       `1px solid ${couleurNiveau}`,
          fontSize:     '0.72rem',
          color:        couleurNiveau,
          fontWeight:   'bold',
        }}>
          {getTrafficLabel(niveau)}
        </div>
      )}

    </div>
  )
}

export default KPICard