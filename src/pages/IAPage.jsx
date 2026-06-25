import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, RefreshCw, Zap } from 'lucide-react'
import { C } from '../styles/tokens'
import { askGemini, buildChatPrompt, buildTrafficPrompt } from '../services/gemini'
import { useTrafficData, AXES_OFFICIELS } from '../hooks/useTrafficData'
import { useIsMobile } from '../hooks/useIsMobile'

const SUGGESTIONS = [
  'Quels sont les axes les plus congestionnés en ce moment ?',
  'Quelle heure est recommandée pour éviter les embouteillages ?',
  'Donne-moi des alternatives pour l\'axe CARENA ce soir.',
]

function Bubble({ msg }) {
  const isAI = msg.role === 'ai'
  return (
    <div style={{
      display: 'flex', gap: '10px',
      justifyContent: isAI ? 'flex-start' : 'flex-end',
      alignItems: 'flex-end',
      marginBottom: '0.75rem',
    }}>
      {isAI && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: C.sidebarActive,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Bot size={15} color="#fff" />
        </div>
      )}
      <div style={{
        maxWidth: '72%', padding: '0.65rem 0.95rem',
        background: isAI ? '#fff' : C.sidebarActive,
        color: isAI ? C.text : '#fff',
        borderRadius: isAI ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
        fontSize: 13, lineHeight: 1.65,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        whiteSpace: 'pre-line',
        border: isAI ? '1px solid #e2e8f0' : 'none',
      }}>
        {msg.text}
      </div>
      {!isAI && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <User size={15} color={C.textMuted} />
        </div>
      )}
    </div>
  )
}

function IAPage() {
  const isMobile = useIsMobile()
  const { mesures, loading } = useTrafficData()
  const [messages,   setMessages]   = useState([{
    role: 'ai',
    text: 'Bonjour ! Je suis l\'IA FlowPort, votre assistant trafic pour le Port Autonome d\'Abidjan.\n\nPosez-moi vos questions sur l\'état du trafic, les recommandations ou les prévisions.',
  }])
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [autoReco,   setAutoReco]   = useState('')
  const [recoLoad,   setRecoLoad]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadAutoReco() {
    setRecoLoad(true)
    const resp = await askGemini(buildTrafficPrompt(mesures, AXES_OFFICIELS))
    setAutoReco(resp ?? 'Service IA indisponible.')
    setRecoLoad(false)
  }

  useEffect(() => {
    if (!loading && Object.keys(mesures).length > 0 && !autoReco) loadAutoReco()
  }, [loading])

  async function sendMessage(text) {
    const q = text.trim()
    if (!q) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setSending(true)
    const prompt = buildChatPrompt(q, mesures, AXES_OFFICIELS)
    const resp   = await askGemini(prompt)
    setMessages(prev => [...prev, {
      role: 'ai',
      text: resp ?? 'Je n\'ai pas pu obtenir une réponse. Veuillez réessayer.',
    }])
    setSending(false)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: isMobile ? '100%' : '100vh',
      overflow: 'hidden',
      padding: isMobile ? '0.85rem' : '1.25rem',
      gap: '0.85rem',
    }}>

      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>IA FlowPort</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Assistant intelligent basé sur Gemini · gemini-1.5-flash</p>
      </div>

      {/* ── Recommandations automatiques ───────────────────── */}
      {(autoReco || recoLoad) && (
        <div className="fp-card" style={{ flexShrink: 0, padding: '0.9rem 1rem', borderLeft: `3px solid ${C.primary}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
            <Zap size={13} color={C.primary} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Recommandations automatiques
            </span>
            <button onClick={loadAutoReco} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
              <RefreshCw size={12} className={recoLoad ? 'fp-spin' : ''} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {recoLoad ? 'Génération en cours...' : autoReco}
          </p>
        </div>
      )}

      {/* ── Suggestions ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
        {SUGGESTIONS.map((s, i) => (
          <button key={i} onClick={() => sendMessage(s)} style={{
            padding: '0.4rem 0.85rem',
            background: '#EBF2FB', color: C.primary,
            border: '1px solid #CDDFF5',
            borderRadius: '20px', cursor: 'pointer',
            fontSize: 12, fontWeight: 500, fontFamily: "'Inter', sans-serif",
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#D6E7F7'}
          onMouseLeave={e => e.currentTarget.style.background = '#EBF2FB'}>
            {s}
          </button>
        ))}
      </div>

      {/* ── Zone messages ─────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', background: '#F8FAFC', borderRadius: '10px', padding: '1rem', border: '1px solid #e2e8f0' }}>
        {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
        {sending && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.sidebarActive, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={15} color="#fff" />
            </div>
            <div style={{ background: '#fff', padding: '0.65rem 1rem', borderRadius: '4px 12px 12px 12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <span style={{ color: C.textMuted, fontSize: 13 }}>Réflexion en cours...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Zone saisie ────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', gap: '0.6rem' }}>
        <input
          className="fp-input"
          placeholder="Posez votre question sur le trafic PAA..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !sending && sendMessage(input)}
          disabled={sending}
        />
        <button
          className="fp-btn fp-btn-primary"
          style={{ flexShrink: 0, padding: isMobile ? '0.55rem 0.85rem' : '0.55rem 1.1rem' }}
          onClick={() => sendMessage(input)}
          disabled={sending || !input.trim()}
        >
          <Send size={15} />
          {!isMobile && 'Envoyer'}
        </button>
      </div>
    </div>
  )
}

export default IAPage
