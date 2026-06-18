// ============================================================
// exportCSV.js — Export des mesures live au format CSV
// Utilise PapaParse pour générer le CSV et déclenche
// un téléchargement direct dans le navigateur.
// ============================================================

import Papa from 'papaparse'

/**
 * Exporte les mesures live filtrées en fichier CSV téléchargeable
 * @param {Object} mesures — objet { routeId: { ...indicateurs } }
 */
export function exportMesuresCSV(mesures) {
  const rows = Object.values(mesures).map(m => ({
    Axe:               m.nom,
    Sens:               m.sens,
    'Temps live (min)': m.I1,
    'Référence (min)':  m.I2,
    'Retard (min)':     m.I3,
    'Ratio dégradation':m.I4,
    'Vitesse (km/h)':   m.I5,
    'Niveau (1-5)':     m.I7,
    'Mis à jour':       m.updatedAt,
  }))

  // Génère le texte CSV
  const csv = Papa.unparse(rows)

  // Crée un Blob et déclenche le téléchargement
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')

  const horodatage = new Date().toISOString().slice(0, 16).replace(':', 'h')
  link.href = url
  link.download = `portflow_export_${horodatage}.csv`

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}