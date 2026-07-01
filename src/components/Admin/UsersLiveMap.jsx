// ============================================================
// UsersLiveMap.jsx — Suivi des utilisateurs en temps réel (admin)
// Lit la collection "utilisateurs_live" (positions anonymisées,
// écrites par useGeolocation.js côté public) et les affiche sur
// une carte Leaflet dédiée. Un marqueur disparaît automatiquement
// si sa position n'a pas été rafraîchie depuis plus de 5 minutes.
// ============================================================

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { collection, onSnapshot } from 'firebase/firestore'
import { Users, AlertTriangle } from 'lucide-react'
import { db } from '../../services/firebase'
import { C } from '../../styles/tokens'
import { PAA_CENTER_COORDS } from '../../data/defaultData'

const COL              = 'utilisateurs_live'
const INACTIVE_MS      = 5 * 60 * 1000 // 5 minutes
const TICK_MS          = 15 * 1000     // fréquence de réévaluation de l'expiration

const USER_LIVE_ICON = L.divIcon({
  html: `<div style="position:relative;width:20px;height:20px;">
    <div style="position:absolute;inset:-7px;border-radius:50%;background:${C.primary}33;animation:fp-pulse 1.6s infinite;"></div>
    <div style="position:absolute;inset:0;border-radius:50%;background:${C.primary};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
  </div>`,
  className: '', iconSize: [20, 20], iconAnchor: [10, 10],
})

function formatSecondesEcoulees(timestamp, now) {
  if (!timestamp) return 'à l\'instant'
  const secs = Math.floor((now - timestamp) / 1000)
  if (secs < 5)   return 'à l\'instant'
  if (secs < 60)  return `il y a ${secs}s`
  return `il y a ${Math.floor(secs / 60)} min`
}

function UsersLiveMap({ axes = [] }) {
  const [sessions, setSessions] = useState([])
  const [now,      setNow]      = useState(() => Date.now())
  const [error,    setError]    = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, COL), snapshot => {
      setError(null)
      const data = snapshot.docs.map(d => {
        const r = d.data()
        return {
          sessionId:  r.sessionId ?? d.id,
          lat:        r.lat,
          lng:        r.lng,
          axeProche:  r.axeProche ?? null,
          vitesseKmh: r.vitesseKmh ?? null,
          timestamp:  r.timestamp?.toMillis?.() ?? null,
        }
      })
      setSessions(data)
    }, err => {
      console.error('UsersLiveMap — abonnement impossible :', err)
      setError(err.code === 'permission-denied'
        ? 'Accès refusé par les règles Firestore — vérifiez que firestore.rules a bien été déployé et que votre compte a le rôle "admin".'
        : 'Impossible de charger les utilisateurs en temps réel.')
    })
    return () => unsub()
  }, [])

  // Réévalue périodiquement quels marqueurs ont expiré (>5min sans mise à jour),
  // même en l'absence de nouvelle écriture Firestore.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(t)
  }, [])

  const actives = sessions.filter(s =>
    typeof s.lat === 'number' && typeof s.lng === 'number' &&
    (!s.timestamp || now - s.timestamp < INACTIVE_MS)
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
        <span className="fp-badge fp-badge-blue" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Users size={12} />
          {actives.length} utilisateur{actives.length !== 1 ? 's' : ''} actif{actives.length !== 1 ? 's' : ''} sur la carte
        </span>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem',
          padding: '0.6rem 0.85rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
        }}>
          <AlertTriangle size={14} color={C.danger} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: C.danger }}>{error}</span>
        </div>
      )}

      <div style={{ height: 500, borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
        <MapContainer center={PAA_CENTER_COORDS} zoom={12} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <ZoomControl position="bottomright" />

          {actives.map(s => {
            const axe = axes.find(a => a.id === s.axeProche)
            return (
              <Marker key={s.sessionId} position={[s.lat, s.lng]} icon={USER_LIVE_ICON}>
                <Popup>
                  <div style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, lineHeight: 1.6 }}>
                    <strong>Session {s.sessionId.slice(0, 8)}…</strong><br />
                    Axe le plus proche : <strong>{axe?.shortNom ?? axe?.nom ?? 'Inconnu'}</strong><br />
                    Vitesse : <strong>{s.vitesseKmh != null ? `${s.vitesseKmh} km/h` : '—'}</strong><br />
                    <span style={{ color: '#888' }}>Mis à jour {formatSecondesEcoulees(s.timestamp, now)}</span>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}

export default UsersLiveMap
