// ============================================================
// indicators.js — Calcul des 15 indicateurs PAA
// Jour 4 : I1, I3, I4, I5, I7 (par route, données temps réel)
// Jour 5 : I8 (provisoire niveau axe), I9, I10 (vue globale)
// ============================================================

import { getReference } from '../data/references'

// ── Indicateurs par route (axe + sens) ──────────────────────

/**
 * Calcule I1, I3, I4, I5, I7 pour une mesure live
 */
export function computeIndicators(mesure) {
  const { axeId, sens, temps_min, dist_km, heure } = mesure
  if (!temps_min) return null

  const I1 = temps_min                                  // Temps live
  const I2 = getReference(axeId, sens, heure)            // Référence horaire
  const I3 = I2 ? Math.round((I1 - I2) * 10) / 10 : null // Retard
  const I4 = I2 ? Math.round((I1 / I2) * 100) / 100 : null // Ratio dégradation
  const I5 = Math.round((dist_km / I1) * 60 * 10) / 10    // Vitesse estimée
  const I7 = computeNiveau(I4)                            // Niveau congestion

  return { I1, I2, I3, I4, I5, I7 }
}

/**
 * Convertit le ratio de dégradation (I4) en niveau de congestion (1-5)
 */
export function computeNiveau(ratio) {
  if (!ratio) return 0
  if (ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}

// ── Indicateurs globaux (vue d'ensemble des 3 axes) ─────────

/**
 * Calcule I8 (provisoire), I9, I10 à partir de l'ensemble des mesures live.
 * @param {Object} mesures — objet { routeId: { I1, I3, I7, axeId, nom, dist_km, ... } }
 * @returns {Object} { I8, I9, I10 }
 */
export function computeGlobalIndicators(mesures) {
  const routes = Object.values(mesures).filter(m => m && m.I7 !== undefined)
  if (routes.length === 0) return { I8: null, I9: null, I10: null }

  // ── I9 — Congestion globale (moyenne des niveaux pondérée par distance) ──
  const poidsTotal = routes.reduce((sum, r) => sum + (r.dist_km || 1), 0)
  const sommePonderee = routes.reduce((sum, r) => sum + r.I7 * (r.dist_km || 1), 0)
  const I9 = Math.round((sommePonderee / poidsTotal) * 10) / 10

  // ── Regroupement par axe (niveau max parmi les sens de chaque axe) ──
  const niveauParAxe = {}
  routes.forEach(r => {
    if (!niveauParAxe[r.axeId] || r.I7 > niveauParAxe[r.axeId]) {
      niveauParAxe[r.axeId] = r.I7
    }
  })
  const axesIds = Object.keys(niveauParAxe)

  // ── I10 — Taux d'axes congestionnés (niveau ≥ 4) ──────────
  const axesCongestionnes = axesIds.filter(id => niveauParAxe[id] >= 4).length
  const I10 = Math.round((axesCongestionnes / axesIds.length) * 100)

  // ── I8 — Tronçon critique (PROVISOIRE niveau axe) ─────────
  // ⚠️ Sera remplacé par un vrai sous-segment (legs API) en Sprint B (24 juin)
  const pire = routes.reduce((max, r) => (r.I7 > (max?.I7 ?? -1) ? r : max), null)
  const I8 = pire ? {
    nom:       pire.nom,
    niveau:    pire.I7,
    retard:    pire.I3,
    provisoire: true, // flag pour affichage UI ("POC niveau axe")
  } : null

  return { I8, I9, I10 }
}