// ============================================================
// InstallPWA.jsx — Bouton « Installer l'application »
// Chrome/Edge/Android : capte l'événement beforeinstallprompt et
// déclenche l'invite native (raccourci bureau / écran d'accueil).
// iOS Safari (pas d'invite native) : affiche la marche à suivre
// (Partager → « Sur l'écran d'accueil »).
// Rendu nul si l'app tourne déjà en mode installé (standalone).
// ============================================================

import { useState, useEffect } from 'react'
import { MonitorDown, X } from 'lucide-react'

const estStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

const estIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent)

export default function InstallPWA({ variant = 'sidebar' }) {
  // L'événement beforeinstallprompt est capté par le script inline
  // d'index.html (window.__fpInstallEvent) : Chrome l'émet souvent
  // avant le montage de React. Ici on ne fait que le récupérer.
  const [invite,    setInvite]    = useState(() => window.__fpInstallEvent ?? null)
  const [installee, setInstallee] = useState(() => estStandalone())
  const [aideIOS,   setAideIOS]   = useState(false)

  useEffect(() => {
    const surInvite  = () => setInvite(window.__fpInstallEvent ?? null)
    const surInstall = () => { setInvite(null); setInstallee(true); window.__fpInstallEvent = null }
    window.addEventListener('fp-install-ready', surInvite)
    window.addEventListener('appinstalled', surInstall)
    return () => {
      window.removeEventListener('fp-install-ready', surInvite)
      window.removeEventListener('appinstalled', surInstall)
    }
  }, [])

  if (installee) return null
  const ios = estIOS()
  if (!invite && !ios) return null   // navigateur sans invite (ou déjà refusée)

  async function installer() {
    if (ios) { setAideIOS(v => !v); return }
    invite.prompt()
    const { outcome } = await invite.userChoice
    if (outcome === 'accepted') setInvite(null)
  }

  const compact = variant === 'mobile'

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={installer}
        title="Installer FlowPort sur cet appareil"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: compact ? 'auto' : '100%',
          padding: compact ? '5px 10px' : '0.55rem 0.75rem',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 8, cursor: 'pointer',
          color: 'rgba(255,255,255,0.85)',
          fontSize: compact ? 11 : 12, fontWeight: 600,
          fontFamily: "'Inter',sans-serif",
        }}
      >
        <MonitorDown size={compact ? 12 : 14} />
        {compact ? 'Installer' : "Installer l'application"}
      </button>

      {/* Marche à suivre iOS (pas d'invite native possible).
          Sidebar (en bas d'écran) : bulle vers le haut ; header
          mobile (en haut d'écran) : bulle vers le bas. */}
      {aideIOS && (
        <div style={{
          position: 'absolute',
          ...(compact
            ? { top: 'calc(100% + 8px)', right: 0 }
            : { bottom: 'calc(100% + 8px)', left: 0, right: 0 }),
          minWidth: 230, zIndex: 500,
          background: '#fff', borderRadius: 10, padding: '0.8rem 0.9rem',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)', color: '#2C3E50',
          fontSize: 12, lineHeight: 1.6, fontFamily: "'Inter',sans-serif",
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <strong style={{ fontSize: 12 }}>Installer sur iPhone / iPad</strong>
            <button onClick={() => setAideIOS(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8395a7', padding: 2 }}>
              <X size={13} />
            </button>
          </div>
          1. Touchez <strong>Partager</strong> (carré avec flèche ↑) dans Safari<br />
          2. Choisissez <strong>« Sur l'écran d'accueil »</strong><br />
          3. Confirmez — l'icône FlowPort apparaît sur l'écran d'accueil.
        </div>
      )}
    </div>
  )
}
