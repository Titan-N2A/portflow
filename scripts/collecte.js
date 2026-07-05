// ============================================================
// collecte.js — Collecte trafic PAA (GitHub Actions)
// Stratégie : Google Distance Matrix (1 appel) → fallback TomTom
// Écrit dans : mesures_live (dashboard) + mesures + collecte_auto
//
// SOURCE UNIQUE DE VÉRITÉ pour les mesures persistées : c'est le seul
// écrivain régulier de mesures_live/collecte_auto (invoqué par
// .github/workflows/collecte_auto.yml toutes les ~10 min). Le front
// (src/hooks/useTrafficData.js) est lecteur seul ; son bouton
// "Actualiser" ne fait qu'une prévisualisation locale, jamais persistée.
// Champ temporel canonique : "timestamp" (ISO 8601) sur tous les
// documents — ne pas réintroduire "updatedAt" (ancien schéma, source
// de bugs de fraîcheur avec l'ex-collector/collecte.js, supprimé).
// ============================================================

import { gererAlertes } from './notifs.js'

const TOMTOM_KEY   = process.env.TOMTOM_KEY
const FIREBASE_KEY = process.env.FIREBASE_API_KEY
const GOOGLE_KEY   = process.env.GOOGLE_MATRIX_API_KEY
const PROJECT_ID   = 'portflow-46738'

if (!FIREBASE_KEY) {
  console.error('❌ FIREBASE_API_KEY manquant (secret GitHub Actions non configuré) — collecte annulée.')
  process.exit(1)
}
const FS           = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const DEFAULT_AXES = [
  { id: 'axe1', shortNom: 'CARENA',        from: { lat: 5.328885, lng: -4.028669 }, to: { lat: 5.258678, lng: -3.982025 }, dist: 11.9, tRef: 27.4, bidirectionnel: true },
  { id: 'axe2', shortNom: 'Toyota CFAO',   from: { lat: 5.295922, lng: -4.005071 }, to: { lat: 5.258678, lng: -3.982025 }, dist:  7.0, tRef: 16.9, bidirectionnel: true },
  { id: 'axe3', shortNom: 'Agence SODECI', from: { lat: 5.311777, lng: -4.010880 }, to: { lat: 5.258678, lng: -3.982025 }, dist: 11.7, tRef: 22.0, bidirectionnel: true },
]

// ── Firestore REST helpers ────────────────────────────────────

function fromField(field) {
  if (!field) return null
  if ('stringValue'    in field) return field.stringValue
  if ('doubleValue'    in field) return field.doubleValue
  if ('integerValue'   in field) return Number(field.integerValue)
  if ('booleanValue'   in field) return field.booleanValue
  if ('timestampValue' in field) return field.timestampValue
  if ('arrayValue'     in field) return (field.arrayValue.values ?? []).map(fromField)
  if ('mapValue'       in field) {
    const result = {}
    for (const [k, v] of Object.entries(field.mapValue.fields ?? {})) result[k] = fromField(v)
    return result
  }
  return null
}

function toField(value) {
  if (typeof value === 'string') {
    // ISO datetime strings (contiennent 'T') → timestampValue Firestore
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return { timestampValue: value }
    return { stringValue: value }
  }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (Number.isInteger(value))    return { integerValue: String(value) }
  if (typeof value === 'number')  return { doubleValue: value }
  return { stringValue: String(value) }
}

// Crée un document avec ID auto-généré
async function fsAdd(col, fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toField(v)])) }
  const res  = await fetch(`${FS}/${col}?key=${FIREBASE_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Firestore ADD ${col} ${res.status}: ${await res.text()}`)
}

// Crée/remplace un document avec ID fixe (pour mesures_live)
async function fsSet(col, docId, fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toField(v)])) }
  const res  = await fetch(`${FS}/${col}/${docId}?key=${FIREBASE_KEY}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Firestore SET ${col}/${docId} ${res.status}: ${await res.text()}`)
}

