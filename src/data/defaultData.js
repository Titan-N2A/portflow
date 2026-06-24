// ══════════════════════════════════════════════════════════
// Source unique de vérité pour les données par défaut PAA.
// Utilisée pour le seed Firestore au premier démarrage
// ET comme fallback si Firestore est indisponible.
// ══════════════════════════════════════════════════════════

export const DEFAULT_AXES = [
  {
    id: 'axe1', num: 1,
    nom:      'CARENA (Riviera) → Port Autonome d\'Abidjan',
    shortNom: 'CARENA',
    distance: '16.8 km',
    tRef:     27.4,
    ordre:    1,
    actif:    true,
    troncons: ['T1A', 'T1B', 'T1C', 'T1D', 'T1E'],
    // Géométrie réelle TomTom (route longeant les rues d'Abidjan)
    coordinates: [
      [5.34538,-3.95998],[5.34772,-3.95516],[5.34587,-3.95265],[5.34447,-3.96035],
      [5.33826,-3.96768],[5.33635,-3.9713],[5.33774,-3.97574],[5.33808,-3.97665],
      [5.34006,-3.98206],[5.3393,-3.98338],[5.33324,-3.98302],[5.32401,-3.9807],
      [5.3064,-3.97928],[5.3039,-3.97716],[5.30186,-3.97664],[5.29889,-3.97924],
      [5.29679,-3.98136],[5.29554,-3.98192],[5.293,-3.98243],[5.28441,-3.98388],
      [5.28693,-3.98665],[5.28773,-3.9873],[5.28999,-3.99209],[5.29406,-4.00117],
      [5.2954,-4.00368],[5.29512,-4.00403],[5.28983,-4.0092],[5.2906,-4.01166],[5.28734,-4.01302],
    ],
    start: [5.3450, -3.9600],
  },
  {
    id: 'axe2', num: 2,
    nom:      'Toyota CFAO (Cocody) → Port Autonome d\'Abidjan',
    shortNom: 'Toyota CFAO',
    distance: '9.0 km',
    tRef:     16.9,
    ordre:    2,
    actif:    true,
    troncons: ['T2A', 'T2B', 'T2C'],
    coordinates: [
      [5.31,-3.96508],[5.30751,-3.9664],[5.30758,-3.97084],[5.30701,-3.9739],
      [5.30563,-3.9763],[5.30395,-3.97614],[5.30204,-3.97632],[5.30126,-3.97701],
      [5.29937,-3.97834],[5.29846,-3.98015],[5.29711,-3.98106],[5.29567,-3.98189],
      [5.29366,-3.98241],[5.28726,-3.98266],[5.28441,-3.98388],[5.2837,-3.9846],
      [5.28718,-3.98684],[5.28769,-3.98716],[5.28976,-3.99178],[5.29006,-3.99215],
      [5.29338,-3.99976],[5.29514,-4.00347],[5.29512,-4.00403],[5.29006,-4.00979],
      [5.29074,-4.01156],[5.28734,-4.01302],
    ],
    start: [5.3100, -3.9650],
  },
  {
    id: 'axe3', num: 3,
    nom:      'Agence SODECI (Marcory) → Port Autonome d\'Abidjan',
    shortNom: 'Agence SODECI',
    distance: '8.2 km',
    tRef:     17.8,
    ordre:    3,
    actif:    true,
    troncons: ['T3A', 'T3B', 'T3C'],
    coordinates: [
      [5.29,-3.96501],[5.28848,-3.96917],[5.29012,-3.97114],[5.29146,-3.97298],
      [5.29471,-3.97885],[5.29617,-3.98149],[5.29554,-3.98192],[5.29459,-3.9824],
      [5.29369,-3.98242],[5.28885,-3.98259],[5.28649,-3.98277],[5.2836,-3.98442],
      [5.28479,-3.98529],[5.2875,-3.98713],[5.28769,-3.98716],[5.28934,-3.99022],
      [5.28999,-3.99209],[5.29072,-3.99437],[5.29338,-3.99976],[5.29508,-4.00346],
      [5.29379,-4.0082],[5.29006,-4.00979],[5.29074,-4.01154],[5.28734,-4.01302],
    ],
    start: [5.2900, -3.9650],
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

// Couleurs carte par axe — objet indexé par axeId
export const AXE_COLORS = {
  axe1: '#1B4F8A',
  axe2: '#E67E22',
  axe3: '#27AE60',
}
