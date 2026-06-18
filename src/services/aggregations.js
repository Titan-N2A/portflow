// ============================================================
// aggregations.js — Agrégations des données historiques PAA
// Transforme les 2 016 mesures brutes en données prêtes
// pour les graphiques (courbe 24h, comparatif des axes).
// ============================================================

const NOMS_AXES = { axe1: 'CARENA', axe2: 'TOYOTA CFAO', axe3: 'SODECI' }

/**
 * Calcule la courbe moyenne par heure (7h-18h) pour un axe/sens donné
 * @param {Array} data — mesures brutes Firestore
 * @param {string} axeId — 'axe1', 'axe2', 'axe3'
 * @param {string} sens — 'aller' | 'retour'
 * @returns {Array} [{ heure, temps_moyen }]
 */
export function computeCourbe24h(data, axeId, sens) {
  const heures = Array.from({ length: 12 }, (_, i) => i + 7) // 7h à 18h

  return heures.map(heure => {
    const valeurs = data
      .filter(d => d.axeId === axeId && d.sens === sens && d.heure === heure)
      .map(d => d.temps_min)

    const moyenne = valeurs.length
      ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length
      : null

    return {
      heure,
      temps_moyen: moyenne !== null ? Math.round(moyenne * 10) / 10 : null,
    }
  })
}

/**
 * Calcule le temps moyen (aller) pour chacun des 3 axes — comparatif
 * @param {Array} data — mesures brutes Firestore
 * @returns {Array} [{ axeId, nom, temps_moyen }]
 */
export function computeMoyenneParAxe(data) {
  return ['axe1', 'axe2', 'axe3'].map(axeId => {
    const valeurs = data
      .filter(d => d.axeId === axeId && d.sens === 'aller')
      .map(d => d.temps_min)

    const moyenne = valeurs.length
      ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length
      : 0

    return {
      axeId,
      nom: NOMS_AXES[axeId],
      temps_moyen: Math.round(moyenne * 10) / 10,
    }
  })
}