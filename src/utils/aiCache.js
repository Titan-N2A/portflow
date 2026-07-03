// ============================================================
// aiCache.js — Cache localStorage à durée de vie (TTL) pour les
// réponses IA auto-générées (widgets "recommandations automatiques").
// Contrairement à sessionStorage, survit à la fermeture de l'onglet —
// un même visiteur qui revient dans les 10 min ne redéclenche pas
// d'appel API, ce qui réduit la consommation de quota sur un dashboard
// public à fort trafic.
// ============================================================

const TTL_MS = 10 * 60 * 1000

export function getCachedAI(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { value, ts } = JSON.parse(raw)
    if (Date.now() - ts > TTL_MS) return null
    return value
  } catch {
    return null
  }
}

export function setCachedAI(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ value, ts: Date.now() }))
  } catch {
    // quota localStorage dépassé ou navigation privée — cache best-effort
  }
}

export function clearCachedAI(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // idem — non bloquant
  }
}
