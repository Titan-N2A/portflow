import { useState } from 'react'
import { FileText, Download, Trash2, FilePlus, Database } from 'lucide-react'
import { C, levelLabel } from '../styles/tokens'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel } from 'docx'
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useTrafficData, AXES_OFFICIELS } from '../hooks/useTrafficData'

// ── Calcul des bornes de période ──────────────────────────────

function getPeriodeBounds(type, periode) {
  const ref = new Date(periode)
  if (type === 'journalier') {
    return {
      start: periode,
      end:   periode,
      label: ref.toLocaleDateString('fr-FR'),
    }
  }
  if (type === 'hebdomadaire') {
    const d = new Date(ref)
    d.setDate(d.getDate() - 6)
    const start = d.toISOString().slice(0, 10)
    return {
      start,
      end:   periode,
      label: `${new Date(start).toLocaleDateString('fr-FR')} – ${ref.toLocaleDateString('fr-FR')}`,
    }
  }
  // mensuel
  const start = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-01`
  const last  = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  const end   = last.toISOString().slice(0, 10)
  return {
    start,
    end,
    label: ref.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
  }
}

// ── Requête Firestore collecte_auto ──────────────────────────

async function fetchPeriodData(type, periode) {
  const { start, end } = getPeriodeBounds(type, periode)
  const q = query(
    collection(db, 'collecte_auto'),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'desc'),
    limit(5000)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

// ── Agrégation par axe ────────────────────────────────────────

function aggregerParAxe(records, mesuresLive) {
  return AXES_OFFICIELS.map(axe => {
    const rows = records.filter(r => r.axeId === axe.id && r.sens === 'aller')
    if (rows.length === 0) {
      // Fallback sur données live si pas d'historique
      const m = mesuresLive[axe.id]
      return {
        axe:       axe.shortNom,
        tRef:      axe.tRef,
        tMin:      m?.tempsLive ?? axe.tRef,
        tMoyen:    m?.tempsLive ?? axe.tRef,
        tMax:      m?.tempsLive ?? axe.tRef,
        retard:    m?.retard ?? 0,
        niveau:    m?.niveau ?? 1,
        vitesse:   m?.vitesse ?? 0,
        nbMesures: 0,
        source:    'live',
      }
    }
    const temps  = rows.map(r => r.temps_min).filter(Boolean)
    const tMin   = Math.round(Math.min(...temps) * 10) / 10
    const tMax   = Math.round(Math.max(...temps) * 10) / 10
    const tMoyen = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 10) / 10
    const retard = Math.round((tMoyen - axe.tRef) * 10) / 10
    const vitesse = Math.round((axe.dist / tMoyen) * 60 * 10) / 10
    const niveaux = rows.map(r => r.niveau).filter(Boolean)
    const niveau  = niveaux.length ? Math.round(niveaux.reduce((a, b) => a + b, 0) / niveaux.length) : 1
    return {
      axe:       axe.shortNom,
      tRef:      axe.tRef,
      tMin, tMoyen, tMax,
      retard, niveau, vitesse,
      nbMesures: rows.length,
      source:    'historique',
    }
  })
}

// ── Génération PDF ────────────────────────────────────────────

function telechargerPDF(rapport, rows) {
  const doc = new jsPDF()
  const now  = rapport.date.toLocaleString('fr-FR')

  doc.setFillColor(27, 79, 138)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold')
  doc.text('FlowPort — Rapport Trafic PAA', 14, 13)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text('Port Autonome d\'Abidjan · Direction des Études et de l\'Exploitation', 14, 21)

  doc.setTextColor(60, 60, 60)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('Informations du rapport', 14, 40)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  doc.text(`Type        : ${rapport.type.charAt(0).toUpperCase() + rapport.type.slice(1)}`, 14, 49)
  doc.text(`Période     : ${rapport.periodeLabel}`, 14, 57)
  doc.text(`Généré le   : ${now}`, 14, 65)
  doc.text(`Mesures     : ${rapport.nbMesuresTotal} relevés collectés`, 14, 73)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text('Statistiques par axe routier', 14, 88)

  const cols      = ['Axe', 'T. Réf', 'T. Min', 'T. Moyen', 'T. Max', 'Retard moy.', 'Mesures']
  const colWidths = [38, 22, 22, 24, 22, 28, 20]
  let x = 14, y = 96

  doc.setFillColor(27, 79, 138)
  doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), 8, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
  cols.forEach((col, i) => { doc.text(col, x + 2, y + 5.5); x += colWidths[i] })

  doc.setFont('helvetica', 'normal')
  rows.forEach((row, ri) => {
    y += 8; x = 14
    doc.setFillColor(ri % 2 === 0 ? 245 : 255, ri % 2 === 0 ? 247 : 255, ri % 2 === 0 ? 250 : 255)
    doc.rect(14, y, colWidths.reduce((a, b) => a + b, 0), 8, 'F')
    doc.setTextColor(60, 60, 60)
    const vals = [
      row.axe,
      `${row.tRef} min`,
      `${row.tMin} min`,
      `${row.tMoyen} min`,
      `${row.tMax} min`,
      row.retard >= 0 ? `+${row.retard} min` : `${row.retard} min`,
      row.nbMesures > 0 ? `${row.nbMesures}` : 'live',
    ]
    vals.forEach((val, i) => { doc.text(String(val), x + 2, y + 5.5); x += colWidths[i] })
  })

  doc.setTextColor(150, 150, 150); doc.setFontSize(8)
  doc.text('FlowPort v2 · Google Distance Matrix / TomTom · PAA Abidjan', 14, 285)
  doc.save(`${rapport.nom}.pdf`)
}

// ── Génération Excel ──────────────────────────────────────────

function telechargerExcel(rapport, rows) {
  const ws = XLSX.utils.aoa_to_sheet([
    [`FlowPort — Rapport Trafic PAA — ${rapport.type}`],
    [`Période : ${rapport.periodeLabel}`, '', `Généré le : ${rapport.date.toLocaleString('fr-FR')}`],
    [`Mesures collectées : ${rapport.nbMesuresTotal} relevés`],
    [],
    ['Axe', 'T. Réf (min)', 'T. Min (min)', 'T. Moyen (min)', 'T. Max (min)', 'Retard moy. (min)', 'Niveau moy.', 'Vitesse moy. (km/h)', 'Nb mesures'],
    ...rows.map(r => [r.axe, r.tRef, r.tMin, r.tMoyen, r.tMax, r.retard, r.niveau, r.vitesse, r.nbMesures || 'live']),
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rapport')
  XLSX.writeFile(wb, `${rapport.nom}.xlsx`)
}

// ── Génération Word ───────────────────────────────────────────

async function telechargerWord(rapport, rows) {
  const headers = ['Axe', 'T. Réf', 'T. Min', 'T. Moyen', 'T. Max', 'Retard moy.', 'Mesures']
  const tableRows = [
    new TableRow({
      children: headers.map(h =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
          width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
        })
      ),
    }),
    ...rows.map(r =>
      new TableRow({
        children: [
          r.axe,
          `${r.tRef} min`,
          `${r.tMin} min`,
          `${r.tMoyen} min`,
          `${r.tMax} min`,
          r.retard >= 0 ? `+${r.retard} min` : `${r.retard} min`,
          r.nbMesures > 0 ? String(r.nbMesures) : 'live',
        ].map(val =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun(val)] })],
            width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
          })
        ),
      })
    ),
  ]

  const docx = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'FlowPort — Rapport Trafic PAA', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun({ text: `Type : ${rapport.type}  |  Période : ${rapport.periodeLabel}`, color: '555555' })] }),
        new Paragraph({ children: [new TextRun({ text: `Généré le : ${rapport.date.toLocaleString('fr-FR')}`, color: '888888', size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: `Mesures collectées : ${rapport.nbMesuresTotal} relevés`, color: '888888', size: 18 })] }),
        new Paragraph({ text: '' }),
        new Paragraph({ text: 'Statistiques par axe routier', heading: HeadingLevel.HEADING_2 }),
        new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Données : Google Distance Matrix / TomTom · PAA Abidjan · FlowPort v2', color: 'AAAAAA', size: 16 })] }),
      ],
    }],
  })

  const blob = await Packer.toBlob(docx)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `${rapport.nom}.docx`; a.click()
  URL.revokeObjectURL(url)
}

// ── Page principale ───────────────────────────────────────────

function RapportsPage() {
  const { mesures } = useTrafficData()
  const [type,     setType]     = useState('journalier')
  const [periode,  setPeriode]  = useState(new Date().toISOString().slice(0, 10))
  const [format,   setFormat]   = useState('pdf')
  const [rapports, setRapports] = useState([])
  const [loading,  setLoading]  = useState(false)

  async function genererRapport() {
    setLoading(true)
    try {
      const records      = await fetchPeriodData(type, periode)
      const rows         = aggregerParAxe(records, mesures)
      const { label }    = getPeriodeBounds(type, periode)
      const nbMesuresTotal = records.length
      const nom          = `PAA-${type.charAt(0).toUpperCase() + type.slice(1)}-${periode}`

      setRapports(prev => [{
        id: Date.now(), nom, type, periode,
        periodeLabel:  label,
        format, date:  new Date(),
        rows, nbMesuresTotal,
      }, ...prev])
    } catch (err) {
      console.error('Erreur génération rapport :', err)
      // Fallback live si Firestore inaccessible
      const rows = aggregerParAxe([], mesures)
      const nom  = `PAA-${type.charAt(0).toUpperCase() + type.slice(1)}-${periode}`
      setRapports(prev => [{
        id: Date.now(), nom, type, periode,
        periodeLabel:  periode,
        format, date:  new Date(),
        rows, nbMesuresTotal: 0,
      }, ...prev])
    } finally {
      setLoading(false)
    }
  }

  async function telecharger(rapport, fmt) {
    const rows = rapport.rows ?? []
    if (fmt === 'pdf')        telechargerPDF(rapport, rows)
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
              {loading ? 'Chargement données...' : 'Générer le rapport'}
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
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: 2 }}>
                        <p style={{ fontSize: 11, color: C.textMuted }}>{r.type} · {r.periodeLabel}</p>
                        {r.nbMesuresTotal > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#27AE60', fontWeight: 600 }}>
                            <Database size={9} /> {r.nbMesuresTotal} mesures
                          </span>
                        )}
                        {r.nbMesuresTotal === 0 && (
                          <span style={{ fontSize: 10, color: '#E67E22', fontWeight: 600 }}>données live uniquement</span>
                        )}
                      </div>
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
