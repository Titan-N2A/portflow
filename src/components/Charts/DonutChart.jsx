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
      backgroundColor: data.map(d => COULEURS[d.label] + 'CC'),
      borderColor:     data.map(d => COULEURS[d.label]),
      borderWidth:     1,
      hoverBorderWidth: 2,
      hoverBorderColor: data.map(d => COULEURS[d.label]),
      hoverOffset:     6,
    }],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color:     tokens.colors.text.secondary,
          font:      { family: "'Space Grotesk', sans-serif", size: 11 },
          boxWidth:  12,
          boxHeight: 12,
          padding:   12,
        },
      },
      title: {
        display:  true,
        text:     'Répartition des niveaux',
        color:    tokens.colors.text.primary,
        font:     { family: "'Space Grotesk', sans-serif", size: 13, weight: '600' },
        padding:  { bottom: 16 },
      },
      tooltip: {
        backgroundColor: tokens.colors.bg.elevated,
        borderColor:     tokens.colors.bg.border,
        borderWidth:     1,
        titleColor:      tokens.colors.text.primary,
        bodyColor:       tokens.colors.text.secondary,
        titleFont:       { family: "'Space Grotesk', sans-serif" },
        bodyFont:        { family: "'Space Mono', monospace" },
      },
    },
    cutout: '65%',
  }

  return (
    <div
      className="pf-card"
      style={{
        background:    tokens.colors.bg.surface,
        borderRadius:  tokens.radius.md,
        padding:       tokens.spacing.card,
        border:        `1px solid ${tokens.colors.bg.border}`,
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      <Doughnut data={chartData} options={options} />
    </div>
  )
}

export default DonutChart
