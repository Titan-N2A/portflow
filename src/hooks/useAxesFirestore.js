// ══════════════════════════════════════════════════════════
// useAxesFirestore — Hook principal de gestion des axes PAA
//
// Fournit :
//   - axes, troncons, seuils  → données temps réel Firestore
//   - saveAxe / deleteAxe     → CRUD axes
//   - saveTroncon / deleteTroncon → CRUD tronçons (+ sync axe parent)
//   - saveSeuil               → CRUD seuils
//   - loading / error         → états de chargement
//
// Comportement offline : si Firestore est inaccessible, les
// données par défaut (defaultData.js) sont utilisées en fallback.
// ══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  subscribeAxes, subscribeTroncons, subscribeSeuils,
  saveAxe    as fsSaveAxe,
  removeAxe  as fsRemoveAxe,
  saveTroncon as fsSaveTroncon,
  removeTroncon as fsRemoveTroncon,
  saveSeuil  as fsSaveSeuil,
  seedIfEmpty,
  cleanupPlaceholderTroncons,
} from '../services/axesService'
import {
  DEFAULT_AXES, DEFAULT_TRONCONS, DEFAULT_SEUILS,
} from '../data/defaultData'

export function useAxesFirestore() {
  const [axes,     setAxes]     = useState(DEFAULT_AXES)
  const [troncons, setTroncons] = useState([])
  const [seuils,   setSeuils]   = useState(DEFAULT_SEUILS)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [offline,  setOffline]  = useState(false)

  // Référence courante pour les tronçons (utilisée dans les callbacks)
  const tronconsRef = useRef(troncons)
  useEffect(() => { tronconsRef.current = troncons }, [troncons])

  useEffect(() => {
    let unsubA, unsubT, unsubS
    let mounted = true

    async function init() {
      // 1. Tenter le seed au premier démarrage (silencieux si déjà fait)
      await seedIfEmpty()
      // 2. Supprimer les tronçons placeholder si présents (coordonnées fausses)
      await cleanupPlaceholderTroncons()
      if (!mounted) return

      // 2. Abonnements temps réel Firestore
      unsubA = subscribeAxes(
        data => {
          if (!mounted) return
          setAxes(data.length > 0 ? data : DEFAULT_AXES)
          setLoading(false)
          setOffline(false)
        },
        err => {
          if (!mounted) return
          console.warn('Firestore axes inaccessible — mode offline')
          setAxes(DEFAULT_AXES)
          setLoading(false)
          setOffline(true)
          setError('Firestore inaccessible — données locales utilisées')
        }
      )

      unsubT = subscribeTroncons(
        data => { if (mounted) setTroncons(data) },
        ()   => { if (mounted) setTroncons([]) }
      )

      unsubS = subscribeSeuils(
        data => { if (mounted) setSeuils(data.length > 0 ? data : DEFAULT_SEUILS) }
      )
    }

    init().catch(err => {
      console.error('useAxesFirestore init error:', err)
      setLoading(false)
      setOffline(true)
    })

    return () => {
      mounted = false
      unsubA?.()
      unsubT?.()
      unsubS?.()
    }
  }, [])

  // ── AXES ──────────────────────────────────────────────────

  const saveAxe = useCallback(async (axe) => {
    if (offline) {
      // Mode offline : mise à jour locale uniquement
      setAxes(prev => prev.find(a => a.id === axe.id)
        ? prev.map(a => a.id === axe.id ? axe : a)
        : [...prev, axe]
      )
      return
    }
    await fsSaveAxe(axe)
    // L'onSnapshot déclenche la mise à jour automatique
  }, [offline])

  const deleteAxe = useCallback(async (id) => {
    if (offline) {
      setAxes(prev => prev.filter(a => a.id !== id))
      setTroncons(prev => prev.filter(t => t.axeId !== id))
      return
    }
    // Supprimer les tronçons liés en batch
    const linked = tronconsRef.current.filter(t => t.axeId === id)
    await Promise.all(linked.map(t => fsRemoveTroncon(t.id, tronconsRef.current)))
    await fsRemoveAxe(id)
  }, [offline])

  const toggleAxe = useCallback(async (id) => {
    const axe = axes.find(a => a.id === id)
    if (!axe) return
    await saveAxe({ ...axe, actif: !axe.actif })
  }, [axes, saveAxe])

  // ── TRONÇONS ──────────────────────────────────────────────

  const saveTroncon = useCallback(async (t) => {
    if (offline) {
      setTroncons(prev => {
        const exists  = prev.find(x => x.id === t.id)
        const newList = exists ? prev.map(x => x.id === t.id ? t : x) : [...prev, t]
        setAxes(prevAxes => prevAxes.map(a => a.id === t.axeId
          ? { ...a, troncons: newList.filter(tr => tr.axeId === a.id).map(tr => tr.code) }
          : a
        ))
        return newList
      })
      return
    }
    await fsSaveTroncon(t, tronconsRef.current)
  }, [offline])

  const deleteTroncon = useCallback(async (id) => {
    if (offline) {
      const t = tronconsRef.current.find(x => x.id === id)
      setTroncons(prev => {
        const newList = prev.filter(x => x.id !== id)
        if (t) setAxes(prevAxes => prevAxes.map(a => a.id === t.axeId
          ? { ...a, troncons: newList.filter(tr => tr.axeId === a.id).map(tr => tr.code) }
          : a
        ))
        return newList
      })
      return
    }
    await fsRemoveTroncon(id, tronconsRef.current)
  }, [offline])

  // ── SEUILS ────────────────────────────────────────────────

  const saveSeuil = useCallback(async (seuil) => {
    if (offline) {
      setSeuils(prev => prev.map(s => s.axeId === seuil.axeId ? seuil : s))
      return
    }
    await fsSaveSeuil(seuil)
  }, [offline])

  return {
    axes, troncons, seuils,
    loading, error, offline,
    saveAxe, deleteAxe, toggleAxe,
    saveTroncon, deleteTroncon,
    saveSeuil,
  }
}
