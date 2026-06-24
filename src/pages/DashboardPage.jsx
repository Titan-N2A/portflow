import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Clock, AlertTriangle, BarChart2, Gauge, RefreshCw, Zap, MapPin } from 'lucide-react'
import { C, levelColor, levelLabel, levelBg } from '../styles/tokens'
import { useTrafficData, AXES_OFFICIELS } from '../hooks/useTrafficData'
import { useAxesFirestore } from '../hooks/useAxesFirestore'
import { usePredictions } from '../hooks/usePredictions'
import { AXE_COLORS } from '../data/defaultData'
import { askGemini, buildTrafficPrompt } from '../services/gemini'

const PAA_CENTER = [5.2550, -4.0000]

const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

function getPredForAxe(predictions, axeId) {
  if (!predictions) return null
  const now   = new Date()
  const jour  = JOURS_FR[now.getDay()]
  const heure = now.getHours()
  // Cherche l'heure courante, sinon la plus proche dans 7h-18h
  const h = Math.max(7, Math.min(18, heure))
  const key = `${axeId}_aller_${jour}_${h}h`
  return predictions[key] ?? null
}

// ── Marqueur numéroté (cercle bleu) ──────────────────────
function makeNumIcon(num, color = C.primary) {
  return L.divIcon({
    html: `<div style="
      background:${color};color:#fff;border-radius:50%;
      width:26px;height:26px;display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:12px;font-family:Inter,sans-serif;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.9)
    ">${num}</div>`,
    className: '', iconSize: [26, 26], iconAnchor: [13, 13],
  })
}

// ── Marqueur PAA (cercle vert) ────────────────────────────
const PAA_ICON = L.divIcon({
  html: `<div style="
    background:#27AE60;color:#fff;border-radius:50%;
    width:30px;height:30px;display:flex;align-items:center;justify-content:center;
    font-size:10px;font-weight:700;font-family:Inter,sans-serif;
    box-shadow:0 2px 10px rgba(39,174,96,0.5);border:2px solid #fff;
    white-space:nowrap;letter-spacing:-0.5px
  ">PAA</div>`,
  className: '', iconSize: [30, 30], iconAnchor: [15, 15],
})

