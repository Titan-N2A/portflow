// ============================================================
// AlertesPredictives.jsx — Encart d'alertes prédictives
// Détecte les épisodes de congestion prévus aujourd'hui, par
// axe, à partir du modèle Random Forest (admin uniquement).
// ============================================================

import { getJourLabel, getForecastJour, detectEpisodes } from '../../services/predictions'
import { tokens, getTrafficColor, getTrafficLabel } from '../../styles/tokens'
import { AXES_DATA } from '../../data/axes'

function AlertesPredictives({ predictions, meta }) {
  const jourLabel = getJourLabel()

  const alertes = AXES_DATA.flatMap(axe =>
    axe.sens.map(sens => {
      const forecast = getForecastJour(predictions, axe.id, sens, jourLabel)
      const episodes = detectEpisodes(forecast, 3)
      return { axe, sens, episodes }
    })
  ).filter(a => a.episodes.length > 0)

  return (
    <div style={{
      background: tokens.colors.bg.surface, borderRadius: tokens.radius.md,
      padding: tokens.spacing.card, border: `1px solid ${tokens.colors.bg.border}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.8rem' }}>
        <h3 style={{ color: tokens.colors.text.primary, margin: 0 }}>
          🔮 Alertes prédictives — aujourd'hui ({jourLabel})
        </h3>
        {meta && (
          <span style={{ color: tokens.colors.text.muted, fontSize: '0.72rem' }}>
            Modèle : {Math.round(meta.accuracy * 100)}% de précision
          </span>
        )}
      </div>

      {alertes.length === 0 ? (
        <p style={{ color: tokens.colors.traffic.fluid, fontSize: '0.85rem' }}>
          ✅ Aucune congestion notable prévue aujourd'hui sur les axes surveillés.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {alertes.map(({ axe, sens, episodes }) =>
            episodes.map((ep, i) => (
              <div key={`${axe.id}-${sens}-${i}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: tokens.colors.bg.elevated,
                borderLeft: `3px solid ${getTrafficColor(ep.niveauMax)}`,
                borderRadius: tokens.radius.sm, padding: '0.6rem 0.9rem',
              }}>
                <div>
                  <span style={{ color: tokens.colors.text.primary, fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {axe.nom.split(' — ')[0]} ({sens})
                  </span>
                  <span style={{ color: tokens.colors.text.secondary, fontSize: '0.8rem', marginLeft: '8px' }}>
                    congestion prévue {ep.heureDebut}h–{ep.heureFin + 1}h
                  </span>
                </div>
                <span style={{
                  background: getTrafficColor(ep.niveauMax) + '33', color: getTrafficColor(ep.niveauMax),
                  padding: '2px 8px', borderRadius: tokens.radius.full, fontSize: '0.75rem', fontWeight: 'bold',
                }}>
                  {getTrafficLabel(ep.niveauMax)} · {ep.confianceMoyenne}%
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <p style={{ color: tokens.colors.text.muted, fontSize: '0.72rem', marginTop: '0.8rem' }}>
        POC niveau axe — prévisions basées sur l'historique réel de février 2025.
      </p>
    </div>
  )
}

export default AlertesPredictives