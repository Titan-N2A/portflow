import { useState } from 'react'
import { FileText, Download, Trash2, FilePlus, Database } from 'lucide-react'
import { C } from '../styles/tokens'
import jsPDF from 'jspdf'
import logoPAA from '../assets/logo_port.png'
import * as XLSX from 'xlsx'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, AlignmentType, BorderStyle, ShadingType,
  Header, Footer, PageNumber,
} from 'docx'
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useTrafficData, AXES_OFFICIELS } from '../hooks/useTrafficData'
import { useAxesFirestore } from '../hooks/useAxesFirestore'

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
        axe:       axe.shortNom,
        tRef:      axe.tRef,
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
      axe:       axe.shortNom,
      tRef:      axe.tRef,
      tMin, tMoyen, tMax,
      retard, niveau, vitesse,
      nbMesures: rows.length,
      source:    'historique',
    }
  })
}

// ── Helpers PDF ───────────────────────────────────────────────

function pdfNiveauColor(n) {
  const m = { 1:[30,132,73], 2:[39,174,96], 3:[230,176,15], 4:[230,126,34], 5:[192,57,43] }
  return m[n] || [149,165,166]
}
function pdfNiveauLabel(n) {
  return ['','Fluide','Bon','Ralenti','Congestionné','Très congestionné'][n] || '—'
}
function pdfFmtRetard(r) { return r >= 0 ? `+${r} min` : `${r} min` }

let _logoPAA64 = null
async function getLogoPAA64() {
  if (_logoPAA64) return _logoPAA64
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      _logoPAA64 = canvas.toDataURL('image/png')
      resolve(_logoPAA64)
    }
    img.onerror = () => resolve(null)
    img.src = logoPAA
  })
}

function pdfPageHeader(doc, rapport, titre, logo64) {
  doc.setFillColor(27,79,138)
  doc.rect(0,0,210,16,'F')
  if (logo64) {
    try { doc.addImage(logo64, 'PNG', 191, 0.5, 15, 15) } catch { /* logo illisible — en-tête sans logo */ }
  }
  doc.setTextColor(255,255,255)
  doc.setFontSize(9); doc.setFont('helvetica','bold')
  doc.text(titre||'RAPPORT TRAFIC PAA', 14, 10.5)
  doc.setFont('helvetica','normal')
  doc.text(`${rapport.nom} — ${rapport.periodeLabel}`, logo64 ? 185 : 196, 10.5, { align:'right' })
}
function pdfPageFooter(doc, rapport, pageNum, total) {
  doc.setFillColor(240,244,248)
  doc.rect(0,287,210,10,'F')
  doc.setTextColor(140,140,150); doc.setFontSize(7.5); doc.setFont('helvetica','italic')
  doc.text(`FlowPort v2 · Port Autonome d'Abidjan · ${rapport.periodeLabel}`, 14, 293)
  doc.text(`Page ${pageNum}${total ? ' / '+total : ''}`, 196, 293, { align:'right' })
}
function pdfSectionHeader(doc, txt, y) {
  doc.setFillColor(27,79,138)
  doc.rect(14, y, 182, 7, 'F')
  doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold')
  doc.text(txt, 17, y+5)
  return y+9
}

function pdfInterpretation(row) {
  const ratio = row.tRef > 0 ? row.tMoyen / row.tRef : 1
  const retardPct = Math.round((ratio - 1) * 100)
  const r = pdfFmtRetard(row.retard)
  const n = pdfNiveauLabel(row.niveau)
  if (ratio <= 1.05)
    return `L'axe ${row.axe} présente des conditions de circulation optimales (${n}). Le temps moyen (${row.tMoyen} min) est quasi identique à la référence (${row.tRef} min, écart : +${retardPct}%). La vitesse estimée (${row.vitesse} km/h) confirme la fluidité. La variabilité inter-relevés (min : ${row.tMin} min / max : ${row.tMax} min) est faible. Aucune mesure corrective n'est requise sur cet axe.`
  if (ratio <= 1.25)
    return `L'axe ${row.axe} présente une légère dégradation (${n}). Le temps moyen (${row.tMoyen} min) dépasse la référence de ${r} (+${retardPct}%). La variabilité (min : ${row.tMin} / max : ${row.tMax} min) indique des pics ponctuels. Une surveillance renforcée aux heures de pointe (11h–12h, 16h30–18h30) est recommandée. Aucune intervention d'urgence requise à ce stade.`
  if (ratio <= 1.50)
    return `⚠ ALERTE — L'axe ${row.axe} affiche des ralentissements significatifs (${n}). Le temps moyen (${row.tMoyen} min) dépasse le seuil orange avec ${r} de retard moyen (+${retardPct}%). Vitesse estimée : ${row.vitesse} km/h. Mesures recommandées : signalisation dynamique, coordination opérateurs portuaires, révision des créneaux de rotation.`
  if (ratio <= 2.00)
    return `⚠⚠ CONGESTION — L'axe ${row.axe} est en état de congestion (${n}). Le ratio de ${ratio.toFixed(2)} représente ${retardPct}% au-dessus de la référence (${r}/rotation). Vitesse : ${row.vitesse} km/h. Un contact avec la Direction de l'Exploitation s'impose pour activer les protocoles de gestion de crise trafic.`
  return `🔴 CRITIQUE — L'axe ${row.axe} est en congestion sévère (${n}). Ratio ${ratio.toFixed(2)} — retard ${r} (+${retardPct}%). Intervention d'urgence requise : déviation poids lourds, alerte cellule de crise PAA, communication immédiate aux opérateurs de terminal.`
}

function pdfRecommandations(rows, niveauGlobal) {
  const recs = []
  recs.push({
    t:'Optimisation des créneaux de départ',
    b:`Le modèle prédictif ML (Random Forest, 79,18 % de précision) identifie le créneau 11h00–12h00 comme le plus chargé sur les 3 axes (ratios 1,12–1,13). Planifier les rotations prioritaires avant 9h30 ou après 14h00. Le samedi présente systématiquement les meilleures conditions sur l'ensemble du réseau PAA.`,
  })
  const degraded = rows.filter(r => r.tRef>0 && r.tMoyen/r.tRef>1.25)
  degraded.forEach(r => {
    recs.push({
      t:`Axe ${r.axe} — Réduction du retard (ratio : ${(r.tMoyen/r.tRef).toFixed(2)})`,
      b:`Retard moyen observé : ${pdfFmtRetard(r.retard)}. Actions recommandées : (1) Reporter les rotations non urgentes vers 7h–9h ou 14h–16h, (2) Activer la signalisation d'alerte dynamique sur l'axe, (3) Notifier les prestataires logistiques et opérateurs de terminal des conditions dégradées.`,
    })
  })
  recs.push({
    t:'Continuité du monitoring automatique',
    b:`La collecte automatisée (GitHub Actions, toutes les 10 min) garantit des données fraîches même sans navigateur ouvert. Vérifier mensuellement les logs GitHub Actions et la validité des clés API TomTom. En cas d'indisponibilité, le fallback OSRM est activé automatiquement.`,
  })
  if (niveauGlobal >= 3) {
    recs.push({
      t:'Communication aux parties prenantes',
      b:`Le niveau de congestion observé justifie une communication aux parties prenantes : Direction Générale PAA, responsables logistiques, opérateurs de terminal et autorités de circulation. Un bilan de situation doit être transmis via les canaux officiels dans les 24h.`,
    })
  } else {
    recs.push({
      t:'Enrichissement du modèle ML',
      b:`Les bonnes performances observées constituent une opportunité de renforcer le modèle prédictif. Il est recommandé d'étendre le monitoring aux plages nocturnes (18h–7h) et week-ends pour obtenir une couverture temporelle complète et réentraîner le modèle mensuellement depuis les nouvelles données de collecte_auto.`,
    })
  }
  return recs
}

