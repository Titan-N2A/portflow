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

const HEURES_LABELS = Array.from({ length: 24 }, (_, i) => `${i}h`)
const PALETTE       = ['#1B4F8A', '#E67E22', '#27AE60', '#8E44AD', '#C0392B']
const JOURS_LABELS  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_ORDRE   = [1, 2, 3, 4, 5, 6, 0]

// Seuls les 3 axes officiels PAA — exclut les axes de test admin
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

const BASE_FONT = { family: 'Inter', size: 11 }

const CHART_OPTIONS_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 350 },
  plugins: {
    legend: {
      labels: { font: { ...BASE_FONT, size: 12 }, color: C.text, padding: 20, usePointStyle: true, pointStyleWidth: 10 },
    },
    tooltip: {
      backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1,
      titleColor: C.text, bodyColor: C.textMuted,
      titleFont: { family: 'Inter', weight: '600', size: 12 },
      bodyFont: BASE_FONT,
      cornerRadius: 8, padding: 12,
    },
  },
  scales: {
    x: {
      grid: { color: '#f0f4f8' },
      ticks: { font: BASE_FONT, color: C.textMuted, maxRotation: 0 },
      border: { display: false },
    },
    y: {
      grid: { color: '#f0f4f8' },
      ticks: { font: BASE_FONT, color: C.textMuted },
      border: { display: false },
    },
  },
}

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
      fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif",
      background: active ? C.primary : '#f0f4f8',
      color: active ? '#fff' : C.textMuted,
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )
}

