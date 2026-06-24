import {
  collection, doc, setDoc, deleteDoc, getDocs,
  onSnapshot, query, orderBy, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_AXES, DEFAULT_TRONCONS, DEFAULT_SEUILS } from '../data/defaultData'
import { computeRouteGeometry } from './tomtom'

const COL_AXES     = 'flowport_axes'
const COL_TRONCONS = 'flowport_troncons'
const COL_SEUILS   = 'flowport_seuils'

// ══════════════════════════════════════════════════════════
// Conversion coordonnées ↔ Firestore
// Firestore interdit les tableaux imbriqués [[lat,lng],...]
// On stocke donc [{lat, lng}, ...] et on reconvertit à la lecture.
// ══════════════════════════════════════════════════════════

// [[lat,lng],...] → [{lat,lng},...] pour écriture Firestore
function coordsToFs(coords) {
  if (!Array.isArray(coords)) return []
  return coords.map(p => Array.isArray(p) ? { lat: p[0], lng: p[1] } : p)
}

// [{lat,lng},...] ou [[lat,lng],...] → [[lat,lng],...] pour Leaflet
function coordsFromFs(coords) {
  if (!Array.isArray(coords)) return []
  return coords.map(p => Array.isArray(p) ? p : [p.lat, p.lng])
}

// start peut être [lat,lng] ou {lat,lng}
function startToFs(start) {
  if (!start) return null
  if (Array.isArray(start)) return { lat: start[0], lng: start[1] }
  return start
}

function startFromFs(start) {
  if (!start) return null
  if (Array.isArray(start)) return start
  return [start.lat, start.lng]
}

// Prépare un axe pour Firestore (convertit tableaux imbriqués → objets)
function axeToFs({ id, coordinates, coordinatesRetour, geometryRoute, start, ...rest }) {
  return {
    ...rest,
    coordinates:       coordsToFs(coordinates),
    ...(coordinatesRetour ? { coordinatesRetour: coordsToFs(coordinatesRetour) } : {}),
    ...(geometryRoute    ? { geometryRoute:    coordsToFs(geometryRoute)    } : {}),
    ...(start            ? { start:            startToFs(start)             } : {}),
  }
}

// Restaure un axe depuis Firestore (reconvertit objets → tableaux Leaflet)
function axeFromFs(data, id) {
  return {
    ...data,
    id,
    coordinates:       coordsFromFs(data.coordinates),
    coordinatesRetour: data.coordinatesRetour ? coordsFromFs(data.coordinatesRetour) : undefined,
    geometryRoute:     data.geometryRoute     ? coordsFromFs(data.geometryRoute)     : undefined,
    start:             startFromFs(data.start),
  }
}

// ══════════════════════════════════════════════════════════
// SYNC — réécrit les axes PAA officiels dans Firestore
// ══════════════════════════════════════════════════════════
export async function syncDefaultAxes() {
  const batch = writeBatch(db)
  DEFAULT_AXES.forEach(axe => {
    const { id } = axe
    // Pour les axes PAA officiels, coordinates = géométrie TomTom déjà calculée
    // On la réutilise comme geometryRoute pour l'affichage sur la carte
    const enriched = { ...axe, geometryRoute: axe.coordinates }
    batch.set(
      doc(db, COL_AXES, id),
      { ...axeToFs(enriched), updatedAt: serverTimestamp() },
      { merge: false },
    )
  })
  await batch.commit()
  console.log('✅ Axes PAA synchronisés avec defaultData.js')
}

// ══════════════════════════════════════════════════════════
// SEED — initialise si vide (premier démarrage)
// ══════════════════════════════════════════════════════════
export async function seedIfEmpty() {
  try {
    const snap = await getDocs(collection(db, COL_AXES))
    if (!snap.empty) return false

    const batch = writeBatch(db)

    DEFAULT_AXES.forEach(axe => {
      const { id } = axe
      batch.set(doc(db, COL_AXES, id), { ...axeToFs(axe), createdAt: serverTimestamp() })
    })
    DEFAULT_TRONCONS.forEach(({ id, coordinates, ...data }) => {
      batch.set(doc(db, COL_TRONCONS, id), {
        ...data,
        coordinates: coordsToFs(coordinates),
        createdAt: serverTimestamp(),
      })
    })
    DEFAULT_SEUILS.forEach(({ axeId, ...data }) => {
      batch.set(doc(db, COL_SEUILS, axeId), { ...data, createdAt: serverTimestamp() })
    })

    await batch.commit()
    console.log('✅ Firestore initialisé avec les données PAA officielles')
    return true
  } catch (err) {
    console.warn('⚠ Seed Firestore impossible :', err.message)
    return false
  }
}