// ── Génération PDF ────────────────────────────────────────────

async function telechargerPDF(rapport, rows) {
  const logo64 = await getLogoPAA64()
  const doc = new jsPDF()
  const now = rapport.date.toLocaleString('fr-FR')
  const PW = 210, ML = 14, CW = 182

  // Compute global stats
  const ratios = rows.map(r => r.tRef>0 ? r.tMoyen/r.tRef : 1)
  const avgRatio = ratios.reduce((a,b)=>a+b,0) / (ratios.length||1)
  const maxIdx = ratios.indexOf(Math.max(...ratios))
  const axeCrit = rows[maxIdx]
  const nbDeg = rows.filter(r => r.tRef>0 && r.tMoyen/r.tRef>1.25).length
  const retardGlobal = Math.round(rows.reduce((a,r)=>a+(r.retard||0),0)/(rows.length||1)*10)/10
  const nGlobal = avgRatio<=1.10?1:avgRatio<=1.25?2:avgRatio<=1.50?3:avgRatio<=2?4:5
  const [rgN,ggN,bgN] = pdfNiveauColor(nGlobal)

  // ── PAGE 1 : COUVERTURE ──────────────────────────────────────
  doc.setFillColor(27,79,138); doc.rect(0,0,PW,55,'F')
  doc.setFillColor(255,255,255); doc.rect(ML,8,32,12,'F')
  doc.setTextColor(27,79,138); doc.setFontSize(6.5); doc.setFont('helvetica','bold')
  doc.text('PORT AUTONOME', ML+1.5, 14); doc.text("D'ABIDJAN", ML+1.5, 19)
  doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold')
  doc.text("DIRECTION DES ÉTUDES ET DE L'EXPLOITATION — SYSTÈME FLOWPORT", ML+37, 15)
  doc.setFontSize(8); doc.setFont('helvetica','normal')
  doc.text("Port Autonome d'Abidjan · Vridi — 01 BP 1337 Abidjan 01", ML+37, 21)
  doc.setFillColor(40,116,166); doc.rect(0,55,PW,10,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(8)
  doc.text("FlowPort v2 — Monitoring Trafic PAA en Temps Réel — Collecte TomTom + GitHub Actions", PW/2, 61.5, {align:'center'})

  let y = 82
  doc.setTextColor(27,79,138); doc.setFontSize(28); doc.setFont('helvetica','bold')
  doc.text('RAPPORT OFFICIEL', PW/2, y, {align:'center'})
  y+=13
  const typeLabel = {journalier:'JOURNALIER',hebdomadaire:'HEBDOMADAIRE',mensuel:'MENSUEL'}[rapport.type]||rapport.type.toUpperCase()
  doc.setFontSize(16); doc.text(`DE TRAFIC — ${typeLabel}`, PW/2, y, {align:'center'})
  y+=9
  doc.setDrawColor(27,79,138); doc.setLineWidth(1.5)
  doc.line(ML+20, y, PW-ML-20, y)
  y+=8
  doc.setFillColor(235,245,251); doc.rect(ML+35,y,CW-70,12,'F')
  doc.setFontSize(11); doc.setFont('helvetica','bold')
  doc.text('DEESP-RF-01', PW/2, y+8.5, {align:'center'})

  y+=28
  doc.setFillColor(244,247,250); doc.rect(ML,y,CW,52,'F')
  doc.setDrawColor(210,220,230); doc.setLineWidth(0.3); doc.rect(ML,y,CW,52)
  const infos = [
    ['Période analysée :', rapport.periodeLabel],
    ['Type de rapport :', rapport.type.charAt(0).toUpperCase()+rapport.type.slice(1)],
    ['Date de génération :', now],
    ['Mesures collectées :', rapport.nbMesuresTotal>0?`${rapport.nbMesuresTotal} relevés automatiques`:'Données live (pas de collecte_auto)'],
    ['Axes surveillés :', '3 axes bidirectionnels — Réseau routier PAA Abidjan'],
  ]
  doc.setTextColor(60,80,100)
  infos.forEach(([lbl,val],i) => {
    doc.setFontSize(10); doc.setFont('helvetica','bold')
    doc.text(lbl, ML+5, y+10+i*9)
    doc.setFont('helvetica','normal')
    doc.text(val, ML+62, y+10+i*9)
  })
  y+=60
  doc.setFillColor(rgN,ggN,bgN); doc.rect(ML+35,y,CW-70,14,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont('helvetica','bold')
  doc.text(`ÉTAT GLOBAL : ${pdfNiveauLabel(nGlobal).toUpperCase()}`, PW/2, y+10, {align:'center'})

  doc.setFillColor(240,244,248); doc.rect(0,286,PW,11,'F')
  doc.setTextColor(130,130,140); doc.setFontSize(7.5); doc.setFont('helvetica','italic')
  doc.text("Document confidentiel — Usage interne PAA — Ne pas diffuser sans autorisation", PW/2,291,{align:'center'})
  doc.text("FlowPort v2 · Port Autonome d'Abidjan", PW/2,296,{align:'center'})

  // ── PAGE 2 : SYNTHÈSE EXÉCUTIVE ─────────────────────────────
  doc.addPage()
  pdfPageHeader(doc, rapport, 'SYNTHÈSE EXÉCUTIVE', logo64)
  y=24
  doc.setTextColor(27,79,138); doc.setFontSize(14); doc.setFont('helvetica','bold')
  doc.text('2. Synthèse exécutive', ML, y); y+=7
  doc.setTextColor(100,100,100); doc.setFontSize(8.5); doc.setFont('helvetica','italic')
  doc.text("Indicateurs calculés depuis les données TomTom / collecte_auto Firestore (GitHub Actions).", ML, y); y+=9

  const kpis = [
    {l:'Temps moyen global',  v:`${Math.round(rows.reduce((a,r)=>a+r.tMoyen,0)/(rows.length||1)*10)/10} min`, s:'tous axes', c:[27,79,138]},
    {l:'Retard moyen global', v:`${retardGlobal>=0?'+':''}${retardGlobal} min`, s:'vs référence',  c:retardGlobal>5?[230,126,34]:[39,174,96]},
    {l:'Axes dégradés (N3+)', v:`${nbDeg} / ${rows.length}`, s:'Ralenti ou pire', c:nbDeg>0?[230,126,34]:[39,174,96]},
    {l:'Axe le plus critique',v:axeCrit?axeCrit.axe:'—', s:axeCrit?`ratio ${ratios[maxIdx]?.toFixed(2)||'—'}`:'—', c:pdfNiveauColor(axeCrit?.niveau||1)},
    {l:'Mesures collectées',  v:`${rapport.nbMesuresTotal}`, s:'relevés auto', c:[40,116,166]},
    {l:'Niveau global réseau',v:pdfNiveauLabel(nGlobal), s:`ratio ${avgRatio.toFixed(2)}`, c:[rgN,ggN,bgN]},
  ]
  const kw = (CW-6)/3
  kpis.forEach((k,i) => {
    const col=i%3, row2=Math.floor(i/3)
    const kx=ML+col*(kw+3), ky=y+row2*29
    doc.setFillColor(244,247,250); doc.rect(kx,ky,kw,26,'F')
    doc.setFillColor(...k.c); doc.rect(kx,ky,3,26,'F')
    doc.setTextColor(90,90,90); doc.setFontSize(7.5); doc.setFont('helvetica','bold')
    doc.text(k.l, kx+6, ky+8)
    doc.setTextColor(...k.c); doc.setFontSize(13); doc.setFont('helvetica','bold')
    doc.text(k.v, kx+6, ky+17)
    doc.setTextColor(140,140,140); doc.setFontSize(7); doc.setFont('helvetica','italic')
    doc.text(k.s, kx+6, ky+23)
  })
  y+=2*29+10

  y = pdfSectionHeader(doc, 'État de la circulation sur la période', y); y+=4
  let globalTxt
  if (nGlobal<=2) {
    globalTxt = `Sur la période ${rapport.periodeLabel}, les conditions de circulation sur le réseau du PAA ont été globalement satisfaisantes. Le ratio moyen inter-axes de ${avgRatio.toFixed(2)} classe la situation au niveau ${pdfNiveauLabel(nGlobal)}, ce qui signifie que les temps de parcours observés sont proches des valeurs de référence historiques.`
    globalTxt += nbDeg===0 ? ` Aucun axe n'a atteint le seuil d'alerte (N3 – Ralenti). Les opérations portuaires ont pu se dérouler dans des conditions optimales.` : ` Toutefois, ${nbDeg} axe(s) sur ${rows.length} ont dépassé le seuil N3, nécessitant une surveillance accrue.`
  } else if (nGlobal===3) {
    globalTxt = `Sur la période ${rapport.periodeLabel}, des ralentissements modérés ont été enregistrés. Le ratio moyen de ${avgRatio.toFixed(2)} indique un niveau ${pdfNiveauLabel(nGlobal)} : les temps dépassent les références de 25 à 50%. ${nbDeg} axe(s) sont en état dégradé. Un suivi renforcé et des mesures préventives sont recommandés.`
  } else {
    globalTxt = `ALERTE : Sur la période ${rapport.periodeLabel}, des épisodes de congestion significatifs ont été enregistrés. Le ratio moyen de ${avgRatio.toFixed(2)} correspond au niveau ${pdfNiveauLabel(nGlobal)}. ${nbDeg} axe(s) sur ${rows.length} sont en congestion N4+. Des mesures correctives urgentes sont requises.`
  }
  const glines = doc.splitTextToSize(globalTxt, CW)
  doc.setTextColor(50,62,72); doc.setFontSize(9.5); doc.setFont('helvetica','normal')
  doc.text(glines, ML, y); y+=glines.length*5.5+10

  y = pdfSectionHeader(doc, 'Tableau récapitulatif — Statistiques par axe', y); y+=3
  const tCols=['Axe','T. Réf.','T. Min.','T. Moyen','T. Max.','Retard moy.','Niveau','Vitesse','Relevés']
  const tCW  =[30,18,18,20,18,22,26,22,16]
  let tx=ML
  doc.setFillColor(27,79,138); doc.rect(ML,y,CW,7,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont('helvetica','bold')
  tCols.forEach((c,i)=>{doc.text(c,tx+1.5,y+5);tx+=tCW[i]}); y+=7
  rows.forEach((row,ri)=>{
    const [rc,gc,bc]=pdfNiveauColor(row.niveau)
    doc.setFillColor(ri%2===0?244:255,ri%2===0?247:255,ri%2===0?250:255)
    doc.rect(ML,y,CW,7,'F')
    tx=ML; doc.setFontSize(7.5)
    const vals=[row.axe,`${row.tRef} min`,`${row.tMin} min`,`${row.tMoyen} min`,`${row.tMax} min`,pdfFmtRetard(row.retard),pdfNiveauLabel(row.niveau),`${row.vitesse} km/h`,row.nbMesures>0?`${row.nbMesures}`:'live']
    vals.forEach((v,i)=>{
      if(i===6){doc.setTextColor(rc,gc,bc);doc.setFont('helvetica','bold')}
      else{doc.setTextColor(50,62,72);doc.setFont('helvetica','normal')}
      doc.text(String(v),tx+1.5,y+5); tx+=tCW[i]
    }); y+=7
  })
  y+=6
  doc.setTextColor(150,150,150); doc.setFontSize(7.5); doc.setFont('helvetica','italic')
  doc.text("Source : TomTom Routing API v1 + collecte_auto Firestore. Vitesse calculée depuis distance/temps.", ML, y)
  pdfPageFooter(doc, rapport, 2, 5)

  // ── PAGE 3 : ANALYSE DÉTAILLÉE PAR AXE ──────────────────────
  doc.addPage()
  pdfPageHeader(doc, rapport, 'ANALYSE DÉTAILLÉE PAR AXE', logo64)
  y=24
  doc.setTextColor(27,79,138); doc.setFontSize(14); doc.setFont('helvetica','bold')
  doc.text('3. Analyse détaillée par axe', ML, y); y+=12

  rows.forEach((row) => {
    if(y>240){doc.addPage();pdfPageHeader(doc,rapport,'ANALYSE DÉTAILLÉE PAR AXE',logo64);y=26}
    const ratio3=row.tRef>0?row.tMoyen/row.tRef:1
    const [rc,gc,bc]=pdfNiveauColor(row.niveau)
    doc.setFillColor(rc,gc,bc); doc.rect(ML,y,4,11,'F')
    doc.setFillColor(245,248,252); doc.rect(ML+4,y,CW-4,11,'F')
    doc.setTextColor(rc,gc,bc); doc.setFontSize(11); doc.setFont('helvetica','bold')
    doc.text(`Axe ${row.axe}`, ML+8, y+7.5)
    doc.setTextColor(80,80,80); doc.setFontSize(9); doc.setFont('helvetica','normal')
    doc.text(`— ${pdfNiveauLabel(row.niveau)}  |  Ratio : ${ratio3.toFixed(2)}  |  ${row.nbMesures>0?row.nbMesures+' relevés':'données live'}`, ML+47, y+7.5)
    y+=14
    const mets=[{l:'T. référence',v:`${row.tRef} min`},{l:'T. moyen mesuré',v:`${row.tMoyen} min`},{l:'Retard moyen',v:pdfFmtRetard(row.retard)},{l:'Vitesse estimée',v:`${row.vitesse} km/h`}]
    const mw=CW/mets.length
    mets.forEach((m,mi)=>{
      const mx=ML+mi*mw
      doc.setFillColor(250,252,255); doc.rect(mx,y,mw-2,13,'F')
      doc.setFillColor(rc,gc,bc); doc.rect(mx,y,mw-2,2,'F')
      doc.setTextColor(90,90,90); doc.setFontSize(7); doc.setFont('helvetica','bold')
      doc.text(m.l, mx+2, y+8)
      doc.setTextColor(rc,gc,bc); doc.setFontSize(10); doc.setFont('helvetica','bold')
      doc.text(m.v, mx+2, y+13)
    })
    y+=17
    const interp=pdfInterpretation(row)
    const ilines=doc.splitTextToSize(interp, CW)
    doc.setTextColor(50,62,72); doc.setFontSize(9); doc.setFont('helvetica','normal')
    doc.text(ilines, ML, y); y+=ilines.length*5+12
  })
  pdfPageFooter(doc, rapport, doc.internal.getCurrentPageInfo().pageNumber, 5)

  // ── PAGE 4 : INTERPRÉTATION GLOBALE ─────────────────────────
  doc.addPage()
  pdfPageHeader(doc, rapport, 'INTERPRÉTATION GLOBALE', logo64)
  y=24
  doc.setTextColor(27,79,138); doc.setFontSize(14); doc.setFont('helvetica','bold')
  doc.text('4. Interprétation globale et tendances', ML, y); y+=12

  // 4.1 Comparaison inter-axes
  y=pdfSectionHeader(doc,'4.1  Comparaison inter-axes',y); y+=4
  const sorted=[...rows].sort((a,b)=>(b.tMoyen/b.tRef)-(a.tMoyen/a.tRef))
  const best=sorted[sorted.length-1], worst=sorted[0]
  let cmpTxt
  if(rows.length>=2){
    const gap=Math.round((worst.tMoyen/worst.tRef - best.tMoyen/best.tRef)*100)
    cmpTxt=`Sur la période ${rapport.periodeLabel}, l'axe le plus performant est l'axe ${best.axe} (temps moyen ${best.tMoyen} min, ratio ${(best.tMoyen/best.tRef).toFixed(2)}). L'axe ${worst.axe} présente le niveau de dégradation le plus élevé (ratio ${(worst.tMoyen/worst.tRef).toFixed(2)}, retard ${pdfFmtRetard(worst.retard)}). L'écart inter-axes de ${gap} points de ratio ${gap>20?'révèle une disparité significative qui plaide pour un rééquilibrage des flux':'indique une relative homogénéité des conditions de circulation sur le réseau PAA'}.`
  } else {
    cmpTxt=`Un seul axe disponible sur la période ${rapport.periodeLabel}. Données insuffisantes pour une comparaison inter-axes.`
  }
  const clines=doc.splitTextToSize(cmpTxt,CW)
  doc.setTextColor(50,62,72); doc.setFontSize(9.5); doc.setFont('helvetica','normal')
  doc.text(clines,ML,y); y+=clines.length*5.5+10

  // 4.2 Impact retards
  y=pdfSectionHeader(doc,"4.2  Impact des retards sur les opérations",y); y+=4
  const totRetard=rows.reduce((a,r)=>a+Math.max(0,r.retard),0)
  const impTxt=`Le retard cumulé moyen sur l'ensemble du réseau s'établit à ${totRetard.toFixed(1)} min par rotation. En considérant 50 rotations camions/jour/axe, cela représente environ ${Math.round(totRetard*50/60)} heures-conducteur perdues par jour. Sur 22 jours ouvrés, l'impact mensuel atteindrait ${Math.round(totRetard*50/60*22)} heures, justifiant l'investissement dans un système de monitoring comme FlowPort.`
  const ilines2=doc.splitTextToSize(impTxt,CW)
  doc.setTextColor(50,62,72); doc.setFontSize(9.5); doc.setFont('helvetica','normal')
  doc.text(ilines2,ML,y); y+=ilines2.length*5.5+10

  // 4.3 Alertes vs seuils
  y=pdfSectionHeader(doc,"4.3  Vérification des seuils d'alerte",y); y+=4
  const aCols=['Axe','Seuil orange','Seuil rouge','T. max observé','Statut']
  const aCW=[35,33,33,35,46]
  tx=ML
  doc.setFillColor(27,79,138); doc.rect(ML,y,CW,7,'F')
  doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont('helvetica','bold')
  aCols.forEach((c,i)=>{doc.text(c,tx+2,y+5);tx+=aCW[i]}); y+=7
  const refSeuils=[{nom:'CARENA',o:39,r:50},{nom:'Toyota CFAO',o:24,r:31},{nom:'SODECI',o:25,r:33}]
  refSeuils.forEach((ref,ri)=>{
    const found=rows.find(row=>row.axe&&row.axe.includes(ref.nom.split(' ')[0]))
    const tMax=found?found.tMax:null
    let statut='Normal', sc=[39,174,96]
    if(tMax!==null){
      if(tMax>=ref.r){statut='Seuil rouge atteint !';sc=[192,57,43]}
      else if(tMax>=ref.o){statut='Seuil orange atteint';sc=[230,126,34]}
    }
    doc.setFillColor(ri%2===0?244:255,ri%2===0?247:255,ri%2===0?250:255)
    doc.rect(ML,y,CW,7,'F')
    tx=ML
    const vals2=[ref.nom,`>= ${ref.o} min`,`>= ${ref.r} min`,tMax!==null?`${tMax} min`:'—']
    doc.setTextColor(50,62,72); doc.setFontSize(7.5); doc.setFont('helvetica','normal')
    vals2.forEach((v,i)=>{doc.text(v,tx+2,y+5);tx+=aCW[i]})
    doc.setTextColor(...sc); doc.setFont('helvetica','bold')
    doc.text(statut,tx+2,y+5); y+=7
  })
  y+=5
  doc.setTextColor(140,140,140); doc.setFontSize(7.5); doc.setFont('helvetica','italic')
  doc.text("Seuils définis dans defaultData.js : seuilOrange = tRef × 1,4 — seuilRouge = tRef × 1,8.", ML, y)
  pdfPageFooter(doc, rapport, doc.internal.getCurrentPageInfo().pageNumber, 5)

  // ── PAGE 5 : RECOMMANDATIONS + CONCLUSION ───────────────────
  doc.addPage()
  pdfPageHeader(doc, rapport, 'RECOMMANDATIONS OPÉRATIONNELLES', logo64)
  y=24
  doc.setTextColor(27,79,138); doc.setFontSize(14); doc.setFont('helvetica','bold')
  doc.text('5. Recommandations opérationnelles', ML, y); y+=12

  pdfRecommandations(rows,nGlobal).forEach((rec,i)=>{
    if(y>248){doc.addPage();pdfPageHeader(doc,rapport,'RECOMMANDATIONS',logo64);y=26}
    doc.setFillColor(27,79,138); doc.circle(ML+4,y+4,4,'F')
    doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold')
    doc.text(String(i+1),ML+4,y+5.5,{align:'center'})
    doc.setFillColor(240,245,255); doc.rect(ML+10,y,CW-10,9,'F')
    doc.setTextColor(27,79,138); doc.setFontSize(9); doc.setFont('helvetica','bold')
    doc.text(rec.t,ML+14,y+6); y+=11
    const rlines=doc.splitTextToSize(rec.b,CW-10)
    doc.setTextColor(50,62,72); doc.setFontSize(8.5); doc.setFont('helvetica','normal')
    doc.text(rlines,ML+10,y); y+=rlines.length*5+8
  })

  y+=5; y=pdfSectionHeader(doc,'Conclusion',y); y+=5
  const concl=`Ce rapport ${rapport.type} (${rapport.periodeLabel}) synthétise ${rapport.nbMesuresTotal>0?rapport.nbMesuresTotal+' mesures automatiques':'les données live disponibles'} collectées par FlowPort sur le réseau PAA. État global : ${pdfNiveauLabel(nGlobal)} (ratio ${avgRatio.toFixed(2)}). Document généré automatiquement par FlowPort v2 — toute décision opérationnelle doit être validée par la DEESP du PAA avant mise en œuvre.`
  const clines2=doc.splitTextToSize(concl,CW)
  doc.setTextColor(50,62,72); doc.setFontSize(9.5); doc.setFont('helvetica','normal')
  doc.text(clines2,ML,y); y+=clines2.length*5.5+14

  if(y<250){
    doc.setFillColor(240,244,248); doc.rect(ML,y,CW,36,'F')
    doc.setFillColor(27,79,138); doc.rect(ML,y,CW,2,'F')
    doc.setTextColor(50,62,72); doc.setFontSize(9); doc.setFont('helvetica','bold')
    doc.text('Validé par :', ML+5, y+11)
    doc.setFont('helvetica','normal')
    doc.text("Direction des Études et de l'Exploitation du PAA (DEESP)", ML+5, y+19)
    doc.text(`Date : ${rapport.date.toLocaleDateString('fr-FR')}`, ML+5, y+27)
    doc.setFillColor(210,215,220); doc.rect(ML+100,y+6,70,22,'F')
    doc.setTextColor(180,180,180); doc.setFontSize(8)
    doc.text('Signature et cachet', ML+135, y+18, {align:'center'})
  }
  pdfPageFooter(doc, rapport, doc.internal.getCurrentPageInfo().pageNumber, 5)

  doc.save(`${rapport.nom}.pdf`)
}

// ── Génération Excel ──────────────────────────────────────────

function telechargerExcel(rapport, rows) {
  const wb = XLSX.utils.book_new()

  // Feuille 1 — Synthèse
  const ratios = rows.map(r => r.tRef>0 ? r.tMoyen/r.tRef : 1)
  const avgRatio = ratios.reduce((a,b)=>a+b,0)/(ratios.length||1)
  const retardGlobal = Math.round(rows.reduce((a,r)=>a+(r.retard||0),0)/(rows.length||1)*10)/10
  const niveauGlobal = avgRatio<=1.10?'Fluide':avgRatio<=1.25?'Bon':avgRatio<=1.50?'Ralenti':avgRatio<=2?'Congestionné':'Très congestionné'

  const ws1 = XLSX.utils.aoa_to_sheet([
    [`FlowPort — Rapport Trafic PAA — ${rapport.type.toUpperCase()}`],
    [`Référence : DEESP-RF-01`],
    [],
    [`Période analysée`, rapport.periodeLabel],
    [`Date de génération`, rapport.date.toLocaleString('fr-FR')],
    [`Mesures collectées`, rapport.nbMesuresTotal > 0 ? `${rapport.nbMesuresTotal} relevés automatiques` : 'Données live uniquement'],
    [`Axes surveillés`, '3 axes bidirectionnels — Réseau routier PAA Abidjan'],
    [],
    [`ÉTAT GLOBAL`, niveauGlobal],
    [`Ratio moyen`, avgRatio.toFixed(3)],
    [`Retard moyen global`, `${retardGlobal >= 0 ? '+' : ''}${retardGlobal} min`],
    [`Axes dégradés (N3+)`, `${rows.filter(r=>r.tRef>0&&r.tMoyen/r.tRef>1.25).length} / ${rows.length}`],
    [],
    ['Axe', 'T. Réf (min)', 'T. Min (min)', 'T. Moyen (min)', 'T. Max (min)', 'Retard moy. (min)', 'Ratio', 'Niveau', 'Vitesse (km/h)', 'Nb relevés'],
    ...rows.map(r => [
      r.axe, r.tRef, r.tMin, r.tMoyen, r.tMax,
      `${r.retard>=0?'+':''}${r.retard}`,
      (r.tRef>0?r.tMoyen/r.tRef:1).toFixed(3),
      pdfNiveauLabel(r.niveau), r.vitesse,
      r.nbMesures > 0 ? r.nbMesures : 'live',
    ]),
    [],
    ['Source', 'TomTom Routing API v1 + collecte_auto Firestore (GitHub Actions cron */10min)'],
    ['Modèle ML', 'Random Forest · 100 estimateurs · accuracy 79,18 % · 2016 mesures fév.2025'],
    ['Seuils', 'seuilOrange = tRef × 1,4 (N3) — seuilRouge = tRef × 1,8 (N5)'],
  ])
  XLSX.utils.book_append_sheet(wb, ws1, 'Synthèse')

  // Feuille 2 — Interprétations
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Axe', 'Ratio', 'Niveau', 'Interprétation', 'Recommandation'],
    ...rows.map(r => {
      const ratio = r.tRef>0 ? r.tMoyen/r.tRef : 1
      const retardPct = Math.round((ratio-1)*100)
      let interp, reco
      if(ratio<=1.05){interp=`Conditions optimales (+${retardPct}% vs référence)`;reco='Aucune action requise.'}
      else if(ratio<=1.25){interp=`Légère dégradation (+${retardPct}%, retard ${r.retard>=0?'+':''}${r.retard} min)`;reco='Surveillance renforcée aux heures de pointe.'}
      else if(ratio<=1.50){interp=`Ralentissements significatifs (+${retardPct}%, seuil orange)`;reco='Signalisation dynamique + révision des créneaux de rotation.'}
      else if(ratio<=2.00){interp=`Congestion (+${retardPct}%, ratio ${ratio.toFixed(2)})`;reco='Protocoles de gestion de crise — contacter Direction Exploitation.'}
      else{interp=`Congestion sévère (+${retardPct}%, ratio ${ratio.toFixed(2)})`;reco='Intervention urgente — déviation poids lourds + alerte cellule crise.'}
      return [r.axe, ratio.toFixed(3), pdfNiveauLabel(r.niveau), interp, reco]
    }),
  ])
  XLSX.utils.book_append_sheet(wb, ws2, 'Interprétations')

  // Feuille 3 — Référence seuils
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Grille de niveaux FlowPort'],
    [],
    ['Niveau', 'Label', 'Ratio I4', 'Signification'],
    ['N1', 'Fluide',            '≤ 1,10', 'Conditions optimales — pas de retard notable'],
    ['N2', 'Bon',               '1,10 – 1,25', 'Légère dégradation — surveillance recommandée'],
    ['N3', 'Ralenti',           '1,25 – 1,50', 'Ralentissements — mesures préventives'],
    ['N4', 'Congestionné',      '1,50 – 2,00', 'Congestion — action corrective requise'],
    ['N5', 'Très congestionné', '> 2,00', 'Crise trafic — intervention d\'urgence'],
    [],
    ['Seuils d\'alerte par axe (calculés depuis tRef × facteur)'],
    [],
    ['Axe', 'T. référence', 'Seuil orange (×1,4)', 'Seuil rouge (×1,8)', 'Distance', 'Vitesse réf.'],
    ['CARENA',      '27,4 min', '39 min', '50 min', '12,4 km', '27,2 km/h'],
    ['Toyota CFAO', '16,9 min', '24 min', '31 min', '7,0 km',  '24,9 km/h'],
    ['SODECI',      '17,8 min', '25 min', '33 min', '10,9 km', '36,7 km/h'],
    [],
    ['Créneaux critiques identifiés par le modèle ML (axes aller)'],
    [],
    ['Heure', 'CARENA (min)', 'Toyota CFAO (min)', 'SODECI (min)', 'Niveau typique'],
    ['7h',  '24,3', '14,0', '14,8', 'N1 — Fluide (meilleur créneau)'],
    ['8h',  '25,3', '14,7', '15,5', 'N1 — Fluide'],
    ['9h',  '26,9', '15,8', '16,3', 'N1–N2'],
    ['10h', '29,5', '16,9', '18,1', 'N2 — Bon'],
    ['11h', '30,6', '17,9', '19,0', 'N2 — Bon (début pic)'],
    ['12h', '31,0', '19,0', '20,1', 'N2 — Pic midi (ratio 1,12–1,13)'],
    ['13h', '28,9', '17,9', '18,6', 'N1–N2'],
    ['14h', '27,0', '15,8', '16,8', 'N1 — Fluide'],
    ['15h', '27,3', '16,5', '17,6', 'N1 — Fluide'],
    ['16h', '26,8', '16,4', '17,8', 'N1 — Fluide'],
    ['17h', '27,1', '16,2', '17,5', 'N1 — Fluide'],
    ['18h', '25,2', '15,6', '16,4', 'N1 — Fluide'],
  ])
  XLSX.utils.book_append_sheet(wb, ws3, 'Référence & Seuils')

  XLSX.writeFile(wb, `${rapport.nom}.xlsx`)
}

