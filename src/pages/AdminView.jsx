import PrevisionRecap      from '../components/Dashboard/PrevisionRecap'
import { useCollecteAuto } from '../hooks/useCollecteAuto'
import { exportToCSV, exportToExcel } from '../utils/exportData'
import { usePredictions }  from '../hooks/usePredictions'
import { getJourLabel }    from '../services/predictions'
import AlertesPredictives  from '../components/Dashboard/AlertesPredictives'
import { useState }        from 'react'
import { seedAll }         from '../services/seed'
import { useHistoricalData } from '../hooks/useHistoricalData'
import { useTroncons }     from '../hooks/useTroncons'
import { useAxesLive }     from '../hooks/useAxesLive'
import {
  computeCourbe24h, computeMoyenneParAxe,
  computeHeatmap, computeRepartitionNiveaux,
} from '../services/aggregations'
import MapView       from '../components/Map/MapView'
import LineChart24h  from '../components/Charts/LineChart24h'
import BarChartAxes  from '../components/Charts/BarChartAxes'
import Heatmap       from '../components/Charts/Heatmap'
import DonutChart    from '../components/Charts/DonutChart'
import AxeForm       from '../components/Admin/AxeForm'
import TronconForm   from '../components/Admin/TronconForm'
import TronconList   from '../components/Admin/TronconList'
import { tokens, getAxeColor } from '../styles/tokens'

