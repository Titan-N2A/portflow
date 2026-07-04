// ============================================================
// rapport/pdf.js — Génération du rapport PDF (gabarit DEESP-RF-01)
// Même charte et même structure que le Word : page de garde
// reprise du document officiel (logo, en-tête Direction,
// bordure double #0E4C74), corps en EB Garamond 12 pt justifié,
// sommaire, tableaux chartés et graphiques haute résolution.
// ============================================================

import jsPDF from 'jspdf'
import fonteRegUrl from '../../assets/fonts/EBGaramond-Regular.ttf'
import fonteGrasUrl from '../../assets/fonts/EBGaramond-Bold.ttf'
import fonteItalUrl from '../../assets/fonts/EBGaramond-Italic.ttf'
import logoRapportUrl from '../../assets/rapport_logo.png'
import { NIVEAU_LABELS, DIRECTION, DEPARTEMENT, fmt, fmtMin, fmtRetard } from './commun'
import { graphiqueIndicateurAxe, graphiqueComparaisonAxes } from './graphiques'

// ── Géométrie (A4 portrait, mm) ──────────────────────────────
const PW = 210, PH = 297
const ML = 20, CW = PW - 2 * ML   // marges latérales / largeur utile
const YMIN = 22, YMAX = 270       // zone de contenu (bordure + pied de page)

// ── Charte ────────────────────────────────────────────────────
const OCEAN  = [14, 76, 116]      // #0E4C74
const LAGUNE = [26, 111, 168]     // #1A6FA8
const CLAIR  = [232, 243, 250]    // #E8F3FA
const TEXTE  = [43, 43, 43]
const GRIS   = [89, 89, 89]
const BORDT  = [185, 205, 220]    // bordures fines tableaux

// ── Chargement des ressources (une seule fois par session) ───
let _ressources = null
async function chargerB64(url) {
  const buf = await (await fetch(url)).arrayBuffer()
  const u8 = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000))
  }
  return btoa(s)
}
async function chargerRessources() {
  if (_ressources) return _ressources
  const [reg, gras, ital, logo] = await Promise.all([
    chargerB64(fonteRegUrl), chargerB64(fonteGrasUrl), chargerB64(fonteItalUrl), chargerB64(logoRapportUrl),
  ])
  _ressources = { reg, gras, ital, logo: `data:image/png;base64,${logo}` }
  return _ressources
}
function installerFontes(doc, r) {
  doc.addFileToVFS('EBGaramond-Regular.ttf', r.reg)
  doc.addFileToVFS('EBGaramond-Bold.ttf', r.gras)
  doc.addFileToVFS('EBGaramond-Italic.ttf', r.ital)
  doc.addFont('EBGaramond-Regular.ttf', 'EBGaramond', 'normal')
  doc.addFont('EBGaramond-Bold.ttf', 'EBGaramond', 'bold')
  doc.addFont('EBGaramond-Italic.ttf', 'EBGaramond', 'italic')
}

// ── Contexte de rendu ─────────────────────────────────────────
function creerCtx(doc) {
  return { doc, y: YMIN, sommaire: [], numFigure: 0, numTableau: 0 }
}
function nouvellePage(ctx) {
  ctx.doc.addPage()
  ctx.y = YMIN
}
function reserver(ctx, hauteur) {
  if (ctx.y + hauteur > YMAX) nouvellePage(ctx)
}

