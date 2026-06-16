// ============================================================
// PORTFLOW — CONFIGURATION FIREBASE
// Initialise Firebase et exporte les services utilisés
// dans toute l'application : Firestore, Auth.
// ============================================================

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Configuration Firebase — chargée depuis les variables d'environnement
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Initialisation de l'application Firebase
const app = initializeApp(firebaseConfig)

// Services exportés et réutilisables partout dans l'app
export const db   = getFirestore(app) // Base de données Firestore
export const auth = getAuth(app)      // Authentification Firebase