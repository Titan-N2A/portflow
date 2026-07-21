// ============================================================
// useAIChat.js — État partagé de la conversation avec l'assistant
// IA (historique persisté, envoi de message). Utilisé par la page
// IA FlowPort et par le raccourci flottant (FloatingAIAssistant),
// qui partagent la même conversation (sessionStorage 'fp_ia_history')
// pour que l'utilisateur retrouve son fil peu importe où il pose sa
// question.
// ============================================================

import { useState, useEffect } from 'react'
import { askAIStream, buildChatContents } from '../services/ai'

// Message d'accueil volontairement court et convivial : les suggestions
// contextuelles (chips) montrent déjà ce que l'assistant sait faire, donc
// pas besoin d'énumérer les axes ni les cas d'usage ici.
export function makeWelcome() {
  return {
    role: 'model',
    parts: [{ text: "Bonjour 👋 Je suis **FlowPort IA**, votre assistant de surveillance du trafic au Port Autonome d'Abidjan. Comment puis-je vous aider ?" }],
  }
}

export function useAIChat(axes, mesures, kpis) {
  const [history, setHistory] = useState(() => {
    try {
      const saved = sessionStorage.getItem('fp_ia_history')
      if (saved) return JSON.parse(saved)
    } catch {
      // sessionStorage corrompu ou indisponible — repart d'un historique neuf
    }
    return [makeWelcome()]
  })
  const [sending, setSending] = useState(false)

  useEffect(() => {
    try {
      sessionStorage.setItem('fp_ia_history', JSON.stringify(history))
    } catch {
      // quota sessionStorage dépassé — persistance best-effort
    }
  }, [history])

  // Remplace la dernière bulle assistant, ou l'ajoute si le dernier
  // message est encore celui de l'utilisateur (premier token / erreur).
  function upsertModel(text) {
    setHistory(prev => {
      const next = prev.slice()
      const last = next[next.length - 1]
      const bulle = { role: 'model', parts: [{ text }] }
      if (last?.role === 'model') next[next.length - 1] = bulle
      else next.push(bulle)
      return next
    })
  }

  async function sendMessage(text) {
    const q = text.trim()
    if (!q || sending) return
    setHistory(prev => [...prev, { role: 'user', parts: [{ text: q }] }])
    setSending(true)

    // NB: on passe `history` sans le message courant — buildChatContents l'ajoute lui-même avec le contexte trafic
    const contents = await buildChatContents(history, q, mesures, axes, kpis)
    let acc = ''
    const resp = await askAIStream(contents, delta => { acc += delta; upsertModel(acc) })

    // Texte final (identique au flux en cas de succès ; message d'erreur si le flux a échoué avant tout token)
    upsertModel(resp ?? 'Erreur : réponse vide.')
    setSending(false)
  }

  function resetConversation() {
    try { sessionStorage.removeItem('fp_ia_history') } catch { /* best-effort */ }
    setHistory([makeWelcome()])
  }

  return { history, sending, sendMessage, resetConversation }
}