// ── Composant réutilisable : séparateur de section ──────────
function SectionDivider({ label, meta }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2rem 0 1rem' }}>
      <span className="pf-section-title" style={{
        color: tokens.colors.text.secondary,
        fontSize: '0.68rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.16em',
        fontFamily: tokens.fonts.ui, whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${tokens.colors.bg.border}, transparent)` }} />
      {meta && (
        <span style={{
          color: tokens.colors.text.muted, fontSize: '0.65rem',
          fontFamily: tokens.fonts.data, whiteSpace: 'nowrap',
        }}>
          {meta}
        </span>
      )}
    </div>
  )
}

// ── Bouton de filtre actif/inactif ──────────────────────────
function FilterBtn({ active, onClick, children, axeColor }) {
  const bg = active
    ? axeColor ?? tokens.colors.accent.primary
    : tokens.colors.bg.elevated
  const color = active ? '#030D1A' : tokens.colors.text.secondary
  const border = active
    ? `1px solid ${axeColor ?? tokens.colors.accent.primary}`
    : `1px solid ${tokens.colors.bg.border}`
  return (
    <button onClick={onClick} style={{
      background: bg, color, border,
      borderRadius: tokens.radius.sm,
      padding: '0.38rem 0.85rem',
      cursor: 'pointer', fontSize: '0.78rem',
      fontFamily: tokens.fonts.ui, fontWeight: active ? 700 : 500,
      transition: 'all 0.15s ease',
      boxShadow: active ? `0 0 10px ${(axeColor ?? tokens.colors.accent.primary)}40` : 'none',
    }}>
      {children}
    </button>
  )
}

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
  const { axes }     = useAxesLive()

  const { data: collecteAuto, loading: loadingCollecte } = useCollecteAuto()
  const { data: historique,   loading: loadingHisto }    = useHistoricalData()

  const [heureApercu, setHeureApercu] = useState(Math.min(18, Math.max(7, new Date().getHours())))
  const [jourApercu,  setJourApercu]  = useState(getJourLabel())
  const [carteMode,   setCarteMode]   = useState('live')
  const { predictions, meta: predictionsMeta } = usePredictions()

  async function handleSeed() {
    setStatus('loading'); setProgress(0); setMessage('Import en cours...')
    try {
      await seedAll((pct) => { setProgress(pct); setMessage(`Import des mesures... ${pct}%`) })
      setStatus('done'); setMessage('Import terminé — 2 016 mesures dans Firestore !')
    } catch (err) {
      setStatus('error'); setMessage(`Erreur : ${err.message}`)
    }
  }

  function handleAxeChange(axeId) {
    setSelectedAxeId(axeId)
    const axe = axes.find(a => a.id === axeId)
    if (axe && !axe.sens.includes(selectedSens)) setSelectedSens('aller')
  }

  const axeActuel = axes.find(a => a.id === selectedAxeId)
  const aDeuxSens = axeActuel?.sens.length > 1

  const courbe24hComplete = historique.length ? computeCourbe24h(historique, selectedAxeId, selectedSens) : []
  const courbe24h         = courbe24hComplete.filter(d => d.heure >= heureDebut && d.heure <= heureFin)
  const moyenneParAxe     = historique.length ? computeMoyenneParAxe(historique) : []
  const heatmapData       = historique.length ? computeHeatmap(historique, selectedAxeId, selectedSens) : []
  const repartitionNiveaux = historique.length ? computeRepartitionNiveaux(historique, filtrePeriode) : []

  return (
    <div style={{ padding: '1.5rem 2rem 3rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── En-tête admin ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingBottom: '1.5rem', marginBottom: '0.5rem',
        borderBottom: `1px solid ${tokens.colors.bg.border}`,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: tokens.colors.accent.secondary,
              boxShadow: `0 0 8px ${tokens.colors.accent.secondary}`,
            }} />
            <span style={{
              color: tokens.colors.text.muted, fontSize: '0.65rem',
              fontFamily: tokens.fonts.data, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}>
              Accès restreint
            </span>
          </div>
          <h1 style={{
            color: tokens.colors.text.primary,
            fontSize: '1.6rem', fontFamily: tokens.fonts.ui,
            fontWeight: 700, letterSpacing: '-0.02em', margin: 0,
          }}>
            Interface <span style={{ color: tokens.colors.accent.primary }}>Administrateur</span>
          </h1>
          <p style={{
            color: tokens.colors.text.muted, fontSize: '0.75rem',
            fontFamily: tokens.fonts.data, marginTop: '4px',
          }}>
            Port Autonome d'Abidjan — gestion des données et configuration
          </p>
        </div>

        {/* Alertes prédictives inline */}
        <div style={{ maxWidth: '400px', flex: 1, marginLeft: '2rem' }}>
          <AlertesPredictives predictions={predictions} meta={predictionsMeta} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          IMPORT DONNÉES
          ══════════════════════════════════════════════════════════ */}
      <SectionDivider label="Import données PAA" />

      <div className="pf-card" style={{
        background: tokens.colors.bg.surface, borderRadius: tokens.radius.md,
        padding: tokens.spacing.card, border: `1px solid ${tokens.colors.bg.border}`,
        marginBottom: '0.5rem', position: 'relative', overflow: 'hidden',
      }}>
        {/* Accent top gold pour import */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, transparent, ${tokens.colors.accent.secondary}, transparent)`,
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: tokens.colors.text.secondary, fontSize: '0.82rem', marginBottom: '0.5rem', fontFamily: tokens.fonts.ui }}>
              Importer les 2 016 mesures réelles de février 2025 dans Firestore pour alimenter
              le dashboard analytique et l'entraînement du modèle ML.
            </p>
            {message && (
              <div style={{
                padding: '0.5rem 0.8rem',
                background: status === 'error'
                  ? 'rgba(255,51,102,0.08)'
                  : status === 'done'
                  ? 'rgba(0,229,160,0.08)'
                  : 'rgba(0,245,212,0.06)',
                border: `1px solid ${status === 'error' ? 'rgba(255,51,102,0.25)' : status === 'done' ? 'rgba(0,229,160,0.25)' : 'rgba(0,245,212,0.2)'}`,
                borderRadius: tokens.radius.sm,
                fontSize: '0.8rem', fontFamily: tokens.fonts.data,
                color: status === 'error' ? tokens.colors.traffic.blocked
                     : status === 'done'  ? tokens.colors.traffic.fluid
                     : tokens.colors.text.secondary,
              }}>
                {message}
              </div>
            )}
            {status === 'loading' && (
              <div style={{ marginTop: '0.5rem', height: '3px', background: tokens.colors.bg.elevated, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${progress}%`,
                  background: `linear-gradient(90deg, ${tokens.colors.accent.primary}, ${tokens.colors.accent.secondary})`,
                  borderRadius: '2px', transition: 'width 0.3s ease',
                }} />
              </div>
            )}
          </div>
          <button
            onClick={handleSeed}
            disabled={status === 'loading' || status === 'done'}
            className={status === 'idle' || status === 'error' ? 'pf-btn-primary' : ''}
            style={{
              ...(status === 'done' ? {
                background: 'rgba(0,229,160,0.1)', color: tokens.colors.traffic.fluid,
                border: '1px solid rgba(0,229,160,0.3)', borderRadius: tokens.radius.sm,
                padding: '0.6rem 1.2rem', fontFamily: tokens.fonts.ui, fontWeight: 600, fontSize: '0.85rem',
              } : status === 'loading' ? {
                background: tokens.colors.bg.elevated, color: tokens.colors.text.muted,
                border: `1px solid ${tokens.colors.bg.border}`, borderRadius: tokens.radius.sm,
                padding: '0.6rem 1.2rem', fontFamily: tokens.fonts.ui, fontWeight: 600, fontSize: '0.85rem',
                cursor: 'not-allowed',
              } : { padding: '0.6rem 1.4rem', fontSize: '0.85rem', flexShrink: 0 }),
              flexShrink: 0,
            }}
          >
            {status === 'idle'    && 'Lancer l\'import →'}
            {status === 'loading' && `⏳ ${progress}%...`}
            {status === 'done'    && '✓ Import terminé'}
            {status === 'error'   && '↺ Réessayer'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          GESTION DES AXES
          ══════════════════════════════════════════════════════════ */}
      <SectionDivider
        label="Gestion des axes"
        meta="Modif. répercutée immédiatement sur la carte publique"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {axes.map(axe => <AxeForm key={axe.id} axe={axe} />)}
      </div>

      {/* ══════════════════════════════════════════════════════════
          GESTION DES TRONÇONS
          ══════════════════════════════════════════════════════════ */}
      <SectionDivider
        label="Gestion des tronçons"
        meta={`${troncons.length} enregistré(s)`}
      />

      <div style={{ display: 'flex', gap: tokens.spacing.gap, flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: '340px' }}>
          <TronconForm editing={editingTroncon} onDone={() => setEditingTroncon(null)} />
        </div>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <TronconList troncons={troncons} onEdit={setEditingTroncon} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          COLLECTE AUTOMATIQUE
          ══════════════════════════════════════════════════════════ */}
      <SectionDivider
        label="Collecte automatique"
        meta={loadingCollecte ? 'chargement...' : `${collecteAuto.length} mesures · GitHub Actions · 15 min`}
      />

      <div className="pf-card" style={{
        background: tokens.colors.bg.surface, borderRadius: tokens.radius.md,
        padding: tokens.spacing.card, border: `1px solid ${tokens.colors.bg.border}`,
        marginBottom: '0.5rem', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, transparent, ${tokens.colors.accent.primary}, transparent)`,
        }} />
        <div style={{ flex: 1 }}>
          <p style={{ color: tokens.colors.text.secondary, fontSize: '0.8rem', margin: 0, fontFamily: tokens.fonts.ui }}>
            {loadingCollecte
              ? 'Chargement des données...'
              : `${collecteAuto.length} mesures collectées automatiquement (24h/24, toutes les 15 min).`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            onClick={() => exportToCSV(collecteAuto, `portflow_collecte_${Date.now()}.csv`)}
            disabled={collecteAuto.length === 0}
            className="pf-btn-secondary"
            style={{ opacity: collecteAuto.length === 0 ? 0.4 : 1, cursor: collecteAuto.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            ↓ CSV
          </button>
          <button
            onClick={() => exportToExcel(collecteAuto, `portflow_collecte_${Date.now()}.xlsx`)}
            disabled={collecteAuto.length === 0}
            className="pf-btn-secondary"
            style={{ opacity: collecteAuto.length === 0 ? 0.4 : 1, cursor: collecteAuto.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            ↓ Excel
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          DASHBOARD ANALYTIQUE
          ══════════════════════════════════════════════════════════ */}
      <SectionDivider
        label="Dashboard analytique"
        meta={loadingHisto ? 'chargement...' : `${historique.length} mesures · fév. 2025`}
      />

      {/* ── Panneau de filtres ─────────────────────────────────── */}
      <div style={{
        background: tokens.colors.bg.surface,
        border: `1px solid ${tokens.colors.bg.border}`,
        borderRadius: tokens.radius.md,
        padding: tokens.spacing.card,
        marginBottom: tokens.spacing.gap,
        display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Top accent teal discret */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: `linear-gradient(90deg, transparent, ${tokens.colors.bg.border} 30%, ${tokens.colors.bg.border} 70%, transparent)`,
        }} />

        {/* Filtre axe */}
        <div>
          <label style={filterLabel}>Axe</label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {axes.map(axe => (
              <FilterBtn
                key={axe.id}
                active={selectedAxeId === axe.id}
                onClick={() => handleAxeChange(axe.id)}
                axeColor={getAxeColor(axe.num)}
              >
                {axe.nom.split(' — ')[0]}
              </FilterBtn>
            ))}
          </div>
        </div>

        {/* Filtre sens */}
        {aDeuxSens && (
          <div>
            <label style={filterLabel}>Sens</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {['aller', 'retour'].map(s => (
                <FilterBtn
                  key={s}
                  active={selectedSens === s}
                  onClick={() => setSelectedSens(s)}
                >
                  {s}
                </FilterBtn>
              ))}
            </div>
          </div>
        )}

        {/* Plage horaire */}
        <div>
          <label style={filterLabel}>Plage horaire</label>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <select value={heureDebut} onChange={e => setHeureDebut(Number(e.target.value))} className="pf-select">
              {Array.from({ length: 12 }, (_, i) => i + 7).map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
            <span style={{ color: tokens.colors.text.muted, fontFamily: tokens.fonts.data, fontSize: '0.8rem' }}>→</span>
            <select value={heureFin} onChange={e => setHeureFin(Number(e.target.value))} className="pf-select">
              {Array.from({ length: 12 }, (_, i) => i + 7).map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
        </div>

        {/* Filtre période (donut) */}
        <div>
          <label style={filterLabel}>Période</label>
          <select value={filtrePeriode} onChange={e => setFiltrePeriode(e.target.value)} className="pf-select">
            <option value="tous">Tous les jours</option>
            <option value="ouvrable">Jours ouvrables</option>
            <option value="weekend">Week-end</option>
          </select>
        </div>
      </div>

      {/* ── Bascule Temps réel / Prévision ────────────────────── */}
      <div style={{
        display: 'flex', gap: '0.5rem', alignItems: 'center',
        marginBottom: tokens.spacing.gap, flexWrap: 'wrap',
      }}>
        {/* Mode live */}
        <button
          onClick={() => setCarteMode('live')}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: carteMode === 'live'
              ? 'rgba(0,229,160,0.12)'
              : tokens.colors.bg.elevated,
            color: carteMode === 'live' ? tokens.colors.traffic.fluid : tokens.colors.text.secondary,
            border: carteMode === 'live'
              ? '1px solid rgba(0,229,160,0.35)'
              : `1px solid ${tokens.colors.bg.border}`,
            borderRadius: tokens.radius.sm,
            padding: '0.5rem 1rem', cursor: 'pointer',
            fontSize: '0.82rem', fontFamily: tokens.fonts.ui, fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: carteMode === 'live' ? '0 0 12px rgba(0,229,160,0.15)' : 'none',
          }}
        >
          {carteMode === 'live' && <span className="pf-dot-live" style={{ width: 6, height: 6 }} />}
          Temps réel
        </button>

        {/* Mode prévision */}
        <button
          onClick={() => setCarteMode('prevision')}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: carteMode === 'prevision'
              ? 'rgba(192,132,252,0.12)'
              : tokens.colors.bg.elevated,
            color: carteMode === 'prevision' ? '#C084FC' : tokens.colors.text.secondary,
            border: carteMode === 'prevision'
              ? '1px solid rgba(192,132,252,0.35)'
              : `1px solid ${tokens.colors.bg.border}`,
            borderRadius: tokens.radius.sm,
            padding: '0.5rem 1rem', cursor: 'pointer',
            fontSize: '0.82rem', fontFamily: tokens.fonts.ui, fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: carteMode === 'prevision' ? '0 0 12px rgba(192,132,252,0.15)' : 'none',
          }}
        >
          🔮 Prévision
        </button>

        {/* Filtres jour/heure en mode prévision */}
        {carteMode === 'prevision' && (
          <>
            <div style={{ width: '1px', height: '24px', background: tokens.colors.bg.border }} />
            <select value={jourApercu} onChange={e => setJourApercu(e.target.value)} className="pf-select">
              {['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'].map(j => (
                <option key={j} value={j}>{j.charAt(0).toUpperCase() + j.slice(1)}</option>
              ))}
            </select>
            <select value={heureApercu} onChange={e => setHeureApercu(Number(e.target.value))} className="pf-select">
              {Array.from({ length: 12 }, (_, i) => i + 7).map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
          </>
        )}
      </div>

      {/* Récap prévision */}
      {carteMode === 'prevision' && (
        <PrevisionRecap predictions={predictions} jourLabel={jourApercu} heure={heureApercu} />
      )}

      {/* Carte */}
      <div style={{
        marginBottom:  tokens.spacing.gap,
        borderRadius:  tokens.radius.md,
        overflow:      'hidden',
        border:        `1px solid ${tokens.colors.bg.border}`,
        boxShadow:     tokens.shadows.panel,
      }}>
        <MapView
          onAxeSelect={handleAxeChange}
          mode={carteMode}
          predictionLayer={predictions ? { predictions, jourLabel: jourApercu, heure: heureApercu } : null}
          height="460px"
        />
      </div>

      {/* Charts rangée 1 */}
      <div style={{ display: 'flex', gap: tokens.spacing.gap, flexWrap: 'wrap', marginBottom: tokens.spacing.gap }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <LineChart24h data={courbe24h} axeNom={`${axeActuel?.nom.split(' — ')[0]} (${selectedSens})`} />
        </div>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <BarChartAxes data={moyenneParAxe} selectedAxeId={selectedAxeId} />
        </div>
      </div>

      {/* Charts rangée 2 */}
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

const filterLabel = {
  color: tokens.colors.text.muted,
  fontSize: '0.65rem',
  fontFamily: tokens.fonts.ui,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  display: 'block',
  marginBottom: '6px',
}

export default AdminView
