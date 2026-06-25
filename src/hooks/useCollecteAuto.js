import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useCollecteAuto(maxRows = 2000) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // orderBy timestamp desc — fonctionne avec Firestore Timestamp (nouveau) et string ISO (legacy)
        const q    = query(collection(db, 'collecte_auto'), orderBy('timestamp', 'desc'), limit(maxRows))
        const snap = await getDocs(q)
        const rows = snap.docs.map(d => {
          const r = d.data()
          // Normalise heure en entier (le script stocke getUTCHours = entier)
          if (typeof r.heure === 'string') r.heure = parseInt(r.heure, 10)
          return r
        })
        setData(rows)
      } catch (err) {
        console.error('Erreur lecture collecte_auto :', err)
        // Fallback sans tri si index Firestore absent
        try {
          const snap2 = await getDocs(collection(db, 'collecte_auto'))
          const rows2 = snap2.docs.map(d => {
            const r = d.data()
            if (typeof r.heure === 'string') r.heure = parseInt(r.heure, 10)
            return r
          })
          setData(rows2.slice(0, maxRows))
        } catch (_) { /* silencieux */ }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [maxRows])

  return { data, loading }
}
