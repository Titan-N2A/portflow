// ============================================================
// recap.js — Récapitulatif matinal par email (GitHub Actions,
// tous les jours à 6h30, heure d'Abidjan = UTC).
// Contenu : état live des axes, bilan de la veille (relevés
// réels collecte_auto), créneaux à risque du jour (modèle ML).
// Destinataires : config/notifications (géré dans l'Admin).
// ============================================================

import { readFileSync } from 'fs'
import {
  notificationsActives, lireDestinataires, envoyerMail,
  gabarit, badgeNiveau, fromField, CH,
} from './notifs.js'

const PROJECT_ID   = 'portflow-46738'
const FIREBASE_KEY = process.env.FIREBASE_API_KEY
const FS   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const FSQ  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`

const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const f = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR')

// ── Lectures Firestore (REST, clé API — collections publiques) ──
async function lireMesuresLive() {
  const res = await fetch(`${FS}/mesures_live?key=${FIREBASE_KEY}`)
  if (!res.ok) throw new Error(`mesures_live ${res.status}`)
  const data = await res.json()
  return (data.documents ?? []).map(d => {
    const r = {}
    for (const [k, v] of Object.entries(d.fields ?? {})) r[k] = fromField(v)
    return r
  })
}

async function lireVeille(dateVeille) {
  const res = await fetch(`${FSQ}?key=${FIREBASE_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'collecte_auto' }],
        where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: dateVeille } } },
        limit: 4000,
      },
    }),
  })
  if (!res.ok) throw new Error(`collecte_auto ${res.status}: ${await res.text()}`)
  const lignes = await res.json()
  return lignes.filter(l => l.document).map(l => {
    const r = {}
    for (const [k, v] of Object.entries(l.document.fields ?? {})) r[k] = fromField(v)
    return r
  })
}

// ── Construction du contenu ───────────────────────────────────
function tableHtml(entetes, lignes) {
  const th = entetes.map((e, i) =>
    `<th style="background:${CH.ocean};color:#fff;padding:7px 10px;font-size:12px;text-align:${i === 0 ? 'left' : 'right'};">${e}</th>`).join('')
  const trs = lignes.map((l, li) => `<tr>${l.map((v, i) =>
    `<td style="padding:6px 10px;font-size:13px;text-align:${i === 0 ? 'left' : 'right'};background:${li % 2 ? CH.clair : '#fff'};">${v}</td>`).join('')}</tr>`).join('')
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px;border:1px solid #d9e4ee;">${th ? `<tr>${th}</tr>` : ''}${trs}</table>`
}

function sectionTitre(txt) {
  return `<h3 style="color:${CH.ocean};font-size:15px;margin:20px 0 4px;border-bottom:2px solid ${CH.clair};padding-bottom:4px;">${txt}</h3>`
}

