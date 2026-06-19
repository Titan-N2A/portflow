// ============================================================
// MapView.jsx — Carte interactive PortFlow
// Jour 11 (révisé) : un seul mode affiché à la fois — 'live' ou
// 'prevision' — plus de superposition des deux tracés.
// ============================================================

import { useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Popup, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { tokens, getAxeColor, getTrafficColor, getTrafficLabel } from '../../styles/tokens'
import { PAA_CENTER } from '../../data/axes'
import { useAxesLive } from '../../hooks/useAxesLive'
import { getPrediction } from '../../services/predictions'

// mode: 'live' | 'prevision'
// predictionLayer = { predictions, jourLabel, heure } | null (requis si mode='prevision')
function MapView({ mesures = {}, onAxeSelect = null, mode = 'live', predictionLayer = null }) {
  const mapRef = useRef(null)
  const { axes } = useAxesLive()

  function handleAxeClick(axe) {
    if (mapRef.current) {
      const bounds = L.latLngBounds(axe.coordinates)
      mapRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 0.8 })
    }
    if (onAxeSelect) onAxeSelect(axe.id)
  }

  return (
    <div style={{
      width: '100%', height: '500px', borderRadius: tokens.radius.md,
      overflow: 'hidden', border: `1px solid ${tokens.colors.bg.border}`,
    }}>
      <MapContainer ref={mapRef} center={PAA_CENTER} zoom={14} style={{ width: '100%', height: '100%' }} zoomControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <ZoomControl position="bottomright" />

        {axes.map(axe => {
          const mesure = mesures[`${axe.id}_aller`]
          const prevision = (mode === 'prevision' && predictionLayer)
            ? getPrediction(predictionLayer.predictions, axe.id, 'aller', predictionLayer.jourLabel, predictionLayer.heure)
            : null

          // ── Détermine couleur/niveau selon le mode actif ────
          let niveau, couleur, opacite
          if (mode === 'prevision') {
            niveau   = prevision?.niveau_prevu ?? 0
            couleur  = niveau > 0 ? getTrafficColor(niveau) : getAxeColor(axe.num)
            opacite  = prevision ? Math.max(0.35, prevision.confiance_pct / 100) : 0.3
          } else {
            niveau   = mesure?.I7 ?? 0
            couleur  = niveau > 0 ? getTrafficColor(niveau) : getAxeColor(axe.num)
            opacite  = 0.9
          }

          return (
            <Polyline
              key={axe.id}
              positions={axe.coordinates}
              color={couleur}
              weight={5}
              opacity={opacite}
              eventHandlers={{ click: () => handleAxeClick(axe) }}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <strong style={{ color: getAxeColor(axe.num) }}>{axe.nom}</strong>
                  <hr style={{ margin: '6px 0', opacity: 0.3 }} />

                  {mode === 'prevision' ? (
                    prevision ? (
                      <>
                        <div>🔮 Prévision {predictionLayer.heure}h</div>
                        <div>Niveau prévu : <strong style={{ color: couleur }}>{getTrafficLabel(niveau)}</strong></div>
                        <div>Confiance : {prevision.confiance_pct}%</div>
                        {prevision.temps_prevu_min && <div>Temps prévu : {prevision.temps_prevu_min} min</div>}
                      </>
                    ) : (
                      <p style={{ color: '#888' }}>Pas de prévision pour ce créneau.</p>
                    )
                  ) : mesure ? (
                    <>
                      <div>⏱ Temps live : <strong>{mesure.I1} min</strong></div>
                      <div>📊 Référence  : {mesure.I2} min</div>
                      <div>⚠️ Retard     : <strong style={{ color: couleur }}>
                        {mesure.I3 > 0 ? `+${mesure.I3}` : mesure.I3} min
                      </strong></div>
                      <div>🚗 Vitesse    : {mesure.I5} km/h</div>
                      <div style={{ marginTop: '6px' }}>
                        <span style={{
                          background: couleur + '33', color: couleur, padding: '2px 8px',
                          borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold',
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
                    Dist. : {axe.distance}
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