// ── Briques typographiques (Garamond partout) ────────────────
function h1(ctx, texte) {
  reserver(ctx, 24)
  ctx.sommaire.push({ niveau: 1, texte, page: ctx.doc.internal.getCurrentPageInfo().pageNumber })
  const { doc } = ctx
  ctx.y += 6
  doc.setFont('EBGaramond', 'bold'); doc.setFontSize(16); doc.setTextColor(...OCEAN)
  doc.text(texte, ML, ctx.y)
  ctx.y += 2.2
  doc.setDrawColor(...OCEAN); doc.setLineWidth(0.5)
  doc.line(ML, ctx.y, ML + CW, ctx.y)
  ctx.y += 7
}
function h2(ctx, texte) {
  reserver(ctx, 18)
  ctx.sommaire.push({ niveau: 2, texte, page: ctx.doc.internal.getCurrentPageInfo().pageNumber })
  ctx.y += 4
  ctx.doc.setFont('EBGaramond', 'bold'); ctx.doc.setFontSize(14); ctx.doc.setTextColor(...OCEAN)
  ctx.doc.text(texte, ML, ctx.y)
  ctx.y += 7
}
function h3(ctx, texte) {
  reserver(ctx, 14)
  ctx.y += 3
  ctx.doc.setFont('EBGaramond', 'bold'); ctx.doc.setFontSize(12); ctx.doc.setTextColor(...LAGUNE)
  ctx.doc.text(texte, ML, ctx.y)
  ctx.y += 6.5
}
function paragraphe(ctx, texte, { italic = false, size = 12, couleur = TEXTE, apres = 5 } = {}) {
  const { doc } = ctx
  doc.setFont('EBGaramond', italic ? 'italic' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...couleur)
  const lignes = doc.splitTextToSize(texte, CW)
  const hLigne = size * 0.3528 * 1.15
  let i = 0
  while (i < lignes.length) {
    const dispo = Math.max(0, Math.floor((YMAX - ctx.y) / hLigne))
    if (dispo === 0) { nouvellePage(ctx); continue }
    const morceau = lignes.slice(i, i + dispo)
    doc.text(morceau.join('\n'), ML, ctx.y, { align: 'justify', maxWidth: CW, lineHeightFactor: 1.15 })
    ctx.y += morceau.length * hLigne
    i += dispo
  }
  ctx.y += apres
}
function legende(ctx, prefixe, texte) {
  paragraphe(ctx, `${prefixe} — ${texte}`, { italic: true, size: 9.5, couleur: GRIS, apres: 2 })
}

// ── Tableau charté avec coupure de page ──────────────────────
function tableauPdf(ctx, entetes, lignes, largeurs, droites = [], titreLegende = null) {
  const { doc } = ctx
  const H = 7.2
  if (titreLegende) {
    ctx.numTableau += 1
    reserver(ctx, H * 2 + 8)
    legende(ctx, `Tableau ${ctx.numTableau}`, titreLegende)
  }
  const dessinerEntete = () => {
    doc.setFillColor(...OCEAN)
    doc.rect(ML, ctx.y, CW, H, 'F')
    doc.setFont('EBGaramond', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255)
    let x = ML
    entetes.forEach((e, i) => {
      const cx = droites.includes(i) ? x + largeurs[i] - 2 : x + largeurs[i] / 2
      doc.text(String(e), cx, ctx.y + 4.8, { align: droites.includes(i) ? 'right' : 'center' })
      x += largeurs[i]
    })
    ctx.y += H
  }
  reserver(ctx, H * 2)
  dessinerEntete()
  lignes.forEach((l, li) => {
    if (ctx.y + H > YMAX) { nouvellePage(ctx); dessinerEntete() }
    if (li % 2 === 1) {
      doc.setFillColor(...CLAIR)
      doc.rect(ML, ctx.y, CW, H, 'F')
    }
    doc.setDrawColor(...BORDT); doc.setLineWidth(0.15)
    doc.rect(ML, ctx.y, CW, H)
    let x = ML
    l.forEach((v, i) => {
      doc.setFont('EBGaramond', i === 0 ? 'bold' : 'normal')
      doc.setFontSize(9.5); doc.setTextColor(...TEXTE)
      if (droites.includes(i)) doc.text(String(v), x + largeurs[i] - 2, ctx.y + 4.8, { align: 'right' })
      else doc.text(String(v), x + 2, ctx.y + 4.8)
      if (i > 0) { doc.setDrawColor(...BORDT); doc.line(x, ctx.y, x, ctx.y + H) }
      x += largeurs[i]
    })
    ctx.y += H
  })
  ctx.y += 5
}

