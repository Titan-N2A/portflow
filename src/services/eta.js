// ============================================================
// eta.js — Service ETA (temps d'arrivée estimé avec trafic réel)
//
// calculerETA()      : un seul appel TomTom/OSRM, formaté pour l'UI.
// createETATracker() : enveloppe calculerETA() avec la règle de
//   recalcul « déplacement > 200m OU plus de 2 min écoulées depuis
//   le dernier calcul » — le second cas remplace la condition
//   « changement de niveau de trafic » du brief (impossible à
//   connaître sans appeler l'API), en réutilisant le même intervalle
//   de rafraîchissement que useTrafficData.js (REFRESH_MS = 2 min).
// ============================================================

import { fetchETA } from './tomtom'
import { haversineDistanceM } from '../utils/geo'

export const ETA_ERRORS = {
  TIMEOUT:  'timeout',
  QUOTA:    'quota',
  NO_ROUTE: 'no_route',
  UNKNOWN:  'unknown',
}

const DIST_THRESHOLD_M  = 200
const TIME_THRESHOLD_MS = 2 * 60 * 1000

function classifyError(err) {
  if (err?.name === 'AbortError') return ETA_ERRORS.TIMEOUT
  const msg = err?.message ?? ''
  if (msg.includes('quota'))            return ETA_ERRORS.QUOTA
  if (msg.includes('Aucun itinéraire')) return ETA_ERRORS.NO_ROUTE
  return ETA_ERRORS.UNKNOWN
}

// Un seul calcul ETA — pas de mise en cache, pas de seuil de recalcul.
export async function calculerETA(positionActuelle, destination) {
  try {
    const { dureeSec, distanceM, niveau, geometry } = await fetchETA(positionActuelle, destination)
    return {
      dureeMinutes:     Math.round(dureeSec / 60),
      arriveeEstimee:   new Date(Date.now() + dureeSec * 1000),
      distanceKm:       Math.round(distanceM / 100) / 10,
      niveauTrafic:     niveau,
      geometry:         geometry ?? null,
      erreur:           null,
    }
  } catch (err) {
    return {
      dureeMinutes:   null,
      arriveeEstimee: null,
      distanceKm:     null,
      niveauTrafic:   null,
      geometry:       null,
      erreur:         classifyError(err),
    }
  }
}

// Enveloppe stateful : ne rappelle TomTom que si la position a bougé de
// plus de 200m depuis le dernier calcul, ou si 2 minutes se sont écoulées.
export function createETATracker() {
  let lastPosition = null
  let lastResult    = null

  async function update(positionActuelle, destination) {
    if (!positionActuelle || !destination) return lastResult

    const elapsed = lastResult ? Date.now() - lastResult.calculatedAt : Infinity
    const movedM  = lastPosition
      ? haversineDistanceM(positionActuelle.lat, positionActuelle.lng, lastPosition.lat, lastPosition.lng)
      : Infinity

    if (lastResult && movedM < DIST_THRESHOLD_M && elapsed < TIME_THRESHOLD_MS) {
      return lastResult
    }

    const result = await calculerETA(positionActuelle, destination)
    lastPosition = positionActuelle
    lastResult   = { ...result, calculatedAt: Date.now() }
    return lastResult
  }

  return { update }
}
