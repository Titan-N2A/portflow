// ============================================================
// exportData.js — Export générique CSV / Excel
// Utilisé pour exporter l'historique de collecte automatique
// afin d'affiner les analyses et alimenter le modèle ML.
// ============================================================

import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export function exportToCSV(rows, filename) {
  const csv = Papa.unparse(rows)
  downloadBlob(csv, filename, 'text/csv;charset=utf-8;')
}

export function exportToExcel(rows, filename) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Données')
  XLSX.writeFile(workbook, filename)
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}