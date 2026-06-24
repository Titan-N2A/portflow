const TOMTOM_KEY = 'zReyA5uWwhZ7fdKNlnoYi5tfi6v3GKLC'

// Les 3 axes officiels PAA avec leurs points GPS
const AXES_ROUTES = [
  {
    id: 'axe1', shortNom: 'CARENA',
    from: { lat: 5.2470, lng: -3.9720 },
    to:   { lat: 5.2420, lng: -3.9580 },
    dist: 14.8, tRef: 27.4,
  },
  {
    id: 'axe2', shortNom: 'Toyota CFAO',
    from: { lat: 5.2810, lng: -4.0140 },
    to:   { lat: 5.2420, lng: -3.9580 },
    dist: 9.6, tRef: 16.9,
  },
  {
    id: 'axe3', shortNom: 'SODECI',
    from: { lat: 5.2710, lng: -4.0030 },
    to:   { lat: 5.2420, lng: -3.9580 },
    dist: 8.4, tRef: 17.8,
  },
]

function computeNiveau(ratio) {
  if (!ratio) return 0
  if (ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}

async function fetchAxeTime(axe) {
  const { from, to } = axe
  const url = `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${from.lat},${from.lng}:${to.lat},${to.lng}/json` +
    `?key=${TOMTOM_KEY}&traffic=true&travelMode=car`

  const res  = await fetch(url)
  if (!res.ok) throw new Error(`TomTom ${res.status}`)
  const data = await res.json()
  const secs = data?.routes?.[0]?.summary?.travelTimeInSeconds
  if (!secs) throw new Error('No route data')
  return Math.round(secs / 60 * 10) / 10
}

export async function fetchAllAxes() {
  const results = {}
  for (const axe of AXES_ROUTES) {
    try {
      const tempsLive = await fetchAxeTime(axe)
      const ratio     = tempsLive / axe.tRef
      const niveau    = computeNiveau(ratio)
      const vitesse   = Math.round((axe.dist / tempsLive) * 60 * 10) / 10
      results[axe.id] = {
        tempsLive, niveau, vitesse,
        retard:  Math.round((tempsLive - axe.tRef) * 10) / 10,
        ratio,
      }
    } catch {
      // Fallback : données simulées réalistes
      const base     = axe.tRef
      const factor   = 1 + Math.random() * 1.2
      const tempsLive = Math.round(base * factor * 10) / 10
      const ratio     = tempsLive / base
      const niveau    = computeNiveau(ratio)
      results[axe.id] = {
        tempsLive,
        niveau,
        vitesse: Math.round((axe.dist / tempsLive) * 60 * 10) / 10,
        retard:  Math.round((tempsLive - base) * 10) / 10,
        ratio,
        simulated: true,
      }
    }
  }
  return results
}

export { AXES_ROUTES }
