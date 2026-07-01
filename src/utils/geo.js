// ============================================================
// geo.js — Utilitaires géographiques partagés
// Distance à vol d'oiseau (haversine), utilisée par
// useGeolocation.js (seuil anti-spam) et eta.js (seuil recalcul).
// ============================================================

const R = 6371000 // rayon terrestre en mètres

export function haversineDistanceM(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