async function main() {
  if (!notificationsActives()) {
    console.log('🔕 Récap désactivé (secrets Brevo/bot manquants)')
    return
  }
  const destinataires = (await lireDestinataires()).filter(d => d.recap)
  if (!destinataires.length) {
    console.log('Aucun destinataire abonné au récap — rien à envoyer.')
    return
  }

  const maintenant = new Date()
  const veille     = new Date(maintenant - 864e5)
  const dateVeille = veille.toISOString().slice(0, 10)
  const jourLabel  = maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Abidjan' })

  // 1. État live
  const live = (await lireMesuresLive()).filter(m => m.sens === 'aller')
  live.sort((a, b) => String(a.axeId).localeCompare(String(b.axeId)))
  const htmlLive = tableHtml(
    ['Axe', 'Temps', 'Retard', 'Niveau'],
    live.map(m => [
      `<strong>${String(m.nom ?? m.axeId).replace(' (aller)', '')}</strong>`,
      `${f(m.temps_min)} min`,
      `${m.retard >= 0 ? '+' : ''}${f(m.retard)} min`,
      badgeNiveau(m.niveau ?? 1),
    ]),
  )
  const pire = live.reduce((a, b) => ((b.niveau ?? 0) > (a?.niveau ?? 0) ? b : a), live[0])

  // 2. Bilan de la veille
  let htmlVeille = `<p style="font-size:13px;color:${CH.gris};">Aucun relevé archivé pour la journée d'hier.</p>`
  let episodes = 0
  try {
    const rows = (await lireVeille(dateVeille)).filter(r => r.sens === 'aller' && r.temps_min > 0)
    if (rows.length) {
      const parAxe = {}
      rows.forEach(r => { (parAxe[r.axeId] ??= []).push(r) })
      episodes = rows.filter(r => (r.niveau ?? 1) >= 3).length
      const lignes = Object.entries(parAxe).sort(([a], [b]) => a.localeCompare(b)).map(([axeId, rs]) => {
        const t = rs.map(r => r.temps_min)
        const moy = t.reduce((x, y) => x + y, 0) / t.length
        const pointe = rs.reduce((a, b) => (b.temps_min > a.temps_min ? b : a), rs[0])
        const nom = String(rs[0].nom ?? axeId).replace(' (aller)', '') || axeId
        return [
          `<strong>${nom}</strong>`,
          `${f(moy)} min`,
          `${f(Math.min(...t))} – ${f(Math.max(...t))} min`,
          `${String(pointe.heure).padStart(2, '0')}h`,
          String(rs.filter(r => (r.niveau ?? 1) >= 3).length),
        ]
      })
      htmlVeille = tableHtml(['Axe', 'T. moyen', 'Plage min–max', 'Pointe à', 'Relevés N3+'], lignes)
    }
  } catch (err) {
    console.warn(`⚠ Bilan veille indisponible : ${err.message}`)
  }

  // 3. Créneaux à risque du jour (modèle ML — prévisions réelles du repo)
  let htmlPrev = `<p style="font-size:13px;color:${CH.gris};">Prévisions indisponibles.</p>`
  try {
    const pred = JSON.parse(readFileSync(new URL('../ml/predictions.json', import.meta.url), 'utf8'))
    const jour = JOURS_FR[maintenant.getDay()]
    const risques = Object.entries(pred.predictions ?? {})
      .filter(([k, v]) => k.includes(`_aller_${jour}_`) && v.niveau_prevu >= 3)
      .map(([k, v]) => {
        const [axeId, , , heure] = k.split('_')
        return [axeId, heure, v]
      })
    if (risques.length) {
      htmlPrev = tableHtml(
        ['Axe', 'Créneau', 'Temps prévu', 'Niveau prévu'],
        risques.map(([axeId, heure, v]) => [axeId.toUpperCase(), heure, `${f(v.temps_prevu_min)} min`, badgeNiveau(v.niveau_prevu)]),
      )
    } else {
      htmlPrev = `<p style="font-size:13px;">✅ Le modèle prédictif (${pred.meta?.modele ?? 'ML'}) n'identifie <strong>aucun créneau à risque</strong> (N3+) pour ce ${jour}.</p>`
    }
  } catch (err) {
    console.warn(`⚠ Prévisions indisponibles : ${err.message}`)
  }

  // 4. Assemblage + envoi
  const corps = `
    <p style="margin:0 0 6px;">Bonjour,</p>
    <p style="margin:0 0 14px;">Voici la situation du réseau routier portuaire ce <strong>${jourLabel}</strong>
    ${pire ? `— axe le plus chargé en ce moment : <strong>${String(pire.nom ?? '').replace(' (aller)', '')}</strong> ${badgeNiveau(pire.niveau ?? 1)}` : ''}.</p>
    ${sectionTitre('🚦 État actuel (sens aller)')}
    ${htmlLive}
    ${sectionTitre(`📊 Bilan d'hier (${veille.toLocaleDateString('fr-FR')})`)}
    ${htmlVeille}
    ${episodes > 0 ? `<p style="font-size:12px;color:${CH.gris};margin:2px 0 0;">${episodes} relevé(s) en niveau Ralenti ou pire hier, tous axes confondus.</p>` : ''}
    ${sectionTitre('🔮 Créneaux à surveiller aujourd’hui (modèle prédictif)')}
    ${htmlPrev}`

  const n = await envoyerMail({
    destinataires,
    sujet: `🚦 FlowPort — point trafic du ${maintenant.toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' })}`,
    html: gabarit({
      titre: 'Point trafic du matin',
      sousTitre: `Port Autonome d'Abidjan — généré à ${maintenant.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Abidjan', hour: '2-digit', minute: '2-digit' })}`,
      corps,
    }),
  })
  console.log(`✅ Récap envoyé à ${n} destinataire(s)`)
}

main().catch(err => {
  console.error('Erreur récap :', err)
  process.exit(1)
})
