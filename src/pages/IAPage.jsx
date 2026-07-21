import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Bot, User, RefreshCw, Zap, RotateCcw } from 'lucide-react'
import { C } from '../styles/tokens'
import { askAI, buildTrafficPrompt } from '../services/ai'
import { getCachedAI, setCachedAI, clearCachedAI } from '../utils/aiCache'
import { useAIChat } from '../hooks/useAIChat'
import { useTrafficData, AXES_OFFICIELS } from '../hooks/useTrafficData'
import { useAxesFirestore } from '../hooks/useAxesFirestore'
import { useIsMobile } from '../hooks/useIsMobile'
import AIText from '../components/shared/AIText'

// Suggestions adaptées à l'état live du réseau : un axe dégradé fait
// surgir des questions ciblées sur lui, un réseau fluide oriente vers
// l'anticipation (prévisions, comparaison à la normale récente).
function suggestionsContextuelles(axes, mesures) {
  const sugg = []
  const lectures = axes.map(a => ({ a, m: mesures[a.id] })).filter(({ m }) => m)
  const pire = [...lectures].sort((x, y) => (y.m.niveau ?? 0) - (x.m.niveau ?? 0))[0]

  if (pire && pire.m.niveau >= 3) {
    sugg.push(`Pourquoi l'axe ${pire.a.shortNom} est-il en N${pire.m.niveau} en ce moment ?`)
    sugg.push(`Quel itinéraire alternatif à ${pire.a.shortNom} recommander aux camions ?`)
  } else {
    sugg.push('Quel est l\'état du trafic en ce moment ?')
    sugg.push('Quel axe emprunter pour rejoindre le port rapidement ?')
  }
  const retourCharge = lectures.find(({ m }) => (m.niveauRetour ?? 0) >= 3)
  if (retourCharge) {
    sugg.push(`Le retour ${retourCharge.a.shortNom} est chargé — quelles actions immédiates ?`)
  }
  sugg.push('Quels créneaux éviter aujourd\'hui selon les prévisions ?')
  sugg.push('Compare le trafic actuel à la normale des 7 derniers jours.')
  return sugg.slice(0, 4)
}

function Bubble({ msg }) {
  const isAI  = msg.role === 'model'
  const text  = msg.parts[0].text
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
        maxWidth: '75%', padding: '0.65rem 0.95rem',
        background: isAI ? '#fff' : C.sidebarActive,
        color: isAI ? C.text : '#fff',
        borderRadius: isAI ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
        fontSize: 13, lineHeight: 1.7,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        whiteSpace: 'pre-line',
        border: isAI ? '1px solid #e2e8f0' : 'none',
      }}>
        {isAI ? <AIText text={text} /> : text}
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
  const { axes: firestoreAxes } = useAxesFirestore()

  const axes = firestoreAxes.length > 0 ? firestoreAxes : AXES_OFFICIELS
  const { mesures, kpis, loading } = useTrafficData(axes)

  const { history, sending, sendMessage, resetConversation } = useAIChat(axes, mesures, kpis)
  const [input,    setInput]    = useState('')
  const [autoReco, setAutoReco] = useState('')
  const [recoLoad, setRecoLoad] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, sending])

  async function loadAutoReco(force = false) {
    if (!force) {
      const cached = getCachedAI('fp_autoreco')
      if (cached) { setAutoReco(cached); return }
    }
    setRecoLoad(true)
    const prompt = await buildTrafficPrompt(mesures, axes, kpis)
    const resp   = await askAI(prompt)
    const text   = resp ?? 'Erreur : réponse vide.'
    setAutoReco(text)
    setCachedAI('fp_autoreco', text)
    setRecoLoad(false)
  }

  useEffect(() => {
    if (!loading && Object.keys(mesures).length > 0 && !autoReco) loadAutoReco()
  }, [loading])

  function handleSend(text) {
    setInput('')
    sendMessage(text)
  }

  const suggestions = useMemo(() => suggestionsContextuelles(axes, mesures), [axes, mesures])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: isMobile ? '100%' : '100vh',
      overflow: 'hidden',
      padding: isMobile ? '0.85rem' : '1.25rem',
      gap: '0.85rem',
    }}>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: C.text }}>IA FlowPort</h1>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
            Assistant trafic PAA · Groq (Llama 3.3) · données temps réel
          </p>
        </div>
        {history.length > 1 && (
          <button
            onClick={resetConversation}
            disabled={sending}
            title="Nouvelle conversation"
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              padding: '0.35rem 0.7rem', borderRadius: 8,
              border: '1px solid #e2e8f0', background: '#fff',
              color: C.textMuted, cursor: sending ? 'not-allowed' : 'pointer',
              fontSize: 11.5, fontWeight: 600, fontFamily: "'Inter', sans-serif",
            }}
          >
            <RotateCcw size={13} />
            {!isMobile && 'Nouvelle conversation'}
          </button>
        )}
      </div>

      {/* ── Recommandations automatiques ─────────────────── */}
      {(autoReco || recoLoad) && (
        <div className="fp-card" style={{ flexShrink: 1, minHeight: 0, maxHeight: isMobile ? '28vh' : '32vh', display: 'flex', flexDirection: 'column', padding: '0.9rem 1rem', borderLeft: `3px solid ${C.primary}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', flexShrink: 0 }}>
            <Zap size={13} color={C.primary} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Analyse & recommandations automatiques
            </span>
            <button onClick={() => { clearCachedAI('fp_autoreco'); loadAutoReco(true) }} disabled={recoLoad}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
              <RefreshCw size={12} className={recoLoad ? 'fp-spin' : ''} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: C.text, lineHeight: 1.75, whiteSpace: 'pre-line', overflow: 'auto', margin: 0 }}>
            {recoLoad ? 'Analyse des données trafic en cours...' : <AIText text={autoReco} />}
          </p>
        </div>
      )}

      {/* ── Suggestions ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => handleSend(s)}
            style={{
              padding: '0.35rem 0.8rem',
              background: '#EBF2FB', color: C.primary,
              border: '1px solid #CDDFF5',
              borderRadius: '20px', cursor: 'pointer',
              fontSize: isMobile ? 11 : 12, fontWeight: 500,
              fontFamily: "'Inter', sans-serif", transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#D6E7F7'}
            onMouseLeave={e => e.currentTarget.style.background = '#EBF2FB'}>
            {s}
          </button>
        ))}
      </div>

      {/* ── Zone messages ────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', background: '#F8FAFC', borderRadius: '10px', padding: '1rem', border: '1px solid #e2e8f0' }}>
        {history.map((msg, i) => <Bubble key={i} msg={msg} />)}
        {sending && history[history.length - 1]?.role !== 'model' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.sidebarActive, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={15} color="#fff" />
            </div>
            <div style={{ background: '#fff', padding: '0.65rem 1rem', borderRadius: '4px 12px 12px 12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: C.textMuted,
                    animation: `fp-pulse 1.2s ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Zone saisie ──────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', gap: '0.6rem' }}>
        <input
          className="fp-input"
          placeholder={isMobile ? 'Votre question...' : 'Posez votre question sur le trafic PAA...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !sending && handleSend(input)}
          disabled={sending}
        />
        <button
          className="fp-btn fp-btn-primary"
          style={{ flexShrink: 0, padding: isMobile ? '0.55rem 0.85rem' : '0.55rem 1.1rem' }}
          onClick={() => handleSend(input)}
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
