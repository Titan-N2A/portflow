import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { DEFAULT_AXES, AXE_COLORS } from '../data/defaultData'
import { fetchAllAxes } from '../services/tomtom'

export const AXES_OFFICIELS = DEFAULT_AXES
export { AXE_COLORS }

// Cadence nominale de la collecte serveur (scripts/collecte.js, GitHub Actions).
export const REFRESH_MS = 5 * 60 * 1000

// Au-delà de ce délai sans nouvelle mesure, une donnée n'est plus considérée
// "live" : elle est exclue des KPI agrégés et signalée comme périmée dans l'UI.
export const STALE_AFTER_MS = 15 * 60 * 1000

// Seuils d'affichage à 3 paliers pour le badge de fraîcheur (plus fins que
// STALE_AFTER_MS, qui ne gouverne que l'inclusion dans les KPI agrégés).
export const FRESH_TIER_MS      = 3  * 60 * 1000 // < 3 min  → "En direct"
export const MAYBE_STALE_TIER_MS = 10 * 60 * 1000 // 3-10 min → "Peut-être obsolète" ; au-delà → "Connexion perdue"

// Classe un âge de donnée (ms) en palier de fraîcheur pour l'UI.
export function freshnessTier(ageMs) {
  if (ageMs == null) return { tier: 'none',  label: 'Aucune donnée',        color: '#95A5A6' }
  if (ageMs <= FRESH_TIER_MS)       return { tier: 'live',  label: 'En direct',            color: '#27AE60' }
  if (ageMs <= MAYBE_STALE_TIER_MS) return { tier: 'maybe', label: 'Peut-être obsolète',   color: '#E67E22' }
  return { tier: 'lost', label: 'Connexion perdue', color: '#C0392B' }
}

function computeNiveau(ratio) {
  if (!ratio) return 0
  if (ratio <= 1.10) return 1
  if (ratio <= 1.25) return 2
  if (ratio <= 1.50) return 3
  if (ratio <= 2.00) return 4
  return 5
}

// Convertit un timestamp (Firestore Timestamp | ISO string | {seconds}) en ms.
// Retourne null si absent/invalide — distinct de 0, pour ne jamais confondre
// "pas de donnée temporelle" avec une vraie date epoch.
function toMillis(ts) {
  if (!ts) return null
  if (typeof ts === 'string') {
    const t = new Date(ts).getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.seconds === 'number') return ts.seconds * 1000
  return null
}

// KPI agrégés — calculés UNIQUEMENT sur les mesures encore fraîches (!stale).
// Une mesure périmée ne doit jamais contaminer une moyenne ou faire élire
// un "tronçon critique"/"meilleur axe" sur la base d'une donnée obsolète.
function computeKPIs(mesures, axes) {
  const paires = axes
    .map(a => ({ axe: a, m: mesures[a.id] }))
    .filter(({ m }) => m && !m.stale)
  if (paires.length === 0) return null

  const vals = paires.map(({ m }) => m)
  const tempsGlobal    = vals.reduce((s, m) => s + m.tempsLive, 0) / vals.length
  const retardMoyen    = vals.reduce((s, m) => s + m.retard,    0) / vals.length
  const vitesseMoyenne = vals.reduce((s, m) => s + m.vitesse,   0) / vals.length
  const degrades  = vals.filter(m => m.niveau >= 3).length
  const pctCong   = Math.round((degrades / vals.length) * 100)

  const pireEntry = paires.reduce((best, curr) =>
    curr.m.niveau > (best?.m?.niveau ?? -1) ? curr : best, null)
  // Meilleur axe : symétrique du pire — le plus fluide parmi ceux mesurés.
  // En cas d'égalité de niveau, on départage par le ratio le plus bas.
  const meilleurEntry = paires.reduce((best, curr) => {
    if (!best) return curr
    if (curr.m.niveau !== best.m.niveau) return curr.m.niveau < best.m.niveau ? curr : best
    return curr.m.ratio < best.m.ratio ? curr : best
  }, null)

  const alertes = paires
    .map(({ axe, m }) => ({ axe, mesure: m }))
    .filter(({ mesure }) => mesure.niveau >= 3)

  return {
    tempsGlobal:     Math.round(tempsGlobal    * 10) / 10,
    retardMoyen:     Math.round(retardMoyen    * 10) / 10,
    vitesseMoyenne:  Math.round(vitesseMoyenne * 10) / 10,
    pctCong,
    tronconCritique: pireEntry
      ? { nom: `${pireEntry.axe.shortNom ?? '?'} – ${pireEntry.axe.troncons?.at(-1) ?? '?'}`, niveau: pireEntry.m.niveau }
      : null,
    meilleurAxe: meilleurEntry
      ? { nom: meilleurEntry.axe.shortNom ?? meilleurEntry.axe.nom ?? '?', niveau: meilleurEntry.m.niveau, tempsLive: meilleurEntry.m.tempsLive }
      : null,
    alertes,
  }
}

