// ============================================================
// useTrafficLive.js — Hook React pour les données trafic live
// Stratégie :
//   1. Charge les données depuis Firestore (mesures_live)
//   2. Écoute les mises à jour en temps réel (onSnapshot)
//   3. Relance le collecteur TomTom toutes les 10 minutes
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { db }                   from '../services/firebase'
import { fetchAllRoutes }       from '../services/tomtom'
import { computeIndicators }    from '../services/indicators'

// Intervalle de polling TomTom (10 minutes)
const POLLING_INTERVAL = 10 * 60 * 1000

export function useTrafficLive() {
  const [mesures,    setMesures]    = useState({})   // données live par axeId_sens
  const [lastUpdate, setLastUpdate] = useState(null) // horodatage dernier refresh
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  // ── Collecte TomTom + calcul indicateurs + sauvegarde Firestore ──
  const collectAndSave = useCallback(async () => {
    try {
      console.log('🔄 Collecte TomTom...')
      const routes = await fetchAllRoutes()

      for (const mesure of routes) {
        if (!mesure.temps_min) continue

        // Calcule les indicateurs
        const indicateurs = computeIndicators(mesure)

        // Sauvegarde dans Firestore (écrase la mesure précédente)
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
    // ── Écoute Firestore en temps réel ──────────────────────
    const unsubscribe = onSnapshot(
      collection(db, 'mesures_live'),
      (snapshot) => {
        const data = {}
        snapshot.forEach(d => {
          data[d.id] = d.data()
        })
        setMesures(data)
        setLoading(false)
      },
      (err) => {
        console.error('Firestore onSnapshot error:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    // ── Premier appel TomTom au montage ─────────────────────
    collectAndSave()

    // ── Polling toutes les 10 minutes ───────────────────────
    const interval = setInterval(collectAndSave, POLLING_INTERVAL)

    // ── Nettoyage au démontage ──────────────────────────────
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [collectAndSave])

  return { mesures, lastUpdate, loading, error, refresh: collectAndSave }
}