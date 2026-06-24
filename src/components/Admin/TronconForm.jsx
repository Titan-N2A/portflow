import { useState, useEffect } from 'react'
import L from 'leaflet'
import { createTroncon, updateTroncon } from '../../services/troncons'
import TronconMapPicker  from './TronconMapPicker'
import CoordinatesEditor from './CoordinatesEditor'
import { useAxesLive }   from '../../hooks/useAxesLive'
import { tokens, getAxeColor } from '../../styles/tokens'

function pointsDansAxe(points, axe) {
  if (!points || points.length < 2 || !axe) return true
  const bounds = L.latLngBounds(axe.coordinates).pad(0.15)
  return points.every(p => bounds.contains([p.lat, p.lng]))
}

const VIDE = { axeId: 'axe1', nom: '', ordre: 1, coordinates: [] }

function TronconForm({ editing, onDone }) {
  const [form,   setForm]   = useState(VIDE)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const { axes } = useAxesLive()

  useEffect(() => { setForm(editing ? { ...editing } : VIDE) }, [editing])

  const axe = axes.find(a => a.id === form.axeId)

  useEffect(() => {
    if (!editing && form.coordinates.length < 2 && axe) {
      setForm(f => ({
        ...f,
        coordinates: [axe.coordinates[0], axe.coordinates[axe.coordinates.length - 1]],
      }))
    }
  }, [form.axeId])

  const horsZone = !pointsDansAxe(form.coordinates, axe)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.coordinates.length !== 2) {
      setError('Définissez les 2 points (départ et arrivée).')
      return
    }
    setSaving(true)
    try {
      if (editing?.id) await updateTroncon(editing.id, form)
      else await createTroncon(form)
      setForm(VIDE)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedAxeColor = getAxeColor(axe?.num ?? 1)

  return (
    <form
      onSubmit={handleSubmit}
      className="pf-card"
      style={{
        background:    tokens.colors.bg.surface,
        borderRadius:  tokens.radius.md,
        padding:       tokens.spacing.card,
        border:        `1px solid ${tokens.colors.bg.border}`,
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* Accent top — couleur de l'axe sélectionné */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, transparent, ${selectedAxeColor}, transparent)`,
        transition: 'background 0.3s ease',
      }} />

      <h3 style={{
        color:         tokens.colors.text.primary,
        fontSize:      '0.9rem',
        fontFamily:    tokens.fonts.ui,
        fontWeight:    600,
        marginBottom:  '1rem',
        display:       'flex',
        alignItems:    'center',
        gap:           '8px',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: editing ? tokens.colors.accent.secondary : tokens.colors.accent.primary,
          boxShadow: `0 0 8px ${editing ? tokens.colors.accent.secondary : tokens.colors.accent.primary}`,
          flexShrink: 0,
        }} />
        {editing ? 'Modifier le tronçon' : 'Nouveau tronçon'}
      </h3>

      {/* Axe parent */}
      <label style={labelStyle}>Axe parent</label>
      <select
        value={form.axeId}
        onChange={e => setForm({ ...form, axeId: e.target.value })}
        className="pf-select"
        style={{ width: '100%', marginBottom: '0.2rem' }}
      >
        {axes.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
      </select>

      {/* Nom */}
      <label style={labelStyle}>Nom du tronçon</label>
      <input
        type="text"
        value={form.nom}
        required
        placeholder="ex: CARENA → Pont HKB"
        onChange={e => setForm({ ...form, nom: e.target.value })}
        className="pf-input"
        style={{ marginBottom: '0.2rem' }}
      />

      {/* Ordre */}
      <label style={labelStyle}>Ordre sur l'axe</label>
      <input
        type="number"
        min="1"
        value={form.ordre}
        onChange={e => setForm({ ...form, ordre: Number(e.target.value) })}
        className="pf-input"
        style={{ width: '100px', marginBottom: '0.2rem' }}
      />

      {/* Carte */}
      <label style={labelStyle}>Tracé — clic sur carte</label>
      <TronconMapPicker
        value={form.coordinates}
        onChange={coords => setForm({ ...form, coordinates: coords })}
      />

      {/* Saisie manuelle */}
      <label style={{ ...labelStyle, marginTop: '0.9rem' }}>Tracé — saisie manuelle GPS</label>
      <CoordinatesEditor
        points={form.coordinates}
        onChange={coords => setForm({ ...form, coordinates: coords })}
        allowAddRemove={false}
        minPoints={2}
      />

      {/* Avertissement hors zone */}
      {horsZone && (
        <div style={{
          marginTop:    '0.6rem',
          padding:      '0.5rem 0.8rem',
          background:   'rgba(249,115,22,0.08)',
          border:       '1px solid rgba(249,115,22,0.25)',
          borderRadius: tokens.radius.sm,
        }}>
          <span style={{ color: tokens.colors.traffic.dense, fontSize: '0.75rem', fontFamily: tokens.fonts.ui }}>
            ⚠ Un point semble hors de la zone de l'axe — vérifiez le tracé.
          </span>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div style={{
          marginTop:    '0.6rem',
          padding:      '0.5rem 0.8rem',
          background:   'rgba(255,51,102,0.08)',
          border:       '1px solid rgba(255,51,102,0.25)',
          borderRadius: tokens.radius.sm,
        }}>
          <span style={{ color: tokens.colors.traffic.blocked, fontSize: '0.8rem', fontFamily: tokens.fonts.ui }}>
            {error}
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
        <button
          type="submit"
          disabled={saving}
          className="pf-btn-primary"
          style={{
            opacity: saving ? 0.65 : 1,
            cursor:  saving ? 'not-allowed' : 'pointer',
            padding: '0.55rem 1.2rem',
            fontSize: '0.82rem',
          }}
        >
          {saving ? 'Enregistrement...' : editing ? '↑ Mettre à jour' : '+ Créer le tronçon'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => { setForm(VIDE); onDone() }}
            className="pf-btn-secondary"
            style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
          >
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}

const labelStyle = {
  color:         tokens.colors.text.muted,
  fontSize:      '0.68rem',
  fontFamily:    tokens.fonts.ui,
  fontWeight:    700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  display:       'block',
  marginTop:     '0.75rem',
  marginBottom:  '0.35rem',
}

export default TronconForm
