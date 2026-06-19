# ============================================================
# train_model.py — Entraînement du modèle prédictif PortFlow
# POC niveau axe (Random Forest) sur les 2016 mesures réelles
# (février 2025). Exporte un tableau de prédictions en JSON,
# consommable directement par l'app React (pas le modèle brut).
# ============================================================

import pandas as pd
import json
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# ── 1. Chargement des données réelles ───────────────────────
# Le CSV est déjà dans public/ (utilisé pour le seed Firestore Jour 3)
df = pd.read_csv('../public/portflow_mesures_normalisees.csv')

# ── 2. Références horaires globales (= data/references.js) ──
REFERENCES = {
    ('axe1', 'aller'):  27.4,
    ('axe1', 'retour'): 36.3,
    ('axe2', 'aller'):  16.9,
    ('axe3', 'aller'):  17.8,
}

def to_axe_id(label):
    mapping = {
        'Axe 1 - CARENA':      'axe1',
        'Axe 2 - TOYOTA CFAO': 'axe2',
        'Axe 3 - SODECI':      'axe3',
    }
    return mapping.get(label, label)

df['axeId']  = df['axe'].apply(to_axe_id)
df['date']   = pd.to_datetime(df['date'])
# ⚠️ Convention pandas : lundi=0 ... dimanche=6 (différent de JS où dimanche=0)
df['jour_semaine'] = df['date'].dt.dayofweek

# ── 3. Variable cible : niveau de congestion (1-5) ──────────
# Même logique que computeNiveau() dans indicators.js (cohérence app/modèle)
def compute_niveau(row):
    ref = REFERENCES.get((row['axeId'], row['sens']))
    if not ref:
        return None
    ratio = row['temps_min'] / ref
    if ratio <= 1.10: return 1
    if ratio <= 1.25: return 2
    if ratio <= 1.50: return 3
    if ratio <= 2.00: return 4
    return 5

df['niveau'] = df.apply(compute_niveau, axis=1)
df = df.dropna(subset=['niveau'])

# ── 4. Encodage des variables catégorielles ─────────────────
AXE_MAP  = {'axe1': 0, 'axe2': 1, 'axe3': 2}
SENS_MAP = {'aller': 0, 'retour': 1}
df['axe_enc']  = df['axeId'].map(AXE_MAP)
df['sens_enc'] = df['sens'].map(SENS_MAP)

FEATURES = ['heure', 'jour_semaine', 'axe_enc', 'sens_enc']
X = df[FEATURES]
y = df['niveau'].astype(int)

# ── 5. Split entraînement / test ────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ── 6. Entraînement Random Forest ───────────────────────────
model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
model.fit(X_train, y_train)

# ── 7. Évaluation ────────────────────────────────────────────
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)

print(f"\n📊 Précision (accuracy) : {acc:.2%}\n")
print("Rapport de classification :")
print(classification_report(y_test, y_pred, zero_division=0))
print("Matrice de confusion :")
print(confusion_matrix(y_test, y_pred))

# ── 8. Génère les prédictions pour TOUTES les combinaisons ──
JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
predictions = {}

for axeId, axe_enc in AXE_MAP.items():
    sens_dispo = ['aller', 'retour'] if axeId == 'axe1' else ['aller']
    for sens in sens_dispo:
        sens_enc = SENS_MAP[sens]
        for jour_idx, jour_label in enumerate(JOURS):
            for heure in range(7, 19):
                pred  = model.predict([[heure, jour_idx, axe_enc, sens_enc]])[0]
                proba = model.predict_proba([[heure, jour_idx, axe_enc, sens_enc]])[0]
                confiance = round(float(max(proba)) * 100, 1)

                # Temps moyen historique réel pour ce créneau (régression simple)
                subset = df[
                    (df['axeId'] == axeId) & (df['sens'] == sens) &
                    (df['heure'] == heure) & (df['jour_semaine'] == jour_idx)
                ]
                temps_moyen = round(float(subset['temps_min'].mean()), 1) if len(subset) > 0 else None

                key = f"{axeId}_{sens}_{jour_label}_{heure}h"
                predictions[key] = {
                    "niveau_prevu":    int(pred),
                    "confiance_pct":   confiance,
                    "temps_prevu_min": temps_moyen,
                }

# ── 9. Export JSON ───────────────────────────────────────────
output = {
    "meta": {
        "modele":            "RandomForestClassifier",
        "accuracy":          round(float(acc), 4),
        "date_entrainement": pd.Timestamp.now().isoformat(),
        "note":              "POC niveau axe — base réelle février 2025 (2016 mesures)",
    },
    "predictions": predictions,
}

with open('predictions.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\n✅ predictions.json généré — {len(predictions)} combinaisons prédites.")