// ── Helpers Word ──────────────────────────────────────────────

function wBorder() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  return { top: b, bottom: b, left: b, right: b }
}
function wCell(txt, { bold=false, color='2C3E50', bg='FFFFFF', center=false, size=20 }={}) {
  return new TableCell({
    borders: wBorder(),
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(txt), font: 'Arial', size, bold, color })],
    })],
  })
}
function wHdrCell(txt) {
  return wCell(txt, { bold: true, color: 'FFFFFF', bg: '1B4F8A', center: true })
}
function wRow(cells) { return new TableRow({ children: cells }) }
function wTbl(rows, widths) {
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  })
}
function wPar(txt, { bold=false, color='2C3E50', size=22, center=false, after=160, italic=false }={}) {
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after, line: 276 },
    children: [new TextRun({ text: txt, font: 'Arial', size, bold, color, italics: italic })],
  })
}
function wH1(txt) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text: txt, font: 'Arial', size: 32, bold: true, color: '1B4F8A' })],
  })
}
function wH2(txt) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text: txt, font: 'Arial', size: 26, bold: true, color: '2874A6' })],
  })
}
function wSp(a=120) { return new Paragraph({ spacing: { after: a }, children: [] }) }

function wNiveauColor(n) {
  return ['','1E8449','27AE60','E67E22','D35400','C0392B'][n]||'7F8C8D'
}
function wNiveauBg(n) {
  return ['','D5F5E3','D5F5E3','FEF9C3','FDEBD0','FDECEA'][n]||'F0F0F0'
}

