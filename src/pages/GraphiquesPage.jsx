import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Clock, AlertTriangle, Gauge, CalendarDays, ImageDown } from 'lucide-react'
import { C, levelColor, levelLabel, levelBg } from '../styles/tokens'
import { useCollecteAuto }   from '../hooks/useCollecteAuto'
import { useHistoricalData } from '../hooks/useHistoricalData'
import { useAxesFirestore }  from '../hooks/useAxesFirestore'
import { AXES_OFFICIELS } from '../hooks/useTrafficData'
import { computeCourbe24h, computeRepartitionNiveaux } from '../services/aggregations'
import { computeNiveau } from '../services/indicators'
import { getReference } from '../data/references'
import { useReferencesHoraires } from '../hooks/useReferencesHoraires'
import { useAgregats } from '../hooks/useAgregats'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const PALETTE = ['#1B4F8A', '#E67E22', '#27AE60', '#8E44AD', '#C0392B']

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
    if (!vals.length) return { min: 0, moy: 0, max: 0, n: 0 }
    return {
      min: Math.round(Math.min(...vals) * 10) / 10,
      moy: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10,
      max: Math.round(Math.max(...vals) * 10) / 10,
      n:   vals.length,
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

// Rampe monochrome du graphe Min/Moyenne/Max : trois bornes d'une même
// mesure → même teinte (bleu FlowPort), intensité croissante. Évite les
// couleurs de statut (vert/orange/rouge) qui suggéreraient un niveau.
const MMM_COLORS = { min: '#8FBBE0', moy: '#1B4F8A', max: '#0A2E52' }

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

// Export PNG d'un graphe Chart.js (fond blanc forcé : le canvas est
// transparent, un PNG transparent est illisible sur visionneuse sombre).
function telechargerGraphePNG(chartRef, nomFichier) {
  const chart = chartRef.current
  if (!chart?.canvas) return
  const src = chart.canvas
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(src, 0, 0)
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = `${nomFichier}_${new Date().toISOString().slice(0, 10)}.png`
  a.click()
}

function BtnPNG({ chartRef, nom }) {
  return (
    <button
      onClick={() => telechargerGraphePNG(chartRef, nom)}
      title="Télécharger ce graphe en PNG"
      aria-label="Télécharger ce graphe en PNG"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: '#f0f4f8', border: '1px solid #e2e8f0',
        cursor: 'pointer', color: C.textMuted,
      }}
    >
      <ImageDown size={14} />
    </button>
  )
}

function EmptyChart({ height = 280, message = 'Données insuffisantes', hint = 'Les mesures s’accumulent toutes les 5 min' }) {
  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke="#e2e8f0" strokeWidth="2"/>
        <path d="M12 28 L17 20 L22 23 L27 14" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, margin: 0 }}>{message}</p>
      <p style={{ fontSize: 11, color: C.textLight, margin: 0, textAlign: 'center', maxWidth: 280 }}>{hint}</p>
    </div>
  )
}

