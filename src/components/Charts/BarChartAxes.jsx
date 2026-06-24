import { Bar } from 'react-chartjs-2'
import '../../utils/chartSetup'
import { tokens, getAxeColor } from '../../styles/tokens'

function BarChartAxes({ data, selectedAxeId }) {
  const labels  = data.map(d => d.nom)
  const valeurs = data.map(d => d.temps_moyen)

  const couleurs = data.map(d =>
    d.axeId === selectedAxeId
      ? tokens.colors.accent.primary
      : getAxeColor(Number(d.axeId.slice(-1))) + 'AA'
  )

  const chartData = {
    labels,
    datasets: [{
      label:           'Temps moyen aller (min)',
      data:            valeurs,
      backgroundColor: couleurs,
      borderRadius:    8,
      borderSkipped:   false,
    }],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: {
        display:  true,
        text:     'Comparatif 3 axes — sens aller',
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
    scales: {
      x: {
        ticks: {
          color: tokens.colors.text.secondary,
          font:  { family: "'Space Grotesk', sans-serif", size: 11 },
        },
        grid: { display: false },
      },
      y: {
        ticks: {
          color: tokens.colors.text.muted,
          font:  { family: "'Space Mono', monospace", size: 11 },
        },
        grid:  { color: tokens.colors.bg.border, drawBorder: false },
      },
    },
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
      <Bar data={chartData} options={options} />
    </div>
  )
}

export default BarChartAxes
