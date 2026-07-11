import { useState, useEffect, useMemo } from 'react'
import { Download, FileSpreadsheet, Database, Calendar, RefreshCw } from 'lucide-react'
import { C, levelLabel } from '../styles/tokens'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer } from 'firebase/firestore'
import { db } from '../services/firebase'
import { AXES_OFFICIELS, useTrafficData } from '../hooks/useTrafficData'
import { useHistoricalData } from '../hooks/useHistoricalData'

const PERIODES = [
  { id: 'today',  label: "Aujourd'hui" },
  { id: 'week',   label: 'Cette semaine' },
  { id: 'month',  label: 'Ce mois' },
  { id: 'year',   label: 'Cette année' },
  { id: 'all',    label: 'Toutes les données' },
]

function getPeriodBounds(periodeId) {
  const now   = new Date()
  const start = new Date()
  switch (periodeId) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      break
    case 'week':
      start.setDate(now.getDate() - now.getDay())
      start.setHours(0, 0, 0, 0)
      break
    case 'month':
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      break
    case 'year':
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
    case 'all':
    default:
      start.setFullYear(2020, 0, 1)
  }
  return { start, end: now }
}

// d.I1/I2/I3/I5/I7 = ancien schéma d'indicateurs (indicators.js, supprimé) —
// les documents collecte_auto réels (scripts/collecte.js) n'ont jamais eu
// ces champs, seulement temps_min/niveau/vitesse/retard. T_ref n'est écrit
// sur aucun document (ce n'est pas une mesure, c'est une propriété de
// l'axe) : on le résout depuis AXES_OFFICIELS par axeId, comme le fait déjà
// buildHistoRows() plus bas.
function toExportRow(d) {
  const ts  = d.timestamp?.toDate?.() ?? new Date(d.timestamp ?? 0)
  const axe = AXES_OFFICIELS.find(a => a.id === d.axeId)
  const niveau = d.niveau ?? d.I7 ?? 0
  return {
    Date:            ts.toLocaleDateString('fr-FR'),
    Heure:           ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    Axe:             axe?.shortNom ?? d.nom ?? d.axeId ?? '—',
    Sens:            d.sens ?? 'aller',
    'T_ref (min)':   axe?.tRef ?? d.tRef ?? d.I2 ?? '—',
    'T_live (min)':  d.temps_min ?? d.I1 ?? '—',
    'Retard (min)':  d.retard ?? d.I3 ?? '—',
    Niveau:          niveau || '—',
    'Label niveau':  levelLabel(niveau),
    'Vitesse (km/h)': d.vitesse ?? d.I5 ?? '—',
    Source:          d.source ?? 'GitHub Actions / TomTom',
  }
}

// Timestamp en ms, quel que soit le type Firestore (Timestamp | ISO string)
function tsToMillis(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts === 'string') return new Date(ts).getTime()
  return 0
}

function buildLiveRows(mesures) {
  const now = new Date()
  return AXES_OFFICIELS.flatMap(axe => {
    const m = mesures[axe.id]
    if (!m) return []
    return [{
      Date:            now.toLocaleDateString('fr-FR'),
      Heure:           now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      Axe:             axe.shortNom,
      Sens:            'aller',
      'T_ref (min)':   axe.tRef,
      'T_live (min)':  m.tempsLive,
      'Retard (min)':  m.retard,
      Niveau:          m.niveau,
      'Label niveau':  levelLabel(m.niveau),
      'Vitesse (km/h)': m.vitesse,
      Source:          m.simulated ? 'simulation' : 'TomTom live',
    }]
  })
}

function buildHistoRows(data, axeFilter) {
  return data
    .filter(d => axeFilter === 'tous' || d.axeId === axeFilter)
    // Pas de timestamp unifié sur ce dataset (date + heure séparées), et la
    // requête Firestore ne trie pas (getDocs sans orderBy dans
    // useHistoricalData) — l'ordre par défaut n'est pas garanti chronologique.
    .sort((a, b) => `${b.date}T${String(b.heure).padStart(2, '0')}` .localeCompare(`${a.date}T${String(a.heure).padStart(2, '0')}`))
    .map(d => {
      const axe     = AXES_OFFICIELS.find(a => a.id === d.axeId)
      const retard  = axe ? Math.round((d.temps_min - axe.tRef) * 10) / 10 : null
      const vitesse = axe?.dist ? Math.round((axe.dist / d.temps_min) * 60 * 10) / 10 : null
      return {
        Date:            d.date,
        Heure:           `${d.heure}h00`,
        Axe:             axe?.shortNom ?? d.axeId,
        Sens:            d.sens,
        'T_ref (min)':   axe?.tRef ?? '—',
        'T_live (min)':  d.temps_min,
        'Retard (min)':  retard ?? '—',
        Niveau:          '—',
        'Label niveau':  '—',
        'Vitesse (km/h)': vitesse ?? '—',
        Source:          'Historique fév. 2025',
      }
    })
}

