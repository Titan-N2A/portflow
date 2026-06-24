const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY ?? 'zReyA5uWwhZ7fdKNlnoYi5tfi6v3GKLC'

const CARENA    = { lat: 5.330980, lng: -4.029706 }
const PALM      = { lat: 5.258715, lng: -3.982088 }
const CFAO      = { lat: 5.296002, lng: -4.005151 }
const SODECI_PT = { lat: 5.313880, lng: -4.010854 }

const AXES_ROUTES = [
  { id: 'axe1', shortNom: 'CARENA',       from: CARENA,    to: PALM,  dist: 12.4, tRef: 27.4, bidirectionnel: true  },
  { id: 'axe2', shortNom: 'Toyota CFAO',  from: CFAO,      to: PALM,  dist:  7.0, tRef: 16.9, bidirectionnel: false },
  { id: 'axe3', shortNom: 'SODECI',       from: SODECI_PT, to: PALM,  dist: 10.9, tRef: 17.8, bidirectionnel: false },
]

function computeNiveau(ratio) {
  if (!ratio) return 0
  if (ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}

async function fetchAxeRoute(axe) {
  const { from, to } = axe
  const url = `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${from.lat},${from.lng}:${to.lat},${to.lng}/json` +
    `?key=${TOMTOM_KEY}&traffic=true&travelMode=car`

  const res  = await fetch(url)
  if (!res.ok) throw new Error(`TomTom ${res.status}`)
  const data  = await res.json()
  const route = data?.routes?.[0]
  const secs  = route?.summary?.travelTimeInSeconds
  if (!secs) throw new Error('No route data')

  // Géométrie réelle de la route (tous les points de la route)
  const points = route?.legs?.[0]?.points ?? []
  const geometry = points.map(p => [p.latitude, p.longitude])

  return {
    tempsMin: Math.round(secs / 60 * 10) / 10,
    geometry: geometry.length > 1 ? geometry : null,
  }
}

// Données simulées réalistes basées sur les heures de pointe d'Abidjan
function simulateAxe(axe) {
  const hour   = new Date().getHours()
  const isRush = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)
  const base   = axe.tRef
  // Simulation réaliste : rush +20-50%, hors-rush +0-15%
  const factor = isRush
    ? 1.2 + Math.random() * 0.3
    : 1.0 + Math.random() * 0.15
  const tempsLive = Math.round(base * factor * 10) / 10
  const ratio     = tempsLive / base
  const niveau    = computeNiveau(ratio)
  return {
    tempsLive,
    niveau,
    vitesse:   Math.round((axe.dist / tempsLive) * 60 * 10) / 10,
    retard:    Math.round((tempsLive - base) * 10) / 10,
    ratio,
    simulated: true,
    geometry:  null,
  }
}

export async function fetchAllAxes() {
  const results = {}
  await Promise.all(AXES_ROUTES.map(async axe => {
    try {
      const { tempsMin, geometry } = await fetchAxeRoute(axe)
      const ratio  = tempsMin / axe.tRef
      const niveau = computeNiveau(ratio)
      results[axe.id] = {
        tempsLive: tempsMin,
        niveau,
        vitesse:  Math.round((axe.dist / tempsMin) * 60 * 10) / 10,
        retard:   Math.round((tempsMin - axe.tRef) * 10) / 10,
        ratio,
        geometry,
      }
      // Axe 1 bidirectionnel : récupérer aussi le retour
      if (axe.bidirectionnel) {
        try {
          const ret = await fetchAxeRoute({ from: axe.to, to: axe.from })
          results[axe.id].tempsRetour   = ret.tempsMin
          results[axe.id].geometryRetour = ret.geometry
        } catch { /* retour indisponible, pas bloquant */ }
      }
    } catch {
      results[axe.id] = simulateAxe(axe)
    }
  }))
  return results
}

export { AXES_ROUTES }
