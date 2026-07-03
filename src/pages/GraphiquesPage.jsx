import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Clock, AlertTriangle, Gauge, CalendarDays } from 'lucide-react'
import { C, levelColor, levelLabel, levelBg } from '../styles/tokens'
import { useCollecteAuto }   from '../hooks/useCollecteAuto'
import { useHistoricalData } from '../hooks/useHistoricalData'
import { useAxesFirestore }  from '../hooks/useAxesFirestore'
import { AXES_OFFICIELS, AXE_COLORS } from '../hooks/useTrafficData'
import { computeCourbe24h, computeRepartitionNiveaux } from '../services/aggregations'
import { computeNiveau } from '../services/indicators'
import { getReference } from '../data/references'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const HEURES_LABELS = Array.from({ length: 24 }, (_, i) => `${i}h`)
const PALETTE       = ['#1B4F8A', '#E67E22', '#27AE60', '#8E44AD', '#C0392B']
const MOIS_COURTS   = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

// Couleur heatmap alignée sur l'échelle N1-N5 canonique (styles/tokens.js) —
// utilisée partout ailleurs dans l'app (carte, badges KPI). Texte clair sur
// les niveaux foncés (N4/N5), texte sombre sur les niveaux clairs.
function heatColorNiveau(niveau) {
  return { bg: levelColor(niveau), fg: niveau >= 4 ? '#fff' : '#1a2e1a' }
}

const JOURS_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_ORDRE  = [1, 2, 3, 4, 5, 6, 0]  // lundi en premier

// Seuls les 3 axes officiels PAA — exclut les axes de test admin
const AXES_OFFICIELS_IDS = new Set(['axe1', 'axe2', 'axe3'])

