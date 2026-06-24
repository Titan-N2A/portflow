import { useState, useEffect } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { C } from '../styles/tokens'
import { AXES_OFFICIELS } from '../hooks/useTrafficData'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

// ── Données simulées réalistes pour les graphiques ─────────
const HEURES = ['7h','8h','9h','10h','11h','12h','13h','14h','15h','16h','17h','18h']

function genCurve(base, seed) {
  return HEURES.map((_, i) => {
    const rush = (i === 1 || i === 2 || i === 9 || i === 10) ? 1.4 : 1
    const noise = 0.9 + Math.sin((i + seed) * 2.3) * 0.15
    return Math.round(base * rush * noise * 10) / 10
  })
}

const TRAVERSEE_DATA = {
  labels: HEURES,
  datasets: [
    {
      label: 'CARENA',
      data: genCurve(27.4, 1),
      borderColor: '#1B4F8A', backgroundColor: 'rgba(27,79,138,0.08)',
      tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6,
      pointBackgroundColor: '#1B4F8A',
    },
    {
      label: 'Toyota CFAO',
      data: genCurve(16.9, 3),
      borderColor: '#E67E22', backgroundColor: 'rgba(230,126,34,0.08)',
      tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6,
      pointBackgroundColor: '#E67E22',
    },
    {
      label: 'Agence SODECI',
      data: genCurve(17.8, 5),
      borderColor: '#27AE60', backgroundColor: 'rgba(39,174,96,0.08)',
      tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 6,
      pointBackgroundColor: '#27AE60',
    },
  ],
}

const MINMAX_DATA = {
  labels: ['CARENA', 'Toyota CFAO', 'Agence SODECI'],
  datasets: [
    {
      label: 'Min',
      data: [22, 13, 14],
      backgroundColor: 'rgba(27,79,138,0.75)', borderRadius: 5, borderSkipped: false,
    },
    {
      label: 'Moyen',
      data: [32, 20, 22],
      backgroundColor: 'rgba(230,126,34,0.85)', borderRadius: 5, borderSkipped: false,
    },
    {
      label: 'Max',
      data: [48, 31, 35],
      backgroundColor: 'rgba(192,57,43,0.85)', borderRadius: 5, borderSkipped: false,
    },
  ],
}

const DONUT_DATA = {
  labels: ['N1 Fluide', 'N2 Bon', 'N3 Ralenti', 'N4 Congestionné', 'N5 Très congestionné'],
  datasets: [{
    data: [28, 32, 20, 13, 7],
    backgroundColor: ['#1E8449', '#27AE60', '#F1C40F', '#E67E22', '#C0392B'],
    borderColor: '#fff',
    borderWidth: 3,
    hoverOffset: 8,
  }],
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
    x: {
      grid: { color: '#f0f4f8' },
      ticks: { font: { family: 'Inter', size: 11 }, color: C.textMuted },
    },
    y: {
      grid: { color: '#f0f4f8' },
      ticks: { font: { family: 'Inter', size: 11 }, color: C.textMuted },
    },
  },
}

function GraphiquesPage() {
  const [axeFilter, setAxeFilter] = useState('tous')

  const filteredDatasets = axeFilter === 'tous'
    ? TRAVERSEE_DATA.datasets
    : TRAVERSEE_DATA.datasets.filter((_, i) => i === parseInt(axeFilter))

  const traverseeData = { ...TRAVERSEE_DATA, datasets: filteredDatasets }

  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Graphiques</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Analyse historique et comparative des axes routiers</p>
      </div>

      {/* G1 — Courbe temporelle */}
      <div className="fp-card" style={{ flexShrink: 0 }}>
        <div className="fp-section-header">
          <span className="fp-section-title">Temps de traversée par axe</span>
          <select
            className="fp-select"
            style={{ width: 'auto' }}
            value={axeFilter}
            onChange={e => setAxeFilter(e.target.value)}
          >
            <option value="tous">Tous les axes</option>
            <option value="0">CARENA</option>
            <option value="1">Toyota CFAO</option>
            <option value="2">Agence SODECI</option>
          </select>
        </div>
        <div style={{ height: '240px' }}>
          <Line
            data={traverseeData}
            options={{
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
            }}
          />
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
            <Bar
              data={MINMAX_DATA}
              options={{
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
              }}
            />
          </div>
        </div>

        {/* G4 — Donut répartition niveaux */}
        <div className="fp-card" style={{ flex: 1 }}>
          <div className="fp-section-header">
            <span className="fp-section-title">Répartition par niveau</span>
          </div>
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut
              data={DONUT_DATA}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '62%',
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Inter', size: 11 }, color: C.text, padding: 10, usePointStyle: true },
                  },
                  tooltip: CHART_OPTIONS_BASE.plugins.tooltip,
                  title: { display: false },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default GraphiquesPage