// ── Graphique inséré ──────────────────────────────────────────
function figurePdf(ctx, dataUrl, texteLegende, ratio = 760 / 1600) {
  if (!dataUrl) {
    paragraphe(ctx, '(Graphique indisponible : aucun relevé horodaté sur la période.)', { italic: true, size: 10, couleur: GRIS })
    return
  }
  const largeur = CW, hauteur = CW * ratio
  reserver(ctx, hauteur + 12)
  ctx.doc.addImage(dataUrl, 'PNG', ML, ctx.y, largeur, hauteur)
  ctx.y += hauteur + 4
  ctx.numFigure += 1
  ctx.doc.setFont('EBGaramond', 'italic'); ctx.doc.setFontSize(9.5); ctx.doc.setTextColor(...GRIS)
  ctx.doc.text(`Figure ${ctx.numFigure} — ${texteLegende}`, PW / 2, ctx.y, { align: 'center', maxWidth: CW })
  ctx.y += 8
}

// ── Sous-section « un axe × un indicateur » ──────────────────
function blocAxeIndicateur(ctx, axe, indicateur) {
  const cle = { min: 'min', moyen: 'moy', max: 'max' }[indicateur]
  const nomIndic = { min: 'temps minimal', moyen: 'temps moyen', max: 'temps maximal' }[indicateur]
  h3(ctx, `${axe.lettre}. Axe « ${axe.nomComplet} »`)
  if (axe.serie) {
    tableauPdf(ctx,
      [axe.serie.uniteLabel, `${nomIndic.charAt(0).toUpperCase() + nomIndic.slice(1)} (min)`, 'Écart vs référence (min)', 'Relevés'],
      axe.serie.buckets.map(b => [
        b.label, fmt(b[cle]),
        fmtRetard(Math.round((b[cle] - axe.tRef) * 10) / 10).replace(' min', ''),
        String(b.n),
      ]),
      [CW * 0.22, CW * 0.29, CW * 0.31, CW * 0.18],
      [1, 2, 3],
      `${nomIndic} de traversée par ${axe.serie.parJour ? 'jour' : 'créneau horaire'} — axe ${axe.axe} (minutes)`,
    )
    figurePdf(ctx,
      graphiqueIndicateurAxe(axe.serie, axe, cle),
      `Évolution du ${nomIndic} de traversée — axe ${axe.nomComplet}.`)
  } else {
    tableauPdf(ctx,
      ['Temps de référence', 'Valeur observée', 'Écart', 'Source'],
      [[fmtMin(axe.tRef), fmtMin({ min: axe.tMin, moyen: axe.tMoyen, max: axe.tMax }[indicateur]), fmtRetard({ min: axe.tMin, moyen: axe.tMoyen, max: axe.tMax }[indicateur] - axe.tRef), 'Mesure live']],
      [CW * 0.27, CW * 0.27, CW * 0.23, CW * 0.23],
      [0, 1, 2],
      `${nomIndic} de traversée — axe ${axe.axe} (mesure en temps réel)`,
    )
  }
  paragraphe(ctx, axe.interpretations[indicateur])
}