function computeMinMaxParAxe(data, axeDefs, sens) {
  return axeDefs.map(axe => {
    const vals = data
      .filter(d => d.axeId === axe.id && d.sens === sens)
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

// Bandeau de synthèse — même langage visuel que les KPICard du Dashboard
// (icône, libellé, valeur, badge de niveau coloré).
function StatTile({ icon: Icon, iconColor, label, value, unit, niveau }) {
  return (
    <div className="fp-card" style={{ flex: 1, minWidth: 0, padding: '0.9rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7, flexShrink: 0,
          background: `${iconColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} color={iconColor} />
        </div>
        <p style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          {label}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.15 }}>{value ?? '—'}</span>
        {unit && <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{unit}</span>}
        {niveau > 0 && (
          <span style={{
            padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
            background: levelBg(niveau), color: levelColor(niveau),
          }}>
            N{niveau} — {levelLabel(niveau)}
          </span>
        )}
      </div>
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

  // La collecte automatique tourne désormais de façon fiable (cron externe,
  // toutes les 5 min) — "live" est la vraie donnée actuelle par défaut,
  // "historique" (dataset statique février 2025) reste dispo en bascule.
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

  const live24hCount = data24h.filter(d => AXES_OFFICIELS_IDS.has(d.axeId)).length

  // ── Bandeau de synthèse (retard moyen, axe/heure critiques 24h) ──
  const synthese24h = useMemo(() => {
    const rows = data24h
      .filter(d => AXES_OFFICIELS_IDS.has(d.axeId) && d.temps_min > 0 && d.heure != null)
      .map(d => {
        const ref = getReference(d.axeId, d.sens, d.heure)
        return ref ? { ...d, ratio: d.temps_min / ref, retard: d.temps_min - ref } : null
      })
      .filter(Boolean)
    if (!rows.length) return null

    const retardMoyen = rows.reduce((s, r) => s + r.retard, 0) / rows.length

    function topBy(keyFn, label) {
      const acc = {}
      rows.forEach(r => {
        const k = keyFn(r)
        if (!acc[k]) acc[k] = { sum: 0, count: 0 }
        acc[k].sum += r.ratio
        acc[k].count += 1
      })
      const best = Object.entries(acc)
        .map(([k, v]) => ({ key: k, ratioMoy: v.sum / v.count }))
        .sort((a, b) => b.ratioMoy - a.ratioMoy)[0]
      return best ? { ...best, niveau: computeNiveau(best.ratioMoy), label } : null
    }

    const axeImpacte = topBy(r => r.axeId, null)
    if (axeImpacte) axeImpacte.label = axeDefs.find(a => a.id === axeImpacte.key)?.label ?? axeImpacte.key
    const heurePointe = topBy(r => r.heure, null)
    if (heurePointe) heurePointe.label = `${heurePointe.key}h`

    return {
      retardMoyen: Math.round(retardMoyen * 10) / 10,
      axeImpacte,
      heurePointe,
    }
  }, [data24h, axeDefs.map(a => a.id).join()])

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

  // ── Heatmap : jours × heures, palette vert→rouge ────────────
  const heatScrollRef = useRef(null)

  // Heures affichées (6h → 22h)
  const HM_HEURES = Array.from({ length: 17 }, (_, i) => i + 6)

  const heatmapGrid = useMemo(() => {
    const filtered = data.filter(d =>
      AXES_OFFICIELS_IDS.has(d.axeId) &&
      d.sens === hmSens &&
      d.temps_min > 0 &&
      d.date != null &&
      d.heure != null &&
      (hmAxe === 'tous' || d.axeId === hmAxe)
    )
    if (!filtered.length) return {}

    // Référence horaire réelle (getReference) plutôt qu'un T_ref plat unique
    // par axe : le trafic "normal" varie selon l'heure (pointe vs creux), donc
    // comparer chaque heure à SA propre référence évite de signaler les heures
    // de pointe comme "dégradées" alors qu'elles le sont structurellement.
    const acc = {}
    filtered.forEach(d => {
      const ref = getReference(d.axeId, d.sens, d.heure)
      if (!ref) return
      const jourJS = new Date(d.date + 'T00:00:00').getDay()
      const key    = `${jourJS}_${d.heure}`
      if (!acc[key]) acc[key] = { sumRatio: 0, sumTemps: 0, count: 0 }
      acc[key].sumRatio += d.temps_min / ref
      acc[key].sumTemps += d.temps_min
      acc[key].count    += 1
    })

    const grid = {}
    Object.entries(acc).forEach(([key, c]) => {
      const ratio     = c.sumRatio / c.count
      const retardPct = Math.round((ratio - 1) * 100)
      const moyenne   = Math.round((c.sumTemps / c.count) * 10) / 10
      grid[key] = { moyenne, ratio, retardPct, niveau: computeNiveau(ratio) }
    })
    return grid
  }, [data, hmAxe, hmSens])

  // Jour le plus chargé, dérivé de la heatmap (dataset complet, pas juste 24h)
  const jourPlusCharge = useMemo(() => {
    const parJour = {}
    Object.entries(heatmapGrid).forEach(([key, cell]) => {
      const jourJS = key.split('_')[0]
      if (!parJour[jourJS]) parJour[jourJS] = { sum: 0, count: 0 }
      parJour[jourJS].sum += cell.ratio
      parJour[jourJS].count += 1
    })
    const best = Object.entries(parJour)
      .map(([j, v]) => ({ jourJS: Number(j), ratioMoy: v.sum / v.count }))
      .sort((a, b) => b.ratioMoy - a.ratioMoy)[0]
    if (!best) return null
    return { label: JOURS_LABELS[JOURS_ORDRE.indexOf(best.jourJS)], niveau: computeNiveau(best.ratioMoy) }
  }, [heatmapGrid])

  // ── Min / Moyen / Max ────────────────────────────────────────
  const minMaxData = useMemo(() => {
    const stats  = computeMinMaxParAxe(data24h, axeDefs, lineDir)
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
  }, [data24h, axeDefs.map(a => a.id).join(), lineDir])

  // ── Donut répartition niveaux ────────────────────────────────
  // computeRepartitionNiveaux regroupe en 4 catégories (Fluide = N1+N2,
  // Modéré = N3, Dense = N4, Congestionné = N5) dans cet ordre fixe —
  // couleurs alignées sur l'échelle N1-N5 canonique (styles/tokens.js)
  // plutôt qu'une palette recréée à la main.
  const repartition  = useMemo(() => computeRepartitionNiveaux(data24h, periode), [data24h, periode])
  const donutHasData = repartition.some(r => r.count > 0)
  const donutData    = {
    labels:   repartition.map(r => `${r.label} (${r.pct}%)`),
    datasets: [{
      data:            repartition.map(r => r.count),
      backgroundColor: [levelColor(2), levelColor(3), levelColor(4), levelColor(5)],
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

      {/* ── Bandeau de synthèse ─────────────────────────────────── */}
      {synthese24h && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flexShrink: 0 }}>
          <StatTile
            icon={Gauge} iconColor={C.primary}
            label={`Retard moyen${source === 'live' ? ' (24h)' : ''}`}
            value={synthese24h.retardMoyen >= 0 ? `+${synthese24h.retardMoyen}` : synthese24h.retardMoyen}
            unit="min"
          />
          <StatTile
            icon={AlertTriangle} iconColor={C.danger}
            label={`Axe le plus impacté${source === 'live' ? ' (24h)' : ''}`}
            value={synthese24h.axeImpacte?.label ?? '—'}
            niveau={synthese24h.axeImpacte?.niveau}
          />
          <StatTile
            icon={Clock} iconColor={C.warning}
            label={`Heure de pointe${source === 'live' ? ' (24h)' : ''}`}
            value={synthese24h.heurePointe?.label ?? '—'}
            niveau={synthese24h.heurePointe?.niveau}
          />
          <StatTile
            icon={CalendarDays} iconColor="#8E44AD"
            label="Jour le plus chargé"
            value={jourPlusCharge?.label ?? '—'}
            niveau={jourPlusCharge?.niveau}
          />
        </div>
      )}

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
            <span className="fp-section-title">Min / Moyen / Max par axe ({lineDir === 'aller' ? 'Aller' : 'Retour'})</span>
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

      {/* ── G3 — Heatmap congestion (jour × heure) ──────────────── */}
      <div className="fp-card" style={{ flexShrink: 0 }}>
        <div className="fp-section-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="fp-section-title">Heatmap congestion — jour × heure</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* légende N1-N5 — même échelle que la carte (styles/tokens.js) */}
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, background: levelColor(n) }} />
                  <span style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>
                    {levelLabel(n)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select className="fp-select" style={{ width: 'auto' }} value={hmAxe} onChange={e => setHmAxe(e.target.value)}>
              <option value="tous">Tous les axes (moyenne)</option>
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

        {Object.keys(heatmapGrid).length === 0 ? (
          <EmptyChart height={260} />
        ) : (
          <div ref={heatScrollRef} style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{
              borderCollapse: 'separate', borderSpacing: '4px',
              width: '100%', tableLayout: 'fixed',
            }}>
              <colgroup>
                <col style={{ width: 52 }} />
                {HM_HEURES.map(h => <col key={h} />)}
              </colgroup>
              <thead>
                <tr>
                  <th />
                  {HM_HEURES.map(h => (
                    <th key={h} style={{
                      fontSize: 11, fontWeight: 700, color: C.textMuted,
                      textAlign: 'center', padding: '0 0 6px',
                      fontFamily: "'Inter',sans-serif",
                    }}>
                      {h}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {JOURS_ORDRE.map((jourJS, idx) => (
                  <tr key={jourJS}>
                    <td style={{
                      fontSize: 13, fontWeight: 700, color: C.text,
                      paddingRight: 10, textAlign: 'right',
                      fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap',
                    }}>
                      {JOURS_LABELS[idx]}
                    </td>
                    {HM_HEURES.map(h => {
                      const cell = heatmapGrid[`${jourJS}_${h}`]
                      if (!cell) {
                        return (
                          <td key={h} style={{ padding: 0 }}>
                            <div style={{
                              height: 38, borderRadius: 6,
                              background: '#EDF2F7',
                              border: '1px solid #E2E8F0',
                            }} />
                          </td>
                        )
                      }
                      const { bg, fg } = heatColorNiveau(cell.niveau)
                      return (
                        <td key={h} style={{ padding: 0 }}>
                          <div
                            title={`${JOURS_LABELS[idx]} ${h}h — ${cell.moyenne} min · +${cell.retardPct}% vs référence · ${levelLabel(cell.niveau)}`}
                            style={{
                              height: 38, borderRadius: 6,
                              background: bg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'default',
                              transition: 'filter 0.12s',
                              boxShadow: cell.niveau >= 4 ? `0 2px 8px ${bg}70` : 'none',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.12)' }}
                            onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                          >
                            <span style={{
                              fontSize: 12, fontWeight: 800,
                              color: fg,
                              fontFamily: "'Inter',sans-serif",
                              letterSpacing: '-0.3px',
                              userSelect: 'none',
                            }}>
                              {cell.retardPct}%
                            </span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

export default GraphiquesPage
