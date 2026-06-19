// ============================================================
// useAxesLive.js — Lit les axes depuis Firestore en temps réel
// Fusionne avec la config statique (num, sens, reference — non
// éditables ici) pour garder num/couleurs/clés TomTom cohérents.
// ============================================================

import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { AXES_DATA } from '../data/axes'

/**
 * Convertit un point [lat,lng] (ancien format statique) en {lat,lng}
 * Garantit un format unique partout dans l'app.
 */
function normalizeCoords(coords) {
  return coords.map(p => Array.isArray(p) ? { lat: p[0], lng: p[1] } : p)
}

export function useAxesLive() {
  // Valeur initiale = config statique (affichée avant le premier chargement Firestore)
  const [axes, setAxes] = useState(
    AXES_DATA.map(a => ({ ...a, coordinates: normalizeCoords(a.coordinates) }))
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'axes'), (snap) => {
      const liveData = {}
      snap.forEach(d => { liveData[d.id] = d.data() })

      const merged = AXES_DATA.map(staticAxe => {
        const live = liveData[staticAxe.id]
        if (!live) return { ...staticAxe, coordinates: normalizeCoords(staticAxe.coordinates) }

        return {
          ...staticAxe, // num, sens, reference — non édités ici
          nom:         live.nom ?? staticAxe.nom,
          distance:    live.distance ?? staticAxe.distance,
          coordinates: normalizeCoords(live.coordinates ?? staticAxe.coordinates),
        }
      })

      setAxes(merged)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  return { axes, loading }
}