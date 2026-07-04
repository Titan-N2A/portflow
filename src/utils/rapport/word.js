// ============================================================
// rapport/word.js — Génération du rapport Word (.docx)
// La page de garde et le sommaire proviennent du gabarit
// public/rapport_template.docx, dérivé à l'identique du
// document officiel « RAPPORT xxxx.docx » (DEESP). Le corps est
// injecté via patchDocument ({{type}}, {{date}}, {{corps}}).
// Le sommaire est un vrai champ TOC actualisé à l'ouverture.
// ============================================================

import {
  patchDocument, PatchType, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, ShadingType, VerticalAlign,
} from 'docx'
import { CHARTE, NIVEAU_LABELS, fmt, fmtMin, fmtRetard } from './commun'
import { graphiqueIndicateurAxe, graphiqueComparaisonAxes, dataUrlVersOctets } from './graphiques'

const FONTE = 'Garamond'
const CORPS = 24        // 12 pt (demi-points)
const INTERLIGNE = 276  // 1,15

// ── Briques de mise en forme ─────────────────────────────────
function par(texte, { bold = false, italic = false, color = CHARTE.texte, size = CORPS, align = AlignmentType.JUSTIFIED, after = 160, before = 0 } = {}) {
  return new Paragraph({
    alignment: align,
    spacing: { after, before, line: INTERLIGNE },
    children: [new TextRun({ text: texte, font: FONTE, size, bold, italics: italic, color })],
  })
}
function titre1(texte) { return new Paragraph({ style: 'Titre1', spacing: { before: 360, after: 200 }, children: [new TextRun({ text: texte, font: FONTE })] }) }
function titre2(texte) { return new Paragraph({ style: 'Titre2', spacing: { before: 280, after: 160 }, children: [new TextRun({ text: texte, font: FONTE })] }) }
function titre3(texte) { return new Paragraph({ style: 'Titre3', spacing: { before: 220, after: 120 }, children: [new TextRun({ text: texte, font: FONTE })] }) }

const bordFin = { style: BorderStyle.SINGLE, size: 4, color: CHARTE.grisClair }
const BORDS = { top: bordFin, bottom: bordFin, left: bordFin, right: bordFin }

function cellule(texte, { entete = false, alt = false, droite = false, gras = false } = {}) {
  return new TableCell({
    borders: BORDS,
    verticalAlign: VerticalAlign.CENTER,
    shading: { fill: entete ? CHARTE.bleuOcean : alt ? CHARTE.bleuClair : 'FFFFFF', type: ShadingType.CLEAR },
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [new Paragraph({
      alignment: entete ? AlignmentType.CENTER : droite ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { after: 0 },
      children: [new TextRun({
        text: String(texte),
        font: FONTE, size: entete ? 22 : 22,
        bold: entete || gras,
        color: entete ? 'FFFFFF' : CHARTE.texte,
      })],
    })],
  })
}

/**
 * Tableau charté : en-tête bleu océan / texte blanc, lignes
 * alternées bleu très clair, chiffres alignés à droite.
 * `droites` : indices des colonnes numériques.
 */
function tableau(entetes, lignes, largeurs, droites = []) {
  return new Table({
    width: { size: 9072, type: WidthType.DXA },
    columnWidths: largeurs,
    rows: [
      new TableRow({ tableHeader: true, children: entetes.map(e => cellule(e, { entete: true })) }),
      ...lignes.map((l, i) => new TableRow({
        children: l.map((v, j) => cellule(v, { alt: i % 2 === 1, droite: droites.includes(j), gras: j === 0 })),
      })),
    ],
  })
}

let numFigure = 0
let numTableau = 0
function legendeTableau(texte) {
  numTableau += 1
  return par(`Tableau ${numTableau} — ${texte}`, { italic: true, size: 20, color: CHARTE.gris, align: AlignmentType.LEFT, after: 80 })
}
function figure(dataUrl, legende) {
  if (!dataUrl) return [par(`(Graphique indisponible : aucun relevé horodaté sur la période.)`, { italic: true, size: 20, color: CHARTE.gris })]
  numFigure += 1
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({
        type: 'png',
        data: dataUrlVersOctets(dataUrl),
        transformation: { width: 600, height: 285 },
      })],
    }),
    par(`Figure ${numFigure} — ${legende}`, { italic: true, size: 20, color: CHARTE.gris, align: AlignmentType.CENTER, after: 200 }),
  ]
}

