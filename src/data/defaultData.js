// ══════════════════════════════════════════════════════════
// Source unique de vérité pour les données par défaut PAA.
// Utilisée pour le seed Firestore au premier démarrage
// ET comme fallback si Firestore est indisponible.
// ══════════════════════════════════════════════════════════

export const DEFAULT_AXES = [
  {
    id: 'axe1', num: 1,
    nom:      'CARENA (Plateau) → Pharmacie Palm Beach',
    shortNom: 'CARENA',
    distance: '14.8 km',
    tRef:     27.4,
    ordre:    1,
    actif:    true,
    troncons: ['T1A', 'T1B', 'T1C', 'T1D', 'T1E'],
    coordinates: [
      [5.2470, -3.9720],
      [5.2455, -3.9680],
      [5.2440, -3.9630],
      [5.2420, -3.9580],
    ],
    start: [5.2470, -3.9720],
  },
  {
    id: 'axe2', num: 2,
    nom:      'Toyota CFAO → Pharmacie Palm Beach',
    shortNom: 'Toyota CFAO',
    distance: '9.6 km',
    tRef:     16.9,
    ordre:    2,
    actif:    true,
    troncons: ['T2A', 'T2B', 'T2C'],
    coordinates: [
      [5.2810, -4.0140],
      [5.2700, -4.0000],
      [5.2600, -3.9850],
      [5.2500, -3.9700],
      [5.2420, -3.9580],
    ],
    start: [5.2810, -4.0140],
  },
  {
    id: 'axe3', num: 3,
    nom:      'Agence SODECI → Pharmacie Palm Beach',
    shortNom: 'Agence SODECI',
    distance: '8.4 km',
    tRef:     17.8,
    ordre:    3,
    actif:    true,
    troncons: ['T3A', 'T3B', 'T3C'],
    coordinates: [
      [5.2710, -4.0030],
      [5.2620, -3.9900],
      [5.2520, -3.9750],
      [5.2420, -3.9580],
    ],
    start: [5.2710, -4.0030],
  },
]

export const DEFAULT_TRONCONS = [
  { id: 't1a', axeId: 'axe1', code: 'T1A', nom: 'CARENA → Rondpoint SMOBY',   ordre: 1, dist: '2.8 km', coordinates: [[5.2470,-3.9720],[5.2462,-3.9700]] },
  { id: 't1b', axeId: 'axe1', code: 'T1B', nom: 'Rondpoint SMOBY → Pont HKB', ordre: 2, dist: '3.2 km', coordinates: [[5.2462,-3.9700],[5.2450,-3.9665]] },
  { id: 't1c', axeId: 'axe1', code: 'T1C', nom: 'Pont HKB → Williamsville',   ordre: 3, dist: '2.5 km', coordinates: [[5.2450,-3.9665],[5.2440,-3.9640]] },
  { id: 't1d', axeId: 'axe1', code: 'T1D', nom: 'Williamsville → Riviera',    ordre: 4, dist: '3.1 km', coordinates: [[5.2440,-3.9640],[5.2430,-3.9610]] },
  { id: 't1e', axeId: 'axe1', code: 'T1E', nom: 'Riviera → Palm Beach',       ordre: 5, dist: '3.2 km', coordinates: [[5.2430,-3.9610],[5.2420,-3.9580]] },
  { id: 't2a', axeId: 'axe2', code: 'T2A', nom: 'Toyota CFAO → Aghien',      ordre: 1, dist: '3.2 km', coordinates: [[5.2810,-4.0140],[5.2700,-4.0000]] },
  { id: 't2b', axeId: 'axe2', code: 'T2B', nom: 'Aghien → Marcory',          ordre: 2, dist: '3.5 km', coordinates: [[5.2700,-4.0000],[5.2560,-3.9900]] },
  { id: 't2c', axeId: 'axe2', code: 'T2C', nom: 'Marcory → Palm Beach',      ordre: 3, dist: '2.9 km', coordinates: [[5.2560,-3.9900],[5.2420,-3.9580]] },
  { id: 't3a', axeId: 'axe3', code: 'T3A', nom: 'SODECI → Koumassi',         ordre: 1, dist: '2.8 km', coordinates: [[5.2710,-4.0030],[5.2620,-3.9900]] },
  { id: 't3b', axeId: 'axe3', code: 'T3B', nom: 'Koumassi → Port Bouët',     ordre: 2, dist: '2.9 km', coordinates: [[5.2620,-3.9900],[5.2520,-3.9750]] },
  { id: 't3c', axeId: 'axe3', code: 'T3C', nom: 'Port Bouët → Palm Beach',   ordre: 3, dist: '2.7 km', coordinates: [[5.2520,-3.9750],[5.2420,-3.9580]] },
]

export const DEFAULT_SEUILS = DEFAULT_AXES.map(a => ({
  axeId:       a.id,
  shortNom:    a.shortNom,
  tRef:        a.tRef,
  seuilOrange: Math.round(a.tRef * 1.4),
  seuilRouge:  Math.round(a.tRef * 1.8),
}))

// Couleurs carte par axe (index = num - 1)
export const AXE_COLORS = ['#1B4F8A', '#E67E22', '#27AE60']