// Bandeau de synthèse — même langage visuel que les KPICard du Dashboard
// (icône, libellé, valeur, badge de niveau coloré).
function StatTile({ icon: Icon, iconColor, label, value, unit, niveau }) {
  return (
    // flex-basis 150px : 4 tuiles par ligne sur desktop, 2 par ligne sur mobile
    <div className="fp-card" style={{ flex: '1 1 150px', minWidth: 0, padding: '0.9rem 1rem' }}>
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

  // PALETTE (pas AXE_COLORS) pour les graphiques : AXE_COLORS (identité des
  // axes sur la carte) donne à Toyota CFAO et Agence SODECI deux tons de
  // jaune/ambre quasi identiques, illisibles une fois superposés sur une
  // courbe avec légende. PALETTE offre 3 teintes nettement différenciées.
  const axeDefs = baseAxes.map((axe, idx) => ({
    id:    axe.id,
    label: axe.shortNom ?? axe.nom ?? axe.id,
    color: PALETTE[idx % PALETTE.length],
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
  // Fenêtre des cartes Min/Moy/Max et Répartition : 24 h (relevés bruts)
  // ou 7 j / 30 j (agrégats quotidiens — lectures minimes)
  const [periodeStats, setPeriodeStats] = useState('24h')

  const nbJoursAgregats = periodeStats === '7j' ? 7 : periodeStats === '30j' ? 30 : 0
  const { rows: agregats, loading: agregatsLoading } = useAgregats(nbJoursAgregats)

  const data    = source === 'live' ? collecteData : histoData
  const loading = source === 'live' ? collecteLoading : histoLoading

  const liveCount = collecteData.filter(d => AXES_OFFICIELS_IDS.has(d.axeId)).length

  function tsToMs(ts) {
    if (!ts) return 0
    return typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime()
  }

  // Clé de dépendance stable pour les useMemo dépendant de la liste d'axes
  const axeIdsKey = axeDefs.map(a => a.id).join()

  const data24h = useMemo(() => {
    if (source !== 'live') return data
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return data.filter(d => tsToMs(d.timestamp) >= cutoff)
  }, [data, source])

  // ── Heure courante (fait avancer l'axe X de la courbe 24h) ──
  // Vérification chaque minute : l'état ne change qu'au passage d'une
  // heure pleine, donc un seul re-render par heure au maximum.
  const [heureActuelle, setHeureActuelle] = useState(() => new Date().getHours())
  useEffect(() => {
    const t = setInterval(() => {
      const h = new Date().getHours()
      setHeureActuelle(prev => (prev === h ? prev : h))
    }, 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // En mode live, l'axe X est une fenêtre glissante chronologique :
  // il se termine à l'heure présente (dernier point = maintenant) et
  // remonte 24 h en arrière. En mode historique (agrégat multi-jours),
  // l'axe fixe 0h → 23h reste le bon repère.
  const heuresFenetre = useMemo(() =>
    source === 'live'
      ? Array.from({ length: 24 }, (_, i) => (heureActuelle + 1 + i) % 24)
      : Array.from({ length: 24 }, (_, i) => i),
  [source, heureActuelle])
  const lineLabels = heuresFenetre.map(h => `${h}h`)

  const live24hCount = data24h.filter(d => AXES_OFFICIELS_IDS.has(d.axeId)).length

  // Références horaires recalibrées chaque semaine sur les relevés réels
  // (fallback automatique sur la base statique février 2025 si absentes)
  const { valeurs: refsHoraires, majLe: refsMajLe } = useReferencesHoraires()

  // ── Bandeau de synthèse (retard moyen, axe/heure critiques 24h) ──
  const synthese24h = useMemo(() => {
    const rows = data24h
      .filter(d => AXES_OFFICIELS_IDS.has(d.axeId) && d.temps_min > 0 && d.heure != null)
      .map(d => {
        const ref = getReference(d.axeId, d.sens, d.heure, refsHoraires)
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
  }, [data24h, axeIdsKey, refsHoraires])

  // ── Courbes 24h ─────────────────────────────────────────────
  // Dégradé vertical (couleur de l'axe → transparent) plutôt qu'un aplat
  // translucide uni — plus lisible quand plusieurs courbes se chevauchent.
  function makeFillGradient(context, color) {
    const { ctx, chartArea } = context.chart
    if (!chartArea) return `${color}15`
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    gradient.addColorStop(0,   `${color}4D`)
    gradient.addColorStop(0.6, `${color}12`)
    gradient.addColorStop(1,   `${color}00`)
    return gradient
  }

  const lineDatasets = useMemo(() => axeDefs.map(axe => {
    const courbe     = computeCourbe24h(data24h, axe.id, lineDir)
    // Points réordonnés selon la fenêtre glissante (le dernier = maintenant)
    const dataPoints = heuresFenetre.map(h => courbe[h].temps_moyen)
    const iPresent   = dataPoints.length - 1
    return {
      label:                axe.label,
      data:                 dataPoints,
      borderColor:          axe.color,
      backgroundColor:      context => makeFillGradient(context, axe.color),
      tension:              0.35,
      fill:                 true,
      spanGaps:             true,                            // relie les points au travers des heures sans données
      // le point de l'heure courante est légèrement accentué (mode live)
      pointRadius:          dataPoints.map((v, i) => v != null ? (source === 'live' && i === iPresent ? 6.5 : 5) : 0),
      pointHoverRadius:     7,
      pointHitRadius:       12,
      pointBackgroundColor: dataPoints.map((v, i) => source === 'live' && i === iPresent ? axe.color : '#fff'),
      pointBorderColor:     axe.color,
      pointBorderWidth:     2,
      borderWidth:          2.5,
    }
  }), [data24h, axeIdsKey, lineDir, heuresFenetre, source])

  const filteredLineDatasets = axeFilter === 'tous'
    ? lineDatasets
    : lineDatasets.filter((_, i) => i === parseInt(axeFilter))

  const lineData    = { labels: lineLabels, datasets: filteredLineDatasets }
  const lineHasData = filteredLineDatasets.some(ds => ds.data.some(v => v != null))

  // ── Heatmap : jours × heures, palette vert→rouge ────────────
  const heatScrollRef = useRef(null)

  // Refs des graphes Chart.js pour l'export PNG
  const lineRef  = useRef(null)
  const barRef   = useRef(null)
  const donutRef = useRef(null)

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
      const ref = getReference(d.axeId, d.sens, d.heure, refsHoraires)
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
  }, [data, hmAxe, hmSens, refsHoraires])

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

  // ── Min / Moyen / Max — barre de plage + trait de moyenne ────
  // Trois barres groupées par axe — Minimum / Moyenne / Maximum des relevés,
  // rampe monochrome (même mesure, intensité croissante) + légende explicite.
  // 24 h : relevés bruts de la fenêtre glissante ; 7 j / 30 j : agrégats
  // quotidiens combinés (min des min, max des max, moyenne pondérée).
  const minMaxData = useMemo(() => {
    // 7 j / 30 j : agrégats quotidiens (jours révolus) + relevés bruts du
    // jour courant (jamais agrégé puisque la journée n'est pas finie).
    // Fonctionne donc même quand les agrégats sont encore vides — la
    // profondeur s'étoffe au fil du workflow nocturne.
    const aujourdHui = new Date().toISOString().slice(0, 10)
    const stats = periodeStats === '24h'
      ? computeMinMaxParAxe(data24h, axeDefs, lineDir)
      : axeDefs.map(axe => {
          const morceaux = agregats.filter(a => a.axeId === axe.id && a.sens === lineDir)
          const [duJour] = computeMinMaxParAxe(data24h.filter(d => d.date === aujourdHui), [axe], lineDir)
          if (duJour.n > 0) morceaux.push(duJour)
          if (!morceaux.length) return { min: 0, moy: 0, max: 0, n: 0 }
          const n = morceaux.reduce((s, a) => s + (a.n ?? 0), 0)
          return {
            min: Math.round(Math.min(...morceaux.map(a => a.min)) * 10) / 10,
            max: Math.round(Math.max(...morceaux.map(a => a.max)) * 10) / 10,
            moy: Math.round(morceaux.reduce((s, a) => s + a.moy * (a.n ?? 0), 0) / (n || 1) * 10) / 10,
            n,
          }
        })
    const hasAny = stats.some(s => s.moy > 0)
    if (!hasAny) return null
    const serie = (label, cle, couleur) => ({
      label,
      data:            stats.map(s => s.n > 0 ? s[cle] : null),
      backgroundColor: couleur,
      borderRadius:    5,
      barPercentage:      0.78,
      categoryPercentage: 0.62,
    })
    return {
      stats,
      chart: {
        labels: axeDefs.map(a => a.label),
        datasets: [
          serie('Temps minimal', 'min', MMM_COLORS.min),
          serie('Temps moyen',   'moy', MMM_COLORS.moy),
          serie('Temps maximal', 'max', MMM_COLORS.max),
        ],
      },
    }
  }, [data24h, axeIdsKey, lineDir, periodeStats, agregats])

  // ── Donut répartition niveaux ────────────────────────────────
  // computeRepartitionNiveaux regroupe en 4 catégories (Fluide = N1+N2,
  // Modéré = N3, Dense = N4, Congestionné = N5) dans cet ordre fixe —
  // couleurs alignées sur l'échelle N1-N5 canonique (styles/tokens.js)
  // plutôt qu'une palette recréée à la main.
  const repartition  = useMemo(() => {
    if (periodeStats === '24h') return computeRepartitionNiveaux(data24h, periode, refsHoraires)
    // 7 j / 30 j : niveaux stockés dans les agrégats quotidiens (jours
    // révolus) + relevés bruts du jour courant, filtre ouvrable/week-end
    const cats = { 'Fluide': 0, 'Modéré': 0, 'Dense': 0, 'Congestionné': 0 }
    let total = 0
    agregats.forEach(a => {
      if (periode !== 'tous') {
        const j = new Date(a.date + 'T00:00:00').getDay()
        const we = j === 0 || j === 6
        if (periode === 'weekend' ? !we : we) return
      }
      const nv = a.niveaux ?? {}
      const f = (nv[1] ?? 0) + (nv[2] ?? 0)
      cats['Fluide'] += f; cats['Modéré'] += nv[3] ?? 0; cats['Dense'] += nv[4] ?? 0; cats['Congestionné'] += nv[5] ?? 0
      total += f + (nv[3] ?? 0) + (nv[4] ?? 0) + (nv[5] ?? 0)
    })
    // Jour courant (pas encore agrégé)
    const aujourdHui = new Date().toISOString().slice(0, 10)
    computeRepartitionNiveaux(data24h.filter(d => d.date === aujourdHui), periode, refsHoraires)
      .forEach(({ label, count }) => { cats[label] += count; total += count })
    return Object.entries(cats).map(([label, count]) => ({
      label, count, pct: total ? Math.round((count / total) * 1000) / 10 : 0,
    }))
  }, [data24h, periode, periodeStats, agregats, refsHoraires])
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
            {source === 'live' && (
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}>
                Fenêtre glissante sur 24 h — le graphe avance avec le temps et se termine à l'heure actuelle ({heureActuelle}h)
              </span>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              <Pill active={lineDir === 'aller'}  onClick={() => setLineDir('aller')}>Aller</Pill>
              <Pill active={lineDir === 'retour'} onClick={() => setLineDir('retour')}>Retour</Pill>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-start' }}>
            <select className="fp-select" style={{ width: 'auto' }} value={axeFilter} onChange={e => setAxeFilter(e.target.value)}>
              <option value="tous">Tous les axes</option>
              {axeDefs.map((axe, i) => (
                <option key={axe.id} value={String(i)}>{axe.label}</option>
              ))}
            </select>
            <BtnPNG chartRef={lineRef} nom="FlowPort_temps_par_heure" />
          </div>
        </div>

        {lineHasData ? (
          <div style={{ height: 300 }}>
            <Line ref={lineRef} data={lineData} options={{
              ...CHART_OPTIONS_BASE,
              spanGaps: true,
              // mode 'index' + intersect:false : le tooltip apparaît dès que le
              // curseur survole n'importe quel point de la tranche horaire, pas
              // seulement en passant exactement sur un point de la courbe.
              interaction: { mode: 'index', intersect: false },
              hover:       { mode: 'index', intersect: false },
              plugins: {
                ...CHART_OPTIONS_BASE.plugins,
                legend: { ...CHART_OPTIONS_BASE.plugins.legend, position: 'top' },
                title: { display: false },
                tooltip: {
                  ...CHART_OPTIONS_BASE.plugins.tooltip,
                  mode: 'index',
                  intersect: false,
                },
              },
              scales: {
                ...CHART_OPTIONS_BASE.scales,
                x: {
                  ...CHART_OPTIONS_BASE.scales.x,
                  ticks: {
                    ...CHART_OPTIONS_BASE.scales.x.ticks,
                    // graduations ancrées sur la droite : l'heure présente
                    // (dernier point) est toujours affichée
                    callback: (_, i) => (lineLabels.length - 1 - i) % 3 === 0 ? lineLabels[i] : '',
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

      {/* ── G2 + G4 — côte à côte sur desktop, empilés sur mobile ── */}
      <div style={{ display: 'flex', gap: '1rem', flexShrink: 0, flexWrap: 'wrap' }}>

        {/* G2 — Plage min–max + moyenne par axe */}
        <div className="fp-card" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="fp-section-header">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className="fp-section-title">Temps de traversée par axe ({lineDir === 'aller' ? 'Aller' : 'Retour'})</span>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}>
                Minimum · Moyenne · Maximum des relevés
                {agregatsLoading && ' — chargement…'}
                {!agregatsLoading && periodeStats !== '24h' && (
                  ` — ${new Set(agregats.map(a => a.date)).size} jour(s) agrégé(s) + aujourd'hui`
                )}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {['24h', '7j', '30j'].map(p => (
                  <Pill key={p} active={periodeStats === p} onClick={() => setPeriodeStats(p)}>{p === '24h' ? '24 h' : p === '7j' ? '7 jours' : '30 jours'}</Pill>
                ))}
              </div>
            </div>
            <BtnPNG chartRef={barRef} nom="FlowPort_min_moy_max" />
          </div>
          {minMaxData ? (
            <div style={{ height: 240 }}>
              <Bar ref={barRef} data={minMaxData.chart} options={{
                ...CHART_OPTIONS_BASE,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                  ...CHART_OPTIONS_BASE.plugins,
                  legend: {
                    ...CHART_OPTIONS_BASE.plugins.legend,
                    display: true,
                    position: 'top',
                    labels: {
                      ...CHART_OPTIONS_BASE.plugins.legend?.labels,
                      usePointStyle: true,
                      pointStyle: 'rectRounded',
                      boxWidth: 12, boxHeight: 12,
                      font: BASE_FONT,
                      color: C.text,
                    },
                  },
                  title:  { display: false },
                  tooltip: {
                    ...CHART_OPTIONS_BASE.plugins.tooltip,
                    mode: 'index', intersect: false,
                    callbacks: {
                      label: ctx => ctx.parsed.y != null ? ` ${ctx.dataset.label} : ${ctx.parsed.y} min` : null,
                      afterBody: items => {
                        const i   = items[0]?.dataIndex
                        const axe = axeDefs[i]
                        const s   = minMaxData.stats[i]
                        if (!axe?.tRef || !s || s.n === 0) return ''
                        const pct = Math.round((s.moy / axe.tRef - 1) * 100)
                        return `\n${s.n} mesures · Référence PAA : ${axe.tRef} min (${pct >= 0 ? '+' : ''}${pct}% en moyenne)`
                      },
                    },
                  },
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
        <div className="fp-card" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="fp-section-header">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className="fp-section-title">Répartition par niveau</span>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}>
                Fenêtre : {periodeStats === '24h' ? '24 h' : periodeStats === '7j' ? '7 jours' : '30 jours'} (réglable sur la carte voisine)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select className="fp-select" style={{ width: 'auto' }} value={periode} onChange={e => setPeriode(e.target.value)}>
                <option value="tous">Tous les jours</option>
                <option value="ouvrable">Jours ouvrables</option>
                <option value="weekend">Week-end</option>
              </select>
              <BtnPNG chartRef={donutRef} nom="FlowPort_repartition_niveaux" />
            </div>
          </div>
          {donutHasData ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Doughnut ref={donutRef} data={donutData} options={{
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
            <EmptyChart
              height={220}
              message="Aucun relevé pour ce filtre"
              hint={periode !== 'tous'
                ? 'La fenêtre choisie ne contient aucun jour de ce type — élargissez à 7 ou 30 jours, ou repassez sur « Tous les jours ». (Un dimanche, la fenêtre 24 h est 100 % week-end.)'
                : 'Les mesures s’accumulent toutes les 5 min'}
            />
          )}
        </div>
      </div>

      {/* ── G3 — Heatmap congestion (jour × heure) ──────────────── */}
      <div className="fp-card" style={{ flexShrink: 0 }}>
        <div className="fp-section-header" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="fp-section-title">Heatmap congestion — jour × heure</span>
            <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}>
              {refsMajLe
                ? `Écarts vs médianes horaires des 7 derniers jours (recalibrées le ${new Date(refsMajLe).toLocaleDateString('fr-FR')})`
                : 'Écarts vs base historique février 2025 — recalibrage hebdomadaire dès la première exécution'}
            </span>
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
          <div ref={heatScrollRef} style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
            <table style={{
              borderCollapse: 'separate', borderSpacing: '4px',
              width: '100%', tableLayout: 'fixed',
              // largeur plancher : sous ~640px (mobile) le tableau garde des
              // cellules lisibles et défile horizontalement au lieu de s'écraser
              minWidth: 640,
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
