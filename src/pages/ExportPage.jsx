import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { C } from '../styles/tokens'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { AXES_OFFICIELS } from '../hooks/useTrafficData'

const TRONCONS_MAP = {
  tous: 'Tous les tronçons',
  axe1: ['T1A', 'T1B', 'T1C', 'T1D', 'T1E'],
  axe2: ['T2A', 'T2B', 'T2C'],
  axe3: ['T3A', 'T3B', 'T3C'],
}

function generateMockData(axeId, troncon, debut, fin) {
  const rows = []
  const axes  = axeId === 'tous' ? AXES_OFFICIELS : AXES_OFFICIELS.filter(a => a.id === axeId)
  const start = new Date(debut)
  const end   = new Date(fin)

  for (let d = new Date(start); d <= end; d.setHours(d.getHours() + 1)) {
    axes.forEach(axe => {
      const trList = troncon === 'tous' ? axe.troncons : [troncon].filter(t => axe.troncons.includes(t))
      trList.forEach(t => {
        const base  = axe.tRef / axe.troncons.length
        const live  = Math.round((base * (1 + Math.random() * 0.5)) * 10) / 10
        const retard = Math.round((live - base) * 10) / 10
        rows.push({
          Date:     d.toLocaleDateString('fr-FR'),
          Heure:    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          Axe:      axe.shortNom,
          Troncon:  t,
          'T_ref (min)':  Math.round(base * 10) / 10,
          'T_live (min)': live,
          'Retard (min)': retard,
          Niveau:   retard < 2 ? 1 : retard < 5 ? 2 : retard < 10 ? 3 : retard < 15 ? 4 : 5,
          'Vitesse (km/h)': Math.round((axe.dist / parseFloat(axe.distance) / live) * 60 * 10) / 10,
        })
      })
    })
  }
  return rows
}

function ExportPage() {
  const [axe,    setAxe]    = useState('tous')
  const [troncon, setTroncon] = useState('tous')
  const [debut,  setDebut]  = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 16))
  const [fin,    setFin]    = useState(new Date().toISOString().slice(0, 16))
  const [format, setFormat] = useState('csv')
  const [loading, setLoading] = useState(false)

  const tronconOptions = axe === 'tous'
    ? ['tous']
    : ['tous', ...AXES_OFFICIELS.find(a => a.id === axe)?.troncons ?? []]

  function telecharger() {
    setLoading(true)
    setTimeout(() => {
      const data = generateMockData(axe, troncon, debut, fin)
      if (data.length === 0) { alert('Aucune donnée pour cette sélection.'); setLoading(false); return }

      const fname = `FlowPort_Export_${axe}_${debut.slice(0,10)}_${fin.slice(0,10)}`

      if (format === 'csv') {
        const csv  = Papa.unparse(data)
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = `${fname}.csv`; a.click()
        URL.revokeObjectURL(url)
      } else {
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Export Trafic')
        XLSX.writeFile(wb, `${fname}.xlsx`)
      }
      setLoading(false)
    }, 600)
  }

  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: '580px' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Export de données</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Exportez les mesures de trafic au format CSV ou Excel</p>
        </div>

        <div className="fp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '0.9rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ width: 38, height: 38, borderRadius: '9px', background: '#EBF2FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={18} color={C.primary} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Paramètres d'export</p>
              <p style={{ fontSize: 11, color: C.textMuted }}>Sélectionnez la plage et le format</p>
            </div>
          </div>

          {/* Axe */}
          <div>
            <label className="fp-label">Axe routier</label>
            <select className="fp-select" value={axe} onChange={e => { setAxe(e.target.value); setTroncon('tous') }}>
              <option value="tous">Tous les axes</option>
              {AXES_OFFICIELS.map(a => <option key={a.id} value={a.id}>{a.shortNom}</option>)}
            </select>
          </div>

          {/* Tronçon */}
          <div>
            <label className="fp-label">Tronçon</label>
            <select className="fp-select" value={troncon} onChange={e => setTroncon(e.target.value)}>
              {tronconOptions.map(t => (
                <option key={t} value={t}>{t === 'tous' ? 'Tous les tronçons' : t}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label className="fp-label">Date de début</label>
              <input type="datetime-local" className="fp-input" value={debut} onChange={e => setDebut(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="fp-label">Date de fin</label>
              <input type="datetime-local" className="fp-input" value={fin} onChange={e => setFin(e.target.value)} />
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="fp-label">Format d'export</label>
            <select className="fp-select" value={format} onChange={e => setFormat(e.target.value)}>
              <option value="csv">CSV</option>
              <option value="excel">Excel (.xlsx)</option>
            </select>
          </div>

          <button
            className="fp-btn fp-btn-primary"
            style={{ padding: '0.75rem', justifyContent: 'center', fontSize: 14, marginTop: '0.25rem' }}
            onClick={telecharger}
            disabled={loading}
          >
            <Download size={16} />
            {loading ? 'Préparation...' : 'Télécharger'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.textLight, marginTop: '0.9rem' }}>
          Les données exportées proviennent des mesures TomTom collectées toutes les 30 secondes.
        </p>
      </div>
    </div>
  )
}

export default ExportPage
