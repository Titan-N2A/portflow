// ============================================================
// PrevisionRecap.jsx — Récapitulatif textuel des prévisions
// Complète la carte : donne un retour visible immédiatement
// (même quand la couleur seule ne suffit pas à percevoir un
// changement, ex: niveau 1 et 2 partagent la couleur "Fluide").
// ============================================================

import { getPrediction } from '../../services/predictions'
import { tokens, getTrafficColor, getTrafficLabel } from '../../styles/tokens'
import { AXES_DATA } from '../../data/axes'

function PrevisionRecap({ predictions, jourLabel, heure }) {
  if (!predictions) {
    return (
      <p style={{ color: tokens.colors.traffic.blocked, fontSize: '0.8rem' }}>
        ⚠️ Aucune donnée de prédiction chargée (predictions.json introuvable ou vide).
      </p>
    )
  }

  const lignes = AXES_DATA.flatMap(axe =>
    axe.sens.map(sens => {
      const pred = getPrediction(predictions, axe.id, sens, jourLabel, heure)
      return { axe, sens, pred }
    })
  )

  return (
    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: tokens.spacing.gap }}>
      {lignes.map(({ axe, sens, pred }) => {
        const couleur = pred ? getTrafficColor(pred.niveau_prevu) : tokens.colors.text.muted
        return (
          <div key={`${axe.id}-${sens}`} style={{
            background: tokens.colors.bg.elevated, borderLeft: `3px solid ${couleur}`,
            borderRadius: tokens.radius.sm, padding: '0.5rem 0.8rem', minWidth: '160px',
          }}>
            <div style={{ color: tokens.colors.text.primary, fontSize: '0.78rem', fontWeight: 'bold' }}>
              {axe.nom.split(' — ')[0]} ({sens})
            </div>
            {pred ? (
              <div style={{ fontSize: '0.75rem', color: tokens.colors.text.secondary, marginTop: '2px' }}>
                {getTrafficLabel(pred.niveau_prevu)} · {pred.confiance_pct}% ·{' '}
                {pred.temps_prevu_min ? `${pred.temps_prevu_min} min` : 'n/d'}
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: tokens.colors.text.muted }}>Pas de donnée</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default PrevisionRecap