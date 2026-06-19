// ============================================================
// useCollecteAuto.js — Lit l'historique accumulé automatiquement
// (collection collecte_auto, alimentée par GitHub Actions).
// ============================================================

import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useCollecteAuto(maxRows = 2000) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const q    = query(collection(db, 'collecte_auto'), orderBy('timestamp', 'desc'), limit(maxRows))
        const snap = await getDocs(q)
        setData(snap.docs.map(d => d.data()))
      } catch (err) {
        console.error('Erreur lecture collecte_auto :', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [maxRows])

  return { data, loading }
}