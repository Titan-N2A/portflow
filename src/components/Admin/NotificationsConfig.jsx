// ============================================================
// NotificationsConfig.jsx — Onglet Admin « Notifications email »
// Gère le document Firestore config/notifications (réservé aux
// admins par les règles) : liste des destinataires des alertes
// congestion et du récapitulatif matinal, lus par les scripts
// GitHub Actions (scripts/notifs.js via le compte bot).
// ============================================================

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { Mail, Plus, Trash2, BellRing, Sunrise, Save } from 'lucide-react'
import { db } from '../../services/firebase'
import { C } from '../../styles/tokens'

const DOC_REF = () => doc(db, 'config', 'notifications')

export default function NotificationsConfig({ onToast }) {
  const [destinataires, setDestinataires] = useState([])
  const [chargement,    setChargement]    = useState(true)
  const [enregistre,    setEnregistre]    = useState(true)
  const [sauvegarde,    setSauvegarde]    = useState(false)
  const [nvEmail,       setNvEmail]       = useState('')
  const [nvNom,         setNvNom]         = useState('')

  // Chargement unique au montage — onToast (recréé à chaque rendu du
  // parent) ne doit pas être dépendance : il relancerait le fetch en boucle.
  useEffect(() => {
    getDoc(DOC_REF())
      .then(snap => setDestinataires(snap.exists() ? (snap.data().destinataires ?? []) : []))
      .catch(err => onToast?.(`Erreur chargement notifications : ${err.message}`, 'error'))
      .finally(() => setChargement(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function modifier(maj) {
    setDestinataires(maj)
    setEnregistre(false)
  }

  function ajouter(e) {
    e.preventDefault()
    const email = nvEmail.trim().toLowerCase()
    if (!email) return
    if (destinataires.some(d => d.email === email)) {
      onToast?.('Cette adresse est déjà dans la liste.', 'error')
      return
    }
    modifier([...destinataires, { email, nom: nvNom.trim(), alertes: true, recap: true }])
    setNvEmail('')
    setNvNom('')
  }

  async function sauvegarder() {
    setSauvegarde(true)
    try {
      await setDoc(DOC_REF(), {
        destinataires,
        majLe: new Date().toISOString(),
      })
      setEnregistre(true)
      onToast?.('Destinataires des notifications enregistrés')
    } catch (err) {
      onToast?.(`Erreur enregistrement : ${err.message}`, 'error')
    } finally {
      setSauvegarde(false)
    }
  }

  const caseStyle = { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.text, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="fp-card" style={{ padding: '1.1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Mail size={15} color={C.primary} />
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Notifications par email</span>
        </div>
        <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>
          <BellRing size={11} style={{ verticalAlign: '-1px' }} /> <strong>Alertes congestion</strong> : envoyées quand un axe passe
          au niveau N4+ (confirmé sur 2 relevés consécutifs, au plus une alerte par heure et par axe), avec message de retour à la normale.<br />
          <Sunrise size={11} style={{ verticalAlign: '-1px' }} /> <strong>Récap matinal</strong> : tous les jours vers 6h30 — état
          live des axes, bilan de la veille et créneaux à risque du jour selon le modèle prédictif.
        </p>
      </div>

      <div className="fp-card" style={{ padding: '1.1rem 1.25rem' }}>
        {chargement ? (
          <p style={{ fontSize: 12, color: C.textMuted }}>Chargement…</p>
        ) : (
          <>
            {destinataires.length === 0 && (
              <p style={{ fontSize: 12, color: C.textMuted, marginBottom: '0.75rem' }}>
                Aucun destinataire — ajoutez une adresse ci-dessous pour activer les envois.
              </p>
            )}
            {destinataires.map((d, i) => (
              <div key={d.email} style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                padding: '0.6rem 0', borderBottom: `1px solid ${C.borderLight ?? '#eef2f6'}`,
              }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.email}</p>
                  {d.nom && <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>{d.nom}</p>}
                </div>
                <label style={caseStyle}>
                  <input type="checkbox" checked={d.alertes !== false}
                    onChange={e => modifier(destinataires.map((x, j) => j === i ? { ...x, alertes: e.target.checked } : x))} />
                  Alertes
                </label>
                <label style={caseStyle}>
                  <input type="checkbox" checked={d.recap !== false}
                    onChange={e => modifier(destinataires.map((x, j) => j === i ? { ...x, recap: e.target.checked } : x))} />
                  Récap matinal
                </label>
                <button className="fp-btn fp-btn-danger" style={{ padding: '0.3rem 0.5rem' }}
                  onClick={() => modifier(destinataires.filter((_, j) => j !== i))} title="Retirer ce destinataire">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <form onSubmit={ajouter} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: '0.9rem' }}>
              <input type="email" className="fp-input" placeholder="adresse@exemple.ci" required
                value={nvEmail} onChange={e => setNvEmail(e.target.value)} style={{ flex: '2 1 200px' }} />
              <input type="text" className="fp-input" placeholder="Nom (optionnel)"
                value={nvNom} onChange={e => setNvNom(e.target.value)} style={{ flex: '1 1 140px' }} />
              <button type="submit" className="fp-btn fp-btn-ghost" style={{ fontSize: 12 }}>
                <Plus size={13} /> Ajouter
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '1rem' }}>
              <button className="fp-btn fp-btn-primary" style={{ fontSize: 12 }}
                onClick={sauvegarder} disabled={sauvegarde || enregistre}>
                <Save size={13} />
                {sauvegarde ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {!enregistre && (
                <span style={{ fontSize: 11, color: '#E67E22', fontFamily: "'Inter',sans-serif" }}>
                  Modifications non enregistrées
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
