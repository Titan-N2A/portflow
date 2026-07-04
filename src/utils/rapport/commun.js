// ============================================================
// rapport/commun.js — Modèle de données partagé des rapports
// Construit UNE fois toutes les valeurs, séries et textes du
// rapport ; les rendus PDF / Word / Excel consomment le même
// modèle, garantissant la cohérence totale entre les 3 formats.
// Aucun chiffre inventé : tout est calculé depuis les relevés
// réels (collecte_auto Firestore) ou les mesures live.
// ============================================================

// ── Charte (issue de la page de garde « RAPPORT xxxx.docx ») ──
export const CHARTE = {
  bleuOcean:  '0E4C74',   // titres, en-têtes de tableaux
  bleuLagune: '1A6FA8',   // sous-titres, accents
  bleuClair:  'E8F3FA',   // lignes alternées
  texte:      '2B2B2B',
  gris:       '595959',
  grisClair:  'B9CDDC',   // bordures fines de tableaux
}

export const NIVEAU_LABELS = ['', 'Fluide', 'Bon', 'Ralenti', 'Congestionné', 'Très congestionné']

export const SOUS_TITRE = 'Évaluation du temps de traversée de la zone portuaire'
export const DIRECTION = 'DIRECTION DES ETUDES ECONOMIQUES, DE LA STRATEGIE ET DE LA PLANIFICATION'
export const DEPARTEMENT = 'Département Etudes Economiques et Financières'
export const REF_DOC = 'DEESP-RF-01'

const A_COMPLETER = '[À COMPLÉTER]'

// ── Formatage fr-FR ───────────────────────────────────────────
export function fmt(n, dec = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return A_COMPLETER
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: dec })
}
export function fmtMin(n)    { return `${fmt(n)} min` }
export function fmtRetard(n) { return `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))} min` }
export function fmtPct(n)    { return `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n), 0)} %` }

export function nomCompletAxe(axe) {
  return (axe?.nom ?? axe?.shortNom ?? '?').replace(/\s*→\s*/g, ' – ')
}

// ── Séries temporelles réelles (par heure ou par date) ────────
function construireSerie(records, axeId, type) {
  const rels = records.filter(r => r.axeId === axeId && r.sens === 'aller' && r.temps_min > 0)
  if (rels.length === 0) return null
  const parJour = type !== 'journalier'
  const cle = r => parJour ? r.date : String(r.heure ?? 0).padStart(2, '0')
  const groupes = new Map()
  rels.forEach(r => {
    const k = cle(r)
    if (!groupes.has(k)) groupes.set(k, [])
    groupes.get(k).push(r.temps_min)
  })
  const buckets = [...groupes.entries()]
    .sort((a, b) => a[0] < b[0] ? -1 : 1)
    .map(([k, vals]) => ({
      label: parJour
        ? new Date(k).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        : `${k}h`,
      min: Math.round(Math.min(...vals) * 10) / 10,
      max: Math.round(Math.max(...vals) * 10) / 10,
      moy: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
      n:   vals.length,
    }))
  return { parJour, uniteLabel: parJour ? 'Date' : 'Heure', buckets }
}

function bucketExtreme(serie, champ, sens) {
  if (!serie?.buckets?.length) return null
  return serie.buckets.reduce((acc, b) =>
    (sens === 'max' ? b[champ] > acc[champ] : b[champ] < acc[champ]) ? b : acc)
}

