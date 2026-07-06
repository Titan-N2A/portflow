// ============================================================
// export_collecte.mjs — Export de collecte_auto vers CSV
// Pour le réentraînement du modèle prédictif (ml/train_model.py).
// Pagination par curseur sur l'endpoint REST « list » (échantillon
// réparti sur toute la période, idéal pour l'entraînement), avec
// gestion du rate limiting (retry + pauses croissantes).
//
// Sortie : ml/collecte_auto.csv (axeId, sens, date, heure, temps_min)
// Variable d'env requise : FIREBASE_API_KEY
// ============================================================

import { writeFileSync } from 'fs'

const KEY = process.env.FIREBASE_API_KEY
if (!KEY) { console.error('❌ FIREBASE_API_KEY manquant'); process.exit(1) }

const BASE = `https://firestore.googleapis.com/v1/projects/portflow-46738/databases/(default)/documents/collecte_auto`
const MAX_PAGES = Number(process.env.MAX_PAGES ?? 60)   // 60 × 1000 = jusqu'à 60 000 docs
const attendre = ms => new Promise(r => setTimeout(r, ms))

const lignes = [['axeId', 'sens', 'date', 'heure', 'temps_min']]
let token = null, total = 0

for (let page = 0; page < MAX_PAGES; page++) {
  const url = `${BASE}?pageSize=1000&key=${KEY}` + (token ? `&pageToken=${encodeURIComponent(token)}` : '')
  let res, essai = 0
  while (true) {
    res = await fetch(url)
    if (res.status === 429 && essai < 6) { essai++; console.log(`  429 — retry ${essai} (pause ${5 * essai}s)`); await attendre(5000 * essai); continue }
    break
  }
  if (!res.ok) { console.warn(`Arrêt page ${page + 1} : HTTP ${res.status}`); break }
  const d = await res.json()
  for (const doc of d.documents ?? []) {
    const f = doc.fields, g = (k, t) => f[k]?.[t]
    const axeId = g('axeId', 'stringValue'), sens = g('sens', 'stringValue'), date = g('date', 'stringValue')
    const heure = Number(g('heure', 'integerValue') ?? g('heure', 'doubleValue') ?? NaN)
    const temps = Number(g('temps_min', 'doubleValue') ?? g('temps_min', 'integerValue') ?? NaN)
    if (axeId && sens && date && !Number.isNaN(heure) && temps > 0) {
      lignes.push([axeId, sens, date, heure, temps]); total++
    }
  }
  writeFileSync('ml/collecte_auto.csv', lignes.map(l => l.join(',')).join('\n'))
  console.log(`page ${page + 1} : cumul ${total}`)
  token = d.nextPageToken
  if (!token) { console.log('Fin — plus de pages'); break }
  await attendre(2500)
}

console.log(`\n✅ ${total} mesures exportées → ml/collecte_auto.csv`)
if (total < 500) { console.error('⚠ Volume trop faible (quota Firestore probablement épuisé) — réessayer après le reset (07h00 UTC).'); process.exit(1) }
