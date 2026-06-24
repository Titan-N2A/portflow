import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Plus, Pencil, Ban, Trash2, Save, X,
  Users, AlertOctagon, MapPin, Layers,
  CheckCircle, AlertCircle, Eye, EyeOff,
  Navigation, Copy, ChevronDown, ChevronUp,
} from 'lucide-react'
import { C } from '../styles/tokens'
import { useAxesFirestore } from '../hooks/useAxesFirestore'
import { AXE_COLORS as DEFAULT_AXE_COLORS } from '../data/defaultData'

const INIT_USERS = [
  { id: 'u1', nom: 'Administrateur PAA', email: 'admin@portabidjan.ci',     role: 'admin',     actif: true },
  { id: 'u2', nom: 'Opérateur Trafic',   email: 'operateur@portabidjan.ci', role: 'operateur', actif: true },
]

// ── Helpers coordonnées ────────────────────────────────────
// Convertit [[lat,lng],...] → [{lat:'', lng:''},...] pour le form
function coordsToForm(coords = []) {
  return coords.map(([lat, lng]) => ({ lat: String(lat), lng: String(lng) }))
}
// Convertit [{lat:'', lng:''},...] → [[lat,lng],...] pour la sauvegarde
function formToCoords(points) {
  return points
    .filter(p => p.lat.trim() !== '' && p.lng.trim() !== '')
    .map(p => [parseFloat(p.lat), parseFloat(p.lng)])
    .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng))
}
// Valide un point GPS
function isValidPoint(p) {
  const lat = parseFloat(p.lat), lng = parseFloat(p.lng)
  return !isNaN(lat) && !isNaN(lng)
    && lat >= -90 && lat <= 90
    && lng >= -180 && lng <= 180
}

