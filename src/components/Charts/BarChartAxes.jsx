// ============================================================
// BarChartAxes.jsx — Histogramme comparatif des 3 axes PAA
// L'axe sélectionné (via carte ou boutons) est mis en évidence
// en orange ; les autres gardent leur couleur d'origine.
// ============================================================

import { Bar } from 'react-chartjs-2'
import '../../utils/chartSetup'
import { tokens, getAxeColor } from '../../styles/tokens'

function BarChartAxes({ data, selectedAxeId }) {
  const labels  = data.map(d => d.nom)
  const valeurs = data.map(d => d.temps_moyen)

  // Met en évidence l'axe sélectionné (orange accent), les autres gardent leur couleur
  const couleurs = data.map(d =>
    d.axeId === selectedAxeId ? tokens.colors.accent.primary : getAxeColor(Number(d.axeId.slice(-1)))
  )

  const chartData = {
    labels,
    datasets: [{
      label:           'Temps moyen aller (min)',
      data:            valeurs,
      backgroundColor: couleurs,
      borderRadius:    6,
    }],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text:    'Comparatif des 3 axes — sens aller',
        color:   tokens.colors.text.primary,
        font:    { size: 14 },
      },
    },
    scales: {
      x: { ticks: { color: tokens.colors.text.muted }, grid: { display: false } },
      y: { ticks: { color: tokens.colors.text.muted }, grid: { color: tokens.colors.bg.border } },
    },
  }

  return (
    <div style={{
      background:   tokens.colors.bg.surface,
      borderRadius: tokens.radius.md,
      padding:      tokens.spacing.card,
    }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}

export default BarChartAxes