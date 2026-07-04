// ============================================================
// AIText.jsx — Rendu léger du Markdown des réponses IA
// Le modèle (Llama via Groq) répond en Markdown : sans rendu,
// les ** apparaissaient tels quels dans les bulles. Ce composant
// convertit le sous-ensemble utile — **gras**, *italique*,
// puces (-, *, •), titres ### — en éléments React, sans
// dépendance. À utiliser dans un conteneur `white-space: pre-line`.
// ============================================================

// Inline : **gras** puis *italique* sur les segments restants
function renderInline(texte, cle) {
  const noeuds = []
  const parties = texte.split(/\*\*(.+?)\*\*/g)
  parties.forEach((part, i) => {
    if (i % 2 === 1) {
      noeuds.push(<strong key={`${cle}-b${i}`}>{part}</strong>)
      return
    }
    const sous = part.split(/(?<![\w*])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![\w*])/g)
    sous.forEach((s, j) => {
      if (j % 2 === 1) noeuds.push(<em key={`${cle}-i${i}-${j}`}>{s}</em>)
      else if (s) noeuds.push(s)
    })
  })
  return noeuds
}

export default function AIText({ text }) {
  if (!text) return null
  const lignes = String(text).split('\n')
  return lignes.map((ligne, i) => {
    let contenu = ligne
    let gras = false

    // Titres Markdown (###, ##...) → ligne en gras
    const mTitre = contenu.match(/^\s*#{1,4}\s+(.*)$/)
    if (mTitre) { contenu = mTitre[1]; gras = true }

    // Puces "- ", "* ", "• " → puce typographique
    const mPuce = contenu.match(/^(\s*)([-*•])\s+(.*)$/)
    if (mPuce) contenu = `${mPuce[1]}• ${mPuce[3]}`

    const rendu = renderInline(contenu, i)
    return (
      <span key={i}>
        {i > 0 && '\n'}
        {gras ? <strong>{rendu}</strong> : rendu}
      </span>
    )
  })
}
