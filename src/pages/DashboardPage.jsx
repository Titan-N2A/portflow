import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Clock, AlertTriangle, CheckCircle2, Gauge, RefreshCw, Zap, X, Users } from 'lucide-react'
import { C, levelColor, levelLabel, levelBg } from '../styles/tokens'
import { useTrafficData, AXES_OFFICIELS } from '../hooks/useTrafficData'
import { useAxesFirestore } from '../hooks/useAxesFirestore'
import { usePredictions } from '../hooks/usePredictions'
import { useGeolocation } from '../hooks/useGeolocation'
import { useActiveUsersCount } from '../hooks/useActiveUsersCount'
import AlertesPredictives from '../components/Dashboard/AlertesPredictives'
import GeocoderSearch from '../components/shared/GeocoderSearch'
import ETACard from '../components/shared/ETACard'
import { createETATracker } from '../services/eta'
import { AXE_COLORS, AXE_PALETTE, PALM_BEACH_COORDS, PAA_CENTER_COORDS } from '../data/defaultData'
import { askGemini, buildTrafficPrompt } from '../services/gemini'
import { useIsMobile } from '../hooks/useIsMobile'

const PAA_CENTER = PAA_CENTER_COORDS   // [5.304290, -4.023577]
const PALM_BEACH = PALM_BEACH_COORDS   // [5.258715, -3.982088]

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

// ── Marqueur délimitation tronçon (carré coloré avec code) ──
function makeTronconEndIcon(code, color) {
  return L.divIcon({
    html: `<div style="
      background:${color};color:#fff;border-radius:3px;
      padding:1px 5px;font-size:9px;font-weight:700;
      font-family:Inter,sans-serif;white-space:nowrap;
      box-shadow:0 1px 5px rgba(0,0,0,0.35);border:1.5px solid #fff;
    ">${code}</div>`,
    className: '', iconSize: [null, 16], iconAnchor: [0, 8],
  })
}

// ── Marqueur position utilisateur (point bleu pulsant) ────
const USER_POSITION_ICON = L.divIcon({
  html: `<div style="position:relative;width:22px;height:22px;">
    <div style="position:absolute;inset:-8px;border-radius:50%;background:${C.primary}33;animation:fp-pulse 1.6s infinite;"></div>
    <div style="position:absolute;inset:0;border-radius:50%;background:${C.primary};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>
  </div>`,
  className: '', iconSize: [22, 22], iconAnchor: [11, 11],
})

