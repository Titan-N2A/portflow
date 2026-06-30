import { useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { C, levelColor, levelLabel } from '../styles/tokens'
import { useCollecteAuto }   from '../hooks/useCollecteAuto'
import { useHistoricalData } from '../hooks/useHistoricalData'
import { useAxesFirestore }  from '../hooks/useAxesFirestore'
import { AXES_OFFICIELS, AXE_COLORS } from '../hooks/useTrafficData'
import { computeCourbe24h, computeRepartitionNiveaux, computeHeatmap } from '../services/aggregations'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const HEURES_LABELS = ['0h','1h','2h','3h','4h','5h','6h','7h','8h','9h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h','21h','22h','23h']
const PALETTE       = ['#1B4F8A', '#E67E22', '#27AE60', '#8E44AD', '#C0392B']
const JOURS_LABELS  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_ORDRE   = [1, 2, 3, 4, 5, 6, 0] // JS .getDay() : lundi=1 ... dimanche=0

// IDs officiels PAA — on exclut les axes de test admin (axe_178...)
const AXES_OFFICIELS_IDS = new Set(['axe1', 'axe2', 'axe3'])

function computeMinMaxParAxe(data, axeDefs) {
  return axeDefs.map(axe => {
    const vals = data
      .filter(d => d.axeId === axe.id && d.sens === 'aller')
      .map(d => d.temps_min)
      .filter(v => v != null)
    if (!vals.length) return { min: 0, moy: 0, max: 0 }
    return {
      min: Math.round(Math.min(...vals) * 10) / 10,
      moy: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10,
      max: Math.round(Math.max(...vals) * 10) / 10,
    }
  })
}

const CHART_OPTIONS_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { font: { family: 'Inter', size: 12 }, color: C.text, padding: 16, usePointStyle: true, pointStyleWidth: 8 },
    },
    tooltip: {
      backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1,
      titleColor: C.text, bodyColor: C.textMuted,
      titleFont: { family: 'Inter', weight: '600' },
      bodyFont:  { family: 'Inter' },
      cornerRadius: 8, padding: 10,
    },
  },
  scales: {
    x: { grid: { color: '#f0f4f8' }, ticks: { font: { family: 'Inter', size: 11 }, color: C.textMuted } },
    y: { grid: { color: '#f0f4f8' }, ticks: { font: { family: 'Inter', size: 11 }, color: C.textMuted } },
  },
}

