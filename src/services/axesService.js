import {
  collection, doc, setDoc, deleteDoc, getDocs,
  onSnapshot, query, orderBy, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_AXES, DEFAULT_TRONCONS, DEFAULT_SEUILS } from '../data/defaultData'

// ── Collections Firestore ─────────────────────────────────
const COL_AXES     = 'flowport_axes'
const COL_TRONCONS = 'flowport_troncons'
const COL_SEUILS   = 'flowport_seuils'

// ══════════════════════════════════════════════════════════
// SEED : Initialise Firestore avec les données PAA officielles
// si les collections sont vides (premier démarrage)
// ══════════════════════════════════════════════════════════
export async function seedIfEmpty() {
  try {
    const snap = await getDocs(collection(db, COL_AXES))
    if (!snap.empty) return false // déjà initialisé

    const batch = writeBatch(db)

    DEFAULT_AXES.forEach(({ id, ...data }) => {
      batch.set(doc(db, COL_AXES, id), { ...data, createdAt: serverTimestamp() })
    })
    DEFAULT_TRONCONS.forEach(({ id, ...data }) => {
      batch.set(doc(db, COL_TRONCONS, id), { ...data, createdAt: serverTimestamp() })
    })
    DEFAULT_SEUILS.forEach(({ axeId, ...data }) => {
      batch.set(doc(db, COL_SEUILS, axeId), { ...data, createdAt: serverTimestamp() })
    })

    await batch.commit()
    console.log('✅ FlowPort: Firestore initialisé avec les données PAA officielles')
    return true
  } catch (err) {
    console.warn('⚠ Seed Firestore impossible (mode offline):', err.code)
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
    snap => onData(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
    err  => { console.warn('subscribeAxes error:', err.code); onError?.(err) }
  )
}

export async function saveAxe(axe) {
  const { id, ...data } = axe
  await setDoc(doc(db, COL_AXES, id), { ...data, updatedAt: serverTimestamp() })
}

export async function removeAxe(id) {
  await deleteDoc(doc(db, COL_AXES, id))
}

// ══════════════════════════════════════════════════════════
// TRONÇONS — listeners & CRUD (batch avec sync axe parent)
// ══════════════════════════════════════════════════════════
export function subscribeTroncons(onData, onError) {
  const q = query(collection(db, COL_TRONCONS), orderBy('ordre'))
  return onSnapshot(
    q,
    snap => onData(snap.docs.map(d => ({ ...d.data(), id: d.id }))),
    err  => { console.warn('subscribeTroncons error:', err.code); onError?.(err) }
  )
}

// Sauvegarde tronçon ET met à jour la liste troncons[] de l'axe parent
export async function saveTroncon(t, allTroncons) {
  const { id, ...data } = t
  const batch = writeBatch(db)

  batch.set(doc(db, COL_TRONCONS, id), { ...data, updatedAt: serverTimestamp() })

  // Recompute troncons list for parent axe
  const sibling  = allTroncons.filter(x => x.axeId === t.axeId && x.id !== t.id)
  const newCodes = [...new Set([...sibling.map(x => x.code), t.code])]
  batch.update(doc(db, COL_AXES, t.axeId), { troncons: newCodes, updatedAt: serverTimestamp() })

  await batch.commit()
}

// Supprime tronçon ET met à jour la liste troncons[] de l'axe parent
export async function removeTroncon(id, allTroncons) {
  const t = allTroncons.find(x => x.id === id)
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
    snap => {
      if (!snap.empty) onData(snap.docs.map(d => ({ ...d.data(), axeId: d.id })))
    },
    err => console.warn('subscribeSeuils error:', err.code)
  )
}

export async function saveSeuil(seuil) {
  const { axeId, ...data } = seuil
  await setDoc(doc(db, COL_SEUILS, axeId), { ...data, updatedAt: serverTimestamp() })
}
