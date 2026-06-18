// ============================================================
// chartSetup.js — Enregistrement des composants Chart.js
// Importé (effet de bord) par chaque graphique du projet.
// Évite l'erreur "X is not a registered element" de Chart.js v4.
// ============================================================

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)