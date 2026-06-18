// ============================================================
// useHistoricalData.js — Charge l'historique PAA (2 016 mesures)
// Une seule lecture Firestore au montage, réutilisée pour tous
// les graphiques. Évite de re-télécharger à chaque clic.
// ============================================================

import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useHistoricalData() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, 'mesures'))
        const rows = snap.docs.map(d => d.data())
        setData(rows)
        console.log(`📊 ${rows.length} mesures historiques chargées`)
      } catch (err) {
        setError(err.message)
        console.error('Erreur chargement historique :', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { data, loading, error }
}