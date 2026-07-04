// ============================================================
// aggregations.test.js — Tests des agrégations historiques
// (courbe 24h, comparatif axes, heatmap, répartition donut)
// ============================================================

import { describe, it, expect } from 'vitest'
import {
  computeCourbe24h,
  computeMoyenneParAxe,
  computeHeatmap,
  computeRepartitionNiveaux,
} from './aggregations'

// Rappel calendrier : dataset PAA de février 2025.
// 2025-02-01 = samedi, 2025-02-02 = dimanche, 2025-02-03 = lundi.
const mesure = (over = {}) => ({
  axeId: 'axe1', sens: 'aller', date: '2025-02-03', heure: 8, temps_min: 28.5,
  ...over,
})

describe('computeCourbe24h', () => {
  it('renvoie 24 points, null pour les heures sans données', () => {
    const courbe = computeCourbe24h([], 'axe1', 'aller')
    expect(courbe).toHaveLength(24)
    expect(courbe.every(p => p.temps_moyen === null)).toBe(true)
  })

  it('moyenne les mesures d’une même heure, arrondie à 0,1', () => {
    const data = [
      mesure({ temps_min: 28 }),
      mesure({ temps_min: 29 }),
      mesure({ temps_min: 28.1 }),
    ]
    const h8 = computeCourbe24h(data, 'axe1', 'aller')[8]
    expect(h8.heure).toBe(8)
    expect(h8.temps_moyen).toBe(28.4) // (28+29+28.1)/3 = 28.366... → 28.4
  })

  it('filtre strictement par axe ET par sens', () => {
    const data = [
      mesure({ temps_min: 30 }),
      mesure({ temps_min: 99, sens: 'retour' }),
      mesure({ temps_min: 99, axeId: 'axe2' }),
    ]
    expect(computeCourbe24h(data, 'axe1', 'aller')[8].temps_moyen).toBe(30)
  })
})

describe('computeMoyenneParAxe', () => {
  it('renvoie les 3 axes officiels, sens aller uniquement', () => {
    const data = [
      mesure({ axeId: 'axe1', temps_min: 27 }),
      mesure({ axeId: 'axe1', temps_min: 29 }),
      mesure({ axeId: 'axe1', temps_min: 99, sens: 'retour' }), // ignorée
      mesure({ axeId: 'axe2', temps_min: 17 }),
    ]
    const rows = computeMoyenneParAxe(data)
    expect(rows.map(r => r.axeId)).toEqual(['axe1', 'axe2', 'axe3'])
    expect(rows[0].temps_moyen).toBe(28)
    expect(rows[0].nom).toBe('CARENA')
    expect(rows[1].temps_moyen).toBe(17)
    expect(rows[2].temps_moyen).toBe(0) // aucun point → 0
  })
})

describe('computeHeatmap', () => {
  it('produit une grille complète 7 jours × 24 heures', () => {
    const grid = computeHeatmap([], 'axe1', 'aller')
    expect(grid).toHaveLength(7 * 24)
    expect(grid.every(c => c.moyenne === null && c.niveau === 0)).toBe(true)
  })

  it('place la mesure dans la bonne cellule jour/heure avec le bon niveau', () => {
    // lundi 3 février 2025, 8h — référence axe1_aller_8 = 28,5
    // temps 42,75 → ratio 1,5 → N3
    const grid = computeHeatmap([mesure({ temps_min: 42.75 })], 'axe1', 'aller')
    const lundi8h = grid.find(c => c.jour === 1 && c.heure === 8)
    expect(lundi8h.moyenne).toBe(42.8)
    expect(lundi8h.niveau).toBe(3)
    // aucune autre cellule remplie
    expect(grid.filter(c => c.moyenne !== null)).toHaveLength(1)
  })
})

describe('computeRepartitionNiveaux', () => {
  it('classe en 4 catégories dans l’ordre fixe attendu par le donut', () => {
    const data = [
      mesure({ temps_min: 28.5 }),   // ratio 1,00 → N1 → Fluide
      mesure({ temps_min: 39.9 }),   // ratio 1,4  → N3 → Modéré
      mesure({ temps_min: 51.3 }),   // ratio 1,8  → N4 → Dense
      mesure({ temps_min: 85.5 }),   // ratio 3,0  → N5 → Congestionné
    ]
    const rep = computeRepartitionNiveaux(data)
    expect(rep.map(r => r.label)).toEqual(['Fluide', 'Modéré', 'Dense', 'Congestionné'])
    expect(rep.map(r => r.count)).toEqual([1, 1, 1, 1])
    expect(rep.map(r => r.pct)).toEqual([25, 25, 25, 25])
  })

  it('filtre ouvrable / weekend sur la date de la mesure', () => {
    const data = [
      mesure({ date: '2025-02-01' }), // samedi
      mesure({ date: '2025-02-02' }), // dimanche
      mesure({ date: '2025-02-03' }), // lundi
    ]
    const weekend  = computeRepartitionNiveaux(data, 'weekend')
    const ouvrable = computeRepartitionNiveaux(data, 'ouvrable')
    expect(weekend.reduce((s, r) => s + r.count, 0)).toBe(2)
    expect(ouvrable.reduce((s, r) => s + r.count, 0)).toBe(1)
  })

  it('ignore les mesures sans référence plutôt que de fausser le total', () => {
    const data = [
      mesure(),
      mesure({ axeId: 'axe_inconnu' }), // getReference → null → exclue
    ]
    const rep = computeRepartitionNiveaux(data)
    expect(rep.reduce((s, r) => s + r.count, 0)).toBe(1)
    expect(rep[0].pct).toBe(100)
  })
})
