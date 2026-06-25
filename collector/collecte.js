// ============================================================
// collecte.js — Collecte automatique TomTom → Firestore
// Exécuté par GitHub Actions (cron), indépendamment de tout
// navigateur. Met à jour le live ET archive un historique.
// ============================================================

const admin = require('firebase-admin')

// ── Initialisation Firebase Admin (clé de service) ──────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

// ── Routes surveillées (identiques à src/services/tomtom.js) ──
const ROUTES = [
  { id: 'axe1_aller',  axeId: 'axe1', sens: 'aller',  nom: 'CARENA → Palm Beach',      from: { lat: 5.2470, lng: -3.9720 }, to: { lat: 5.2420, lng: -3.9580 }, dist: 14.8 },
  { id: 'axe1_retour', axeId: 'axe1', sens: 'retour', nom: 'Palm Beach → CARENA',      from: { lat: 5.2420, lng: -3.9580 }, to: { lat: 5.2470, lng: -3.9720 }, dist: 14.8 },
  { id: 'axe2_aller',  axeId: 'axe2', sens: 'aller',  nom: 'Toyota CFAO → Palm Beach', from: { lat: 5.2810, lng: -4.0140 }, to: { lat: 5.2420, lng: -3.9580 }, dist: 9.6  },
  { id: 'axe3_aller',  axeId: 'axe3', sens: 'aller',  nom: 'SODECI → Palm Beach',      from: { lat: 5.2710, lng: -4.0030 }, to: { lat: 5.2420, lng: -3.9580 }, dist: 8.4  },
]

// Références globales (copie simplifiée — cohérent avec indicators.js)
const REFERENCES = { axe1_aller: 27.4, axe1_retour: 36.3, axe2_aller: 16.9, axe3_aller: 17.8 }

function computeNiveau(ratio) {
  if (!ratio) return 0
  if (ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}

const TOMTOM_KEY = process.env.TOMTOM_API_KEY
const GOOGLE_KEY = process.env.GOOGLE_MATRIX_API_KEY

// ── Google Distance Matrix : 1 appel pour toutes les routes ──
async function fetchAllRoutesMatrix(routes) {
  const origins      = routes.map(r => `${r.from.lat},${r.from.lng}`).join('|')
  const destinations = routes.map(r => `${r.to.lat},${r.to.lng}`).join('|')
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json`
    + `?origins=${encodeURIComponent(origins)}`
    + `&destinations=${encodeURIComponent(destinations)}`
    + `&mode=driving&departure_time=now&traffic_model=best_guess`
    + `&key=${GOOGLE_KEY}`

  const res  = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK') throw new Error(`Matrix API : ${data.status} — ${data.error_message ?? ''}`)

  return routes.map((route, i) => {
    const el = data.rows[i]?.elements[i]
    if (!el || el.status !== 'OK') throw new Error(`Pas de résultat pour ${route.nom} (${el?.status})`)
    // duration_in_traffic disponible avec departure_time=now
    const seconds = el.duration_in_traffic?.value ?? el.duration.value
    return Math.round(seconds / 60)
  })
}

// ── TomTom : fallback route par route ────────────────────────
async function fetchRouteTomTom(route) {
  const { from, to } = route
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lng}:${to.lat},${to.lng}/json?key=${TOMTOM_KEY}&traffic=true&travelMode=car`
  const res  = await fetch(url)
  const data = await res.json()
  if (!data.routes?.length) throw new Error(`Pas de route pour ${route.nom}`)
  return Math.round(data.routes[0].summary.travelTimeInSeconds / 60)
}

async function main() {
  const now = new Date()
  console.log(`🚀 Collecte automatique — ${now.toISOString()}`)

  // ── Tentative Google Matrix (1 seul appel) ────────────────
  let tempsParRoute = {}
  let sourceGlobale = 'tomtom_auto'

  if (GOOGLE_KEY) {
    try {
      const resultats = await fetchAllRoutesMatrix(ROUTES)
      ROUTES.forEach((r, i) => { tempsParRoute[r.id] = resultats[i] })
      sourceGlobale = 'google_matrix'
      console.log('📡 Source : Google Distance Matrix (1 appel pour toutes les routes)')
    } catch (err) {
      console.warn(`⚠ Google Matrix échoué (${err.message}) → fallback TomTom route par route`)
    }
  }

  // ── Traitement route par route ────────────────────────────
  for (const route of ROUTES) {
    try {
      let temps_min = tempsParRoute[route.id]
      let source    = sourceGlobale

      // Fallback TomTom si Google n'a pas fourni ce résultat
      if (!temps_min && TOMTOM_KEY) {
        temps_min = await fetchRouteTomTom(route)
        source    = 'tomtom_auto'
        console.log(`   ↳ ${route.nom} : fallback TomTom`)
      }

      if (!temps_min) throw new Error('Aucune source de données disponible')

      const ref    = REFERENCES[`${route.axeId}_${route.sens}`]
      const ratio  = ref ? temps_min / ref : null
      const niveau = computeNiveau(ratio)

      const indicateurs = {
        I1: temps_min,
        I2: ref ?? null,
        I3: ref ? Math.round((temps_min - ref) * 10) / 10 : null,
        I4: ref ? Math.round((temps_min / ref) * 100) / 100 : null,
        I5: Math.round((route.dist / temps_min) * 60 * 10) / 10,
        I7: niveau,
      }

      await db.collection('mesures_live').doc(route.id).set({
        axeId: route.axeId, sens: route.sens, nom: route.nom,
        temps_min, dist_km: route.dist, heure: now.getHours(),
        ...indicateurs,
        source, updatedAt: now.toISOString(),
      }, { merge: true })

      await db.collection('collecte_auto').add({
        axeId: route.axeId, sens: route.sens, nom: route.nom,
        temps_min, dist_km: route.dist, heure: now.getHours(),
        date: now.toISOString().slice(0, 10),
        jour_semaine: now.getDay(),
        ...indicateurs,
        timestamp: now.toISOString(),
        source,
      })

      console.log(`✅ ${route.nom} : ${temps_min} min (niveau ${niveau}) [${source}]`)
    } catch (err) {
      console.error(`❌ Erreur ${route.nom} :`, err.message)
    }
  }

  console.log('🏁 Collecte terminée')
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Erreur fatale :', err)
  process.exit(1)
})