// ============================================================
// useAgregats.js — Agrégats quotidiens par axe/sens
// Lit agregats_quotidiens (1 doc par jour × axe × sens, produit
// chaque nuit par scripts/agreger_quotidien.js) pour les vues
// 7 j / 30 j de la page Graphiques : ~40 à 180 lectures au lieu
// des relevés bruts. nbJours = 0 → aucune lecture.
// ============================================================

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'

export function useAgregats(nbJours) {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!nbJours) { setRows([]); return }
    let annule = false
    setLoading(true)
    const depuis = new Date(Date.now() - nbJours * 864e5).toISOString().slice(0, 10)
    getDocs(query(collection(db, 'agregats_quotidiens'), where('date', '>=', depuis)))
      .then(snap => { if (!annule) setRows(snap.docs.map(d => d.data())) })
      .catch(err => console.warn('Agrégats quotidiens indisponibles :', err.message))
      .finally(() => { if (!annule) setLoading(false) })
    return () => { annule = true }
  }, [nbJours])

  return { rows, loading }
}
