// ============================================================
// rapport/excel.js — Génération du classeur Excel (.xlsx)
// ExcelJS (chargé à la demande) : en-têtes fond #0E4C74 texte
// blanc figés, lignes alternées #E8F3FA, bordures fines,
// nombres au dixième de minute, colonnes ajustées.
// Feuilles : Synthèse · Temps minimal · Temps moyen ·
// Temps maximal · Données brutes.
// ============================================================

import { CHARTE, NIVEAU_LABELS, SOUS_TITRE, fmt } from './commun'

const OCEAN = `FF${CHARTE.bleuOcean}`
const CLAIR = `FF${CHARTE.bleuClair}`
const GRIS  = `FF${CHARTE.gris}`
const BORD  = { style: 'thin', color: { argb: `FF${CHARTE.grisClair}` } }
const BORDS = { top: BORD, bottom: BORD, left: BORD, right: BORD }

const POLICE_TITRE  = { name: 'Garamond', size: 15, bold: true, color: { argb: `FF${CHARTE.bleuOcean}` } }
const POLICE_SOUS   = { name: 'Garamond', size: 11, italic: true, color: { argb: GRIS } }
const POLICE_DONNEE = { name: 'Calibri', size: 10 }

function ligneTitre(ws, ref, texte, police, nbCols) {
  const cell = ws.getCell(ref)
  ws.mergeCells(`${ref}:${String.fromCharCode(64 + nbCols)}${ref.slice(1)}`)
  cell.value = texte
  cell.font = police
}

/** Écrit un tableau charté ; renvoie le numéro de la dernière ligne. */
function tableauExcel(ws, ligneDebut, entetes, lignes, { droites = [], formats = {} } = {}) {
  const le = ws.getRow(ligneDebut)
  entetes.forEach((e, i) => {
    const c = le.getCell(i + 1)
    c.value = e
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OCEAN } }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.border = BORDS
  })
  le.height = 22
  lignes.forEach((l, li) => {
    const r = ws.getRow(ligneDebut + 1 + li)
    l.forEach((v, i) => {
      const c = r.getCell(i + 1)
      c.value = v
      c.font = POLICE_DONNEE
      if (li % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CLAIR } }
      c.border = BORDS
      c.alignment = { horizontal: droites.includes(i) ? 'right' : 'left', vertical: 'middle' }
      if (formats[i] && typeof v === 'number') c.numFmt = formats[i]
    })
  })
  return ligneDebut + lignes.length
}

function ajusterColonnes(ws, minimums = []) {
  ws.columns.forEach((col, i) => {
    let max = minimums[i] ?? 8
    col.eachCell({ includeEmpty: false }, cell => {
      const l = String(cell.value ?? '').length
      if (l > max) max = l
    })
    col.width = Math.min(max + 3, 52)
  })
}

