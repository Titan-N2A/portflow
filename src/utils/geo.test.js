// ============================================================
// geo.test.js — Distance haversine (seuils anti-spam et recalcul ETA)
// ============================================================

import { describe, it, expect } from 'vitest'
import { haversineDistanceM } from './geo'

describe('haversineDistanceM', () => {
  it('distance nulle pour un point identique', () => {
    expect(haversineDistanceM(5.3, -4.0, 5.3, -4.0)).toBe(0)
  })

  it('1° de latitude ≈ 111,2 km', () => {
    expect(haversineDistanceM(0, 0, 1, 0)).toBeCloseTo(111195, -3)
  })

  it('ordre de grandeur PAA : CARENA → Palm Beach ≈ 9,3 km à vol d’oiseau', () => {
    const d = haversineDistanceM(5.328885, -4.028669, 5.258678, -3.982025)
    expect(d).toBeGreaterThan(8500)
    expect(d).toBeLessThan(10500)
  })

  it('symétrique : d(A,B) = d(B,A)', () => {
    const ab = haversineDistanceM(5.3, -4.0, 5.26, -3.98)
    const ba = haversineDistanceM(5.26, -3.98, 5.3, -4.0)
    expect(ab).toBeCloseTo(ba, 6)
  })
})
