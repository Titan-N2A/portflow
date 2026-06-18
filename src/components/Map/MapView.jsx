// ============================================================
// MapView.jsx — Carte interactive PortFlow
// Jour 5 : ajoute le zoom intelligent — un clic sur un axe
// recentre et zoome automatiquement la carte sur son tracé.
// ============================================================

import { useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Popup, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { tokens, getAxeColor, getTrafficColor, getTrafficLabel } from '../../styles/tokens'
import { AXES_DATA, PAA_CENTER } from '../../data/axes'

// Fix icônes Leaflet + Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function MapView({ mesures = {} }) {
  // Référence directe à l'instance Leaflet (fournie par react-leaflet via ref)
  const mapRef = useRef(null)

  /**
   * Zoom intelligent : recentre la carte sur le tracé complet de l'axe cliqué
   */
  function handleAxeClick(axe) {
    if (!mapRef.current) return
    const bounds = L.latLngBounds(axe.coordinates)
    mapRef.current.flyToBounds(bounds, {
      padding:  [40, 40],
      duration: 0.8, // animation fluide en secondes
    })
  }

  return (
    <div style={{
      width:        '100%',
      height:       '500px',
      borderRadius: tokens.radius.md,
      overflow:     'hidden',
      border:       `1px solid ${tokens.colors.bg.border}`,
    }}>
      <MapContainer
        ref={mapRef}
        center={PAA_CENTER}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <ZoomControl position="bottomright" />

        {AXES_DATA.map(axe => {
          const cle     = `${axe.id}_aller`
          const mesure  = mesures[cle]
          const niveau  = mesure?.I7 ?? 0
          const couleur = niveau > 0 ? getTrafficColor(niveau) : getAxeColor(axe.num)

          return (
            <Polyline
              key={axe.id}
              positions={axe.coordinates}
              color={couleur}
              weight={5}
              opacity={0.9}
              // Zoom intelligent au clic sur le tracé
              eventHandlers={{ click: () => handleAxeClick(axe) }}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <strong style={{ color: getAxeColor(axe.num) }}>{axe.nom}</strong>
                  <hr style={{ margin: '6px 0', opacity: 0.3 }} />
                  {mesure ? (
                    <>
                      <div>⏱ Temps live : <strong>{mesure.I1} min</strong></div>
                      <div>📊 Référence  : {mesure.I2} min</div>
                      <div>⚠️ Retard     : <strong style={{ color: couleur }}>
                        {mesure.I3 > 0 ? `+${mesure.I3}` : mesure.I3} min
                      </strong></div>
                      <div>🚗 Vitesse    : {mesure.I5} km/h</div>
                      <div style={{ marginTop: '6px' }}>
                        <span style={{
                          background: couleur + '33', color: couleur,
                          padding: '2px 8px', borderRadius: '999px',
                          fontSize: '0.8rem', fontWeight: 'bold',
                          border: `1px solid ${couleur}`,
                        }}>
                          {getTrafficLabel(niveau)} (niveau {niveau}/5)
                        </span>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: '#888' }}>Chargement des données live...</p>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>
                    Dist. : {axe.distance} · Réf. aller : {axe.reference.aller} min
                  </div>
                </div>
              </Popup>
            </Polyline>
          )
        })}
      </MapContainer>
    </div>
  )
}

export default MapView