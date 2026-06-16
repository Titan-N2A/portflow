// ============================================================
// AdminView.jsx
// Interface Administrateur — accessible après connexion.
// Affiche tous les indicateurs, graphiques, admin CRUD,
// rapports, couche prédictive et panneau IA Gemini.
// ============================================================

import { tokens } from '../styles/tokens'

function AdminView() {
  return (
    <div style={{ padding: tokens.spacing.section }}>
      <h2 style={{ color: tokens.colors.accent.primary }}>
        Interface Administrateur
      </h2>
      <p style={{ color: tokens.colors.text.secondary, marginTop: '0.5rem' }}>
        Dashboard complet + gestion axes/tronçons + rapports + IA
      </p>
    </div>
  )
}

export default AdminView