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

async function fetchRoute(route) {
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

  for (const route of ROUTES) {
    try {
      const temps_min = await fetchRoute(route)
      const ref       = REFERENCES[`${route.axeId}_${route.sens}`]
      const ratio      = ref ? temps_min / ref : null
      const niveau     = computeNiveau(ratio)

      const indicateurs = {
        I1: temps_min,
        I2: ref ?? null,
        I3: ref ? Math.round((temps_min - ref) * 10) / 10 : null,
        I4: ref ? Math.round((temps_min / ref) * 100) / 100 : null,
        I5: Math.round((route.dist / temps_min) * 60 * 10) / 10,
        I7: niveau,
      }

      // ── 1. Met à jour le snapshot live (comme avant) ──────
      await db.collection('mesures_live').doc(route.id).set({
        axeId: route.axeId, sens: route.sens, nom: route.nom,
        temps_min, dist_km: route.dist, heure: now.getHours(),
        ...indicateurs,
        source: 'tomtom_auto', updatedAt: now.toISOString(),
      }, { merge: true })

      // ── 2. Archive dans l'historique (jamais écrasé) ──────
      await db.collection('collecte_auto').add({
        axeId: route.axeId, sens: route.sens, nom: route.nom,
        temps_min, dist_km: route.dist, heure: now.getHours(),
        date: now.toISOString().slice(0, 10),
        jour_semaine: now.getDay(),
        ...indicateurs,
        timestamp: now.toISOString(),
        source: 'tomtom_auto',
      })

      console.log(`✅ ${route.nom} : ${temps_min} min (niveau ${niveau})`)
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