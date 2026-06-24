import { Line } from 'react-chartjs-2'
import '../../utils/chartSetup'
import { tokens } from '../../styles/tokens'

function LineChart24h({ data, axeNom }) {
  const labels  = data.map(d => `${d.heure}h`)
  const valeurs = data.map(d => d.temps_moyen)

  const chartData = {
    labels,
    datasets: [{
      label:                `Temps moyen — ${axeNom}`,
      data:                 valeurs,
      borderColor:          tokens.colors.accent.primary,
      backgroundColor:      'rgba(0,245,212,0.07)',
      fill:                 true,
      tension:              0.4,
      pointRadius:          4,
      pointBackgroundColor: tokens.colors.bg.app,
      pointBorderColor:     tokens.colors.accent.primary,
      pointBorderWidth:     2,
      pointHoverRadius:     6,
      pointHoverBackgroundColor: tokens.colors.accent.primary,
    }],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color:    tokens.colors.text.secondary,
          font:     { family: "'Space Grotesk', sans-serif", size: 12 },
          boxWidth: 12,
          padding:  12,
        },
      },
      title: {
        display:  true,
        text:     'Courbe 24h — temps moyen historique (fév. 2025)',
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
          color:  tokens.colors.text.muted,
          font:   { family: "'Space Mono', monospace", size: 11 },
        },
        grid: { color: tokens.colors.bg.border, drawBorder: false },
      },
      y: {
        ticks: {
          color:  tokens.colors.text.muted,
          font:   { family: "'Space Mono', monospace", size: 11 },
        },
        grid:  { color: tokens.colors.bg.border, drawBorder: false },
        title: {
          display: true,
          text:    'minutes',
          color:   tokens.colors.text.muted,
          font:    { family: "'Space Grotesk', sans-serif", size: 11 },
        },
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
      <Line data={chartData} options={options} />
    </div>
  )
}

export default LineChart24h
