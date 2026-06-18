// ============================================================
// useTrafficLive.js — Hook React pour les données trafic live
// Jour 5 : ajoute le calcul des indicateurs globaux (I8/I9/I10)
// via useMemo — recalculés automatiquement à chaque mise à jour
// des mesures, sans appel API supplémentaire.
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { db }                      from '../services/firebase'
import { fetchAllRoutes }          from '../services/tomtom'
import { computeIndicators, computeGlobalIndicators } from '../services/indicators'

const POLLING_INTERVAL = 10 * 60 * 1000 // 10 minutes

export function useTrafficLive() {
  const [mesures,    setMesures]    = useState({})
  const [lastUpdate, setLastUpdate] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const collectAndSave = useCallback(async () => {
    try {
      console.log('🔄 Collecte TomTom...')
      const routes = await fetchAllRoutes()

      for (const mesure of routes) {
        if (!mesure.temps_min) continue
        const indicateurs = computeIndicators(mesure)
        await setDoc(doc(db, 'mesures_live', mesure.id), {
          ...mesure,
          ...indicateurs,
          updatedAt: new Date().toISOString(),
        })
      }

      setLastUpdate(new Date())
      console.log('✅ Mesures live mises à jour')
    } catch (err) {
      console.error('❌ Erreur collecte :', err)
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'mesures_live'),
      (snapshot) => {
        const data = {}
        snapshot.forEach(d => { data[d.id] = d.data() })
        setMesures(data)
        setLoading(false)
      },
      (err) => {
        console.error('Firestore onSnapshot error:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    collectAndSave()
    const interval = setInterval(collectAndSave, POLLING_INTERVAL)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [collectAndSave])

  // ── Indicateurs globaux — recalculés automatiquement ────────
  // useMemo évite de recalculer à chaque rendu si "mesures" n'a pas changé
  const globalIndicators = useMemo(
    () => computeGlobalIndicators(mesures),
    [mesures]
  )

  return {
    mesures,
    lastUpdate,
    loading,
    error,
    refresh: collectAndSave,
    ...globalIndicators, // expose I8, I9, I10 directement
  }
}