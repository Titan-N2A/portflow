// ============================================================
// CalibrageTref.jsx — Recalibrage des temps de référence (Admin)
// Affiche les tRef recommandés calculés chaque semaine par
// scripts/calibrer_references.js (P33 des relevés réels, publié
// dans flowport_references/horaires) et permet de les appliquer
// en un clic. Rien n'est modifié sans action de l'admin.
// ============================================================

import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { Gauge, Check } from 'lucide-react'
import { db } from '../../services/firebase'
import { C } from '../../styles/tokens'

export default function CalibrageTref({ axes, onToast }) {
  const [reco,       setReco]       = useState(null)
  const [meta,       setMeta]       = useState(null)
  const [enCours,    setEnCours]    = useState(null)

  useEffect(() => {
    getDoc(doc(db, 'flowport_references', 'horaires'))
      .then(snap => {
        if (!snap.exists()) return
        const d = snap.data()
        if (d.tRefReco && Object.keys(d.tRefReco).length) {
          setReco(d.tRefReco)
          setMeta({ majLe: d.majLe, periodeDu: d.periodeDu, periodeAu: d.periodeAu })
        }
      })
      .catch(err => console.warn('Recommandations tRef indisponibles :', err.message))
  }, [])

  if (!reco) return null   // pas encore de calibrage publié

  async function appliquer(axeId, valeur) {
    setEnCours(axeId)
    try {
      await updateDoc(doc(db, 'flowport_axes', axeId), { tRef: valeur })
      onToast?.(`Référence appliquée — les niveaux, alertes et seuils suivent immédiatement`)
    } catch (err) {
      onToast?.(`Erreur : ${err.message}`, 'error')
    } finally {
      setEnCours(null)
    }
  }

  const lignes = axes
    .map(axe => {
      const r = reco[axe.id]
      if (!r) return null
      const actuel = axe.tRef ?? 0
      const ecartPct = actuel > 0 ? Math.round((r.valeur - actuel) / actuel * 100) : 0
      return { axe, r, actuel, ecartPct, calibre: Math.abs(ecartPct) < 5 }
    })
    .filter(Boolean)

  if (!lignes.length) return null

  return (
    <div className="fp-card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Gauge size={15} color={C.primary} />
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Calibrage des temps de référence</span>
      </div>
      <p style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.5, margin: '0 0 0.75rem' }}>
        Recommandations calculées sur les relevés réels du {meta?.periodeDu && new Date(meta.periodeDu).toLocaleDateString('fr-FR')} au{' '}
        {meta?.periodeAu && new Date(meta.periodeAu).toLocaleDateString('fr-FR')} (P33 de la distribution — même position que les axes
        historiquement bien calibrés). Une référence trop haute rend l&apos;axe aveugle aux congestions ; trop basse, il alerte en permanence.
      </p>
      {lignes.map(({ axe, r, actuel, ecartPct, calibre }) => (
        <div key={axe.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '0.55rem 0', borderTop: '1px solid #eef2f6',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: '0 0 130px' }}>{axe.shortNom ?? axe.nom}</span>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            Actuel : <strong style={{ color: C.text }}>{actuel} min</strong>
          </span>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            Recommandé : <strong style={{ color: calibre ? '#1E8449' : C.primary }}>{r.valeur} min</strong>
            {' '}({ecartPct >= 0 ? '+' : ''}{ecartPct} %)
          </span>
          <span style={{ fontSize: 11, color: C.textLight }}>
            {r.n} relevés · ~{r.pctN3} % du temps en N3+ avec cette valeur
          </span>
          {calibre ? (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto',
              fontSize: 11.5, fontWeight: 700, color: '#1E8449',
              background: '#d5f5e3', borderRadius: 999, padding: '3px 10px',
            }}>
              <Check size={12} /> Bien calibré
            </span>
          ) : (
            <button
              className="fp-btn fp-btn-primary"
              style={{ marginLeft: 'auto', fontSize: 12, padding: '0.35rem 0.8rem' }}
              disabled={enCours === axe.id}
              onClick={() => appliquer(axe.id, r.valeur)}
            >
              {enCours === axe.id ? 'Application…' : `Appliquer ${r.valeur} min`}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
