import { useState, useEffect, useMemo } from 'react'
import { Download, FileSpreadsheet, Database, Calendar, RefreshCw } from 'lucide-react'
import { C, levelLabel } from '../styles/tokens'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
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

// ── Chargement données collecte_auto depuis Firestore ────────
// Filtrage client-side pour éviter les index composites Firestore
function useCollecteData(axeFilter, periodeId, enabled) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(false)
  const [count,   setCount]   = useState(null)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    const { start } = getPeriodBounds(periodeId)

    const col = collection(db, 'collecte_auto')
    const q   = query(col, orderBy('timestamp', 'desc'), limit(5000))

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map(d => d.data())
          .filter(d => {
            const ts = d.timestamp?.toDate?.() ?? new Date(d.timestamp ?? 0)
            if (ts < start) return false
            if (axeFilter !== 'tous' && d.axeId !== axeFilter) return false
            return true
          })
          // Le filtre préserve l'ordre de la requête (déjà desc), mais on
          // retrie explicitement — plus récent → plus ancien — pour ne pas
          // dépendre d'un détail d'implémentation Firestore.
          .sort((a, b) => tsToMillis(b.timestamp) - tsToMillis(a.timestamp))
        setData(rows)
        setCount(rows.length)
        setLoading(false)
      },
      (err) => {
        console.error('collecte_auto error:', err)
        setData([])
        setCount(0)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [axeFilter, periodeId, enabled])

  return { data, loading, count }
}

function ExportPage() {
  const { mesures } = useTrafficData()
  const { data: histoData, loading: histoLoading } = useHistoricalData()

  const [source,  setSource]  = useState('collecte')  // 'collecte' | 'live' | 'historique'
  const [periode, setPeriode] = useState('month')
  const [axe,     setAxe]     = useState('tous')
  const [format,  setFormat]  = useState('excel')
  const [exporting, setExporting] = useState(false)

  const { data: collecteData, loading: collecteLoading, count } = useCollecteData(axe, periode, source === 'collecte')

  function telecharger() {
    setExporting(true)
    const fname = `FlowPort_${source}_${axe}_${periode}_${new Date().toISOString().slice(0,10)}`
    setTimeout(() => {
      let rows
      if (source === 'live') {
        rows = buildLiveRows(mesures).filter(r => axe === 'tous' || AXES_OFFICIELS.find(a => a.shortNom === r.Axe)?.id === axe)
      } else if (source === 'historique') {
        rows = buildHistoRows(histoData, axe)
      } else {
        rows = collecteData.map(toExportRow)
      }
      downloadRows(rows, format, fname)
      setExporting(false)
    }, 300)
  }

  const isLoading = source === 'collecte' ? collecteLoading : (source === 'historique' ? histoLoading : false)

  const previewLabel = useMemo(() => {
    if (source === 'live') return `${AXES_OFFICIELS.length} mesures (snapshot actuel)`
    if (source === 'historique') return `${histoData.filter(d => axe === 'tous' || d.axeId === axe).length} mesures (fév. 2025)`
    if (collecteLoading) return 'Chargement…'
    if (count === null) return '—'
    return `${count} mesures trouvées`
  }, [source, mesures, histoData, axe, collecteLoading, count])

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
              {source === 'collecte' && 'Données collectées automatiquement par GitHub Actions (toutes les 15 min) depuis le déploiement.'}
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

          {/* Preview */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '0.65rem 1rem',
            background: isLoading ? '#f8fafc' : '#EBF8F1',
            border: `1px solid ${isLoading ? '#e2e8f0' : '#A7E3C3'}`,
            borderRadius: '8px',
          }}>
            {isLoading
              ? <RefreshCw size={13} color={C.textMuted} className="fp-spin" />
              : <Database size={13} color={C.success} />}
            <span style={{ fontSize: 12, color: isLoading ? C.textMuted : C.success, fontWeight: 500 }}>
              {previewLabel}
            </span>
          </div>

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
          Colonnes : Date · Heure · Axe · Sens · T_ref · T_live · Retard · Niveau · Vitesse · Source
        </p>
      </div>
    </div>
  )
}

export default ExportPage
