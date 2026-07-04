// ============================================================
// notifs.js — Notifications email FlowPort (Brevo)
// Bibliothèque partagée par collecte.js (alertes congestion) et
// recap.js (récapitulatif matinal).
//
// Secrets GitHub Actions requis :
//   BREVO_API_KEY          clé API Brevo (SMTP & API → Clés API)
//   MAIL_FROM              adresse expéditeur validée dans Brevo
//   FLOWPORT_BOT_EMAIL     compte admin FlowPort dédié aux scripts
//   FLOWPORT_BOT_PASSWORD  (lit config/notifications, réservé admin)
// Si un secret manque, les notifications sont désactivées sans
// jamais faire échouer la collecte.
// ============================================================

const PROJECT_ID   = 'portflow-46738'
const FIREBASE_KEY = process.env.FIREBASE_API_KEY
const BREVO_KEY    = process.env.BREVO_API_KEY
const MAIL_FROM    = process.env.MAIL_FROM
const BOT_EMAIL    = process.env.FLOWPORT_BOT_EMAIL
const BOT_PASSWORD = process.env.FLOWPORT_BOT_PASSWORD

const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const DASHBOARD_URL = 'https://portflow-46738.web.app'

// ── Charte (identique aux rapports) ──────────────────────────
export const CH = { ocean: '#0E4C74', lagune: '#1A6FA8', clair: '#E8F3FA', texte: '#2B2B2B', gris: '#595959' }
export const NIVEAU_LABELS  = ['', 'Fluide', 'Bon', 'Ralenti', 'Congestionné', 'Très congestionné']
export const NIVEAU_COULEUR = ['', '#1E8449', '#27AE60', '#E6B00F', '#E67E22', '#C0392B']

export function notificationsActives() {
  return Boolean(BREVO_KEY && MAIL_FROM && BOT_EMAIL && BOT_PASSWORD && FIREBASE_KEY)
}

// ── Champs Firestore REST ─────────────────────────────────────
export function fromField(field) {
  if (!field) return null
  if ('stringValue'  in field) return field.stringValue
  if ('doubleValue'  in field) return field.doubleValue
  if ('integerValue' in field) return Number(field.integerValue)
  if ('booleanValue' in field) return field.booleanValue
  if ('timestampValue' in field) return field.timestampValue
  if ('arrayValue' in field) return (field.arrayValue.values ?? []).map(fromField)
  if ('mapValue' in field) {
    const r = {}
    for (const [k, v] of Object.entries(field.mapValue.fields ?? {})) r[k] = fromField(v)
    return r
  }
  return null
}
export function toField(value) {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return { timestampValue: value }
    return { stringValue: value }
  }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (Number.isInteger(value))    return { integerValue: String(value) }
  if (typeof value === 'number')  return { doubleValue: value }
  if (Array.isArray(value))       return { arrayValue: { values: value.map(toField) } }
  if (value && typeof value === 'object') {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toField(v)])) } }
  }
  return { stringValue: String(value) }
}

// ── Connexion du bot (compte admin dédié aux scripts) ────────
let _token = null
export async function connexionBot() {
  if (_token) return _token
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: BOT_EMAIL, password: BOT_PASSWORD, returnSecureToken: true }),
    })
  const data = await res.json()
  if (data.error) throw new Error(`Connexion bot : ${data.error.message}`)
  _token = data.idToken
  return _token
}

// ── Destinataires : doc config/notifications (réservé admin) ─
// Forme : { destinataires: [{ email, nom, alertes, recap }] }
export async function lireDestinataires() {
  const token = await connexionBot()
  const res = await fetch(`${FS}/config/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Lecture destinataires ${res.status}: ${await res.text()}`)
  const doc = await res.json()
  const liste = fromField(doc.fields?.destinataires) ?? []
  return liste.filter(d => d && d.email)
}

