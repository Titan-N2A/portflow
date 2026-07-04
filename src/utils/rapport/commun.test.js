// ============================================================
// commun.test.js — Modèle de données partagé des rapports
// ============================================================

import { describe, it, expect } from 'vitest'
import { construireModele, fmt, fmtRetard, nomCompletAxe, SOUS_TITRE } from './commun'

function faireRapport({ type = 'journalier', records = [], nbMesuresTotal = records.length } = {}) {
  return {
    nom: 'PAA-Journalier-2026-07-03',
    type,
    periode: '2026-07-03',
    periodeLabel: '03/07/2026',
    date: new Date('2026-07-04T10:00:00'),
    nbMesuresTotal,
    records,
    rows: [
      { axeId: 'axe1', axe: 'CARENA', nomComplet: 'CARENA – Pharmacie Palm Beach', tRef: 27.4, tMin: 24, tMoyen: 29.5, tMax: 41, retard: 2.1, niveau: 2, vitesse: 25.2, nbMesures: records.length, source: records.length ? 'historique' : 'live' },
      { axeId: 'axe2', axe: 'Toyota CFAO', nomComplet: 'Toyota CFAO – Pharmacie Palm Beach', tRef: 16.9, tMin: 14, tMoyen: 17.2, tMax: 22, retard: 0.3, niveau: 1, vitesse: 24.4, nbMesures: records.length, source: records.length ? 'historique' : 'live' },
    ],
  }
}

const relevés = [
  { axeId: 'axe1', sens: 'aller', date: '2026-07-03', heure: 7,  temps_min: 24 },
  { axeId: 'axe1', sens: 'aller', date: '2026-07-03', heure: 7,  temps_min: 26 },
  { axeId: 'axe1', sens: 'aller', date: '2026-07-03', heure: 12, temps_min: 41 },
  { axeId: 'axe1', sens: 'retour', date: '2026-07-03', heure: 12, temps_min: 55 }, // ignoré (sens retour)
  { axeId: 'axe2', sens: 'aller', date: '2026-07-03', heure: 12, temps_min: 22 },
]

describe('construireModele', () => {
  it('construit le titre officiel et le sous-titre corrigé (« traversée »)', () => {
    const m = construireModele(faireRapport())
    expect(m.titre).toBe('RAPPORT JOURNALIER N°03/07/2026')
    expect(m.sousTitre).toContain('traversée')
    expect(SOUS_TITRE).not.toMatch(/traversé /)
  })

  it('construit les séries horaires réelles (sens aller uniquement)', () => {
    const m = construireModele(faireRapport({ records: relevés }))
    const carena = m.axes[0]
    expect(carena.serie.buckets).toHaveLength(2)              // 07h et 12h
    expect(carena.serie.buckets[0]).toMatchObject({ label: '07h', min: 24, max: 26, moy: 25, n: 2 })
    expect(carena.serie.buckets[1]).toMatchObject({ label: '12h', min: 41, max: 41, n: 1 })
  })

  it('groupe par date pour un rapport non journalier', () => {
    const m = construireModele(faireRapport({ type: 'hebdomadaire', records: relevés }))
    expect(m.axes[0].serie.parJour).toBe(true)
    expect(m.axes[0].serie.buckets[0].label).toBe('03/07')
  })

  it('identifie le créneau de pointe depuis les relevés', () => {
    const m = construireModele(faireRapport({ records: relevés }))
    expect(m.stats.heurePointe.label).toBe('12h00–13h00')
  })

  it('calcule les statistiques globales sans inventer de valeurs', () => {
    const m = construireModele(faireRapport({ records: relevés }))
    expect(m.stats.pire.axe).toBe('CARENA')                    // ratio 29,5/27,4 > 17,2/16,9
    expect(m.stats.meilleur.axe).toBe('Toyota CFAO')
    expect(m.stats.nbDeg).toBe(0)
    expect(m.stats.nGlobal).toBe(1)
  })

  it('produit entre 3 et 5 recommandations', () => {
    const m = construireModele(faireRapport({ records: relevés }))
    expect(m.recommandations.length).toBeGreaterThanOrEqual(3)
    expect(m.recommandations.length).toBeLessThanOrEqual(5)
  })

  it('dégrade proprement sans historique (série absente, pas de crash)', () => {
    const m = construireModele(faireRapport())
    expect(m.axes[0].serie).toBeNull()
    expect(m.stats.heurePointe).toBeNull()
    expect(m.resumeExecutif.join(' ')).toBeTruthy()
    expect(m.axes[0].interpretations.min).toContain('temps réel')
  })

  it('cite le modèle ML uniquement quand ses métadonnées sont fournies', () => {
    const sans = construireModele(faireRapport({ records: relevés }), null)
    expect(JSON.stringify(sans.recommandations)).not.toContain('RandomForest')
    const avec = construireModele(faireRapport({ records: relevés }), { modele: 'RandomForestClassifier', accuracy: 0.7918, note: 'base réelle février 2025 (2016 mesures)' })
    expect(JSON.stringify(avec.recommandations)).toContain('RandomForestClassifier')
  })
})

describe('helpers de formatage', () => {
  it('formate en français (virgule décimale)', () => {
    expect(fmt(27.4)).toBe('27,4')
    expect(fmtRetard(2.1)).toBe('+2,1 min')
    expect(fmtRetard(-1.5)).toBe('−1,5 min')
  })
  it('remplace la flèche du nom d\'axe par un tiret', () => {
    expect(nomCompletAxe({ nom: 'CARENA → Pharmacie Palm Beach' })).toBe('CARENA – Pharmacie Palm Beach')
  })
})
