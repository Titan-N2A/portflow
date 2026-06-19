// ============================================================
// TronconList.jsx — Liste des tronçons existants
// Groupés visuellement par axe (couleur de la bordure gauche),
// avec actions Modifier / Supprimer.
// ============================================================

import { deleteTroncon } from '../../services/troncons'
import { tokens, getAxeColor } from '../../styles/tokens'
import { AXES_DATA } from '../../data/axes'

function TronconList({ troncons, onEdit }) {
  async function handleDelete(id, nom) {
    if (!confirm(`Supprimer le tronçon "${nom}" ?`)) return
    await deleteTroncon(id)
  }

  if (troncons.length === 0) {
    return (
      <p style={{ color: tokens.colors.text.muted, fontSize: '0.85rem' }}>
        Aucun tronçon créé pour le moment.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {[...troncons]
        .sort((a, b) => (a.axeId + a.ordre).localeCompare(b.axeId + b.ordre))
        .map(t => {
          const axe = AXES_DATA.find(a => a.id === t.axeId)
          return (
            <div key={t.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: tokens.colors.bg.elevated,
              borderLeft: `3px solid ${getAxeColor(axe?.num ?? 1)}`,
              borderRadius: tokens.radius.sm, padding: '0.6rem 0.9rem',
            }}>
              <div>
                <span style={{ color: tokens.colors.text.primary, fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {t.nom}
                </span>
                <span style={{ color: tokens.colors.text.muted, fontSize: '0.75rem', marginLeft: '8px' }}>
                  {axe?.nom.split(' — ')[0]} · ordre {t.ordre}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button onClick={() => onEdit(t)} style={iconBtn} title="Modifier">✏️</button>
                <button onClick={() => handleDelete(t.id, t.nom)} style={iconBtn} title="Supprimer">🗑️</button>
              </div>
            </div>
          )
        })}
    </div>
  )
}

const iconBtn = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }

export default TronconList