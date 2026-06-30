# ============================================================
# train_model.py — Entraînement du modèle prédictif PortFlow
# POC niveau axe (Random Forest) — données PAA
#
# Sources :
#   - ../public/portflow_mesures_normalisees.csv  (2016 mesures réelles, fév. 2025)
#   - collecte_auto.csv (optionnel, export Firestore → enrichissement)
#
# Pour exporter collecte_auto depuis Firestore :
#   1. Firebase Console > Firestore > Collection collecte_auto
#   2. Exporter les champs : axeId, sens, date, heure, temps_min, niveau
#   3. Sauvegarder sous ml/collecte_auto.csv
#   Ou via l'Admin PortFlow > Export > Collecte auto CSV
#
# Volume recommandé pour enrichissement pertinent : ≥ 1 000 mesures live
# (soit ~4 semaines de collecte toutes les 15 min sur les 3 axes)
# ============================================================

import os
import pandas as pd
import json
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# ── Références horaires (= defaultData.js) ──────────────────
REFERENCES = {
    ('axe1', 'aller'):  27.4,
    ('axe1', 'retour'): 36.3,
    ('axe2', 'aller'):  16.9,
    ('axe3', 'aller'):  17.8,
}

AXE_MAP  = {'axe1': 0, 'axe2': 1, 'axe3': 2}
SENS_MAP = {'aller': 0, 'retour': 1}

# ── 1. Données historiques ───────────────────────────────────
HISTO_CSV = '../public/portflow_mesures_normalisees.csv'
df_histo = pd.read_csv(HISTO_CSV)

# Normalise les labels vers axeId
AXE_LABEL_MAP = {
    'Axe 1 - CARENA':      'axe1',
    'Axe 2 - TOYOTA CFAO': 'axe2',
    'Axe 3 - SODECI':      'axe3',
}
df_histo['axeId'] = df_histo['axe'].map(AXE_LABEL_MAP)
# Sélectionne uniquement les colonnes nécessaires
df_histo = df_histo[['axeId', 'sens', 'date', 'heure', 'temps_min']].dropna()
n_histo = len(df_histo)
print(f"\n📚 Historique PAA (fév. 2025) : {n_histo} mesures")

# ── 1b. Données collecte_auto (optionnel) ───────────────────
COLLECTE_CSV = 'collecte_auto.csv'
n_live = 0

if os.path.exists(COLLECTE_CSV):
    df_live = pd.read_csv(COLLECTE_CSV)
    # collecte_auto a déjà axeId, sens, date, heure, temps_min
    cols_needed = {'axeId', 'sens', 'date', 'heure', 'temps_min'}
    if cols_needed.issubset(df_live.columns):
        df_live = df_live[list(cols_needed)].dropna()
        # Ne garder que les axes officiels
        df_live = df_live[df_live['axeId'].isin(AXE_MAP)]
        n_live = len(df_live)
        if n_live > 0:
            df = pd.concat([df_histo, df_live], ignore_index=True)
            print(f"📡 collecte_auto.csv fusionné : +{n_live} mesures live")
            if n_live < 1000:
                print(f"   ⚠  Volume live faible ({n_live} < 1 000 recommandés) — le modèle reste dominé par l'historique")
        else:
            df = df_histo
            print(f"⚠  collecte_auto.csv vide ou sans axes officiels")
    else:
        df = df_histo
        print(f"⚠  collecte_auto.csv : colonnes manquantes ({cols_needed - set(df_live.columns)})")
else:
    df = df_histo
    print(f"ℹ  collecte_auto.csv absent — modèle basé sur l'historique seul")
    print(f"   (Export Firestore collecte_auto → ml/collecte_auto.csv pour enrichir)")

n_total = len(df)
print(f"📊 Total données d'entraînement : {n_total} mesures\n")

# ── 2. Variable cible : niveau de congestion ─────────────────
# Convention pandas : lundi=0 ... dimanche=6
df['date']         = pd.to_datetime(df['date'])
df['jour_semaine'] = df['date'].dt.dayofweek

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

# ── 3. Encodage et features ──────────────────────────────────
df['axe_enc']  = df['axeId'].map(AXE_MAP)
df['sens_enc'] = df['sens'].map(SENS_MAP)
df = df.dropna(subset=['axe_enc', 'sens_enc'])

FEATURES = ['heure', 'jour_semaine', 'axe_enc', 'sens_enc']
X = df[FEATURES]
y = df['niveau'].astype(int)

# ── 4. Entraînement Random Forest ───────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
model.fit(X_train, y_train)

# ── 5. Évaluation ────────────────────────────────────────────
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)

print(f"📊 Précision (accuracy) : {acc:.2%}\n")
print("Rapport de classification :")
print(classification_report(y_test, y_pred, zero_division=0))
print("Matrice de confusion :")
print(confusion_matrix(y_test, y_pred))

# ── 6. Génère les prédictions pour toutes les combinaisons ──
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

# ── 7. Sources d'entraînement ────────────────────────────────
sources = [f"portflow_mesures_normalisees.csv ({n_histo} mesures, fév. 2025)"]
if n_live > 0:
    sources.append(f"collecte_auto.csv ({n_live} mesures live)")

if n_live >= 1000:
    note = f"Modèle combiné historique + live — {n_total} mesures totales"
elif n_live > 0:
    note = f"Modèle enrichi (volume live faible : {n_live} mesures) — dominé par l'historique PAA"
else:
    note = "POC niveau axe — base réelle février 2025 (2016 mesures). Exporter collecte_auto pour enrichir."

# ── 8. Export JSON ───────────────────────────────────────────
output = {
    "meta": {
        "modele":            "RandomForestClassifier",
        "accuracy":          round(float(acc), 4),
        "date_entrainement": pd.Timestamp.now().isoformat(),
        "note":              note,
        "n_records_histo":   n_histo,
        "n_records_live":    n_live,
        "n_records_total":   n_total,
        "sources":           sources,
    },
    "predictions": predictions,
}

with open('predictions.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

# Copie dans public/ pour être servi par Vite
import shutil
shutil.copy('predictions.json', '../public/predictions.json')

print(f"\n✅ predictions.json généré — {len(predictions)} combinaisons")
print(f"   Sources : {', '.join(sources)}")
print(f"   Copié dans ../public/predictions.json\n")