// ── État des alertes : collection alertes_etat (clé API) ─────
export async function lireEtatAlerte(docId) {
  const res = await fetch(`${FS}/alertes_etat/${docId}?key=${FIREBASE_KEY}`)
  if (res.status === 404) return { enAlerte: false, pending: 0, derniereAlerteTs: null }
  if (!res.ok) throw new Error(`Lecture alertes_etat ${res.status}`)
  const doc = await res.json()
  return {
    enAlerte:         fromField(doc.fields?.enAlerte) ?? false,
    pending:          fromField(doc.fields?.pending) ?? 0,
    derniereAlerteTs: fromField(doc.fields?.derniereAlerteTs) ?? null,
  }
}
export async function ecrireEtatAlerte(docId, etat) {
  const body = { fields: Object.fromEntries(Object.entries(etat).filter(([, v]) => v !== null).map(([k, v]) => [k, toField(v)])) }
  const res = await fetch(`${FS}/alertes_etat/${docId}?key=${FIREBASE_KEY}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Écriture alertes_etat ${res.status}: ${await res.text()}`)
}

// ── Envoi Brevo ───────────────────────────────────────────────
export async function envoyerMail({ destinataires, sujet, html }) {
  if (!destinataires.length) return 0
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'FlowPort — PAA', email: MAIL_FROM },
      to: destinataires.map(d => ({ email: d.email, name: d.nom || d.email })),
      subject: sujet,
      htmlContent: html,
    }),
  })
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`)
  return destinataires.length
}

// ── Gabarit HTML commun (charte 2 bleus, lisible mobile) ─────
export function gabarit({ titre, sousTitre, corps }) {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:18px 12px;">
    <div style="background:${CH.ocean};border-radius:10px 10px 0 0;padding:18px 22px;">
      <div style="color:#fff;font-size:19px;font-weight:bold;">${titre}</div>
      <div style="color:#bcd7ea;font-size:12px;margin-top:4px;">${sousTitre}</div>
    </div>
    <div style="background:#ffffff;border-radius:0 0 10px 10px;padding:20px 22px;color:${CH.texte};font-size:14px;line-height:1.6;">
      ${corps}
      <div style="margin-top:22px;text-align:center;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:${CH.lagune};color:#fff;text-decoration:none;padding:10px 26px;border-radius:8px;font-size:13px;font-weight:bold;">
          Ouvrir le dashboard FlowPort
        </a>
      </div>
    </div>
    <p style="text-align:center;color:#8aa0b5;font-size:11px;margin-top:12px;">
      FlowPort — Port Autonome d'Abidjan · message automatique, ne pas répondre.<br/>
      Destinataires gérés dans FlowPort → Administration → Notifications.
    </p>
  </div></body></html>`
}

export function badgeNiveau(niveau) {
  return `<span style="display:inline-block;background:${NIVEAU_COULEUR[niveau]}22;color:${NIVEAU_COULEUR[niveau]};border:1px solid ${NIVEAU_COULEUR[niveau]}55;border-radius:999px;padding:2px 12px;font-size:12px;font-weight:bold;">N${niveau} — ${NIVEAU_LABELS[niveau]}</span>`
}

// ── Alertes congestion (appelé par collecte.js à chaque run) ──
const COOLDOWN_MIN  = 60   // pas de re-alerte sur le même axe avant 60 min
const CONFIRMATIONS = 2    // relevés consécutifs N4+ requis (anti faux positif)

