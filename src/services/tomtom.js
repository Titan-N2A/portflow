const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY ?? ''

// Routes PAA par défaut (fallback si Firestore indisponible)
const CARENA    = { lat: 5.328885, lng: -4.028669 }
const PALM      = { lat: 5.258678, lng: -3.982025 }
const CFAO      = { lat: 5.295922, lng: -4.005071 }
const SODECI_PT = { lat: 5.311777, lng: -4.010880 }

export const DEFAULT_ROUTES = [
  { id: 'axe1', shortNom: 'CARENA',      from: CARENA,    to: PALM, dist: 11.9, tRef: 27.4, bidirectionnel: true  },
  { id: 'axe2', shortNom: 'Toyota CFAO', from: CFAO,      to: PALM, dist:  7.0, tRef: 16.9, bidirectionnel: true  },
  { id: 'axe3', shortNom: 'SODECI',      from: SODECI_PT, to: PALM, dist: 11.7, tRef: 22.0, bidirectionnel: true  },
]

export function computeNiveau(ratio) {
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

// ── OSRM — routage libre sans clé API (OpenStreetMap) ────────
// Utilisé comme fallback si TomTom est indisponible.
// OSRM utilise lng,lat (inverse de Leaflet) — on convertit à la sortie.
// alternatives : false | true (→3) | nombre entier (1-3, limité par OSRM)
async function fetchOSRM(waypoints, alternatives = false) {
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';')
  const n      = typeof alternatives === 'number' ? Math.min(alternatives, 3) : (alternatives ? 3 : 0)
  const url    = `https://router.project-osrm.org/route/v1/driving/${coords}` +
    `?overview=full&geometries=geojson${n > 0 ? `&alternatives=${n}` : ''}`
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`OSRM ${res.status}`)
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Aucun itinéraire disponible')
  return data.routes.map((r, i) => ({
    index:    i,
    label:    i === 0 ? 'Itinéraire principal (OSRM)' : `Alternative ${i} (OSRM)`,
    distance: Math.round(r.distance / 100) / 10,
    duration: Math.round(r.duration / 60),
    geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  }))
}

// ── TomTom alternatives — jusqu'à 5 tracés avec données trafic réel ──
// L'API TomTom Routing v1 limite maxAlternatives à 5.
async function fetchTomTomAlternatives(from, to, maxAlts) {
  const n   = Math.min(Math.max(1, maxAlts), 5)
  const url = `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${from[0]},${from[1]}:${to[0]},${to[1]}/json` +
    `?key=${TOMTOM_KEY}&traffic=true&travelMode=car&maxAlternatives=${n}`
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`TomTom ${res.status}`)
  const data = await res.json()
  if (!data.routes?.length) throw new Error('Aucun itinéraire TomTom')
  return data.routes.map((route, i) => {
    const secs    = route.summary?.travelTimeInSeconds ?? 0
    const points  = route.legs?.flatMap(l => l.points) ?? []
    const distM   = route.summary?.lengthInMeters ?? 0
    return {
      index:    i,
      label:    i === 0 ? 'Itinéraire optimal (TomTom)' : `Alternative ${i} (TomTom)`,
      distance: Math.round(distM / 100) / 10,
      duration: Math.round(secs / 60),
      geometry: points.map(p => [p.latitude, p.longitude]),
    }
  })
}

// Vérifie si un point GPS est sur une route (OSRM nearest)
// Retourne { distanceM, roadName } ou null si erreur réseau
export async function nearestRoad(lat, lng) {
  try {
    const res  = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.code !== 'Ok' || !data.waypoints?.length) return null
    return {
      distanceM: Math.round(data.waypoints[0].distance),
      roadName:  data.waypoints[0].name || null,
    }
  } catch {
    return null
  }
}

