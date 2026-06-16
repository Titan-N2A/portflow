// ============================================================
// MapView.jsx — Carte interactive PortFlow
// Affiche les 3 axes PAA colorés selon leur niveau de congestion.
// Fond de carte : CARTO Dark Matter (cohérent avec le thème sombre).
// ============================================================

import { MapContainer, TileLayer, Polyline, Marker, Popup, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { tokens, getAxeColor, getTrafficColor, getTrafficLabel } from '../../styles/tokens'
import { AXES_DATA, PAA_CENTER } from '../../data/axes'

// Fix icônes Leaflet — bug connu avec Vite (les images ne se chargent pas sans ça)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Niveau de congestion simulé par axe (sera remplacé par données Firebase temps réel)
const NIVEAUX_DEMO = { axe1: 4, axe2: 2, axe3: 3 }

function MapView() {
  return (
    <div style={{
      width:        '100%',
      height:       '500px',
      borderRadius: tokens.radius.md,
      overflow:     'hidden',
      border:       `1px solid ${tokens.colors.bg.border}`,
    }}>
      <MapContainer
        center={PAA_CENTER}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false} // On repositionne le zoom en bas à droite
      >

        {/* Fond de carte sombre CARTO — cohérent avec le dashboard */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />

        {/* Zoom repositionné en bas à droite */}
        <ZoomControl position="bottomright" />

        {/* Tracé des 3 axes PAA */}
        {AXES_DATA.map(axe => {
          const niveau = NIVEAUX_DEMO[axe.id]
          const couleur = getTrafficColor(niveau)

          return (
            <Polyline
              key={axe.id}
              positions={axe.coordinates}
              color={couleur}
              weight={5}
              opacity={0.9}
            >
              {/* Popup au clic sur l'axe */}
              <Popup>
                <div style={{ minWidth: '180px' }}>
                  <strong style={{ color: getAxeColor(axe.num) }}>
                    {axe.nom}
                  </strong>
                  <hr style={{ margin: '6px 0', opacity: 0.3 }} />
                  <div>Niveau : <strong style={{ color: couleur }}>
                    {getTrafficLabel(niveau)} ({niveau}/5)
                  </strong></div>
                  <div>Distance : {axe.distance}</div>
                  <div>Réf. aller : {axe.reference.aller} min</div>
                  {axe.reference.retour &&
                    <div>Réf. retour : {axe.reference.retour} min</div>
                  }
                </div>
              </Popup>
            </Polyline>
          )
        })}

        {/* Marqueur centre PAA */}
        <Marker position={PAA_CENTER}>
          <Popup>Port Autonome d'Abidjan</Popup>
        </Marker>

      </MapContainer>
    </div>
  )
}

export default MapView