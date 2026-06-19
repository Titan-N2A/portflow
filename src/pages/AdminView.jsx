// ============================================================
// AdminView.jsx — Interface Administrateur
// Jour 9 (révisé) : axes en lecture live depuis Firestore,
// édition complète (nom/distance/coordonnées) + tronçons CRUD.
// ============================================================

import { useState } from 'react'
import { seedAll }              from '../services/seed'
import { useHistoricalData }    from '../hooks/useHistoricalData'
import { useTroncons }          from '../hooks/useTroncons'
import { useAxesLive }          from '../hooks/useAxesLive'
import {
  computeCourbe24h, computeMoyenneParAxe,
  computeHeatmap, computeRepartitionNiveaux,
} from '../services/aggregations'
import MapView          from '../components/Map/MapView'
import LineChart24h      from '../components/Charts/LineChart24h'
import BarChartAxes      from '../components/Charts/BarChartAxes'
import Heatmap            from '../components/Charts/Heatmap'
import DonutChart         from '../components/Charts/DonutChart'
import AxeForm             from '../components/Admin/AxeForm'
import TronconForm        from '../components/Admin/TronconForm'
import TronconList        from '../components/Admin/TronconList'
import { tokens }        from '../styles/tokens'

function AdminView() {
  const [status,   setStatus]   = useState('idle')
  const [progress, setProgress] = useState(0)
  const [message,  setMessage]  = useState('')

  const [selectedAxeId, setSelectedAxeId] = useState('axe1')
  const [selectedSens,  setSelectedSens]  = useState('aller')
  const [heureDebut,    setHeureDebut]    = useState(7)
  const [heureFin,      setHeureFin]      = useState(18)
  const [filtrePeriode, setFiltrePeriode] = useState('tous')

  const [editingTroncon, setEditingTroncon] = useState(null)
  const { troncons } = useTroncons()
  const { axes }      = useAxesLive() // ← liste d'axes vivante (Firestore)

  const { data: historique, loading: loadingHisto } = useHistoricalData()

  async function handleSeed() {
    setStatus('loading'); setProgress(0); setMessage('Import en cours...')
    try {
      await seedAll((pct) => { setProgress(pct); setMessage(`Import des mesures... ${pct}%`) })
      setStatus('done'); setMessage('✅ Import terminé — 2 016 mesures dans Firestore !')
    } catch (err) {
      setStatus('error'); setMessage(`❌ Erreur : ${err.message}`)
    }
  }

  function handleAxeChange(axeId) {
    setSelectedAxeId(axeId)
    const axe = axes.find(a => a.id === axeId)
    if (axe && !axe.sens.includes(selectedSens)) setSelectedSens('aller')
  }

  const axeActuel = axes.find(a => a.id === selectedAxeId)
  const aDeuxSens  = axeActuel?.sens.length > 1

  const courbe24hComplete = historique.length ? computeCourbe24h(historique, selectedAxeId, selectedSens) : []
  const courbe24h         = courbe24hComplete.filter(d => d.heure >= heureDebut && d.heure <= heureFin)
  const moyenneParAxe      = historique.length ? computeMoyenneParAxe(historique) : []
  const heatmapData        = historique.length ? computeHeatmap(historique, selectedAxeId, selectedSens) : []
  const repartitionNiveaux = historique.length ? computeRepartitionNiveaux(historique, filtrePeriode) : []

  return (
    <div style={{ padding: tokens.spacing.section, maxWidth: '1100px', margin: '0 auto' }}>

      <h1 style={{ color: tokens.colors.accent.primary, fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        Interface Administrateur
      </h1>

      {/* ── Import ─────────────────────────────────────────── */}
      <div style={{
        background: tokens.colors.bg.surface, borderRadius: tokens.radius.md,
        padding: tokens.spacing.card, border: `1px solid ${tokens.colors.bg.border}`,
        marginBottom: tokens.spacing.section,
      }}>
        <h2 style={{ color: tokens.colors.text.primary, marginBottom: '0.5rem' }}>Import données réelles PAA</h2>
        {message && (
          <p style={{
            color: status === 'error' ? tokens.colors.traffic.blocked
                 : status === 'done'  ? tokens.colors.traffic.fluid
                 : tokens.colors.text.secondary,
            marginBottom: '1rem', fontSize: '0.9rem',
          }}>{message}</p>
        )}
        <button onClick={handleSeed} disabled={status === 'loading' || status === 'done'} style={{
          background: status === 'done' ? tokens.colors.traffic.fluid : tokens.colors.accent.primary,
          color: '#fff', border: 'none', borderRadius: tokens.radius.sm,
          padding: '0.7rem 1.4rem', cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          fontWeight: 'bold', fontSize: '0.9rem',
        }}>
          {status === 'idle' && '🚀 Lancer l\'import PAA'}
          {status === 'loading' && '⏳ Import en cours...'}
          {status === 'done' && '✅ Import terminé'}
          {status === 'error' && '🔁 Réessayer'}
        </button>
      </div>

      {/* ── Gestion des axes ───────────────────────────────── */}
      <h2 style={{ color: tokens.colors.text.primary, marginBottom: '0.5rem' }}>Gestion des axes</h2>
      <p style={{ color: tokens.colors.text.muted, fontSize: '0.78rem', marginBottom: '0.8rem' }}>
        Nom, distance et tracé — par carte ou saisie manuelle. Répercuté immédiatement sur la carte publique.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: tokens.spacing.section }}>
        {axes.map(axe => <AxeForm key={axe.id} axe={axe} />)}
      </div>

      {/* ── Gestion des tronçons ───────────────────────────── */}
      <h2 style={{ color: tokens.colors.text.primary, marginBottom: '0.5rem' }}>Gestion des tronçons</h2>
      <p style={{ color: tokens.colors.text.muted, fontSize: '0.78rem', marginBottom: '0.8rem' }}>
        {troncons.length} tronçon(s) enregistré(s).
      </p>
      <div style={{ display: 'flex', gap: tokens.spacing.gap, flexWrap: 'wrap', marginBottom: tokens.spacing.section }}>
        <div style={{ flex: 1, minWidth: '340px' }}>
          <TronconForm editing={editingTroncon} onDone={() => setEditingTroncon(null)} />
        </div>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <TronconList troncons={troncons} onEdit={setEditingTroncon} />
        </div>
      </div>

      {/* ── Dashboard analytique ───────────────────────────── */}
      <h2 style={{ color: tokens.colors.text.primary, marginBottom: '0.5rem' }}>Dashboard analytique</h2>
      <p style={{ color: tokens.colors.text.muted, fontSize: '0.85rem', marginBottom: '1rem' }}>
        {loadingHisto ? 'Chargement de l\'historique...' : `Basé sur ${historique.length} mesures réelles (février 2025).`}
      </p>

      <div style={{
        display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end',
        marginBottom: tokens.spacing.gap, padding: tokens.spacing.card,
        background: tokens.colors.bg.elevated, borderRadius: tokens.radius.md,
      }}>
        <div>
          <label style={filterLabel}>Axe</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {axes.map(axe => (
              <button key={axe.id} onClick={() => handleAxeChange(axe.id)} style={{
                background: selectedAxeId === axe.id ? tokens.colors.accent.primary : tokens.colors.bg.surface,
                color: selectedAxeId === axe.id ? '#fff' : tokens.colors.text.secondary,
                border: `1px solid ${tokens.colors.bg.border}`, borderRadius: tokens.radius.sm,
                padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem',
              }}>
                {axe.nom.split(' — ')[0]}
              </button>
            ))}
          </div>
        </div>

        {aDeuxSens && (
          <div>
            <label style={filterLabel}>Sens</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {['aller', 'retour'].map(s => (
                <button key={s} onClick={() => setSelectedSens(s)} style={{
                  background: selectedSens === s ? tokens.colors.accent.primary : tokens.colors.bg.surface,
                  color: selectedSens === s ? '#fff' : tokens.colors.text.secondary,
                  border: `1px solid ${tokens.colors.bg.border}`, borderRadius: tokens.radius.sm,
                  padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', textTransform: 'capitalize',
                }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label style={filterLabel}>Plage horaire</label>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <select value={heureDebut} onChange={(e) => setHeureDebut(Number(e.target.value))} style={selectStyle}>
              {Array.from({ length: 12 }, (_, i) => i + 7).map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
            <span style={{ color: tokens.colors.text.muted }}>→</span>
            <select value={heureFin} onChange={(e) => setHeureFin(Number(e.target.value))} style={selectStyle}>
              {Array.from({ length: 12 }, (_, i) => i + 7).map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={filterLabel}>Période (donut)</label>
          <select value={filtrePeriode} onChange={(e) => setFiltrePeriode(e.target.value)} style={selectStyle}>
            <option value="tous">Tous les jours</option>
            <option value="ouvrable">Jours ouvrables</option>
            <option value="weekend">Week-end</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: tokens.spacing.gap }}>
        <MapView onAxeSelect={handleAxeChange} />
      </div>

      <div style={{ display: 'flex', gap: tokens.spacing.gap, flexWrap: 'wrap', marginBottom: tokens.spacing.gap }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <LineChart24h data={courbe24h} axeNom={`${axeActuel?.nom.split(' — ')[0]} (${selectedSens})`} />
        </div>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <BarChartAxes data={moyenneParAxe} selectedAxeId={selectedAxeId} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: tokens.spacing.gap, flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '400px' }}>
          <Heatmap data={heatmapData} heureDebut={heureDebut} heureFin={heureFin} />
        </div>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <DonutChart data={repartitionNiveaux} />
        </div>
      </div>

    </div>
  )
}

const filterLabel = { color: '#64748B', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }
const selectStyle  = { background: '#1E293B', color: '#F1F5F9', border: '1px solid #334155', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }

export default AdminView