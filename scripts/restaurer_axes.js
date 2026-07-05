// ============================================================
// restaurer_axes.js — Restaure les TRACÉS officiels des 3 axes
// (document docs/PortFlow_Troncons.docx) dans Firestore, via le
// compte bot admin. Lancé manuellement : GitHub → Actions →
// « Restaurer les itinéraires officiels » → Run workflow.
//
// NE TOUCHE QU'AUX CHAMPS DE TRACÉ : coordinates, coordinatesRetour,
// geometryRoute, start (updateMask). Les tronçons, tRef, noms,
// seuils et statuts actifs sont préservés tels quels.
// ============================================================

import { connexionBot, toField } from './notifs.js'
import { DEFAULT_AXES } from '../src/data/defaultData.js'

const PROJECT_ID = 'portflow-46738'
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const versFs = coords => coords.map(([lat, lng]) => ({ lat, lng }))

async function main() {
  if (!process.env.FLOWPORT_BOT_EMAIL || !process.env.FLOWPORT_BOT_PASSWORD || !process.env.FIREBASE_API_KEY) {
    console.error('❌ Secrets FLOWPORT_BOT_EMAIL / FLOWPORT_BOT_PASSWORD / FIREBASE_API_KEY requis.')
    process.exit(1)
  }
  const token = await connexionBot()

  for (const axe of DEFAULT_AXES) {
    const champs = {
      coordinates:       versFs(axe.coordinates),
      coordinatesRetour: versFs(axe.coordinatesRetour),
      geometryRoute:     versFs(axe.coordinates),   // tracé officiel prêt à afficher
      start:             { lat: axe.coordinates[0][0], lng: axe.coordinates[0][1] },
    }
    const mask = Object.keys(champs).map(f => `updateMask.fieldPaths=${f}`).join('&')
    const body = { fields: Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, toField(v)])) }
    const res = await fetch(`${FS}/flowport_axes/${axe.id}?${mask}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${axe.id} : ${res.status} ${await res.text()}`)
    console.log(`✓ ${axe.shortNom} — tracé officiel restauré (${axe.coordinates.length} pts aller, ${axe.coordinatesRetour.length} pts retour)`)
  }
  console.log('\n✅ Itinéraires officiels (PortFlow_Troncons) appliqués — tronçons, tRef et noms intacts.')
}

main().catch(err => { console.error('Erreur :', err); process.exit(1) })
