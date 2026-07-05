// ============================================================
// bilan_hebdo.js — Bilan hebdomadaire par email (lundi 6h45)
// Compare la semaine écoulée (lundi→dimanche) à la précédente à
// partir des agrégats quotidiens, par axe (sens aller) : temps
// moyen, plage min–max, jour le plus chargé, relevés N3+.
// Destinataires : ceux du récap matinal (config/notifications).
// Le rapport complet (PDF/Word/Excel) reste généré depuis la
// page Rapports — ce mail en est l'annonce chiffrée.
// ============================================================

import {
  notificationsActives, lireDestinataires, envoyerMail,
  gabarit, fromField, CH,
} from './notifs.js'

const PROJECT_ID   = 'portflow-46738'
const FIREBASE_KEY = process.env.FIREBASE_API_KEY
const FS  = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const FSQ = `${FS}:runQuery`

const f = n => (Math.round(n * 10) / 10).toLocaleString('fr-FR')

async function lireAgregats(du, au) {
  const res = await fetch(`${FSQ}?key=${FIREBASE_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'agregats_quotidiens' }],
        where: { compositeFilter: { op: 'AND', filters: [
          { fieldFilter: { field: { fieldPath: 'date' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: du } } },
          { fieldFilter: { field: { fieldPath: 'date' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: au } } },
        ] } },
        limit: 500,
      },
    }),
  })
  if (!res.ok) throw new Error(`agregats ${res.status}: ${await res.text()}`)
  const lignes = await res.json()
  return lignes.filter(l => l.document).map(l => {
    const r = {}
    for (const [k, v] of Object.entries(l.document.fields ?? {})) r[k] = fromField(v)
    return r
  })
}

async function lireAxes() {
  const res = await fetch(`${FS}/flowport_axes?key=${FIREBASE_KEY}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.documents ?? []).map(d => ({
    id:       d.name.split('/').pop(),
    shortNom: fromField(d.fields?.shortNom) ?? fromField(d.fields?.nom),
    tRef:     Number(fromField(d.fields?.tRef) ?? 0),
  }))
}

function statsAxe(agregats, axeId) {
  const rs = agregats.filter(a => a.axeId === axeId && a.sens === 'aller')
  if (!rs.length) return null
  const n   = rs.reduce((s, a) => s + (a.n ?? 0), 0)
  const moy = rs.reduce((s, a) => s + a.moy * (a.n ?? 0), 0) / (n || 1)
  const pire = rs.reduce((a, b) => (b.moy > a.moy ? b : a), rs[0])
  const n3p = rs.reduce((s, a) => s + ((a.niveaux?.[3] ?? 0) + (a.niveaux?.[4] ?? 0) + (a.niveaux?.[5] ?? 0)), 0)
  return {
    n, moy,
    min: Math.min(...rs.map(a => a.min)),
    max: Math.max(...rs.map(a => a.max)),
    pireJour: new Date(pire.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }),
    n3p,
    jours: rs.length,
  }
}

async function main() {
  if (!notificationsActives()) {
    console.log('🔕 Bilan hebdo désactivé (secrets manquants)')
    return
  }
  const destinataires = (await lireDestinataires()).filter(d => d.recap)
  if (!destinataires.length) { console.log('Aucun destinataire — rien à envoyer.'); return }

  // Semaine écoulée : lundi précédent → dimanche (hier si on est lundi)
  const auj = new Date()
  const dim = new Date(auj); dim.setUTCDate(auj.getUTCDate() - ((auj.getUTCDay() + 6) % 7) - 1)
  const lun = new Date(dim); lun.setUTCDate(dim.getUTCDate() - 6)
  const lunPrec = new Date(lun); lunPrec.setUTCDate(lun.getUTCDate() - 7)
  const dimPrec = new Date(dim); dimPrec.setUTCDate(dim.getUTCDate() - 7)
  const iso = d => d.toISOString().slice(0, 10)

  const [semaine, precedente, axes] = await Promise.all([
    lireAgregats(iso(lun), iso(dim)),
    lireAgregats(iso(lunPrec), iso(dimPrec)),
    lireAxes(),
  ])
  if (!semaine.length) {
    console.log('Aucun agrégat pour la semaine écoulée — bilan non envoyé (le workflow d\'agrégation doit tourner).')
    return
  }

  const lignes = axes.map(axe => {
    const s = statsAxe(semaine, axe.id)
    if (!s) return null
    const p = statsAxe(precedente, axe.id)
    const delta = p ? s.moy - p.moy : null
    const deltaTxt = delta === null ? '—'
      : `${delta >= 0 ? '▲ +' : '▼ −'}${f(Math.abs(delta))} min`
    const deltaCoul = delta === null ? CH.gris : delta > 0.5 ? '#C0392B' : delta < -0.5 ? '#1E8449' : CH.gris
    return `<tr>
      <td style="padding:7px 10px;font-weight:bold;">${axe.shortNom}</td>
      <td style="padding:7px 10px;text-align:right;"><strong>${f(s.moy)} min</strong></td>
      <td style="padding:7px 10px;text-align:right;">${f(s.min)} – ${f(s.max)}</td>
      <td style="padding:7px 10px;text-align:right;color:${deltaCoul};">${deltaTxt}</td>
      <td style="padding:7px 10px;text-align:right;">${s.n3p}</td>
      <td style="padding:7px 10px;">${s.pireJour}</td>
    </tr>`
  }).filter(Boolean)

  const jours = new Set(semaine.map(a => a.date)).size
  const entetes = ['Axe', 'T. moyen', 'Min–max (min)', 'vs sem. préc.', 'Relevés N3+', 'Jour le plus chargé']
    .map((e, i) => `<th style="background:${CH.ocean};color:#fff;padding:7px 10px;font-size:12px;text-align:${i === 0 || i === 5 ? 'left' : 'right'};">${e}</th>`).join('')

  const corps = `
    <p style="margin:0 0 12px;">Bilan de la circulation portuaire pour la semaine du
    <strong>${lun.toLocaleDateString('fr-FR')}</strong> au <strong>${dim.toLocaleDateString('fr-FR')}</strong>
    (sens aller, ${jours} journée(s) de données).</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #d9e4ee;font-size:13px;">
      <tr>${entetes}</tr>${lignes.join('')}
    </table>
    <p style="font-size:12px;color:${CH.gris};margin:12px 0 0;">
      Pour le rapport officiel complet (PDF, Word, Excel — gabarit DEESP), ouvrez FlowPort → Rapports,
      type « Hebdomadaire », période ${dim.toLocaleDateString('fr-FR')}.
    </p>`

  const n = await envoyerMail({
    destinataires,
    sujet: `📊 FlowPort — bilan trafic de la semaine du ${lun.toLocaleDateString('fr-FR')}`,
    html: gabarit({
      titre: 'Bilan hebdomadaire du trafic',
      sousTitre: `Port Autonome d'Abidjan — semaine du ${lun.toLocaleDateString('fr-FR')} au ${dim.toLocaleDateString('fr-FR')}`,
      corps,
    }),
  })
  console.log(`✅ Bilan hebdo envoyé à ${n} destinataire(s)`)
}

main().catch(err => { console.error('Erreur bilan hebdo :', err); process.exit(1) })
