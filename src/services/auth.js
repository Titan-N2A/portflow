// ============================================================
// auth.js — Service d'authentification PortFlow
// Gère connexion, déconnexion et lecture du rôle utilisateur.
// Voir note en haut de conversation sur l'alternative aux
// Custom Claims (rôle stocké dans Firestore users/{uid}).
// ============================================================

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

/**
 * Connecte un utilisateur avec email + mot de passe
 */
export async function signIn(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  return user
}

/**
 * Déconnecte l'utilisateur courant
 */
export function logOut() {
  return firebaseSignOut(auth)
}

/**
 * Récupère le rôle d'un utilisateur depuis Firestore
 * @param {string} uid
 * @returns {string} 'admin' | 'public'
 */
export async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data().role : 'public'
}

/**
 * S'abonne aux changements d'état de connexion Firebase
 */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}