function wInterpretation(row) {
  const ratio = row.tRef>0 ? row.tMoyen/row.tRef : 1
  const retardPct = Math.round((ratio-1)*100)
  const r = row.retard>=0?`+${row.retard} min`:`${row.retard} min`
  const n = pdfNiveauLabel(row.niveau)
  if(ratio<=1.05) return `Conditions de circulation optimales (${n}). Le temps moyen enregistré (${row.tMoyen} min) est quasi identique au temps de reference (${row.tRef} min), avec un ecart de seulement +${retardPct}%. La vitesse estimee (${row.vitesse} km/h) confirme la fluidite. Aucune mesure corrective n'est requise.`
  if(ratio<=1.25) return `Legere degradation classee ${n}. Le temps moyen (${row.tMoyen} min) depasse la reference de ${r} (+${retardPct}%). Variabilite observee : min ${row.tMin} min / max ${row.tMax} min. Surveillance renforcee recommandee aux heures de pointe (11h-12h, 16h30-18h30).`
  if(ratio<=1.50) return `ALERTE : Ralentissements significatifs (${n}). Le temps moyen (${row.tMoyen} min) depasse le seuil orange, avec ${r} de retard (+${retardPct}%). Mesures recommandees : signalisation dynamique, coordination operateurs portuaires, revision des creneaux de rotation.`
  if(ratio<=2.00) return `CONGESTION : L'axe est en etat de congestion (${n}). Ratio ${ratio.toFixed(2)}, retard moyen ${r} (+${retardPct}%). Vitesse : ${row.vitesse} km/h. Contact immediat avec la Direction de l'Exploitation pour activer les protocoles de crise trafic.`
  return `CRITIQUE : Congestion severe (${n}). Ratio ${ratio.toFixed(2)} - retard ${r} (+${retardPct}%). Intervention d'urgence requise : deviation poids lourds, alerte cellule de crise PAA, communication immediate aux operateurs de terminal.`
}