// ══════════════════════════════════════════════════════════
// AXES — listeners & CRUD
// ══════════════════════════════════════════════════════════
export function subscribeAxes(onData, onError) {
  const q = query(collection(db, COL_AXES), orderBy('ordre'))
  return onSnapshot(
    q,
    snap => onData(snap.docs.map(d => axeFromFs(d.data(), d.id))),
    err  => { console.warn('subscribeAxes error:', err.code); onError?.(err) },
  )
}

export async function saveAxe(axe) {
  const { id } = axe
  let enriched = axe

  // Calcul automatique de la géométrie routière via TomTom
  if (axe.coordinates && axe.coordinates.length >= 2) {
    try {
      const geometry = await computeRouteGeometry(axe.coordinates)
      if (geometry && geometry.length > 5) {
        enriched = { ...axe, geometryRoute: geometry }
        console.log(`✅ Géométrie calculée pour ${id} : ${geometry.length} points`)
      }
    } catch (err) {
      console.warn(`⚠ Géométrie non calculée pour ${id} :`, err.message)
    }
  }

  await setDoc(
    doc(db, COL_AXES, id),
    { ...axeToFs(enriched), updatedAt: serverTimestamp() },
  )
}

export async function removeAxe(id) {
  await deleteDoc(doc(db, COL_AXES, id))
}

// ══════════════════════════════════════════════════════════
// TRONÇONS
// ══════════════════════════════════════════════════════════
export function subscribeTroncons(onData, onError) {
  const q = query(collection(db, COL_TRONCONS), orderBy('ordre'))
  return onSnapshot(
    q,
    snap => onData(snap.docs.map(d => ({
      ...d.data(),
      id:          d.id,
      coordinates: coordsFromFs(d.data().coordinates),
    }))),
    err => { console.warn('subscribeTroncons error:', err.code); onError?.(err) },
  )
}

export async function saveTroncon(t, allTroncons) {
  const { id, coordinates, ...data } = t
  const batch = writeBatch(db)

  batch.set(doc(db, COL_TRONCONS, id), {
    ...data,
    coordinates: coordsToFs(coordinates),
    updatedAt:   serverTimestamp(),
  })

  const sibling  = allTroncons.filter(x => x.axeId === t.axeId && x.id !== t.id)
  const newCodes = [...new Set([...sibling.map(x => x.code), t.code])]
  batch.update(doc(db, COL_AXES, t.axeId), { troncons: newCodes, updatedAt: serverTimestamp() })

  await batch.commit()
}

export async function removeTroncon(id, allTroncons) {
  const t     = allTroncons.find(x => x.id === id)
  const batch = writeBatch(db)

  batch.delete(doc(db, COL_TRONCONS, id))

  if (t) {
    const remaining = allTroncons
      .filter(x => x.axeId === t.axeId && x.id !== id)
      .map(x => x.code)
    batch.update(doc(db, COL_AXES, t.axeId), { troncons: remaining, updatedAt: serverTimestamp() })
  }

  await batch.commit()
}

// ══════════════════════════════════════════════════════════
// SEUILS
// ══════════════════════════════════════════════════════════
export function subscribeSeuils(onData) {
  return onSnapshot(
    collection(db, COL_SEUILS),
    snap => { if (!snap.empty) onData(snap.docs.map(d => ({ ...d.data(), axeId: d.id }))) },
    err  => console.warn('subscribeSeuils error:', err.code),
  )
}

export async function saveSeuil(seuil) {
  const { axeId, ...data } = seuil
  await setDoc(doc(db, COL_SEUILS, axeId), { ...data, updatedAt: serverTimestamp() })
}