// ── Interprétations par indicateur (adaptées aux valeurs) ─────
function interpretationMin(axe, serie) {
  const base = `Le temps minimal de traversée observé sur l'axe ${axe.nomComplet} s'établit à ${fmtMin(axe.tMin)}, ` +
    `pour un temps de référence de ${fmtMin(axe.tRef)}. Cette valeur plancher correspond aux conditions de circulation ` +
    `les plus favorables rencontrées sur la période${axe.nbMesures > 0 ? ` (${axe.nbMesures} relevés)` : ''}.`
  if (!serie) return base + ` Faute d'historique sur la période, cette valeur provient de la mesure en temps réel au moment de la génération.`
  const meilleur = bucketExtreme(serie, 'min', 'min')
  const detail = ` Le créneau le plus favorable est ${serie.parJour ? 'la journée du' : ''} ${meilleur.label} (${fmtMin(meilleur.min)}).`
  const ecartRef = axe.tMin - axe.tRef
  const lecture = ecartRef <= 0
    ? ` Le plancher observé est inférieur ou égal à la référence : en conditions creuses, l'axe s'écoule sans contrainte.`
    : ` Même au plus creux, le parcours reste supérieur de ${fmt(ecartRef)} min à la référence, signe d'une charge de fond permanente sur cet axe.`
  return base + detail + lecture
}

function interpretationMoyen(axe, serie) {
  const ratio = axe.tRef > 0 ? axe.tMoyen / axe.tRef : 1
  const pct = Math.round((ratio - 1) * 100)
  const base = `Le temps moyen de traversée de l'axe ${axe.nomComplet} ressort à ${fmtMin(axe.tMoyen)}, soit un écart de ` +
    `${fmtRetard(axe.retard)} (${fmtPct(pct)}) par rapport à la référence de ${fmtMin(axe.tRef)}. ` +
    `La vitesse moyenne estimée est de ${fmt(axe.vitesse)} km/h et le niveau de service correspondant est « ${NIVEAU_LABELS[axe.niveau]} ».`
  let lecture
  if (ratio <= 1.05)      lecture = ` Les conditions moyennes sont conformes à la référence : aucune mesure corrective n'est requise sur cet axe.`
  else if (ratio <= 1.25) lecture = ` La dégradation reste contenue ; une simple surveillance des créneaux chargés est suffisante.`
  else if (ratio <= 1.50) lecture = ` Le seuil d'alerte orange (référence × 1,4) est approché ou dépassé : des mesures préventives de régulation sont recommandées.`
  else                    lecture = ` L'axe est en congestion caractérisée : des mesures correctives s'imposent (voir recommandations).`
  const varia = serie
    ? ` La moyenne ${serie.parJour ? 'journalière' : 'horaire'} varie de ${fmtMin(bucketExtreme(serie, 'moy', 'min').moy)} à ${fmtMin(bucketExtreme(serie, 'moy', 'max').moy)} selon ${serie.parJour ? 'les jours' : 'les heures'}.`
    : ''
  return base + varia + lecture
}

function interpretationMax(axe, serie) {
  const seuilOrange = Math.round(axe.tRef * 1.4)
  const seuilRouge  = Math.round(axe.tRef * 1.8)
  const amplitude   = Math.round((axe.tMax - axe.tMin) * 10) / 10
  let statut
  if (axe.tMax >= seuilRouge)       statut = `Cette pointe dépasse le seuil rouge (${seuilRouge} min) : l'axe a connu au moins un épisode de congestion sévère.`
  else if (axe.tMax >= seuilOrange) statut = `Cette pointe dépasse le seuil orange (${seuilOrange} min) sans atteindre le seuil rouge (${seuilRouge} min).`
  else                              statut = `Cette pointe reste sous le seuil orange (${seuilOrange} min) : aucun épisode critique n'a été enregistré.`
  const pire = serie ? bucketExtreme(serie, 'max', 'max') : null
  const quand = pire ? ` Le maximum a été relevé ${serie.parJour ? 'le' : 'sur le créneau de'} ${pire.label}.` : ''
  return `Le temps maximal de traversée atteint ${fmtMin(axe.tMax)} sur l'axe ${axe.nomComplet}, ` +
    `soit une amplitude de ${fmt(amplitude)} min entre le plancher (${fmtMin(axe.tMin)}) et la pointe. ${statut}${quand}` +
    (amplitude > axe.tRef * 0.5
      ? ` L'amplitude élevée traduit une forte sensibilité de cet axe aux pics d'activité : les temps y sont peu prévisibles aux heures chargées.`
      : ` L'amplitude modérée indique des conditions relativement stables et prévisibles sur la période.`)
}

