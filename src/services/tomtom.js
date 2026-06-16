// ============================================================
// tomtom.js — Service TomTom Routing API
// Récupère le temps de traversée en temps réel pour chaque axe.
// Endpoint : calculateRoute (lat1,lng1 → lat2,lng2)
// Limite gratuite : ~2 500 req/jour → polling 10 min OK (264/jour)
// ============================================================

import { AXES_DATA } from '../data/axes'

const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY

// Points de départ et d'arrivée de chaque axe/sens
const ROUTES = [
  {
    id:    'axe1_aller',
    axeId: 'axe1',
    sens:  'aller',
    nom:   'CARENA → Palm Beach',
    from:  { lat: 5.2470, lng: -3.9720 },
    to:    { lat: 5.2420, lng: -3.9580 },
    dist:  14.8, // km — pour calcul vitesse
  },
  {
    id:    'axe1_retour',
    axeId: 'axe1',
    sens:  'retour',
    nom:   'Palm Beach → CARENA',
    from:  { lat: 5.2420, lng: -3.9580 },
    to:    { lat: 5.2470, lng: -3.9720 },
    dist:  14.8,
  },
  {
    id:    'axe2_aller',
    axeId: 'axe2',
    sens:  'aller',
    nom:   'Toyota CFAO → Palm Beach',
    from:  { lat: 5.2810, lng: -4.0140 },
    to:    { lat: 5.2420, lng: -3.9580 },
    dist:  9.6,
  },
  {
    id:    'axe3_aller',
    axeId: 'axe3',
    sens:  'aller',
    nom:   'SODECI → Palm Beach',
    from:  { lat: 5.2710, lng: -4.0030 },
    to:    { lat: 5.2420, lng: -3.9580 },
    dist:  8.4,
  },
]

/**
 * Appelle l'API TomTom pour une route donnée
 * @returns {number} temps de traversée en minutes
 */
async function fetchRoute(route) {
  const { from, to } = route
  const url = `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${from.lat},${from.lng}:${to.lat},${to.lng}/json` +
    `?key=${API_KEY}&traffic=true&travelMode=car&computeTravelTimeFor=all`

  const res  = await fetch(url)
  const data = await res.json()

  if (!data.routes || data.routes.length === 0) {
    throw new Error(`TomTom : pas de route pour ${route.nom}`)
  }

  // Temps avec trafic en secondes → minutes
  const secondes = data.routes[0].summary.travelTimeInSeconds
  return Math.round(secondes / 60)
}

/**
 * Récupère les données live pour les 4 routes (3 axes × sens)
 * @returns {Array} mesures avec temps, vitesse, horodatage
 */
export async function fetchAllRoutes() {
  const now    = new Date()
  const heure  = now.getHours()
  const results = []

  for (const route of ROUTES) {
    try {
      const temps_min = await fetchRoute(route)
      results.push({
        id:        route.id,
        axeId:     route.axeId,
        sens:      route.sens,
        nom:       route.nom,
        temps_min,
        dist_km:   route.dist,
        heure,
        timestamp: now.toISOString(),
        source:    'tomtom_live',
      })
    } catch (err) {
      console.warn(`⚠️ Erreur TomTom pour ${route.nom} :`, err.message)
      // En cas d'erreur API, on signale sans bloquer les autres routes
      results.push({
        id:        route.id,
        axeId:     route.axeId,
        sens:      route.sens,
        nom:       route.nom,
        temps_min: null,
        erreur:    err.message,
        timestamp: now.toISOString(),
        source:    'tomtom_error',
      })
    }
  }

  return results
}