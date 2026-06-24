export const C = {
  // Sidebar
  sidebar:       '#0A2342',
  sidebarActive: '#1B4F8A',
  sidebarHover:  'rgba(255,255,255,0.07)',
  sidebarText:   'rgba(255,255,255,0.85)',
  sidebarMuted:  'rgba(255,255,255,0.45)',
  sidebarBorder: 'rgba(255,255,255,0.1)',

  // Page / cards
  bg:            '#F4F4F4',
  white:         '#FFFFFF',
  border:        '#E2E8F0',
  borderLight:   '#F0F4F8',

  // Boutons
  primary:       '#1B4F8A',
  primaryHover:  '#164076',
  danger:        '#C0392B',
  warning:       '#E67E22',
  success:       '#27AE60',

  // Texte
  text:          '#2C3E50',
  textMuted:     '#7F8C8D',
  textLight:     '#95A5A6',

  // Niveaux de congestion
  n1: '#1E8449',
  n2: '#27AE60',
  n3: '#F1C40F',
  n4: '#E67E22',
  n5: '#C0392B',
}

export function levelColor(n) {
  return [C.n1, C.n1, C.n2, C.n3, C.n4, C.n5][n] ?? C.textMuted
}

export function levelLabel(n) {
  return ['', 'Fluide', 'Bon', 'Ralenti', 'Congestionné', 'Très congestionné'][n] ?? 'Inconnu'
}

export function levelBg(n) {
  const colors = { 1: '#d5f5e3', 2: '#d5f5e3', 3: '#fef9c3', 4: '#fdebd0', 5: '#fdecea' }
  return colors[n] ?? '#f0f0f0'
}
