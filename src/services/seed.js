// ============================================================
// seed.js — Import des données réelles PAA dans Firestore
// À exécuter UNE SEULE FOIS depuis l'interface admin.
// Charge : axes, références horaires, et mesures CSV (2 016 lignes).
// ============================================================

import Papa from 'papaparse'
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore'
import { db }                  from './firebase'
import { AXES_DATA }           from '../data/axes'
import { REFERENCES_GLOBALES } from '../data/references'

// ── 1. Import des axes ──────────────────────────────────────
export async function seedAxes() {
  console.log('🌱 Import des axes...')
  for (const axe of AXES_DATA) {
    await setDoc(doc(db, 'axes', axe.id), {
      id:       axe.id,
      num:      axe.num,
      nom:      axe.nom,
      sens:     axe.sens,
      distance: axe.distance,
      // Conversion [lat,lng] → {lat, lng} — Firestore n'accepte pas les tableaux imbriqués
      coordinates: axe.coordinates.map(([lat, lng]) => ({ lat, lng })),
      reference:   axe.reference,
      createdAt:   new Date().toISOString(),
    })
  }
  console.log('✅ Axes importés (3/3)')
}

// ── 2. Import des références horaires ───────────────────────
export async function seedReferences() {
  console.log('🌱 Import des références horaires...')
  for (const [key, data] of Object.entries(REFERENCES_GLOBALES)) {
    await setDoc(doc(db, 'references', key), {
      key,
      ...data,
      updatedAt: new Date().toISOString(),
    })
  }
  console.log('✅ Références importées')
}

// ── 3. Import des mesures CSV (2 016 lignes) ────────────────
export async function seedMesures(onProgress) {
  console.log('🌱 Lecture du CSV...')

  // Lecture du CSV depuis /public/
  const response = await fetch('/portflow_mesures_normalisees.csv')
  const csvText  = await response.text()

  // Parse CSV avec PapaParse
  const { data } = Papa.parse(csvText, {
    header:         true,
    skipEmptyLines: true,
    dynamicTyping:  true, // convertit les nombres automatiquement
  })

  console.log(`📊 ${data.length} mesures à importer...`)

  // Upload par lots de 500 (limite Firestore writeBatch)
  const BATCH_SIZE = 500
  let imported = 0

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    const chunk = data.slice(i, i + BATCH_SIZE)

    chunk.forEach(row => {
      // Normalise le nom d'axe en identifiant court
      const axeId = row.axe
        .toLowerCase()
        .replace('axe 1 - carena',      'axe1')
        .replace('axe 2 - toyota cfao', 'axe2')
        .replace('axe 3 - sodeci',      'axe3')

      // Identifiant unique de la mesure
      const id = `${axeId}_${row.sens}_${row.date}_${row.heure}h`

      batch.set(doc(db, 'mesures', id), {
        axe:        row.axe,
        axeId,
        sens:       row.sens,
        date:       row.date,
        heure:      row.heure,
        temps_min:  row.temps_min,
        source:     'base_paa_fevrier_2025',
        importedAt: new Date().toISOString(),
      })
    })

    await batch.commit()
    imported += chunk.length

    // Mise à jour de la barre de progression
    if (onProgress) onProgress(Math.round((imported / data.length) * 100))
    console.log(`📤 ${imported}/${data.length} mesures importées`)
  }

  console.log('✅ Toutes les mesures sont dans Firestore !')
}

// ── Seed complet (axes + références + mesures) ───────────────
export async function seedAll(onProgress) {
  await seedAxes()
  await seedReferences()
  await seedMesures(onProgress)
}