// ══════════════════════════════════════════════════════════
// COMPOSANT : Éditeur de coordonnées GPS
// ══════════════════════════════════════════════════════════
function CoordinatesEditor({ points, onChange, minPoints = 2 }) {
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')

  function addPoint() {
    const last = points[points.length - 1] ?? { lat: '5.2900', lng: '-4.0200' }
    onChange([...points, { lat: last.lat, lng: last.lng }])
  }

  function removePoint(i) {
    if (points.length <= minPoints) return
    onChange(points.filter((_, j) => j !== i))
  }

  function updatePoint(i, field, val) {
    const updated = [...points]
    updated[i] = { ...updated[i], [field]: val }
    onChange(updated)
  }

  function movePoint(i, dir) {
    const updated = [...points]
    const target = i + dir
    if (target < 0 || target >= updated.length) return
    ;[updated[i], updated[target]] = [updated[target], updated[i]]
    onChange(updated)
  }

  function handleImport() {
    setImportError('')
    const lines = importText.trim().split('\n').filter(l => l.trim())
    const parsed = []
    for (const line of lines) {
      // Accepte : "lat, lng" | "lat lng" | "lat;lng" | "lat\tlng"
      const parts = line.trim().split(/[\s,;|\t]+/)
      if (parts.length < 2) { setImportError(`Ligne invalide : "${line}"`); return }
      const [lat, lng] = [parseFloat(parts[0]), parseFloat(parts[1])]
      if (isNaN(lat) || isNaN(lng)) { setImportError(`Coordonnées invalides : "${line}"`); return }
      if (lat < -90 || lat > 90)    { setImportError(`Latitude hors limites : ${lat}`); return }
      if (lng < -180 || lng > 180)  { setImportError(`Longitude hors limites : ${lng}`); return }
      parsed.push({ lat: String(lat), lng: String(lng) })
    }
    if (parsed.length === 0) { setImportError('Aucune coordonnée valide trouvée'); return }
    onChange(parsed)
    setShowImport(false)
    setImportText('')
  }

  const validCount = points.filter(isValidPoint).length

  return (
    <div>
      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}>
            {points.length} point(s)
          </span>
          {validCount < points.length && (
            <span style={{ fontSize: 11, color: '#E67E22', fontWeight: 600 }}>
              ⚠ {points.length - validCount} invalide(s)
            </span>
          )}
          {validCount >= 2 && (
            <span style={{ fontSize: 11, color: '#27AE60', fontWeight: 600 }}>
              ✓ {validCount} points valides
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setShowImport(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', background: '#EBF2FB',
              border: '1px solid #CDDFF5', borderRadius: '6px',
              color: C.primary, fontSize: 12, cursor: 'pointer',
              fontFamily: "'Inter',sans-serif", fontWeight: 500,
            }}
          >
            <Copy size={12} />
            Importer
            {showImport ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          <button
            type="button"
            onClick={addPoint}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', background: C.primary,
              border: 'none', borderRadius: '6px',
              color: '#fff', fontSize: 12, cursor: 'pointer',
              fontFamily: "'Inter',sans-serif", fontWeight: 600,
            }}
          >
            <Plus size={12} />
            Ajouter un point
          </button>
        </div>
      </div>

      {/* ── Import depuis texte ─────────────────────────── */}
      {showImport && (
        <div style={{
          marginBottom: '10px', padding: '10px',
          background: '#f0f7ff', border: '1px solid #CDDFF5',
          borderRadius: '8px',
        }}>
          <p style={{ fontSize: 11, color: C.textMuted, marginBottom: '6px', fontFamily: "'Inter',sans-serif" }}>
            Collez les coordonnées GPS (une par ligne) — formats acceptés :<br />
            <code style={{ background: '#e8f0fe', padding: '1px 4px', borderRadius: 3 }}>5.2470, -3.9720</code>{' '}
            ou{' '}
            <code style={{ background: '#e8f0fe', padding: '1px 4px', borderRadius: 3 }}>5.2470 -3.9720</code>{' '}
            ou{' '}
            <code style={{ background: '#e8f0fe', padding: '1px 4px', borderRadius: 3 }}>5.2470;-3.9720</code>
          </p>
          <textarea
            value={importText}
            onChange={e => { setImportText(e.target.value); setImportError('') }}
            placeholder={'5.2470, -3.9720\n5.2455, -3.9680\n5.2440, -3.9630\n5.2420, -3.9580'}
            style={{
              width: '100%', height: '90px', padding: '8px',
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px',
              fontSize: 12, fontFamily: 'monospace', color: C.text, resize: 'vertical',
              outline: 'none',
            }}
          />
          {importError && (
            <p style={{ color: '#C0392B', fontSize: 11, marginTop: 4, fontFamily: "'Inter',sans-serif" }}>
              ⚠ {importError}
            </p>
          )}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { setShowImport(false); setImportText(''); setImportError('') }}
              style={{ padding: '5px 12px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: 12, fontFamily: "'Inter',sans-serif" }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!importText.trim()}
              style={{ padding: '5px 12px', background: C.primary, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}
            >
              Importer {importText.trim().split('\n').filter(l => l.trim()).length} ligne(s)
            </button>
          </div>
        </div>
      )}

      {/* ── En-têtes colonnes ───────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '28px 1fr 1fr 56px 24px',
        gap: '4px', marginBottom: '5px', paddingBottom: '5px',
        borderBottom: '1px solid #f0f4f8',
      }}>
        {['#', 'Latitude', 'Longitude', 'Ordre', ''].map((h, i) => (
          <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Inter',sans-serif" }}>
            {h}
          </span>
        ))}
      </div>

      {/* ── Liste des points ────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '240px', overflowY: 'auto', paddingRight: '2px' }}>
        {points.length === 0 ? (
          <p style={{ fontSize: 12, color: C.textLight, textAlign: 'center', padding: '1rem', fontFamily: "'Inter',sans-serif" }}>
            Aucun point — cliquez sur "Ajouter un point"
          </p>
        ) : (
          points.map((p, i) => {
            const valid = isValidPoint(p)
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 1fr 56px 24px',
                gap: '4px', alignItems: 'center',
                background: valid ? 'transparent' : '#fff8f8',
                borderRadius: '6px', padding: '2px',
                border: valid ? '1px solid transparent' : '1px solid #fdc5c5',
              }}>
                {/* Numéro */}
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: i === 0 ? '#27AE60' : i === points.length - 1 ? '#C0392B' : '#1B4F8A',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                  fontFamily: "'Inter',sans-serif",
                }}>
                  {i + 1}
                </div>

                {/* Latitude */}
                <input
                  type="number"
                  step="0.00001"
                  value={p.lat}
                  onChange={e => updatePoint(i, 'lat', e.target.value)}
                  placeholder="5.2470"
                  style={{
                    padding: '5px 8px', border: `1px solid ${valid ? '#e2e8f0' : '#fca5a5'}`,
                    borderRadius: '6px', fontSize: 12, fontFamily: 'monospace',
                    color: C.text, background: '#fff', outline: 'none', width: '100%',
                  }}
                />

                {/* Longitude */}
                <input
                  type="number"
                  step="0.00001"
                  value={p.lng}
                  onChange={e => updatePoint(i, 'lng', e.target.value)}
                  placeholder="-3.9720"
                  style={{
                    padding: '5px 8px', border: `1px solid ${valid ? '#e2e8f0' : '#fca5a5'}`,
                    borderRadius: '6px', fontSize: 12, fontFamily: 'monospace',
                    color: C.text, background: '#fff', outline: 'none', width: '100%',
                  }}
                />

                {/* Boutons ordre */}
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button type="button" onClick={() => movePoint(i, -1)} disabled={i === 0}
                    style={{ ...arrowBtnStyle, opacity: i === 0 ? 0.3 : 1 }} title="Monter">▲</button>
                  <button type="button" onClick={() => movePoint(i, 1)} disabled={i === points.length - 1}
                    style={{ ...arrowBtnStyle, opacity: i === points.length - 1 ? 0.3 : 1 }} title="Descendre">▼</button>
                </div>

                {/* Supprimer */}
                <button
                  type="button"
                  onClick={() => removePoint(i)}
                  disabled={points.length <= minPoints}
                  style={{
                    background: 'none', border: 'none', cursor: points.length <= minPoints ? 'not-allowed' : 'pointer',
                    color: points.length <= minPoints ? '#e2e8f0' : '#C0392B',
                    fontSize: 14, lineHeight: 1, padding: '2px',
                  }}
                  title="Supprimer ce point"
                >
                  ×
                </button>
              </div>
            )
          })
        )}
      </div>

      {points.length > 0 && (
        <p style={{ fontSize: 10, color: C.textLight, marginTop: '5px', fontFamily: "'Inter',sans-serif" }}>
          ● Vert = départ · ● Rouge = arrivée · ● Bleu = points intermédiaires
        </p>
      )}
    </div>
  )
}