// ── Recommandations (3 à 5, dérivées des données) ─────────────
function construireRecommandations(axes, stats, ml) {
  const recs = []
  if (stats.heurePointe) {
    recs.push({
      titre: 'Planifier les rotations hors du créneau de pointe',
      corps: `Les relevés de la période situent la pointe de trafic ${stats.heurePointe.parJour ? 'le' : 'autour de'} ${stats.heurePointe.label} ` +
        `(temps moyen tous axes : ${fmtMin(stats.heurePointe.moy)}). Il est recommandé de programmer les rotations non urgentes en dehors de ce créneau` +
        (ml ? `, en cohérence avec le modèle prédictif ${ml.modele} (précision ${fmt(ml.accuracy * 100, 1)} %) qui identifie la fin de matinée comme la plage la plus chargée` : '') + `.`,
    })
  }
  const degrades = axes.filter(a => a.tRef > 0 && a.tMoyen / a.tRef > 1.25)
  degrades.forEach(a => {
    recs.push({
      titre: `Réguler l'axe ${a.axe} (retard moyen ${fmtRetard(a.retard)})`,
      corps: `L'axe ${a.nomComplet} présente un ratio de ${fmt(a.tMoyen / a.tRef, 2)} par rapport à sa référence. ` +
        `Actions proposées : reporter les rotations non prioritaires vers les créneaux creux, activer la signalisation dynamique à l'entrée de l'axe ` +
        `et notifier les opérateurs de terminaux et prestataires logistiques des conditions dégradées.`,
    })
  })
  if (stats.axeAmplitudeMax && (stats.axeAmplitudeMax.tMax - stats.axeAmplitudeMax.tMin) > stats.axeAmplitudeMax.tRef * 0.5) {
    recs.push({
      titre: `Fiabiliser les temps sur l'axe ${stats.axeAmplitudeMax.axe}`,
      corps: `L'axe ${stats.axeAmplitudeMax.nomComplet} présente la plus forte amplitude min/max de la période ` +
        `(${fmtMin(stats.axeAmplitudeMax.tMin)} à ${fmtMin(stats.axeAmplitudeMax.tMax)}). Cette variabilité pénalise la planification des convois : ` +
        `il est recommandé d'y concentrer l'analyse des causes de pics (rotations de terminaux, mouvements exceptionnels, signalisation).`,
    })
  }
  recs.push({
    titre: 'Maintenir la continuité de la collecte automatique',
    corps: `Le dispositif de collecte automatique (GitHub Actions, un relevé toutes les 5 minutes, 24 h/24 et 7 j/7) alimente en continu la base de mesures réelles. ` +
      `Il est recommandé de vérifier mensuellement les journaux d'exécution et la validité des clés d'accès TomTom afin de préserver la profondeur d'historique qui fonde les présentes analyses.`,
  })
  if (recs.length < 5 && stats.nGlobal <= 2) {
    recs.push({
      titre: 'Mettre à profit la période favorable pour enrichir le modèle prédictif',
      corps: `Les conditions observées (niveau global « ${NIVEAU_LABELS[stats.nGlobal]} ») constituent une base saine pour réentraîner le modèle de prévision ` +
        `à partir des données accumulées, et étendre la couverture aux plages nocturnes et aux week-ends.`,
    })
  }
  return recs.slice(0, 5)
}

