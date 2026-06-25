// ============================================================
// collecte.js — Collecte automatique trafic PAA
// Appelé par GitHub Actions toutes les 30 min (6h-20h, lun-ven)
// Lit les axes depuis Firestore, appelle TomTom, écrit les résultats.
// Node 20 — aucune dépendance externe (fetch natif)
// ============================================================

const TOMTOM_KEY   = process.env.TOMTOM_KEY   || 'zReyA5uWwhZ7fdKNlnoYi5tfi6v3GKLC'
const FIREBASE_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAnjGSgFXIB1cSvslFbUdiTjB6zrUmHhwc'
const PROJECT_ID   = 'portflow-46738'
const FS           = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// ── Axes PAA par défaut (fallback si Firestore vide) ─────────
const DEFAULT_AXES = [
  { id: 'axe1', shortNom: 'CARENA',      from: { lat: 5.330980, lng: -4.029706 }, to: { lat: 5.258715, lng: -3.982088 }, dist: 12.4, tRef: 27.4, bidirectionnel: true  },
  { id: 'axe2', shortNom: 'Toyota CFAO', from: { lat: 5.296002, lng: -4.005151 }, to: { lat: 5.258715, lng: -3.982088 }, dist:  7.0, tRef: 16.9, bidirectionnel: false },
  { id: 'axe3', shortNom: 'SODECI',      from: { lat: 5.313880, lng: -4.010854 }, to: { lat: 5.258715, lng: -3.982088 }, dist: 10.9, tRef: 17.8, bidirectionnel: false },
]

// ── Utilitaires Firestore REST ────────────────────────────────

// Extrait une valeur depuis un champ Firestore REST
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

// Convertit une valeur JS en champ Firestore REST
function toField(value) {
  if (typeof value === 'string')  return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (Number.isInteger(value))    return { integerValue: String(value) }
  if (typeof value === 'number')  return { doubleValue: value }
  return { stringValue: String(value) }
}

// Écrit un document (POST → ID auto-généré)
async function fsAdd(collection, fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toField(v)])) }
  const res = await fetch(`${FS}/${collection}?key=${FIREBASE_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Firestore ${collection} ${res.status}: ${await res.text()}`)
}

// ── Lecture des axes Firestore ────────────────────────────────
async function readAxes() {
  const res = await fetch(`${FS}/flowport_axes?key=${FIREBASE_KEY}`)
  if (!res.ok) return null
  const data = await res.json()
  if (!data.documents?.length) return null

  return data.documents.map(doc => {
    const f = doc.fields || {}
    const id = doc.name.split('/').pop()

    // coordinates → [{lat,lng},...] stockés en Firestore comme array de maps
    const coordsRaw = fromField(f.coordinates) ?? []
    const coords = coordsRaw.filter(p => p && typeof p === 'object' && 'lat' in p)
    if (coords.length < 2) return null

    const from = { lat: coords[0].lat,               lng: coords[0].lng }
    const to   = { lat: coords[coords.length-1].lat, lng: coords[coords.length-1].lng }
    const distRaw = fromField(f.dist) ?? fromField(f.distance) ?? 10
    const dist    = isNaN(Number(distRaw)) ? 10 : Number(distRaw)

    return {
      id,
      shortNom:       fromField(f.shortNom) ?? fromField(f.nom) ?? id,
      from, to, dist,
      tRef:           Number(fromField(f.tRef)  ?? 20),
      bidirectionnel: Boolean(fromField(f.bidirectionnel)),
    }
  }).filter(Boolean)
}

// ── Appel TomTom ──────────────────────────────────────────────
function computeNiveau(ratio) {
  if (!ratio || ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}

async function fetchTemps(from, to) {
  const url = `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${from.lat},${from.lng}:${to.lat},${to.lng}/json` +
    `?key=${TOMTOM_KEY}&traffic=true&travelMode=car`
  const res   = await fetch(url)
  if (!res.ok) throw new Error(`TomTom ${res.status}`)
  const data  = await res.json()
  const secs  = data?.routes?.[0]?.summary?.travelTimeInSeconds
  if (!secs) throw new Error('Pas de données de route')
  return Math.round(secs / 60 * 10) / 10
}

// ── Point d'entrée ────────────────────────────────────────────
async function main() {
  const now       = new Date()
  const date      = now.toISOString().split('T')[0]
  const heure     = now.getUTCHours()
  const timestamp = now.toISOString()

  console.log(`\n🚦 Collecte PAA — ${timestamp}`)

  // Chargement des axes
  let axes = DEFAULT_AXES
  try {
    const fromFirestore = await readAxes()
    if (fromFirestore?.length) {
      axes = fromFirestore
      console.log(`📍 ${axes.length} axes chargés depuis Firestore`)
    } else {
      console.log('📍 Axes par défaut utilisés (Firestore vide)')
    }
  } catch (err) {
    console.log(`⚠  Lecture Firestore impossible (${err.message}) → axes par défaut`)
  }

  let ok = 0, erreurs = 0

  for (const axe of axes) {
    for (const sens of axe.bidirectionnel ? ['aller', 'retour'] : ['aller']) {
      const from = sens === 'aller' ? axe.from : axe.to
      const to   = sens === 'aller' ? axe.to   : axe.from
      try {
        const tempsMin = await fetchTemps(from, to)
        const ratio    = tempsMin / axe.tRef
        const niveau   = computeNiveau(ratio)
        const vitesse  = Math.round((axe.dist / tempsMin) * 60 * 10) / 10
        const retard   = Math.round((tempsMin - axe.tRef) * 10) / 10

        // Historique long terme (utilisé par les graphiques)
        await fsAdd('mesures', { axeId: axe.id, sens, date, heure, temps_min: tempsMin })

        // Données récentes (utilisé par useCollecteAuto)
        await fsAdd('collecte_auto', { timestamp, axeId: axe.id, sens, date, heure, temps_min: tempsMin, niveau, vitesse, retard })

        console.log(`  ✓ ${axe.shortNom} ${sens}: ${tempsMin} min (N${niveau}, +${retard} min)`)
        ok++
      } catch (err) {
        console.error(`  ✗ ${axe.shortNom} ${sens}: ${err.message}`)
        erreurs++
      }
    }
  }

  console.log(`\n✅ Terminé — ${ok * 2} docs Firestore écrits, ${erreurs} erreurs\n`)
  if (erreurs > 0 && ok === 0) process.exit(1)
}

main().catch(err => {
  console.error('Erreur fatale:', err)
  process.exit(1)
})
