import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore'
import { sendPasswordResetEmail } from 'firebase/auth'
import { db, auth } from './firebase'

const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY

async function createAuthUser(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  )
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.localId
}

export async function listUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
}

export async function createUser({ nom, email, password, role }) {
  const uid = await createAuthUser(email, password)
  await setDoc(doc(db, 'users', uid), {
    nom, email, role, actif: true,
    createdAt: new Date().toISOString(),
  })
  return uid
}

export async function updateUser(uid, updates) {
  await updateDoc(doc(db, 'users', uid), updates)
}

export async function deleteUserDoc(uid) {
  await deleteDoc(doc(db, 'users', uid))
}

export async function sendResetEmail(email) {
  await sendPasswordResetEmail(auth, email)
}
