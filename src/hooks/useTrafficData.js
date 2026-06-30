import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { DEFAULT_AXES, AXE_COLORS } from '../data/defaultData'
import { fetchAllAxes } from '../services/tomtom'

export const AXES_OFFICIELS = DEFAULT_AXES
export { AXE_COLORS }

const REFRESH_MS = 2 * 60 * 1000 // 2 minutes

function computeNiveau(ratio) {
  if (!ratio) return 0
  if (ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}

function simulateAxe(axe) {
  const hour   = new Date().getHours()
  const isRush = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)
  const base   = axe.tRef ?? 20
  const factor = isRush ? 1.2 + Math.random() * 0.3 : 1.0 + Math.random() * 0.15
  const tempsLive = Math.round(base * factor * 10) / 10
  const ratio     = tempsLive / base
  return {
    tempsLive,
    niveau:    computeNiveau(ratio),
    vitesse:   Math.round(((axe.dist ?? 10) / tempsLive) * 60 * 10) / 10,
    retard:    Math.round((tempsLive - base) * 10) / 10,
    ratio,
    simulated: true,
  }
}

function computeKPIs(mesures, axes) {
  const vals = axes.map(a => mesures[a.id]).filter(Boolean)
  if (vals.length === 0) return null
  const tempsGlobal    = vals.reduce((s, m) => s + m.tempsLive, 0) / vals.length
  const retardMoyen    = vals.reduce((s, m) => s + m.retard,    0) / vals.length
  const vitesseMoyenne = vals.reduce((s, m) => s + m.vitesse,   0) / vals.length
  const degrades  = vals.filter(m => m.niveau >= 3).length
  const pctCong   = Math.round((degrades / vals.length) * 100)
  // Fix: garder la référence axe par appariement explicite (pas par référence objet)
  const paires    = axes.map(a => ({ axe: a, m: mesures[a.id] })).filter(({ m }) => m)
  const pireEntry = paires.reduce((best, curr) =>
    curr.m.niveau > (best?.m?.niveau ?? -1) ? curr : best, null)
  const alertes   = axes
    .map(a => ({ axe: a, mesure: mesures[a.id] }))
    .filter(({ mesure }) => mesure && mesure.niveau >= 3)
  return {
    tempsGlobal:     Math.round(tempsGlobal    * 10) / 10,
    retardMoyen:     Math.round(retardMoyen    * 10) / 10,
    vitesseMoyenne:  Math.round(vitesseMoyenne * 10) / 10,
    pctCong,
    tronconCritique: pireEntry
      ? { nom: `${pireEntry.axe.shortNom ?? '?'} – ${pireEntry.axe.troncons?.at(-1) ?? '?'}`, niveau: pireEntry.m.niveau }
      : null,
    alertes,
  }
}

function buildMesures(snapshot, axes) {
  const data = {}
  snapshot.forEach(doc => {
    const d = doc.data()
    if (!d.axeId || !d.temps_min) return
    const axe = axes.find(a => a.id === d.axeId)
    if (!axe) return
    const tempsLive = d.temps_min
    if (d.sens === 'aller' || !data[d.axeId]) {
      data[d.axeId] = {
        tempsLive,
        niveau:    d.niveau  ?? computeNiveau(tempsLive / (axe.tRef ?? 20)),
        vitesse:   d.vitesse ?? 0,
        retard:    d.retard  ?? 0,
        ratio:     tempsLive / (axe.tRef ?? 20),
        simulated: false,
        source:    d.source ?? 'firestore',
        updatedAt: d.timestamp ?? null,
      }
    }
    if (d.sens === 'retour') {
      data[d.axeId].tempsRetour = tempsLive
    }
  })
  // Simulation pour les axes sans données Firestore
  axes.forEach(axe => {
    if (!data[axe.id]) data[axe.id] = simulateAxe(axe)
  })
  return data
}