// ── Génération Word ───────────────────────────────────────────

async function telechargerWord(rapport, rows) {
  const now = rapport.date.toLocaleString('fr-FR')
  const ratios = rows.map(r => r.tRef>0 ? r.tMoyen/r.tRef : 1)
  const avgRatio = ratios.reduce((a,b)=>a+b,0)/(ratios.length||1)
  const nGlobal = avgRatio<=1.10?1:avgRatio<=1.25?2:avgRatio<=1.50?3:avgRatio<=2?4:5
  const retardGlobal = Math.round(rows.reduce((a,r)=>a+(r.retard||0),0)/(rows.length||1)*10)/10
  const nbDeg = rows.filter(r => r.tRef>0 && r.tMoyen/r.tRef>1.25).length
  const sorted = [...rows].sort((a,b)=>(b.tMoyen/b.tRef)-(a.tMoyen/a.tRef))
  const best = sorted[sorted.length-1], worst = sorted[0]
  const totRetard = rows.reduce((a,r)=>a+Math.max(0,r.retard),0)

  const docx = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id:'Heading1', name:'Heading 1', basedOn:'Normal', next:'Normal', quickFormat:true,
          run:{ size:32, bold:true, font:'Arial', color:'1B4F8A' },
          paragraph:{ spacing:{ before:360, after:200 }, outlineLevel:0 } },
        { id:'Heading2', name:'Heading 2', basedOn:'Normal', next:'Normal', quickFormat:true,
          run:{ size:26, bold:true, font:'Arial', color:'2874A6' },
          paragraph:{ spacing:{ before:240, after:160 }, outlineLevel:1 } },
        { id:'Heading3', name:'Heading 3', basedOn:'Normal', next:'Normal', quickFormat:true,
          run:{ size:22, bold:true, font:'Arial', color:'34495E' },
          paragraph:{ spacing:{ before:180, after:120 }, outlineLevel:2 } },
      ],
    },
    sections: [
      // ── PAGE DE GARDE ─────────────────────────────────────────
      {
        properties: { page: { size:{ width:11906, height:16838 }, margin:{ top:1800, right:1134, bottom:1440, left:1134 } } },
        children: [
          wSp(800),
          wPar('FlowPort — Port Autonome d\'Abidjan', { bold:true, size:22, color:'7F8C8D', center:true }),
          wPar('DEESP — Direction des Etudes et de l\'Exploitation du PAA', { italic:true, size:18, color:'95A5A6', center:true, after:400 }),
          wPar('RAPPORT OFFICIEL DE TRAFIC', { bold:true, size:72, color:'1B4F8A', center:true, after:200 }),
          wPar(rapport.type.toUpperCase(), { bold:true, size:36, color:'2874A6', center:true, after:400 }),
          wPar('DEESP-RF-01', { bold:true, size:28, color:'2874A6', center:true, after:600 }),
          wTbl([
            wRow([wHdrCell('Informations du rapport')]),
            wRow([wCell(`Periode analysee : ${rapport.periodeLabel}`)]),
            wRow([wCell(`Type de rapport : ${rapport.type.charAt(0).toUpperCase()+rapport.type.slice(1)}`, { bg:'F4F7FA' })]),
            wRow([wCell(`Date de generation : ${now}`)]),
            wRow([wCell(`Mesures collectees : ${rapport.nbMesuresTotal>0?rapport.nbMesuresTotal+' releves automatiques':'Donnees live uniquement'}`, { bg:'F4F7FA' })]),
            wRow([wCell('Axes surveilles : 3 axes bidirectionnels — Reseau routier PAA Abidjan')]),
          ], [9026]),
          wSp(400),
          wTbl([
            wRow([wCell(`ETAT GLOBAL : ${pdfNiveauLabel(nGlobal).toUpperCase()}`, { bold:true, color:'FFFFFF', bg:wNiveauColor(nGlobal), center:true, size:24 })]),
          ], [9026]),
          wSp(400),
          wPar('Confidentiel — Usage interne PAA — Ne pas diffuser sans autorisation', { italic:true, size:16, color:'95A5A6', center:true }),
        ],
      },
      // ── CORPS ─────────────────────────────────────────────────
      {
        properties: { page:{ size:{ width:11906, height:16838 }, margin:{ top:1134, right:1134, bottom:1134, left:1134 } } },
        headers: { default: new Header({ children:[new Paragraph({
          border:{ bottom:{ style:BorderStyle.SINGLE, size:2, color:'1B4F8A', space:1 } },
          children:[new TextRun({ text:`FlowPort — Rapport Trafic PAA — ${rapport.periodeLabel}`, font:'Arial', size:18, color:'7F8C8D' })],
        })]}) },
        footers: { default: new Footer({ children:[new Paragraph({
          alignment: AlignmentType.CENTER,
          border:{ top:{ style:BorderStyle.SINGLE, size:2, color:'CCCCCC', space:1 } },
          children:[
            new TextRun({ text:"FlowPort v2 · Port Autonome d'Abidjan · Page ", font:'Arial', size:16, color:'7F8C8D' }),
            new TextRun({ children:[PageNumber.CURRENT], font:'Arial', size:16, color:'7F8C8D' }),
          ],
        })]}) },
        children: [
          // 1. Synthese executive
          wH1('1. Synthese executive'),
          wSp(0),
          wTbl([
            wRow([wHdrCell('Indicateur'), wHdrCell('Valeur'), wHdrCell('Interpretation')]),
            wRow([wCell('Temps moyen global'), wCell(`${Math.round(rows.reduce((a,r)=>a+r.tMoyen,0)/(rows.length||1)*10)/10} min`, {center:true,bold:true,color:'1B4F8A'}), wCell('Tous axes, sens aller')]),
            wRow([wCell('Retard moyen global', {bg:'F4F7FA'}), wCell(`${retardGlobal>=0?'+':''}${retardGlobal} min`, {center:true,bold:true,color:retardGlobal>5?'D35400':'1E8449',bg:'F4F7FA'}), wCell(`${retardGlobal<=0?'En avance sur les references':retardGlobal<=5?'Retard faible — surveiller':retardGlobal<=15?'Retard modere — actions preventives':'Retard important — actions correctives'}`, {bg:'F4F7FA'})]),
            wRow([wCell('Axes degrades (N3+)'), wCell(`${nbDeg} / ${rows.length}`, {center:true,bold:true,color:nbDeg>0?'D35400':'1E8449'}), wCell(`${nbDeg===0?'Aucun axe en alerte':nbDeg===1?'1 axe depasse le seuil orange':nbDeg+' axes depassent le seuil orange'}`)]),
            wRow([wCell('Niveau global reseau', {bg:'F4F7FA'}), wCell(pdfNiveauLabel(nGlobal), {center:true,bold:true,color:wNiveauColor(nGlobal),bg:wNiveauBg(nGlobal)}), wCell(`Ratio moyen : ${avgRatio.toFixed(3)}`, {bg:'F4F7FA'})]),
          ], [3500, 2000, 3526]),
          wSp(200),

          // Etat global texte
          wH2('1.1 Etat de la circulation sur la periode'),
          wPar(nGlobal<=2
            ? `Sur la periode ${rapport.periodeLabel}, les conditions de circulation sur le reseau PAA ont ete globalement satisfaisantes. Le ratio moyen de ${avgRatio.toFixed(2)} classe la situation au niveau ${pdfNiveauLabel(nGlobal)}.${nbDeg===0?' Aucun axe n\'a atteint le seuil d\'alerte N3.':`${nbDeg} axe(s) sur ${rows.length} ont toutefois depasse le seuil orange.`} Les operations portuaires ont pu se derouler dans des conditions ${nGlobal===1?'optimales':'acceptables'}.`
            : nGlobal===3
            ? `Sur la periode ${rapport.periodeLabel}, des ralentissements moderes ont ete enregistres sur le reseau PAA. Le ratio moyen de ${avgRatio.toFixed(2)} correspond au niveau ${pdfNiveauLabel(nGlobal)}. ${nbDeg} axe(s) sont en etat degrade. Des mesures preventives sont recommandees.`
            : `ALERTE : Sur la periode ${rapport.periodeLabel}, des episodes de congestion significatifs ont ete enregistres. Le ratio moyen de ${avgRatio.toFixed(2)} correspond au niveau ${pdfNiveauLabel(nGlobal)}. ${nbDeg} axe(s) sur ${rows.length} sont en congestion N4+. Des mesures correctives urgentes sont requises.`
          ),

          // 2. Statistiques detaillees
          wH1('2. Statistiques detaillees par axe'),
          wTbl([
            wRow([wHdrCell('Axe'), wHdrCell('T. Ref.'), wHdrCell('T. Min.'), wHdrCell('T. Moyen'), wHdrCell('T. Max.'), wHdrCell('Retard'), wHdrCell('Ratio'), wHdrCell('Niveau'), wHdrCell('Vitesse'), wHdrCell('Releves')]),
            ...rows.map((r,ri) => {
              const ratio2 = r.tRef>0 ? r.tMoyen/r.tRef : 1
              const bg = ri%2===0 ? 'F4F7FA' : 'FFFFFF'
              return wRow([
                wCell(r.axe, {bg,bold:true}),
                wCell(`${r.tRef} min`, {bg,center:true}),
                wCell(`${r.tMin} min`, {bg,center:true,color:'1E8449'}),
                wCell(`${r.tMoyen} min`, {bg,center:true,bold:true}),
                wCell(`${r.tMax} min`, {bg,center:true,color:'D35400'}),
                wCell(`${r.retard>=0?'+':''}${r.retard} min`, {bg,center:true,bold:true,color:r.retard>10?'D35400':r.retard>0?'E67E22':'1E8449'}),
                wCell(ratio2.toFixed(2), {bg,center:true}),
                wCell(pdfNiveauLabel(r.niveau), {bg:wNiveauBg(r.niveau),color:wNiveauColor(r.niveau),bold:true,center:true}),
                wCell(`${r.vitesse} km/h`, {bg,center:true}),
                wCell(r.nbMesures>0?String(r.nbMesures):'live', {bg,center:true}),
              ])
            }),
          ], [1800,900,900,1000,900,1000,800,1400,1100,226]),
          wPar('Source : TomTom Routing API v1 + collecte_auto Firestore. Vitesse calculee depuis distance / temps de parcours.', {italic:true,size:16,color:'95A5A6',after:240}),

          // 3. Analyse par axe
          wH1('3. Analyse et interpretation par axe'),
          ...rows.flatMap(row => {
            const ratio3 = row.tRef>0 ? row.tMoyen/row.tRef : 1
            const retardPct = Math.round((ratio3-1)*100)
            return [
              wH2(`Axe ${row.axe}`),
              wTbl([
                wRow([wHdrCell('T. reference'), wHdrCell('T. moyen'), wHdrCell('Retard'), wHdrCell('Ratio'), wHdrCell('Vitesse'), wHdrCell('Niveau')]),
                wRow([
                  wCell(`${row.tRef} min`, {center:true}),
                  wCell(`${row.tMoyen} min`, {center:true,bold:true}),
                  wCell(`${row.retard>=0?'+':''}${row.retard} min (+${retardPct}%)`, {center:true,bold:true,color:row.retard>10?'D35400':row.retard>0?'E67E22':'1E8449'}),
                  wCell(ratio3.toFixed(3), {center:true}),
                  wCell(`${row.vitesse} km/h`, {center:true}),
                  wCell(pdfNiveauLabel(row.niveau), {bg:wNiveauBg(row.niveau),color:wNiveauColor(row.niveau),bold:true,center:true}),
                ]),
              ], [1600,1500,2000,1200,1400,1326]),
              wSp(80),
              wPar(wInterpretation(row), {after:200}),
            ]
          }),

          // 4. Comparaison inter-axes
          wH1('4. Comparaison et tendances'),
          wH2('4.1 Classement des axes par performance'),
          wTbl([
            wRow([wHdrCell('Rang'), wHdrCell('Axe'), wHdrCell('Ratio'), wHdrCell('Performance'), wHdrCell('Ecart vs meilleur axe')]),
            ...[...rows].sort((a,b)=>(a.tMoyen/a.tRef)-(b.tMoyen/b.tRef)).map((r,i) => {
              const ratio4=r.tRef>0?r.tMoyen/r.tRef:1
              const bestRatio=rows.length?Math.min(...rows.map(x=>x.tRef>0?x.tMoyen/x.tRef:1)):1
              const ecart=Math.round((ratio4-bestRatio)*100)
              const perf=ratio4<=1.05?'Excellent':ratio4<=1.25?'Satisfaisant':ratio4<=1.50?'Degrade':'Critique'
              return wRow([
                wCell(`#${i+1}`, {center:true,bold:true,color:i===0?'1E8449':i===rows.length-1?'C0392B':'E67E22'}),
                wCell(r.axe, {bold:true,bg:i%2===0?'F4F7FA':'FFFFFF'}),
                wCell(ratio4.toFixed(3), {center:true,bg:i%2===0?'F4F7FA':'FFFFFF'}),
                wCell(perf, {bold:true,color:i===0?'1E8449':i===rows.length-1?'C0392B':'E67E22',bg:wNiveauBg(r.niveau)}),
                wCell(ecart===0?'Reference':'+'+ecart+' pts', {center:true,bg:i%2===0?'F4F7FA':'FFFFFF'}),
              ])
            }),
          ], [900,2200,1200,2000,2726]),
          wSp(160),
          rows.length>=2 ? wPar(
            `L'axe le plus performant est l'axe ${best?.axe} (ratio ${best?((best.tMoyen/best.tRef).toFixed(2)):'—'}). ` +
            `L'axe ${worst?.axe} presente le niveau de degradation le plus eleve (ratio ${worst?((worst.tMoyen/worst.tRef).toFixed(2)):'—'}, retard ${worst?pdfFmtRetard(worst.retard):'—'}). ` +
            `L'ecart inter-axes de ${Math.round(Math.abs((worst?.tMoyen/worst?.tRef||1)-(best?.tMoyen/best?.tRef||1))*100)} pts de ratio ${Math.abs((worst?.tMoyen/worst?.tRef||1)-(best?.tMoyen/best?.tRef||1))>0.20?'revele une disparite significative qui plaide pour un reequilibrage des flux portuaires':'indique une relative homogeneite des conditions de circulation sur le reseau PAA'}.`
          ) : wPar('Donnees insuffisantes pour la comparaison inter-axes.'),

          wH2('4.2 Impact operationnel des retards'),
          wPar(`Retard cumule moyen sur l'ensemble du reseau : ${totRetard.toFixed(1)} min par rotation. En considerant 50 rotations camions/jour/axe, cela represente environ ${Math.round(totRetard*50/60)} heures-conducteur perdues par jour. Sur 22 jours ouvres, l'impact mensuel atteindrait ${Math.round(totRetard*50/60*22)} heures, justifiant l'investissement dans un systeme de monitoring comme FlowPort.`),

          // 5. Recommandations
          wH1('5. Recommandations operationnelles'),
          wH2('5.1 Optimisation des creneaux de depart'),
          wPar(`Le modele predictif ML (Random Forest, 79,18 % de precision sur 2 016 mesures historiques) identifie le creneau 11h00-12h00 comme le plus charge sur les 3 axes (ratios 1,12-1,13). Planifier les rotations prioritaires avant 9h30 ou apres 14h00. Le samedi presente systematiquement les meilleures conditions.`),

          ...rows.filter(r=>r.tRef>0&&r.tMoyen/r.tRef>1.25).flatMap(r => [
            wH2(`5.x  Axe ${r.axe} — Reduction du retard`),
            wPar(`Retard moyen observe : ${pdfFmtRetard(r.retard)}. Actions : (1) Reporter les rotations non urgentes vers 7h-9h ou 14h-16h. (2) Activer la signalisation d'alerte dynamique. (3) Notifier les prestataires logistiques des conditions degradees.`),
          ]),

          wH2('5.2 Continuite du monitoring automatique'),
          wPar(`La collecte automatisee (GitHub Actions, cron toutes les 10 min) garantit des donnees fraiches meme sans navigateur ouvert. Verifier mensuellement les logs GitHub Actions et la validite des cles API TomTom. En cas d'indisponibilite, le fallback OSRM s'active automatiquement.`),

          // 6. Conclusion
          wH1('6. Conclusion'),
          wPar(`Ce rapport ${rapport.type} couvre la periode ${rapport.periodeLabel} et synthetise ${rapport.nbMesuresTotal>0?rapport.nbMesuresTotal+' mesures automatiques':'les donnees live disponibles'} collectees par FlowPort sur le reseau du PAA. Etat global : ${pdfNiveauLabel(nGlobal)} (ratio moyen : ${avgRatio.toFixed(2)}). Ce document a ete genere automatiquement par FlowPort v2 — toute decision operationnelle doit etre validee par la DEESP du PAA avant mise en oeuvre.`),
          wSp(200),
          wTbl([
            wRow([wCell('Valide par :', {bold:true}), wCell(`Direction des Etudes et de l'Exploitation (DEESP) — PAA Abidjan`), wCell(`Date : ${rapport.date.toLocaleDateString('fr-FR')}`)]),
            wRow([wCell('Signature :', {bold:true}), wCell('', {bg:'F4F7FA'}), wCell('')]),
          ], [2000,5000,2026]),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(docx)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `${rapport.nom}.docx`; a.click()
  URL.revokeObjectURL(url)
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

  async function genererRapport() {
    setLoading(true)
    try {
      const records      = await fetchPeriodData(type, periode)
      const rows         = aggregerParAxe(records, mesures, axes)
      const { label }    = getPeriodeBounds(type, periode)
      const nbMesuresTotal = records.length
      const nom          = `PAA-${type.charAt(0).toUpperCase() + type.slice(1)}-${periode}`

      setRapports(prev => [{
        id: Date.now(), nom, type, periode,
        periodeLabel:  label,
        format, date:  new Date(),
        rows, nbMesuresTotal,
      }, ...prev])
    } catch (err) {
      console.error('Erreur génération rapport :', err)
      // Fallback live si Firestore inaccessible
      const rows = aggregerParAxe([], mesures, axes)
      const nom  = `PAA-${type.charAt(0).toUpperCase() + type.slice(1)}-${periode}`
      setRapports(prev => [{
        id: Date.now(), nom, type, periode,
        periodeLabel:  periode,
        format, date:  new Date(),
        rows, nbMesuresTotal: 0,
      }, ...prev])
    } finally {
      setLoading(false)
    }
  }

  async function telecharger(rapport, fmt) {
    const rows = rapport.rows ?? []
    if (fmt === 'pdf')        telechargerPDF(rapport, rows)
    else if (fmt === 'excel') telechargerExcel(rapport, rows)
    else if (fmt === 'word')  await telechargerWord(rapport, rows)
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
                        <p style={{ fontSize: 11, color: C.textMuted }}>{r.type} · {r.periodeLabel}</p>
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
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="fp-btn fp-btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }} onClick={() => telecharger(r, 'pdf')}>
                      <Download size={12} /> PDF
                    </button>
                    <button className="fp-btn fp-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }} onClick={() => telecharger(r, 'excel')}>
                      <Download size={12} /> Excel
                    </button>
                    <button className="fp-btn fp-btn-ghost" style={{ padding: '0.35rem 0.75rem', fontSize: 12 }} onClick={() => telecharger(r, 'word')}>
                      <Download size={12} /> Word
                    </button>
                    <button className="fp-btn fp-btn-danger" style={{ padding: '0.35rem 0.6rem' }} onClick={() => setRapports(prev => prev.filter(x => x.id !== r.id))}>
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
