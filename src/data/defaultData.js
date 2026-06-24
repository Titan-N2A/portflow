// ══════════════════════════════════════════════════════════
// Source unique de vérité pour les données par défaut PAA.
// Utilisée pour le seed Firestore au premier démarrage
// ET comme fallback si Firestore est indisponible.
// ══════════════════════════════════════════════════════════

// Destination commune des 3 axes : Pharmacie Palm Beach, Abidjan
export const PALM_BEACH = [5.350997, -4.006838]

export const DEFAULT_AXES = [
  {
    id: 'axe1', num: 1,
    nom:      'CARENA → Pharmacie Palm Beach',
    shortNom: 'CARENA',
    distance: '12.1 km',
    tRef:     27.4,
    ordre:    1,
    actif:    true,
    troncons: ['T1A', 'T1B', 'T1C', 'T1D', 'T1E'],
    // Géométrie TomTom réelle : CARENA (Vridi) → Palm Beach
    coordinates: [
      [5.28226,-4.00842],[5.28949,-4.00836],[5.29424,-4.00662],[5.29488,-4.00394],
      [5.29504,-4.00347],[5.29676,-3.99954],[5.29833,-3.99453],[5.3004,-3.99366],
      [5.3022,-3.99403],[5.30447,-3.99508],[5.30632,-3.99682],[5.30811,-3.99902],
      [5.31103,-4.00554],[5.31193,-4.00729],[5.31399,-4.00879],[5.31806,-4.01142],
      [5.3187,-4.01127],[5.32085,-4.01065],[5.32218,-4.01247],[5.32653,-4.0162],
      [5.33147,-4.01857],[5.33577,-4.01847],[5.33936,-4.01777],[5.34254,-4.0176],
      [5.34679,-4.01425],[5.35122,-4.01358],[5.35384,-4.01261],[5.35411,-4.00654],
      [5.35099,-4.00674],[5.35097,-4.00675],
    ],
    start: [5.28226, -4.00842],
  },
  {
    id: 'axe2', num: 2,
    nom:      'Toyota CFAO → Pharmacie Palm Beach',
    shortNom: 'Toyota CFAO',
    distance: '10.4 km',
    tRef:     16.9,
    ordre:    2,
    actif:    true,
    troncons: ['T2A', 'T2B', 'T2C'],
    // Géométrie TomTom réelle : CFAO Motors → Palm Beach
    coordinates: [
      [5.29248,-3.99628],[5.29153,-3.99495],[5.29027,-3.99344],[5.28982,-3.9924],
      [5.28988,-3.99207],[5.29006,-3.99215],[5.2947,-3.99286],[5.3004,-3.99366],
      [5.30198,-3.99398],[5.30371,-3.99466],[5.30562,-3.99605],[5.30772,-3.99834],
      [5.30899,-4.00076],[5.3112,-4.00595],[5.31193,-4.00729],[5.31376,-4.00864],
      [5.31789,-4.01136],[5.3183,-4.01143],[5.31997,-4.0105],[5.32092,-4.01069],
      [5.32218,-4.01247],[5.32385,-4.01449],[5.33045,-4.01851],[5.33807,-4.01783],
      [5.34085,-4.01772],[5.34406,-4.01695],[5.34642,-4.01455],[5.35238,-4.01349],
      [5.35398,-4.01241],[5.35414,-4.0065],[5.35097,-4.00675],
    ],
    start: [5.29248, -3.99628],
  },
  {
    id: 'axe3', num: 3,
    nom:      'Agence SODECI → Pharmacie Palm Beach',
    shortNom: 'Agence SODECI',
    distance: '17.1 km',
    tRef:     17.8,
    ordre:    3,
    actif:    true,
    troncons: ['T3A', 'T3B', 'T3C'],
    // Géométrie TomTom réelle : SODECI (Vridi) → Palm Beach
    coordinates: [
      [5.25869,-3.98173],[5.25975,-3.98333],[5.25995,-3.98421],[5.26502,-3.9898],
      [5.26476,-3.99093],[5.26371,-3.9974],[5.26345,-3.99867],[5.2686,-4.00407],
      [5.27181,-4.00715],[5.27446,-4.00848],[5.28729,-4.00838],[5.29391,-4.00776],
      [5.29488,-4.00394],[5.29567,-4.00225],[5.29832,-3.99487],[5.30113,-3.99377],
      [5.30301,-3.99432],[5.30602,-3.99648],[5.30811,-3.99902],[5.31126,-4.00612],
      [5.31291,-4.00807],[5.31792,-4.01138],[5.32008,-4.0105],[5.32653,-4.0162],
      [5.33258,-4.01856],[5.33824,-4.01781],[5.34199,-4.01765],[5.34416,-4.01686],
      [5.34712,-4.01407],[5.35295,-4.01332],[5.35417,-4.012],[5.35097,-4.00675],
    ],
    start: [5.25869, -3.98173],
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
