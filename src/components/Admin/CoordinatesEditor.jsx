// ============================================================
// CoordinatesEditor.jsx — Édition manuelle de coordonnées GPS
// Saisie précise lat/lng pour chaque point. Reste synchronisé
// avec le sélecteur carte (même tableau de points partagé).
// ============================================================

import { tokens } from '../../styles/tokens'

function CoordinatesEditor({ points, onChange, allowAddRemove = true, minPoints = 2 }) {
  function updatePoint(index, field, value) {
    const updated = [...points]
    updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 }
    onChange(updated)
  }

  function addPoint() {
    const last = points[points.length - 1] || { lat: 5.29, lng: -4.02 }
    onChange([...points, { lat: last.lat, lng: last.lng }])
  }

  function removePoint(index) {
    if (points.length <= minPoints) return
    onChange(points.filter((_, i) => i !== index))
  }

  return (
    <div>
      {points.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ color: tokens.colors.text.muted, fontSize: '0.75rem', width: '16px' }}>
            {i + 1}
          </span>
          <input
            type="number" step="0.0001" value={p.lat}
            onChange={(e) => updatePoint(i, 'lat', e.target.value)}
            placeholder="Latitude"
            style={coordInput}
          />
          <input
            type="number" step="0.0001" value={p.lng}
            onChange={(e) => updatePoint(i, 'lng', e.target.value)}
            placeholder="Longitude"
            style={coordInput}
          />
          {allowAddRemove && points.length > minPoints && (
            <button type="button" onClick={() => removePoint(i)} style={removeBtn} title="Supprimer ce point">
              ✕
            </button>
          )}
        </div>
      ))}

      {allowAddRemove && (
        <button type="button" onClick={addPoint} style={addBtn}>
          + Ajouter un point
        </button>
      )}
    </div>
  )
}

const coordInput = {
  width: '110px', padding: '0.4rem 0.5rem', background: '#1E293B',
  border: '1px solid #334155', borderRadius: '6px', color: '#F1F5F9', fontSize: '0.78rem',
}
const removeBtn = { background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.9rem' }
const addBtn = {
  background: 'transparent', border: '1px dashed #334155', color: '#94A3B8',
  borderRadius: '6px', padding: '0.35rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', marginTop: '0.2rem',
}

export default CoordinatesEditor