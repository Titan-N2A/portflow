import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { collection, onSnapshot, doc, setDoc, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../services/firebase'
import { DEFAULT_AXES, AXE_COLORS } from '../data/defaultData'
import { fetchAllAxes } from '../services/tomtom'

export const AXES_OFFICIELS = DEFAULT_AXES
export { AXE_COLORS }

export const REFRESH_MS = 2 * 60 * 1000 // 2 minutes

function computeNiveau(ratio) {
  if (!ratio) return 0
  if (ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}


function computeKPIs(mesures, axes) {
  const vals = axes.map(a => mesures[a.id]).filter(Boolean)
  if (vals.length === 0) return null
  const tempsGlobal    = vals.reduce((s, m) => s + m.tempsLive, 0) / vals.length
  const retardMoyen    = vals.reduce((s, m) => s + m.retard,    0) / vals.length
  const vitesseMoyenne = vals.reduce((s, m) => s + m.vitesse,   0) / vals.length
  const degrades  = vals.filter(m => m.niveau >= 3).length
  const pctCong   = Math.round((degrades / vals.length) * 100)
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
  const raw = []
  snapshot.forEach(d => raw.push(d.data()))
  // 'aller' doit toujours être traité avant 'retour' — sans ça, un document
  // 'retour' reçu en premier (ordre Firestore non garanti sans orderBy)
  // écraserait la mesure principale de l'axe avec la donnée de retour.
  const ordered = [...raw].sort((a, b) => (a.sens === 'aller' ? -1 : b.sens === 'aller' ? 1 : 0))

  const data = {}
  ordered.forEach(r => {
    if (!r.axeId || !r.temps_min) return
    const axe = axes.find(a => a.id === r.axeId)
    if (!axe) return
    const tempsLive = r.temps_min
    if (r.sens === 'aller' || !data[r.axeId]) {
      const ratio = tempsLive / (axe.tRef ?? 20)
      data[r.axeId] = {
        tempsLive,
        niveau:    computeNiveau(ratio),   // toujours recalculé depuis tempsLive/tRef courant
        vitesse:   r.vitesse ?? 0,
        retard:    Math.round((tempsLive - (axe.tRef ?? 20)) * 10) / 10,
        ratio,
        simulated: false,
        source:    r.source  ?? 'firestore',
        updatedAt: r.timestamp ?? null,
      }
    }
    if (r.sens === 'retour') {
      data[r.axeId].tempsRetour = tempsLive
    }
  })
  // Axes absents de Firestore → pas de simulation, ils afficheront "—"
  return data
}

// Convertit un timestamp Firestore (Timestamp | ISO string | {seconds}) en ms
function toMillis(ts) {
  if (!ts) return 0
  if (typeof ts === 'string') return new Date(ts).getTime()
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return 0
}

// Fusionne un nouveau jeu de mesures avec l'existant, axe par axe, en ne
// gardant que la donnée la plus récente (par updatedAt). Sans ça, deux
// sources concurrentes (mesures_live écrit par le navigateur toutes les
// 2 min si TomTom répond, collecte_auto écrit par GitHub Actions toutes
// les 10 min de façon fiable) s'écrasent mutuellement selon l'ordre
// d'arrivée des événements onSnapshot plutôt que par fraîcheur réelle —
// c'est ce qui pouvait donner des KPIs figés sur une ancienne valeur.
function mergeMesures(prev, incoming) {
  const merged = { ...prev }
  Object.entries(incoming).forEach(([axeId, m]) => {
    const existing = merged[axeId]
    if (!existing || toMillis(m.updatedAt) >= toMillis(existing.updatedAt)) {
      merged[axeId] = m
    }
  })
  return merged
}

export function useTrafficData(axes = DEFAULT_AXES) {
  const [mesures,         setMesures]         = useState({})
  const [geometryRetours, setGeometryRetours] = useState({})
  const [kpis,            setKpis]            = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [lastUpdate,      setLastUpdate]      = useState(null)
  const [refreshing,      setRefreshing]      = useState(false)

  const axesRef     = useRef(axes)
  const mesuresSnap = useRef({})

  useEffect(() => { axesRef.current = axes }, [axes])
  useEffect(() => { mesuresSnap.current = mesures }, [mesures])

  // Quand les axes changent (modification Admin → tRef, etc.),
  // recalcule immédiatement niveau/ratio/retard sans attendre le prochain snapshot
  useEffect(() => {
    const prev = mesuresSnap.current
    if (!axes.length || !Object.keys(prev).length) return
    const updated = {}
    axes.forEach(axe => {
      const m = prev[axe.id]
      if (!m) return
      const tRef = axe.tRef ?? 20
      updated[axe.id] = {
        ...m,
        ratio:  Math.round(m.tempsLive / tRef * 100) / 100,
        niveau: computeNiveau(m.tempsLive / tRef),
        retard: Math.round((m.tempsLive - tRef) * 10) / 10,
      }
    })
    if (Object.keys(updated).length > 0) {
      setMesures(updated)
      setKpis(computeKPIs(updated, axes))
    }
  }, [axes])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const results = await fetchAllAxes(axesRef.current)
      const now     = new Date().toISOString()
      const retours = {}
      let axesReels = 0

      await Promise.all(
        Object.entries(results).map(async ([axeId, m]) => {
          const axe = axesRef.current.find(a => a.id === axeId)
          if (!axe || m.simulated) return
          axesReels++
          // distance peut être '12.4 km' (string) ou un number — on extrait le nombre
          const distKm = parseFloat(axe.dist ?? axe.distance) || 0
          await setDoc(doc(db, 'mesures_live', `${axeId}_aller`), {
            axeId, sens: 'aller',
            nom:       `${axe.shortNom} (aller)`,
            temps_min: m.tempsLive,
            dist_km:   distKm,
            niveau:    m.niveau,
            vitesse:   m.vitesse,
            retard:    m.retard,
            timestamp: now,
            source:    'tomtom_live',
          })
          if (m.tempsRetour != null) {
            const r2 = m.tempsRetour / axe.tRef
            await setDoc(doc(db, 'mesures_live', `${axeId}_retour`), {
              axeId, sens: 'retour',
              nom:       `${axe.shortNom} (retour)`,
              temps_min: m.tempsRetour,
              dist_km:   distKm,
              niveau:    computeNiveau(r2),
              vitesse:   distKm > 0 ? Math.round((distKm / m.tempsRetour) * 60 * 10) / 10 : 0,
              retard:    Math.round((m.tempsRetour - axe.tRef) * 10) / 10,
              timestamp: now,
              source:    'tomtom_live',
            })
          }
          if (m.geometryRetour?.length > 5) retours[axeId] = m.geometryRetour
        })
      )

      if (Object.keys(retours).length > 0) {
        setGeometryRetours(prev => ({ ...prev, ...retours }))
      }

      // TomTom indisponible → on garde les données Firestore (onSnapshot),
      // pas de simulation — les valeurs viennent de GitHub Actions (toutes les 10 min)
    } catch (err) {
      console.error('TomTom refresh:', err)
      // Ne pas écraser les données Firestore avec une simulation
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'mesures_live'),
      (snapshot) => {
        const data   = buildMesures(snapshot, axesRef.current)
        const merged = mergeMesures(mesuresSnap.current, data)
        setMesures(merged)
        setKpis(computeKPIs(merged, axesRef.current))
        setLastUpdate(new Date())
        setLoading(false)
      },
      (err) => {
        console.error('mesures_live erreur:', err)
        setLoading(false)
      }
    )

    refresh()
    const interval = setInterval(refresh, REFRESH_MS)

    return () => { unsubscribe(); clearInterval(interval) }
  }, [refresh])

  // Écoute collecte_auto pour mettre à jour les KPIs quand GitHub Actions tourne
  useEffect(() => {
    const q = query(
      collection(db, 'collecte_auto'),
      orderBy('timestamp', 'desc'),
      limit(30)
    )

    const unsubCollecte = onSnapshot(q, (snap) => {
      // Extrait la mesure la plus récente par (axeId, sens)
      const latest = {}
      snap.docs.forEach(d => {
        const r = d.data()
        if (!r.axeId || !r.sens || !r.temps_min) return
        const key = `${r.axeId}_${r.sens}`
        if (!latest[key]) latest[key] = r  // desc → premier = plus récent
      })

      const data = buildMesures(
        { forEach: cb => Object.values(latest).forEach(r => cb({ data: () => r })) },
        axesRef.current
      )

      if (Object.keys(data).length > 0) {
        const merged = mergeMesures(mesuresSnap.current, data)
        setMesures(merged)
        setKpis(computeKPIs(merged, axesRef.current))
        setLastUpdate(new Date())
        setLoading(false)
      }
    }, err => console.error('collecte_auto → dashboard:', err))

    return () => unsubCollecte()
  }, [])

  const mesuresAvecRetour = useMemo(() => {
    if (Object.keys(geometryRetours).length === 0) return mesures
    const merged = { ...mesures }
    Object.entries(geometryRetours).forEach(([axeId, geom]) => {
      if (merged[axeId]) merged[axeId] = { ...merged[axeId], geometryRetour: geom }
    })
    return merged
  }, [mesures, geometryRetours])

  return { mesures: mesuresAvecRetour, kpis, loading, lastUpdate, refresh, refreshing }
}
