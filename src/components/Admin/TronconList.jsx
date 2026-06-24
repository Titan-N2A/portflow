import { deleteTroncon } from '../../services/troncons'
import { tokens, getAxeColor } from '../../styles/tokens'
import { AXES_DATA } from '../../data/axes'

function TronconList({ troncons, onEdit }) {
  async function handleDelete(id, nom) {
    if (!confirm(`Supprimer "${nom}" ?`)) return
    await deleteTroncon(id)
  }

  if (troncons.length === 0) {
    return (
      <div style={{
        padding:      tokens.spacing.card,
        background:   tokens.colors.bg.surface,
        borderRadius: tokens.radius.md,
        border:       `1px solid ${tokens.colors.bg.border}`,
        textAlign:    'center',
      }}>
        <p style={{ color: tokens.colors.text.muted, fontSize: '0.82rem', fontFamily: tokens.fonts.ui }}>
          Aucun tronçon créé.
        </p>
        <p style={{ color: tokens.colors.text.muted, fontSize: '0.72rem', fontFamily: tokens.fonts.data, marginTop: '4px' }}>
          Utilisez le formulaire pour en créer un.
        </p>
      </div>
    )
  }

  // Grouper par axe
  const grouped = AXES_DATA.map(axe => ({
    axe,
    items: [...troncons]
      .filter(t => t.axeId === axe.id)
      .sort((a, b) => a.ordre - b.ordre),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {grouped.map(({ axe, items }) => {
        const axeColor = getAxeColor(axe.num)
        return (
          <div key={axe.id}>
            {/* Header groupe axe */}
            <div style={{
              display:       'flex',
              alignItems:    'center',
              gap:           '8px',
              marginBottom:  '0.4rem',
              paddingBottom: '0.4rem',
              borderBottom:  `1px solid ${tokens.colors.bg.border}`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: axeColor,
                boxShadow: `0 0 6px ${axeColor}80`,
                flexShrink: 0,
                display: 'inline-block',
              }} />
              <span style={{
                color:         axeColor,
                fontSize:      '0.68rem',
                fontFamily:    tokens.fonts.ui,
                fontWeight:    700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                {axe.nom.split(' — ')[0]}
              </span>
              <span style={{
                color:      tokens.colors.text.muted,
                fontSize:   '0.65rem',
                fontFamily: tokens.fonts.data,
              }}>
                {items.length} tronçon{items.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {items.map(t => (
                <div
                  key={t.id}
                  style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'center',
                    background:     tokens.colors.bg.elevated,
                    borderLeft:     `2px solid ${axeColor}60`,
                    borderRadius:   tokens.radius.sm,
                    padding:        '0.55rem 0.9rem',
                    transition:     'background 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = tokens.colors.bg.surface}
                  onMouseLeave={e => e.currentTarget.style.background = tokens.colors.bg.elevated}
                >
                  <div>
                    <span style={{
                      color:      tokens.colors.text.primary,
                      fontWeight: 600,
                      fontSize:   '0.82rem',
                      fontFamily: tokens.fonts.ui,
                    }}>
                      {t.nom}
                    </span>
                    <span style={{
                      color:      tokens.colors.text.muted,
                      fontSize:   '0.68rem',
                      fontFamily: tokens.fonts.data,
                      marginLeft: '8px',
                    }}>
                      #{t.ordre}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button
                      onClick={() => onEdit(t)}
                      title="Modifier"
                      style={{
                        background:   'transparent',
                        border:       `1px solid ${tokens.colors.bg.border}`,
                        color:        tokens.colors.text.secondary,
                        borderRadius: tokens.radius.sm,
                        padding:      '0.25rem 0.5rem',
                        cursor:       'pointer',
                        fontSize:     '0.72rem',
                        fontFamily:   tokens.fonts.ui,
                        transition:   'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = `${tokens.colors.accent.primary}50`
                        e.currentTarget.style.color = tokens.colors.accent.primary
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = tokens.colors.bg.border
                        e.currentTarget.style.color = tokens.colors.text.secondary
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.nom)}
                      title="Supprimer"
                      style={{
                        background:   'transparent',
                        border:       `1px solid ${tokens.colors.bg.border}`,
                        color:        tokens.colors.text.muted,
                        borderRadius: tokens.radius.sm,
                        padding:      '0.25rem 0.5rem',
                        cursor:       'pointer',
                        fontSize:     '0.72rem',
                        fontFamily:   tokens.fonts.ui,
                        transition:   'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,51,102,0.4)'
                        e.currentTarget.style.color = tokens.colors.traffic.blocked
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = tokens.colors.bg.border
                        e.currentTarget.style.color = tokens.colors.text.muted
                      }}
                    >
                      Suppr.
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TronconList
