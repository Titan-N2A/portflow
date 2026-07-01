// ============================================================
// ETACard.jsx — Carte d'arrivée estimée (trajet utilisateur)
// Style cohérent avec les KPICard de DashboardPage.jsx.
// ============================================================

import { useState, useEffect } from 'react'
import { Navigation, Clock } from 'lucide-react'
import { C, levelColor, levelLabel, levelBg } from '../../styles/tokens'
import { ETA_ERRORS } from '../../services/eta'

const ERROR_LABELS = {
  [ETA_ERRORS.TIMEOUT]:  'Délai dépassé — réessai automatique au prochain déplacement.',
  [ETA_ERRORS.QUOTA]:    'Service de calcul d\'itinéraire temporairement saturé.',
  [ETA_ERRORS.NO_ROUTE]: 'Aucun itinéraire trouvé vers cette destination.',
  [ETA_ERRORS.UNKNOWN]:  'ETA momentanément indisponible.',
}

function formatFraicheur(calculatedAt, now) {
  if (!calculatedAt) return null
  const minutes = Math.floor((now - calculatedAt) / 60000)
  if (minutes <= 0) return 'à l\'instant'
  if (minutes === 1) return 'il y a 1 min'
  return `il y a ${minutes} min`
}

function ETACard({ eta, loading }) {
  const [now, setNow] = useState(() => Date.now())

  // Rafraîchit le texte "il y a X min" sans dépendre d'un nouveau calcul ETA
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const niveau  = eta?.niveauTrafic ?? 0
  const hasData = eta && !eta.erreur && eta.dureeMinutes != null

  return (
    <div className="fp-card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.65rem' }}>
        <Navigation size={15} color={C.primary} />
        <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Mon trajet</span>
        {hasData && (
          <span style={{
            marginLeft: 'auto', padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: niveau > 0 ? levelBg(niveau) : '#f0f0f0',
            color:      niveau > 0 ? levelColor(niveau) : C.textMuted,
            border:     `1px solid ${(niveau > 0 ? levelColor(niveau) : C.textLight)}40`,
          }}>
            {niveau > 0 ? levelLabel(niveau) : 'Trafic inconnu'}
          </span>
        )}
      </div>

      {loading && !eta ? (
        <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Calcul de l'ETA...</p>
      ) : eta?.erreur ? (
        <p style={{ fontSize: 12, color: C.danger, margin: 0 }}>
          {ERROR_LABELS[eta.erreur] ?? ERROR_LABELS[ETA_ERRORS.UNKNOWN]}
        </p>
      ) : hasData ? (
        <>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.4 }}>
            Arrivée estimée : {eta.arriveeEstimee.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {' · '}dans {eta.dureeMinutes} min{' · '}{eta.distanceKm} km
          </p>
          {eta.calculatedAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <Clock size={11} color={C.textMuted} />
              <span style={{ fontSize: 11, color: C.textMuted }}>
                Dernière mise à jour {formatFraicheur(eta.calculatedAt, now)}
              </span>
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
          Choisissez une destination pour estimer votre arrivée.
        </p>
      )}
    </div>
  )
}

export default ETACard
