// ============================================================
// usePredictions.js — Charge predictions.json (modèle Jour 10)
// ============================================================

import { useState, useEffect } from 'react'

export function usePredictions() {
  const [predictions, setPredictions] = useState(null)
  const [meta,        setMeta]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)

  useEffect(() => {
    fetch('/predictions.json')
      .then(res => {
        if (!res.ok) throw new Error('predictions.json introuvable')
        return res.json()
      })
      .then(data => {
        setPredictions(data.predictions)
        setMeta(data.meta)
        setLoading(false)
      })
      .catch(err => {
        console.error('Erreur chargement prédictions :', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { predictions, meta, loading, error }
}