import { useState, useEffect, useCallback } from 'react'
import { fetchAllAxes } from '../services/tomtom'
import { DEFAULT_AXES, AXE_COLORS } from '../data/defaultData'

// Ré-export pour compatibilité avec les composants existants
export const AXES_OFFICIELS = DEFAULT_AXES
export { AXE_COLORS }

// ── Calcul des KPIs globaux ────────────────────────────────
function computeKPIs(mesures, axes) {
  const vals = axes.map(a => mesures[a.id]).filter(Boolean)
  if (vals.length === 0) return null

  const tempsGlobal    = vals.reduce((s, m) => s + m.tempsLive, 0) / vals.length
  const retardMoyen    = vals.reduce((s, m) => s + m.retard,    0) / vals.length
  const vitesseMoyenne = vals.reduce((s, m) => s + m.vitesse,   0) / vals.length
  // Niveau >= 3 = axe dégradé (ralenti, congestionné ou bloqué)
  const degrades   = vals.filter(m => m.niveau >= 3).length
  const critiques  = vals.filter(m => m.niveau >= 4).length
  const pctCong    = Math.round((degrades / vals.length) * 100)

  const pire = vals.reduce((max, m) => m.niveau > (max?.niveau ?? -1)
    ? { ...m, axe: axes.find(a => mesures[a.id] === m) } : max, null)

  const alertes = axes
    .map(a => ({ axe: a, mesure: mesures[a.id] }))
    .filter(({ mesure }) => mesure && mesure.niveau >= 3)

  return {
    tempsGlobal:     Math.round(tempsGlobal    * 10) / 10,
    retardMoyen:     Math.round(retardMoyen    * 10) / 10,
    vitesseMoyenne:  Math.round(vitesseMoyenne * 10) / 10,
    pctCong,
    tronconCritique: pire
      ? { nom: `${pire.axe?.shortNom ?? '?'} – ${pire.axe?.troncons?.at(-1) ?? '?'}`, niveau: pire.niveau }
      : null,
    alertes,
  }
}

// ── Hook principal ─────────────────────────────────────────
// axes : liste dynamique depuis Firestore (ou DEFAULT_AXES si non fourni)
export function useTrafficData(axes = DEFAULT_AXES) {
  const [mesures,    setMesures]    = useState({})
  const [kpis,       setKpis]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllAxes(axes)   // axes Firestore → routing dynamique
      setMesures(data)
      setKpis(computeKPIs(data, axes))
      setLastUpdate(new Date())
    } finally {
      setLoading(false)
    }
  }, [axes])

  // Re-calcule les KPIs si les axes changent (après chargement Firestore)
  useEffect(() => {
    if (Object.keys(mesures).length > 0) {
      setKpis(computeKPIs(mesures, axes))
    }
  }, [axes])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 30_000)
    return () => clearInterval(timer)
  }, [refresh])

  return { mesures, kpis, loading, lastUpdate, refresh }
}
