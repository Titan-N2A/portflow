import { useState, useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { C } from '../styles/tokens'
import { useCollecteAuto } from '../hooks/useCollecteAuto'
import { useAxesFirestore } from '../hooks/useAxesFirestore'
import { AXES_OFFICIELS, AXE_COLORS } from '../hooks/useTrafficData'
import { computeCourbe24h, computeRepartitionNiveaux } from '../services/aggregations'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const HEURES_LABELS = ['7h','8h','9h','10h','11h','12h','13h','14h','15h','16h','17h','18h']
const PALETTE = ['#1B4F8A', '#E67E22', '#27AE60', '#8E44AD', '#C0392B']

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
      bodyFont: { family: 'Inter' },
      cornerRadius: 8, padding: 10,
    },
  },
  scales: {
    x: { grid: { color: '#f0f4f8' }, ticks: { font: { family: 'Inter', size: 11 }, color: C.textMuted } },
    y: { grid: { color: '#f0f4f8' }, ticks: { font: { family: 'Inter', size: 11 }, color: C.textMuted } },
  },
}

function Spinner() {
  return (
    <div style={{ padding: '1.25rem', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="fp-spin" style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${C.primary}20`,
          borderTopColor: C.primary,
          margin: '0 auto 12px',
        }} />
        <p style={{ color: C.textMuted, fontSize: 13 }}>Chargement des données collectées…</p>
      </div>
    </div>
  )
}

function GraphiquesPage() {
  const { data, loading } = useCollecteAuto(5000)
  const { axes: firestoreAxes } = useAxesFirestore()
  const baseAxes = firestoreAxes.length > 0 ? firestoreAxes : AXES_OFFICIELS
  const axeDefs = baseAxes.map((axe, idx) => ({
    id:    axe.id,
    label: axe.shortNom,
    color: AXE_COLORS[axe.id] ?? PALETTE[idx % PALETTE.length],
    dist:  parseFloat(String(axe.dist)) || 10,
    tRef:  axe.tRef ?? 20,
  }))

  const [axeFilter, setAxeFilter] = useState('tous')
  const [periode,   setPeriode]   = useState('tous')

  // Courbes 24h par axe (données réelles Firestore)
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
  }), [data])

  const filteredLineDatasets = axeFilter === 'tous'
    ? lineDatasets
    : lineDatasets.filter((_, i) => i === parseInt(axeFilter))

  const lineData = { labels: HEURES_LABELS, datasets: filteredLineDatasets }

  // Min / Moyen / Max par axe (données réelles)
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
  }, [data])

  // Répartition niveaux (données réelles)
  const repartition = useMemo(() => computeRepartitionNiveaux(data, periode), [data, periode])
  const donutData = {
    labels: repartition.map(r => `${r.label} (${r.pct}%)`),
    datasets: [{
      data:            repartition.map(r => r.count),
      backgroundColor: ['#1E8449', '#27AE60', '#F1C40F', '#C0392B'],
      borderColor:     '#fff',
      borderWidth:     3,
      hoverOffset:     8,
    }],
  }

  if (loading) return <Spinner />

  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Graphiques</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
          Données collectées automatiquement · <strong>{data.length}</strong> mesures · {axeDefs.length} axes surveillés
        </p>
      </div>

      {/* G1 — Courbe 24h */}
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
              title: { display: false },
            },
            scales: {
              ...CHART_OPTIONS_BASE.scales,
              y: { ...CHART_OPTIONS_BASE.scales.y, title: { display: true, text: 'minutes', font: { family: 'Inter', size: 11 }, color: C.textMuted } },
            },
          }} />
        </div>
      </div>

      {/* G2 + G4 */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>

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
                title: { display: false },
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
                legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 11 }, color: C.text, padding: 10, usePointStyle: true } },
                tooltip: CHART_OPTIONS_BASE.plugins.tooltip,
                title: { display: false },
              },
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default GraphiquesPage