function EmptyChart({ height = 280 }) {
  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke="#e2e8f0" strokeWidth="2"/>
        <path d="M12 28 L17 20 L22 23 L27 14" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, margin: 0 }}>Données insuffisantes</p>
      <p style={{ fontSize: 11, color: C.textLight, margin: 0 }}>Les mesures s&apos;accumulent toutes les 10 min</p>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="fp-spin" style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${C.primary}20`, borderTopColor: C.primary,
          margin: '0 auto 12px',
        }} />
        <p style={{ color: C.textMuted, fontSize: 13 }}>Chargement…</p>
      </div>
    </div>
  )
}

function GraphiquesPage() {
  const { data: collecteData, loading: collecteLoading } = useCollecteAuto(8000)
  const { data: histoData,    loading: histoLoading    } = useHistoricalData()
  const { axes: firestoreAxes } = useAxesFirestore()

  // Filtrer aux 3 axes officiels PAA uniquement (évite les axes de test admin)
  const officialFSAxes = firestoreAxes.filter(a => AXES_OFFICIELS_IDS.has(a.id))
  const baseAxes = officialFSAxes.length > 0 ? officialFSAxes : AXES_OFFICIELS

  const axeDefs = baseAxes.map((axe, idx) => ({
    id:    axe.id,
    label: axe.shortNom ?? axe.nom ?? axe.id,
    color: AXE_COLORS[axe.id] ?? PALETTE[idx % PALETTE.length],
    dist:  parseFloat(String(axe.dist ?? axe.distance)) || 10,
    tRef:  axe.tRef ?? 20,
  }))

  const [source,    setSource]    = useState('live')
  const [lineDir,   setLineDir]   = useState('aller')
  const [axeFilter, setAxeFilter] = useState('tous')
  const [periode,   setPeriode]   = useState('tous')
  const [hmAxe,     setHmAxe]     = useState('axe1')
  const [hmSens,    setHmSens]    = useState('aller')

  const data    = source === 'live' ? collecteData : histoData
  const loading = source === 'live' ? collecteLoading : histoLoading

  const liveCount = collecteData.filter(d => AXES_OFFICIELS_IDS.has(d.axeId)).length

  function tsToMs(ts) {
    if (!ts) return 0
    return typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime()
  }

  const data24h = useMemo(() => {
    if (source !== 'live') return data
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return data.filter(d => tsToMs(d.timestamp) >= cutoff)
  }, [data, source])

  const data7d = useMemo(() => {
    if (source !== 'live') return data
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return data.filter(d => tsToMs(d.timestamp) >= cutoff)
  }, [data, source])

  const live24hCount = data24h.filter(d => AXES_OFFICIELS_IDS.has(d.axeId)).length

  // ── Courbes 24h ─────────────────────────────────────────────
  const lineDatasets = useMemo(() => axeDefs.map(axe => {
    const courbe     = computeCourbe24h(data24h, axe.id, lineDir)
    const dataPoints = courbe.map(p => p.temps_moyen)
    return {
      label:                axe.label,
      data:                 dataPoints,
      borderColor:          axe.color,
      backgroundColor:      `${axe.color}18`,
      tension:              0.35,
      fill:                 true,
      spanGaps:             true,                            // relie les points au travers des heures sans données
      pointRadius:          dataPoints.map(v => v != null ? 5 : 0),
      pointHoverRadius:     7,
      pointBackgroundColor: '#fff',
      pointBorderColor:     axe.color,
      pointBorderWidth:     2,
      borderWidth:          2.5,
    }
  }), [data24h, axeDefs.map(a => a.id).join(), lineDir])

  const filteredLineDatasets = axeFilter === 'tous'
    ? lineDatasets
    : lineDatasets.filter((_, i) => i === parseInt(axeFilter))

  const lineData    = { labels: HEURES_LABELS, datasets: filteredLineDatasets }
  const lineHasData = filteredLineDatasets.some(ds => ds.data.some(v => v != null))

  // ── Heatmap ──────────────────────────────────────────────────
  const heatmapGrid = useMemo(
    () => computeHeatmap(data7d, hmAxe, hmSens),
    [data7d, hmAxe, hmSens],
  )

  function getHeatCell(jour, heure) {
    return heatmapGrid.find(c => c.jour === jour && c.heure === heure)
  }

  // ── Min / Moyen / Max ────────────────────────────────────────
  const minMaxData = useMemo(() => {
    const stats  = computeMinMaxParAxe(data24h, axeDefs)
    const hasAny = stats.some(s => s.moy > 0)
    if (!hasAny) return null
    return {
      labels: axeDefs.map(a => a.label),
      datasets: [
        { label: 'Min',   data: stats.map(s => s.min), backgroundColor: 'rgba(27,79,138,0.80)',  borderRadius: 6, borderSkipped: false },
        { label: 'Moyen', data: stats.map(s => s.moy), backgroundColor: 'rgba(230,126,34,0.85)', borderRadius: 6, borderSkipped: false },
        { label: 'Max',   data: stats.map(s => s.max), backgroundColor: 'rgba(192,57,43,0.85)',  borderRadius: 6, borderSkipped: false },
      ],
    }
  }, [data24h, axeDefs.map(a => a.id).join()])

  // ── Donut répartition niveaux ────────────────────────────────
  const repartition  = useMemo(() => computeRepartitionNiveaux(data24h, periode), [data24h, periode])
  const donutHasData = repartition.some(r => r.count > 0)
  const donutData    = {
    labels:   repartition.map(r => `${r.label} (${r.pct}%)`),
    datasets: [{
      data:            repartition.map(r => r.count),
      backgroundColor: ['#1E8449', '#27AE60', '#F1C40F', '#C0392B'],
      borderColor:     '#fff',
      borderWidth:     3,
      hoverOffset:     10,
    }],
  }

  if (loading) return <Spinner />

  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>Graphiques</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            {source === 'live'
              ? <><strong>{live24hCount}</strong> mesures (24 h) · <strong>{liveCount}</strong> au total</>
              : <><strong>{histoData.length}</strong> mesures · Historique PAA février 2025</>
            }
          </p>
        </div>
        <div style={{
          display: 'flex', background: '#fff', borderRadius: 8,
          overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0', flexShrink: 0,
        }}>
          {[['live', 'Collecte live'], ['historique', 'Historique PAA']].map(([val, lbl]) => (
            <button key={val} onClick={() => setSource(val)} style={{
              padding: '6px 18px', border: 'none', cursor: 'pointer',
              background: source === val ? C.primary : 'transparent',
              color: source === val ? '#fff' : C.text,
              fontWeight: 600, fontSize: 12, fontFamily: "'Inter', sans-serif",
              transition: 'all 0.15s',
            }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ── G1 — Courbe 24h ───────────────────────────────────── */}
      <div className="fp-card" style={{ flexShrink: 0 }}>
        <div className="fp-section-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="fp-section-title">Temps de traversée moyen par heure</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <Pill active={lineDir === 'aller'}  onClick={() => setLineDir('aller')}>Aller</Pill>
              <Pill active={lineDir === 'retour'} onClick={() => setLineDir('retour')}>Retour</Pill>
            </div>
          </div>
          <select className="fp-select" style={{ width: 'auto', alignSelf: 'flex-start' }} value={axeFilter} onChange={e => setAxeFilter(e.target.value)}>
            <option value="tous">Tous les axes</option>
            {axeDefs.map((axe, i) => (
              <option key={axe.id} value={String(i)}>{axe.label}</option>
            ))}
          </select>
        </div>

        {lineHasData ? (
          <div style={{ height: 300 }}>
            <Line data={lineData} options={{
              ...CHART_OPTIONS_BASE,
              spanGaps: true,
              plugins: {
                ...CHART_OPTIONS_BASE.plugins,
                legend: { ...CHART_OPTIONS_BASE.plugins.legend, position: 'top' },
                title: { display: false },
              },
              scales: {
                ...CHART_OPTIONS_BASE.scales,
                x: {
                  ...CHART_OPTIONS_BASE.scales.x,
                  ticks: {
                    ...CHART_OPTIONS_BASE.scales.x.ticks,
                    callback: (_, i) => i % 3 === 0 ? HEURES_LABELS[i] : '',
                  },
                },
                y: {
                  ...CHART_OPTIONS_BASE.scales.y,
                  beginAtZero: false,
                  title: { display: true, text: 'minutes', font: BASE_FONT, color: C.textMuted },
                },
              },
            }} />
          </div>
        ) : (
          <EmptyChart height={300} />
        )}
      </div>

      {/* ── G2 + G4 ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>

        {/* G2 — Histogramme Min/Moyen/Max */}
        <div className="fp-card" style={{ flex: 1, minWidth: 0 }}>
          <div className="fp-section-header">
            <span className="fp-section-title">Min / Moyen / Max par axe</span>
          </div>
          {minMaxData ? (
            <div style={{ height: 240 }}>
              <Bar data={minMaxData} options={{
                ...CHART_OPTIONS_BASE,
                plugins: {
                  ...CHART_OPTIONS_BASE.plugins,
                  legend: { ...CHART_OPTIONS_BASE.plugins.legend, position: 'top' },
                  title: { display: false },
                },
                scales: {
                  ...CHART_OPTIONS_BASE.scales,
                  y: {
                    ...CHART_OPTIONS_BASE.scales.y,
                    beginAtZero: true,
                    title: { display: true, text: 'minutes', font: BASE_FONT, color: C.textMuted },
                  },
                },
              }} />
            </div>
          ) : (
            <EmptyChart height={240} />
          )}
        </div>

        {/* G4 — Donut répartition niveaux */}
        <div className="fp-card" style={{ flex: 1, minWidth: 0 }}>
          <div className="fp-section-header">
            <span className="fp-section-title">Répartition par niveau</span>
            <select className="fp-select" style={{ width: 'auto' }} value={periode} onChange={e => setPeriode(e.target.value)}>
              <option value="tous">Tous les jours</option>
              <option value="ouvrable">Jours ouvrables</option>
              <option value="weekend">Week-end</option>
            </select>
          </div>
          {donutHasData ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Doughnut data={donutData} options={{
                responsive: true, maintainAspectRatio: false, cutout: '64%',
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { font: BASE_FONT, color: C.text, padding: 12, usePointStyle: true },
                  },
                  tooltip: CHART_OPTIONS_BASE.plugins.tooltip,
                  title: { display: false },
                },
              }} />
            </div>
          ) : (
            <EmptyChart height={220} />
          )}
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
                {JOURS_ORDRE.map((_, idx) => (
                  <th key={idx} style={{
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
              {Array.from({ length: 24 }, (_, i) => i).map(heure => (
                <tr key={heure}>
                  <td style={{
                    fontSize: 10, color: C.textMuted, textAlign: 'right',
                    paddingRight: 8, fontFamily: 'monospace', whiteSpace: 'nowrap',
                  }}>
                    {heure}h
                  </td>
                  {JOURS_ORDRE.map((jour, jIdx) => {
                    const cell    = getHeatCell(jour, heure)
                    const hasData = cell?.niveau > 0
                    const color   = hasData ? levelColor(cell.niveau) : null
                    return (
                      <td key={jour} style={{ padding: '2px' }}>
                        <div
                          title={hasData
                            ? `${JOURS_LABELS[jIdx]} ${heure}h — ${cell.moyenne} min · N${cell.niveau} ${levelLabel(cell.niveau)}`
                            : `${JOURS_LABELS[jIdx]} ${heure}h — Pas de données`
                          }
                          style={{
                            width: 30, height: 18, borderRadius: 4,
                            background: hasData ? `${color}CC` : '#f0f4f8',
                            border:     `1px solid ${hasData ? `${color}40` : '#e2e8f0'}`,
                            boxShadow:  hasData && cell.niveau >= 4 ? `0 0 5px ${color}50` : 'none',
                            cursor: 'default', transition: 'transform 0.1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter',sans-serif" }}>
              Niveau
            </span>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: `${levelColor(n)}CC`, border: `1px solid ${levelColor(n)}40` }} />
                <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}>{levelLabel(n)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f0f4f8', border: '1px solid #e2e8f0' }} />
              <span style={{ fontSize: 10, color: C.textLight, fontFamily: "'Inter',sans-serif" }}>Pas de données</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default GraphiquesPage
