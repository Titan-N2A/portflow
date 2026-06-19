// ============================================================
// useTroncons.js — Écoute en temps réel des tronçons Firestore
// "Répercussion automatique" : toute modification (ajout, édition,
// suppression) est reflétée instantanément, sans recharger la page.
// ============================================================

import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useTroncons() {
  const [troncons, setTroncons] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'troncons'),
      (snap) => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTroncons(rows)
        setLoading(false)
      },
      (err) => {
        console.error('Erreur lecture tronçons :', err)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [])

  return { troncons, loading }
}