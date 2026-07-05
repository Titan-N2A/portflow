// ============================================================
// useHistoricalData.js — Charge l'historique PAA (2 016 mesures)
// Une seule lecture Firestore au montage, réutilisée pour tous
// les graphiques. Évite de re-télécharger à chaque clic.
//
// ⚠ Lecture BORNÉE au jeu historique de février 2025 : la collecte
// automatique ajoute ~1 728 docs/jour dans "mesures" — sans borne,
// ce hook lisait la collection entière (50 000+ docs) et vidait à
// lui seul le quota Firestore gratuit journalier (50 000 lectures)
// à chaque visite de la page Graphiques (cause des 429 du 04/07).
// ============================================================

import { useState, useEffect } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useHistoricalData() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(
          collection(db, 'mesures'),
          where('date', '>=', '2025-02-01'),
          where('date', '<=', '2025-02-28'),
        ))
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