// ── Page de garde (reprise du document officiel) ─────────────
function pageDeGarde(doc, m, logo) {
  let y = 34
  // Logo PAA centré (proportions du document de référence : 210 × 227)
  doc.addImage(logo, 'PNG', PW / 2 - 16, y, 32, 34.6)
  y += 46
  doc.setFont('times', 'bold'); doc.setFontSize(14); doc.setTextColor(...TEXTE)
  doc.text("PORT AUTONOME D'ABIDJAN", PW / 2, y, { align: 'center' })
  y += 9
  doc.setFontSize(11)
  doc.text(doc.splitTextToSize(DIRECTION, CW - 20), PW / 2, y, { align: 'center' })
  y += 14
  doc.setFont('times', 'normal'); doc.setFontSize(11)
  doc.text(DEPARTEMENT, PW / 2, y, { align: 'center' })

  // Titre entre filets épais (comme la page de garde de référence)
  y += 34
  doc.setDrawColor(...OCEAN); doc.setLineWidth(1.6)
  doc.line(ML + 8, y, PW - ML - 8, y)
  y += 13
  doc.setFont('times', 'bold'); doc.setFontSize(18)
  doc.text(`RAPPORT ${m.typeLabel} N°${m.numero}`, PW / 2, y, { align: 'center' })
  y += 9
  doc.line(ML + 8, y, PW - ML - 8, y)

  y += 24
  doc.setFontSize(18)
  doc.text(doc.splitTextToSize(m.sousTitre, CW - 16), PW / 2, y, { align: 'center' })

  // Cartouche d'informations
  y += 30
  const infos = [
    ['Période analysée', m.periodeLabel],
    ['Référence du document', m.reference],
    ['Date de génération', m.genereLe],
    ['Mesures exploitées', m.sourceLabel],
    ['Axes surveillés', `${m.stats.nbAxes} axes bidirectionnels — réseau routier PAA`],
  ]
  const hCart = infos.length * 9 + 8
  doc.setFillColor(...CLAIR)
  doc.rect(ML + 10, y, CW - 20, hCart, 'F')
  doc.setDrawColor(...LAGUNE); doc.setLineWidth(0.3)
  doc.rect(ML + 10, y, CW - 20, hCart)
  infos.forEach(([lbl, val], i) => {
    const ly = y + 10 + i * 9
    doc.setFont('EBGaramond', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...OCEAN)
    doc.text(`${lbl} :`, ML + 15, ly)
    doc.setFont('EBGaramond', 'normal'); doc.setTextColor(...TEXTE)
    doc.text(doc.splitTextToSize(String(val), CW - 90), ML + 68, ly)
  })

  // Mention légale de pied de garde (reprise du pied de page officiel)
  doc.setFont('EBGaramond', 'italic'); doc.setFontSize(7.2); doc.setTextColor(...GRIS)
  doc.text(doc.splitTextToSize(
    "Port Autonome d'Abidjan, Société d'État au capital de 100.000.000.000 F CFA — siège social : Abidjan-Treichville, Rue A22 des Piroguiers, " +
    'Boulevard du Port, BP V85 Abidjan — RCCM CI-ABJ-03-2021-M-00928 — Tél : 27-21-23-80-00 — www.portabidjan.ci',
    CW - 8), PW / 2, 276, { align: 'center' })
}

// ── Sommaire (inséré en page 2 après rendu du corps) ─────────
function ecrireSommaire(doc, entrees) {
  doc.setFont('EBGaramond', 'bold'); doc.setFontSize(16); doc.setTextColor(...OCEAN)
  let y = 30
  doc.text('Sommaire', ML, y)
  doc.setDrawColor(...OCEAN); doc.setLineWidth(0.5)
  doc.line(ML, y + 2.2, ML + CW, y + 2.2)
  y += 12
  entrees.forEach(e => {
    if (y > YMAX) return   // garde-fou : le sommaire tient sur une page
    const indent = e.niveau === 1 ? 0 : 6
    doc.setFont('EBGaramond', e.niveau === 1 ? 'bold' : 'normal')
    doc.setFontSize(e.niveau === 1 ? 11.5 : 10.5)
    doc.setTextColor(...(e.niveau === 1 ? OCEAN : TEXTE))
    const texte = doc.splitTextToSize(e.texte, CW - 26)[0]
    doc.text(texte, ML + indent, y)
    // pointillés + numéro de page
    const wTexte = doc.getTextWidth(texte)
    doc.setFont('EBGaramond', 'normal'); doc.setTextColor(...GRIS)
    const xDeb = ML + indent + wTexte + 2, xFin = ML + CW - 10
    if (xFin > xDeb) {
      doc.setLineDashPattern([0.6, 1.2], 0)
      doc.setDrawColor(...GRIS); doc.setLineWidth(0.2)
      doc.line(xDeb, y - 0.8, xFin, y - 0.8)
      doc.setLineDashPattern([], 0)
    }
    doc.setFont('EBGaramond', e.niveau === 1 ? 'bold' : 'normal')
    doc.setTextColor(...TEXTE)
    doc.text(String(e.page), ML + CW, y, { align: 'right' })
    y += e.niveau === 1 ? 7.5 : 6.5
  })
}

