import { useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Popup, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { tokens, getAxeColor, getTrafficColor, getTrafficLabel } from '../../styles/tokens'
import { PAA_CENTER } from '../../data/axes'
import { useAxesLive } from '../../hooks/useAxesLive'
import { getPrediction } from '../../services/predictions'

function MapView({
  mesures = {},
  onAxeSelect = null,
  mode = 'live',
  predictionLayer = null,
  height = '100%',
}) {
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
      width:    '100%',
      height,
      overflow: 'hidden',
    }}>
      <MapContainer
        ref={mapRef}
        center={PAA_CENTER}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        {/* ── Tuile fond BLANC (CartoDB Light) ──────────────── */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          maxZoom={19}
        />
        <ZoomControl position="bottomright" />

        {axes.map(axe => {
          const mesure   = mesures[`${axe.id}_aller`]
          const prevision = (mode === 'prevision' && predictionLayer)
            ? getPrediction(predictionLayer.predictions, axe.id, 'aller', predictionLayer.jourLabel, predictionLayer.heure)
            : null

          let niveau, couleur, opacite, weight
          if (mode === 'prevision') {
            niveau  = prevision?.niveau_prevu ?? 0
            couleur = niveau > 0 ? getTrafficColor(niveau) : getAxeColor(axe.num)
            opacite = prevision ? Math.max(0.5, prevision.confiance_pct / 100) : 0.4
            weight  = 6
          } else {
            niveau  = mesure?.I7 ?? 0
            couleur = niveau > 0 ? getTrafficColor(niveau) : getAxeColor(axe.num)
            opacite = 0.95
            weight  = 7
          }

          return (
            <Polyline
              key={axe.id}
              positions={axe.coordinates}
              color={couleur}
              weight={weight}
              opacity={opacite}
              eventHandlers={{ click: () => handleAxeClick(axe) }}
            >
              <Popup>
                <div style={{ minWidth: '210px', fontFamily: "'Space Grotesk', sans-serif" }}>
                  {/* Header popup */}
                  <div style={{
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '8px',
                    marginBottom: '8px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: getAxeColor(axe.num),
                      flexShrink: 0,
                    }} />
                    <strong style={{ color: '#111', fontSize: '0.85rem' }}>{axe.nom}</strong>
                  </div>

                  {mode === 'prevision' ? (
                    prevision ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#555' }}>
                          🔮 Prévision <strong>{predictionLayer.heure}h</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#333' }}>
                          Niveau : <strong style={{ color: couleur }}>{getTrafficLabel(niveau)}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#555' }}>
                          Confiance : {prevision.confiance_pct}%
                        </div>
                        {prevision.temps_prevu_min && (
                          <div style={{ fontSize: '0.78rem', color: '#555' }}>
                            Temps prévu : <strong>{prevision.temps_prevu_min} min</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: '#888', fontSize: '0.78rem' }}>Pas de prévision pour ce créneau.</p>
                    )
                  ) : mesure ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: '#555' }}>Temps live</span>
                        <strong style={{ color: '#111' }}>{mesure.I1} min</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: '#555' }}>Référence PAA</span>
                        <span style={{ color: '#555' }}>{mesure.I2} min</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: '#555' }}>Retard</span>
                        <strong style={{ color: mesure.I3 > 0 ? '#ef4444' : '#22c55e' }}>
                          {mesure.I3 > 0 ? '+' : ''}{mesure.I3} min
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: '#555' }}>Vitesse</span>
                        <span style={{ color: '#111' }}>{mesure.I5} km/h</span>
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        <span style={{
                          background: couleur + '20',
                          color:      couleur,
                          padding:    '2px 10px',
                          borderRadius: '999px',
                          fontSize:   '0.72rem',
                          fontWeight: 700,
                          border:     `1px solid ${couleur}50`,
                        }}>
                          {getTrafficLabel(niveau)} · {niveau}/5
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: '#888', fontSize: '0.78rem' }}>Chargement des données...</p>
                  )}

                  <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#aaa', borderTop: '1px solid #f0f0f0', paddingTop: '6px' }}>
                    {axe.distance} · Cliquer pour zoomer
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
