// ============================================================
// PublicView.jsx
// Interface Grand Public — accessible sans connexion.
// Affiche la carte, les indicateurs clés et le chatbot de base.
// ============================================================

import { tokens } from '../styles/tokens'

function PublicView() {
  return (
    <div style={{ padding: tokens.spacing.section }}>
      <h2 style={{ color: tokens.colors.text.primary }}>
        Vue Publique — Trafic en temps réel
      </h2>
      <p style={{ color: tokens.colors.text.secondary, marginTop: '0.5rem' }}>
        Carte + indicateurs clés (I1, I3, I5, I7, I9)
      </p>
    </div>
  )
}

export default PublicView