// ============================================================
// eta.test.js — Tests du service ETA
// calculerETA (mapping + classification d'erreurs) et
// createETATracker (règle de recalcul : >200 m OU >2 min).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculerETA, createETATracker, ETA_ERRORS } from './eta'
import { fetchETA } from './tomtom'

vi.mock('./tomtom', () => ({
  fetchETA: vi.fn(),
}))

const POS  = { lat: 5.30, lng: -4.01 }
const DEST = { lat: 5.2586, lng: -3.9820 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('calculerETA', () => {
  it('convertit la réponse TomTom en format UI (minutes, km, arrivée)', async () => {
    vi.setSystemTime(new Date('2026-07-04T10:00:00Z'))
    fetchETA.mockResolvedValue({ dureeSec: 600, distanceM: 5540, niveau: 2, geometry: [[5.3, -4.0]] })

    const r = await calculerETA(POS, DEST)
    expect(r.dureeMinutes).toBe(10)
    expect(r.distanceKm).toBe(5.5)
    expect(r.niveauTrafic).toBe(2)
    expect(r.geometry).toEqual([[5.3, -4.0]])
    expect(r.erreur).toBeNull()
    expect(r.arriveeEstimee.toISOString()).toBe('2026-07-04T10:10:00.000Z')
    vi.useRealTimers()
  })

  it('classe les erreurs : timeout, quota, pas d’itinéraire, inconnu', async () => {
    const abort = new Error('aborted'); abort.name = 'AbortError'
    const cases = [
      [abort,                                ETA_ERRORS.TIMEOUT],
      [new Error('quota TomTom dépassé'),    ETA_ERRORS.QUOTA],
      [new Error('Aucun itinéraire trouvé'), ETA_ERRORS.NO_ROUTE],
      [new Error('boom'),                    ETA_ERRORS.UNKNOWN],
    ]
    for (const [err, attendu] of cases) {
      fetchETA.mockRejectedValueOnce(err)
      const r = await calculerETA(POS, DEST)
      expect(r.erreur).toBe(attendu)
      expect(r.dureeMinutes).toBeNull()
    }
  })
})

describe('createETATracker — règle de recalcul', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-04T10:00:00Z'))
    fetchETA.mockResolvedValue({ dureeSec: 600, distanceM: 5000, niveau: 1, geometry: null })
  })
  afterEach(() => vi.useRealTimers())

  it('ne fait rien sans position ou destination', async () => {
    const tracker = createETATracker()
    expect(await tracker.update(null, DEST)).toBeNull()
    expect(await tracker.update(POS, null)).toBeNull()
    expect(fetchETA).not.toHaveBeenCalled()
  })

  it('réutilise le résultat si déplacement < 200 m et < 2 min écoulées', async () => {
    const tracker = createETATracker()
    const first = await tracker.update(POS, DEST)
    expect(fetchETA).toHaveBeenCalledTimes(1)

    // ~55 m plus loin (0,0005° de latitude), 1 min plus tard
    vi.advanceTimersByTime(60 * 1000)
    const second = await tracker.update({ lat: POS.lat + 0.0005, lng: POS.lng }, DEST)
    expect(fetchETA).toHaveBeenCalledTimes(1) // pas de nouvel appel
    expect(second).toBe(first)
  })

  it('recalcule si la position a bougé de plus de 200 m', async () => {
    const tracker = createETATracker()
    await tracker.update(POS, DEST)

    // ~333 m plus loin (0,003° de latitude), quelques secondes après
    vi.advanceTimersByTime(5 * 1000)
    await tracker.update({ lat: POS.lat + 0.003, lng: POS.lng }, DEST)
    expect(fetchETA).toHaveBeenCalledTimes(2)
  })

  it('recalcule après 2 minutes même sans bouger', async () => {
    const tracker = createETATracker()
    await tracker.update(POS, DEST)

    vi.advanceTimersByTime(2 * 60 * 1000 + 1)
    await tracker.update(POS, DEST)
    expect(fetchETA).toHaveBeenCalledTimes(2)
  })
})