// Construit les mesures à partir d'un snapshot Firestore. Champ temporel
// canonique unique : "timestamp". Fallback temporaire sur "updatedAt" pour
// rester tolérant à d'anciens documents déjà en base (écrits par l'ancien
// collector/collecte.js, supprimé — schéma désormais unifié pour tout
// nouveau document).
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
    const tempsLive  = r.temps_min
    const timestamp  = r.timestamp ?? r.updatedAt ?? null
    if (r.sens === 'aller' || !data[r.axeId]) {
      const ratio = tempsLive / (axe.tRef ?? 20)
      data[r.axeId] = {
        tempsLive,
        niveau:    computeNiveau(ratio),   // toujours recalculé depuis tempsLive/tRef courant
        vitesse:   r.vitesse ?? 0,
        retard:    Math.round((tempsLive - (axe.tRef ?? 20)) * 10) / 10,
        ratio,
        simulated: false,
        source:    r.source ?? 'firestore',
        timestamp,
      }
    }
    if (r.sens === 'retour') {
      // Indicateurs synthétiques du retour — jusqu'ici seul tempsRetour était
      // capturé, vitesse/retard/ratio/niveau du retour étaient perdus alors
      // que le document Firestore les contient déjà (calculés côté serveur
      // par scripts/collecte.js pour cette route spécifiquement). Recalculés
      // ici (pas repris tels quels) pour refléter le tRef courant de l'axe,
      // comme pour l'aller.
      const ratioRetour = tempsLive / (axe.tRef ?? 20)
      data[r.axeId].tempsRetour   = tempsLive
      data[r.axeId].vitesseRetour = r.vitesse ?? 0
      data[r.axeId].retardRetour  = Math.round((tempsLive - (axe.tRef ?? 20)) * 10) / 10
      data[r.axeId].ratioRetour   = ratioRetour
      data[r.axeId].niveauRetour  = computeNiveau(ratioRetour)
    }
  })
  // Axes absents de Firestore → pas de simulation, ils afficheront "—"
  return data
}

// Fusionne un nouveau jeu de mesures avec l'existant, axe par axe, en ne
// gardant que la donnée la plus récente (par timestamp). Sans ça, deux
// sources concurrentes s'écrasent mutuellement selon l'ordre d'arrivée des
// événements onSnapshot plutôt que par fraîcheur réelle.
function mergeMesures(prev, incoming) {
  const merged = { ...prev }
  Object.entries(incoming).forEach(([axeId, m]) => {
    const existing    = merged[axeId]
    const existingTs  = existing ? toMillis(existing.timestamp) : null
    const incomingTs  = toMillis(m.timestamp)
    // Une mesure sans timestamp exploitable ne doit jamais évincer une
    // mesure horodatée existante (on ne peut pas prouver qu'elle est plus
    // fraîche) — elle ne s'applique que s'il n'existe rien encore.
    if (!existing) { merged[axeId] = m; return }
    if (incomingTs == null) return
    if (existingTs == null || incomingTs >= existingTs) merged[axeId] = m
  })
  return merged
}

// Marque périmées (stale: true) les mesures plus vieilles que STALE_AFTER_MS,
// et purge celles dont l'axe n'existe plus dans la liste courante — sans ça,
// un axe supprimé/renommé dans l'admin resterait affiché indéfiniment avec
// sa dernière valeur connue.
function markStaleAndPurge(mesures, axes, now) {
  const validIds = new Set(axes.map(a => a.id))
  const out = {}
  Object.entries(mesures).forEach(([axeId, m]) => {
    if (!validIds.has(axeId)) return // purge : axe disparu de la config courante
    const ts    = toMillis(m.timestamp)
    const ageMs = ts != null ? now - ts : Infinity
    out[axeId] = { ...m, stale: ageMs > STALE_AFTER_MS, ageMs }
  })
  return out
}

