// ============================================================
// AdminView.jsx — Interface Administrateur
// Jour 7 : ajoute le Dashboard analytique — carte + courbe 24h
// + histogramme comparatif, liés par sélection d'axe.
// ============================================================

import { useState } from 'react'
import { seedAll }              from '../services/seed'
import { useHistoricalData }    from '../hooks/useHistoricalData'
import { computeCourbe24h, computeMoyenneParAxe } from '../services/aggregations'
import MapView        from '../components/Map/MapView'
import LineChart24h    from '../components/Charts/LineChart24h'
import BarChartAxes    from '../components/Charts/BarChartAxes'
import { tokens }      from '../styles/tokens'
import { AXES_DATA }   from '../data/axes'

function AdminView() {
  // ── État de l'import (Jour 3) ───────────────────────────────
  const [status,   setStatus]   = useState('idle')
  const [progress, setProgress] = useState(0)
  const [message,  setMessage]  = useState('')

  // ── État du dashboard analytique (Jour 7) ───────────────────
  const [selectedAxeId, setSelectedAxeId] = useState('axe1') // axe affiché par défaut
  const { data: historique, loading: loadingHisto } = useHistoricalData()

  async function handleSeed() {
    setStatus('loading')
    setProgress(0)
    setMessage('Import en cours...')
    try {
      await seedAll((pct) => {
        setProgress(pct)
        setMessage(`Import des mesures... ${pct}%`)
      })
      setStatus('done')
      setMessage('✅ Import terminé — 2 016 mesures dans Firestore !')
    } catch (err) {
      setStatus('error')
      setMessage(`❌ Erreur : ${err.message}`)
    }
  }

  // Nom complet de l'axe sélectionné (pour le titre du graphique)
  const axeActuel = AXES_DATA.find(a => a.id === selectedAxeId)

  // Agrégations recalculées seulement quand l'historique ou la sélection change
  const courbe24h     = historique.length ? computeCourbe24h(historique, selectedAxeId, 'aller') : []
  const moyenneParAxe = historique.length ? computeMoyenneParAxe(historique) : []

  return (
    <div style={{ padding: tokens.spacing.section, maxWidth: '1100px', margin: '0 auto' }}>

      <h1 style={{ color: tokens.colors.accent.primary, fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        Interface Administrateur
      </h1>

      {/* ── Section Import (Jour 3) ──────────────────────────── */}
      <div style={{
        background: tokens.colors.bg.surface, borderRadius: tokens.radius.md,
        padding: tokens.spacing.card, border: `1px solid ${tokens.colors.bg.border}`,
        marginBottom: tokens.spacing.section,
      }}>
        <h2 style={{ color: tokens.colors.text.primary, marginBottom: '0.5rem' }}>
          Import données réelles PAA
        </h2>
        <p style={{ color: tokens.colors.text.secondary, marginBottom: '1rem', fontSize: '0.9rem' }}>
          Charge les 2 016 mesures + axes + références dans Firestore.
        </p>
        {message && (
          <p style={{
            color: status === 'error' ? tokens.colors.traffic.blocked
                 : status === 'done'  ? tokens.colors.traffic.fluid
                 : tokens.colors.text.secondary,
            marginBottom: '1rem', fontSize: '0.9rem',
          }}>
            {message}
          </p>
        )}
        <button
          onClick={handleSeed}
          disabled={status === 'loading' || status === 'done'}
          style={{
            background: status === 'done' ? tokens.colors.traffic.fluid : tokens.colors.accent.primary,
            color: '#fff', border: 'none', borderRadius: tokens.radius.sm,
            padding: '0.7rem 1.4rem', cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            fontWeight: 'bold', fontSize: '0.9rem',
          }}
        >
          {status === 'idle' && '🚀 Lancer l\'import PAA'}
          {status === 'loading' && '⏳ Import en cours...'}
          {status === 'done' && '✅ Import terminé'}
          {status === 'error' && '🔁 Réessayer'}
        </button>
      </div>

      {/* ── Section Dashboard analytique (Jour 7) ────────────── */}
      <h2 style={{ color: tokens.colors.text.primary, marginBottom: '0.5rem' }}>
        Dashboard analytique
      </h2>
      <p style={{ color: tokens.colors.text.muted, fontSize: '0.85rem', marginBottom: '1rem' }}>
        {loadingHisto
          ? 'Chargement de l\'historique...'
          : `Basé sur ${historique.length} mesures réelles (février 2025). Cliquez sur un axe (carte ou boutons) pour filtrer.`}
      </p>

      {/* Sélecteur manuel d'axe — alternative au clic sur la carte */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: tokens.spacing.gap }}>
        {AXES_DATA.map(axe => (
          <button
            key={axe.id}
            onClick={() => setSelectedAxeId(axe.id)}
            style={{
              background:   selectedAxeId === axe.id ? tokens.colors.accent.primary : tokens.colors.bg.elevated,
              color:        selectedAxeId === axe.id ? '#fff' : tokens.colors.text.secondary,
              border:       `1px solid ${tokens.colors.bg.border}`,
              borderRadius: tokens.radius.sm,
              padding:      '0.5rem 1rem',
              cursor:       'pointer',
              fontSize:     '0.85rem',
              fontWeight:   selectedAxeId === axe.id ? 'bold' : 'normal',
            }}
          >
            {axe.nom.split(' — ')[0]}
          </button>
        ))}
      </div>

      {/* Carte — liée aux graphiques via onAxeSelect */}
      <div style={{ marginBottom: tokens.spacing.gap }}>
        <MapView onAxeSelect={setSelectedAxeId} />
      </div>

      {/* Graphiques côte à côte */}
      <div style={{ display: 'flex', gap: tokens.spacing.gap, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <LineChart24h data={courbe24h} axeNom={axeActuel?.nom.split(' — ')[0]} />
        </div>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <BarChartAxes data={moyenneParAxe} selectedAxeId={selectedAxeId} />
        </div>
      </div>

    </div>
  )
}

export default AdminView