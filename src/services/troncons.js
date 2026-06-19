// ============================================================
// troncons.js — CRUD Firestore pour les tronçons
// Un tronçon est un sous-segment d'un axe (ex: CARENA → Pont HKB).
// ============================================================

import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Crée un nouveau tronçon
 * @param {Object} payload — { axeId, nom, ordre, coordinates }
 */
export async function createTroncon(payload) {
  return addDoc(collection(db, 'troncons'), {
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Met à jour un tronçon existant
 */
export async function updateTroncon(id, payload) {
  return updateDoc(doc(db, 'troncons', id), {
    ...payload,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Supprime un tronçon
 */
export async function deleteTroncon(id) {
  return deleteDoc(doc(db, 'troncons', id))
}