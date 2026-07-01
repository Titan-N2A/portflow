// ============================================================
// useGeolocation.js — Suivi de la position GPS utilisateur
//
// Ne s'active QUE si un consentement a été accordé via
// ConsentBanner (sessionStorage). Écrit la position (anonymisée,
// sessionId uniquement) dans Firestore "utilisateurs_live" avec
// un seuil anti-spam (>200m déplacé OU >60s écoulées).
//
// axeProche est calculé côté client par distance haversine à la
// géométrie de chaque axe (aucun appel réseau) ; nearestRoad()
// (OSRM) est appelé en complément pour confirmer que la position
// est bien sur une route cartographiée (roadName informatif).
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { nearestRoad } from '../services/tomtom'
import { haversineDistanceM } from '../utils/geo'
import { CONSENT_KEY, CONSENT_EVENT } from '../components/shared/ConsentBanner'

const DIST_THRESHOLD_M  = 200
const TIME_THRESHOLD_MS = 60 * 1000
const COL               = 'utilisateurs_live'

// Trouve l'axe PAA le plus proche parmi les 3, via distance à sa géométrie
function nearestAxe(lat, lng, axes) {
  let bestAxeId  = null
  let bestDistM  = Infinity

  axes.forEach(axe => {
    const geom = axe.geometryRoute?.length > 1 ? axe.geometryRoute : axe.coordinates
    if (!geom || geom.length < 1) return
    geom.forEach(p => {
      const [plat, plng] = Array.isArray(p) ? p : [p.lat, p.lng]
      const d = haversineDistanceM(lat, lng, plat, plng)
      if (d < bestDistM) { bestDistM = d; bestAxeId = axe.id }
    })
  })

  return bestAxeId
}

export function useGeolocation(axes = []) {
  const [position,         setPosition]         = useState(null)
  const [permissionStatus, setPermissionStatus] = useState('prompt') // 'prompt' | 'granted' | 'denied' | 'unsupported'
  const [error,            setError]            = useState(null)
  const [isTracking,       setIsTracking]       = useState(false)
  // Consentement — lu au montage, puis mis à jour en direct via CONSENT_EVENT
  // (ConsentBanner peut être décidé après le montage de ce hook, sans remontage)
  const [consent,          setConsent]          = useState(() => sessionStorage.getItem(CONSENT_KEY))

  // sessionId anonyme — un seul par session, jamais régénéré
  const sessionIdRef = useRef(null)
  if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID()

  const lastSentRef = useRef({ lat: null, lng: null, ts: 0 })
  const axesRef     = useRef(axes)
  useEffect(() => { axesRef.current = axes }, [axes])

  const cleanup = useCallback(() => {
    deleteDoc(doc(db, COL, sessionIdRef.current)).catch(() => {
      // Session déjà nettoyée ou hors-ligne — sans conséquence
    })
  }, [])

  useEffect(() => {
    function handleConsentChange(e) { setConsent(e.detail) }
    window.addEventListener(CONSENT_EVENT, handleConsentChange)
    return () => window.removeEventListener(CONSENT_EVENT, handleConsentChange)
  }, [])

  useEffect(() => {
    if (consent !== 'accepted') return

    if (!('geolocation' in navigator)) {
      setPermissionStatus('unsupported')
      setError('La géolocalisation n\'est pas disponible sur ce navigateur.')
      return
    }

    async function handlePosition(pos) {
      const { latitude: lat, longitude: lng, speed } = pos.coords
      setPosition({ lat, lng })
      setPermissionStatus('granted')
      setIsTracking(true)
      setError(null)

      const last    = lastSentRef.current
      const now     = Date.now()
      const movedM  = last.lat != null ? haversineDistanceM(lat, lng, last.lat, last.lng) : Infinity
      const elapsed = now - last.ts

      // Seuil anti-spam : on n'écrit que si déplacement > 200m OU > 60s écoulées
      if (movedM < DIST_THRESHOLD_M && elapsed < TIME_THRESHOLD_MS) return
      lastSentRef.current = { lat, lng, ts: now }

      const axeProche = nearestAxe(lat, lng, axesRef.current)
      const road       = await nearestRoad(lat, lng)

      try {
        await setDoc(doc(db, COL, sessionIdRef.current), {
          sessionId:  sessionIdRef.current,
          lat, lng,
          timestamp:  serverTimestamp(),
          axeProche,
          vitesseKmh: speed != null ? Math.round(speed * 3.6 * 10) / 10 : null,
          roadName:   road?.roadName ?? null,
        })
      } catch (err) {
        console.error('useGeolocation — écriture Firestore impossible :', err)
      }
    }

    function handleError(err) {
      setError(err.message || 'Position GPS indisponible.')
      setPermissionStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt')
      setIsTracking(false)
    }

    const watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge:         10000,
      timeout:            15000,
    })

    return () => {
      navigator.geolocation.clearWatch(watchId)
      setIsTracking(false)
      cleanup()
    }
  }, [consent, cleanup])

  // Filet de sécurité : nettoie aussi si l'onglet se ferme brutalement
  useEffect(() => {
    window.addEventListener('beforeunload', cleanup)
    return () => window.removeEventListener('beforeunload', cleanup)
  }, [cleanup])

  return { position, permissionStatus, error, isTracking, sessionId: sessionIdRef.current }
}
