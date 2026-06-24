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
    <div
      className="pf-card"
      style={{
        background:    tokens.colors.bg.surface,
        borderRadius:  tokens.radius.md,
        padding:       tokens.spacing.card,
        border:        `1px solid ${tokens.colors.bg.border}`,
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* Accent top line — orange pour alertes */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, transparent, ${tokens.colors.accent.secondary}, transparent)`,
        opacity: alertes.length > 0 ? 1 : 0.35,
      }} />

      {/* Header */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1rem' }}>🔮</span>
          <div>
            <h3 style={{
              color:         tokens.colors.text.primary,
              margin:        0,
              fontSize:      '0.9rem',
              fontFamily:    tokens.fonts.ui,
              fontWeight:    600,
            }}>
              Alertes prédictives
            </h3>
            <p style={{
              color:      tokens.colors.text.muted,
              fontSize:   '0.68rem',
              fontFamily: tokens.fonts.data,
              margin:     '2px 0 0',
              letterSpacing: '0.06em',
            }}>
              {jourLabel.toUpperCase()}
            </p>
          </div>
        </div>

        {meta && (
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '6px',
            padding:      '4px 10px',
            background:   tokens.colors.bg.elevated,
            borderRadius: tokens.radius.full,
            border:       `1px solid ${tokens.colors.bg.border}`,
          }}>
            <div style={{
              width: '6px', height: '6px',
              background: tokens.colors.accent.primary,
              borderRadius: '50%',
              boxShadow: `0 0 6px ${tokens.colors.accent.primary}`,
            }} />
            <span style={{
              color:      tokens.colors.text.secondary,
              fontSize:   '0.68rem',
              fontFamily: tokens.fonts.data,
              fontWeight: 700,
            }}>
              {Math.round(meta.accuracy * 100)}% précision
            </span>
          </div>
        )}
      </div>

      {/* Contenu */}
      {alertes.length === 0 ? (
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '10px',
          padding:      '0.75rem 1rem',
          background:   'rgba(0,229,160,0.06)',
          borderRadius: tokens.radius.sm,
          border:       '1px solid rgba(0,229,160,0.18)',
        }}>
          <span style={{ fontSize: '1.1rem' }}>✓</span>
          <span style={{ color: tokens.colors.traffic.fluid, fontSize: '0.82rem', fontWeight: 600 }}>
            Aucune congestion notable prévue aujourd'hui.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {alertes.map(({ axe, sens, episodes }) =>
            episodes.map((ep, i) => {
              const couleur = getTrafficColor(ep.niveauMax)
              return (
                <div
                  key={`${axe.id}-${sens}-${i}`}
                  style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'center',
                    background:     tokens.colors.bg.elevated,
                    borderLeft:     `3px solid ${couleur}`,
                    borderRadius:   tokens.radius.sm,
                    padding:        '0.65rem 0.9rem',
                    gap:            '8px',
                    flexWrap:       'wrap',
                  }}
                >
                  <div>
                    <div style={{
                      color:      tokens.colors.text.primary,
                      fontWeight: 600,
                      fontSize:   '0.82rem',
                      fontFamily: tokens.fonts.ui,
                    }}>
                      {axe.nom.split(' — ')[0]}
                      <span style={{
                        color:      tokens.colors.text.muted,
                        fontWeight: 400,
                        marginLeft: '6px',
                        fontSize:   '0.75rem',
                      }}>
                        ({sens})
                      </span>
                    </div>
                    <div style={{
                      color:      tokens.colors.text.secondary,
                      fontSize:   '0.75rem',
                      fontFamily: tokens.fonts.data,
                      marginTop:  '2px',
                    }}>
                      {ep.heureDebut}h – {ep.heureFin + 1}h
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      padding:      '3px 10px',
                      borderRadius: tokens.radius.full,
                      background:   couleur + '18',
                      border:       `1px solid ${couleur}40`,
                      color:        couleur,
                      fontSize:     '0.7rem',
                      fontWeight:   700,
                      fontFamily:   tokens.fonts.ui,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {getTrafficLabel(ep.niveauMax)}
                    </span>
                    <span style={{
                      color:      tokens.colors.text.muted,
                      fontSize:   '0.7rem',
                      fontFamily: tokens.fonts.data,
                    }}>
                      {ep.confianceMoyenne}%
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      <p style={{
        color:      tokens.colors.text.muted,
        fontSize:   '0.65rem',
        fontFamily: tokens.fonts.data,
        marginTop:  '0.75rem',
        letterSpacing: '0.04em',
      }}>
        POC · prévisions RF basées sur l'historique PAA — février 2025
      </p>
    </div>
  )
}

export default AlertesPredictives