function downloadRows(rows, format, fname) {
  if (!rows.length) { alert('Aucune donnée pour cette sélection.'); return }
  if (format === 'csv') {
    const csv  = Papa.unparse(rows)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${fname}.csv`; a.click()
    URL.revokeObjectURL(url)
  } else {
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Trafic PAA')
    XLSX.writeFile(wb, `${fname}.xlsx`)
  }
}

// Deux modes d'export (au choix de l'utilisateur) :
//  • Résumé quotidien (defaut) → agregats_quotidiens (~6 docs/jour, 30 j max) :
//    un export mensuel = ~180 lectures. Léger, tient le plan gratuit (50 k/j).
//  • Toutes les données → collecte_auto : tous les relevés bruts de la période
//    (peut atteindre ~14 500 docs sur un mois → lourd en lecture).

// Date de début (YYYY-MM-DD) pour filtrer agregats_quotidiens sur `date`
function debutPeriodeISO(periodeId) {
  return getPeriodBounds(periodeId).start.toISOString().slice(0, 10)
}

// ── Comptage léger (agrégation serveur) ──────────────────────
// getCountFromServer = 1 lecture facturée, sans index composite (filtre
// mono-champ). On compte la collection réellement exportée selon le mode.
// (Avant : un onSnapshot(limit 60000) lisait toute la collection juste pour
// un compteur et restait figé sur 0 après un 429 → quota cramé.)
function usePeriodCount(periodeId, resume, enabled) {
  const [count,   setCount]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)
  const [tick,    setTick]    = useState(0)

  useEffect(() => {
    if (!enabled) { setCount(null); setError(false); return }
    let annule = false
    setLoading(true); setError(false)
    const q = resume
      ? query(collection(db, 'agregats_quotidiens'), where('date',      '>=', debutPeriodeISO(periodeId)))
      : query(collection(db, 'collecte_auto'),       where('timestamp', '>=', getPeriodBounds(periodeId).start))
    getCountFromServer(q)
      .then(snap => { if (!annule) { setCount(snap.data().count); setLoading(false) } })
      .catch(err => {
        console.error('count période:', err)
        if (!annule) { setError(true); setCount(null); setLoading(false) }
      })
    return () => { annule = true }
  }, [periodeId, resume, enabled, tick])

  return { count, loading, error, reload: () => setTick(t => t + 1) }
}

// Lecture des relevés bruts (à la demande). Le SDK Firestore plafonne
// limit() à 10 000 : on pagine donc par tranches de 10 000 via startAfter,
// ce qui couvre n'importe quel volume (aujourd'hui → tout) sans dépasser
// cette limite. (garde-fou : PAGES_MAX pour éviter tout emballement.)
const PAGE_MAX   = 10000
const PAGES_MAX  = 30   // 300 000 relevés max — largement au-dessus du besoin

async function fetchCollecteRows(periodeId, axeFilter) {
  const { start } = getPeriodBounds(periodeId)
  const docs = []
  let curseur = null
  for (let p = 0; p < PAGES_MAX; p++) {
    const contraintes = [
      where('timestamp', '>=', start),
      orderBy('timestamp', 'desc'),
      ...(curseur ? [startAfter(curseur)] : []),
      limit(PAGE_MAX),
    ]
    const snap = await getDocs(query(collection(db, 'collecte_auto'), ...contraintes))
    docs.push(...snap.docs)
    if (snap.size < PAGE_MAX) break
    curseur = snap.docs[snap.docs.length - 1]
  }
  return docs
    .map(d => d.data())
    .filter(d => axeFilter === 'tous' || d.axeId === axeFilter)
    .sort((a, b) => tsToMillis(b.timestamp) - tsToMillis(a.timestamp))
    .map(toExportRow)
}

// Résume une liste de relevés bruts en 1 objet par axe × sens (min/moy/max
// + répartition des niveaux) — même logique que scripts/agreger_quotidien.js.
// Sert à calculer le jour courant, jamais présent dans agregats_quotidiens
// (l'agrégation ne tourne que la nuit).
function resumerReleves(docs, date) {
  const groupes = new Map()
  docs.forEach(r => {
    if (!r.axeId || !r.sens || !(Number(r.temps_min) > 0)) return
    const cle = `${r.axeId}_${r.sens}`
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle).push(Number(r.temps_min))
    const n = Math.min(5, Math.max(1, Number(r.niveau) || 1))
    groupes.get(cle).niveaux = groupes.get(cle).niveaux ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    groupes.get(cle).niveaux[n]++
  })
  const out = []
  for (const [cle, temps] of groupes) {
    const [axeId, sens] = cle.split('_')
    out.push({
      date, axeId, sens, n: temps.length,
      min: Math.round(Math.min(...temps) * 10) / 10,
      moy: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 10) / 10,
      max: Math.round(Math.max(...temps) * 10) / 10,
      niveaux: temps.niveaux,
    })
  }
  return out
}

// Transforme un objet résumé (agrégat ou jour courant calculé) en ligne d'export
function toResumeRow(a) {
  const axe = AXES_OFFICIELS.find(x => x.id === a.axeId)
  const nv  = a.niveaux ?? {}
  const num = v => (Number(v) || 0)
  return {
    Date:                 a.date,
    Axe:                  axe?.shortNom ?? a.axeId,
    Sens:                 a.sens,
    'Mesures (n)':        a.n ?? '—',
    'T_ref (min)':        axe?.tRef ?? '—',
    'Min (min)':          a.min ?? '—',
    'Moyenne (min)':      a.moy ?? '—',
    'Max (min)':          a.max ?? '—',
    'Retard moy (min)':   (axe?.tRef != null && a.moy != null) ? Math.round((a.moy - axe.tRef) * 10) / 10 : '—',
    'Fluide (N1-2)':      num(nv[1]) + num(nv[2]),
    'Modéré (N3)':        num(nv[3]),
    'Dense (N4)':         num(nv[4]),
    'Congestionné (N5)':  num(nv[5]),
    Source:               'Résumé quotidien',
  }
}

// Lecture du résumé quotidien (à la demande) : jours révolus depuis
// agregats_quotidiens (~6 docs/jour) + jour courant calculé depuis les
// relevés bruts (agrégation nocturne pas encore passée). Filtre par axe
// côté client (pas d'index composite). Couvre donc TOUTES les divisions,
// aujourd'hui compris.
async function fetchAgregatRows(periodeId, axeFilter) {
  const depuis     = debutPeriodeISO(periodeId)
  const aujourdHui = new Date().toISOString().slice(0, 10)

  // 1. Jours complets déjà agrégés (aujourd'hui exclu par sûreté)
  const snapAgg = await getDocs(query(
    collection(db, 'agregats_quotidiens'),
    where('date', '>=', depuis),
  ))
  const resumes = snapAgg.docs.map(d => d.data()).filter(a => a.date !== aujourdHui)

  // 2. Jour courant : résumé calculé depuis les relevés bruts du jour
  if (aujourdHui >= depuis) {
    const snapJour = await getDocs(query(
      collection(db, 'collecte_auto'),
      where('date', '==', aujourdHui),
    ))
    resumes.push(...resumerReleves(snapJour.docs.map(d => d.data()), aujourdHui))
  }

  return resumes
    .filter(a => axeFilter === 'tous' || a.axeId === axeFilter)
    .sort((a, b) => `${b.date}_${b.axeId}_${b.sens}`.localeCompare(`${a.date}_${a.axeId}_${a.sens}`))
    .map(toResumeRow)
}

// Route la lecture selon le mode choisi
function fetchExportRows(periodeId, resume, axeFilter) {
  return resume
    ? fetchAgregatRows(periodeId, axeFilter)
    : fetchCollecteRows(periodeId, axeFilter)
}

function ExportPage() {
  const { mesures } = useTrafficData()
  const { data: histoData, loading: histoLoading } = useHistoricalData()

  const [source,  setSource]  = useState('collecte')  // 'collecte' | 'live' | 'historique'
  const [periode, setPeriode] = useState('month')
  const [detail,  setDetail]  = useState('resume')    // 'resume' | 'brut'
  const [axe,     setAxe]     = useState('tous')
  const [format,  setFormat]  = useState('excel')
  const [exporting, setExporting] = useState(false)
  const [showApercu, setShowApercu] = useState(false)

  // Résumé quotidien (léger) ou relevés bruts (toutes les données)
  const resume = source === 'collecte' && detail === 'resume'

  const { count, loading: loadingCount, error: countError, reload: reloadCount } =
    usePeriodCount(periode, resume, source === 'collecte')

  // Docs chargés à la demande (null = pas encore lus). Remis à zéro dès
  // qu'un paramètre change → jamais de données périmées.
  const [collecteRows, setCollecteRows] = useState(null)
  const [loadingRows,  setLoadingRows]  = useState(false)
  useEffect(() => { setCollecteRows(null); setShowApercu(false) }, [source, periode, detail, axe])

  // Lignes d'export. Pour la collecte, les docs ne sont lus qu'à la première
  // action explicite (aperçu ou téléchargement), puis gardés en cache.
  const rowsExport = useMemo(() => {
    if (source === 'live') {
      return buildLiveRows(mesures).filter(r => axe === 'tous' || AXES_OFFICIELS.find(a => a.shortNom === r.Axe)?.id === axe)
    }
    if (source === 'historique') return buildHistoRows(histoData, axe)
    return collecteRows ?? []
  }, [source, mesures, histoData, collecteRows, axe])

  // Charge (et met en cache) les lignes d'export pour les paramètres courants.
  async function ensureCollecteRows() {
    if (collecteRows) return collecteRows
    setLoadingRows(true)
    try {
      const rows = await fetchExportRows(periode, resume, axe)
      setCollecteRows(rows)
      return rows
    } catch (err) {
      console.error('lecture export:', err)
      // Message selon le vrai code d'erreur Firestore (ne plus masquer la cause)
      const code = err?.code || ''
      let msg
      if (code === 'resource-exhausted')
        msg = 'Quota de lecture Firestore atteint pour aujourd’hui (plan gratuit : 50 000 lectures/jour). Réessayez après le reset (~07:00 UTC) ou utilisez le mode « Résumé quotidien ».'
      else if (code === 'permission-denied')
        msg = 'Lecture refusée par les règles de sécurité Firestore (permission-denied).'
      else if (code === 'unavailable')
        msg = 'Service Firestore indisponible / connexion interrompue (unavailable). Vérifiez le réseau (ou un bloqueur de pub/anti-traçage) puis réessayez.'
      else if (code === 'failed-precondition')
        msg = 'Index Firestore manquant (failed-precondition) — voir la console (F12) pour le lien de création.'
      else
        msg = `Lecture impossible : ${code || err?.message || 'erreur inconnue'}. Ouvrez la console (F12) pour le détail.`
      alert(msg)
      return null   // null = échec (à distinguer d’un résultat vide légitime)
    } finally {
      setLoadingRows(false)
    }
  }

  async function telecharger() {
    setExporting(true)
    try {
      const rows  = source === 'collecte' ? await ensureCollecteRows() : rowsExport
      if (rows === null) return   // échec déjà signalé — pas de « Aucune donnée » trompeur
      const suffixe = source === 'collecte' && resume ? 'resume' : source
      const fname = `FlowPort_${suffixe}_${axe}_${periode}_${new Date().toISOString().slice(0, 10)}`
      downloadRows(rows, format, fname)
    } finally {
      setExporting(false)
    }
  }

  async function toggleApercu() {
    if (source === 'collecte' && !collecteRows) await ensureCollecteRows()
    setShowApercu(v => !v)
  }

  const isLoading = source === 'collecte'
    ? (loadingCount || loadingRows)
    : (source === 'historique' ? histoLoading : false)

  // Aperçu disponible dès qu'il y a des lignes potentielles à montrer.
  // En résumé, le jour courant (calculé à la volée) n'entre pas dans `count`
  // (agrégats), donc on autorise toujours l'aperçu dans ce mode.
  const apercuDispo = source === 'collecte'
    ? (resume || (count ?? 0) > 0 || (collecteRows?.length ?? 0) > 0)
    : rowsExport.length > 0

  const previewLabel = useMemo(() => {
    if (source === 'live')       return `${AXES_OFFICIELS.length} mesures (snapshot actuel)`
    if (source === 'historique') return `${histoData.filter(d => axe === 'tous' || d.axeId === axe).length} mesures (fév. 2025)`
    const unite = resume ? 'ligne(s) de résumé' : 'relevé(s)'
    if (loadingRows)  return 'Lecture des données…'
    if (collecteRows) return `${collecteRows.length} ${unite} prêt(es) à l'export`
    if (loadingCount) return 'Comptage…'
    // En résumé, `count` (agrégats) exclut le jour courant → ne pas afficher 0
    if (resume && (count ?? 0) === 0) return 'Résumé du jour en cours prêt à l\'export'
    if (countError)   return 'Comptage indisponible — cliquez pour réessayer'
    if (count === null) return '—'
    const filtre = axe === 'tous' ? '' : ` (axe « ${AXES_OFFICIELS.find(a => a.id === axe)?.shortNom ?? axe} » filtré à l'export)`
    return resume
      ? `${count} ${unite} sur la période${filtre}`
      : `${count} relevé(s) sur la période${filtre}`
  }, [source, histoData, axe, resume, loadingRows, collecteRows, loadingCount, countError, count])

  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '620px' }}>

        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Export de données</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Téléchargez les mesures PAA au format CSV ou Excel</p>
        </div>

        <div className="fp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ width: 38, height: 38, borderRadius: '9px', background: '#EBF2FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={18} color={C.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Paramètres d'export</p>
              <p style={{ fontSize: 11, color: C.textMuted }}>Choisissez la source, la période et le format</p>
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="fp-label">Source de données</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                ['collecte', 'Collecte auto', Database],
                ['live',     'Snapshot live',  RefreshCw],
                ['historique','Historique fév. 2025', Calendar],
              ].map(([val, lbl, Icon]) => (
                <button key={val} onClick={() => setSource(val)} style={{
                  flex: 1, padding: '0.5rem 0.4rem', fontSize: 11,
                  fontFamily: "'Inter', sans-serif",
                  borderRadius: '8px', cursor: 'pointer',
                  fontWeight: source === val ? 700 : 400,
                  background: source === val ? C.primary : '#f8fafc',
                  color: source === val ? '#fff' : C.text,
                  border: `1px solid ${source === val ? C.primary : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  <Icon size={11} /> {lbl}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
              {source === 'collecte' && 'Données collectées automatiquement par GitHub Actions (toutes les 5 min) depuis le déploiement.'}
              {source === 'live' && 'Snapshot TomTom de l\'instant présent — 3 mesures.'}
              {source === 'historique' && '2016 mesures réelles PAA de février 2025.'}
            </p>
          </div>

          {/* Période — seulement pour collecte auto */}
          {source === 'collecte' && (
            <div>
              <label className="fp-label">Période</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {PERIODES.map(p => (
                  <button key={p.id} onClick={() => setPeriode(p.id)} style={{
                    padding: '0.4rem 0.75rem', fontSize: 12,
                    fontFamily: "'Inter', sans-serif",
                    borderRadius: '20px', cursor: 'pointer',
                    fontWeight: periode === p.id ? 700 : 400,
                    background: periode === p.id ? C.primary : '#f0f4f8',
                    color: periode === p.id ? '#fff' : C.textMuted,
                    border: `1px solid ${periode === p.id ? C.primary : 'transparent'}`,
                  }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Détail — résumé quotidien (léger) ou toutes les données (brut) */}
          {source === 'collecte' && (
            <div>
              <label className="fp-label">Détail</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  ['resume', 'Résumé quotidien'],
                  ['brut',   'Toutes les données'],
                ].map(([val, lbl]) => (
                  <button key={val} onClick={() => setDetail(val)} style={{
                    flex: 1, padding: '0.5rem 0.4rem', fontSize: 11.5,
                    fontFamily: "'Inter', sans-serif",
                    borderRadius: '8px', cursor: 'pointer',
                    fontWeight: detail === val ? 700 : 400,
                    background: detail === val ? C.primary : '#f8fafc',
                    color: detail === val ? '#fff' : C.text,
                    border: `1px solid ${detail === val ? C.primary : '#e2e8f0'}`,
                  }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: resume ? C.textMuted : C.warning, marginTop: 6 }}>
                {resume
                  ? 'Résumé quotidien : min · moyenne · max + répartition des niveaux, une ligne par jour et par axe (jour en cours calculé à la volée). Léger — tient le plan gratuit.'
                  : 'Relevés bruts : une ligne par mesure. Volumineux sur les longues périodes (~14 500 lignes/mois) et lourd en lecture Firestore — à réserver aux périodes courtes.'}
              </p>
            </div>
          )}

          {/* Axe */}
          <div>
            <label className="fp-label">Axe routier</label>
            <select className="fp-select" value={axe} onChange={e => setAxe(e.target.value)}>
              <option value="tous">Tous les axes</option>
              {AXES_OFFICIELS.map(a => <option key={a.id} value={a.id}>{a.shortNom}</option>)}
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="fp-label">Format</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[['excel','Excel (.xlsx)'],['csv','CSV']].map(([val, lbl]) => (
                <button key={val} onClick={() => setFormat(val)} style={{
                  flex: 1, padding: '0.5rem', fontSize: 12,
                  fontFamily: "'Inter', sans-serif",
                  borderRadius: '8px', cursor: 'pointer',
                  fontWeight: format === val ? 700 : 400,
                  background: format === val ? '#EBF2FB' : '#f8fafc',
                  color: format === val ? C.primary : C.textMuted,
                  border: `1px solid ${format === val ? C.primary : '#e2e8f0'}`,
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Compteur + bascule d'aperçu */}
          <div
            onClick={() => { if (countError && !collecteRows) reloadCount() }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0.65rem 1rem',
              background: countError ? '#FDECEC' : isLoading ? '#f8fafc' : '#EBF8F1',
              border: `1px solid ${countError ? '#F5B5B5' : isLoading ? '#e2e8f0' : '#A7E3C3'}`,
              borderRadius: '8px',
              cursor: countError && !collecteRows ? 'pointer' : 'default',
            }}
          >
            {isLoading
              ? <RefreshCw size={13} color={C.textMuted} className="fp-spin" />
              : <Database size={13} color={countError ? C.danger : C.success} />}
            <span style={{ fontSize: 12, color: countError ? C.danger : isLoading ? C.textMuted : C.success, fontWeight: 500 }}>
              {previewLabel}
            </span>
            {!isLoading && !countError && apercuDispo && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleApercu() }}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 600, color: C.primary, fontFamily: "'Inter',sans-serif",
                  textDecoration: 'underline', padding: 0,
                }}
              >
                {showApercu ? 'Masquer l\'aperçu' : 'Aperçu des données'}
              </button>
            )}
          </div>

          {/* Aperçu : 8 premières lignes, colonnes réelles de l'export */}
          {showApercu && rowsExport.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, fontFamily: "'Inter',sans-serif" }}>
                  <thead>
                    <tr>
                      {Object.keys(rowsExport[0]).map(col => (
                        <th key={col} style={{
                          background: C.primary, color: '#fff', padding: '5px 8px',
                          textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600,
                        }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsExport.slice(0, 8).map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? '#f8fafc' : '#fff' }}>
                        {Object.keys(rowsExport[0]).map(col => (
                          <td key={col} style={{ padding: '4px 8px', whiteSpace: 'nowrap', color: C.text, borderTop: '1px solid #eef2f6' }}>
                            {String(r[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rowsExport.length > 8 && (
                <p style={{ fontSize: 10.5, color: C.textMuted, padding: '5px 10px', margin: 0, background: '#f8fafc', borderTop: '1px solid #eef2f6' }}>
                  … et {rowsExport.length - 8} autres lignes dans le fichier
                </p>
              )}
            </div>
          )}

          <button
            className="fp-btn fp-btn-primary"
            style={{ padding: '0.75rem', justifyContent: 'center', fontSize: 14 }}
            onClick={telecharger}
            disabled={exporting || isLoading}
          >
            <Download size={16} />
            {exporting ? 'Préparation…' : `Télécharger (${format.toUpperCase()})`}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.textLight, marginTop: '0.9rem' }}>
          {resume
            ? 'Colonnes : Date · Axe · Sens · Mesures · T_ref · Min · Moyenne · Max · Retard moy · Fluide · Modéré · Dense · Congestionné · Source'
            : 'Colonnes : Date · Heure · Axe · Sens · T_ref · T_live · Retard · Niveau · Vitesse · Source'}
        </p>
      </div>
    </div>
  )
}

export default ExportPage
