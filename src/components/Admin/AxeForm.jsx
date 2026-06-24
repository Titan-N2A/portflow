import { useState } from 'react'
import { updateAxeInfo } from '../../services/axesAdmin'
import AxeMapPicker      from './AxeMapPicker'
import CoordinatesEditor from './CoordinatesEditor'
import { tokens, getAxeColor } from '../../styles/tokens'

function AxeForm({ axe }) {
  const [expanded,    setExpanded]    = useState(false)
  const [nom,         setNom]         = useState(axe.nom)
  const [distance,    setDistance]    = useState(axe.distance)
  const [coordinates, setCoordinates] = useState(axe.coordinates)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)

  const axeColor = getAxeColor(axe.num)

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
      background:   tokens.colors.bg.surface,
      borderRadius: tokens.radius.md,
      borderLeft:   `3px solid ${axeColor}`,
      padding:      tokens.spacing.card,
      border:       `1px solid ${tokens.colors.bg.border}`,
      borderLeftColor: axeColor,
      boxShadow:    saving || saved ? `0 0 0 1px ${axeColor}30` : 'none',
      transition:   'box-shadow 0.2s ease',
    }}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Indicateur de couleur axe */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: axeColor,
          boxShadow: `0 0 8px ${axeColor}80`,
          flexShrink: 0,
        }} />

        {/* Nom */}
        <input
          value={nom}
          onChange={e => setNom(e.target.value)}
          className="pf-input"
          style={{ flex: 2, minWidth: '200px', padding: '0.38rem 0.7rem', fontSize: '0.82rem' }}
        />

        {/* Distance */}
        <input
          value={distance}
          onChange={e => setDistance(e.target.value)}
          className="pf-input"
          style={{ width: '90px', padding: '0.38rem 0.7rem', fontSize: '0.82rem' }}
        />

        {/* Toggle tracé */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background:   'transparent',
            border:       `1px solid ${tokens.colors.bg.border}`,
            color:        expanded ? tokens.colors.accent.primary : tokens.colors.text.secondary,
            borderColor:  expanded ? `${tokens.colors.accent.primary}50` : tokens.colors.bg.border,
            borderRadius: tokens.radius.sm,
            padding:      '0.38rem 0.8rem',
            cursor:       'pointer',
            fontSize:     '0.75rem',
            fontFamily:   tokens.fonts.ui,
            fontWeight:   500,
            transition:   'all 0.15s ease',
          }}
        >
          {expanded ? 'Masquer tracé ▲' : 'Modifier tracé ▼'}
        </button>

        {/* Enregistrer */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background:   saved
              ? 'rgba(0,229,160,0.12)'
              : `linear-gradient(135deg, ${axeColor}, ${axeColor}CC)`,
            color:        saved ? tokens.colors.traffic.fluid : '#030D1A',
            border:       saved ? '1px solid rgba(0,229,160,0.3)' : 'none',
            borderRadius: tokens.radius.sm,
            padding:      '0.38rem 0.9rem',
            cursor:       saving ? 'not-allowed' : 'pointer',
            fontSize:     '0.75rem',
            fontFamily:   tokens.fonts.ui,
            fontWeight:   700,
            transition:   'all 0.2s ease',
            opacity:      saving ? 0.65 : 1,
          }}
        >
          {saved ? '✓ Enregistré' : saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {/* Panneau d'édition du tracé */}
      {expanded && (
        <div style={{
          marginTop:  '1rem',
          paddingTop: '1rem',
          borderTop:  `1px solid ${tokens.colors.bg.border}`,
        }}>
          <p style={{
            color:      tokens.colors.text.muted,
            fontSize:   '0.72rem',
            fontFamily: tokens.fonts.ui,
            marginBottom: '0.8rem',
          }}>
            <span style={{ color: tokens.colors.text.secondary, fontWeight: 600 }}>
              {coordinates.length} points
            </span>
            {' '}· clic/glisser sur la carte OU saisie manuelle ci-dessous
          </p>

          <div style={{ display: 'flex', gap: tokens.spacing.gap, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <AxeMapPicker points={coordinates} onChange={setCoordinates} />
            </div>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <p style={{
                color: tokens.colors.text.muted, fontSize: '0.68rem',
                fontFamily: tokens.fonts.ui, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: '0.5rem',
              }}>
                Saisie manuelle GPS
              </p>
              <CoordinatesEditor
                points={coordinates}
                onChange={setCoordinates}
                allowAddRemove
                minPoints={2}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AxeForm
