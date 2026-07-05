// ============================================================
// MethodologiePage.jsx — Transparence méthodologique (publique)
// D'où viennent les données, comment sont calculés les niveaux,
// les références, les prévisions et les alertes. Les valeurs
// affichées sont lues dans la configuration réelle (axes
// Firestore, métadonnées du modèle ML) — jamais codées en dur.
// ============================================================

import { useState, useEffect } from 'react'
import { Satellite, Route, Gauge, Layers3, BrainCircuit, BellRing, AlertTriangle } from 'lucide-react'
import { C, levelColor, levelBg } from '../styles/tokens'
import { useAxesFirestore } from '../hooks/useAxesFirestore'
import { AXES_OFFICIELS } from '../hooks/useTrafficData'
import { useIsMobile } from '../hooks/useIsMobile'

const NIVEAUX = [
  { n: 1, label: 'Fluide',            ratio: '≤ 1,10',      lecture: 'Conditions normales, pas de retard notable' },
  { n: 2, label: 'Bon',               ratio: '1,10 – 1,25', lecture: 'Légère densification, surveillance simple' },
  { n: 3, label: 'Ralenti',           ratio: '1,25 – 1,50', lecture: 'Ralentissements — pré-alertes possibles' },
  { n: 4, label: 'Congestionné',      ratio: '1,50 – 2,00', lecture: 'Congestion — alerte email aux administrateurs' },
  { n: 5, label: 'Très congestionné', ratio: '> 2,00',      lecture: 'Situation critique — intervention urgente' },
]

