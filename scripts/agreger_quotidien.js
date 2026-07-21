// ============================================================
// agreger_quotidien.js — Agrégats quotidiens par axe/sens
// Compacte chaque journée de collecte_auto (~1 728 relevés) en
// 6 documents agregats_quotidiens/{date}_{axeId}_{sens} :
// { date, axeId, sens, n, min, moy, max, niveaux: {1..5} }.
//
// Permet à la page Graphiques d'afficher 7 ou 30 jours pour
// ~180 lectures Firestore au lieu de dizaines de milliers.
// Exécuté chaque nuit (2h) + rattrapage automatique : les jours
// manquants des 30 derniers jours sont comblés au fil des runs
// (max 6 jours par exécution pour protéger le quota de lecture).
// ============================================================

import { connexionBot, toField, fromField } from './notifs.js'

const PROJECT_ID   = 'portflow-46738'
const FIREBASE_KEY = process.env.FIREBASE_API_KEY
const FS  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const FSQ = `${FS}:runQuery`

const PROFONDEUR_JOURS   = 30
const MAX_JOURS_PAR_RUN  = 6

async function jourDejaAgrege(date) {
  const res = await fetch(`${FS}/agregats_quotidiens/${date}_axe1_aller?key=${FIREBASE_KEY}`)
  return res.ok
}

async function lireJour(date) {
  const res = await fetch(`${FSQ}?key=${FIREBASE_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'collecte_auto' }],
        where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: date } } },
        limit: 2500,
      },
    }),
  })
  if (!res.ok) throw new Error(`collecte_auto ${date} : ${res.status}`)
  const lignes = await res.json()
  return lignes.filter(l => l.document).map(l => {
    const r = {}
    for (const [k, v] of Object.entries(l.document.fields ?? {})) r[k] = fromField(v)
    return r
  }).filter(r => r.axeId && r.sens && r.temps_min > 0)
}

async function ecrireAgregat(token, docId, agregat) {
  const body = { fields: Object.fromEntries(Object.entries(agregat).map(([k, v]) => [k, toField(v)])) }
  const res = await fetch(`${FS}/agregats_quotidiens/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Écriture ${docId} : ${res.status} ${await res.text()}`)
}

async function main() {
  if (!FIREBASE_KEY || !process.env.FLOWPORT_BOT_EMAIL || !process.env.FLOWPORT_BOT_PASSWORD) {
    console.error('❌ Secrets FIREBASE_API_KEY / FLOWPORT_BOT_* requis.')
    process.exit(1)
  }

  // Jours candidats : de J-1 (hier) à J-30, les plus récents d'abord
  const candidats = []
  for (let i = 1; i <= PROFONDEUR_JOURS; i++) {
    candidats.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10))
  }

  const token = await connexionBot()
  let traites = 0
  let quotaEpuise = false

  // Un 429 (quota Firestore gratuit épuisé) n'est PAS un échec : on agrège ce
  // qu'on peut avec le quota disponible, on s'arrête proprement, et le
  // rattrapage automatique termine les jours restants au prochain run.
  const estQuota = (err) => /\b429\b/.test(err.message) || /RESOURCE_EXHAUSTED/i.test(err.message)

  for (const date of candidats) {
    if (traites >= MAX_JOURS_PAR_RUN) break
    try {
      if (await jourDejaAgrege(date)) continue

      const releves = await lireJour(date)
      if (releves.length === 0) { console.log(`· ${date} : aucun relevé`); continue }

      const groupes = new Map()
      releves.forEach(r => {
        const cle = `${r.axeId}_${r.sens}`
        if (!groupes.has(cle)) groupes.set(cle, [])
        groupes.get(cle).push(r)
      })

      for (const [cle, rs] of groupes) {
        const temps = rs.map(r => r.temps_min)
        const niveaux = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        rs.forEach(r => { const n = r.niveau ?? 1; niveaux[Math.min(5, Math.max(1, n))]++ })
        const [axeId, sens] = cle.split('_')
        await ecrireAgregat(token, `${date}_${cle}`, {
          date, axeId, sens,
          n:   rs.length,
          min: Math.round(Math.min(...temps) * 10) / 10,
          moy: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 10) / 10,
          max: Math.round(Math.max(...temps) * 10) / 10,
          niveaux,
          majLe: new Date().toISOString(),
        })
      }
      console.log(`✓ ${date} : ${releves.length} relevés → ${groupes.size} agrégats`)
      traites++
    } catch (err) {
      if (estQuota(err)) {
        console.warn(`⏳ Quota Firestore épuisé (429) — arrêt propre après ${traites} jour(s) agrégé(s). Le reste sera rattrapé au prochain run (planifié après le reset ~07h UTC).`)
        quotaEpuise = true
        break
      }
      throw err   // vraie erreur (auth, réseau…) → échec légitime
    }
  }

  if (quotaEpuise) console.log(`✅ ${traites} journée(s) agrégée(s) avant épuisement du quota — rattrapage au prochain run.`)
  else console.log(traites === 0 ? '✅ Rien à agréger — tout est à jour.' : `✅ ${traites} journée(s) agrégée(s).`)
}

main().catch(err => { console.error('Erreur :', err); process.exit(1) })