// ── Sous-section « un axe × un indicateur » ──────────────────
function blocAxeIndicateur(axe, indicateur) {
  const cle = { min: 'min', moyen: 'moy', max: 'max' }[indicateur]
  const nomIndic = { min: 'temps minimal', moyen: 'temps moyen', max: 'temps maximal' }[indicateur]
  const enfants = [titre3(`${axe.lettre}. Axe « ${axe.nomComplet} »`)]

  if (axe.serie) {
    enfants.push(legendeTableau(`${nomIndic} de traversée par ${axe.serie.parJour ? 'jour' : 'créneau horaire'} — axe ${axe.axe} (minutes)`))
    enfants.push(tableau(
      [axe.serie.uniteLabel, `${nomIndic.charAt(0).toUpperCase() + nomIndic.slice(1)} (min)`, 'Écart vs référence (min)', 'Relevés'],
      axe.serie.buckets.map(b => [
        b.label,
        fmt(b[cle]),
        fmtRetard(Math.round((b[cle] - axe.tRef) * 10) / 10).replace(' min', ''),
        String(b.n),
      ]),
      [2000, 2600, 2872, 1600],
      [1, 2, 3],
    ))
    enfants.push(...figure(
      graphiqueIndicateurAxe(axe.serie, axe, cle),
      `Évolution du ${nomIndic} de traversée — axe ${axe.nomComplet} (${axe.serie.parJour ? 'par jour' : 'par heure'}, période du rapport).`,
    ))
  } else {
    enfants.push(legendeTableau(`${nomIndic} de traversée — axe ${axe.axe} (mesure en temps réel)`))
    enfants.push(tableau(
      ['Temps de référence', 'Valeur observée', 'Écart', 'Source'],
      [[fmtMin(axe.tRef), fmtMin({ min: axe.tMin, moyen: axe.tMoyen, max: axe.tMax }[indicateur]), fmtRetard({ min: axe.tMin, moyen: axe.tMoyen, max: axe.tMax }[indicateur] - axe.tRef), 'Mesure live']],
      [2300, 2300, 2236, 2236],
      [0, 1, 2],
    ))
  }
  enfants.push(par(axe.interpretations[indicateur]))
  return enfants
}