// ── Chargement des axes depuis Firestore ─────────────────────

async function readAxes() {
  const res = await fetch(`${FS}/flowport_axes?key=${FIREBASE_KEY}`)
  if (!res.ok) return null
  const data = await res.json()
  if (!data.documents?.length) return null

  return data.documents.map(doc => {
    const f    = doc.fields || {}
    const id   = doc.name.split('/').pop()
    const coordsRaw = fromField(f.coordinates) ?? []
    const coords    = coordsRaw.filter(p => p && typeof p === 'object' && 'lat' in p)
    if (coords.length < 2) return null
    const from    = { lat: coords[0].lat, lng: coords[0].lng }
    const to      = { lat: coords[coords.length - 1].lat, lng: coords[coords.length - 1].lng }
    const distRaw = fromField(f.dist) ?? fromField(f.distance) ?? 10
    return {
      id,
      shortNom:       fromField(f.shortNom) ?? fromField(f.nom) ?? id,
      from, to,
      dist:           isNaN(Number(distRaw)) ? 10 : Number(distRaw),
      tRef:           Number(fromField(f.tRef) ?? 20),
      bidirectionnel: Boolean(fromField(f.bidirectionnel)),
    }
  }).filter(Boolean)
}

// ── Google Distance Matrix (1 appel pour toutes les routes) ──

async function fetchAllRoutesMatrix(routeList) {
  if (!GOOGLE_KEY) throw new Error('GOOGLE_MATRIX_API_KEY non défini')
  const origins      = routeList.map(r => `${r.from.lat},${r.from.lng}`).join('|')
  const destinations = routeList.map(r => `${r.to.lat},${r.to.lng}`).join('|')
  const url = 'https://maps.googleapis.com/maps/api/distancematrix/json'
    + `?origins=${encodeURIComponent(origins)}`
    + `&destinations=${encodeURIComponent(destinations)}`
    + '&mode=driving&departure_time=now&traffic_model=best_guess'
    + `&key=${GOOGLE_KEY}`
  const res  = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK') throw new Error(`Matrix API: ${data.status} — ${data.error_message ?? ''}`)
  return routeList.map((_, i) => {
    const el = data.rows[i]?.elements[i]
    if (!el || el.status !== 'OK') throw new Error(`Route ${i} sans résultat (${el?.status})`)
    const seconds = el.duration_in_traffic?.value ?? el.duration.value
    return Math.round(seconds / 60 * 10) / 10
  })
}

// ── TomTom (fallback route par route) ────────────────────────

async function fetchTomTom(from, to) {
  const url = `https://api.tomtom.com/routing/1/calculateRoute/`
    + `${from.lat},${from.lng}:${to.lat},${to.lng}/json`
    + `?key=${TOMTOM_KEY}&traffic=true&travelMode=car`
  const res  = await fetch(url)
  if (!res.ok) throw new Error(`TomTom ${res.status}`)
  const data = await res.json()
  const secs = data?.routes?.[0]?.summary?.travelTimeInSeconds
  if (!secs) throw new Error('Pas de données TomTom')
  return Math.round(secs / 60 * 10) / 10
}

