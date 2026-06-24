import { useState, useMemo } from 'react'
import { Download, FileSpreadsheet, Database } from 'lucide-react'
import { C } from '../styles/tokens'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { AXES_OFFICIELS } from '../hooks/useTrafficData'
import { useHistoricalData } from '../hooks/useHistoricalData'
import { computeNiveau } from '../services/indicators'
import { getReference } from '../data/references'

const DIST_KM = { axe1: 14.8, axe2: 9.6, axe3: 8.4 }

function buildExportRows(data, axeId, dateDebut, dateFin) {
  const start = new Date(dateDebut)
  const end   = new Date(dateFin)

  return data.filter(d => {
    if (axeId !== 'tous' && d.axeId !== axeId) return false
    const date = new Date(d.date + 'T00:00:00')
    return date >= start && date <= end
  }).map(d => {
    const tRef   = getReference(d.axeId, d.sens, d.heure) ?? AXES_OFFICIELS.find(a => a.id === d.axeId)?.tRef ?? 0
    const retard  = Math.round((d.temps_min - tRef) * 10) / 10
    const ratio   = tRef ? d.temps_min / tRef : null
    const niveau  = computeNiveau(ratio)
    const dist    = DIST_KM[d.axeId] ?? 10
    const vitesse = Math.round((dist / d.temps_min) * 60 * 10) / 10

    return {
      Date:            d.date,
      Heure:           `${d.heure}:00`,
      Axe:             AXES_OFFICIELS.find(a => a.id === d.axeId)?.shortNom ?? d.axeId,
      Sens:            d.sens,
      'T_ref (min)':   tRef,
      'T_live (min)':  d.temps_min,
      'Retard (min)':  retard,
      Niveau:          niveau,
      'Vitesse (km/h)': vitesse,
    }
  })
}

function ExportPage() {
  const { data, loading } = useHistoricalData()

  const [axe,    setAxe]    = useState('tous')
  const [debut,  setDebut]  = useState('2025-02-01')
  const [fin,    setFin]    = useState('2025-02-28')
  const [format, setFormat] = useState('csv')
  const [exporting, setExporting] = useState(false)

  const previewCount = useMemo(() => {
    if (!data.length) return 0
    return data.filter(d => {
      if (axe !== 'tous' && d.axeId !== axe) return false
      const date = new Date(d.date + 'T00:00:00')
      return date >= new Date(debut) && date <= new Date(fin)
    }).length
  }, [data, axe, debut, fin])

  function telecharger() {
    setExporting(true)
    setTimeout(() => {
      const rows = buildExportRows(data, axe, debut, fin)
      if (!rows.length) { alert('Aucune donnée pour cette sélection.'); setExporting(false); return }

      const fname = `FlowPort_Export_${axe}_${debut}_${fin}`

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
        XLSX.utils.book_append_sheet(wb, ws, 'Mesures Trafic PAA')
        XLSX.writeFile(wb, `${fname}.xlsx`)
      }
      setExporting(false)
    }, 400)
  }

  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '580px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Export de données</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            Exportez les mesures réelles PAA (fév. 2025) au format CSV ou Excel
          </p>
        </div>

        {/* Indicateur source */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '0.65rem 1rem', marginBottom: '1rem',
          background: loading ? '#f8fafc' : '#EBF8F1',
          border: `1px solid ${loading ? '#e2e8f0' : '#A7E3C3'}`,
          borderRadius: '8px',
        }}>
          <Database size={14} color={loading ? C.textMuted : C.success} />
          <span style={{ fontSize: 12, color: loading ? C.textMuted : C.success, fontWeight: 500 }}>
            {loading
              ? 'Chargement des données Firestore…'
              : `${data.length} mesures réelles chargées · ${previewCount} correspondront aux filtres`}
          </span>
        </div>

        <div className="fp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '0.9rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ width: 38, height: 38, borderRadius: '9px', background: '#EBF2FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={18} color={C.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Paramètres d'export</p>
              <p style={{ fontSize: 11, color: C.textMuted }}>Données historiques réelles (TomTom fév. 2025)</p>
            </div>
          </div>

          {/* Axe */}
          <div>
            <label className="fp-label">Axe routier</label>
            <select className="fp-select" value={axe} onChange={e => setAxe(e.target.value)}>
              <option value="tous">Tous les axes</option>
              {AXES_OFFICIELS.map(a => <option key={a.id} value={a.id}>{a.shortNom}</option>)}
            </select>
          </div>

          {/* Dates */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label className="fp-label">Date de début</label>
              <input type="date" className="fp-input" value={debut} min="2025-02-01" max="2025-02-28" onChange={e => setDebut(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="fp-label">Date de fin</label>
              <input type="date" className="fp-input" value={fin} min="2025-02-01" max="2025-02-28" onChange={e => setFin(e.target.value)} />
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="fp-label">Format d'export</label>
            <select className="fp-select" value={format} onChange={e => setFormat(e.target.value)}>
              <option value="csv">CSV (UTF-8)</option>
              <option value="excel">Excel (.xlsx)</option>
            </select>
          </div>

          <button
            className="fp-btn fp-btn-primary"
            style={{ padding: '0.75rem', justifyContent: 'center', fontSize: 14, marginTop: '0.25rem' }}
            onClick={telecharger}
            disabled={exporting || loading || !previewCount}
          >
            <Download size={16} />
            {exporting ? 'Préparation…' : `Télécharger (${previewCount} lignes)`}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.textLight, marginTop: '0.9rem' }}>
          Colonnes : Date · Heure · Axe · Sens · T_ref · T_live · Retard · Niveau · Vitesse
        </p>
      </div>
    </div>
  )
}

export default ExportPage
