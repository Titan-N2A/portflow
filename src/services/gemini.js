const GEMINI_KEY   = import.meta.env.VITE_GEMINI_API_KEY ?? ''
const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`

export async function askGemini(prompt) {
  if (!GEMINI_KEY) return 'Clé API Gemini non configurée (VITE_GEMINI_API_KEY).'
  try {
    const res = await fetch(GEMINI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Aucune réponse générée.'
  } catch (err) {
    console.error('Gemini error:', err)
    return null
  }
}

export function buildTrafficPrompt(mesures, axes) {
  const lines = axes.map(a => {
    const m = mesures[a.id]
    if (!m) return `${a.shortNom}: données indisponibles`
    const retard = (m.tempsLive - a.tRef).toFixed(1)
    return `${a.shortNom}: ${m.tempsLive?.toFixed(1)} min (réf. ${a.tRef} min), retard +${retard} min, niveau ${m.niveau}/5`
  }).join('\n')

  return `Tu es un expert en gestion du trafic routier au Port Autonome d'Abidjan (PAA), Côte d'Ivoire.
État actuel du trafic (${new Date().toLocaleTimeString('fr-FR')}) :

${lines}

Fournis 3 recommandations opérationnelles concrètes et prioritaires pour améliorer la fluidité.
Réponds en français, sois direct, précis et pratique. Format : numéroté 1. 2. 3.`
}

export function buildChatPrompt(question, mesures, axes) {
  const ctx = axes.map(a => {
    const m = mesures[a.id]
    return m ? `${a.shortNom}: ${m.tempsLive?.toFixed(1)} min, niveau ${m.niveau}/5` : `${a.shortNom}: N/A`
  }).join(' | ')

  return `Contexte trafic PAA Abidjan: ${ctx}

Question: ${question}

Réponds en français, de façon concise et pratique.`
}