// ── Habillage final : bordures, en-têtes, pieds de page ──────
function habillerPages(doc, m) {
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    // Bordure double #0E4C74 sur toutes les pages (charte du gabarit)
    doc.setDrawColor(...OCEAN)
    doc.setLineWidth(0.7); doc.rect(8, 8, PW - 16, PH - 16)
    doc.setLineWidth(0.25); doc.rect(9.6, 9.6, PW - 19.2, PH - 19.2)
    if (p === 1) continue
    // En-tête discret
    doc.setFont('EBGaramond', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...GRIS)
    doc.text(`${m.titre} — ${m.sousTitre}`, ML, 15)
    doc.setDrawColor(...BORDT); doc.setLineWidth(0.2)
    doc.line(ML, 17, ML + CW, 17)
    // Pied de page paginé (sauf garde)
    doc.line(ML, 279, ML + CW, 279)
    doc.setFont('EBGaramond', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...GRIS)
    doc.text(`FlowPort — Port Autonome d'Abidjan — ${m.periodeLabel}`, ML, 284)
    doc.text(`Page ${p} / ${total}`, ML + CW, 284, { align: 'right' })
  }
}

// ── Génération complète ───────────────────────────────────────
export async function telechargerPDF(rapport, m) {
  const r = await chargerRessources()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  installerFontes(doc, r)

  // Page 1 — garde
  pageDeGarde(doc, m, r.logo)

  // Corps (le sommaire sera inséré en page 2 à la fin)
  const ctx = creerCtx(doc)
  nouvellePage(ctx)

  h1(ctx, 'RESUME EXECUTIF')
  m.resumeExecutif.forEach(t => paragraphe(ctx, t))
  tableauPdf(ctx,
    ['Axe', 'T. réf.', 'T. min.', 'T. moyen', 'T. max.', 'Retard', 'Niveau', 'Vitesse', 'Relevés'],
    m.axes.map(a => [
      a.axe, fmt(a.tRef), fmt(a.tMin), fmt(a.tMoyen), fmt(a.tMax),
      fmtRetard(a.retard).replace(' min', ''), NIVEAU_LABELS[a.niveau],
      `${fmt(a.vitesse)} km/h`, a.nbMesures > 0 ? String(a.nbMesures) : 'live',
    ]),
    [CW * 0.17, CW * 0.09, CW * 0.09, CW * 0.10, CW * 0.09, CW * 0.10, CW * 0.15, CW * 0.12, CW * 0.09],
    [1, 2, 3, 4, 5, 7, 8],
    'synthèse des indicateurs par axe (sens aller, minutes)',
  )

  h1(ctx, 'INTRODUCTION ET CONTEXTE')
  m.introduction.forEach(t => paragraphe(ctx, t))

  h1(ctx, 'I. METHODOLOGIE')
  h2(ctx, '1. Sources de données');               paragraphe(ctx, m.methodologie.sources)
  h2(ctx, '2. Dispositif de collecte automatique'); paragraphe(ctx, m.methodologie.collecte)
  h2(ctx, '3. Période couverte');                 paragraphe(ctx, m.methodologie.periode)
  h2(ctx, '4. Axes surveillés');                  paragraphe(ctx, m.methodologie.axes)
  h2(ctx, '5. Définition des indicateurs');       paragraphe(ctx, m.methodologie.indicateurs)

  h1(ctx, 'II. EVALUATION DU TEMPS DE TRAVERSEE DE LA ZONE PORTUAIRE')
  h2(ctx, '1. Détermination du temps minimal de traversée')
  m.axes.forEach(a => blocAxeIndicateur(ctx, a, 'min'))
  h2(ctx, '2. Détermination du temps moyen de traversée')
  m.axes.forEach(a => blocAxeIndicateur(ctx, a, 'moyen'))
  h2(ctx, '3. Détermination du temps maximal de traversée')
  m.axes.forEach(a => blocAxeIndicateur(ctx, a, 'max'))

  h1(ctx, 'III. INTERPRETATION TRANSVERSALE')
  figurePdf(ctx, graphiqueComparaisonAxes(m.axes),
    'Temps de traversée par axe : minimum, moyenne et maximum sur la période.', 820 / 1600)
  m.transversal.forEach(t => paragraphe(ctx, t))

  h1(ctx, 'IV. RECOMMANDATIONS')
  m.recommandations.forEach((rec, i) => {
    h3(ctx, `${i + 1}. ${rec.titre}`)
    paragraphe(ctx, rec.corps)
  })

  h1(ctx, 'CONCLUSION')
  m.conclusion.forEach(t => paragraphe(ctx, t))
  paragraphe(ctx, `Validé par : Direction des Études Économiques, de la Stratégie et de la Planification — Département Études Économiques et Financières. ` +
    `Date : ${rapport.date.toLocaleDateString('fr-FR')} — Signature et cachet :`, { apres: 14 })

  h1(ctx, 'ANNEXES')
  h2(ctx, 'Annexe 1 — Grille des niveaux de service')
  tableauPdf(ctx,
    ['Niveau', 'Qualification', 'Ratio', 'Lecture'],
    [
      ['N1', 'Fluide',            '≤ 1,10',      'Conditions optimales, pas de retard notable'],
      ['N2', 'Bon',               '1,10 – 1,25', 'Légère dégradation, surveillance simple'],
      ['N3', 'Ralenti',           '1,25 – 1,50', 'Ralentissements, mesures préventives'],
      ['N4', 'Congestionné',      '1,50 – 2,00', 'Congestion, actions correctives requises'],
      ['N5', 'Très congestionné', '> 2,00',      "Crise trafic, intervention d'urgence"],
    ],
    [CW * 0.12, CW * 0.25, CW * 0.18, CW * 0.45],
    [],
    'grille de qualification du niveau de service (ratio = temps moyen / temps de référence)',
  )
  h2(ctx, "Annexe 2 — Temps de référence et seuils d'alerte par axe")
  tableauPdf(ctx,
    ['Axe', 'T. de référence', 'Seuil orange', 'Seuil rouge'],
    m.axes.map(a => [a.nomComplet, fmtMin(a.tRef), fmtMin(Math.round(a.tRef * 1.4)), fmtMin(Math.round(a.tRef * 1.8))]),
    [CW * 0.44, CW * 0.20, CW * 0.18, CW * 0.18],
    [1, 2, 3],
    "seuils d'alerte calculés depuis le temps de référence de chaque axe (orange : × 1,4 ; rouge : × 1,8)",
  )
  h2(ctx, "Annexe 3 — Outillage d'analyse prédictive")
  paragraphe(ctx, m.ml
    ? `Le système FlowPort embarque un modèle de prévision de niveau de trafic (${m.ml.modele}, précision de ${fmt(m.ml.accuracy * 100, 1)} % en validation), ` +
      `entraîné sur une base de mesures réelles (${m.ml.note}). Ses sorties alimentent les alertes prédictives du tableau de bord ; ` +
      `elles sont citées dans le présent rapport à titre d'éclairage et ne se substituent pas aux mesures constatées.`
    : `Métadonnées du modèle prédictif indisponibles à la génération. [À COMPLÉTER]`)
  paragraphe(ctx, `Document généré automatiquement par FlowPort (référence ${m.reference}) le ${m.genereLe}. Source des mesures : ${m.sourceLabel}.`,
    { italic: true, size: 9.5, couleur: GRIS })

  // Sommaire : ajouté en fin puis déplacé en page 2 ; le corps
  // glisse d'une page, d'où le +1 sur les numéros enregistrés.
  doc.addPage()
  ecrireSommaire(doc, ctx.sommaire.map(e => ({ ...e, page: e.page + 1 })))
  doc.movePage(doc.getNumberOfPages(), 2)

  habillerPages(doc, m)
  doc.save(`${rapport.nom}.pdf`)
}
