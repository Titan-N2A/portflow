// ============================================================
// DonutChart.jsx — Répartition des niveaux de congestion
// Donut affichant la proportion de temps passé en Fluide /
// Modéré / Dense / Congestionné sur la période sélectionnée.
// ============================================================

import { Doughnut } from 'react-chartjs-2'
import '../../utils/chartSetup'
import { tokens } from '../../styles/tokens'

const COULEURS = {
  Fluide:       tokens.colors.traffic.fluid,
  Modéré:       tokens.colors.traffic.moderate,
  Dense:        tokens.colors.traffic.dense,
  Congestionné: tokens.colors.traffic.blocked,
}

function DonutChart({ data }) {
  const chartData = {
    labels: data.map(d => `${d.label} (${d.pct}%)`),
    datasets: [{
      data:            data.map(d => d.count),
      backgroundColor: data.map(d => COULEURS[d.label]),
      borderColor:     tokens.colors.bg.surface,
      borderWidth:      2,
    }],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: tokens.colors.text.secondary, font: { size: 11 } },
      },
      title: {
        display: true,
        text:    'Répartition des niveaux de congestion',
        color:   tokens.colors.text.primary,
        font:    { size: 14 },
      },
    },
    cutout: '60%',
  }

  return (
    <div style={{ background: tokens.colors.bg.surface, borderRadius: tokens.radius.md, padding: tokens.spacing.card }}>
      <Doughnut data={chartData} options={options} />
    </div>
  )
}

export default DonutChart