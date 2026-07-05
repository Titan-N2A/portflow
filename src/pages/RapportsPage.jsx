import { useState, useEffect, useRef } from 'react'
import { FileText, Download, Trash2, FilePlus, Database } from 'lucide-react'
import { C } from '../styles/tokens'
import {
  collection, query, where, orderBy, getDocs, limit,
  addDoc, deleteDoc, doc, onSnapshot,
} from 'firebase/firestore'
import { db, auth } from '../services/firebase'
import { useTrafficData, AXES_OFFICIELS } from '../hooks/useTrafficData'
import { useAxesFirestore } from '../hooks/useAxesFirestore'
import { construireModele, chargerMetaML, nomCompletAxe } from '../utils/rapport/commun'
import { telechargerPDF } from '../utils/rapport/pdf'
import { telechargerWord } from '../utils/rapport/word'
import { telechargerExcel } from '../utils/rapport/excel'

// ── Calcul des bornes de période ──────────────────────────────

function getPeriodeBounds(type, periode) {
  const ref = new Date(periode)
  if (type === 'journalier') {
    return {
      start: periode,
      end:   periode,
      label: ref.toLocaleDateString('fr-FR'),
    }
  }
  if (type === 'hebdomadaire') {
    const d = new Date(ref)
    d.setDate(d.getDate() - 6)
    const start = d.toISOString().slice(0, 10)
    return {
      start,
      end:   periode,
      label: `${new Date(start).toLocaleDateString('fr-FR')} – ${ref.toLocaleDateString('fr-FR')}`,
    }
  }
  // mensuel
  const start = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-01`
  const last  = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  const end   = last.toISOString().slice(0, 10)
  return {
    start,
    end,
    label: ref.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
  }
}

// ── Requête Firestore collecte_auto ──────────────────────────

async function fetchPeriodData(type, periode) {
  const { start, end } = getPeriodeBounds(type, periode)
  const q = query(
    collection(db, 'collecte_auto'),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'desc'),
    limit(5000)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

// ── Agrégation par axe ────────────────────────────────────────

function aggregerParAxe(records, mesuresLive, axes = AXES_OFFICIELS) {
  return axes.map(axe => {
    const rows = records.filter(r => r.axeId === axe.id && r.sens === 'aller')
    if (rows.length === 0) {
      // Fallback sur données live si pas d'historique
      const m = mesuresLive[axe.id]
      return {
        axeId:      axe.id,
        axe:        axe.shortNom,
        nomComplet: nomCompletAxe(axe),
        tRef:       axe.tRef,
        tMin:      m?.tempsLive ?? axe.tRef,
        tMoyen:    m?.tempsLive ?? axe.tRef,
        tMax:      m?.tempsLive ?? axe.tRef,
        retard:    m?.retard ?? 0,
        niveau:    m?.niveau ?? 1,
        vitesse:   m?.vitesse ?? 0,
        nbMesures: 0,
        source:    'live',
      }
    }
    const temps  = rows.map(r => r.temps_min).filter(Boolean)
    const tMin   = Math.round(Math.min(...temps) * 10) / 10
    const tMax   = Math.round(Math.max(...temps) * 10) / 10
    const tMoyen = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 10) / 10
    const retard  = Math.round((tMoyen - axe.tRef) * 10) / 10
    const distNum = parseFloat(String(axe.dist)) || (axe.tRef ?? 20)
    const vitesse = Math.round((distNum / tMoyen) * 60 * 10) / 10
    const niveaux = rows.map(r => r.niveau).filter(Boolean)
    const niveau  = niveaux.length ? Math.round(niveaux.reduce((a, b) => a + b, 0) / niveaux.length) : 1
    return {
      axeId:      axe.id,
      axe:        axe.shortNom,
      nomComplet: nomCompletAxe(axe),
      tRef:       axe.tRef,
      tMin, tMoyen, tMax,
      retard, niveau, vitesse,
      nbMesures: rows.length,
      source:    'historique',
    }
  })
}

// ── Page principale ───────────────────────────────────────────

function RapportsPage() {
  const { axes: firestoreAxes } = useAxesFirestore()
  const axes = firestoreAxes.length > 0 ? firestoreAxes : AXES_OFFICIELS
  const { mesures } = useTrafficData(axes)
  const [type,     setType]     = useState('journalier')
  const [periode,  setPeriode]  = useState(new Date().toISOString().slice(0, 10))
  const [format,   setFormat]   = useState('pdf')
  const [rapports, setRapports] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [dlEnCours, setDlEnCours] = useState(null)   // id du rapport en cours de téléchargement
  // Cache par rapport : les relevés sont téléchargés UNE fois, pas à
  // chaque clic PDF/Excel/Word (jusqu'à 5 000 lectures Firestore économisées
  // par clic — le quota gratuit est précieux).
  const contenuCache = useRef(new Map())

  // ── Registre persistant : les rapports générés survivent au rechargement ──
  // (métadonnées dans rapports_generes ; le contenu est régénéré à la
  // demande depuis collecte_auto au moment du téléchargement)
  useEffect(() => {
    const q = query(collection(db, 'rapports_generes'), orderBy('genereLe', 'desc'), limit(50))
    return onSnapshot(q,
      snap => setRapports(snap.docs.map(d => {
        const data = d.data()
        return { id: d.id, ...data, date: new Date(data.genereLe) }
      })),
      err => console.error('Registre rapports :', err),
    )
  }, [])

  async function genererRapport() {
    setLoading(true)
    try {
      const records      = await fetchPeriodData(type, periode)
      const { label }    = getPeriodeBounds(type, periode)
      const nom          = `PAA-${type.charAt(0).toUpperCase() + type.slice(1)}-${periode}`
      await addDoc(collection(db, 'rapports_generes'), {
        nom, type, periode,
        periodeLabel:   label,
        nbMesuresTotal: records.length,
        genereLe:       new Date().toISOString(),
        genereParEmail: auth.currentUser?.email ?? null,
      })
      // La liste se met à jour via onSnapshot — rien d'autre à faire
    } catch (err) {
      console.error('Erreur génération rapport :', err)
    } finally {
      setLoading(false)
    }
  }

  async function telecharger(rapport, fmt) {
    setDlEnCours(rapport.id)
    try {
      // Contenu régénéré depuis les relevés archivés (déterministe pour
      // une période close), puis modèle unique partagé par les 3 formats
      let contenu = contenuCache.current.get(rapport.id)
      if (!contenu) {
        const records = await fetchPeriodData(rapport.type, rapport.periode)
        contenu = { records, rows: aggregerParAxe(records, mesures, axes) }
        contenuCache.current.set(rapport.id, contenu)
      }
      const complet = { ...rapport, ...contenu }
      const ml      = await chargerMetaML()
      const modele  = construireModele(complet, ml)
      if (fmt === 'pdf')        await telechargerPDF(complet, modele)
      else if (fmt === 'excel') await telechargerExcel(complet, modele)
      else if (fmt === 'word')  await telechargerWord(complet, modele)
    } catch (err) {
      console.error(`Erreur téléchargement ${fmt} :`, err)
    } finally {
      setDlEnCours(null)
    }
  }

  async function supprimerRapport(id) {
    try {
      await deleteDoc(doc(db, 'rapports_generes', id))
    } catch (err) {
      console.error('Erreur suppression rapport :', err)
    }
  }

  return (
    <div style={{ padding: '1.25rem', height: '100vh', overflow: 'auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Rapports</h1>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Générez et téléchargez les rapports officiels PAA</p>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>

        {/* ── Générer un rapport ─────────────────────────── */}
        <div className="fp-card" style={{ flex: '0 0 340px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <FilePlus size={16} color={C.primary} />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Générer un rapport</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="fp-label">Type de rapport</label>
              <select className="fp-select" value={type} onChange={e => setType(e.target.value)}>
                <option value="journalier">Journalier</option>
                <option value="hebdomadaire">Hebdomadaire</option>
                <option value="mensuel">Mensuel</option>
              </select>
            </div>

            <div>
              <label className="fp-label">Période</label>
              <input type="date" className="fp-input" value={periode} onChange={e => setPeriode(e.target.value)} />
            </div>

            <div>
              <label className="fp-label">Format</label>
              <select className="fp-select" value={format} onChange={e => setFormat(e.target.value)}>
                <option value="pdf">PDF — DEESP-RF-01</option>
                <option value="excel">Excel (.xlsx)</option>
                <option value="word">Word (.docx)</option>
              </select>
            </div>

            <button
              className="fp-btn fp-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', marginTop: '0.25rem' }}
              onClick={genererRapport}
              disabled={loading}
            >
              <FileText size={15} />
              {loading ? 'Chargement données...' : 'Générer le rapport'}
            </button>
          </div>
        </div>

        {/* ── Rapports disponibles ───────────────────────── */}
        <div className="fp-card" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <Download size={16} color={C.primary} />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Rapports disponibles</span>
            <span className="fp-badge fp-badge-blue" style={{ marginLeft: 'auto' }}>{rapports.length}</span>
          </div>

          {rapports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
              <FileText size={32} color={C.textLight} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>Aucun rapport disponible</p>
              <p style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>Générez votre premier rapport à gauche</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {rapports.map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.85rem 1rem', background: '#f8fafc',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={16} color={C.primary} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.nom}</p>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: 2 }}>
                        <p style={{ fontSize: 11, color: C.textMuted }}>
                          {r.type} · {r.periodeLabel} · généré le {r.date.toLocaleDateString('fr-FR')}
                          {r.genereParEmail ? ` par ${r.genereParEmail}` : ''}
                        </p>
                        {r.nbMesuresTotal > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#27AE60', fontWeight: 600 }}>
                            <Database size={9} /> {r.nbMesuresTotal} mesures
                          </span>
                        )}
                        {r.nbMesuresTotal === 0 && (
                          <span style={{ fontSize: 10, color: '#E67E22', fontWeight: 600 }}>données live uniquement</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {dlEnCours === r.id && (
                      <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}>Préparation…</span>
                    )}
                    <button className="fp-btn fp-btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }} disabled={dlEnCours === r.id} onClick={() => telecharger(r, 'pdf')}>
                      <Download size={12} /> PDF
                    </button>
                    <button className="fp-btn fp-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }} disabled={dlEnCours === r.id} onClick={() => telecharger(r, 'excel')}>
                      <Download size={12} /> Excel
                    </button>
                    <button className="fp-btn fp-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }} disabled={dlEnCours === r.id} onClick={() => telecharger(r, 'word')}>
                      <Download size={12} /> Word
                    </button>
                    <button className="fp-btn fp-btn-danger" style={{ padding: '0.35rem 0.6rem' }} onClick={() => supprimerRapport(r.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RapportsPage
