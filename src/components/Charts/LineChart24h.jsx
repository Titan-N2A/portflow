// ============================================================
// LineChart24h.jsx — Courbe historique 24h (7h-18h)
// Affiche le temps moyen de traversée par heure pour l'axe
// sélectionné, calculé sur les 2 016 mesures réelles PAA.
// ============================================================

import { Line } from 'react-chartjs-2'
import '../../utils/chartSetup' // enregistrement Chart.js
import { tokens } from '../../styles/tokens'

function LineChart24h({ data, axeNom }) {
  const labels  = data.map(d => `${d.heure}h`)
  const valeurs = data.map(d => d.temps_moyen)

  const chartData = {
    labels,
    datasets: [{
      label:               `Temps moyen — ${axeNom}`,
      data:                valeurs,
      borderColor:         tokens.colors.accent.primary,
      backgroundColor:     tokens.colors.accent.primary + '22', // halo transparent sous la courbe
      fill:                true,
      tension:             0.35, // courbe lissée
      pointRadius:         3,
      pointBackgroundColor: tokens.colors.accent.primary,
    }],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { labels: { color: tokens.colors.text.secondary } },
      title: {
        display: true,
        text:    'Courbe 24h — temps moyen historique (février 2025)',
        color:   tokens.colors.text.primary,
        font:    { size: 14 },
      },
    },
    scales: {
      x: {
        ticks: { color: tokens.colors.text.muted },
        grid:  { color: tokens.colors.bg.border },
      },
      y: {
        ticks: { color: tokens.colors.text.muted },
        grid:  { color: tokens.colors.bg.border },
        title: { display: true, text: 'minutes', color: tokens.colors.text.muted },
      },
    },
  }

  return (
    <div style={{
      background:   tokens.colors.bg.surface,
      borderRadius: tokens.radius.md,
      padding:      tokens.spacing.card,
    }}>
      <Line data={chartData} options={options} />
    </div>
  )
}

export default LineChart24h