function computeNiveau(ratio) {
  if (!ratio || ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}

// ── Point d'entrée ────────────────────────────────────────────

async function main() {
  const now       = new Date()
  const date      = now.toISOString().split('T')[0]
  const heure     = now.getUTCHours()
  const timestamp = now.toISOString()

  console.log(`\n🚦 Collecte PAA — ${timestamp}`)

  // Chargement des axes (Firestore ou défaut)
  let axes = DEFAULT_AXES
  try {
    const fromFirestore = await readAxes()
    if (fromFirestore?.length) {
      axes = fromFirestore
      console.log(`📍 ${axes.length} axes chargés depuis Firestore`)
    } else {
      console.log('📍 Axes par défaut utilisés')
    }
  } catch (err) {
    console.log(`⚠  Firestore inaccessible (${err.message}) → axes par défaut`)
  }

  // Construction de la liste de routes (aller + retour si bidirectionnel)
  const routeList = []
  for (const axe of axes) {
    for (const sens of (axe.bidirectionnel ? ['aller', 'retour'] : ['aller'])) {
      routeList.push({
        docId:    `${axe.id}_${sens}`,
        axeId:    axe.id,
        shortNom: axe.shortNom,
        sens,
        from: sens === 'aller' ? axe.from : axe.to,
        to:   sens === 'aller' ? axe.to   : axe.from,
        dist: axe.dist,
        tRef: axe.tRef,
      })
    }
  }

  // Tentative Google Distance Matrix (1 appel)
  const tempsMap = {}
  let sourceGlobale = 'tomtom'

  if (GOOGLE_KEY) {
    try {
      const resultats = await fetchAllRoutesMatrix(routeList)
      routeList.forEach((r, i) => { tempsMap[r.docId] = resultats[i] })
      sourceGlobale = 'google_matrix'
      console.log(`📡 Google Distance Matrix — ${routeList.length} routes en 1 appel`)
    } catch (err) {
      console.warn(`⚠  Google Matrix échoué (${err.message}) → fallback TomTom`)
    }
  }

  let ok = 0, erreurs = 0
  const resultats = []   // alimenté pour les alertes email (notifs.js)

  for (const route of routeList) {
    try {
      let tempsMin = tempsMap[route.docId]
      let source   = sourceGlobale

      if (!tempsMin) {
        tempsMin = await fetchTomTom(route.from, route.to)
        source   = 'tomtom'
      }

      const ratio   = tempsMin / route.tRef
      const niveau  = computeNiveau(ratio)
      const vitesse = Math.round((route.dist / tempsMin) * 60 * 10) / 10
      const retard  = Math.round((tempsMin - route.tRef) * 10) / 10

      // 1. Snapshot live → lu par le dashboard en temps réel
      await fsSet('mesures_live', route.docId, {
        axeId: route.axeId, sens: route.sens, nom: `${route.shortNom} (${route.sens})`,
        temps_min: tempsMin, dist_km: route.dist, heure,
        niveau, vitesse, retard, timestamp, source,
      })

      // 2. (supprimé 05/07/2026) — l'ajout dans "mesures" est coupé : cette
      // collection ne sert qu'au jeu historique figé de février 2025
      // (useHistoricalData) ; y accumuler ~1 728 docs/jour ne servait à
      // rien et a contribué à l'explosion du quota Firestore. L'historique
      // vivant est déjà archivé dans collecte_auto ci-dessous.

      // 3. Archive collecte (export, ML)
      await fsAdd('collecte_auto', {
        timestamp, axeId: route.axeId, sens: route.sens, date, heure,
        temps_min: tempsMin, niveau, vitesse, retard, source,
      })

      console.log(`  ✓ ${route.shortNom} ${route.sens} : ${tempsMin} min (N${niveau}, +${retard} min) [${source}]`)
      resultats.push({
        docId: route.docId, axeId: route.axeId, shortNom: route.shortNom,
        sens: route.sens, tempsMin, tRef: route.tRef, niveau, retard, vitesse,
      })
      ok++
    } catch (err) {
      console.error(`  ✗ ${route.shortNom} ${route.sens} : ${err.message}`)
      erreurs++
    }
  }

  // Alertes congestion par email — ne doit JAMAIS faire échouer la collecte
  try {
    await gererAlertes(resultats)
  } catch (err) {
    console.warn(`⚠ Alertes email : ${err.message}`)
  }

  console.log(`\n✅ Terminé — ${ok} routes collectées, ${erreurs} erreur(s)\n`)
  if (ok === 0) process.exit(1)
}

main().catch(err => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