// ── KPI Card ─────────────────────────────────────────────
function KPICard({ icon: Icon, iconColor = C.primary, title, value, unit, sub, badge, badgeColor }) {
  return (
    <div className="fp-card fp-fade-in" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '8px',
          background: `${iconColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} color={iconColor} />
        </div>
      </div>
      <p style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {title}
      </p>
      {badge ? (
        <>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 4 }}>{value}</p>
          <span className="fp-badge fp-badge-red">{badge}</span>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value ?? '—'}</span>
          {unit && <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{unit}</span>}
        </div>
      )}
    </div>
  )
}

// ── Dashboard Map ─────────────────────────────────────────
function DashboardMap({ mesures, mapMode, predictions }) {
  return (
    <MapContainer center={PAA_CENTER} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      <ZoomControl position="bottomright" />

      {/* Axes polylines colorées selon congestion ou prévision ML */}
      {AXES_OFFICIELS.map(axe => {
        const isPrevision = mapMode === 'prevision'
        const pred   = isPrevision ? getPredForAxe(predictions, axe.id) : null
        const m      = mesures[axe.id]
        const niveau = isPrevision ? (pred?.niveau_prevu ?? 0) : (m?.niveau ?? 0)
        const color  = niveau > 0 ? levelColor(niveau) : AXE_COLORS[axe.id]
        return (
          <Polyline key={axe.id} positions={axe.coordinates} color={color} weight={6} opacity={0.9}>
            <Popup>
              <strong style={{ color }}>{axe.nom}</strong><br />
              {isPrevision ? (
                pred ? (
                  <>
                    <em style={{ fontSize: 10, color: '#888' }}>Prévision ML · Random Forest</em><br />
                    Temps prévu : <strong>{pred.temps_prevu_min} min</strong><br />
                    Confiance : <strong>{pred.confiance_pct}%</strong><br />
                    <span style={{
                      display: 'inline-block', marginTop: 4,
                      padding: '2px 8px', borderRadius: 999,
                      background: levelBg(niveau), color: levelColor(niveau),
                      fontWeight: 600, fontSize: 11,
                    }}>
                      Niveau {niveau} — {levelLabel(niveau)}
                    </span>
                  </>
                ) : 'Prévision indisponible'
              ) : m ? (
                <>
                  Temps live : <strong>{m.tempsLive} min</strong><br />
                  Retard : <strong style={{ color: m.retard > 0 ? '#C0392B' : '#27AE60' }}>+{m.retard} min</strong><br />
                  Vitesse : {m.vitesse} km/h<br />
                  <span style={{
                    display: 'inline-block', marginTop: 4,
                    padding: '2px 8px', borderRadius: 999,
                    background: levelBg(niveau), color: levelColor(niveau),
                    fontWeight: 600, fontSize: 11,
                  }}>
                    Niveau {niveau} — {levelLabel(niveau)}
                  </span>
                </>
              ) : 'Chargement...'}
            </Popup>
          </Polyline>
        )
      })}

      {/* Marqueurs numérotés */}
      {AXES_OFFICIELS.map(axe => (
        <Marker key={axe.id + '_mk'} position={axe.start} icon={makeNumIcon(axe.num, AXE_COLORS[axe.id])}>
          <Popup><strong>{axe.shortNom}</strong><br />{axe.distance} · Réf. {axe.tRef} min</Popup>
        </Marker>
      ))}

      {/* Marqueur PAA */}
      <Marker position={[5.2900, -4.0200]} icon={PAA_ICON}>
        <Popup><strong>Port Autonome d'Abidjan</strong><br />Point de référence</Popup>
      </Marker>
    </MapContainer>
  )
}

// ── Dashboard Page ────────────────────────────────────────
function DashboardPage() {
  // Axes depuis Firestore (persistés, mis à jour par l'admin)
  const { axes: firestoreAxes, loading: axesLoading } = useAxesFirestore()
  const axes = firestoreAxes.length > 0 ? firestoreAxes : AXES_OFFICIELS

  // Données trafic TomTom (calculées sur les axes Firestore)
  const { mesures, kpis, loading, lastUpdate, refresh } = useTrafficData(axes)
  const { predictions } = usePredictions()
  const [mapMode, setMapMode]         = useState('live')
  const [iaText,  setIaText]          = useState('')
  const [iaLoading, setIaLoading]     = useState(false)

  async function loadIA() {
    setIaLoading(true)
    const prompt = buildTrafficPrompt(mesures, AXES_OFFICIELS)
    const resp   = await askGemini(prompt)
    setIaText(resp ?? 'Service IA temporairement indisponible.')
    setIaLoading(false)
  }

  useEffect(() => {
    if (!loading && Object.keys(mesures).length > 0 && !iaText) loadIA()
  }, [loading])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', padding: '1.1rem', gap: '1rem' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            {lastUpdate ? `Mis à jour à ${lastUpdate.toLocaleTimeString('fr-FR')}` : 'Chargement...'}
            {mesures.axe1?.simulated && ' · données simulées'}
          </p>
        </div>
        <button className="fp-btn fp-btn-primary" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'fp-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* ── 5 KPI Cards ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.8rem', flexShrink: 0 }}>
        <KPICard icon={Clock} iconColor={C.primary}
          title="Temps moyen global"
          value={kpis?.tempsGlobal} unit="min" />

        <KPICard icon={AlertTriangle} iconColor={C.danger}
          title="Tronçon critique"
          value={kpis?.tronconCritique?.nom ?? '—'}
          badge={kpis?.tronconCritique ? `Niveau ${kpis.tronconCritique.niveau} — ${levelLabel(kpis.tronconCritique.niveau)}` : null} />

        <KPICard icon={Clock} iconColor={C.warning}
          title="Retard moyen"
          value={kpis?.retardMoyen} unit="min" />

        <KPICard icon={BarChart2} iconColor="#8E44AD"
          title="Axes congestionnés"
          value={kpis?.pctCong} unit="%" />

        <KPICard icon={Gauge} iconColor={C.success}
          title="Vitesse moyenne"
          value={kpis?.vitesseMoyenne} unit="km/h" />
      </div>

      {/* ── Map + Panneau droit ────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', gap: '0.8rem', minHeight: 0 }}>

        {/* Carte */}
        <div style={{ flex: '1 1 65%', position: 'relative', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <DashboardMap mesures={mesures} mapMode={mapMode} predictions={predictions} />

          {/* Boutons superposés */}
          <div style={{
            position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, display: 'flex', background: '#fff',
            borderRadius: '8px', overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
          }}>
            {[['live','Temps réel'],['prevision','Prévisions ML']].map(([mode, label]) => (
              <button key={mode} onClick={() => setMapMode(mode)} style={{
                padding: '6px 16px', border: 'none', cursor: 'pointer',
                background: mapMode === mode ? C.primary : 'transparent',
                color: mapMode === mode ? '#fff' : C.text,
                fontWeight: 600, fontSize: 12, fontFamily: "'Inter', sans-serif",
                transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Panneau droit */}
        <div style={{ flex: '0 0 310px', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>

          {/* Alertes actives */}
          <div className="fp-card" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <AlertTriangle size={15} color={C.danger} />
              <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Alertes actives</span>
              <span className="fp-badge fp-badge-red" style={{ marginLeft: 'auto' }}>
                {kpis?.alertes?.length ?? 0}
              </span>
            </div>
            {kpis?.alertes?.length ? (
              kpis.alertes.map(({ axe, mesure }) => (
                <div key={axe.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0', borderBottom: `1px solid ${C.borderLight}`,
                }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{axe.shortNom}</p>
                    <p style={{ fontSize: 11, color: C.textMuted }}>{mesure.tempsLive} min · +{mesure.retard} min</p>
                  </div>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: levelColor(mesure.niveau),
                    boxShadow: `0 0 6px ${levelColor(mesure.niveau)}80`,
                  }} />
                </div>
              ))
            ) : (
              <p style={{ fontSize: 12, color: C.textMuted }}>Aucune alerte — trafic fluide</p>
            )}
          </div>

          {/* IA FlowPort */}
          <div className="fp-card" style={{ padding: '1rem', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Zap size={15} color={C.primary} />
              <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>IA FlowPort</span>
              <button onClick={loadIA} disabled={iaLoading}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2 }}>
                <RefreshCw size={13} className={iaLoading ? 'fp-spin' : ''} />
              </button>
            </div>
            {iaLoading ? (
              <div style={{ fontSize: 12, color: C.textMuted }}>Génération en cours...</div>
            ) : iaText ? (
              <p style={{ fontSize: 12, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{iaText}</p>
            ) : (
              <p style={{ fontSize: 12, color: C.textMuted }}>Cliquez sur ↺ pour générer.</p>
            )}
          </div>

          {/* État des axes */}
          <div className="fp-card" style={{ padding: '1rem' }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: '0.75rem' }}>État des axes</p>
            {AXES_OFFICIELS.map(axe => {
              const m = mesures[axe.id]
              const niveau = m?.niveau ?? 0
              return (
                <div key={axe.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0', borderBottom: `1px solid ${C.borderLight}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 3, height: 28, borderRadius: 2, background: AXE_COLORS[axe.id], flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{axe.shortNom}</p>
                      <p style={{ fontSize: 11, color: C.textMuted }}>{m ? `${m.tempsLive} min` : '—'}</p>
                    </div>
                  </div>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: niveau > 0 ? levelColor(niveau) : '#e2e8f0',
                    boxShadow: niveau > 0 ? `0 0 8px ${levelColor(niveau)}80` : 'none',
                  }} title={levelLabel(niveau)} />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
