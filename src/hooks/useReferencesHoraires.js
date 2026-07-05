// ============================================================
// useReferencesHoraires.js — Références horaires recalibrées
// Charge une fois le doc flowport_references/horaires (publié
// chaque semaine par scripts/calibrer_references.js depuis les
// relevés réels). Retourne { valeurs, majLe } ou des valeurs
// nulles si le doc n'existe pas encore — getReference() se
// replie alors sur la base statique de février 2025.
// ============================================================

import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useReferencesHoraires() {
  const [valeurs, setValeurs] = useState(null)
  const [majLe,   setMajLe]   = useState(null)

  useEffect(() => {
    getDoc(doc(db, 'flowport_references', 'horaires'))
      .then(snap => {
        if (!snap.exists()) return
        const data = snap.data()
        if (data.valeurs) setValeurs(data.valeurs)
        if (data.majLe)   setMajLe(data.majLe)
      })
      .catch(err => console.warn('Références horaires indisponibles :', err.message))
  }, [])

  return { valeurs, majLe }
}
