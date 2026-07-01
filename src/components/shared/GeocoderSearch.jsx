// ============================================================
// GeocoderSearch.jsx — Recherche d'adresse (destination du trajet)
// Utilise Nominatim (OpenStreetMap, gratuit, sans clé API), avec
// un biais géographique sur Abidjan pour des résultats pertinents.
// Mémorise les 3 dernières destinations choisies (localStorage).
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { Search, MapPin, X } from 'lucide-react'
import { C } from '../../styles/tokens'
import { PAA_CENTER_COORDS } from '../../data/defaultData'

const RECENTS_KEY  = 'portflow_destinations_recentes'
const DEBOUNCE_MS  = 400
const MIN_CHARS    = 3

// Boîte englobante large autour d'Abidjan — biaise les résultats sans les exclure
const [PAA_LAT, PAA_LNG] = PAA_CENTER_COORDS
const VIEWBOX = `${PAA_LNG - 0.6},${PAA_LAT + 0.6},${PAA_LNG + 0.6},${PAA_LAT - 0.6}`

function getRecents() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY)) ?? []
  } catch {
    return []
  }
}

function saveRecent(destination) {
  const prev    = getRecents().filter(d => d.label !== destination.label)
  const updated = [destination, ...prev].slice(0, 3)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(updated))
  return updated
}

async function searchNominatim(query, signal) {
  const url = `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&q=${encodeURIComponent(query)}&limit=5` +
    `&countrycodes=ci&viewbox=${VIEWBOX}&bounded=0`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  const data = await res.json()
  return data.map(r => ({
    label: r.display_name,
    lat:   parseFloat(r.lat),
    lng:   parseFloat(r.lon),
  }))
}

function GeocoderSearch({ onSelect, placeholder = 'Rechercher une destination...' }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [recents,  setRecents]  = useState(() => getRecents())
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const debounceRef = useRef(null)
  const abortRef     = useRef(null)

  useEffect(() => {
    if (query.trim().length < MIN_CHARS) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const found = await searchNominatim(query.trim(), controller.signal)
        setResults(found)
      } catch (err) {
        if (err.name !== 'AbortError') setError('Recherche indisponible pour le moment.')
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  function handleSelect(destination) {
    setQuery(destination.label)
    setResults([])
    setOpen(false)
    setRecents(saveRecent(destination))
    onSelect?.(destination)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    onSelect?.(null)
  }

  const showRecents = open && query.trim().length < MIN_CHARS && recents.length > 0
  const showResults = open && results.length > 0

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} color={C.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          className="fp-input"
          style={{ paddingLeft: 32, paddingRight: query ? 32 : 12 }}
          value={query}
          placeholder={placeholder}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {query && (
          <button onClick={handleClear} style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 2,
            display: 'flex',
          }}>
            <X size={14} />
          </button>
        )}
      </div>

      {(showRecents || showResults || loading || error) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1500, overflow: 'hidden',
        }}>
          {loading && (
            <div style={{ padding: '0.6rem 0.85rem', fontSize: 12, color: C.textMuted }}>Recherche...</div>
          )}
          {error && (
            <div style={{ padding: '0.6rem 0.85rem', fontSize: 12, color: C.danger }}>{error}</div>
          )}
          {showRecents && (
            <>
              <div style={{ padding: '0.4rem 0.85rem', fontSize: 10, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Destinations récentes
              </div>
              {recents.map((r, i) => (
                <button key={i} onClick={() => handleSelect(r)} style={resultItemStyle}>
                  <MapPin size={13} color={C.textMuted} style={{ flexShrink: 0 }} />
                  <span style={resultLabelStyle}>{r.label}</span>
                </button>
              ))}
            </>
          )}
          {showResults && results.map((r, i) => (
            <button key={i} onClick={() => handleSelect(r)} style={resultItemStyle}>
              <MapPin size={13} color={C.primary} style={{ flexShrink: 0 }} />
              <span style={resultLabelStyle}>{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const resultItemStyle = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '0.55rem 0.85rem', background: 'none', border: 'none',
  borderTop: `1px solid ${C.borderLight}`, cursor: 'pointer', textAlign: 'left',
}

const resultLabelStyle = {
  fontSize: 12.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export default GeocoderSearch
