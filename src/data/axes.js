// ============================================================
// axes.js — Données géographiques des 3 axes PAA
// Source de vérité pour les tracés Leaflet et le schéma Firestore.
// Coordonnées basées sur le lexique PAA (à affiner avec données terrain).
// ============================================================

export const PAA_CENTER = [5.29, -4.02] // Centre carte — Port Autonome d'Abidjan

export const AXES_DATA = [
  {
    id:       'axe1',
    num:      1,
    nom:      'Axe 1 — CARENA → Palm Beach',
    sens:     ['aller', 'retour'],
    distance: '14.8 km',
    // Points GPS du tracé (lat, lng)
    coordinates: [
      [5.2470, -3.9720], // CARENA — point de départ
      [5.2455, -3.9680],
      [5.2440, -3.9630],
      [5.2420, -3.9580], // Palm Beach — point d'arrivée
    ],
    // Temps de référence réels (base PAA — février 2025)
    reference: { aller: 27.4, retour: 36.3 }, // minutes
  },
  {
    id:       'axe2',
    num:      2,
    nom:      'Axe 2 — Toyota CFAO → Palm Beach',
    sens:     ['aller'],
    distance: '9.6 km',
    coordinates: [
      [5.2810, -4.0140], // Toyota CFAO — point de départ
      [5.2700, -4.0000],
      [5.2600, -3.9850],
      [5.2500, -3.9700],
      [5.2420, -3.9580], // Palm Beach — point d'arrivée
    ],
    reference: { aller: 16.9 },
  },
  {
    id:       'axe3',
    num:      3,
    nom:      'Axe 3 — SODECI → Palm Beach',
    sens:     ['aller'],
    distance: '8.4 km',
    coordinates: [
      [5.2710, -4.0030], // SODECI — point de départ
      [5.2620, -3.9900],
      [5.2520, -3.9750],
      [5.2420, -3.9580], // Palm Beach — point d'arrivée
    ],
    reference: { aller: 17.8 },
  },
]