function Spinner({ msg }) {
  return (
    <div style={{ padding: '1.25rem', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="fp-spin" style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${C.primary}20`, borderTopColor: C.primary,
          margin: '0 auto 12px',
        }} />
        <p style={{ color: C.textMuted, fontSize: 13 }}>{msg}</p>
      </div>
    </div>
  )
}

function GraphiquesPage() {
  // Les deux sources — toujours chargées pour que le switch soit instantané
  const { data: collecteData, loading: collecteLoading } = useCollecteAuto(5000)
  const { data: histoData,    loading: histoLoading    } = useHistoricalData()
  const { axes: firestoreAxes } = useAxesFirestore()

  const baseAxes = firestoreAxes.length > 0 ? firestoreAxes : AXES_OFFICIELS
  const axeDefs  = baseAxes.map((axe, idx) => ({
    id:    axe.id,
    label: axe.shortNom,
    color: AXE_COLORS[axe.id] ?? PALETTE[idx % PALETTE.length],
    dist:  parseFloat(String(axe.dist)) || 10,
    tRef:  axe.tRef ?? 20,
  }))

  const [source,    setSource]    = useState('live')   // 'live' | 'historique'
  const [axeFilter, setAxeFilter] = useState('tous')
  const [periode,   setPeriode]   = useState('tous')
  const [hmAxe,     setHmAxe]     = useState('axe1')
  const [hmSens,    setHmSens]    = useState('aller')

  const data    = source === 'live' ? collecteData : histoData
  const loading = source === 'live' ? collecteLoading : histoLoading

  // Compteurs pour les labels du sélecteur
  const liveCount = collecteData.filter(d => AXES_OFFICIELS_IDS.has(d.axeId)).length

  // ── Courbes 24h ─────────────────────────────────────────────
  const lineDatasets = useMemo(() => axeDefs.map(axe => {
    const courbe = computeCourbe24h(data, axe.id, 'aller')
    return {
      label:                axe.label,
      data:                 courbe.map(p => p.temps_moyen),
      borderColor:          axe.color,
      backgroundColor:      `${axe.color}14`,
      tension:              0.4,
      fill:                 true,
      pointRadius:          4,
      pointHoverRadius:     6,
      pointBackgroundColor: axe.color,
    }
  }), [data, axeDefs.map(a => a.id).join()])

  const filteredLineDatasets = axeFilter === 'tous'
    ? lineDatasets
    : lineDatasets.filter((_, i) => i === parseInt(axeFilter))

  const lineData = { labels: HEURES_LABELS, datasets: filteredLineDatasets }

  // ── Heatmap ──────────────────────────────────────────────────
  const heatmapGrid = useMemo(
    () => computeHeatmap(data, hmAxe, hmSens),
    [data, hmAxe, hmSens],
  )

  function getHeatCell(jour, heure) {
    return heatmapGrid.find(c => c.jour === jour && c.heure === heure)
  }

  // ── Min / Moyen / Max ────────────────────────────────────────
  const minMaxData = useMemo(() => {
    const stats = computeMinMaxParAxe(data, axeDefs)
    return {
      labels: axeDefs.map(a => a.label),
      datasets: [
        { label: 'Min',   data: stats.map(s => s.min), backgroundColor: 'rgba(27,79,138,0.75)',  borderRadius: 5, borderSkipped: false },
        { label: 'Moyen', data: stats.map(s => s.moy), backgroundColor: 'rgba(230,126,34,0.85)', borderRadius: 5, borderSkipped: false },
        { label: 'Max',   data: stats.map(s => s.max), backgroundColor: 'rgba(192,57,43,0.85)',  borderRadius: 5, borderSkipped: false },
      ],
    }
  }, [data, axeDefs.map(a => a.id).join()])

  // ── Donut répartition niveaux ────────────────────────────────
  const repartition = useMemo(() => computeRepartitionNiveaux(data, periode), [data, periode])
  const donutData   = {
    labels: repartition.map(r => `${r.label} (${r.pct}%)`),
    datasets: [{
      data:            repartition.map(r => r.count),
      backgroundColor: ['#1E8449', '#27AE60', '#F1C40F', '#C0392B'],
      borderColor:     '#fff',
      borderWidth:     3,
      hoverOffset:     8,
    }],
  }

  if (loading) return (
    <Spinner msg={source === 'live'
      ? 'Chargement des données collectées…'
      : 'Chargement de l\'historique PAA…'
    } />
  )

  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Header + sélecteur de source ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Graphiques</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            {source === 'live' ? (
              <>Collecte TomTom · <strong>{liveCount}</strong> mesures (axes officiels) · juin 2026</>
            ) : (
              <>Historique PAA · <strong>{histoData.length}</strong> mesures · Référence février 2025</>
            )}
          </p>
        </div>

        <div style={{
          display: 'flex', background: '#fff', borderRadius: '8px',
          overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0', flexShrink: 0,
        }}>
          {[
            ['live',       'Collecte live'],
            ['historique', 'Historique PAA'],
          ].map(([val, label]) => (
            <button key={val} onClick={() => setSource(val)} style={{
              padding: '6px 16px', border: 'none', cursor: 'pointer',
              background: source === val ? C.primary : 'transparent',
              color:      source === val ? '#fff' : C.text,
              fontWeight: 600, fontSize: 12,
              fontFamily: "'Inter', sans-serif", transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── G1 — Courbe 24h ───────────────────────────────────── */}
      <div className="fp-card" style={{ flexShrink: 0 }}>
        <div className="fp-section-header">
          <span className="fp-section-title">Temps de traversée moyen par heure</span>
          <select className="fp-select" style={{ width: 'auto' }} value={axeFilter} onChange={e => setAxeFilter(e.target.value)}>
            <option value="tous">Tous les axes</option>
            {axeDefs.map((axe, i) => (
              <option key={axe.id} value={String(i)}>{axe.label}</option>
            ))}
          </select>
        </div>
        <div style={{ height: '240px' }}>
          <Line data={lineData} options={{
            ...CHART_OPTIONS_BASE,
            plugins: {
              ...CHART_OPTIONS_BASE.plugins,
              legend: { ...CHART_OPTIONS_BASE.plugins.legend, position: 'top' },
              title:  { display: false },
            },
            scales: {
              ...CHART_OPTIONS_BASE.scales,
              y: { ...CHART_OPTIONS_BASE.scales.y, title: { display: true, text: 'minutes', font: { family: 'Inter', size: 11 }, color: C.textMuted } },
            },
          }} />
        </div>
      </div>

      {/* ── G3 — Heatmap congestion ───────────────────────────── */}
      <div className="fp-card" style={{ flexShrink: 0 }}>
        <div className="fp-section-header">
          <span className="fp-section-title">Heatmap congestion — heure × jour</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select className="fp-select" style={{ width: 'auto' }} value={hmAxe} onChange={e => setHmAxe(e.target.value)}>
              {axeDefs.map(axe => (
                <option key={axe.id} value={axe.id}>{axe.label}</option>
              ))}
            </select>
            <select className="fp-select" style={{ width: 'auto' }} value={hmSens} onChange={e => setHmSens(e.target.value)}>
              <option value="aller">Aller</option>
              <option value="retour">Retour</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: '3px', margin: '0 auto' }}>
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                {JOURS_ORDRE.map((j, idx) => (
                  <th key={j} style={{
                    fontSize: 10, fontWeight: 700, color: C.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '0 4px', textAlign: 'center',
                    fontFamily: "'Inter',sans-serif",
                  }}>
                    {JOURS_LABELS[idx]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => i + 7).map(heure => (
                <tr key={heure}>
                  <td style={{
                    fontSize: 10, color: C.textMuted, textAlign: 'right',
                    paddingRight: 8, fontFamily: 'monospace', whiteSpace: 'nowrap',
                  }}>
                    {heure}h
                  </td>
                  {JOURS_ORDRE.map(jour => {
                    const cell    = getHeatCell(jour, heure)
                    const hasData = cell?.niveau > 0
                    const color   = hasData ? levelColor(cell.niveau) : null
                    const jourIdx = JOURS_ORDRE.indexOf(jour)
                    return (
                      <td key={jour} style={{ padding: '2px' }}>
                        <div
                          title={hasData
                            ? `${JOURS_LABELS[jourIdx]} ${heure}h — ${cell.moyenne} min · N${cell.niveau} ${levelLabel(cell.niveau)}`
                            : `${JOURS_LABELS[jourIdx]} ${heure}h — Pas de données`
                          }
                          style={{
                            width: 34, height: 22, borderRadius: 4,
                            background: hasData ? `${color}CC` : '#f0f4f8',
                            border:     `1px solid ${hasData ? `${color}40` : '#e2e8f0'}`,
                            boxShadow:  hasData && cell.niveau >= 4 ? `0 0 5px ${color}50` : 'none',
                            cursor: 'default', transition: 'transform 0.12s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.25)' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Légende niveaux */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter',sans-serif" }}>
              Niveau
            </span>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 3,
                  background: `${levelColor(n)}CC`,
                  border:     `1px solid ${levelColor(n)}40`,
                }} />
                <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}>
                  {levelLabel(n)}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f0f4f8', border: '1px solid #e2e8f0' }} />
              <span style={{ fontSize: 10, color: C.textLight, fontFamily: "'Inter',sans-serif" }}>
                Pas de données
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── G2 + G4 ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>

        {/* G2 — Histogramme Min/Moyen/Max */}
        <div className="fp-card" style={{ flex: 1 }}>
          <div className="fp-section-header">
            <span className="fp-section-title">Min / Moyen / Max par axe</span>
          </div>
          <div style={{ height: '240px' }}>
            <Bar data={minMaxData} options={{
              ...CHART_OPTIONS_BASE,
              plugins: {
                ...CHART_OPTIONS_BASE.plugins,
                legend: { ...CHART_OPTIONS_BASE.plugins.legend, position: 'top' },
                title:  { display: false },
              },
              scales: {
                ...CHART_OPTIONS_BASE.scales,
                y: { ...CHART_OPTIONS_BASE.scales.y, title: { display: true, text: 'minutes', font: { family: 'Inter', size: 11 }, color: C.textMuted } },
              },
            }} />
          </div>
        </div>

        {/* G4 — Donut répartition niveaux */}
        <div className="fp-card" style={{ flex: 1 }}>
          <div className="fp-section-header">
            <span className="fp-section-title">Répartition par niveau</span>
            <select className="fp-select" style={{ width: 'auto' }} value={periode} onChange={e => setPeriode(e.target.value)}>
              <option value="tous">Tous les jours</option>
              <option value="ouvrable">Jours ouvrables</option>
              <option value="weekend">Week-end</option>
            </select>
          </div>
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={donutData} options={{
              responsive: true, maintainAspectRatio: false, cutout: '62%',
              plugins: {
                legend:  { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, color: C.text, padding: 10, usePointStyle: true } },
                tooltip: CHART_OPTIONS_BASE.plugins.tooltip,
                title:   { display: false },
              },
            }} />
          </div>
        </div>
      </div>

    </div>
  )
}

export default GraphiquesPage
