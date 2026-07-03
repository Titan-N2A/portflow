// ============================================================
// FloatingAIAssistant.jsx — Raccourci flottant vers l'assistant IA
// (bouton "étincelle" façon Notion AI / Copilot / Gemini). Ouvre une
// bulle de chat compacte sans quitter la page, avec saisie vocale
// (Web Speech API, gratuit, natif navigateur). Partage la même
// conversation que la page IA FlowPort via useAIChat.
// ============================================================

import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Mic } from 'lucide-react'
import { C } from '../../styles/tokens'
import { useAIChat } from '../../hooks/useAIChat'
import { CONSENT_KEY, CONSENT_EVENT } from './ConsentBanner'

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

function MiniBubble({ msg }) {
  const isAI = msg.role === 'model'
  const text = msg.parts[0].text
  return (
    <div style={{ display: 'flex', justifyContent: isAI ? 'flex-start' : 'flex-end', marginBottom: 8 }}>
      <div style={{
        maxWidth: '85%', padding: '0.55rem 0.75rem',
        background: isAI ? '#fff' : C.sidebarActive,
        color: isAI ? C.text : '#fff',
        borderRadius: isAI ? '4px 10px 10px 10px' : '10px 4px 10px 10px',
        fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-line',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: isAI ? '1px solid #e2e8f0' : 'none',
      }}>
        {text}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{
      display: 'inline-flex', gap: 4, padding: '0.55rem 0.8rem',
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px 10px 10px 10px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: C.textMuted,
          animation: `fp-pulse 1.2s ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  )
}

function FloatingAIAssistant({ axes, mesures, kpis }) {
  const [open,          setOpen]          = useState(false)
  const [input,         setInput]         = useState('')
  const [listening,     setListening]     = useState(false)
  // Le bandeau de consentement géoloc (position:fixed, bas d'écran, z-index
  // supérieur) chevaucherait le bouton flottant tant que l'utilisateur n'a
  // pas décidé — on masque le raccourci IA jusqu'à sa disparition.
  const [bannerPending, setBannerPending] = useState(() => !sessionStorage.getItem(CONSENT_KEY))
  const { history, sending, sendMessage } = useAIChat(axes, mesures, kpis)
  const bottomRef       = useRef(null)
  const recognitionRef  = useRef(null)

  useEffect(() => {
    const handle = () => setBannerPending(false)
    window.addEventListener(CONSENT_EVENT, handle)
    return () => window.removeEventListener(CONSENT_EVENT, handle)
  }, [])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, sending, open])

  // Coupe l'écoute si le panneau se ferme pendant une dictée
  useEffect(() => {
    if (!open) recognitionRef.current?.stop()
  }, [open])

  function handleSend(text) {
    setInput('')
    sendMessage(text)
  }

  function toggleListening() {
    if (!SpeechRecognitionAPI) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = new SpeechRecognitionAPI()
    rec.lang            = 'fr-FR'
    rec.interimResults   = false
    rec.maxAlternatives  = 1
    rec.onresult = e => {
      const transcript = e.results?.[0]?.[0]?.transcript?.trim()
      if (transcript) handleSend(transcript)
    }
    rec.onerror = () => setListening(false)
    rec.onend   = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  if (bannerPending) return null

  return (
    <>
      {open && (
        <div className="fp-fade-in" style={{
          position: 'fixed', bottom: 92, right: 20, zIndex: 2100,
          width: 360, maxWidth: 'calc(100vw - 24px)',
          height: 480, maxHeight: 'calc(100vh - 130px)',
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          border: '1px solid #e2e8f0', boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* En-tête */}
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
            padding: '0.75rem 0.9rem', background: C.sidebarActive,
          }}>
            <Sparkles size={15} color="#fff" />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>FlowPort IA</span>
            <button onClick={() => setOpen(false)} style={{
              marginLeft: 'auto', background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: 6, cursor: 'pointer', color: '#fff', display: 'flex', padding: 5,
            }}>
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0.85rem', background: '#F8FAFC' }}>
            {history.map((msg, i) => <MiniBubble key={i} msg={msg} />)}
            {sending && <TypingDots />}
            <div ref={bottomRef} />
          </div>

          {/* Saisie */}
          <div style={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', padding: '0.55rem', display: 'flex', gap: 6 }}>
            <input
              className="fp-input"
              style={{ fontSize: 12.5, padding: '0.5rem 0.7rem' }}
              placeholder={listening ? 'Je vous écoute...' : 'Posez votre question...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !sending && handleSend(input)}
              disabled={sending}
            />
            {SpeechRecognitionAPI && (
              <button
                onClick={toggleListening}
                title={listening ? 'Arrêter la dictée' : 'Poser la question à la voix'}
                style={{
                  flexShrink: 0, width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${listening ? C.danger : '#e2e8f0'}`,
                  background: listening ? '#FDECEC' : '#F1F5F9',
                  color: listening ? C.danger : C.textMuted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Mic size={15} className={listening ? 'fp-mic-rec' : ''} />
              </button>
            )}
            <button
              className="fp-btn fp-btn-primary"
              style={{ flexShrink: 0, padding: '0.5rem 0.65rem' }}
              onClick={() => handleSend(input)}
              disabled={sending || !input.trim()}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bouton flottant */}
      <button
        className="fp-ai-fab"
        onClick={() => setOpen(o => !o)}
        title="Assistant IA FlowPort"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 2100,
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: C.sidebarActive, boxShadow: '0 4px 20px rgba(27,79,138,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {open ? <X size={22} color="#fff" /> : <Sparkles size={22} color="#fff" />}
      </button>
    </>
  )
}

export default FloatingAIAssistant
