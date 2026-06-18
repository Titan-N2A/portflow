// ============================================================
// ProtectedRoute.jsx — Protège une route selon le rôle utilisateur
// Si non connecté ou rôle insuffisant → redirige automatiquement.
// ============================================================

import { Navigate } from 'react-router-dom'
import { useAuth }  from '../../hooks/useAuth'
import { tokens }   from '../../styles/tokens'

function ProtectedRoute({ children, requiredRole = 'admin' }) {
  const { isLoggedIn, role, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '60vh', color: tokens.colors.text.secondary,
      }}>
        Vérification de la session...
      </div>
    )
  }

  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (role !== requiredRole) return <Navigate to="/" replace />

  return children
}

export default ProtectedRoute