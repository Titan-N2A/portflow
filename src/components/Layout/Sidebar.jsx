import { LayoutDashboard, BarChart2, FileText, Settings, Bot, Download, LogOut, Lock } from 'lucide-react'
import { C } from '../../styles/tokens'
import logoPAA from '../../assets/logo_port.png'
import InstallPWA from '../shared/InstallPWA'

// Grand public : Dashboard + IA uniquement
const NAV_PUBLIC = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard'   },
  { id: 'ia',        icon: Bot,             label: 'IA FlowPort' },
]

// Utilisateurs connectés : + Graphiques, Rapports, Export
const NAV_USER = [
  { id: 'dashboard',  icon: LayoutDashboard, label: 'Dashboard'   },
  { id: 'graphiques', icon: BarChart2,        label: 'Graphiques'  },
  { id: 'rapports',   icon: FileText,         label: 'Rapports'    },
  { id: 'export',     icon: Download,         label: 'Export'      },
  { id: 'ia',         icon: Bot,              label: 'IA FlowPort' },
]

// Administrateurs : + Administration
const NAV_ADMIN = [
  ...NAV_USER,
  { id: 'admin', icon: Settings, label: 'Administration' },
]

function NavItem({ item, active, onClick }) {
  const Icon = item.icon
  return (
    <button
      onClick={() => onClick(item.id)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '10px',
        width:        '100%',
        padding:      '0.65rem 1rem',
        background:   active ? C.sidebarActive : 'transparent',
        border:       'none',
        borderRadius: '8px',
        color:        active ? '#fff' : C.sidebarText,
        fontSize:     '13px',
        fontWeight:   active ? 600 : 400,
        fontFamily:   "'Inter', sans-serif",
        cursor:       'pointer',
        transition:   'all 0.15s ease',
        textAlign:    'left',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.sidebarHover }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'  }}
    >
      <Icon size={16} style={{ flexShrink: 0 }} />
      {item.label}
    </button>
  )
}

function Sidebar({ currentPage, onNavigate, onLogout, onLogin, isAdmin = false, user = null }) {
  const NAV = isAdmin ? NAV_ADMIN : user ? NAV_USER : NAV_PUBLIC
  return (
    <aside style={{
      width:         '200px',
      minWidth:      '200px',
      height:        '100vh',
      position:      'sticky',
      top:           0,
      background:    C.sidebar,
      display:       'flex',
      flexDirection: 'column',
      overflow:      'hidden',
      flexShrink:    0,
      zIndex:        100,
    }}>

      {/* ── Logo ─────────────────────────────────────────── */}
      <div style={{
        padding:      '1.1rem 1rem 0.9rem',
        borderBottom: `1px solid ${C.sidebarBorder}`,
        display:      'flex',
        flexDirection:'column',
        alignItems:   'center',
        gap:          '0.5rem',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,0.93)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, overflow: 'hidden',
        }}>
          <img src={logoPAA} alt="Port Autonome d'Abidjan" style={{ width: 68, height: 68, objectFit: 'contain' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{
            color:         '#fff',
            fontWeight:    800,
            fontSize:      '15px',
            letterSpacing: '-0.3px',
            fontFamily:    "'Inter', sans-serif",
            display:       'block',
          }}>
            FlowPort
          </span>
          <p style={{
            color:      C.sidebarMuted,
            fontSize:   '10px',
            fontFamily: "'Inter', sans-serif",
            margin:     0,
          }}>
            PAA · Trafic Routier
          </p>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav style={{ flex: 1, padding: '0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {NAV.map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={currentPage === item.id}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────── */}
      <div style={{
        padding:   '0.9rem 1rem',
        borderTop: `1px solid ${C.sidebarBorder}`,
      }}>
        {/* Installation PWA (masqué si déjà installée) */}
        <div style={{ marginBottom: '0.75rem' }}>
          <InstallPWA />
        </div>
        {user ? (
          <>
            {/* Avatar utilisateur connecté */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '0.75rem' }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: C.sidebarActive,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                color: '#fff', fontWeight: 700, fontSize: '13px',
                fontFamily: "'Inter', sans-serif",
              }}>
                {(user.email?.[0] ?? 'U').toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  color: '#fff', fontSize: '11px', fontWeight: 600,
                  fontFamily: "'Inter', sans-serif",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user.email}
                </div>
                <div style={{ color: C.sidebarMuted, fontSize: '10px', fontFamily: "'Inter', sans-serif" }}>
                  {isAdmin ? 'Administrateur' : 'Opérateur'}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              style={{
                display:    'flex', alignItems: 'center', gap: '7px',
                width:      '100%', padding:    '0.45rem 0.75rem',
                background: 'rgba(192,57,43,0.2)',
                border:     '1px solid rgba(192,57,43,0.35)',
                borderRadius: '7px',
                color:      '#e57373',
                fontSize:   '12px', fontWeight: 500,
                fontFamily: "'Inter', sans-serif",
                cursor:     'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,57,43,0.3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(192,57,43,0.2)'}
            >
              <LogOut size={13} />
              Déconnexion
            </button>
          </>
        ) : (
          /* Bouton connexion pour les visiteurs */
          <button
            onClick={onLogin}
            style={{
              display:    'flex', alignItems: 'center', gap: '7px',
              width:      '100%', padding:    '0.45rem 0.75rem',
              background: 'rgba(255,255,255,0.07)',
              border:     '1px solid rgba(255,255,255,0.15)',
              borderRadius: '7px',
              color:      C.sidebarMuted,
              fontSize:   '12px', fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              cursor:     'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
              e.currentTarget.style.color = C.sidebarMuted
            }}
          >
            <Lock size={13} />
            Connexion admin
          </button>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
