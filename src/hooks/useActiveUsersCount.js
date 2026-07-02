// ============================================================
// useActiveUsersCount.js — Compteur d'usagers en direct (public)
// Lit "utilisateurs_live" en temps réel et compte les sessions
// actives (< 5 min d'inactivité). Indépendant du cycle de
// rafraîchissement de useTrafficData — se met à jour dès qu'une
// session apparaît/disparaît, sans attendre les 2 minutes.
// ============================================================

import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'

const COL         = 'utilisateurs_live'
const INACTIVE_MS = 5 * 60 * 1000
const TICK_MS     = 15 * 1000 // réévalue l'expiration même sans nouvelle écriture

function toMillis(ts) {
  if (!ts) return null
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts === 'string') return new Date(ts).getTime()
  return null
}

export function useActiveUsersCount() {
  const [timestamps, setTimestamps] = useState([])
  const [now,        setNow]        = useState(() => Date.now())

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, COL),
      snap => setTimestamps(snap.docs.map(d => toMillis(d.data().timestamp))),
      err => {
        console.error('useActiveUsersCount — abonnement impossible :', err)
        setTimestamps([])
      }
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(t)
  }, [])

  return timestamps.filter(ts => !ts || now - ts < INACTIVE_MS).length
}