export async function telechargerExcel(rapport, m) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = "FlowPort — Port Autonome d'Abidjan"
  wb.created = rapport.date

  // ── Feuille 1 : Synthèse ────────────────────────────────────
  const ws = wb.addWorksheet('Synthèse', { views: [{ state: 'frozen', ySplit: 10 }] })
  ligneTitre(ws, 'A1', `${m.titre} — ${SOUS_TITRE}`, POLICE_TITRE, 10)
  ligneTitre(ws, 'A2', `Port Autonome d'Abidjan — Direction des Études Économiques, de la Stratégie et de la Planification (réf. ${m.reference})`, POLICE_SOUS, 10)
  ligneTitre(ws, 'A3', `Période : ${m.periodeLabel} — généré le ${m.genereLe} — ${m.sourceLabel}`, POLICE_SOUS, 10)

  const infoDeb = 5
  const infos = [
    ['Niveau global du réseau', m.stats.nGlobalLabel],
    ['Ratio moyen (temps moyen / référence)', Math.round(m.stats.avgRatio * 100) / 100],
    ['Retard moyen global (min)', m.stats.retardGlobal],
    ['Axes au-delà du seuil orange', `${m.stats.nbDeg} / ${m.stats.nbAxes}`],
  ]
  infos.forEach(([lbl, val], i) => {
    const r = ws.getRow(infoDeb + i)
    r.getCell(1).value = lbl
    r.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${CHARTE.bleuOcean}` } }
    r.getCell(2).value = val
    r.getCell(2).font = POLICE_DONNEE
    if (typeof val === 'number') r.getCell(2).numFmt = '0.00'
  })

  tableauExcel(ws, 10,
    ['Axe', 'T. réf. (min)', 'T. min. (min)', 'T. moyen (min)', 'T. max. (min)', 'Retard moy. (min)', 'Ratio', 'Niveau', 'Vitesse (km/h)', 'Relevés'],
    m.axes.map(a => [
      a.nomComplet, a.tRef, a.tMin, a.tMoyen, a.tMax, a.retard,
      Math.round((a.tRef > 0 ? a.tMoyen / a.tRef : 1) * 100) / 100,
      NIVEAU_LABELS[a.niveau], a.vitesse, a.nbMesures > 0 ? a.nbMesures : 'live',
    ]),
    { droites: [1, 2, 3, 4, 5, 6, 8, 9], formats: { 1: '0.0', 2: '0.0', 3: '0.0', 4: '0.0', 5: '+0.0;−0.0', 6: '0.00', 8: '0.0' } },
  )
  ajusterColonnes(ws, [30])

  // ── Feuilles 2 à 4 : une par indicateur ─────────────────────
  const indicateurs = [
    { nomFeuille: 'Temps minimal', cle: 'min',  champ: 'tMin' },
    { nomFeuille: 'Temps moyen',   cle: 'moy',  champ: 'tMoyen' },
    { nomFeuille: 'Temps maximal', cle: 'max',  champ: 'tMax' },
  ]
  const labelsSerie = [...new Set(m.axes.flatMap(a => a.serie?.buckets.map(b => b.label) ?? []))]
  const uniteLabel = m.axes.find(a => a.serie)?.serie.uniteLabel ?? 'Créneau'

  indicateurs.forEach(ind => {
    const wsI = wb.addWorksheet(ind.nomFeuille, { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] })
    ligneTitre(wsI, 'A1', `${ind.nomFeuille} de traversée par axe (minutes) — ${m.periodeLabel}`, POLICE_TITRE, 1 + m.axes.length)
    ligneTitre(wsI, 'A2', `Valeurs réelles issues des relevés automatiques TomTom (sens aller). Temps de référence : ${m.axes.map(a => `${a.axe} ${fmt(a.tRef)} min`).join(' · ')}.`, POLICE_SOUS, 1 + m.axes.length)

    const lignes = labelsSerie.length > 0
      ? labelsSerie.map(lbl => [
          lbl,
          ...m.axes.map(a => a.serie?.buckets.find(b => b.label === lbl)?.[ind.cle] ?? null),
        ])
      : []
    lignes.push([
      labelsSerie.length > 0 ? 'Ensemble de la période' : 'Mesure disponible (live)',
      ...m.axes.map(a => a[ind.champ]),
    ])
    const fin = tableauExcel(wsI, 4,
      [uniteLabel, ...m.axes.map(a => a.axe)],
      lignes,
      { droites: m.axes.map((_, i) => i + 1), formats: Object.fromEntries(m.axes.map((_, i) => [i + 1, '0.0'])) },
    )
    // Dernière ligne (bilan de période) en gras
    const rBilan = wsI.getRow(fin)
    rBilan.eachCell(c => { c.font = { ...POLICE_DONNEE, bold: true } })
    ajusterColonnes(wsI, [22])
  })

  // ── Feuille 5 : Données brutes ──────────────────────────────
  const wsB = wb.addWorksheet('Données brutes', { views: [{ state: 'frozen', ySplit: 4 }] })
  ligneTitre(wsB, 'A1', `Relevés bruts de la collecte automatique — ${m.periodeLabel}`, POLICE_TITRE, 8)
  ligneTitre(wsB, 'A2', `${m.records.length} relevés (collection collecte_auto, source TomTom, un relevé toutes les 5 minutes).`, POLICE_SOUS, 8)
  const nomParAxe = Object.fromEntries(m.axes.map(a => [a.axeId, a.axe]))
  const bruts = [...m.records]
    .sort((a, b) => (a.date + String(a.heure).padStart(2, '0') + a.axeId) < (b.date + String(b.heure).padStart(2, '0') + b.axeId) ? -1 : 1)
    .map(r => [
      r.date ?? '', typeof r.heure === 'number' ? `${String(r.heure).padStart(2, '0')}h` : '',
      nomParAxe[r.axeId] ?? r.axeId, r.sens ?? '',
      typeof r.temps_min === 'number' ? Math.round(r.temps_min * 10) / 10 : null,
      typeof r.niveau === 'number' ? r.niveau : null,
      typeof r.vitesse === 'number' ? r.vitesse : null,
      typeof r.retard === 'number' ? r.retard : null,
    ])
  tableauExcel(wsB, 4,
    ['Date', 'Heure', 'Axe', 'Sens', 'Temps (min)', 'Niveau (1-5)', 'Vitesse (km/h)', 'Retard (min)'],
    bruts.length > 0 ? bruts : [['—', '—', '—', '—', null, null, null, null]],
    { droites: [4, 5, 6, 7], formats: { 4: '0.0', 6: '0.0', 7: '+0.0;−0.0' } },
  )
  ajusterColonnes(wsB, [12, 7, 16])

  // ── Téléchargement (nom de fichier inchangé) ────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${rapport.nom}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
