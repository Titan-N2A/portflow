// ============================================================
// indicators.test.js — Tests unitaires des indicateurs PAA
// Grille canonique N1-N5 (ratio I4) + indicateurs globaux.
// ============================================================

import { describe, it, expect } from 'vitest'
import { computeIndicators, computeNiveau, computeGlobalIndicators } from './indicators'

describe('computeNiveau — grille N1-N5 (ratio temps_live / T_ref)', () => {
  it('renvoie 0 si le ratio est absent (pas de référence)', () => {
    expect(computeNiveau(null)).toBe(0)
    expect(computeNiveau(undefined)).toBe(0)
    expect(computeNiveau(0)).toBe(0)
  })

  it('N1 Fluide : ratio ≤ 1,10 (borne incluse)', () => {
    expect(computeNiveau(0.85)).toBe(1)
    expect(computeNiveau(1.0)).toBe(1)
    expect(computeNiveau(1.10)).toBe(1)
  })

  it('N2 Bon : 1,10 < ratio ≤ 1,25', () => {
    expect(computeNiveau(1.11)).toBe(2)
    expect(computeNiveau(1.25)).toBe(2)
  })

  it('N3 Ralenti (alerte orange) : 1,25 < ratio ≤ 1,50', () => {
    expect(computeNiveau(1.26)).toBe(3)
    expect(computeNiveau(1.50)).toBe(3)
  })

  it('N4 Congestionné (alerte rouge) : 1,50 < ratio ≤ 2,00', () => {
    expect(computeNiveau(1.51)).toBe(4)
    expect(computeNiveau(2.00)).toBe(4)
  })

  it('N5 Très congestionné : ratio > 2,00', () => {
    expect(computeNiveau(2.01)).toBe(5)
    expect(computeNiveau(3.5)).toBe(5)
  })
})

describe('computeIndicators — I1..I7 pour une mesure live', () => {
  it('renvoie null sans temps de parcours', () => {
    expect(computeIndicators({ axeId: 'axe1', sens: 'aller', temps_min: 0, dist_km: 12, heure: 8 })).toBeNull()
    expect(computeIndicators({ axeId: 'axe1', sens: 'aller', dist_km: 12, heure: 8 })).toBeNull()
  })

  it('mesure exactement à la référence → retard 0, ratio 1, niveau N1', () => {
    // axe1 aller 8h : référence horaire = 28,5 min (references.js)
    const r = computeIndicators({ axeId: 'axe1', sens: 'aller', temps_min: 28.5, dist_km: 11.9, heure: 8 })
    expect(r.I1).toBe(28.5)
    expect(r.I2).toBe(28.5)
    expect(r.I3).toBe(0)
    expect(r.I4).toBe(1)
    expect(r.I7).toBe(1)
    // I5 vitesse : 11,9 km en 28,5 min → 25,1 km/h (arrondi 0,1)
    expect(r.I5).toBeCloseTo(25.1, 1)
  })

  it('mesure dégradée → retard positif et niveau cohérent', () => {
    // axe1 retour 17h (pointe soir) : référence = 42,0 min ; mesure 63 min → ratio 1,5 → N3
    const r = computeIndicators({ axeId: 'axe1', sens: 'retour', temps_min: 63, dist_km: 11.9, heure: 17 })
    expect(r.I2).toBe(42.0)
    expect(r.I3).toBe(21)
    expect(r.I4).toBe(1.5)
    expect(r.I7).toBe(3)
  })

  it('heure sans référence horaire → repli sur la moyenne globale de l’axe', () => {
    // 3h du matin : pas de courbe horaire — REFERENCES_GLOBALES axe1_aller = 27,4
    const r = computeIndicators({ axeId: 'axe1', sens: 'aller', temps_min: 27.4, dist_km: 11.9, heure: 3 })
    expect(r.I2).toBe(27.4)
    expect(r.I4).toBe(1)
  })

  it('axe2 retour (pas de courbe historique dédiée) → repli aligné sur l’aller', () => {
    const r = computeIndicators({ axeId: 'axe2', sens: 'retour', temps_min: 16.9, dist_km: 7.0, heure: 9 })
    expect(r.I2).toBe(16.9)
    expect(r.I4).toBe(1)
  })
})

describe('computeGlobalIndicators — I8/I9/I10 (vue réseau)', () => {
  it('renvoie des nulls sans mesures exploitables', () => {
    expect(computeGlobalIndicators({})).toEqual({ I8: null, I9: null, I10: null })
    expect(computeGlobalIndicators({ r1: { axeId: 'axe1' } })).toEqual({ I8: null, I9: null, I10: null })
  })

  it('I9 : moyenne des niveaux pondérée par la distance', () => {
    const mesures = {
      a: { axeId: 'axe1', nom: 'CARENA', I7: 1, I3: 0,  dist_km: 10 },
      b: { axeId: 'axe2', nom: 'CFAO',   I7: 3, I3: 10, dist_km: 5 },
    }
    // (1×10 + 3×5) / 15 = 25/15 = 1,666... → arrondi 1,7
    expect(computeGlobalIndicators(mesures).I9).toBe(1.7)
  })

  it('I10 : part des axes (pas des routes) au niveau ≥ N4', () => {
    const mesures = {
      // axe1 : aller N2, retour N4 → l’axe compte comme congestionné (max des sens)
      a1: { axeId: 'axe1', nom: 'CARENA aller',  I7: 2, I3: 3,  dist_km: 12 },
      a2: { axeId: 'axe1', nom: 'CARENA retour', I7: 4, I3: 25, dist_km: 12 },
      b:  { axeId: 'axe2', nom: 'CFAO',          I7: 1, I3: 0,  dist_km: 7 },
    }
    // 1 axe congestionné sur 2 → 50 %
    expect(computeGlobalIndicators(mesures).I10).toBe(50)
  })

  it('I8 : le tronçon critique est la route au niveau max, avec flag provisoire', () => {
    const mesures = {
      a: { axeId: 'axe1', nom: 'CARENA', I7: 2, I3: 4,  dist_km: 12 },
      b: { axeId: 'axe3', nom: 'SODECI', I7: 5, I3: 30, dist_km: 11 },
    }
    const { I8 } = computeGlobalIndicators(mesures)
    expect(I8.nom).toBe('SODECI')
    expect(I8.niveau).toBe(5)
    expect(I8.retard).toBe(30)
    expect(I8.provisoire).toBe(true)
  })
})
