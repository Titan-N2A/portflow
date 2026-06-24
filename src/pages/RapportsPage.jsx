import { useState } from 'react'
import { FileText, Download, Trash2, FilePlus } from 'lucide-react'
import { C, levelLabel } from '../styles/tokens'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } from 'docx'
import { useTrafficData, AXES_OFFICIELS } from '../hooks/useTrafficData'

const AXE_TREF = { axe1: 27.4, axe2: 16.9, axe3: 17.8 }

function buildAxeRows(mesures) {
  return AXES_OFFICIELS.map(axe => {
    const m = mesures[axe.id]
    return {
      axe:   axe.shortNom,
      tRef:  axe.tRef,
      tLive: m?.tempsLive ?? axe.tRef,
      retard: m?.retard ?? 0,
      niveau: m?.niveau ?? 1,
      vitesse: m?.vitesse ?? 0,
    }
  })
}

function telechargerPDF(rapport, rows) {
  const doc = new jsPDF()
  const now  = rapport.date.toLocaleString('fr-FR')

  doc.setFillColor(27, 79, 138)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('FlowPort — Rapport Trafic PAA', 14, 13)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Port Autonome d\'Abidjan · Direction des Études et de l\'Exploitation', 14, 21)

  doc.setTextColor(60, 60, 60)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Informations du rapport', 14, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Type        : ${rapport.type.charAt(0).toUpperCase() + rapport.type.slice(1)}`, 14, 49)
  doc.text(`Période     : ${rapport.periode}`, 14, 57)
  doc.text(`Généré le   : ${now}`, 14, 65)
  doc.text(`Format      : DEESP-RF-01`, 14, 73)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('État des axes routiers', 14, 88)

  const cols = ['Axe', 'T. Réf (min)', 'T. Live (min)', 'Retard (min)', 'Niveau', 'Vitesse (km/h)']
  const colWidths = [45, 30, 30, 30, 25, 32]
  let x = 14, y = 96

  // Header
  doc.setFillColor(27, 79, 138)
  doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  cols.forEach((col, i) => {
    doc.text(col, x + 2, y + 5.5)
    x += colWidths[i]
  })

  doc.setFont('helvetica', 'normal')
  rows.forEach((row, ri) => {
    y += 8
    x = 14
    doc.setFillColor(ri % 2 === 0 ? 245 : 255, ri % 2 === 0 ? 247 : 255, ri % 2 === 0 ? 250 : 255)
    doc.rect(14, y, colWidths.reduce((a, b) => a + b, 0), 8, 'F')
    doc.setTextColor(60, 60, 60)
    const vals = [row.axe, row.tRef, row.tLive, row.retard > 0 ? `+${row.retard}` : row.retard, `N${row.niveau} — ${levelLabel(row.niveau)}`, row.vitesse]
    vals.forEach((val, i) => {
      doc.text(String(val), x + 2, y + 5.5)
      x += colWidths[i]
    })
  })

  doc.setTextColor(150, 150, 150)
  doc.setFontSize(8)
  doc.text('FlowPort v2 · Données TomTom Traffic API · PAA Abidjan', 14, 285)

  doc.save(`${rapport.nom}.pdf`)
}

function telechargerExcel(rapport, rows) {
  const ws = XLSX.utils.aoa_to_sheet([
    [`FlowPort — Rapport Trafic PAA — ${rapport.type}`],
    [`Période : ${rapport.periode}`, '', `Généré le : ${rapport.date.toLocaleString('fr-FR')}`],
    [],
    ['Axe', 'T. Réf (min)', 'T. Live (min)', 'Retard (min)', 'Niveau', 'Label niveau', 'Vitesse (km/h)'],
    ...rows.map(r => [r.axe, r.tRef, r.tLive, r.retard, r.niveau, levelLabel(r.niveau), r.vitesse]),
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rapport')
  XLSX.writeFile(wb, `${rapport.nom}.xlsx`)
}

async function telechargerWord(rapport, rows) {
  const tableRows = [
    new TableRow({
      children: ['Axe', 'T. Réf (min)', 'T. Live (min)', 'Retard (min)', 'Niveau'].map(h =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          width: { size: 20, type: WidthType.PERCENTAGE },
        })
      ),
    }),
    ...rows.map(r =>
      new TableRow({
        children: [r.axe, String(r.tRef), String(r.tLive), r.retard > 0 ? `+${r.retard}` : String(r.retard), `N${r.niveau} — ${levelLabel(r.niveau)}`].map(val =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun(val)] })],
            width: { size: 20, type: WidthType.PERCENTAGE },
          })
        ),
      })
    ),
  ]

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'FlowPort — Rapport Trafic PAA', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun({ text: `Type : ${rapport.type}  |  Période : ${rapport.periode}`, color: '555555' })] }),
        new Paragraph({ children: [new TextRun({ text: `Généré le : ${rapport.date.toLocaleString('fr-FR')}`, color: '888888', size: 18 })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'État des axes routiers', heading: HeadingLevel.HEADING_2 }),
        new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Données : TomTom Traffic API · PAA Abidjan · FlowPort v2', color: 'AAAAAA', size: 16 })] }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = `${rapport.nom}.docx`; a.click()
  URL.revokeObjectURL(url)
}

function RapportsPage() {
  const { mesures } = useTrafficData()
  const [type,     setType]     = useState('journalier')
  const [periode,  setPeriode]  = useState(new Date().toISOString().slice(0, 10))
  const [format,   setFormat]   = useState('pdf')
  const [rapports, setRapports] = useState([])
  const [loading,  setLoading]  = useState(false)

  function genererRapport() {
    setLoading(true)
    setTimeout(() => {
      const nom = `PAA-${type.charAt(0).toUpperCase() + type.slice(1)}-${periode}`
      setRapports(prev => [{ id: Date.now(), nom, type, periode, format, date: new Date(), mesures: { ...mesures } }, ...prev])
      setLoading(false)
    }, 600)
  }

  async function telecharger(rapport, fmt) {
    const rows = buildAxeRows(rapport.mesures ?? {})
    if (fmt === 'pdf')   telechargerPDF(rapport, rows)
    else if (fmt === 'excel') telechargerExcel(rapport, rows)
    else if (fmt === 'word')  await telechargerWord(rapport, rows)
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
              <input type="date" className="fp-input" value={periode} onChange={e => setPeriode(e.target.value)} />
            </div>

            <div>
              <label className="fp-label">Format</label>
              <select className="fp-select" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="pdf">PDF — DEESP-RF-01</option>
                <option value="excel">Excel (.xlsx)</option>
                <option value="word">Word (.docx)</option>
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
            <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
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
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={16} color={C.primary} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.nom}</p>
                      <p style={{ fontSize: 11, color: C.textMuted }}>{r.type} · {r.date.toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="fp-btn fp-btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }} onClick={() => telecharger(r, 'pdf')}>
                      <Download size={12} /> PDF
                    </button>
                    <button className="fp-btn fp-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }} onClick={() => telecharger(r, 'excel')}>
                      <Download size={12} /> Excel
                    </button>
                    <button className="fp-btn fp-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }} onClick={() => telecharger(r, 'word')}>
                      <Download size={12} /> Word
                    </button>
                    <button className="fp-btn fp-btn-danger" style={{ padding: '0.35rem 0.6rem' }} onClick={() => setRapports(prev => prev.filter(x => x.id !== r.id))}>
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
