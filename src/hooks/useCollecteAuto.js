import { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useCollecteAuto(maxRows = 2000) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'collecte_auto'),
      orderBy('timestamp', 'desc'),
      limit(maxRows),
    )

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map(d => {
          const r = d.data()
          if (typeof r.heure === 'string') r.heure = parseInt(r.heure, 10)
          return r
        })
        setData(rows)
        setLoading(false)
      },
      (err) => {
        console.error('collecte_auto snapshot erreur:', err)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [maxRows])

  return { data, loading }
}
