// ============================================================
// AxeForm.jsx — Édition complète d'un axe
// Nom, distance ET tracé (coordonnées) — par carte OU saisie
// manuelle précise, les deux méthodes restant synchronisées.
// ============================================================

import { useState } from 'react'
import { updateAxeInfo } from '../../services/axesAdmin'
import AxeMapPicker        from './AxeMapPicker'
import CoordinatesEditor   from './CoordinatesEditor'
import { tokens, getAxeColor } from '../../styles/tokens'

function AxeForm({ axe }) {
  const [expanded,    setExpanded]    = useState(false)
  const [nom,         setNom]         = useState(axe.nom)
  const [distance,    setDistance]    = useState(axe.distance)
  const [coordinates, setCoordinates] = useState(axe.coordinates)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateAxeInfo(axe.id, { nom, distance, coordinates })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: tokens.colors.bg.surface, borderRadius: tokens.radius.md,
      borderLeft: `3px solid ${getAxeColor(axe.num)}`, padding: tokens.spacing.card,
    }}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...miniInput, flex: 2 }} />
        <input value={distance} onChange={(e) => setDistance(e.target.value)} style={{ ...miniInput, width: '90px' }} />

        <button type="button" onClick={() => setExpanded(!expanded)} style={btnGhost}>
          {expanded ? 'Masquer le tracé ▲' : 'Modifier le tracé ▼'}
        </button>

        <button onClick={handleSave} disabled={saving} style={{
          background: saved ? tokens.colors.traffic.fluid : tokens.colors.accent.primary,
          color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem',
          cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold',
        }}>
          {saved ? '✅ Enregistré' : saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: `1px solid ${tokens.colors.bg.border}` }}>
          <p style={{ color: tokens.colors.text.secondary, fontSize: '0.8rem', marginBottom: '0.6rem' }}>
            {coordinates.length} points · ajustez par clic/glisser sur la carte OU saisie manuelle précise ci-dessous.
          </p>
          <div style={{ display: 'flex', gap: tokens.spacing.gap, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <AxeMapPicker points={coordinates} onChange={setCoordinates} />
            </div>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <p style={{ color: tokens.colors.text.muted, fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                Saisie manuelle (latitude / longitude)
              </p>
              <CoordinatesEditor points={coordinates} onChange={setCoordinates} allowAddRemove minPoints={2} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const miniInput = { padding: '0.4rem 0.6rem', background: '#1E293B', border: '1px solid #334155', borderRadius: '6px', color: '#F1F5F9', fontSize: '0.8rem' }
const btnGhost  = { background: 'transparent', border: '1px solid #334155', color: '#94A3B8', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.78rem' }

export default AxeForm