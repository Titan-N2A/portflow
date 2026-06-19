// ============================================================
// AxeMapPicker.jsx — Sélecteur multi-points pour le tracé d'un axe
// Chaque clic AJOUTE un point (à la différence du tronçon qui
// se limite à départ/arrivée). Marqueurs déplaçables.
// ============================================================

import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import { PAA_CENTER } from '../../data/axes'
import { tokens } from '../../styles/tokens'

function ClickCapture({ onAdd }) {
  useMapEvents({
    click(e) { onAdd({ lat: e.latlng.lat, lng: e.latlng.lng }) },
  })
  return null
}

function AxeMapPicker({ points, onChange }) {
  function handleAdd(point) {
    onChange([...points, point])
  }

  function handleDrag(index, latlng) {
    const updated = [...points]
    updated[index] = { lat: latlng.lat, lng: latlng.lng }
    onChange(updated)
  }

  function removeLast() {
    if (points.length <= 2) return
    onChange(points.slice(0, -1))
  }

  return (
    <div>
      <p style={{ color: tokens.colors.text.muted, fontSize: '0.78rem', marginBottom: '0.4rem' }}>
        Cliquez pour ajouter un point au tracé. Glissez les marqueurs pour ajuster.
      </p>
      <div style={{
        height: '280px', borderRadius: tokens.radius.md, overflow: 'hidden',
        border: `1px solid ${tokens.colors.bg.border}`,
      }}>
        <MapContainer center={PAA_CENTER} zoom={13} style={{ width: '100%', height: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <ClickCapture onAdd={handleAdd} />

          {points.map((p, i) => (
            <Marker
              key={i}
              position={[p.lat, p.lng]}
              draggable
              eventHandlers={{ dragend: (e) => handleDrag(i, e.target.getLatLng()) }}
            />
          ))}

          {points.length > 1 && (
            <Polyline
              positions={points.map(p => [p.lat, p.lng])}
              color={tokens.colors.accent.primary}
              weight={4}
            />
          )}
        </MapContainer>
      </div>

      <button
        type="button" onClick={removeLast}
        style={{ marginTop: '0.4rem', background: 'transparent', border: 'none', color: tokens.colors.traffic.blocked, fontSize: '0.78rem', cursor: 'pointer' }}
      >
        ↺ Supprimer le dernier point
      </button>
    </div>
  )
}

export default AxeMapPicker