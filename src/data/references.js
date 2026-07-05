// ============================================================
// references.js — Références horaires réelles PAA
// Calculées depuis la base février 2025 (2 016 mesures).
// Utilisées comme socle de comparaison pour les données live.
// Format : { 'axe_sens_heure': temps_median_minutes }
// ============================================================

// Temps médians de référence par axe / sens / heure (7h–18h)
export const REFERENCES = {

  // Axe 1 — CARENA → Palm Beach (aller)
  'axe1_aller_7':  23.0,
  'axe1_aller_8':  28.5,
  'axe1_aller_9':  30.2,
  'axe1_aller_10': 32.1,
  'axe1_aller_11': 33.8, // pointe matin
  'axe1_aller_12': 31.5,
  'axe1_aller_13': 29.0,
  'axe1_aller_14': 27.0,
  'axe1_aller_15': 26.5,
  'axe1_aller_16': 27.8,
  'axe1_aller_17': 30.0,
  'axe1_aller_18': 28.0,

  // Axe 1 — Palm Beach → CARENA (retour)
  'axe1_retour_7':  28.0,
  'axe1_retour_8':  33.0,
  'axe1_retour_9':  35.5,
  'axe1_retour_10': 37.0,
  'axe1_retour_11': 38.5,
  'axe1_retour_12': 37.0,
  'axe1_retour_13': 36.0,
  'axe1_retour_14': 34.5,
  'axe1_retour_15': 35.0,
  'axe1_retour_16': 38.0,
  'axe1_retour_17': 42.0, // pointe soir
  'axe1_retour_18': 40.0,

  // Axe 2 — Toyota CFAO → Palm Beach (aller)
  'axe2_aller_7':  14.0,
  'axe2_aller_8':  16.5,
  'axe2_aller_9':  17.8,
  'axe2_aller_10': 18.5,
  'axe2_aller_11': 19.2,
  'axe2_aller_12': 18.8, // pointe midi
  'axe2_aller_13': 18.5,
  'axe2_aller_14': 17.0,
  'axe2_aller_15': 16.5,
  'axe2_aller_16': 17.0,
  'axe2_aller_17': 18.0,
  'axe2_aller_18': 16.8,

  // Axe 3 — SODECI → Palm Beach (aller)
  'axe3_aller_7':  15.0,
  'axe3_aller_8':  17.0,
  'axe3_aller_9':  18.5,
  'axe3_aller_10': 19.0,
  'axe3_aller_11': 19.8, // pointe
  'axe3_aller_12': 19.5,
  'axe3_aller_13': 18.8,
  'axe3_aller_14': 17.5,
  'axe3_aller_15': 17.0,
  'axe3_aller_16': 17.8,
  'axe3_aller_17': 18.5,
  'axe3_aller_18': 17.2,
}

// Résumé global par axe (toutes heures confondues)
// axe2_retour/axe3_retour n'ont pas de courbe horaire historique dédiée
// (dataset février 2025 incomplet sur ces trajets retour) — on retombe sur
// la même moyenne que l'aller, cohérent avec useTrafficData.js qui utilise
// déjà un seul tRef par axe pour les deux sens. Sans ces entrées,
// getReference() renvoyait null pour ces axes en retour, et les indicateurs
// synthétiques (donut, heatmap) qui font `if (!ref) return` les excluaient
// silencieusement de tous les graphiques.
export const REFERENCES_GLOBALES = {
  axe1_aller:  { moyenne: 27.4, vitesse: 32.6, pointe: '10h–12h' },
  axe1_retour: { moyenne: 36.3, vitesse: 24.6, pointe: '17h–18h' },
  axe2_aller:  { moyenne: 16.9, vitesse: 28.4, pointe: '12h–13h' },
  axe2_retour: { moyenne: 16.9, vitesse: 28.4, pointe: '12h–13h' },
  axe3_aller:  { moyenne: 17.8, vitesse: 28.0, pointe: '11h–13h' },
  axe3_retour: { moyenne: 17.8, vitesse: 28.0, pointe: '11h–13h' },
}

/**
 * Retourne le temps de référence pour un axe/sens/heure donnés.
 * @param {string} axeId  — 'axe1', 'axe2', 'axe3'
 * @param {string} sens   — 'aller' | 'retour'
 * @param {number} heure  — 7 à 18
 * @param {Object|null} dynamiques — références recalibrées (médianes des
 *   7 derniers jours, doc flowport_references/horaires publié chaque
 *   semaine par scripts/calibrer_references.js) ; prioritaires sur la
 *   base statique de février 2025 quand elles existent.
 * @returns {number} temps de référence en minutes
 */
export function getReference(axeId, sens, heure, dynamiques = null) {
  const key = `${axeId}_${sens}_${heure}`
  return dynamiques?.[key]
    ?? REFERENCES[key]
    ?? REFERENCES_GLOBALES[`${axeId}_${sens}`]?.moyenne
    ?? null
}