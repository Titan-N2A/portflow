import { C, levelColor, levelLabel } from '../../styles/tokens'
import { getPrediction } from '../../services/predictions'
import { AXES_DATA } from '../../data/axes'

function PrevisionRecap({ predictions, jourLabel, heure }) {
  if (!predictions) {
    return (
      <div style={{
        padding: '0.5rem 0.75rem',
        background: `${C.n5}10`, border: `1px solid ${C.n5}30`,
        borderRadius: '6px', marginBottom: '1rem',
      }}>
        <span style={{ color: C.n5, fontSize: 12, fontFamily: 'monospace' }}>
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
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
      {lignes.map(({ axe, sens, pred }) => {
        const couleur = pred ? levelColor(pred.niveau_prevu) : C.textMuted
        return (
          <div key={`${axe.id}-${sens}`} style={{
            background: C.bg,
            borderLeft: `3px solid ${couleur}`,
            borderRadius: '6px',
            padding: '0.5rem 0.75rem',
            minWidth: '160px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
              {axe.nom.split(' — ')[0]}
              <span style={{ color: C.textMuted, fontWeight: 400, marginLeft: '5px', fontSize: 11 }}>
                ({sens})
              </span>
            </div>
            {pred ? (
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: couleur, marginTop: 3, fontWeight: 600 }}>
                {levelLabel(pred.niveau_prevu)}
                <span style={{ color: C.textMuted, fontWeight: 400, marginLeft: '6px' }}>
                  {pred.confiance_pct}%
                  {pred.temps_prevu_min ? ` · ${pred.temps_prevu_min} min` : ''}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
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