const arrowBtnStyle = {
  background: '#f0f4f8', border: '1px solid #e2e8f0', borderRadius: '4px',
  cursor: 'pointer', fontSize: 9, padding: '2px 4px', color: C.textMuted,
  fontFamily: 'monospace',
}

// ══════════════════════════════════════════════════════════
// COMPOSANT : Aperçu carte en temps réel
// ══════════════════════════════════════════════════════════
function FitBoundsHelper({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length >= 2) {
      try { map.fitBounds(positions, { padding: [20, 20], maxZoom: 16 }) } catch {}
    }
  }, [JSON.stringify(positions)])
  return null
}

function MiniMapPreview({ points, color = '#1B4F8A' }) {
  const valid   = points.filter(isValidPoint)
  const positions = valid.map(p => [parseFloat(p.lat), parseFloat(p.lng)])

  if (valid.length < 2) {
    return (
      <div style={{
        height: '180px', background: '#f8fafc',
        border: '1px dashed #e2e8f0', borderRadius: '8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
      }}>
        <Navigation size={24} color="#e2e8f0" />
        <p style={{ fontSize: 12, color: C.textLight, fontFamily: "'Inter',sans-serif" }}>
          Ajoutez au moins 2 points valides pour voir l'aperçu du tracé
        </p>
      </div>
    )
  }

  return (
    <div style={{ height: '180px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <MapContainer
        key={positions[0].join(',')}
        center={positions[0]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <Polyline positions={positions} color={color} weight={5} opacity={0.9} />
        {/* Marqueurs début/fin */}
        {[positions[0], positions[positions.length - 1]].map((pos, i) => (
          <Polyline
            key={i}
            positions={[
              [pos[0] - 0.0002, pos[1] - 0.0002],
              [pos[0] + 0.0002, pos[1] + 0.0002],
            ]}
            color={i === 0 ? '#27AE60' : '#C0392B'}
            weight={8}
            opacity={0.9}
          />
        ))}
        <FitBoundsHelper positions={positions} />
      </MapContainer>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// UI GÉNÉRIQUES
// ══════════════════════════════════════════════════════════
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [toast])
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '10px',
      background: toast.type === 'success' ? '#1E8449' : '#C0392B',
      color: '#fff', padding: '0.75rem 1.25rem',
      borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      fontSize: 13, fontWeight: 600, fontFamily: "'Inter',sans-serif",
    }}>
      {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {toast.msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 4 }}>
        <X size={14} />
      </button>
    </div>
  )
}

function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,35,66,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: '12px',
        width, maxWidth: 'calc(100vw - 2rem)',
        maxHeight: '92vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '1.25rem' }}>{children}</div>
      </div>
    </div>
  )
}

function ConfirmModal({ msg, onConfirm, onClose }) {
  return (
    <Modal title="Confirmer la suppression" onClose={onClose} width={380}>
      <p style={{ fontSize: 13, color: C.text, marginBottom: '1.25rem', lineHeight: 1.6 }}>{msg}</p>
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
        <button className="fp-btn fp-btn-ghost" onClick={onClose}>Annuler</button>
        <button className="fp-btn fp-btn-danger" onClick={() => { onConfirm(); onClose() }}>
          <Trash2 size={13} /> Supprimer
        </button>
      </div>
    </Modal>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label className="fp-label">{label}</label>
      {children}
    </div>
  )
}

