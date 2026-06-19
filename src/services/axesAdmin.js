// ============================================================
// axesAdmin.js — Édition des axes existants
// Jour 9 (révisé) : nom, distance ET coordonnées du tracé.
// ============================================================

import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * Met à jour le nom, la distance et/ou les coordonnées d'un axe
 * @param {string} axeId
 * @param {Object} updates — { nom?, distance?, coordinates? }
 */
export async function updateAxeInfo(axeId, updates) {
  return updateDoc(doc(db, 'axes', axeId), {
    ...updates,
    updatedAt: new Date().toISOString(),
  })
}