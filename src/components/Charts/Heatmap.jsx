// ============================================================
// Heatmap.jsx — Grille 24×7 (jour de semaine × heure)
// Composant maison (pas de lib externe) — chaque cellule est
// colorée selon le niveau de congestion moyen historique.
// ============================================================

import { tokens, getTrafficColor } from '../../styles/tokens'

const JOURS_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_ORDRE  = [1, 2, 3, 4, 5, 6, 0] // réordonne pour commencer par Lundi

function Heatmap({ data, heureDebut = 7, heureFin = 18 }) {
  const heures = Array.from({ length: 12 }, (_, i) => i + 7).filter(
    h => h >= heureDebut && h <= heureFin
  )

  /** Récupère la cellule correspondant à un jour/heure donnés */
  function getCell(jour, heure) {
    return data.find(c => c.jour === jour && c.heure === heure)
  }

  return (
    <div style={{
      background: tokens.colors.bg.surface, borderRadius: tokens.radius.md,
      padding: tokens.spacing.card, overflowX: 'auto',
    }}>
      <p style={{ color: tokens.colors.text.primary, fontWeight: 'bold', marginBottom: '0.8rem', fontSize: '0.95rem' }}>
        Heatmap 24×7 — niveau de congestion historique
      </p>

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: '40px' }} />
            {JOURS_ORDRE.map(j => (
              <th key={j} style={{
                color: tokens.colors.text.muted, fontSize: '0.75rem', fontWeight: 'normal', padding: '2px',
              }}>
                {JOURS_LABELS[JOURS_ORDRE.indexOf(j)]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heures.map(heure => (
            <tr key={heure}>
              <td style={{ color: tokens.colors.text.muted, fontSize: '0.75rem', textAlign: 'right', paddingRight: '6px' }}>
                {heure}h
              </td>
              {JOURS_ORDRE.map(jour => {
                const cell = getCell(jour, heure)
                const couleur = cell?.niveau > 0 ? getTrafficColor(cell.niveau) : tokens.colors.bg.elevated

                return (
                  <td key={jour} style={{ padding: '2px' }}>
                    <div
                      title={cell?.moyenne ? `${cell.moyenne} min (niveau ${cell.niveau})` : 'Pas de données'}
                      style={{
                        width: '28px', height: '20px', borderRadius: '4px',
                        background: couleur, opacity: cell?.niveau > 0 ? 0.85 : 0.3,
                        cursor: 'default',
                      }}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Heatmap