function SectionSep({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      margin: '1.25rem 0 1rem',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: C.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        whiteSpace: 'nowrap', fontFamily: "'Inter',sans-serif",
      }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// MODAL AXES
// ══════════════════════════════════════════════════════════
function ModalAxe({ axe, axes, onSave, onClose }) {
  const isEdit   = !!axe
  const [form, setForm] = useState({
    nom:      axe?.nom      ?? '',
    shortNom: axe?.shortNom ?? '',
    distance: axe?.distance ?? '',
    tRef:     axe?.tRef     ?? '',
    ordre:    axe?.ordre    ?? (axes.length + 1),
  })
  const [coords,  setCoords]  = useState(coordsToForm(axe?.coordinates))
  const [errors,  setErrors]  = useState({})

  function validate() {
    const e = {}
    if (!form.nom.trim())      e.nom      = 'Nom requis'
    if (!form.shortNom.trim()) e.shortNom = 'Nom court requis'
    if (!form.distance.trim()) e.distance = 'Distance requise'
    if (!form.tRef || isNaN(+form.tRef)) e.tRef = 'Temps de référence invalide'
    if (!form.ordre || isNaN(+form.ordre)) e.ordre = 'Ordre invalide'
    const validCoords = coords.filter(isValidPoint)
    if (coords.length > 0 && validCoords.length < 2)
      e.coords = 'Fournissez au moins 2 points GPS valides (ou laissez vide)'
    const invalidPoints = coords.filter(p => p.lat || p.lng).filter(p => !isValidPoint(p))
    if (invalidPoints.length > 0)
      e.coords = 'Certains points ont des coordonnées invalides'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const savedCoords  = formToCoords(coords)
    const newAxe = {
      id:          axe?.id   ?? `axe_${Date.now()}`,
      nom:         form.nom.trim(),
      shortNom:    form.shortNom.trim(),
      distance:    form.distance.trim(),
      tRef:        parseFloat(form.tRef),
      ordre:       parseInt(form.ordre),
      troncons:    axe?.troncons ?? [],
      coordinates: savedCoords,
      start:       savedCoords[0] ?? axe?.start ?? [5.29, -4.02],
      actif:       axe?.actif ?? true,
      num:         axe?.num ?? (axes.length + 1),
    }
    onSave(newAxe)
    onClose()
  }

  const inp = (field) => ({
    className: 'fp-input',
    value: form[field],
    onChange: e => { setForm(f => ({ ...f, [field]: e.target.value })); setErrors(er => ({ ...er, [field]: '' })) },
    style: errors[field] ? { borderColor: '#C0392B' } : {},
  })

  const axeColor = ['#1B4F8A','#E67E22','#27AE60'][(axe?.num ?? axes.length + 1) - 1] ?? '#1B4F8A'

  return (
    <Modal title={isEdit ? 'Modifier l\'axe' : 'Ajouter un axe'} onClose={onClose} width={660}>

      {/* ── Infos de base ─────────────────────────────── */}
      <SectionSep label="Informations générales" />

      <Field label="Nom complet de l'axe *">
        <input {...inp('nom')} placeholder="ex: CARENA (Plateau) → Pharmacie Palm Beach" />
        {errors.nom && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.nom}</p>}
      </Field>

      <Field label="Nom court *">
        <input {...inp('shortNom')} placeholder="ex: CARENA" />
        {errors.shortNom && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.shortNom}</p>}
      </Field>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <Field label="Distance *">
            <input {...inp('distance')} placeholder="ex: 14.8 km" />
            {errors.distance && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.distance}</p>}
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Temps de référence PAA (min) *">
            <input {...inp('tRef')} type="number" step="0.1" min="0" placeholder="ex: 27.4" />
            {errors.tRef && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.tRef}</p>}
          </Field>
        </div>
        <div style={{ flex: '0 0 100px' }}>
          <Field label="Ordre *">
            <input {...inp('ordre')} type="number" min="1" />
            {errors.ordre && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.ordre}</p>}
          </Field>
        </div>
      </div>

      {/* ── Coordonnées GPS ───────────────────────────── */}
      <SectionSep label="Tracé GPS — points du tracé routier" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Éditeur */}
        <div>
          <CoordinatesEditor points={coords} onChange={setCoords} minPoints={0} />
          {errors.coords && (
            <p style={{ color: '#C0392B', fontSize: 11, marginTop: 5, fontFamily: "'Inter',sans-serif" }}>
              ⚠ {errors.coords}
            </p>
          )}
        </div>
        {/* Aperçu carte */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', fontFamily: "'Inter',sans-serif" }}>
            Aperçu du tracé
          </p>
          <MiniMapPreview points={coords} color={axeColor} />
          <p style={{ fontSize: 10, color: C.textLight, marginTop: '5px', fontFamily: "'Inter',sans-serif" }}>
            La carte se met à jour en temps réel au fur et à mesure de la saisie.
          </p>
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
        <button className="fp-btn fp-btn-ghost" onClick={onClose}>Annuler</button>
        <button className="fp-btn fp-btn-primary" onClick={handleSubmit}>
          <Save size={14} /> {isEdit ? 'Enregistrer les modifications' : 'Ajouter l\'axe'}
        </button>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════
// MODAL TRONCONS
// ══════════════════════════════════════════════════════════
function ModalTroncon({ troncon, axes, troncons, onSave, onClose }) {
  const isEdit = !!troncon
  const [form, setForm] = useState({
    axeId: troncon?.axeId ?? (axes[0]?.id ?? 'axe1'),
    code:  troncon?.code  ?? '',
    nom:   troncon?.nom   ?? '',
    dist:  troncon?.dist  ?? '',
    ordre: troncon?.ordre ?? 1,
  })
  const [coords,  setCoords]  = useState(coordsToForm(troncon?.coordinates ?? []))
  const [errors,  setErrors]  = useState({})

  function suggestCode(axeId) {
    const existing = troncons.filter(t => t.axeId === axeId)
    const axeNum   = axes.find(a => a.id === axeId)?.num ?? 1
    const nextLet  = String.fromCharCode(65 + existing.length)
    return `T${axeNum}${nextLet}`
  }

  function handleAxeChange(axeId) {
    setForm(f => ({
      ...f,
      axeId,
      code:  isEdit ? f.code : suggestCode(axeId),
      ordre: isEdit ? f.ordre : troncons.filter(t => t.axeId === axeId).length + 1,
    }))
    // Pré-remplir avec les extrémités de l'axe parent si aucun point saisi
    if (!isEdit && coords.length === 0) {
      const parentAxe = axes.find(a => a.id === axeId)
      if (parentAxe?.coordinates?.length >= 2) {
        const first = parentAxe.coordinates[0]
        const last  = parentAxe.coordinates[parentAxe.coordinates.length - 1]
        setCoords([
          { lat: String(first[0]), lng: String(first[1]) },
          { lat: String(last[0]),  lng: String(last[1])  },
        ])
      }
    }
  }

  function validate() {
    const e = {}
    if (!form.code.trim()) e.code = 'Code requis (ex: T1A)'
    if (!form.nom.trim())  e.nom  = 'Nom requis'
    if (!form.dist.trim()) e.dist = 'Distance requise'
    if (!form.ordre || isNaN(+form.ordre)) e.ordre = 'Ordre invalide'
    const dup = troncons.find(t => t.code === form.code.trim().toUpperCase() && t.id !== troncon?.id)
    if (dup) e.code = `Code "${form.code.toUpperCase()}" déjà utilisé`
    const validCoords = coords.filter(isValidPoint)
    if (coords.length > 0 && validCoords.length < 2)
      e.coords = 'Fournissez au moins 2 points GPS valides'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onSave({
      id:          troncon?.id ?? `t_${Date.now()}`,
      axeId:       form.axeId,
      code:        form.code.trim().toUpperCase(),
      nom:         form.nom.trim(),
      dist:        form.dist.trim(),
      ordre:       parseInt(form.ordre),
      coordinates: formToCoords(coords),
    })
    onClose()
  }

  const inp = (field) => ({
    className: 'fp-input',
    value: form[field],
    onChange: e => { setForm(f => ({ ...f, [field]: e.target.value })); setErrors(er => ({ ...er, [field]: '' })) },
    style: errors[field] ? { borderColor: '#C0392B' } : {},
  })

  const axeNum   = axes.find(a => a.id === form.axeId)?.num ?? 1
  const axeColor = ['#1B4F8A','#E67E22','#27AE60'][axeNum - 1] ?? '#1B4F8A'

  return (
    <Modal title={isEdit ? 'Modifier le tronçon' : 'Ajouter un tronçon'} onClose={onClose} width={660}>

      {/* ── Infos de base ─────────────────────────────── */}
      <SectionSep label="Informations générales" />

      <Field label="Axe routier parent *">
        <select className="fp-select" value={form.axeId}
          onChange={e => handleAxeChange(e.target.value)}>
          {axes.map(a => <option key={a.id} value={a.id}>{a.shortNom} — {a.nom}</option>)}
        </select>
      </Field>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: '0 0 120px' }}>
          <Field label="Code *">
            <input {...inp('code')} placeholder="ex: T1A" />
            {errors.code && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.code}</p>}
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Nom du tronçon *">
            <input {...inp('nom')} placeholder="ex: CARENA → Rondpoint SMOBY" />
            {errors.nom && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.nom}</p>}
          </Field>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <Field label="Distance *">
            <input {...inp('dist')} placeholder="ex: 2.8 km" />
            {errors.dist && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.dist}</p>}
          </Field>
        </div>
        <div style={{ flex: '0 0 110px' }}>
          <Field label="Ordre *">
            <input {...inp('ordre')} type="number" min="1" />
            {errors.ordre && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.ordre}</p>}
          </Field>
        </div>
      </div>

      {/* ── Coordonnées GPS ───────────────────────────── */}
      <SectionSep label="Points GPS du tronçon" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <CoordinatesEditor points={coords} onChange={setCoords} minPoints={0} />
          {errors.coords && (
            <p style={{ color: '#C0392B', fontSize: 11, marginTop: 5, fontFamily: "'Inter',sans-serif" }}>
              ⚠ {errors.coords}
            </p>
          )}
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', fontFamily: "'Inter',sans-serif" }}>
            Aperçu du tracé
          </p>
          <MiniMapPreview points={coords} color={axeColor} />
          <p style={{ fontSize: 10, color: C.textLight, marginTop: '5px', fontFamily: "'Inter',sans-serif" }}>
            Aperçu mis à jour en temps réel. ● Vert = départ · ● Rouge = arrivée.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
        <button className="fp-btn fp-btn-ghost" onClick={onClose}>Annuler</button>
        <button className="fp-btn fp-btn-primary" onClick={handleSubmit}>
          <Save size={14} /> {isEdit ? 'Enregistrer les modifications' : 'Ajouter le tronçon'}
        </button>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════
