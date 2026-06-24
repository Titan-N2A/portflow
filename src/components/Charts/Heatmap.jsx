import { tokens, getTrafficColor } from '../../styles/tokens'

const JOURS_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_ORDRE  = [1, 2, 3, 4, 5, 6, 0]

function Heatmap({ data, heureDebut = 7, heureFin = 18 }) {
  const heures = Array.from({ length: 12 }, (_, i) => i + 7).filter(
    h => h >= heureDebut && h <= heureFin
  )

  function getCell(jour, heure) {
    return data.find(c => c.jour === jour && c.heure === heure)
  }

  return (
    <div
      className="pf-card"
      style={{
        background:    tokens.colors.bg.surface,
        borderRadius:  tokens.radius.md,
        padding:       tokens.spacing.card,
        border:        `1px solid ${tokens.colors.bg.border}`,
        overflowX:     'auto',
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      <p style={{
        color:         tokens.colors.text.primary,
        fontFamily:    tokens.fonts.ui,
        fontWeight:    600,
        fontSize:      '0.88rem',
        marginBottom:  '1rem',
        letterSpacing: '-0.01em',
      }}>
        Heatmap congestion — historique PAA
      </p>

      <table style={{ borderCollapse: 'separate', borderSpacing: '2px', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: '36px' }} />
            {JOURS_ORDRE.map((j, idx) => (
              <th key={j} style={{
                color:         tokens.colors.text.muted,
                fontSize:      '0.68rem',
                fontFamily:    tokens.fonts.ui,
                fontWeight:    700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding:       '2px 4px',
                textAlign:     'center',
              }}>
                {JOURS_LABELS[idx]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heures.map(heure => (
            <tr key={heure}>
              <td style={{
                color:      tokens.colors.text.muted,
                fontSize:   '0.68rem',
                fontFamily: tokens.fonts.data,
                textAlign:  'right',
                paddingRight: '8px',
                whiteSpace: 'nowrap',
              }}>
                {heure}h
              </td>
              {JOURS_ORDRE.map(jour => {
                const cell    = getCell(jour, heure)
                const hasData = cell?.niveau > 0
                const couleur = hasData ? getTrafficColor(cell.niveau) : tokens.colors.bg.elevated

                return (
                  <td key={jour} style={{ padding: '2px' }}>
                    <div
                      title={hasData ? `${cell.moyenne} min · niveau ${cell.niveau}` : 'Pas de données'}
                      style={{
                        width:        '28px',
                        height:       '22px',
                        borderRadius: '4px',
                        background:   hasData ? `${couleur}CC` : tokens.colors.bg.elevated,
                        border:       hasData ? `1px solid ${couleur}40` : `1px solid ${tokens.colors.bg.border}`,
                        boxShadow:    hasData && cell.niveau >= 4 ? `0 0 6px ${couleur}40` : 'none',
                        cursor:       'default',
                        transition:   'transform 0.15s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Légende */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: tokens.colors.text.muted, fontSize: '0.62rem', fontFamily: tokens.fonts.ui, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Niveau</span>
        {[
          { label: 'Fluide',       color: tokens.colors.traffic.fluid    },
          { label: 'Modéré',       color: tokens.colors.traffic.moderate },
          { label: 'Dense',        color: tokens.colors.traffic.dense    },
          { label: 'Congestionné', color: tokens.colors.traffic.blocked  },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '12px', height: '12px',
              borderRadius: '3px',
              background: `${item.color}CC`,
              border: `1px solid ${item.color}40`,
              boxShadow: `0 0 4px ${item.color}40`,
            }} />
            <span style={{ color: tokens.colors.text.secondary, fontSize: '0.68rem', fontFamily: tokens.fonts.ui }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Heatmap