export function useTrafficData(axes = DEFAULT_AXES) {
  const [mesures,         setMesures]         = useState({})
  const [geometryRetours, setGeometryRetours] = useState({})
  const [kpis,            setKpis]            = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [lastUpdate,      setLastUpdate]      = useState(null)

  const axesRef = useRef(axes)
  useEffect(() => { axesRef.current = axes }, [axes])

  // Appel TomTom direct → écrit dans mesures_live → onSnapshot met à jour le dashboard
  // Si TomTom est indisponible (résultats simulés), met à jour le state local directement
  // pour que les KPIs ne restent pas figés entre deux runs GitHub Actions.
  const refresh = useCallback(async () => {
    try {
      const results = await fetchAllAxes(axesRef.current)
      const now = new Date().toISOString()
      const retours = {}
      let axesReels = 0

      await Promise.all(
        Object.entries(results).map(async ([axeId, m]) => {
          const axe = axesRef.current.find(a => a.id === axeId)
          if (!axe || m.simulated) return
          axesReels++
          const base = {
            axeId, sens: 'aller',
            nom:      `${axe.shortNom} (aller)`,
            temps_min: m.tempsLive,
            dist_km:   axe.dist,
            niveau:    m.niveau,
            vitesse:   m.vitesse,
            retard:    m.retard,
            timestamp: now,
            source:    'tomtom_live',
          }
          await setDoc(doc(db, 'mesures_live', `${axeId}_aller`), base)
          if (m.tempsRetour != null) {
            const r2 = m.tempsRetour / axe.tRef
            await setDoc(doc(db, 'mesures_live', `${axeId}_retour`), {
              axeId, sens: 'retour',
              nom:      `${axe.shortNom} (retour)`,
              temps_min: m.tempsRetour,
              dist_km:   axe.dist,
              niveau:    computeNiveau(r2),
              vitesse:   Math.round((axe.dist / m.tempsRetour) * 60 * 10) / 10,
              retard:    Math.round((m.tempsRetour - axe.tRef) * 10) / 10,
              timestamp: now,
              source:    'tomtom_live',
            })
          }
          // Mémoriser la géométrie de retour TomTom pour l'affichage du tracé retour
          if (m.geometryRetour?.length > 5) {
            retours[axeId] = m.geometryRetour
          }
        })
      )

      if (Object.keys(retours).length > 0) {
        setGeometryRetours(prev => ({ ...prev, ...retours }))
      }

      // TomTom indisponible → aucune écriture Firestore → onSnapshot ne se redéclenche pas
      // On met à jour le state local directement avec les valeurs simulées (approximations
      // basées sur l'heure et l'historique) pour que les KPIs continuent de changer.
      if (axesReels === 0) {
        const localData = {}
        axesRef.current.forEach(axe => {
          localData[axe.id] = results[axe.id] ?? simulateAxe(axe)
        })
        setMesures(localData)
        setKpis(computeKPIs(localData, axesRef.current))
        setLastUpdate(new Date())
      }
    } catch (err) {
      console.error('TomTom refresh:', err)
    }
  }, [])

  useEffect(() => {
    // Lecture temps réel Firestore
    const unsubscribe = onSnapshot(
      collection(db, 'mesures_live'),
      (snapshot) => {
        const data = buildMesures(snapshot, axesRef.current)
        setMesures(data)
        setKpis(computeKPIs(data, axesRef.current))
        setLastUpdate(new Date())
        setLoading(false)
      },
      (err) => {
        console.error('mesures_live erreur:', err)
        const sim = {}
        axesRef.current.forEach(axe => { sim[axe.id] = simulateAxe(axe) })
        setMesures(sim)
        setKpis(computeKPIs(sim, axesRef.current))
        setLoading(false)
      }
    )

    // Collecte TomTom immédiate au chargement + toutes les 2 min
    refresh()
    const interval = setInterval(refresh, REFRESH_MS)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [refresh])

  // Fusionne les géométries retour TomTom (en mémoire) avec les mesures Firestore
  const mesuresAvecRetour = useMemo(() => {
    if (Object.keys(geometryRetours).length === 0) return mesures
    const merged = { ...mesures }
    Object.entries(geometryRetours).forEach(([axeId, geom]) => {
      if (merged[axeId]) merged[axeId] = { ...merged[axeId], geometryRetour: geom }
    })
    return merged
  }, [mesures, geometryRetours])

  return { mesures: mesuresAvecRetour, kpis, loading, lastUpdate, refresh }
}