// MODAL UTILISATEURS
// ══════════════════════════════════════════════════════════
function ModalUser({ user, users, onSave, onClose }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    nom:      user?.nom   ?? '',
    email:    user?.email ?? '',
    role:     user?.role  ?? 'operateur',
    password: '',
    confirm:  '',
    actif:    user?.actif ?? true,
  })
  const [errors,   setErrors]   = useState({})
  const [showPwd,  setShowPwd]  = useState(false)
  const [showConf, setShowConf] = useState(false)

  function validate() {
    const e = {}
    if (!form.nom.trim())   e.nom   = 'Nom complet requis'
    if (!form.email.trim()) e.email = 'Email requis'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email invalide'
    const dup = users.find(u => u.email === form.email.trim() && u.id !== user?.id)
    if (dup) e.email = 'Cet email est déjà utilisé'
    if (!isEdit) {
      if (!form.password)              e.password = 'Mot de passe requis'
      else if (form.password.length < 6) e.password = 'Minimum 6 caractères'
      if (form.password !== form.confirm) e.confirm = 'Les mots de passe ne correspondent pas'
    } else if (form.password) {
      if (form.password.length < 6)      e.password = 'Minimum 6 caractères'
      if (form.password !== form.confirm) e.confirm  = 'Les mots de passe ne correspondent pas'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onSave({
      id:    user?.id ?? `u_${Date.now()}`,
      nom:   form.nom.trim(),
      email: form.email.trim().toLowerCase(),
      role:  form.role,
      actif: form.actif,
    })
    onClose()
  }

  const inp = (field) => ({
    className: 'fp-input',
    value: form[field],
    onChange: e => { setForm(f => ({ ...f, [field]: e.target.value })); setErrors(er => ({ ...er, [field]: '' })) },
    style: errors[field] ? { borderColor: '#C0392B' } : {},
  })

  return (
    <Modal title={isEdit ? 'Modifier l\'utilisateur' : 'Créer un compte'} onClose={onClose}>
      <Field label="Nom complet *">
        <input {...inp('nom')} placeholder="ex: Jean-Paul Kouakou" />
        {errors.nom && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.nom}</p>}
      </Field>
      <Field label="Adresse email *">
        <input {...inp('email')} type="email" placeholder="ex: jkouakou@portabidjan.ci" />
        {errors.email && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.email}</p>}
      </Field>
      <Field label="Rôle *">
        <select className="fp-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
          <option value="admin">Administrateur</option>
          <option value="operateur">Opérateur trafic</option>
          <option value="lecteur">Lecteur (lecture seule)</option>
        </select>
      </Field>
      <Field label={isEdit ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe *'}>
        <div style={{ position: 'relative' }}>
          <input {...inp('password')} type={showPwd ? 'text' : 'password'} placeholder={isEdit ? 'Nouveau mot de passe...' : 'Minimum 6 caractères'} style={{ ...((errors.password ? { borderColor: '#C0392B' } : {})), paddingRight: '2.5rem' }} />
          <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.password && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.password}</p>}
      </Field>
      {(!isEdit || form.password) && (
        <Field label="Confirmer le mot de passe *">
          <div style={{ position: 'relative' }}>
            <input {...inp('confirm')} type={showConf ? 'text' : 'password'} placeholder="Répétez le mot de passe" style={{ ...((errors.confirm ? { borderColor: '#C0392B' } : {})), paddingRight: '2.5rem' }} />
            <button type="button" onClick={() => setShowConf(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
              {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.confirm && <p style={{ color: '#C0392B', fontSize: 11, marginTop: 3 }}>{errors.confirm}</p>}
        </Field>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
        <input type="checkbox" id="actif" checked={form.actif} onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C.primary }} />
        <label htmlFor="actif" style={{ fontSize: 13, color: C.text, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
          Compte actif (l'utilisateur peut se connecter)
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
        <button className="fp-btn fp-btn-ghost" onClick={onClose}>Annuler</button>
        <button className="fp-btn fp-btn-primary" onClick={handleSubmit}>
          <Save size={14} /> {isEdit ? 'Enregistrer les modifications' : 'Créer le compte'}
        </button>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════════════════
function AdminPage() {
  const [tab,         setTab]         = useState('axes')
  const [users,       setUsers]       = useState(INIT_USERS)
  const [toast,       setToast]       = useState(null)
  const [modal,       setModal]       = useState(null)
  const [seuilsSaved, setSeuilsSaved] = useState({})
  const [saving,      setSaving]      = useState(false)

  // ── Données Firestore temps réel ───────────────────────
  const {
    axes, troncons, seuils,
    loading, error, offline,
    saveAxe:      fsSaveAxe,
    deleteAxe:    fsDeleteAxe,
    toggleAxe:    fsToggleAxe,
    saveTroncon:  fsSaveTroncon,
    deleteTroncon: fsDeleteTroncon,
    saveSeuil:    fsSaveSeuil,
  } = useAxesFirestore()

  function showToast(msg, type = 'success') { setToast({ msg, type }) }

  // ── Wrappers avec feedback ─────────────────────────────
  async function saveAxe(axe) {
    setSaving(true)
    try {
      await fsSaveAxe(axe)
      showToast(axe.id.startsWith('axe_') ? 'Axe ajouté — Firestore mis à jour' : 'Axe modifié — Firestore mis à jour')
    } catch (err) {
      showToast('Erreur Firestore : ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  async function deleteAxe(id) {
    setSaving(true)
    try {
      await fsDeleteAxe(id)
      showToast('Axe et tronçons supprimés de Firestore')
    } catch (err) {
      showToast('Erreur suppression : ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  async function toggleAxe(id) {
    try {
      await fsToggleAxe(id)
      const a = axes.find(x => x.id === id)
      showToast(a?.actif ? 'Axe désactivé' : 'Axe activé')
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  // Tronçons
  async function saveTroncon(t) {
    setSaving(true)
    try {
      await fsSaveTroncon(t)
      showToast(t.id.startsWith('t_') ? 'Tronçon ajouté — Firestore mis à jour' : 'Tronçon modifié — Firestore mis à jour')
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  async function deleteTroncon(id) {
    setSaving(true)
    try {
      await fsDeleteTroncon(id)
      showToast('Tronçon supprimé de Firestore')
    } catch (err) {
      showToast('Erreur suppression : ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  // Seuils
  async function saveSeuil(axeId) {
    const seuil = seuils.find(s => s.axeId === axeId)
    if (!seuil) return
    try {
      await fsSaveSeuil(seuil)
      setSeuilsSaved(prev => ({ ...prev, [axeId]: true }))
      showToast('Seuils enregistrés dans Firestore')
      setTimeout(() => setSeuilsSaved(prev => ({ ...prev, [axeId]: false })), 2500)
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error')
    }
  }

  // Utilisateurs
  function saveUser(u) {
    setUsers(prev => prev.find(x => x.id === u.id)
      ? prev.map(x => x.id === u.id ? u : x)
      : [...prev, u])
    showToast(u.id.startsWith('u_') ? 'Compte créé avec succès' : 'Utilisateur modifié')
  }
  function deleteUser(id) { setUsers(prev => prev.filter(u => u.id !== id)); showToast('Compte supprimé') }
  function toggleUser(id) {
    const u = users.find(x => x.id === id)
    setUsers(prev => prev.map(x => x.id === id ? { ...x, actif: !x.actif } : x))
    showToast(u?.actif ? 'Compte désactivé' : 'Compte activé')
  }

  const TABS = [
    { id: 'axes',     icon: MapPin,       label: 'Axes routiers'    },
    { id: 'troncons', icon: Layers,       label: 'Tronçons'         },
    { id: 'seuils',   icon: AlertOctagon, label: 'Seuils d\'alerte' },
    { id: 'users',    icon: Users,        label: 'Utilisateurs'     },
  ]


  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto' }}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Modals */}
      {modal?.type === 'axe' && (
        <ModalAxe axe={modal.data} axes={axes} onSave={saveAxe} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'troncon' && (
        <ModalTroncon troncon={modal.data} axes={axes} troncons={troncons} onSave={saveTroncon} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'user' && (
        <ModalUser user={modal.data} users={users} onSave={saveUser} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'confirm' && (
        <ConfirmModal msg={modal.msg} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />
      )}

      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Administration</h1>
          {loading && (
            <span style={{ fontSize: 11, color: C.textMuted, background: '#f0f4f8', padding: '2px 8px', borderRadius: 999, fontFamily: "'Inter',sans-serif" }}>
              Connexion Firestore...
            </span>
          )}
          {offline && !loading && (
            <span style={{ fontSize: 11, color: '#E67E22', background: '#fdebd0', padding: '2px 8px', borderRadius: 999, fontFamily: "'Inter',sans-serif", border: '1px solid #fbbf7a' }}>
              ⚠ Mode hors ligne — modifications locales uniquement
            </span>
          )}
          {!offline && !loading && (
            <span style={{ fontSize: 11, color: '#27AE60', background: '#d5f5e3', padding: '2px 8px', borderRadius: 999, fontFamily: "'Inter',sans-serif" }}>
              ● Firestore connecté
            </span>
          )}
          {saving && (
            <span style={{ fontSize: 11, color: C.primary, fontFamily: "'Inter',sans-serif" }}>
              Enregistrement...
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Gestion des axes routiers, tronçons et utilisateurs</p>
      </div>

      <div className="fp-tabs">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} className={`fp-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>

      {/* ── AXES ─────────────────────────────────────────── */}
      {tab === 'axes' && (
        <div>
          <div className="fp-section-header">
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {axes.length} axe(s) · {axes.filter(a => a.actif).length} actif(s)
            </span>
            <button className="fp-btn fp-btn-primary" onClick={() => setModal({ type: 'axe', data: null })}>
              <Plus size={14} /> Ajouter un axe
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {axes.map(axe => (
              <div key={axe.id} className="fp-card"
                style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', opacity: axe.actif ? 1 : 0.65 }}>
                <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, background: DEFAULT_AXE_COLORS[axe.id] ?? C.primary ?? C.primary }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{axe.nom}</span>
                    <span className={`fp-badge ${axe.actif ? 'fp-badge-green' : 'fp-badge-gray'}`}>{axe.actif ? 'Actif' : 'Inactif'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: C.textMuted }}>Distance : <strong style={{ color: C.text }}>{axe.distance}</strong></span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>T_ref : <strong style={{ color: C.text }}>{axe.tRef} min</strong></span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>Ordre : <strong style={{ color: C.text }}>{axe.ordre}</strong></span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{axe.coordinates?.length ?? 0} point(s) GPS</span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{axe.troncons?.length ?? 0} tronçon(s)</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {(axe.troncons ?? []).map(t => <span key={t} className="fp-badge fp-badge-gray">{t}</span>)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                  <button className="fp-btn fp-btn-ghost" style={{ padding: '0.4rem 0.75rem', fontSize: 12 }}
                    onClick={() => setModal({ type: 'axe', data: axe })}>
                    <Pencil size={12} /> Modifier
                  </button>
                  <button className="fp-btn fp-btn-warning" style={{ padding: '0.4rem 0.75rem', fontSize: 12 }}
                    onClick={() => toggleAxe(axe.id)}>
                    <Ban size={12} /> {axe.actif ? 'Désactiver' : 'Activer'}
                  </button>
                  <button className="fp-btn fp-btn-danger" style={{ padding: '0.4rem 0.6rem' }}
                    onClick={() => setModal({ type: 'confirm', msg: `Supprimer l'axe "${axe.nom}" et tous ses tronçons ?`, onConfirm: () => deleteAxe(axe.id) })}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TRONÇONS ──────────────────────────────────────── */}
      {tab === 'troncons' && (
        <div>
          <div className="fp-section-header">
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{troncons.length} tronçon(s)</span>
            <button className="fp-btn fp-btn-primary" onClick={() => setModal({ type: 'troncon', data: null })}>
              <Plus size={14} /> Ajouter un tronçon
            </button>
          </div>
          {axes.map(axe => {
            const axeTroncons = troncons.filter(t => t.axeId === axe.id).sort((a, b) => a.ordre - b.ordre)
            return (
              <div key={axe.id} style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.6rem', padding: '0.4rem 0', borderBottom: `2px solid ${DEFAULT_AXE_COLORS[axe.id] ?? C.primary}20` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: DEFAULT_AXE_COLORS[axe.id] ?? C.primary, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{axe.shortNom}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>({axeTroncons.length} tronçon{axeTroncons.length > 1 ? 's' : ''})</span>
                  <button className="fp-btn fp-btn-ghost" style={{ marginLeft: 'auto', padding: '0.25rem 0.65rem', fontSize: 11 }}
                    onClick={() => setModal({ type: 'troncon', data: { axeId: axe.id } })}>
                    <Plus size={11} /> Ajouter
                  </button>
                </div>
                {axeTroncons.length === 0
                  ? <p style={{ fontSize: 12, color: C.textLight, padding: '0.5rem 0.75rem' }}>Aucun tronçon.</p>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {axeTroncons.map(t => (
                        <div key={t.id} className="fp-card" style={{ padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '6px', background: '#EBF2FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>{t.code}</span>
                            </div>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.nom}</p>
                              <p style={{ fontSize: 11, color: C.textMuted }}>
                                {t.dist} · Position {t.ordre}
                                {t.coordinates?.length > 0 && (
                                  <span style={{ marginLeft: 8, color: '#27AE60' }}>
                                    ● {t.coordinates.length} point(s) GPS
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="fp-btn fp-btn-ghost" style={{ padding: '0.3rem 0.65rem', fontSize: 12 }}
                              onClick={() => setModal({ type: 'troncon', data: t })}>
                              <Pencil size={11} /> Modifier
                            </button>
                            <button className="fp-btn fp-btn-danger" style={{ padding: '0.3rem 0.6rem' }}
                              onClick={() => setModal({ type: 'confirm', msg: `Supprimer le tronçon "${t.code} — ${t.nom}" ?`, onConfirm: () => deleteTroncon(t.id) })}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )
          })}
        </div>
      )}

      {/* ── SEUILS ────────────────────────────────────────── */}
      {tab === 'seuils' && (
        <div>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Définissez les seuils d'alerte (en minutes) pour chaque axe. Orange = alerte modérée, Rouge = alerte critique.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {seuils.map((s, i) => (
              <div key={s.axeId} className="fp-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: DEFAULT_AXE_COLORS[s.axeId] ?? C.primary, flexShrink: 0 }} />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{s.shortNom}</h3>
                  {seuilsSaved[s.axeId] && (
                    <span className="fp-badge fp-badge-green" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={11} /> Enregistré
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label className="fp-label">T_ref (min)</label>
                    <input className="fp-input" style={{ width: 110, background: '#f8fafc' }} value={s.tRef} readOnly />
                  </div>
                  <div>
                    <label className="fp-label" style={{ color: '#E67E22' }}>🟠 Seuil Orange (min)</label>
                    <input className="fp-input" style={{ width: 130, borderColor: '#E67E22' }} type="number" min={s.tRef} value={s.seuilOrange}
                      onChange={e => setSeuils(prev => prev.map((x, j) => j === i ? { ...x, seuilOrange: +e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="fp-label" style={{ color: '#C0392B' }}>🔴 Seuil Rouge (min)</label>
                    <input className="fp-input" style={{ width: 130, borderColor: '#C0392B' }} type="number" min={s.seuilOrange} value={s.seuilRouge}
                      onChange={e => setSeuils(prev => prev.map((x, j) => j === i ? { ...x, seuilRouge: +e.target.value } : x))} />
                  </div>
                  <button className="fp-btn fp-btn-primary" onClick={() => saveSeuil(s.axeId)} disabled={seuilsSaved[s.axeId]}>
                    <Save size={13} /> Enregistrer
                  </button>
                </div>
                <p style={{ fontSize: 11, color: C.textLight, marginTop: '0.75rem' }}>
                  Ratios — Orange : ×{(s.seuilOrange / s.tRef).toFixed(2)} · Rouge : ×{(s.seuilRouge / s.tRef).toFixed(2)} par rapport au T_ref
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── UTILISATEURS ──────────────────────────────────── */}
      {tab === 'users' && (
        <div>
          <div className="fp-section-header">
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{users.length} compte(s) · {users.filter(u => u.actif).length} actif(s)</span>
            <button className="fp-btn fp-btn-primary" onClick={() => setModal({ type: 'user', data: null })}>
              <Plus size={14} /> Créer un compte
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {users.map(u => (
              <div key={u.id} className="fp-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: u.actif ? 1 : 0.65 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: u.role === 'admin' ? C.sidebarActive : '#7F8C8D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: "'Inter',sans-serif" }}>
                  {u.nom.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{u.nom}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{u.email}</p>
                </div>
                <span className={`fp-badge ${u.role === 'admin' ? 'fp-badge-blue' : u.role === 'operateur' ? 'fp-badge-orange' : 'fp-badge-gray'}`}>
                  {u.role === 'admin' ? 'Administrateur' : u.role === 'operateur' ? 'Opérateur' : 'Lecteur'}
                </span>
                <span className={`fp-badge ${u.actif ? 'fp-badge-green' : 'fp-badge-red'}`}>{u.actif ? 'Actif' : 'Inactif'}</span>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button className="fp-btn fp-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }}
                    onClick={() => setModal({ type: 'user', data: u })}><Pencil size={12} /> Modifier</button>
                  <button className="fp-btn fp-btn-warning" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }}
                    onClick={() => toggleUser(u.id)}><Ban size={12} /> {u.actif ? 'Désactiver' : 'Activer'}</button>
                  <button className="fp-btn fp-btn-danger" style={{ padding: '0.35rem 0.6rem' }}
                    onClick={() => setModal({ type: 'confirm', msg: `Supprimer le compte de "${u.nom}" ?`, onConfirm: () => deleteUser(u.id) })}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPage
