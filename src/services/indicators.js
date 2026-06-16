// ============================================================
// indicators.js — Calcul des 15 indicateurs PAA
// Jour 4 : I1, I3, I4, I5, I7 (données temps réel)
// Les autres indicateurs (I2, I6, I8–I15) seront ajoutés
// au fur et à mesure des sprints.
// ============================================================

import { getReference } from '../data/references'

/**
 * Calcule les indicateurs I1, I3, I4, I5, I7 pour une mesure live
 * @param {Object} mesure — données TomTom { axeId, sens, temps_min, dist_km, heure }
 * @returns {Object} indicateurs calculés
 */
export function computeIndicators(mesure) {
  const { axeId, sens, temps_min, dist_km, heure } = mesure

  if (!temps_min) return null

  // I1 — Temps moyen de traversée (live)
  const I1 = temps_min

  // I2 — Temps de référence (médiane horaire PAA)
  const I2 = getReference(axeId, sens, heure)

  // I3 — Retard moyen (live - référence)
  const I3 = I2 ? Math.round((I1 - I2) * 10) / 10 : null

  // I4 — Ratio de dégradation (live / référence)
  const I4 = I2 ? Math.round((I1 / I2) * 100) / 100 : null

  // I5 — Vitesse estimée (km/h) = distance / temps × 60
  const I5 = Math.round((dist_km / I1) * 60 * 10) / 10

  // I7 — Niveau de congestion (1 à 5) basé sur le ratio I4
  const I7 = computeNiveau(I4)

  return { I1, I2, I3, I4, I5, I7 }
}

/**
 * Convertit le ratio de dégradation (I4) en niveau de congestion (1-5)
 * @param {number|null} ratio — I1 / I2
 * @returns {number} niveau entre 1 et 5
 */
export function computeNiveau(ratio) {
  if (!ratio) return 0
  if (ratio <= 1.10) return 1 // Fluide
  if (ratio <= 1.25) return 2 // Fluide modéré
  if (ratio <= 1.50) return 3 // Modéré
  if (ratio <= 2.00) return 4 // Dense
  return 5                    // Congestionné
}