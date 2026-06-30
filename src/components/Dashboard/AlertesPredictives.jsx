import { C, levelColor, levelLabel } from '../../styles/tokens'
import { getJourLabel, getForecastJour, detectEpisodes } from '../../services/predictions'
import { AXES_DATA } from '../../data/axes'

function AlertesPredictives({ predictions, meta }) {
  const jourLabel = getJourLabel()
  const nLive     = meta?.n_records_live ?? 0

  const alertes = AXES_DATA.flatMap(axe =>
    axe.sens.map(sens => {
      const forecast = getForecastJour(predictions, axe.id, sens, jourLabel)
      const episodes = detectEpisodes(forecast, 3)
      return { axe, sens, episodes }
    })
  ).filter(a => a.episodes.length > 0)

  return (
    <div className="fp-card" style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1rem' }}>🔮</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Alertes prédictives</span>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>
            {jourLabel}
          </div>
        </div>
        {meta && (
          <div style={{
            padding: '3px 10px', borderRadius: '999px',
            background: C.bg, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.primary, boxShadow: `0 0 6px ${C.primary}` }} />
            <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace', fontWeight: 700 }}>
              {Math.round(meta.accuracy * 100)}% précision
            </span>
          </div>
        )}
      </div>

      {/* Avertissement volume insuffisant */}
      {nLive === 0 && (
        <div style={{
          padding: '0.45rem 0.7rem', borderRadius: '6px',
          background: '#FFFBEA', border: `1px solid ${C.warning}40`,
          fontSize: 11, color: C.textMuted, marginBottom: '0.65rem', lineHeight: 1.5,
        }}>
          <strong style={{ color: C.warning }}>ℹ</strong> Modèle entraîné sur l'historique PAA fév. 2025 uniquement.
          Pour intégrer les données live, exporter Firestore <code>collecte_auto</code> → <code>ml/collecte_auto.csv</code> puis relancer <code>train_model.py</code>.
        </div>
      )}

      {/* Alertes */}
      {alertes.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0.5rem 0.75rem', borderRadius: '6px',
          background: `${C.n1}10`, border: `1px solid ${C.n1}30`,
        }}>
          <span>✓</span>
          <span style={{ fontSize: 12, color: C.n1, fontWeight: 600 }}>
            Aucune congestion notable prévue aujourd'hui.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {alertes.map(({ axe, sens, episodes }) =>
            episodes.map((ep, i) => {
              const couleur = levelColor(ep.niveauMax)
              return (
                <div key={`${axe.id}-${sens}-${i}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: C.bg, borderLeft: `3px solid ${couleur}`,
                  borderRadius: '6px', padding: '0.5rem 0.75rem', gap: '8px', flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                      {axe.nom.split(' — ')[0]}
                      <span style={{ color: C.textMuted, fontWeight: 400, marginLeft: '6px', fontSize: 11 }}>
                        ({sens})
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace', marginTop: 2 }}>
                      {ep.heureDebut}h – {ep.heureFin + 1}h
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px',
                      background: `${couleur}18`, border: `1px solid ${couleur}40`,
                      color: couleur, fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {levelLabel(ep.niveauMax)}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>
                      {ep.confianceMoyenne}%
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      <p style={{ fontSize: 10, color: C.textLight, marginTop: '0.65rem', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
        RF · {meta?.n_records_total ?? 2016} mesures
        {nLive > 0 ? ` (dont ${nLive} live)` : ' · historique seul'}
      </p>
    </div>
  )
}

export default AlertesPredictives
