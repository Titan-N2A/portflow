// ============================================================
// TronconForm.jsx — Formulaire ajout/édition de tronçon
// Carte (clic) + saisie manuelle précise (lat/lng), synchronisées.
// ============================================================

import { useState, useEffect } from 'react'
import L from 'leaflet'
import { createTroncon, updateTroncon } from '../../services/troncons'
import TronconMapPicker  from './TronconMapPicker'
import CoordinatesEditor from './CoordinatesEditor'
// APRÈS (remplace par)
import { useAxesLive } from '../../hooks/useAxesLive'
import { tokens }    from '../../styles/tokens'

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
  const { axes } = useAxesLive() // ← axes normalisés (format {lat,lng} cohérent)

  useEffect(() => {
    setForm(editing ? { ...editing } : VIDE)
  }, [editing])

  // APRÈS
const axe = axes.find(a => a.id === form.axeId)

  // Pré-remplit avec le départ/arrivée de l'axe quand on change d'axe
  // (en création uniquement) — point de départ pour la saisie manuelle.
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
      if (editing?.id) {
        await updateTroncon(editing.id, form)
      } else {
        await createTroncon(form)
      }
      setForm(VIDE)
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: tokens.colors.bg.surface, borderRadius: tokens.radius.md,
      padding: tokens.spacing.card, border: `1px solid ${tokens.colors.bg.border}`,
    }}>
      <h3 style={{ color: tokens.colors.text.primary, marginBottom: '0.8rem' }}>
        {editing ? 'Modifier le tronçon' : 'Nouveau tronçon'}
      </h3>

      <label style={labelStyle}>Axe parent</label>
      <select value={form.axeId} onChange={(e) => setForm({ ...form, axeId: e.target.value })} style={inputStyle}>
        {axes.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
      </select>

      <label style={labelStyle}>Nom du tronçon</label>
      <input
        type="text" value={form.nom} required placeholder="ex: CARENA → Pont HKB"
        onChange={(e) => setForm({ ...form, nom: e.target.value })}
        style={inputStyle}
      />

      <label style={labelStyle}>Ordre (position sur l'axe)</label>
      <input
        type="number" min="1" value={form.ordre}
        onChange={(e) => setForm({ ...form, ordre: Number(e.target.value) })}
        style={inputStyle}
      />

      <label style={labelStyle}>Tracé — par clic sur carte</label>
      <TronconMapPicker
        value={form.coordinates}
        onChange={(coords) => setForm({ ...form, coordinates: coords })}
      />

      <label style={{ ...labelStyle, marginTop: '0.9rem' }}>Tracé — saisie manuelle précise</label>
      <CoordinatesEditor
        points={form.coordinates}
        onChange={(coords) => setForm({ ...form, coordinates: coords })}
        allowAddRemove={false}
        minPoints={2}
      />

      {horsZone && (
        <p style={{ color: tokens.colors.traffic.dense, fontSize: '0.78rem', marginTop: '0.5rem' }}>
          ⚠️ Un des points semble hors de la zone de l'axe sélectionné — vérifiez le tracé.
        </p>
      )}

      {error && (
        <p style={{ color: tokens.colors.traffic.blocked, fontSize: '0.85rem', marginTop: '0.6rem' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
        <button type="submit" disabled={saving} style={btnPrimary}>
          {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer le tronçon'}
        </button>
        {editing && (
          <button type="button" onClick={() => { setForm(VIDE); onDone() }} style={btnSecondary}>
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}

const labelStyle   = { color: '#94A3B8', fontSize: '0.78rem', display: 'block', marginTop: '0.7rem', marginBottom: '0.3rem' }
const inputStyle   = { width: '100%', padding: '0.5rem', background: '#293548', border: '1px solid #334155', borderRadius: '6px', color: '#F1F5F9', fontSize: '0.85rem' }
const btnPrimary   = { background: '#F97316', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }
const btnSecondary = { background: 'transparent', color: '#94A3B8', border: '1px solid #334155', borderRadius: '6px', padding: '0.6rem 1.2rem', cursor: 'pointer', fontSize: '0.85rem' }

export default TronconForm