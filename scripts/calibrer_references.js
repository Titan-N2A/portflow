// ============================================================
// calibrer_references.js — Recalibre les références horaires
// (médianes par axe / sens / heure) depuis les relevés réels des
// 7 derniers jours de collecte_auto, et les publie dans Firestore
// (flowport_references/horaires, lecture publique).
//
// Exécuté chaque lundi 4h par GitHub Actions (+ déclenchement
// manuel). La heatmap et la synthèse 24h de la page Graphiques
// utilisent ces valeurs, avec repli sur les références statiques
// de février 2025 (src/data/references.js) pour les créneaux
// encore trop peu couverts (< 10 relevés).
// ============================================================

import { connexionBot, toField } from './notifs.js'

const PROJECT_ID   = 'portflow-46738'
const FIREBASE_KEY = process.env.FIREBASE_API_KEY
const FS  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const FSQ = `${FS}:runQuery`

const MIN_RELEVES = 10   // plancher statistique par créneau

async function lireReleves(depuis) {
  const res = await fetch(`${FSQ}?key=${FIREBASE_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'collecte_auto' }],
        where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: depuis } } },
        limit: 10000,
      },
    }),
  })
  if (!res.ok) throw new Error(`collecte_auto ${res.status}: ${await res.text()}`)
  const lignes = await res.json()
  return lignes.filter(l => l.document).map(l => {
    const f = l.document.fields
    return {
      axeId:     f.axeId?.stringValue,
      sens:      f.sens?.stringValue,
      heure:     Number(f.heure?.integerValue ?? f.heure?.doubleValue ?? NaN),
      temps_min: Number(f.temps_min?.doubleValue ?? f.temps_min?.integerValue ?? NaN),
    }
  }).filter(r => r.axeId && r.sens && !Number.isNaN(r.heure) && r.temps_min > 0)
}

function mediane(valeurs) {
  const t = [...valeurs].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}

function percentile(valeurs, p) {
  const t = [...valeurs].sort((a, b) => a - b)
  return t[Math.min(t.length - 1, Math.floor((p / 100) * t.length))]
}

// Part des relevés au-dessus du seuil N3 (ratio > 1,25) pour un tRef donné
function pctN3(temps, tRef) {
  return Math.round(temps.filter(v => v / tRef > 1.25).length / temps.length * 100)
}

async function main() {
  if (!FIREBASE_KEY || !process.env.FLOWPORT_BOT_EMAIL || !process.env.FLOWPORT_BOT_PASSWORD) {
    console.error('❌ Secrets FIREBASE_API_KEY / FLOWPORT_BOT_* requis.')
    process.exit(1)
  }
  const depuis  = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
  const releves = await lireReleves(depuis)
  console.log(`${releves.length} relevés depuis ${depuis}`)

  const groupes = new Map()
  releves.forEach(r => {
    const cle = `${r.axeId}_${r.sens}_${r.heure}`
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle).push(r.temps_min)
  })

  const valeurs = {}
  let ignores = 0
  groupes.forEach((temps, cle) => {
    if (temps.length < MIN_RELEVES) { ignores++; return }
    valeurs[cle] = Math.round(mediane(temps) * 10) / 10
  })
  console.log(`${Object.keys(valeurs).length} créneaux calibrés, ${ignores} ignorés (< ${MIN_RELEVES} relevés)`)
  if (Object.keys(valeurs).length === 0) {
    console.error('❌ Aucun créneau calibrable — publication annulée.')
    process.exit(1)
  }

  // ── Recommandations tRef par axe (sens aller) ─────────────
  // P33 des temps observés : même position dans la distribution que les
  // références bien calibrées (SODECI P33, Toyota P41 — analyse 04/07).
  // L'Admin (onglet Axes) affiche ces recommandations avec un bouton
  // Appliquer ; rien n'est modifié automatiquement.
  const parAxe = new Map()
  releves.filter(r => r.sens === 'aller').forEach(r => {
    if (!parAxe.has(r.axeId)) parAxe.set(r.axeId, [])
    parAxe.get(r.axeId).push(r.temps_min)
  })
  const tRefReco = {}
  parAxe.forEach((temps, axeId) => {
    if (temps.length < 50) return   // échantillon insuffisant
    const reco = Math.round(percentile(temps, 33) * 10) / 10
    tRefReco[axeId] = {
      valeur:  reco,
      n:       temps.length,
      pctN3:   pctN3(temps, reco),          // % du temps en N3+ avec cette référence
      mediane: Math.round(mediane(temps) * 10) / 10,
    }
    console.log(`tRef recommandé ${axeId} : ${reco} min (${temps.length} relevés, ${pctN3(temps, reco)} % en N3+)`)
  })

  const token = await connexionBot()
  const doc = {
    valeurs,
    tRefReco,
    nbReleves:   releves.length,
    periodeDu:   depuis,
    periodeAu:   new Date().toISOString().slice(0, 10),
    majLe:       new Date().toISOString(),
  }
  const body = { fields: Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, toField(v)])) }
  const res = await fetch(`${FS}/flowport_references/horaires`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Écriture références ${res.status}: ${await res.text()}`)
  console.log('✅ Références horaires publiées (flowport_references/horaires)')
}

main().catch(err => { console.error('Erreur :', err); process.exit(1) })