// ── Génération complète ───────────────────────────────────────
export async function telechargerWord(rapport, modele) {
  numFigure = 0
  numTableau = 0
  const m = modele
  const gabarit = await fetch(`${import.meta.env.BASE_URL}rapport_template.docx`)
  if (!gabarit.ok) throw new Error('Gabarit rapport_template.docx introuvable')
  const gabaritOctets = await gabarit.arrayBuffer()

  const corps = [
    // 3. Résumé exécutif
    titre1('RESUME EXECUTIF'),
    ...m.resumeExecutif.map(t => par(t)),
    legendeTableau('synthèse des indicateurs par axe (sens aller, minutes)'),
    tableau(
      ['Axe', 'T. réf.', 'T. min.', 'T. moyen', 'T. max.', 'Retard moy.', 'Niveau', 'Vitesse', 'Relevés'],
      m.axes.map(a => [
        a.axe, fmt(a.tRef), fmt(a.tMin), fmt(a.tMoyen), fmt(a.tMax),
        fmtRetard(a.retard).replace(' min', ''), NIVEAU_LABELS[a.niveau],
        `${fmt(a.vitesse)} km/h`, a.nbMesures > 0 ? String(a.nbMesures) : 'live',
      ]),
      [1700, 850, 850, 950, 850, 1100, 1300, 1100, 372],
      [1, 2, 3, 4, 5, 7, 8],
    ),

    // 4. Introduction et contexte
    titre1('INTRODUCTION ET CONTEXTE'),
    ...m.introduction.map(t => par(t)),

    // 5. Méthodologie
    titre1('I. METHODOLOGIE'),
    titre2('1. Sources de données'),
    par(m.methodologie.sources),
    titre2('2. Dispositif de collecte automatique'),
    par(m.methodologie.collecte),
    titre2('3. Période couverte'),
    par(m.methodologie.periode),
    titre2('4. Axes surveillés'),
    par(m.methodologie.axes),
    titre2('5. Définition des indicateurs'),
    par(m.methodologie.indicateurs),

    // 6. Résultats et analyse — par indicateur puis par axe
    titre1('II. EVALUATION DU TEMPS DE TRAVERSEE DE LA ZONE PORTUAIRE'),
    titre2('1. Détermination du temps minimal de traversée'),
    ...m.axes.flatMap(a => blocAxeIndicateur(a, 'min')),
    titre2('2. Détermination du temps moyen de traversée'),
    ...m.axes.flatMap(a => blocAxeIndicateur(a, 'moyen')),
    titre2('3. Détermination du temps maximal de traversée'),
    ...m.axes.flatMap(a => blocAxeIndicateur(a, 'max')),

    // 7. Interprétation transversale
    titre1('III. INTERPRETATION TRANSVERSALE'),
    ...figure(
      graphiqueComparaisonAxes(m.axes),
      'Temps de traversée par axe : minimum, moyenne et maximum sur la période.',
    ),
    ...m.transversal.map(t => par(t)),

    // 8. Recommandations
    titre1('IV. RECOMMANDATIONS'),
    ...m.recommandations.flatMap((r, i) => [
      titre3(`${i + 1}. ${r.titre}`),
      par(r.corps),
    ]),

    // 9. Conclusion
    titre1('CONCLUSION'),
    ...m.conclusion.map(t => par(t)),
    par(`Validé par : Direction des Études Économiques, de la Stratégie et de la Planification — Département Études Économiques et Financières.`, { after: 60 }),
    par(`Date : ${rapport.date.toLocaleDateString('fr-FR')} — Signature et cachet :`, { after: 400 }),

    // 10. Annexes
    titre1('ANNEXES'),
    titre2('Annexe 1 — Grille des niveaux de service'),
    legendeTableau('grille de qualification du niveau de service (ratio = temps moyen / temps de référence)'),
    tableau(
      ['Niveau', 'Qualification', 'Ratio', 'Lecture'],
      [
        ['N1', 'Fluide',            '≤ 1,10',      'Conditions optimales, pas de retard notable'],
        ['N2', 'Bon',               '1,10 – 1,25', 'Légère dégradation, surveillance simple'],
        ['N3', 'Ralenti',           '1,25 – 1,50', 'Ralentissements, mesures préventives'],
        ['N4', 'Congestionné',      '1,50 – 2,00', 'Congestion, actions correctives requises'],
        ['N5', 'Très congestionné', '> 2,00',      'Crise trafic, intervention d\'urgence'],
      ],
      [1100, 2400, 1700, 3872],
    ),
    titre2('Annexe 2 — Temps de référence et seuils d\'alerte par axe'),
    legendeTableau('seuils d\'alerte calculés depuis le temps de référence de chaque axe (orange : × 1,4 ; rouge : × 1,8)'),
    tableau(
      ['Axe', 'T. de référence', 'Seuil orange', 'Seuil rouge'],
      m.axes.map(a => [a.nomComplet, fmtMin(a.tRef), fmtMin(Math.round(a.tRef * 1.4)), fmtMin(Math.round(a.tRef * 1.8))]),
      [3872, 1800, 1700, 1700],
      [1, 2, 3],
    ),
    titre2('Annexe 3 — Outillage d\'analyse prédictive'),
    par(m.ml
      ? `Le système FlowPort embarque un modèle de prévision de niveau de trafic (${m.ml.modele}, précision de ${fmt(m.ml.accuracy * 100, 1)} % en validation), ` +
        `entraîné sur une base de mesures réelles (${m.ml.note}). Ses sorties alimentent les alertes prédictives du tableau de bord ; ` +
        `elles sont citées dans le présent rapport à titre d'éclairage et ne se substituent pas aux mesures constatées.`
      : `Métadonnées du modèle prédictif indisponibles à la génération. [À COMPLÉTER]`),
    par(`Document généré automatiquement par FlowPort (référence ${m.reference}) le ${m.genereLe}. Source des mesures : ${m.sourceLabel}.`,
      { italic: true, size: 20, color: CHARTE.gris }),
  ]

  const blob = await patchDocument({
    outputType: 'blob',
    data: gabaritOctets,
    keepOriginalStyles: true,
    patches: {
      type: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun({ text: m.typeLabel, font: 'Times New Roman', size: 36, bold: true })],
      },
      date: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun({ text: m.numero, font: 'Times New Roman', size: 36 })],
      },
      corps: { type: PatchType.DOCUMENT, children: corps },
    },
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${rapport.nom}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