function Section({ icon: Icon, titre, children }) {
  return (
    <div className="fp-card" style={{ padding: '1.1rem 1.3rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: '0.6rem' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: '#EBF2FB', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={C.primary} />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>{titre}</h2>
      </div>
      <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  )
}

function MethodologiePage() {
  const isMobile = useIsMobile()
  const { axes: firestoreAxes } = useAxesFirestore()
  const axes = firestoreAxes.length > 0 ? firestoreAxes.filter(a => a.actif !== false) : AXES_OFFICIELS
  const [ml, setMl] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}predictions.json`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.meta && setMl(d.meta))
      .catch(() => {})
  }, [])

  const thStyle = { background: C.primary, color: '#fff', padding: '6px 10px', fontSize: 11.5, textAlign: 'left', whiteSpace: 'nowrap' }
  const tdStyle = { padding: '6px 10px', fontSize: 12, borderTop: '1px solid #eef2f6' }

  return (
    <div style={{ padding: isMobile ? '0.85rem' : '1.25rem', height: isMobile ? 'auto' : '100vh', overflow: 'auto' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.9rem', paddingBottom: '1.5rem' }}>

        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: C.text }}>Méthodologie</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
            Comment FlowPort mesure, qualifie et anticipe le trafic de la zone portuaire — en toute transparence.
          </p>
        </div>

        <Section icon={Satellite} titre="La mesure : un relevé toutes les 5 minutes, 24 h/24">
          <p>
            Un collecteur automatique (GitHub Actions) interroge toutes les 5 minutes les services de trafic
            <strong> Google Distance Matrix</strong> (source principale) et <strong>TomTom Routing</strong> (secours) pour
            obtenir le temps de parcours réel de chaque axe, dans les deux sens de circulation — soit {axes.length * 2} mesures
            par relevé, environ 1 700 par jour. Chaque relevé est horodaté et archivé : la base s&apos;enrichit en continu,
            sans intervention humaine, et fonde toutes les analyses du système.
          </p>
        </Section>

        <Section icon={Route} titre="Les axes surveillés">
          <p style={{ marginBottom: 8 }}>
            Trois axes stratégiques, définis avec la Direction des Études Économiques, de la Stratégie et de la
            Planification (document officiel des tronçons), convergent vers la Pharmacie Palm Beach — porte d&apos;entrée
            de la zone portuaire. Chaque axe est découpé en tronçons visibles sur la carte.
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Axe</th><th style={thStyle}>Distance</th><th style={thStyle}>Temps de référence</th><th style={thStyle}>Bidirectionnel</th>
              </tr></thead>
              <tbody>
                {axes.map(a => (
                  <tr key={a.id}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{a.nom ?? a.shortNom}</td>
                    <td style={tdStyle}>{a.distance ?? a.dist ?? '—'}</td>
                    <td style={tdStyle}>{a.tRef} min</td>
                    <td style={tdStyle}>{a.bidirectionnel ? 'Oui (aller + retour)' : 'Non'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section icon={Gauge} titre="Les niveaux de congestion (N1 → N5)">
          <p style={{ marginBottom: 8 }}>
            Chaque mesure est rapportée au <strong>temps de référence</strong> de l&apos;axe :
            ratio = temps mesuré ÷ temps de référence. Ce ratio détermine le niveau de service — la même grille est
            utilisée partout (carte, indicateurs, graphiques, alertes, rapports).
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Niveau</th><th style={thStyle}>Ratio</th><th style={thStyle}>Lecture opérationnelle</th>
              </tr></thead>
              <tbody>
                {NIVEAUX.map(({ n, label, ratio, lecture }) => (
                  <tr key={n}>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                        fontSize: 11, fontWeight: 700, background: levelBg(n), color: levelColor(n),
                      }}>N{n} — {label}</span>
                    </td>
                    <td style={tdStyle}>{ratio}</td>
                    <td style={tdStyle}>{lecture}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section icon={Layers3} titre="Des références qui s'auto-calibrent">
          <p>
            Un temps de référence trop haut rend un axe « aveugle » aux congestions ; trop bas, il alerte en permanence.
            FlowPort recalcule donc chaque semaine, depuis les relevés réels des 7 derniers jours :
            les <strong>références horaires</strong> (médiane par axe, sens et heure — utilisées par la heatmap, pour
            comparer chaque créneau à sa propre normale plutôt qu&apos;à une moyenne plate) et une
            <strong> recommandation de temps de référence</strong> par axe (33ᵉ centile de la distribution), que
            l&apos;administrateur peut appliquer en un clic. Le système reste ainsi calé sur la réalité du terrain,
            pas sur une photographie ancienne.
          </p>
        </Section>

        <Section icon={BrainCircuit} titre="Les prévisions (modèle prédictif)">
          <p>
            Un modèle d&apos;apprentissage automatique {ml?.modele ? <strong>({ml.modele})</strong> : null} entraîné sur des
            mesures réelles du terrain{ml?.accuracy ? <> — précision de <strong>{(ml.accuracy * 100).toFixed(1).replace('.', ',')} %</strong> en validation</> : null} —
            estime le niveau de congestion attendu par axe, sens, jour et heure. Ces prévisions alimentent le mode
            « Prévisions ML » de la carte, les créneaux à surveiller du récapitulatif matinal et les pré-alertes.
            Le modèle est réentraînable à mesure que la base de relevés s&apos;enrichit.
          </p>
        </Section>

        <Section icon={BellRing} titre="Alertes et rapports">
          <p>
            Trois canaux d&apos;anticipation par email : <strong>l&apos;alerte congestion</strong> (axe en N4+, confirmé sur
            2 relevés consécutifs, avec message de retour à la normale), la <strong>pré-alerte tendance</strong> (axe en N3
            dont le temps grimpe sur 3 relevés) et la <strong>pré-alerte prévisionnelle</strong> (créneau à risque anticipé
            par le modèle pour l&apos;heure suivante). S&apos;y ajoutent un <strong>récapitulatif chaque matin</strong> (6h30)
            et un <strong>bilan hebdomadaire</strong> (lundi). Les rapports officiels (PDF, Word, Excel — gabarit DEESP)
            sont générés depuis la page Rapports, à partir des mêmes relevés archivés.
          </p>
        </Section>

        <Section icon={AlertTriangle} titre="Limites connues">
          <p>
            Par transparence : (1) le temps mesuré correspond à l&apos;itinéraire le plus rapide entre les extrémités de
            l&apos;axe, qui peut différer ponctuellement du corridor officiel tracé sur la carte ; (2) les indicateurs des
            tronçons sont dérivés de la mesure de leur axe parent, proportionnellement à leur longueur — une mesure
            indépendante par tronçon est une évolution prévue ; (3) les prévisions reflètent les régularités passées et
            ne peuvent anticiper les événements exceptionnels (incident, travaux, escale majeure).
          </p>
        </Section>

        <p style={{ fontSize: 11, color: C.textLight, textAlign: 'center', margin: 0 }}>
          FlowPort — Port Autonome d&apos;Abidjan · système développé pour la DEESP · données TomTom / Google, archivage Firebase.
        </p>
      </div>
    </div>
  )
}

export default MethodologiePage
