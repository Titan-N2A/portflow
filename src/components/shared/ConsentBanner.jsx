// src/components/shared/ConsentBanner.jsx
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { C } from '../../styles/tokens'

// Clé sessionStorage partagée avec useGeolocation (étape 2)
export const CONSENT_KEY   = 'portflow_geoloc_consent' // 'accepted' | 'refused'
// Événement diffusé au moment de la décision — useGeolocation ne remonte
// jamais avec DashboardPage, sans ça son useEffect (monté avant la décision)
// ne saurait jamais qu'on vient d'accepter.
export const CONSENT_EVENT = 'portflow-consent-change'

function ConsentBanner({ onDecision }) {
  // N'affiche le bandeau que si aucune décision n'a encore été prise cette
  // session — lecture au montage via initialiseur paresseux (pas d'effet).
  const [visible, setVisible] = useState(() => !sessionStorage.getItem(CONSENT_KEY))

  function decide(value) {
    sessionStorage.setItem(CONSENT_KEY, value)
    setVisible(false)
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
    onDecision?.(value)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 3000,
      background: '#fff', borderTop: `1px solid ${C.border}`,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
      padding: '1rem 1.25rem',
      display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '8px', flexShrink: 0,
        background: `${C.primary}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MapPin size={18} color={C.primary} />
      </div>

      <p style={{ flex: '1 1 320px', fontSize: 12.5, color: C.text, lineHeight: 1.5, margin: 0 }}>
        PortFlow souhaite accéder à votre position GPS pour calculer votre temps d'arrivée estimé
        et améliorer le monitoring du trafic PAA. Votre position (anonymisée) sera visible par
        les administrateurs PAA pendant votre session uniquement.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button className="fp-btn fp-btn-ghost" style={{ fontSize: 12 }} onClick={() => decide('refused')}>
          Refuser (ETA non disponible)
        </button>
        <button className="fp-btn fp-btn-primary" style={{ fontSize: 12 }} onClick={() => decide('accepted')}>
          Accepter et activer
        </button>
      </div>
    </div>
  )
}

export default ConsentBanner