// Alternatives d'itinéraire départ→arrivée (choix du tracé dans l'admin)
// maxAlts : nombre d'alternatives souhaitées (TomTom max=5, OSRM fallback max=3)
// Stratégie : TomTom en priorité (trafic réel) → OSRM si clé absente ou erreur
export async function fetchRouteAlternatives(fromCoord, toCoord, maxAlts = 5) {
  const from = Array.isArray(fromCoord) ? fromCoord : [fromCoord.lat, fromCoord.lng]
  const to   = Array.isArray(toCoord)   ? toCoord   : [toCoord.lat,   toCoord.lng]
  if (TOMTOM_KEY) {
    try {
      return await fetchTomTomAlternatives(from, to, maxAlts)
    } catch {
      // TomTom indisponible → fallback OSRM
    }
  }
  return fetchOSRM([from, to], Math.min(maxAlts, 3))
}

// ── ETA point à point (position utilisateur → destination) ──
// computeTravelTimeFor=all : récupère noTrafficTravelTimeInSeconds dans la
// même requête, pour dériver le niveau de congestion sans appel supplémentaire.
async function fetchTomTomETA(from, to) {
  const url = `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${from.lat},${from.lng}:${to.lat},${to.lng}/json` +
    `?key=${TOMTOM_KEY}&traffic=true&travelMode=car&computeTravelTimeFor=all`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (res.status === 403 || res.status === 429) throw new Error('quota TomTom dépassé')
  if (!res.ok) throw new Error(`TomTom ${res.status}`)
  const data    = await res.json()
  const route   = data?.routes?.[0]
  const summary = route?.summary
  if (!summary?.travelTimeInSeconds) throw new Error('Aucun itinéraire disponible')
  const noTraffic = summary.noTrafficTravelTimeInSeconds ?? summary.travelTimeInSeconds
  const points    = route.legs?.flatMap(l => l.points) ?? []
  return {
    dureeSec:  summary.travelTimeInSeconds,
    distanceM: summary.lengthInMeters,
    niveau:    computeNiveau(summary.travelTimeInSeconds / noTraffic),
    geometry:  points.length > 1 ? points.map(p => [p.latitude, p.longitude]) : null,
  }
}

// Fallback sans clé TomTom ou en cas d'erreur — pas de trafic temps réel disponible
async function fetchETAOSRM(from, to) {
  const routes = await fetchOSRM([[from.lat, from.lng], [to.lat, to.lng]])
  if (!routes.length) throw new Error('Aucun itinéraire disponible')
  const r = routes[0]
  return { dureeSec: r.duration * 60, distanceM: r.distance * 1000, niveau: 0, geometry: r.geometry }
}

// ETA avec trafic réel — TomTom en priorité, OSRM en secours (niveau inconnu)
export async function fetchETA(from, to) {
  if (TOMTOM_KEY) {
    try {
      return await fetchTomTomETA(from, to)
    } catch (err) {
      if (err.message === 'quota TomTom dépassé') throw err
      // TomTom indisponible → fallback OSRM
    }
  }
  return fetchETAOSRM(from, to)
}

// Route passant par TOUS les waypoints (points intermédiaires)
// withAlternatives = true uniquement pour 2 points (OSRM ne supporte pas les alternatives multi-stops)
export async function computeMultiStopRoute(coordsArray, withAlternatives = false) {
  const pts = coordsArray
    .map(p => Array.isArray(p) ? p : [p.lat, p.lng])
    .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng))
  if (pts.length < 2) return null
  const canAlt = withAlternatives && pts.length === 2
  const routes = await fetchOSRM(pts, canAlt)
  if (!routes.length) return null
  if (canAlt) return routes  // retourne le tableau complet pour MiniMapPreview
  return { geometry: routes[0].geometry, distance: routes[0].distance, duration: routes[0].duration }
}

// Géométrie seule — utilisé à la sauvegarde d'un axe dans l'admin
export async function computeRouteGeometry(coordsArray) {
  const route = await computeMultiStopRoute(coordsArray)
  return route?.geometry ?? null
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