export async function gererAlertes(resultats) {
  // resultats : [{ docId, axeId, shortNom, sens, tempsMin, tRef, niveau, retard, vitesse }]
  if (!notificationsActives()) {
    console.log('🔕 Alertes email désactivées (secrets Brevo/bot absents)')
    return
  }
  let destinataires = null   // chargés seulement si nécessaire

  for (const r of resultats) {
    try {
      const etat = await lireEtatAlerte(r.docId)
      const maintenant = new Date()

      if (r.niveau >= 4) {
        if (etat.enAlerte) continue   // déjà signalé, pas de spam
        const pending = etat.pending + 1
        const horsCooldown = !etat.derniereAlerteTs ||
          (maintenant - new Date(etat.derniereAlerteTs)) / 60000 >= COOLDOWN_MIN
        if (pending >= CONFIRMATIONS && horsCooldown) {
          destinataires ??= (await lireDestinataires()).filter(d => d.alertes)
          const n = await envoyerMail({
            destinataires,
            sujet: `🔴 ALERTE trafic — ${r.shortNom} (${r.sens}) ${NIVEAU_LABELS[r.niveau].toLowerCase()}`,
            html: gabarit({
              titre: 'Alerte congestion',
              sousTitre: `Axe ${r.shortNom} — sens ${r.sens} — ${maintenant.toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' })}`,
              corps: `
                <p style="margin:0 0 12px;">L'axe <strong>${r.shortNom}</strong> (sens ${r.sens}) est passé en ${badgeNiveau(r.niveau)}, confirmé sur ${CONFIRMATIONS} relevés consécutifs.</p>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                  <tr><td style="padding:6px 10px;background:${CH.clair};">Temps de traversée mesuré</td><td style="padding:6px 10px;background:${CH.clair};text-align:right;"><strong>${r.tempsMin} min</strong></td></tr>
                  <tr><td style="padding:6px 10px;">Temps de référence</td><td style="padding:6px 10px;text-align:right;">${r.tRef} min</td></tr>
                  <tr><td style="padding:6px 10px;background:${CH.clair};">Retard</td><td style="padding:6px 10px;background:${CH.clair};text-align:right;color:#C0392B;"><strong>+${r.retard} min</strong></td></tr>
                  <tr><td style="padding:6px 10px;">Vitesse estimée</td><td style="padding:6px 10px;text-align:right;">${r.vitesse} km/h</td></tr>
                </table>
                <p style="font-size:12px;color:${CH.gris};margin:12px 0 0;">Vous recevrez un message de retour à la normale. Pas de nouvelle alerte sur cet axe avant ${COOLDOWN_MIN} min.</p>`,
            }),
          })
          console.log(`  📧 Alerte ${r.shortNom} ${r.sens} envoyée à ${n} destinataire(s)`)
          await ecrireEtatAlerte(r.docId, { enAlerte: true, pending: 0, derniereAlerteTs: maintenant.toISOString(), dernierNiveau: r.niveau })
        } else {
          await ecrireEtatAlerte(r.docId, { enAlerte: false, pending, derniereAlerteTs: etat.derniereAlerteTs, dernierNiveau: r.niveau })
        }
      } else if (r.niveau <= 2) {
        if (etat.enAlerte) {
          destinataires ??= (await lireDestinataires()).filter(d => d.alertes)
          await envoyerMail({
            destinataires,
            sujet: `🟢 Retour à la normale — ${r.shortNom} (${r.sens})`,
            html: gabarit({
              titre: 'Retour à la normale',
              sousTitre: `Axe ${r.shortNom} — sens ${r.sens}`,
              corps: `<p style="margin:0;">La circulation sur l'axe <strong>${r.shortNom}</strong> (sens ${r.sens}) est revenue à ${badgeNiveau(r.niveau)} — temps mesuré : <strong>${r.tempsMin} min</strong> (référence ${r.tRef} min).</p>`,
            }),
          })
          console.log(`  📧 Levée d'alerte ${r.shortNom} ${r.sens} envoyée`)
        }
        if (etat.enAlerte || etat.pending > 0) {
          await ecrireEtatAlerte(r.docId, { enAlerte: false, pending: 0, derniereAlerteTs: etat.derniereAlerteTs, dernierNiveau: r.niveau })
        }
      } else if (etat.pending > 0) {
        // N3 : zone d'hystérésis — on annule le compteur, on ne lève pas l'alerte
        await ecrireEtatAlerte(r.docId, { enAlerte: etat.enAlerte, pending: 0, derniereAlerteTs: etat.derniereAlerteTs, dernierNiveau: r.niveau })
      }
    } catch (err) {
      console.warn(`  ⚠ Alerte ${r.docId} : ${err.message}`)
    }
  }
}
