# PortFlow

Dashboard de monitoring du trafic du Port Autonome d'Abidjan (PAA) — visualisation en temps réel des niveaux de congestion sur les axes du port (CARENA, TOYOTA CFAO, SODECI), cartographie, indicateurs et vue d'administration.

## Stack technique

- **React 19** + **Vite** — UI et bundling
- **Tailwind CSS v4** — styling utilitaire
- **Leaflet / react-leaflet** — cartographie des axes du port
- **Chart.js / react-chartjs-2** — graphiques d'indicateurs
- **Firebase** — backend (auth, données)
- **TomTom API / Google Distance Matrix** — données de trafic (collecte auto toutes les 5 min via GitHub Actions)
- **Groq API** — assistant IA FlowPort (Llama 3.3 70B, fallback 8B)
- **xlsx / docx / jspdf** — export de rapports

## Structure du projet

```
src/
├── components/
│   ├── Admin/       # composants de la vue d'administration
│   ├── Charts/      # graphiques (Chart.js)
│   ├── Dashboard/   # composants du tableau de bord public
│   ├── Map/         # carte Leaflet des axes PAA
│   └── shared/       # composants réutilisables
├── data/             # données statiques (axes, références)
├── hooks/            # hooks React personnalisés
├── pages/            # pages routées (Admin, Login, Public)
├── services/         # accès externes (Firebase, TomTom, Gemini, indicateurs)
├── styles/           # design tokens (couleurs, typo, espacements)
└── utils/            # fonctions utilitaires
```

## Démarrage

```bash
npm install
npm run dev       # serveur de dev
npm run build     # build de production
npm run preview   # prévisualiser le build
npm run lint      # lint ESLint
```

## Documentation

- `docs/livrables/PortFlow_Guide_Utilisateur.docx` — guide utilisateur
- `docs/livrables/PortFlow_Rapport_Technique.docx` — rapport technique
- `docs/PortFlow_Troncons.docx` — définition des tronçons PAA
- `ml/` — entraînement du modèle prédictif (Random Forest, voir `ml/train_model.py`)
