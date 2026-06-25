// ============================================================
// useAuth.js — Hook React d'authentification
// Version corrigée : gère les erreurs de lecture du rôle
// pour ne jamais bloquer l'état "loading" indéfiniment.
// ============================================================

import { useState, useEffect } from 'react'
import { watchAuthState, getUserRole, logOut } from '../services/auth'

export function useAuth() {
  const [user,    setUser]    = useState(null)
  const [role,    setRole]    = useState('public')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = watchAuthState(async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        try {
          const { role: r, actif } = await getUserRole(firebaseUser.uid)
          if (!actif) {
            await logOut()
            return
          }
          setRole(r)
        } catch (err) {
          console.error('❌ Erreur lecture rôle Firestore :', err)
          setRole('public')
        }
      } else {
        setRole('public')
      }

      setLoading(false) // s'exécute toujours, même en cas d'erreur
    })

    return unsubscribe
  }, [])

  return {
    user,
    role,
    isAdmin:    role === 'admin',
    isLoggedIn: !!user,
    loading,
  }
}