const GEMINI_KEY   = import.meta.env.VITE_GEMINI_API_KEY ?? ''
const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`

// ── Instruction système — contexte PAA complet ────────────
const SYSTEM_INSTRUCTION = `Tu es FlowPort IA, l'assistant de surveillance du trafic routier du Port Autonome d'Abidjan (PAA), Côte d'Ivoire. Tu travailles pour la DEESP (Direction des Études et de l'Exploitation du Port).

CONTEXTE OPÉRATIONNEL :
Le PAA est le premier port d'Afrique de l'Ouest. Il traite conteneurs, marchandises en vrac, hydrocarbures et véhicules. Les axes routiers d'accès sont critiques : une congestion retarde les camions, allonge les rotations, perturbe les escales et impacte les chaînes logistiques nationales. Le PAA a fixé des temps de référence (T_ref) pour chaque axe — l'écart par rapport à ces références est l'indicateur central de performance.

AXES SURVEILLÉS PAR FLOWPORT :
• Axe CARENA (Axe 1) : CARENA (Plateau) → Pharmacie Palm Beach — 12,4 km — T_ref : 27,4 min — bidirectionnel (aller + retour). Principal axe d'accès depuis le centre-ville d'Abidjan.
• Axe Toyota CFAO (Axe 2) : Toyota CFAO → Pharmacie Palm Beach — 7,0 km — T_ref : 16,9 min. Axe depuis le boulevard de Marseille, majoritairement utilisé par les poids lourds.
• Axe SODECI (Axe 3) : SODECI → Pharmacie Palm Beach — 10,9 km — T_ref : 17,8 min. Dessert la zone industrielle de Vridi et les terminaux pétroliers.
→ Les 3 axes convergent vers la Pharmacie Palm Beach, point de convergence principale d'accès au port.

NIVEAUX DE CONGESTION (ratio = temps_live / T_ref) :
N1 — Fluide        (ratio ≤ 1,10) : circulation normale. Aucune action.
N2 — Bon           (ratio 1,10–1,25) : légère densification. Surveillance accrue.
N3 — Ralenti       (ratio 1,25–1,50) : ralentissement notable. Alerte ORANGE — action préventive immédiate.
N4 — Congestionné  (ratio 1,50–2,00) : embouteillage significatif. Alerte ROUGE — intervention urgente.
N5 — Très congestionné (ratio > 2,00) : paralysie partielle. URGENCE — activation cellule de crise.

HEURES DE POINTE TYPIQUES À ABIDJAN :
- Matin : 6h30–9h30 (entrée port, trafic domicile-travail, premiers camions)
- Déjeuner : 12h00–13h30 (rotation camions, livraisons industrielles)
- Soir : 16h30–19h30 (sorties port, retour domicile, dernier flux camions)
- Nuits et week-ends : trafic généralement fluide

COMMENT FORMULER TES RÉPONSES :
- Cite toujours les axes par leur nom (CARENA, Toyota CFAO, SODECI) et leurs valeurs réelles
- Mentionne le niveau, le ratio et le retard en minutes — pas de généralités
- Identifie la cause probable selon l'heure (pointe, hors-pointe, événement)
- Propose des actions concrètes et hiérarchisées : régulation carrefours, signalétique variable, notification transporteurs via VHF/SMS, déploiement agents, itinéraires alternatifs
- Ne formule jamais de recommandations génériques qui s'appliqueraient sans les données — chaque réponse doit être ancrée dans les chiffres fournis
- Adapte la longueur : bref pour les questions simples, structuré pour les analyses complexes
- Vocabulaire professionnel portuaire : "flux camions", "rotation", "escale", "terminal", "portique", "quai", "entrée port", "hinterland"

Réponds en français professionnel. Sois direct, précis, opérationnel.`

// ── Appel API Gemini (single ou multi-turn) ───────────────
export async function askGemini(contents, { temperature = 0.85, maxTokens = 1000 } = {}) {
  if (!GEMINI_KEY) return 'Clé API Gemini non configurée (VITE_GEMINI_API_KEY).'
  try {
    const payload = {
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: typeof contents === 'string'
        ? [{ role: 'user', parts: [{ text: contents }] }]
        : contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      throw new Error(`HTTP ${res.status} — ${errBody?.error?.message?.slice(0, 120) ?? ''}`)
    }
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Aucune réponse générée.'
  } catch (err) {
    console.error('Gemini error:', err)
    return `Erreur IA : ${err.message}`
  }
}

// ── Contexte trafic courant (injecté dans chaque prompt) ──
function buildDataContext(mesures, axes, kpis) {
  const now   = new Date()
  const heure = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const jour  = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const h     = now.getHours()
  const isPointe = (h >= 6 && h < 10) || (h >= 12 && h < 14) || (h >= 16 && h < 20)

  const lignes = axes.map(a => {
    const m = mesures[a.id]
    if (!m) return `• ${a.shortNom} : données indisponibles`
    const ratio  = (m.tempsLive / (a.tRef ?? 20)).toFixed(2)
    const retard = m.retard >= 0 ? `+${m.retard.toFixed(1)}` : `${m.retard.toFixed(1)}`
    const src    = m.simulated ? ' [simulé]' : ''
    return `• ${a.shortNom} : ${m.tempsLive.toFixed(1)} min (T_ref ${a.tRef} min) — ratio ×${ratio} — N${m.niveau}/5 — retard ${retard} min — ${m.vitesse} km/h${src}`
  }).join('\n')

  const kpiBlock = kpis
    ? `KPIs : temps moyen ${kpis.tempsGlobal} min · retard moyen +${kpis.retardMoyen} min · vitesse ${kpis.vitesseMoyenne} km/h · axes dégradés ${kpis.pctCong}%${kpis.tronconCritique ? ` · tronçon critique : ${kpis.tronconCritique.nom}` : ''}`
    : ''

  return `[DONNÉES TEMPS RÉEL — ${heure}, ${jour}${isPointe ? ' — ⚠ HEURE DE POINTE' : ''}]\n${lignes}\n${kpiBlock}`
}

// ── Prompt auto-recommandations (widget dashboard + IA) ───
export function buildTrafficPrompt(mesures, axes, kpis) {
  const ctx = buildDataContext(mesures, axes, kpis)
  return `${ctx}

Sur la base de ces données précises, formule 3 recommandations opérationnelles prioritaires pour la DEESP. Pour chaque recommandation : cite l'axe concerné, le niveau de congestion, et l'action concrète à mener maintenant. Sois spécifique aux valeurs observées, pas générique.`
}

// ── Construction des messages multi-tour pour le chat ─────
// history = tableau [{role: 'user'|'model', parts: [{text}]}]
// newQuestion = string
export function buildChatContents(history, newQuestion, mesures, axes, kpis) {
  const dataCtx = buildDataContext(mesures, axes, kpis)

  // Historique existant (sans le message d'accueil initial)
  const turns = history.slice(1).map(msg => ({
    role:  msg.role,
    parts: [{ text: msg.parts[0].text }],
  }))

  // Nouvelle question avec contexte trafic injecté
  turns.push({
    role:  'user',
    parts: [{ text: `${dataCtx}\n\n${newQuestion}` }],
  })

  return turns
}
