import { useState } from 'react'
import { FileText, Download, Trash2, FilePlus } from 'lucide-react'
import { C } from '../styles/tokens'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

function RapportsPage() {
  const [type,     setType]     = useState('journalier')
  const [periode,  setPeriode]  = useState(new Date().toISOString().slice(0, 10))
  const [format,   setFormat]   = useState('pdf')
  const [rapports, setRapports] = useState([])
  const [loading,  setLoading]  = useState(false)

  function genererRapport() {
    setLoading(true)
    setTimeout(() => {
      const nom = `PAA-${type.charAt(0).toUpperCase() + type.slice(1)}-${periode}`
      setRapports(prev => [{ id: Date.now(), nom, type, periode, format, date: new Date() }, ...prev])
      setLoading(false)
    }, 800)
  }

  function telecharger(rapport, fmt) {
    if (fmt === 'pdf') {
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.text('FlowPort — Rapport Trafic PAA', 20, 20)
      doc.setFontSize(12)
      doc.text(`Type : ${rapport.type}`, 20, 35)
      doc.text(`Période : ${rapport.periode}`, 20, 45)
      doc.text(`Généré le : ${rapport.date.toLocaleString('fr-FR')}`, 20, 55)
      doc.setFontSize(14)
      doc.text('Données trafic — Port Autonome d\'Abidjan', 20, 75)
      doc.setFontSize(11)
      doc.text('Axe 1 CARENA : 27.4 min (réf), trafic fluide', 20, 90)
      doc.text('Axe 2 Toyota CFAO : 16.9 min (réf), modéré', 20, 100)
      doc.text('Axe 3 SODECI : 17.8 min (réf), fluide', 20, 110)
      doc.save(`${rapport.nom}.pdf`)
    } else {
      const ws = XLSX.utils.aoa_to_sheet([
        ['FlowPort — Rapport Trafic PAA'],
        ['Type', rapport.type],
        ['Période', rapport.periode],
        ['Axe', 'T_ref (min)', 'T_live (min)', 'Retard', 'Niveau'],
        ['CARENA → Palm Beach', 27.4, 29.1, '+1.7', 2],
        ['Toyota CFAO → Palm Beach', 16.9, 18.5, '+1.6', 2],
        ['SODECI → Palm Beach', 17.8, 21.3, '+3.5', 3],
      ])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Rapport')
      XLSX.writeFile(wb, `${rapport.nom}.xlsx`)
    }
  }

  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Rapports</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Générez et téléchargez les rapports officiels PAA</p>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>

        {/* ── Générer un rapport ─────────────────────────── */}
        <div className="fp-card" style={{ flex: '0 0 340px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <FilePlus size={16} color={C.primary} />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Générer un rapport</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="fp-label">Type de rapport</label>
              <select className="fp-select" value={type} onChange={e => setType(e.target.value)}>
                <option value="journalier">Journalier</option>
                <option value="hebdomadaire">Hebdomadaire</option>
                <option value="mensuel">Mensuel</option>
              </select>
            </div>

            <div>
              <label className="fp-label">Période</label>
              <input
                type="date"
                className="fp-input"
                value={periode}
                onChange={e => setPeriode(e.target.value)}
              />
            </div>

            <div>
              <label className="fp-label">Format</label>
              <select className="fp-select" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="pdf">PDF — DEESP-RF-01</option>
                <option value="excel">Excel</option>
                <option value="word">Word</option>
              </select>
            </div>

            <button
              className="fp-btn fp-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', marginTop: '0.25rem' }}
              onClick={genererRapport}
              disabled={loading}
            >
              <FileText size={15} />
              {loading ? 'Génération...' : 'Générer le rapport'}
            </button>
          </div>
        </div>

        {/* ── Rapports disponibles ───────────────────────── */}
        <div className="fp-card" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <Download size={16} color={C.primary} />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Rapports disponibles</span>
            <span className="fp-badge fp-badge-blue" style={{ marginLeft: 'auto' }}>{rapports.length}</span>
          </div>

          {rapports.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '2.5rem',
              background: '#f8fafc', borderRadius: '8px',
              border: '1px dashed #e2e8f0',
            }}>
              <FileText size={32} color={C.textLight} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Aucun rapport disponible</p>
              <p style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>Générez votre premier rapport à gauche</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {rapports.map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.85rem 1rem', background: '#f8fafc',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '8px',
                      background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <FileText size={16} color={C.primary} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.nom}</p>
                      <p style={{ fontSize: 11, color: C.textMuted }}>
                        {r.type} · {r.date.toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="fp-btn fp-btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }}
                      onClick={() => telecharger(r, 'pdf')}>
                      <Download size={12} /> PDF
                    </button>
                    <button className="fp-btn fp-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }}
                      onClick={() => telecharger(r, 'excel')}>
                      <Download size={12} /> Excel
                    </button>
                    <button className="fp-btn fp-btn-danger" style={{ padding: '0.35rem 0.6rem' }}
                      onClick={() => setRapports(prev => prev.filter(x => x.id !== r.id))}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RapportsPage
