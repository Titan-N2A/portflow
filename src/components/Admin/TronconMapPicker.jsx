// ============================================================
// TronconMapPicker.jsx — Sélecteur de coordonnées sur carte
// 1er clic = point de départ, 2e clic = point d'arrivée.
// Les marqueurs sont déplaçables (glisser-déposer) pour ajuster.
// ============================================================

import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet'
import { PAA_CENTER } from '../../data/axes'
import { tokens } from '../../styles/tokens'

// Composant invisible qui capture les clics sur la carte
function ClickCapture({ onPick }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function TronconMapPicker({ value, onChange }) {
  const points = value || []

  // Ajoute un point, ou recommence si déjà 2 points (départ + arrivée)
  function handlePick(point) {
    if (points.length < 2) {
      onChange([...points, point])
    } else {
      onChange([point])
    }
  }

  // Met à jour un point après glisser-déposer du marqueur
  function handleDrag(index, latlng) {
    const updated = [...points]
    updated[index] = { lat: latlng.lat, lng: latlng.lng }
    onChange(updated)
  }

  return (
    <div>
      <p style={{ color: tokens.colors.text.muted, fontSize: '0.78rem', marginBottom: '0.4rem' }}>
        Cliquez : 1er point = départ, 2e point = arrivée. Glissez les marqueurs pour ajuster.
      </p>
      <div style={{
        height: '260px', borderRadius: tokens.radius.md, overflow: 'hidden',
        border: `1px solid ${tokens.colors.bg.border}`,
      }}>
        <MapContainer center={PAA_CENTER} zoom={13} style={{ width: '100%', height: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <ClickCapture onPick={handlePick} />

          {points.map((p, i) => (
            <Marker
              key={i}
              position={[p.lat, p.lng]}
              draggable
              eventHandlers={{ dragend: (e) => handleDrag(i, e.target.getLatLng()) }}
            />
          ))}

          {points.length === 2 && (
            <Polyline
              positions={points.map(p => [p.lat, p.lng])}
              color={tokens.colors.accent.primary}
              weight={4}
            />
          )}
        </MapContainer>
      </div>

      {points.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          style={{
            marginTop: '0.4rem', background: 'transparent', border: 'none',
            color: tokens.colors.traffic.blocked, fontSize: '0.78rem', cursor: 'pointer',
          }}
        >
          ↺ Réinitialiser les points
        </button>
      )}
    </div>
  )
}

export default TronconMapPicker