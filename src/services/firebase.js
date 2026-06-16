// ============================================================
// firebase.js — Configuration et schéma Firestore
// 
// COLLECTIONS FIRESTORE :
// ┌─────────────────────────────────────────────────────────┐
// │ axes/         → 3 axes PAA (métadonnées + coordonnées)  │
// │ troncons/     → 14 tronçons (sous-segments des axes)    │
// │ mesures/      → Mesures temps réel (TomTom/ORS)         │
// │ references/   → Références horaires réelles (base PAA)  │
// │ users/        → Profils utilisateurs + rôles            │
// │ config/       → Seuils d'alerte + paramètres app        │
// └─────────────────────────────────────────────────────────┘
// ============================================================

import { initializeApp }  from 'firebase/app'
import { getFirestore }   from 'firebase/firestore'
import { getAuth }        from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const db   = getFirestore(app)
export const auth = getAuth(app)

// ============================================================
// RÉFÉRENCE DES COLLECTIONS — pour import dans les services
// ============================================================
// import { db } from './firebase'
// import { collection, doc } from 'firebase/firestore'
//
// collection(db, 'axes')        → liste des 3 axes
// collection(db, 'troncons')    → 14 sous-segments
// collection(db, 'mesures')     → flux temps réel
// collection(db, 'references')  → historique PAA
// collection(db, 'users')       → profils + rôles
// collection(db, 'config')      → seuils + config
// ============================================================