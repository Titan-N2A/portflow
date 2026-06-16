// ============================================================
// PORTFLOW — SYSTÈME DE DESIGN (tokens.js)
// Source unique de vérité pour toutes les couleurs, typographies
// et espacements de l'application.
// Importe ce fichier dans n'importe quel composant pour
// garantir la cohérence visuelle sur tout le projet.
// ============================================================

export const tokens = {

  // ----------------------------------------------------------
  // COULEURS
  // ----------------------------------------------------------
  colors: {

    // Arrière-plans — thème sombre dashboard industriel
    bg: {
      app:      '#0F172A', // slate-900 — fond principal de l'app
      surface:  '#1E293B', // slate-800 — cards, panels, sidebar
      elevated: '#293548', // slate-700 — modales, dropdowns
      border:   '#334155', // slate-600 — séparateurs, contours
    },

    // Statuts trafic PAA — couleur sémantique (niveaux 1 à 5)
    traffic: {
      fluid:    '#22C55E', // vert    — niveau 1-2 : trafic fluide
      moderate: '#EAB308', // jaune   — niveau 3   : trafic modéré
      dense:    '#F97316', // orange  — niveau 4   : trafic dense
      blocked:  '#EF4444', // rouge   — niveau 5   : congestion
      unknown:  '#64748B', // gris    — données indisponibles
    },

    // Accent principal PortFlow
    accent: {
      primary: '#F97316', // orange PAA — boutons, badges, highlights
      hover:   '#EA6C0A', // orange foncé au survol
      subtle:  '#431407', // fond très sombre pour badges orange
    },

    // Couleurs des 3 axes PAA (carte Leaflet)
    axes: {
      axe1: '#3B82F6', // bleu   — Axe 1 CARENA
      axe2: '#A855F7', // violet — Axe 2 TOYOTA CFAO
      axe3: '#F97316', // orange — Axe 3 SODECI
    },

    // Textes
    text: {
      primary:   '#F1F5F9', // blanc cassé — titres, labels principaux
      secondary: '#94A3B8', // gris clair  — descriptions, sous-titres
      muted:     '#64748B', // gris foncé  — placeholders, désactivés
      data:      '#7DD3FC', // bleu clair  — valeurs numériques / KPIs
    },
  },

  // ----------------------------------------------------------
  // TYPOGRAPHIE
  // ----------------------------------------------------------
  fonts: {
    ui:   '"Inter", system-ui, sans-serif',    // Interface, labels, textes
    data: '"JetBrains Mono", monospace',        // Métriques, temps, chiffres
  },

  // ----------------------------------------------------------
  // ESPACEMENTS (padding, gap, margin)
  // ----------------------------------------------------------
  spacing: {
    card:    '1.5rem', // padding interne des cards
    section: '2rem',   // espacement vertical entre sections
    gap:     '1rem',   // gap entre éléments d'une grille
  },

  // ----------------------------------------------------------
  // FORMES
  // ----------------------------------------------------------
  radius: {
    sm:   '6px',    // boutons, badges, inputs
    md:   '10px',   // cards, panels
    lg:   '16px',   // modales, drawers
    full: '9999px', // pills, avatars ronds
  },

  // ----------------------------------------------------------
  // OMBRES
  // ----------------------------------------------------------
  shadows: {
    card:    '0 1px 3px rgba(0,0,0,0.4)',
    panel:   '0 4px 12px rgba(0,0,0,0.5)',
    glow:    '0 0 20px rgba(249,115,22,0.25)', // halo orange — alertes
  },

  // ----------------------------------------------------------
  // TRANSITIONS
  // ----------------------------------------------------------
  transition: {
    fast:   '150ms ease',
    normal: '250ms ease',
    slow:   '400ms ease',
  },
}

// ----------------------------------------------------------
// HELPERS — Fonctions utilitaires liées aux tokens
// ----------------------------------------------------------

/**
 * Retourne la couleur Tailwind/hex selon le niveau de congestion (1-5)
 * @param {number} level — niveau de congestion entre 1 et 5
 * @returns {string} couleur hex
 */
export function getTrafficColor(level) {
  if (level <= 2) return tokens.colors.traffic.fluid
  if (level === 3) return tokens.colors.traffic.moderate
  if (level === 4) return tokens.colors.traffic.dense
  if (level >= 5) return tokens.colors.traffic.blocked
  return tokens.colors.traffic.unknown
}

/**
 * Retourne la couleur hex d'un axe PAA par son numéro
 * @param {number} axeNum — 1, 2 ou 3
 * @returns {string} couleur hex
 */
export function getAxeColor(axeNum) {
  const map = {
    1: tokens.colors.axes.axe1,
    2: tokens.colors.axes.axe2,
    3: tokens.colors.axes.axe3,
  }
  return map[axeNum] ?? tokens.colors.traffic.unknown
}

/**
 * Retourne le label texte d'un niveau de congestion
 * @param {number} level — niveau entre 1 et 5
 * @returns {string} label lisible
 */
export function getTrafficLabel(level) {
  const labels = {
    1: 'Fluide',
    2: 'Fluide',
    3: 'Modéré',
    4: 'Dense',
    5: 'Congestionné',
  }
  return labels[level] ?? 'Inconnu'
}