export function useTrafficData(axes = DEFAULT_AXES) {
  const [mesures,         setMesures]         = useState({})
  const [geometryRetours, setGeometryRetours] = useState({})
  const [kpis,            setKpis]            = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [lastUpdate,      setLastUpdate]      = useState(null) // horodatage RÉEL de la donnée la plus fraîche, pas l'heure d'arrivée du snapshot
  const [refreshing,      setRefreshing]      = useState(false)
  const [dataHealth,      setDataHealth]      = useState({
    source: null, freshCount: 0, staleCount: 0, lastTimestamp: null,
    reason: 'en attente de données', ...freshnessTier(null),
  })

  const axesRef      = useRef(axes)
  const mesuresSnap  = useRef({})
  const lastSourceRef = useRef(null)

  useEffect(() => { axesRef.current = axes }, [axes])
  // mesuresSnap est tenue à jour de façon synchrone dans applyMesures() —
  // pas d'effet séparé ici, pour éviter toute fenêtre où la ref retarde
  // sur l'état réellement appliqué (voir commentaire dans applyMesures).

  // Point d'entrée unique pour toute mise à jour de "mesures" : applique la
  // péremption + purge, recalcule KPI et lastUpdate à partir de l'horodatage
  // réel des données, et journalise un état de santé exploitable (traçabilité).
  // sourceLabel=null → simple réévaluation périodique de la péremption, sans
  // nouvelle donnée reçue (on garde la dernière source connue).
  const applyMesures = useCallback((raw, sourceLabel) => {
    if (sourceLabel) lastSourceRef.current = sourceLabel
    const now     = Date.now()
    const evalued = markStaleAndPurge(raw, axesRef.current, now)

    // Mise à jour synchrone de la référence, AVANT tout setState : deux
    // onSnapshot (mesures_live, collecte_auto) peuvent se déclencher dans le
    // même tick, avant que React n'ait eu la chance de committer le rendu
    // précédent et de synchroniser la ref via un effet — sans ça, le second
    // événement fusionnerait contre un état obsolète (voire vide au premier
    // chargement), laissant une source plus ancienne écraser à tort la plus
    // fraîche déjà appliquée.
    mesuresSnap.current = evalued

    setMesures(evalued)
    setKpis(computeKPIs(evalued, axesRef.current))

    const entries     = Object.values(evalued)
    const freshEntries = entries.filter(m => !m.stale)
    const staleEntries = entries.filter(m => m.stale)
    // lastUpdate reflète le timestamp le plus récent connu, fraîche OU
    // périmée — sinon, quand tout devient périmé (freshCount=0), on perdrait
    // la trace de "il y a combien de temps" et afficherait à tort "aucune
    // donnée" au lieu de "connexion perdue depuis X min".
    const allTimestamps  = entries.map(m => toMillis(m.timestamp)).filter(t => t != null)
    const realLastUpdate = allTimestamps.length ? new Date(Math.max(...allTimestamps)) : null

    setLastUpdate(realLastUpdate)
    const ageOfLastUpdate = realLastUpdate ? now - realLastUpdate.getTime() : null
    const health = {
      source:        lastSourceRef.current,
      freshCount:    freshEntries.length,
      staleCount:    staleEntries.length,
      lastTimestamp: realLastUpdate,
      ...freshnessTier(ageOfLastUpdate),
      reason: freshEntries.length === 0
        ? (entries.length === 0 ? 'aucune mesure reçue' : 'toutes les mesures dépassent le seuil de péremption')
        : null,
    }
    setDataHealth(health)
    console.debug(
      `[useTrafficData] source=${health.source ?? '—'} frais=${health.freshCount} périmés=${health.staleCount} ` +
      `dernière donnée=${realLastUpdate ? realLastUpdate.toISOString() : '—'}${health.reason ? ` (${health.reason})` : ''}`
    )
    setLoading(false)
  }, [])

  // Quand les axes changent (modification Admin → tRef, etc.), recalcule
  // immédiatement niveau/ratio/retard sans attendre le prochain snapshot.
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
        ...(m.tempsRetour != null ? {
          ratioRetour:  Math.round(m.tempsRetour / tRef * 100) / 100,
          niveauRetour: computeNiveau(m.tempsRetour / tRef),
          retardRetour: Math.round((m.tempsRetour - tRef) * 10) / 10,
        } : {}),
      }
    })
    if (Object.keys(updated).length > 0) applyMesures(updated, null)
  }, [axes, applyMesures])

  // Rafraîchissement MANUEL uniquement (bouton "Actualiser", jamais de
  // setInterval automatique) — persiste dans mesures_live, partagé par tous
  // les visiteurs. Sert de filet de secours quand scripts/collecte.js
  // (GitHub Actions, cadence non garantie) prend du retard : un présentateur
  // peut forcer une donnée fraîche visible de tous en un clic, sans faire
  // concurrence à la collecte serveur au fil de l'eau (pas d'auto-poll).
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const results = await fetchAllAxes(axesRef.current)
      const now      = new Date().toISOString()
      const retours  = {}
      const localData = {}

      await Promise.all(Object.entries(results).map(async ([axeId, m]) => {
        const axe = axesRef.current.find(a => a.id === axeId)
        if (!axe || m.simulated) return
        const distKm = parseFloat(axe.dist ?? axe.distance) || 0

        await setDoc(doc(db, 'mesures_live', `${axeId}_aller`), {
          axeId, sens: 'aller', nom: `${axe.shortNom} (aller)`,
          temps_min: m.tempsLive, dist_km: distKm,
          niveau: m.niveau, vitesse: m.vitesse, retard: m.retard,
          timestamp: now, source: 'client_manuel',
        })
        let retourFields = {}
        if (m.tempsRetour != null) {
          const r2 = m.tempsRetour / axe.tRef
          const vitesseRetour = distKm > 0 ? Math.round((distKm / m.tempsRetour) * 60 * 10) / 10 : 0
          const retardRetour  = Math.round((m.tempsRetour - axe.tRef) * 10) / 10
          await setDoc(doc(db, 'mesures_live', `${axeId}_retour`), {
            axeId, sens: 'retour', nom: `${axe.shortNom} (retour)`,
            temps_min: m.tempsRetour, dist_km: distKm,
            niveau: computeNiveau(r2), vitesse: vitesseRetour, retard: retardRetour,
            timestamp: now, source: 'client_manuel',
          })
          retourFields = { vitesseRetour, retardRetour, ratioRetour: r2, niveauRetour: computeNiveau(r2) }
        }

        localData[axeId] = {
          tempsLive:   m.tempsLive,
          niveau:      m.niveau,
          vitesse:     m.vitesse,
          retard:      m.retard,
          ratio:       m.ratio,
          simulated:   false,
          source:      'client_manuel',
          timestamp:   now,
          tempsRetour: m.tempsRetour,
          ...retourFields,
        }
        if (m.geometryRetour?.length > 5) retours[axeId] = m.geometryRetour
      }))

      if (Object.keys(retours).length > 0) {
        setGeometryRetours(prev => ({ ...prev, ...retours }))
      }
      if (Object.keys(localData).length > 0) {
        const merged = mergeMesures(mesuresSnap.current, localData)
        applyMesures(merged, 'client_manuel')
      }
    } catch (err) {
      console.error('Rafraîchissement manuel :', err)
    } finally {
      setRefreshing(false)
    }
  }, [applyMesures])

  // Lecture seule de mesures_live — écrit exclusivement par scripts/collecte.js
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'mesures_live'),
      (snapshot) => {
        const data   = buildMesures(snapshot, axesRef.current)
        const merged = mergeMesures(mesuresSnap.current, data)
        applyMesures(merged, 'mesures_live')
      },
      (err) => {
        console.error('mesures_live erreur:', err)
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [applyMesures])

  // Écoute collecte_auto — archive historique écrite par GitHub Actions,
  // sert de filet de secours si mesures_live n'a pas été mis à jour.
  useEffect(() => {
    const q = query(
      collection(db, 'collecte_auto'),
      orderBy('timestamp', 'desc'),
      limit(30)
    )

    const unsubCollecte = onSnapshot(q, (snap) => {
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
        applyMesures(merged, 'collecte_auto')
      }
    }, err => console.error('collecte_auto → dashboard:', err))

    return () => unsubCollecte()
  }, [applyMesures])

  // Réévalue la péremption périodiquement même sans nouvelle donnée : une
  // mesure fraîche à l'instant T peut devenir périmée sans qu'aucun
  // onSnapshot ne se déclenche (Firestore ne notifie que sur changement).
  useEffect(() => {
    const t = setInterval(() => {
      if (Object.keys(mesuresSnap.current).length > 0) applyMesures(mesuresSnap.current, null)
    }, 30 * 1000)
    return () => clearInterval(t)
  }, [applyMesures])

  const mesuresAvecRetour = useMemo(() => {
    if (Object.keys(geometryRetours).length === 0) return mesures
    const merged = { ...mesures }
    Object.entries(geometryRetours).forEach(([axeId, geom]) => {
      if (merged[axeId]) merged[axeId] = { ...merged[axeId], geometryRetour: geom }
    })
    return merged
  }, [mesures, geometryRetours])

  return { mesures: mesuresAvecRetour, kpis, loading, lastUpdate, refresh, refreshing, dataHealth }
}
