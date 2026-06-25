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
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore'
import { auth, db } from './firebase'

export async function signIn(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  return user
}

export function logOut() {
  return firebaseSignOut(auth)
}

export async function getUserRole(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return { role: 'public', actif: true, seedNeeded: true }
  const d = snap.data()
  return { role: d.role ?? 'public', actif: d.actif !== false, seedNeeded: false }
}

// Crée le doc Firestore au premier login — si la collection est vide, l'utilisateur devient admin
export async function ensureUserDoc(firebaseUser) {
  const usersSnap = await getDocs(collection(db, 'users'))
  const role = usersSnap.empty ? 'admin' : 'public'
  await setDoc(doc(db, 'users', firebaseUser.uid), {
    nom:       firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Utilisateur',
    email:     firebaseUser.email,
    role,
    actif:     true,
    createdAt: new Date().toISOString(),
  })
  return role
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}