// ── Marqueur destination (pin rouge) ──────────────────────
const DESTINATION_ICON = L.divIcon({
  html: `<div style="
    background:${C.danger};border-radius:50% 50% 50% 0;
    width:24px;height:24px;transform:rotate(-45deg);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid #fff;
  "><div style="transform:rotate(45deg);width:7px;height:7px;background:#fff;border-radius:50%;"></div></div>`,
  className: '', iconSize: [24, 24], iconAnchor: [12, 24],
})

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
function KPICard({ icon: Icon, iconColor = C.primary, title, value, unit, badge, flash, freshness }) {
  return (
    <div className={`fp-card${flash ? ' fp-kpi-flash' : ''}`} style={{ flex: 1, minWidth: 0, transition: 'background 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '8px',
          background: `${iconColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} color={iconColor} />
        </div>
        {freshness && (
          <span title={freshness.label} style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 2,
            background: freshness.color,
            boxShadow: freshness.tier === 'live' ? `0 0 5px ${freshness.color}` : 'none',
          }} />
        )}
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

// ── Zoom intelligent sur l'axe sélectionné ───────────────
function MapZoomController({ selectedAxe, mesures }) {
  const map     = useMap()
  const mesRef  = useRef(mesures)
  const mounted = useRef(false)
  useEffect(() => { mesRef.current = mesures }, [mesures])

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (!selectedAxe) {
      map.flyTo(PAA_CENTER, 13, { duration: 0.5 })
      return
    }
    const m   = mesRef.current[selectedAxe.id]
    const raw = (m?.geometry?.length > 5)             ? m.geometry
      : (selectedAxe.geometryRoute?.length > 5)       ? selectedAxe.geometryRoute
      : (selectedAxe.coordinates ?? [])
    if (raw.length < 2) return
    const lls = raw.map(p => Array.isArray(p) ? p : [p.lat, p.lng])
    try { map.flyToBounds(L.latLngBounds(lls), { padding: [60, 60], maxZoom: 15, duration: 0.7 }) } catch {}
  }, [selectedAxe?.id, map])

  return null
}

// ── Dashboard Map ─────────────────────────────────────────
function DashboardMap({ axes, mesures, mapMode, predictions, troncons, selectedAxe, onAxeSelect, userPosition, destination, routeGeometry }) {
  return (
    <MapContainer center={PAA_CENTER} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      <ZoomControl position="bottomright" />
      <MapZoomController selectedAxe={selectedAxe} mesures={mesures} />

      {/* Axes polylines — utilise les axes Firestore dynamiques */}
      {axes.map((axe, idx) => {
        const isPrevision = mapMode === 'prevision'
        const pred      = isPrevision ? getPredForAxe(predictions, axe.id) : null
        const m         = mesures[axe.id]
        const niveau    = isPrevision ? (pred?.niveau_prevu ?? 0) : (m?.niveau ?? 0)
        const baseColor = AXE_COLORS[axe.id] ?? axe.color ?? AXE_PALETTE[idx % AXE_PALETTE.length]
        const color     = niveau > 0 ? levelColor(niveau) : baseColor
        // Priorité : géométrie TomTom live > géométrie pré-calculée Firestore > waypoints admin
        const positions = (m?.geometry?.length > 5)        ? m.geometry
          : (axe.geometryRoute?.length > 5)                ? axe.geometryRoute
          : (axe.coordinates ?? [])
        if (positions.length < 2) return null
        // Opacité en 3 paliers : donnée fraîche (0.95) > mesure présente mais
        // périmée (0.65, on la montre encore mais atténuée) > aucune donnée (0.45)
        const opacity     = !m ? 0.45 : m.stale ? 0.65 : 0.95
        const isSelected  = selectedAxe?.id === axe.id
        return (
          <Polyline
            key={axe.id}
            positions={positions}
            color={color}
            weight={isSelected ? 11 : 7}
            opacity={isSelected ? 1 : opacity}
            eventHandlers={{ click: (e) => { e.originalEvent?.stopPropagation?.(); onAxeSelect(axe) } }}
          >
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

      {/* Tronçons — coloration individuelle par niveau propre + popup cadrant */}
      {[...(troncons ?? [])].sort((a, b) => {
        if (a.axeId !== b.axeId) return 0
        return (a.ordre ?? 0) - (b.ordre ?? 0)
      }).flatMap(t => {
        const positions = t.coordinates ?? []
        if (positions.length < 2) return []

        const m      = mesures[t.axeId]
        const axe    = axes.find(a => a.id === t.axeId)
        const axeIdx = axes.findIndex(a => a.id === t.axeId)

        // ── Indicateurs propres au tronçon (proportionnels à sa distance) ──
        const distKm     = parseFloat(t.dist) || 0
        const vitesse    = m?.vitesse ?? 0
        const axeDist    = parseFloat(String(axe?.distance ?? axe?.dist ?? '')) || distKm || 1
        const tempsEst   = vitesse > 0
          ? Math.round((distKm / vitesse) * 60 * 10) / 10
          : null
        const tRefProp   = axe?.tRef && axeDist > 0
          ? Math.round((distKm / axeDist) * axe.tRef * 10) / 10
          : null
        const retardProp = m?.retard != null && axeDist > 0
          ? Math.round((distKm / axeDist) * m.retard * 10) / 10
          : null
        const ratioVal   = tRefProp && tempsEst ? tempsEst / tRefProp : null
        const ratio      = ratioVal ? ratioVal.toFixed(2) : null

        // ── Niveau individuel du tronçon (calculé depuis son ratio, pas l'axe parent) ──
        const predNiveau = mapMode === 'prevision'
          ? (getPredForAxe(predictions, t.axeId)?.niveau_prevu ?? null)
          : null
        const tronconNiveau = predNiveau !== null ? predNiveau
          : ratioVal !== null ? (
              ratioVal <= 1.10 ? 1 :
              ratioVal <= 1.25 ? 2 :
              ratioVal <= 1.50 ? 3 :
              ratioVal <= 2.00 ? 4 : 5
            )
          : (m?.niveau ?? 0)

        const baseColor = AXE_COLORS[t.axeId] ?? (axes.find(a => a.id === t.axeId)?.color) ?? AXE_PALETTE[Math.max(axeIdx, 0) % AXE_PALETTE.length]
        // Priorité : niveau propre du tronçon > niveau de l'axe parent > couleur identité
        const color = tronconNiveau > 0
          ? levelColor(tronconNiveau)
          : (m?.niveau ?? 0) > 0
            ? levelColor(m.niveau)
            : baseColor

        // ── Popup cadrant ────────────────────────────────────────────────
        const popup = (
          <Popup maxWidth={245} minWidth={225}>
            <div style={{ fontFamily: "'Inter',sans-serif", padding: '2px 0' }}>

              {/* En-tête */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
                <div style={{ width: 8, height: 36, borderRadius: 4, background: color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1a2a3a', lineHeight: 1.2 }}>{t.nom}</div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                    {t.code} · {t.dist}
                    {axe && <span style={{ color: baseColor, fontWeight: 600 }}> · {axe.shortNom}</span>}
                  </div>
                </div>
              </div>

              {/* Badge niveau individuel */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <span style={{
                  padding: '4px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: levelBg(tronconNiveau || 1),
                  color: levelColor(tronconNiveau || 1),
                  border: `1px solid ${levelColor(tronconNiveau || 1)}40`,
                }}>
                  {tronconNiveau > 0
                    ? `N${tronconNiveau} — ${levelLabel(tronconNiveau)}`
                    : 'Données en attente'}
                </span>
              </div>

              {/* Grille 2×2 indicateurs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
                {[
                  { label: 'Vitesse',    value: vitesse > 0 ? vitesse : '—', unit: 'km/h', c: color },
                  { label: 'Temps est.', value: tempsEst ?? '—',             unit: 'min',  c: '#1a2a3a' },
                  {
                    label: 'Retard',
                    value: retardProp != null
                      ? (retardProp >= 0 ? `+${retardProp}` : String(retardProp))
                      : '—',
                    unit: 'min',
                    c: retardProp != null && retardProp > 0 ? '#C0392B' : '#27AE60',
                  },
                  { label: 'Ratio ×',   value: ratio ?? '—',                 unit: '',     c: color },
                ].map(({ label, value, unit, c }) => (
                  <div key={label} style={{ background: '#f8fafc', borderRadius: 7, padding: '7px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: c, lineHeight: 1 }}>{value}</div>
                    {unit && <div style={{ fontSize: 9, color: '#bbb', marginTop: 2 }}>{unit}</div>}
                  </div>
                ))}
              </div>

              {/* Pied : T_réf */}
              <div style={{ fontSize: 10, color: '#999', paddingTop: 6, borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                Temps de référence tronçon : <strong style={{ color: '#1a2a3a' }}>{tRefProp ?? '—'} min</strong>
              </div>
            </div>
          </Popup>
        )

        return [
          <Polyline key={t.id + '_l'} positions={positions} color={color} weight={5} opacity={0.93}>
            {popup}
          </Polyline>,
          <Marker key={t.id + '_s'} position={positions[0]} icon={makeTronconEndIcon(t.code + ' ▶', color)}>
            {popup}
          </Marker>,
          <Marker key={t.id + '_e'} position={positions[positions.length - 1]} icon={makeTronconEndIcon('◀ ' + t.code, color)}>
            {popup}
          </Marker>,
        ]
      })}

      {/* Trajets retour — tous les axes bidirectionnels, tracé en pointillés */}
      {axes.filter(a => a.bidirectionnel).map((axe, idx) => {
        const m         = mesures[axe.id]
        const retourPos = (m?.geometryRetour?.length > 5) ? m.geometryRetour : (axe.coordinatesRetour ?? [])
        if (retourPos.length < 2) return null
        const niveau    = m?.niveau ?? 0
        const color     = niveau > 0 ? levelColor(niveau) : (AXE_COLORS[axe.id] ?? axe.color ?? AXE_PALETTE[idx % AXE_PALETTE.length])
        const opacity   = m ? 0.6 : 0.25
        return (
          <Polyline key={axe.id + '_retour'} positions={retourPos} color={color} weight={4} opacity={opacity} dashArray="8 6">
            <Popup>
              <strong style={{ color }}>{axe.shortNom ?? axe.nom} (retour)</strong><br />
              {m?.tempsRetour ? `Temps retour : ${m.tempsRetour} min` : 'Données retour indisponibles'}
            </Popup>
          </Polyline>
        )
      })}

      {/* Marqueurs numérotés — couleur = niveau de congestion si dispo, sinon identité */}
      {axes.map((axe, idx) => {
        const startPos = axe.start ?? axe.coordinates?.[0]
        if (!startPos) return null
        const m         = mesures[axe.id]
        const niveau    = mapMode === 'prevision'
          ? (getPredForAxe(predictions, axe.id)?.niveau_prevu ?? 0)
          : (m?.niveau ?? 0)
        const baseColor = AXE_COLORS[axe.id] ?? axe.color ?? AXE_PALETTE[idx % AXE_PALETTE.length]
        const color     = niveau > 0 ? levelColor(niveau) : baseColor
        return (
          <Marker key={axe.id + '_mk'} position={startPos} icon={makeNumIcon(axe.num ?? idx + 1, color)}>
            <Popup>
              <strong>{axe.shortNom ?? axe.nom}</strong><br />
              {axe.distance} · Réf. {axe.tRef} min
              {axe.bidirectionnel && <><br /><em style={{ fontSize: 10, color: '#888' }}>Bidirectionnel (aller + retour)</em></>}
            </Popup>
          </Marker>
        )
      })}

      {/* Marqueur PAA */}
      <Marker position={PAA_CENTER_COORDS} icon={PAA_ICON}>
        <Popup><strong>Port Autonome d'Abidjan</strong><br />Centre de surveillance trafic</Popup>
      </Marker>

      {/* Marqueur Pharmacie Palm Beach */}
      <Marker position={PALM_BEACH} icon={makeNumIcon('★', '#C0392B')}>
        <Popup>
          <strong style={{ color: '#C0392B' }}>Pharmacie Palm Beach</strong><br />
          <span style={{ fontSize: 11, color: '#555' }}>Arrivée commune · 3 axes convergent ici</span>
        </Popup>
      </Marker>

      {/* Trajet utilisateur — tracé + marqueurs position/destination */}
      {routeGeometry?.length > 1 && (
        <Polyline positions={routeGeometry} color={C.primary} weight={5} opacity={0.85} dashArray="1 10" />
      )}
      {userPosition && (
        <Marker position={[userPosition.lat, userPosition.lng]} icon={USER_POSITION_ICON}>
          <Popup><strong>Votre position</strong></Popup>
        </Marker>
      )}
      {destination && (
        <Marker position={[destination.lat, destination.lng]} icon={DESTINATION_ICON}>
          <Popup><strong>{destination.label}</strong></Popup>
        </Marker>
      )}
    </MapContainer>
  )
}

// ── Dashboard Page ────────────────────────────────────────
function DashboardPage() {
  const { axes: firestoreAxes, troncons } = useAxesFirestore()
  const axes = firestoreAxes.length > 0 ? firestoreAxes : AXES_OFFICIELS

  const { mesures, kpis, loading, lastUpdate, refresh, refreshing, dataHealth } = useTrafficData(axes)
  const { predictions, meta: predMeta } = usePredictions()
  const { position: userPosition } = useGeolocation(axes)
  const activeUsersCount = useActiveUsersCount()
  const isMobile = useIsMobile()
  const [mapMode,      setMapMode]      = useState('live')
  const [selectedAxe,  setSelectedAxe]  = useState(null)
  const [iaText,       setIaText]       = useState('')
  const [iaLoading,    setIaLoading]    = useState(false)
  const [nowTick,      setNowTick]      = useState(() => Date.now())
  const [flashKpis,    setFlashKpis]    = useState(false)
  const [destination,  setDestination]  = useState(null)
  const [eta,          setEta]          = useState(null)
  const [etaLoading,   setEtaLoading]   = useState(false)
  const etaTrackerRef = useRef(null)
  if (!etaTrackerRef.current) etaTrackerRef.current = createETATracker()

  function handleAxeSelect(axe) {
    setSelectedAxe(prev => prev?.id === axe.id ? null : axe)
  }

  function handleDestinationSelect(dest) {
    setDestination(dest)
    if (!dest) setEta(null)
  }

  // Recalcule l'ETA quand la position ou la destination change
  // (le tracker interne applique le seuil 200m / 2min pour économiser le quota)
  useEffect(() => {
    if (!userPosition || !destination) return
    let cancelled = false
    setEtaLoading(true)
    etaTrackerRef.current.update(userPosition, destination).then(result => {
      if (!cancelled) setEta(result)
    }).finally(() => {
      if (!cancelled) setEtaLoading(false)
    })
    return () => { cancelled = true }
  }, [userPosition, destination])

  // Rafraîchit le texte "il y a X min" sans dépendre d'une nouvelle donnée
  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 30 * 1000)
    return () => clearInterval(tick)
  }, [])

  // Flash bref quand les KPIs changent
  const prevKpisRef = useRef(null)
  useEffect(() => {
    if (!kpis) return
    if (prevKpisRef.current !== null && prevKpisRef.current !== kpis.tempsGlobal) {
      setFlashKpis(true)
      const t = setTimeout(() => setFlashKpis(false), 800)
      return () => clearTimeout(t)
    }
    prevKpisRef.current = kpis.tempsGlobal
  }, [kpis])

  const hasData  = Object.keys(mesures).length > 0
  const dataAge  = lastUpdate ? Math.max(0, Math.floor((nowTick - lastUpdate.getTime()) / 60000)) : null
  const ageLabel = dataAge == null ? null : dataAge <= 0 ? 'à l\'instant' : dataAge === 1 ? 'il y a 1 min' : `il y a ${dataAge} min`
  // 3 paliers de fraîcheur (dataHealth.tier vient du hook, seule source de
  // vérité) : 'live' < 3min, 'maybe' 3-10min, 'lost' > 10min, 'none' jamais reçu.
  const freshBg = { live: '#E8F5E9', maybe: '#FEF3E0', lost: '#FEF2F2', none: '#F1F1F1' }[dataHealth.tier] ?? '#F1F1F1'
  const freshBorder = `${dataHealth.color}55`

  async function loadIA(currentMesures, force = false) {
    if (!force) {
      const cached = sessionStorage.getItem('fp_ia_dashboard')
      if (cached) { setIaText(cached); return }
    }
    setIaLoading(true)
    const prompt = buildTrafficPrompt(currentMesures ?? mesures, axes)
    const resp   = await askGemini(prompt)
    const text   = resp ?? 'Service IA temporairement indisponible.'
    setIaText(text)
    sessionStorage.setItem('fp_ia_dashboard', text)
    setIaLoading(false)
  }

  useEffect(() => {
    if (!loading && Object.keys(mesures).length > 0 && !iaText) loadIA(mesures)
  }, [loading])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: isMobile ? 'auto' : '100vh',
      overflow: isMobile ? 'visible' : 'hidden',
      padding: isMobile ? '0.85rem' : '1.1rem',
      gap: '0.85rem',
    }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: C.text }}>Dashboard</h1>
            {/* Indicateur de fraîcheur à 3 paliers — honnête : "En direct"
                seulement si <3min, sinon signale clairement la dégradation
                plutôt que de prétendre être live (dataHealth = source unique) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5,
              background: freshBg,
              border: `1px solid ${freshBorder}`,
              borderRadius: 20, padding: '2px 9px' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: refreshing ? '#F0AD4E' : dataHealth.color,
                animation: (refreshing || dataHealth.tier !== 'live') ? 'none' : 'fp-live-pulse 2s infinite',
                display: 'inline-block',
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: dataHealth.color, letterSpacing: '0.05em' }}>
                {refreshing ? 'MISE À JOUR...' : dataHealth.label.toUpperCase()}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
            {!lastUpdate
              ? 'Synchronisation en cours — en attente de données...'
              : dataHealth.tier === 'live'
                ? `Mis à jour à ${lastUpdate.toLocaleTimeString('fr-FR')} (${ageLabel})`
                : `Dernière donnée reçue à ${lastUpdate.toLocaleTimeString('fr-FR')} (${ageLabel}) — synchronisation ${dataHealth.tier === 'lost' ? 'interrompue' : 'ralentie'}`}
          </p>
        </div>
        <button className="fp-btn fp-btn-primary" style={{ fontSize: 12, padding: '0.4rem 0.8rem' }}
          onClick={async () => { sessionStorage.removeItem('fp_ia_dashboard'); await refresh(); loadIA(null, true) }}
          disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? 'fp-spin' : ''} />
          {!isMobile && 'Actualiser'}
        </button>
      </div>

      {/* ── KPI Cards — 2 colonnes sur mobile, 5 en ligne sur desktop ── */}
      <div style={{
        display: isMobile ? 'grid' : 'flex',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : undefined,
        gap: '0.75rem',
        flexShrink: 0,
      }}>
        <KPICard icon={Clock} iconColor={C.primary}
          title="Temps moyen" value={kpis?.tempsGlobal} unit="min" flash={flashKpis} freshness={dataHealth} />

        <KPICard icon={AlertTriangle} iconColor={C.danger}
          title="Tronçon critique"
          value={kpis?.tronconCritique?.nom ?? '—'}
          badge={kpis?.tronconCritique ? `N${kpis.tronconCritique.niveau} — ${levelLabel(kpis.tronconCritique.niveau)}` : null}
          flash={flashKpis} freshness={dataHealth} />

        <KPICard icon={CheckCircle2} iconColor={C.success}
          title="Meilleur axe"
          value={kpis?.meilleurAxe?.nom ?? '—'}
          badge={kpis?.meilleurAxe ? `N${kpis.meilleurAxe.niveau} — ${levelLabel(kpis.meilleurAxe.niveau)}` : null}
          flash={flashKpis} freshness={dataHealth} />

        <KPICard icon={Users} iconColor="#8E44AD"
          title="Usagers en direct" value={activeUsersCount} unit={activeUsersCount > 1 ? 'connectés' : 'connecté'} />

        <KPICard icon={Gauge} iconColor={C.success}
          title="Vitesse moy." value={kpis?.vitesseMoyenne} unit="km/h" flash={flashKpis} freshness={dataHealth} />
      </div>

      {/* ── Mon trajet ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem', flexShrink: 0 }}>
        <div className="fp-card" style={{ padding: '1rem', flex: isMobile ? 'none' : '0 0 300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Destination
          </p>
          <GeocoderSearch onSelect={handleDestinationSelect} />
          {!userPosition && (
            <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>
              ETA non disponible — activez la géolocalisation pour estimer votre arrivée.
            </p>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <ETACard eta={eta} loading={etaLoading} />
        </div>
      </div>

      {/* ── Map + Panneau droit ────────────────────────────── */}
      <div style={{
        flex: isMobile ? 'none' : 1,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '0.8rem',
        minHeight: 0,
      }}>

        {/* Carte */}
        <div style={{
          flex: isMobile ? 'none' : '1 1 65%',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          minHeight: 0,
        }}>
          <div style={{
            flex: isMobile ? 'none' : 1,
            height: isMobile ? 220 : undefined,
            position: 'relative', borderRadius: '10px', overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)', minHeight: 0,
          }}>
            <DashboardMap axes={axes} mesures={mesures} mapMode={mapMode} predictions={predictions} troncons={troncons} selectedAxe={selectedAxe} onAxeSelect={handleAxeSelect}
              userPosition={userPosition} destination={destination} routeGeometry={eta?.geometry} />

            {/* Boutons superposés */}
            <div style={{
              position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 1000, display: 'flex', background: '#fff',
              borderRadius: '8px', overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
            }}>
              {[['live','Temps réel'],['prevision','Prévisions ML']].map(([mode, label]) => (
                <button key={mode} onClick={() => setMapMode(mode)} style={{
                  padding: isMobile ? '5px 10px' : '6px 16px',
                  border: 'none', cursor: 'pointer',
                  background: mapMode === mode ? C.primary : 'transparent',
                  color: mapMode === mode ? '#fff' : C.text,
                  fontWeight: 600, fontSize: isMobile ? 11 : 12,
                  fontFamily: "'Inter', sans-serif", transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Légende niveaux de congestion */}
          <div className="fp-card" style={{
            padding: '0.5rem 0.9rem', flexShrink: 0, minHeight: 38,
            display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, flexWrap: 'wrap',
          }}>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                  background: levelColor(n), boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
                }} />
                <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {levelLabel(n)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Panneau droit */}
        <div style={{
          flex: isMobile ? 'none' : '0 0 310px',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          overflowY: isMobile ? 'visible' : 'auto',
        }}>

          {/* ── Panneau axe sélectionné ───────────────────────── */}
          {selectedAxe && (() => {
            const m        = mesures[selectedAxe.id]
            const niveau   = m?.niveau ?? 0
            const axeColor = AXE_COLORS[selectedAxe.id] ?? C.primary
            const color    = niveau > 0 ? levelColor(niveau) : axeColor
            return (
              <div className="fp-card" style={{ padding: '1rem', borderTop: `3px solid ${color}`, flexShrink: 0 }}>

                {/* En-tête */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 30, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>{selectedAxe.shortNom ?? selectedAxe.nom}</p>
                      <p style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{selectedAxe.distance} · Réf. {selectedAxe.tRef} min</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedAxe(null)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: C.textMuted, padding: 4, borderRadius: 4,
                    display: 'flex', alignItems: 'center',
                  }}>
                    <X size={14} />
                  </button>
                </div>

                {/* Badge niveau */}
                <div style={{ textAlign: 'center', marginBottom: '0.65rem' }}>
                  <span style={{
                    padding: '3px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: levelBg(niveau || 1), color: levelColor(niveau || 1),
                    border: `1px solid ${levelColor(niveau || 1)}40`,
                  }}>
                    {niveau > 0 ? `N${niveau} — ${levelLabel(niveau)}` : 'En attente de données'}
                  </span>
                </div>

                {/* Grille 2×2 indicateurs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {[
                    { label: 'Temps aller', value: m?.tempsLive,   unit: 'min',  c: color },
                    { label: 'Vitesse',     value: m?.vitesse,     unit: 'km/h', c: C.success },
                    {
                      label: 'Retard',
                      value: m?.retard != null ? (m.retard >= 0 ? `+${m.retard}` : m.retard) : '—',
                      unit: 'min',
                      c: m?.retard > 0 ? C.danger : C.success,
                    },
                    { label: 'Ratio ×',    value: m?.ratio?.toFixed(2), unit: '', c: color },
                  ].map(({ label, value, unit, c }) => (
                    <div key={label} style={{ background: '#f8fafc', borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
                      <p style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
                      <p style={{ fontSize: 18, fontWeight: 800, color: c, lineHeight: 1 }}>{value ?? '—'}</p>
                      {unit && <p style={{ fontSize: 9, color: C.textLight, marginTop: 2 }}>{unit}</p>}
                    </div>
                  ))}
                </div>

                {/* Temps retour si disponible */}
                {selectedAxe.bidirectionnel && m?.tempsRetour && (
                  <div style={{ marginTop: 6, padding: '5px 10px', background: '#f8fafc', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>Retour</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: color }}>{m.tempsRetour} min</span>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Alertes actives (live) ou prédictives (prevision) */}
          {mapMode === 'prevision' ? (
            <AlertesPredictives predictions={predictions} meta={predMeta} />
          ) : (
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
          )}

          {/* IA FlowPort */}
          <div className="fp-card" style={{ padding: '1rem', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <Zap size={15} color={C.primary} />
              <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>IA FlowPort</span>
              <button onClick={() => { sessionStorage.removeItem('fp_ia_dashboard'); loadIA(null, true) }} disabled={iaLoading}
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
            {axes.map((axe, idx) => {
              const m = mesures[axe.id]
              const niveau = m?.niveau ?? 0
              const barColor = AXE_COLORS[axe.id] ?? axe.color ?? AXE_PALETTE[idx % AXE_PALETTE.length]
              return (
                <div key={axe.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0', borderBottom: `1px solid ${C.borderLight}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 3, height: 28, borderRadius: 2, background: barColor, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{axe.shortNom}</p>
                      <p style={{ fontSize: 11, color: C.textMuted }}>
                        {m ? `aller ${m.tempsLive} min` : '—'}
                        {axe.bidirectionnel && m?.tempsRetour ? ` · retour ${m.tempsRetour} min` : ''}
                      </p>
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
