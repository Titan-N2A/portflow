const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY ?? 'zReyA5uWwhZ7fdKNlnoYi5tfi6v3GKLC'

// Routes PAA par défaut (fallback si Firestore indisponible)
const CARENA    = { lat: 5.330980, lng: -4.029706 }
const PALM      = { lat: 5.258715, lng: -3.982088 }
const CFAO      = { lat: 5.296002, lng: -4.005151 }
const SODECI_PT = { lat: 5.313880, lng: -4.010854 }

export const DEFAULT_ROUTES = [
  { id: 'axe1', shortNom: 'CARENA',      from: CARENA,    to: PALM, dist: 12.4, tRef: 27.4, bidirectionnel: true  },
  { id: 'axe2', shortNom: 'Toyota CFAO', from: CFAO,      to: PALM, dist:  7.0, tRef: 16.9, bidirectionnel: false },
  { id: 'axe3', shortNom: 'SODECI',      from: SODECI_PT, to: PALM, dist: 10.9, tRef: 17.8, bidirectionnel: false },
]

function computeNiveau(ratio) {
  if (!ratio) return 0
  if (ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}

// Route simple A→B (temps + géométrie)
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
  const points   = route?.legs?.flatMap(l => l.points) ?? []
  const geometry = points.length > 1 ? points.map(p => [p.latitude, p.longitude]) : null
  return { tempsMin: Math.round(secs / 60 * 10) / 10, geometry }
}

// Route multi-stops à travers tous les waypoints → géométrie complète longeant les rues
// Utilisé lors de la sauvegarde d'un axe dans l'admin
export async function computeRouteGeometry(coordsArray) {
  // Accepte [[lat,lng],...] ou [{lat,lng},...]
  const pts = coordsArray
    .map(p => Array.isArray(p) ? p : [p.lat, p.lng])
    .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng))

  if (pts.length < 2) return null

  const stops = pts.map(([lat, lng]) => `${lat},${lng}`).join(':')
  const url   = `https://api.tomtom.com/routing/1/calculateRoute/${stops}/json` +
    `?key=${TOMTOM_KEY}&traffic=false&travelMode=car`

  const res  = await fetch(url)
  if (!res.ok) throw new Error(`TomTom geometry ${res.status}`)
  const data  = await res.json()
  const route = data?.routes?.[0]
  if (!route) throw new Error('No route')

  // Fusionne tous les legs en une seule liste de points
  const allPts = route.legs?.flatMap(l => l.points) ?? []
  return allPts.map(p => [p.latitude, p.longitude])
}

function simulateAxe(axe) {
  const hour   = new Date().getHours()
  const isRush = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)
  const base   = axe.tRef ?? 20
  const factor = isRush ? 1.2 + Math.random() * 0.3 : 1.0 + Math.random() * 0.15
  const tempsLive = Math.round(base * factor * 10) / 10
  const ratio     = tempsLive / base
  const dist      = axe.dist ?? 10
  return {
    tempsLive,
    niveau:    computeNiveau(ratio),
    vitesse:   Math.round((dist / tempsLive) * 60 * 10) / 10,
    retard:    Math.round((tempsLive - base) * 10) / 10,
    ratio,
    simulated: true,
    geometry:  null,
  }
}

// Convertit un axe Firestore (avec coordinates[]) en route TomTom
function firestoreAxeToRoute(axe) {
  const coords = axe.coordinates
  if (!coords || coords.length < 2) return null
  const first = coords[0]
  const last  = coords[coords.length - 1]
  const distRaw = typeof axe.dist === 'number' ? axe.dist : parseFloat(axe.distance ?? '10')
  return {
    id:             axe.id,
    shortNom:       axe.shortNom ?? axe.nom ?? axe.id,
    from:           { lat: first[0], lng: first[1] },
    to:             { lat: last[0],  lng: last[1]  },
    dist:           isNaN(distRaw) ? 10 : distRaw,
    tRef:           axe.tRef ?? 20,
    bidirectionnel: axe.bidirectionnel ?? false,
  }
}

// axes : liste depuis Firestore. Si null/vide, utilise les routes PAA par défaut.
export async function fetchAllAxes(axes) {
  const routes = (axes && axes.length > 0)
    ? axes.map(firestoreAxeToRoute).filter(Boolean)
    : DEFAULT_ROUTES

  const results = {}
  await Promise.all(routes.map(async axe => {
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
      // Retour pour les axes bidirectionnels
      if (axe.bidirectionnel) {
        try {
          const ret = await fetchAxeRoute({ from: axe.to, to: axe.from })
          results[axe.id].tempsRetour    = ret.tempsMin
          results[axe.id].geometryRetour = ret.geometry
        } catch { /* retour optionnel */ }
      }
    } catch {
      results[axe.id] = simulateAxe(axe)
    }
  }))
  return results
}
