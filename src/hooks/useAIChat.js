// ============================================================
// useAIChat.js — État partagé de la conversation avec l'assistant
// IA (historique persisté, envoi de message). Utilisé par la page
// IA FlowPort et par le raccourci flottant (FloatingAIAssistant),
// qui partagent la même conversation (sessionStorage 'fp_ia_history')
// pour que l'utilisateur retrouve son fil peu importe où il pose sa
// question.
// ============================================================

import { useState, useEffect } from 'react'
import { askAI, buildChatContents } from '../services/ai'

export function makeWelcome(axes) {
  const names = axes.length > 0 ? axes.map(a => a.shortNom).join(', ') : 'CARENA, Toyota CFAO, SODECI'
  const count = axes.length > 0 ? axes.length : 3
  return {
    role: 'model',
    parts: [{ text: `Bonjour ! Je suis FlowPort IA, votre assistant de surveillance du trafic au Port Autonome d'Abidjan.\n\nJe dispose des données trafic en temps réel sur les ${count} axes d'accès au port (${names}). Posez-moi vos questions — état actuel, recommandations opérationnelles, prévisions ou analyse d'un axe spécifique.` }],
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
    return [makeWelcome(axes)]
  })
  const [sending, setSending] = useState(false)

  // Met à jour le message d'accueil quand les axes Firestore arrivent
  useEffect(() => {
    if (axes.length > 0) {
      setHistory(prev => [makeWelcome(axes), ...prev.slice(1)])
    }
  }, [axes.length])

  useEffect(() => {
    try {
      sessionStorage.setItem('fp_ia_history', JSON.stringify(history))
    } catch {
      // quota sessionStorage dépassé — persistance best-effort
    }
  }, [history])

  async function sendMessage(text) {
    const q = text.trim()
    if (!q || sending) return
    const userMsg = { role: 'user', parts: [{ text: q }] }
    setHistory(prev => [...prev, userMsg])
    setSending(true)

    // NB: on passe `history` sans userMsg — buildChatContents l'ajoute lui-même avec le contexte trafic
    const contents = buildChatContents(history, q, mesures, axes, kpis)
    const resp = await askAI(contents)

    setHistory(prev => [...prev, {
      role: 'model',
      parts: [{ text: resp ?? 'Erreur : réponse vide.' }],
    }])
    setSending(false)
  }

  return { history, sending, sendMessage }
}
