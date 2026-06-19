// ============================================================
// predictions.js — Lecture et exploitation du modèle prédictif
// Lookup dans predictions.json (Random Forest, Jour 10) +
// détection d'épisodes de congestion prévus.
// ============================================================

// Convertit le jour JS (0=dimanche...6=samedi) en label français.
// Le script Python utilise la convention pandas (lundi=0) — on
// passe donc par le LABEL TEXTE comme clé commune, pas un index
// numérique, pour éviter toute confusion entre les deux langages.
const JOUR_LABELS = {
  0: 'dimanche', 1: 'lundi', 2: 'mardi', 3: 'mercredi',
  4: 'jeudi', 5: 'vendredi', 6: 'samedi',
}

export function getJourLabel(date = new Date()) {
  return JOUR_LABELS[date.getDay()]
}

/**
 * Récupère la prédiction pour un créneau précis
 * @returns {Object|null} { niveau_prevu, confiance_pct, temps_prevu_min }
 */
export function getPrediction(predictions, axeId, sens, jourLabel, heure) {
  const key = `${axeId}_${sens}_${jourLabel}_${heure}h`
  return predictions?.[key] ?? null
}

/**
 * Récupère les prévisions 7h-18h pour un axe/sens/jour donné
 */
export function getForecastJour(predictions, axeId, sens, jourLabel) {
  const heures = Array.from({ length: 12 }, (_, i) => i + 7)
  return heures.map(heure => {
    const pred = getPrediction(predictions, axeId, sens, jourLabel, heure)
    return { heure, ...(pred ?? { niveau_prevu: 0, confiance_pct: 0, temps_prevu_min: null }) }
  })
}

/**
 * Détecte les épisodes de congestion prévue (niveau >= seuil) en
 * regroupant les heures contiguës d'une prévision journalière.
 * @returns {Array} [{ heureDebut, heureFin, niveauMax, confianceMoyenne }]
 */
export function detectEpisodes(forecast, seuil = 3) {
  const episodes = []
  let courant = null

  forecast.forEach(({ heure, niveau_prevu, confiance_pct }) => {
    if (niveau_prevu >= seuil) {
      if (!courant) {
        courant = { heureDebut: heure, heureFin: heure, niveauMax: niveau_prevu, confiances: [confiance_pct] }
      } else {
        courant.heureFin  = heure
        courant.niveauMax = Math.max(courant.niveauMax, niveau_prevu)
        courant.confiances.push(confiance_pct)
      }
    } else if (courant) {
      episodes.push(finaliser(courant))
      courant = null
    }
  })
  if (courant) episodes.push(finaliser(courant))

  return episodes
}

function finaliser(ep) {
  const confianceMoyenne = Math.round(ep.confiances.reduce((a, b) => a + b, 0) / ep.confiances.length)
  return { heureDebut: ep.heureDebut, heureFin: ep.heureFin, niveauMax: ep.niveauMax, confianceMoyenne }
}