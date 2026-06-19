// ============================================================
// aggregations.js — Agrégations des données historiques PAA
// Jour 7 : courbe 24h, comparatif des axes
// Jour 8 : heatmap 24×7, répartition des niveaux de congestion
// ============================================================

import { getReference }            from '../data/references'
import { computeNiveau }           from './indicators'

const NOMS_AXES = { axe1: 'CARENA', axe2: 'TOYOTA CFAO', axe3: 'SODECI' }

// ── Jour 7 — Courbe 24h ─────────────────────────────────────
export function computeCourbe24h(data, axeId, sens) {
  const heures = Array.from({ length: 12 }, (_, i) => i + 7)
  return heures.map(heure => {
    const valeurs = data
      .filter(d => d.axeId === axeId && d.sens === sens && d.heure === heure)
      .map(d => d.temps_min)
    const moyenne = valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null
    return { heure, temps_moyen: moyenne !== null ? Math.round(moyenne * 10) / 10 : null }
  })
}

// ── Jour 7 — Comparatif des 3 axes ──────────────────────────
export function computeMoyenneParAxe(data) {
  return ['axe1', 'axe2', 'axe3'].map(axeId => {
    const valeurs = data.filter(d => d.axeId === axeId && d.sens === 'aller').map(d => d.temps_min)
    const moyenne = valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : 0
    return { axeId, nom: NOMS_AXES[axeId], temps_moyen: Math.round(moyenne * 10) / 10 }
  })
}

// ── Jour 8 — Heatmap 24×7 (jour de semaine × heure) ─────────
/**
 * Calcule la grille heatmap pour un axe/sens donné.
 * Chaque cellule = niveau de congestion moyen (1-5) pour ce jour/heure.
 * @returns {Array} [{ jour: 0-6, heure: 7-18, moyenne, niveau }]
 */
export function computeHeatmap(data, axeId, sens) {
  const jours  = [0, 1, 2, 3, 4, 5, 6] // 0 = dimanche ... 6 = samedi (convention JS)
  const heures = Array.from({ length: 12 }, (_, i) => i + 7)
  const grid   = []

  jours.forEach(jour => {
    heures.forEach(heure => {
      const valeurs = data.filter(d => {
        if (d.axeId !== axeId || d.sens !== sens || d.heure !== heure) return false
        const jourDate = new Date(d.date + 'T00:00:00').getDay()
        return jourDate === jour
      }).map(d => d.temps_min)

      const moyenne = valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null
      const ref     = getReference(axeId, sens, heure)
      const ratio   = moyenne && ref ? moyenne / ref : null
      const niveau  = ratio ? computeNiveau(ratio) : 0

      grid.push({
        jour, heure,
        moyenne: moyenne !== null ? Math.round(moyenne * 10) / 10 : null,
        niveau,
      })
    })
  })

  return grid
}

// ── Jour 8 — Répartition des niveaux de congestion (donut) ──
/**
 * Classe chaque mesure historique en catégorie de congestion,
 * filtrée éventuellement par type de jour.
 * @param {Array} data
 * @param {string} filtrePeriode — 'tous' | 'ouvrable' | 'weekend'
 * @returns {Array} [{ label, count, pct }]
 */
export function computeRepartitionNiveaux(data, filtrePeriode = 'tous') {
  const filtree = data.filter(d => {
    if (filtrePeriode === 'tous') return true
    const jour      = new Date(d.date + 'T00:00:00').getDay()
    const isWeekend = jour === 0 || jour === 6
    return filtrePeriode === 'weekend' ? isWeekend : !isWeekend
  })

  const categories = { Fluide: 0, Modéré: 0, Dense: 0, Congestionné: 0 }
  let total = 0

  filtree.forEach(d => {
    const ref = getReference(d.axeId, d.sens, d.heure)
    if (!ref) return
    const niveau = computeNiveau(d.temps_min / ref)
    total++
    if (niveau <= 2) categories.Fluide++
    else if (niveau === 3) categories.Modéré++
    else if (niveau === 4) categories.Dense++
    else categories.Congestionné++
  })

  return Object.entries(categories).map(([label, count]) => ({
    label,
    count,
    pct: total ? Math.round((count / total) * 1000) / 10 : 0,
  }))
}