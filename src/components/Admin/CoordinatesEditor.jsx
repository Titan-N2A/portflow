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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {points.map((p, i) => (
        <div
          key={i}
          style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}
        >
          {/* Numéro du point */}
          <span style={{
            color:         tokens.colors.text.muted,
            fontSize:      '0.65rem',
            fontFamily:    tokens.fonts.data,
            width:         '18px',
            textAlign:     'right',
            flexShrink:    0,
          }}>
            {i + 1}
          </span>

          {/* Lat */}
          <input
            type="number"
            step="0.0001"
            value={p.lat}
            onChange={e => updatePoint(i, 'lat', e.target.value)}
            placeholder="Lat."
            className="pf-input"
            style={{ width: '110px', padding: '0.32rem 0.5rem', fontSize: '0.75rem' }}
          />

          {/* Lng */}
          <input
            type="number"
            step="0.0001"
            value={p.lng}
            onChange={e => updatePoint(i, 'lng', e.target.value)}
            placeholder="Lng."
            className="pf-input"
            style={{ width: '110px', padding: '0.32rem 0.5rem', fontSize: '0.75rem' }}
          />

          {/* Supprimer */}
          {allowAddRemove && points.length > minPoints && (
            <button
              type="button"
              onClick={() => removePoint(i)}
              title="Supprimer ce point"
              style={{
                background:   'transparent',
                border:       'none',
                color:        tokens.colors.text.muted,
                cursor:       'pointer',
                fontSize:     '0.85rem',
                padding:      '0 4px',
                lineHeight:   1,
                transition:   'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = tokens.colors.traffic.blocked}
              onMouseLeave={e => e.currentTarget.style.color = tokens.colors.text.muted}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {/* Ajouter un point */}
      {allowAddRemove && (
        <button
          type="button"
          onClick={addPoint}
          style={{
            background:   'transparent',
            border:       `1px dashed ${tokens.colors.bg.border}`,
            color:        tokens.colors.text.muted,
            borderRadius: tokens.radius.sm,
            padding:      '0.32rem 0.7rem',
            cursor:       'pointer',
            fontSize:     '0.72rem',
            fontFamily:   tokens.fonts.ui,
            marginTop:    '0.2rem',
            transition:   'all 0.15s ease',
            textAlign:    'left',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = `${tokens.colors.accent.primary}50`
            e.currentTarget.style.color = tokens.colors.accent.primary
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = tokens.colors.bg.border
            e.currentTarget.style.color = tokens.colors.text.muted
          }}
        >
          + Ajouter un point GPS
        </button>
      )}
    </div>
  )
}

export default CoordinatesEditor