// ── Modèle complet ────────────────────────────────────────────
export function construireModele(rapport, ml = null) {
  const rows    = rapport.rows ?? []
  const records = rapport.records ?? []
  const type    = rapport.type
  const typeLabel = { journalier: 'JOURNALIER', hebdomadaire: 'HEBDOMADAIRE', mensuel: 'MENSUEL' }[type] ?? type.toUpperCase()

  const axes = rows.map((r, i) => ({
    ...r,
    nomComplet: r.nomComplet ?? r.axe,
    lettre: String.fromCharCode(65 + i),                     // A, B, C…
    serie: construireSerie(records, r.axeId, type),
  }))
  axes.forEach(a => {
    a.interpretations = {
      min:   interpretationMin(a, a.serie),
      moyen: interpretationMoyen(a, a.serie),
      max:   interpretationMax(a, a.serie),
    }
  })

  // Statistiques globales
  const ratios = axes.map(a => a.tRef > 0 ? a.tMoyen / a.tRef : 1)
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1)
  const nGlobal = avgRatio <= 1.10 ? 1 : avgRatio <= 1.25 ? 2 : avgRatio <= 1.50 ? 3 : avgRatio <= 2 ? 4 : 5
  const retardGlobal = Math.round(axes.reduce((a, r) => a + (r.retard || 0), 0) / (axes.length || 1) * 10) / 10
  const tMoyenGlobal = Math.round(axes.reduce((a, r) => a + r.tMoyen, 0) / (axes.length || 1) * 10) / 10
  const nbDeg = axes.filter(a => a.tRef > 0 && a.tMoyen / a.tRef > 1.25).length
  const tries = [...axes].sort((a, b) => (b.tMoyen / b.tRef) - (a.tMoyen / a.tRef))
  const pire = tries[0], meilleur = tries[tries.length - 1]
  const axeAmplitudeMax = [...axes].sort((a, b) => (b.tMax - b.tMin) - (a.tMax - a.tMin))[0]

  // Heure (ou jour) de pointe : moyenne des ratios tous axes par créneau
  let heurePointe = null
  if (records.length > 0) {
    const tRefParAxe = Object.fromEntries(axes.map(a => [a.axeId, a.tRef]))
    const parJour = type !== 'journalier'
    const groupes = new Map()
    records.filter(r => r.sens === 'aller' && r.temps_min > 0 && tRefParAxe[r.axeId]).forEach(r => {
      const k = parJour ? r.date : String(r.heure ?? 0).padStart(2, '0')
      if (!groupes.has(k)) groupes.set(k, [])
      groupes.get(k).push(r.temps_min)
    })
    let top = null
    groupes.forEach((vals, k) => {
      const moy = vals.reduce((a, b) => a + b, 0) / vals.length
      if (!top || moy > top.moy) top = { cle: k, moy: Math.round(moy * 10) / 10 }
    })
    if (top) heurePointe = {
      parJour,
      label: parJour
        ? new Date(top.cle).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        : `${top.cle}h00–${String(Number(top.cle) + 1).padStart(2, '0')}h00`,
      moy: top.moy,
    }
  }

  const stats = {
    avgRatio, nGlobal, nGlobalLabel: NIVEAU_LABELS[nGlobal],
    retardGlobal, tMoyenGlobal, nbDeg,
    pire, meilleur, axeAmplitudeMax, heurePointe,
    nbAxes: axes.length,
  }

  const numero = new Date(rapport.periode + 'T00:00:00').toLocaleDateString('fr-FR')

  return {
    // Identité du document
    titre: `RAPPORT ${typeLabel} N°${numero}`,
    typeLabel, numero,
    sousTitre: SOUS_TITRE,
    reference: REF_DOC,
    nomFichier: rapport.nom,
    periodeLabel: rapport.periodeLabel,
    genereLe: rapport.date.toLocaleString('fr-FR'),
    nbMesures: rapport.nbMesuresTotal,
    sourceLabel: rapport.nbMesuresTotal > 0
      ? `${fmt(rapport.nbMesuresTotal, 0)} relevés automatiques (TomTom, collecte 24 h/24)`
      : 'Mesures en temps réel uniquement (aucun relevé historique sur la période)',
    axes, stats, records,
    recommandations: construireRecommandations(axes, stats, ml),
    ml,

    // Textes de sections (identiques dans Word et PDF)
    resumeExecutif: [
      `Sur la période ${rapport.periodeLabel}, le temps moyen de traversée de la zone portuaire s'établit à ${fmtMin(tMoyenGlobal)} ` +
      `tous axes confondus, soit un écart moyen de ${fmtRetard(retardGlobal)} par rapport aux temps de référence. ` +
      `Le niveau de service global du réseau est « ${NIVEAU_LABELS[nGlobal]} » (ratio moyen : ${fmt(avgRatio, 2)}).`,
      axes.length >= 2
        ? `L'axe le plus fluide est ${meilleur.nomComplet} (ratio ${fmt(meilleur.tMoyen / meilleur.tRef, 2)}) ; ` +
          `l'axe le plus contraint est ${pire.nomComplet} (ratio ${fmt(pire.tMoyen / pire.tRef, 2)}, retard moyen ${fmtRetard(pire.retard)}). ` +
          `${nbDeg === 0 ? `Aucun axe ne dépasse le seuil d'alerte orange.` : `${nbDeg} axe(s) sur ${axes.length} dépassent le seuil d'alerte orange.`}`
        : `Un seul axe disposait de données exploitables sur la période.`,
      (heurePointe
        ? `La pointe de trafic est observée ${heurePointe.parJour ? 'le' : 'sur le créneau'} ${heurePointe.label} (temps moyen tous axes : ${fmtMin(heurePointe.moy)}). `
        : '') +
      `Les recommandations du présent rapport portent sur la planification des rotations, la régulation des axes contraints et la continuité du dispositif de mesure.`,
    ],
    introduction: [
      `Le Port Autonome d'Abidjan (PAA) constitue la principale porte d'entrée maritime de la Côte d'Ivoire et un maillon essentiel des ` +
      `chaînes logistiques de la sous-région. La fluidité de la circulation routière dans la zone portuaire conditionne directement la performance ` +
      `des opérations de manutention, les délais de livraison et les coûts supportés par les opérateurs économiques.`,
      `Le présent rapport ${typeLabel.toLowerCase()} évalue le temps de traversée de la zone portuaire sur la période ${rapport.periodeLabel}, ` +
      `à partir des mesures collectées automatiquement par le système FlowPort. Il couvre les trois axes structurants du réseau : ` +
      axes.map(a => a.nomComplet).join(' ; ') + `.`,
      `L'analyse porte sur trois indicateurs : le temps minimal, le temps moyen et le temps maximal de traversée, rapportés au temps de ` +
      `référence propre à chaque axe. Elle débouche sur une interprétation transversale et des recommandations opérationnelles.`,
    ],
    methodologie: {
      sources: `Les temps de parcours sont fournis par le service de routage TomTom (Routing API), interrogé pour chaque axe et chaque sens de circulation. ` +
        `Les mesures sont horodatées et archivées dans la base Firestore du système FlowPort (collection « collecte_auto »).`,
      collecte: `La collecte est entièrement automatisée : un traitement planifié (GitHub Actions) interroge l'API toutes les 5 minutes, 24 h/24 et 7 j/7, ` +
        `sans intervention humaine ni navigateur ouvert. Ce dispositif, initialement limité à des relevés ponctuels en journée, constitue désormais un système ` +
        `vivant d'accumulation de données réelles dont la profondeur d'historique s'accroît en continu et fiabilise les analyses d'une période à l'autre.`,
      periode: `Période couverte par le présent rapport : ${rapport.periodeLabel}. Volume exploité : ${rapport.nbMesuresTotal > 0 ? `${fmt(rapport.nbMesuresTotal, 0)} relevés automatiques` : 'mesures en temps réel uniquement (aucun relevé archivé sur la période)'}.`,
      axes: `Trois axes bidirectionnels sont surveillés, tous convergeant vers la Pharmacie Palm Beach : ` +
        axes.map(a => `${a.nomComplet} (référence : ${fmtMin(a.tRef)})`).join(' ; ') +
        `. Les analyses du présent rapport portent sur le sens « aller » (entrée de zone portuaire).`,
      indicateurs: `Pour chaque axe et sur l'ensemble des relevés de la période : le temps minimal est la plus faible durée de traversée observée ; ` +
        `le temps moyen est la moyenne arithmétique des durées ; le temps maximal est la plus forte durée observée. Chaque temps moyen est rapporté ` +
        `au temps de référence de l'axe pour qualifier le niveau de service (grille en annexe). Les seuils d'alerte sont fixés à 1,4 fois (orange) ` +
        `et 1,8 fois (rouge) le temps de référence.`,
    },
    transversal: [
      axes.length >= 2
        ? `La comparaison des trois axes fait ressortir ${pire.nomComplet} comme l'axe le plus critique de la période ` +
          `(ratio ${fmt(pire.tMoyen / pire.tRef, 2)}, retard moyen ${fmtRetard(pire.retard)}), tandis que ${meilleur.nomComplet} ` +
          `offre les meilleures conditions (ratio ${fmt(meilleur.tMoyen / meilleur.tRef, 2)}). ` +
          `L'écart de ${fmt((pire.tMoyen / pire.tRef - meilleur.tMoyen / meilleur.tRef) * 100, 0)} points de ratio entre les deux extrêmes ` +
          `${(pire.tMoyen / pire.tRef - meilleur.tMoyen / meilleur.tRef) > 0.20
            ? `révèle une disparité marquée qui plaide pour un rééquilibrage des flux entre itinéraires.`
            : `traduit une relative homogénéité des conditions de circulation sur le réseau.`}`
        : `Les données de la période ne permettent pas de comparaison inter-axes complète.`,
      heurePointe
        ? `${heurePointe.parJour ? `La journée la plus chargée est ${heurePointe.label}` : `Le créneau le plus chargé est ${heurePointe.label}`} ` +
          `avec un temps moyen tous axes de ${fmtMin(heurePointe.moy)}. À l'inverse, les créneaux creux offrent des temps proches des planchers observés : ` +
          `la programmation des rotations en dehors de la pointe constitue le premier levier d'optimisation, sans investissement d'infrastructure.`
        : `L'absence de relevés horodatés sur la période ne permet pas d'identifier les créneaux de pointe. ${A_COMPLETER}`,
      `L'écart entre temps minimal et temps maximal — ${axes.map(a => `${fmt(a.tMax - a.tMin)} min sur ${a.axe}`).join(', ')} — ` +
      `mesure l'instabilité de chaque itinéraire. ${axeAmplitudeMax ? `L'axe ${axeAmplitudeMax.nomComplet} est le plus volatil : c'est sur lui que la fiabilisation des temps de parcours aurait le plus d'effet pour la planification logistique.` : ''}`,
    ],
    conclusion: [
      `Sur la période ${rapport.periodeLabel}, le réseau routier de la zone portuaire d'Abidjan présente un niveau de service global ` +
      `« ${NIVEAU_LABELS[nGlobal]} » (ratio moyen ${fmt(avgRatio, 2)} ; retard moyen ${fmtRetard(retardGlobal)} par rotation). ` +
      (nbDeg === 0
        ? `Aucun axe n'a dépassé le seuil d'alerte orange en moyenne : les conditions observées sont compatibles avec un déroulement normal des opérations portuaires.`
        : `${nbDeg} axe(s) dépassent le seuil d'alerte orange en moyenne et appellent les mesures de régulation détaillées dans les recommandations.`),
      `Ces constats reposent sur ${rapport.nbMesuresTotal > 0 ? `${fmt(rapport.nbMesuresTotal, 0)} relevés automatiques` : 'les mesures en temps réel disponibles'} ; ` +
      `la poursuite de la collecte continue affinera les prochaines éditions de ce rapport. Le présent document est généré automatiquement par le système FlowPort ; ` +
      `toute décision opérationnelle doit être validée par la Direction des Études Économiques, de la Stratégie et de la Planification du PAA.`,
    ],
  }
}

// ── Chargement des métadonnées ML réelles (ml/predictions.json) ─
export async function chargerMetaML() {
  try {
    const rep = await fetch(`${import.meta.env.BASE_URL}predictions.json`)
    if (!rep.ok) return null
    const data = await rep.json()
    const m = data?.meta
    if (!m?.modele || typeof m.accuracy !== 'number') return null
    return { modele: m.modele, accuracy: m.accuracy, note: m.note ?? '', dateEntrainement: m.date_entrainement ?? '' }
  } catch {
    return null
  }
}
