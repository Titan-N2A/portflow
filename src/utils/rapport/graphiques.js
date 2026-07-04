// ============================================================
// rapport/graphiques.js — Graphiques PNG haute résolution pour
// les documents exportés (Word + PDF). Rendu Chart.js hors
// écran, palette de la charte (2 bleus + neutres), Garamond.
// ============================================================

import { Chart } from 'chart.js'
import '../chartSetup'

const OCEAN   = '#0E4C74'
const LAGUNE  = '#1A6FA8'
const CLAIR   = '#E8F3FA'
const GRIS    = '#595959'
const GRILLE  = '#D9E4EE'
const FONTE   = "Garamond, 'EB Garamond', serif"

// Fond blanc (Chart.js rend transparent par défaut — flou une fois
// posé sur une page : on peint le fond avant le rendu).
const fondBlanc = {
  id: 'fondBlanc',
  beforeDraw(chart) {
    const { ctx, width, height } = chart
    ctx.save()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  },
}

function rendre(config, width = 1600, height = 760) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const chart = new Chart(canvas.getContext('2d'), {
    ...config,
    options: {
      ...config.options,
      responsive: false,
      animation: false,
      devicePixelRatio: 1,
    },
    plugins: [fondBlanc, ...(config.plugins ?? [])],
  })
  const url = canvas.toDataURL('image/png')
  chart.destroy()
  return url
}

function optionsBase(titre, uniteX) {
  return {
    layout: { padding: 18 },
    plugins: {
      title: {
        display: true, text: titre,
        color: OCEAN, font: { family: FONTE, size: 30, weight: 'bold' },
        padding: { bottom: 14 },
      },
      legend: {
        position: 'bottom',
        labels: { color: GRIS, font: { family: FONTE, size: 24 }, boxWidth: 30, padding: 18 },
      },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        title: { display: true, text: uniteX, color: GRIS, font: { family: FONTE, size: 24 } },
        ticks: { color: GRIS, font: { family: FONTE, size: 22 }, maxRotation: 45 },
        grid: { display: false },
      },
      y: {
        title: { display: true, text: 'Temps de traversée (minutes)', color: GRIS, font: { family: FONTE, size: 24 } },
        ticks: { color: GRIS, font: { family: FONTE, size: 22 } },
        grid: { color: GRILLE },
        beginAtZero: true,
      },
    },
  }
}

/**
 * Graphique d'un indicateur (min | moy | max) pour un axe :
 * évolution du temps réel sur la période + ligne de référence.
 */
export function graphiqueIndicateurAxe(serie, axe, indicateur) {
  if (!serie?.buckets?.length) return null
  const labels = serie.buckets.map(b => b.label)
  const valeurs = serie.buckets.map(b => b[indicateur])
  const nomIndic = { min: 'Temps minimal', moy: 'Temps moyen', max: 'Temps maximal' }[indicateur]
  return rendre({
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `${nomIndic} relevé`,
          data: valeurs,
          borderColor: OCEAN, backgroundColor: 'rgba(26,111,168,0.14)',
          borderWidth: 4, pointRadius: 4, pointBackgroundColor: OCEAN,
          fill: true, tension: 0.25,
        },
        {
          label: `Temps de référence (${axe.tRef} min)`,
          data: labels.map(() => axe.tRef),
          borderColor: GRIS, borderDash: [10, 8], borderWidth: 3,
          pointRadius: 0, fill: false,
        },
      ],
    },
    options: optionsBase(`${nomIndic} de traversée — Axe ${axe.nomComplet}`, serie.uniteLabel),
  })
}

/**
 * Graphique de synthèse : barres min / moyen / max par axe.
 */
export function graphiqueComparaisonAxes(axes) {
  if (!axes?.length) return null
  return rendre({
    type: 'bar',
    data: {
      labels: axes.map(a => a.axe),
      datasets: [
        { label: 'Temps minimal', data: axes.map(a => a.tMin), backgroundColor: CLAIR, borderColor: LAGUNE, borderWidth: 2 },
        { label: 'Temps moyen',   data: axes.map(a => a.tMoyen), backgroundColor: LAGUNE },
        { label: 'Temps maximal', data: axes.map(a => a.tMax), backgroundColor: OCEAN },
      ],
    },
    options: optionsBase('Temps de traversée par axe — minimum, moyenne, maximum', 'Axe'),
  }, 1600, 820)
}

/** Conversion dataURL PNG → Uint8Array (pour la lib docx). */
export function dataUrlVersOctets(dataUrl) {
  const b64 = dataUrl.split(',')[1]
  const bin = atob(b64)
  const octets = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i)
  return octets
}
