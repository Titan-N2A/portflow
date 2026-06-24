import { getPrediction } from '../../services/predictions'
import { tokens, getTrafficColor, getTrafficLabel } from '../../styles/tokens'
import { AXES_DATA } from '../../data/axes'

function PrevisionRecap({ predictions, jourLabel, heure }) {
  if (!predictions) {
    return (
      <div style={{
        padding:      '0.65rem 1rem',
        background:   'rgba(255,51,102,0.07)',
        border:       '1px solid rgba(255,51,102,0.2)',
        borderRadius: tokens.radius.sm,
        marginBottom: tokens.spacing.gap,
      }}>
        <span style={{ color: tokens.colors.traffic.blocked, fontSize: '0.8rem', fontFamily: tokens.fonts.data }}>
          ⚠ predictions.json introuvable ou vide
        </span>
      </div>
    )
  }

  const lignes = AXES_DATA.flatMap(axe =>
    axe.sens.map(sens => {
      const pred = getPrediction(predictions, axe.id, sens, jourLabel, heure)
      return { axe, sens, pred }
    })
  )

  return (
    <div style={{
      display:      'flex',
      gap:          '0.6rem',
      flexWrap:     'wrap',
      marginBottom: tokens.spacing.gap,
    }}>
      {lignes.map(({ axe, sens, pred }) => {
        const couleur = pred ? getTrafficColor(pred.niveau_prevu) : tokens.colors.text.muted
        return (
          <div
            key={`${axe.id}-${sens}`}
            style={{
              background:    tokens.colors.bg.elevated,
              borderLeft:    `3px solid ${couleur}`,
              borderRadius:  tokens.radius.sm,
              padding:       '0.55rem 0.9rem',
              minWidth:      '160px',
              position:      'relative',
              overflow:      'hidden',
            }}
          >
            <div style={{
              color:      tokens.colors.text.primary,
              fontSize:   '0.78rem',
              fontWeight: 600,
              fontFamily: tokens.fonts.ui,
            }}>
              {axe.nom.split(' — ')[0]}
              <span style={{ color: tokens.colors.text.muted, fontWeight: 400, marginLeft: '5px' }}>
                ({sens})
              </span>
            </div>
            {pred ? (
              <div style={{
                fontSize:   '0.72rem',
                fontFamily: tokens.fonts.data,
                color:      couleur,
                marginTop:  '3px',
                fontWeight: 600,
              }}>
                {getTrafficLabel(pred.niveau_prevu)}
                <span style={{ color: tokens.colors.text.muted, fontWeight: 400, marginLeft: '6px' }}>
                  {pred.confiance_pct}%
                  {pred.temps_prevu_min ? ` · ${pred.temps_prevu_min} min` : ''}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', color: tokens.colors.text.muted, marginTop: '3px' }}>
                Pas de donnée
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default PrevisionRecap
