import { LayoutDashboard, BarChart2, FileText, Settings, Bot, Download, LogOut, Activity } from 'lucide-react'
import { C } from '../../styles/tokens'

const NAV = [
  { id: 'dashboard',   icon: LayoutDashboard, label: 'Dashboard'      },
  { id: 'graphiques',  icon: BarChart2,        label: 'Graphiques'     },
  { id: 'rapports',    icon: FileText,         label: 'Rapports'       },
  { id: 'admin',       icon: Settings,         label: 'Administration' },
  { id: 'ia',          icon: Bot,              label: 'IA FlowPort'    },
  { id: 'export',      icon: Download,         label: 'Export'         },
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

function Sidebar({ currentPage, onNavigate }) {
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
        padding:      '1.4rem 1rem 1.1rem',
        borderBottom: `1px solid ${C.sidebarBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '8px',
            background: C.sidebarActive,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Activity size={18} color="#fff" />
          </div>
          <span style={{
            color:       '#fff',
            fontWeight:  800,
            fontSize:    '16px',
            letterSpacing: '-0.3px',
            fontFamily:  "'Inter', sans-serif",
          }}>
            FlowPort
          </span>
        </div>
        <p style={{
          color:         C.sidebarMuted,
          fontSize:      '11px',
          fontFamily:    "'Inter', sans-serif",
          paddingLeft:   '40px',
          letterSpacing: '0.02em',
        }}>
          PAA · Trafic Routier
        </p>
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
        {/* Avatar admin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '0.75rem' }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: C.sidebarActive,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            color: '#fff', fontWeight: 700, fontSize: '13px',
            fontFamily: "'Inter', sans-serif",
          }}>
            A
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '12px', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
              Admin
            </div>
            <div style={{ color: C.sidebarMuted, fontSize: '11px', fontFamily: "'Inter', sans-serif" }}>
              Administrateur
            </div>
          </div>
        </div>

        <button
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
      </div>
    </aside>
  )
}

export default Sidebar
