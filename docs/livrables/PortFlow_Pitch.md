# PortFlow — Script de pitch (20 à 30 min)

> **Public :** jury de la compétition + décideurs du Port Autonome d'Abidjan, en présence de Monsieur le Directeur Général.
> **Équipe :** 4 intervenants.
> **Objectif :** faire comprendre le problème en 3 minutes, faire vivre la solution en démo, prouver la solidité technique, et repartir avec une décision.
> **Mode d'emploi du document :** chaque séquence est minutée et attribuée à un intervenant. Le total « confortable » fait ~28 min ; pour tenir 20 min, coupez les passages marqués `〈option〉`. Les indications entre crochets `[…]` sont des notes de scène (à ne pas lire à voix haute). Les blocs `⟶ RELAIS` marquent les passages de témoin entre intervenants.

---

## Répartition des 4 intervenants

| Intervenant | Rôle | Séquences | Durée |
|---|---|---|---|
| **① — L'accroche (métier)** | Plante le décor, pose le problème, annonce PortFlow | 1 · 2 · 3 | ~7 min |
| **② — La démo (produit)** | Prend l'écran, fait vivre le tableau de bord | 4 | ~7 min |
| **③ — La technique** | Donne la crédibilité : architecture, modèle, assistant IA | 5 · 6 | ~7 min |
| **④ — Le closer (valeur)** | Parle au DG, projette la vision, referme la boucle | 7 · 8 · 9 · 10 | ~8 min |

> Chaque passage de témoin tombe sur une transition déjà écrite : les relais sont voulus, pas subis. Aux Q&R (voir annexe), chacun répond sur son domaine.

---

## Repères de timing en un coup d'œil

| # | Séquence | Voix | Durée | Cumul |
|---|----------|------|-------|-------|
| 1 | Ouverture — la scène | ① | 2 min | 2 |
| 2 | Le problème | ① | 3 min | 5 |
| 3 | La vision : PortFlow en une phrase | ① | 2 min | 7 |
| 4 | Démo — le produit qui vit | ② | 7 min | 14 |
| 5 | Sous le capot — la crédibilité | ③ | 4 min | 18 |
| 6 | L'intelligence : prédiction + assistant IA | ③ | 3 min | 21 |
| 7 | Gouvernance : rapports officiels & administration | ④ | 2 min | 23 |
| 8 | L'impact pour le Port | ④ | 3 min | 26 |
| 9 | Perspectives | ④ | 2 min | 28 |
| 10 | Clôture & appel à décision | ④ | 1,5 min | ~30 |

---

## 1 · Ouverture — la scène `[2 min · Intervenant ①]`

> [Accueil bref, debout, posé. Puis un silence, et on plonge dans la scène. Ne pas enchaîner sur « je vais vous présenter » — l'image d'abord.]

Monsieur le Directeur Général, mesdames et messieurs les membres du jury, bonjour. Nous sommes l'équipe derrière **PortFlow**, et avant de vous montrer quoi que ce soit, nous aimerions vous emmener quelque part.

[Un temps. Puis, plus lentement :]

Il est 7 h 40 du matin. Un camion sort du terminal à conteneurs, chargé. Le chauffeur a une seule chose en tête : rejoindre la pharmacie de Palm Beach, à Vridi, et ressortir de la zone portuaire avant que tout ne se fige.

Sur le papier, son trajet depuis CARENA fait onze kilomètres et devrait lui prendre vingt-sept minutes.

Ce matin, il en mettra cinquante.

[Marquez un temps.]

Personne, dans cette salle, ne l'a vu venir. Ni lui, ni le poste de commandement, ni les transporteurs qui s'apprêtent à envoyer dix autres camions sur le même axe. L'information existait — elle était simplement invisible.

Monsieur le Directeur, mesdames et messieurs, **le trafic du Port d'Abidjan n'a pas un problème de routes. Il a un problème de visibilité.**

Et c'est exactement ce que nous avons construit : une paire d'yeux, en temps réel, sur les artères du Port. Ça s'appelle **PortFlow**.

---

## 2 · Le problème `[3 min · Intervenant ①]`

Prenons la mesure de ce qui se joue.

Le Port Autonome d'Abidjan, c'est le poumon économique de la Côte d'Ivoire et de tout l'hinterland — le Mali, le Burkina, le Niger passent par ici. Chaque conteneur qui reste bloqué dans un embouteillage, c'est du temps machine, du carburant, des pénalités, et au bout de la chaîne, un prix qui monte.

Or aujourd'hui, comment sait-on qu'un axe est saturé ? [Comptez sur vos doigts.]

- Par un appel radio.
- Par un agent qui le voit de ses yeux.
- Ou, le plus souvent… **une fois qu'on est déjà dedans.**

Le problème n'est pas le manque de données — TomTom, Google, les opérateurs télécoms mesurent déjà la vitesse du trafic en permanence. Le problème, c'est que **cette donnée n'arrive jamais, sous une forme exploitable, jusqu'à la personne qui décide.**

Résultat, on subit la congestion au lieu de l'anticiper. On réagit quand il faudrait prévoir. Et chaque décision — dérouter, temporiser, prioriser un convoi — se prend à l'aveugle.

〈option〉 Et ce coût est silencieux : il ne se voit pas sur une facture unique, il se dilue en milliers de minutes perdues, jour après jour. C'est précisément ce genre de coût invisible qui est le plus difficile à combattre… tant qu'on ne le rend pas visible. 〈/option〉

La question que nous nous sommes posée est simple :

> **Et si le Port disposait, en permanence, d'une carte vivante de sa propre congestion — accessible depuis un simple navigateur ?**

---

## 3 · La vision : PortFlow en une phrase `[2 min · Intervenant ①]`

PortFlow, c'est **le tableau de bord temps réel du trafic des axes stratégiques du Port d'Abidjan.**

[Posez la phrase pilier, lentement :]

> Il transforme une donnée brute et dispersée en une décision claire : **vert, on roule ; orange, ça se tend ; rouge, il faut agir.**

Trois principes ont guidé chaque choix que nous avons fait :

1. **Le temps réel d'abord.** Une donnée sur le trafic qui a trente minutes ne vaut rien. La nôtre se rafraîchit en continu.
2. **La lisibilité avant la technique.** Un responsable d'exploitation doit comprendre l'état du réseau en trois secondes, sans formation. Un seul coup d'œil, une couleur, une décision.
3. **Des chiffres réels, jamais inventés.** Chaque valeur affichée vient d'une mesure horodatée. Rien dans PortFlow n'est décoratif.

Concrètement, nous surveillons aujourd'hui **trois axes majeurs**, tous dans les deux sens de circulation :

- **CARENA → Palm Beach** — 11,9 km, temps de référence 27 minutes.
- **Toyota CFAO → Palm Beach** — 7 km, référence 17 minutes.
- **Agence SODECI → Palm Beach** — 10,9 km, référence 22 minutes.

Tous convergent vers un même point névralgique : **la pharmacie de Palm Beach, à Vridi.** Voyons maintenant à quoi ça ressemble en vrai — et pour ça, je laisse la main à mon collègue.

> **⟶ RELAIS ① → ②** — L'intervenant ② prend l'écran. Phrase de reprise possible : « Merci. Ce que [prénom] vient de décrire, le voici en fonctionnement, en direct. »

---

## 4 · Démo — le produit qui vit `[7 min · Intervenant ②]`

> [Passez en démonstration live. Si le réseau est incertain, ayez une vidéo de secours prête. Ne lisez pas l'écran — racontez-le.]

### 4.1 · Le tableau de bord `[~2 min 30]`

[Ouvrez le Dashboard.]

Voici ce que voit un agent du Port en arrivant le matin. Une carte du port, et sur cette carte, nos trois axes tracés **au vrai tracé de la route** — pas des lignes droites approximatives, les vraies rues, calculées sur le réseau routier réel.

Et chaque axe a une couleur. [Montrez.]

- **Vert :** le trafic est fluide, on est proche du temps de référence.
- **Orange :** ça se tend — on a dépassé la référence de 40 %.
- **Rouge :** c'est saturé — on est à près du double du temps normal.

[Pointez un axe.]

Cet axe est en orange. En une seconde, sans lire un seul chiffre, vous savez qu'il faut surveiller. Ça, c'est la promesse tenue : **une couleur, une décision.**

Et si je veux le détail ? [Cliquez sur l'axe.] Le temps de parcours actuel, le temps de référence, le retard en minutes, le sens de circulation. Tout est là.

〈option〉 Regardez en haut : les données affichent leur propre fraîcheur. On sait toujours de quand date la dernière mesure. Un tableau de bord qui ne vous dit pas s'il est à jour est un tableau de bord en qui on ne peut pas avoir confiance. Le nôtre le dit. 〈/option〉

### 4.2 · L'historique et les tendances `[~2 min]`

[Passez à la page Graphiques.]

Le temps réel répond à la question « comment ça va **maintenant** ? ». Mais un décideur a besoin d'une autre réponse : « comment ça se comporte **d'habitude** ? »

Voici l'évolution du trafic dans le temps. [Montrez une courbe.] On voit apparaître les pics récurrents — les heures où, systématiquement, un axe bascule dans le rouge. Et ça, ce n'est plus de la réaction, c'est le début de la planification. On peut décaler un convoi de trente minutes et éviter entièrement le pic.

### 4.3 · Le point de convergence `[~1 min 30]`

[Revenez sur la carte, montrez Palm Beach.]

Un dernier détail qui compte. Nos trois axes ne sont pas indépendants — ils finissent tous au même endroit, ici, à Palm Beach. Ce qui veut dire que lorsque deux axes rougissent en même temps, ce n'est pas deux problèmes, c'est **un goulot d'étranglement qui se forme au point de convergence.** PortFlow rend ce phénomène visible d'un coup d'œil, là où, sur le terrain, il serait indétectable jusqu'à ce qu'il soit trop tard.

> **⟶ RELAIS ② → ③** — L'intervenant ② conclut la démo, l'intervenant ③ enchaîne. Transition : « Tout ce que vous venez de voir a l'air simple. C'est le but. » — [② rend la main] — « Mais derrière cette simplicité, il y a une machine. Laissez-moi soulever le capot deux minutes. » [③ reprend]

---

## 5 · Sous le capot — la crédibilité `[4 min · Intervenant ③]`

> [Cette séquence est pour le jury technique. Gardez un rythme sûr, sans jargon gratuit. Le DG doit comprendre que « c'est du solide », même sans suivre chaque terme.]

La question honnête, c'est : **d'où viennent les chiffres, et est-ce qu'on peut leur faire confiance ?**

### 5.1 · La chaîne de la donnée

Toutes les cinq minutes, automatiquement, une tâche programmée interroge l'API de trafic de **TomTom** — la même source de référence utilisée dans les systèmes de navigation professionnels — pour chacun de nos axes, dans les deux sens. Une seconde source, **Google Distance Matrix**, sert de filet de sécurité.

[Insistez :] Cette collecte tourne toute seule, jour et nuit, sans que personne n'ait à lancer quoi que ce soit. Elle est orchestrée par **GitHub Actions** — une infrastructure d'automatisation industrielle. Le système se nourrit lui-même.

### 5.2 · Le tracé réel des routes

Les axes ne sont pas dessinés à la main. Leur géométrie est calculée par un moteur de routage, **OSRM**, sur les données cartographiques d'OpenStreetMap. C'est pour ça que la ligne épouse la vraie rue, virage après virage. La conséquence, c'est que le temps mesuré correspond au **vrai chemin qu'emprunte le camion**, pas à un vol d'oiseau théorique.

### 5.3 · Une architecture temps réel de bout en bout

La donnée collectée arrive dans **Firebase**, la plateforme cloud de Google. Et le lien avec l'écran est **vivant** : dès qu'une nouvelle mesure tombe, le tableau de bord se met à jour tout seul, sans que l'utilisateur ait à rafraîchir la page. C'est ce qu'on appelle une liaison temps réel — et c'est ce qui fait qu'on regarde le Port respirer en direct.

[Résumé qui rassure :] Donc : source professionnelle, tracé réel, collecte automatique, affichage instantané. **Il n'y a aucune saisie manuelle dans cette chaîne. La donnée que vous voyez, personne ne l'a touchée.**

> [Transition :] « Mais montrer le présent, ce n'est que la moitié du travail. Un Port ne veut pas seulement savoir ce qui se passe. Il veut savoir ce qui va se passer. »

---

## 6 · L'intelligence : prédiction + assistant IA `[3 min · Intervenant ③]`

### 6.1 · Le modèle prédictif `[~1 min 30]`

Nous avons entraîné un **modèle d'apprentissage automatique** — une forêt aléatoire, *Random Forest* — sur l'historique réel du trafic. Son rôle : à partir de l'heure, du jour, de l'axe, anticiper le niveau de congestion à venir.

[Soyez transparent, c'est votre force :] Aujourd'hui, ce modèle atteint **près de 80 % de précision**, sur une première base de plus de deux mille mesures réelles. Je vais être franc avec vous : c'est une **preuve de concept**. Ce n'est pas encore un oracle. Mais l'essentiel est ailleurs — nous avons prouvé que **la congestion du Port est prévisible**, et nous avons bâti le tuyau qui, à mesure que la collecte automatique accumule les données, rendra ce modèle de plus en plus précis, tout seul. **Plus PortFlow tourne, plus il devient intelligent.**

### 6.2 · L'assistant FlowPort `[~1 min 30]`

[Ouvrez la page IA.]

Et parce que tout le monde n'a pas le temps de lire des graphiques, nous avons intégré un assistant conversationnel : **FlowPort**. On lui pose une question en langage naturel — « Quel est l'axe le plus chargé en ce moment ? », « À quelle heure éviter CARENA ? » — et il répond, à partir des données réelles du tableau de bord.

[Montrez un exemple en direct si possible.]

C'est propulsé par un grand modèle de langage, Llama 3.3, servi à très grande vitesse. Concrètement : **le Port peut interroger ses propres données comme on interroge un collègue.**

> **⟶ RELAIS ③ → ④** — L'intervenant ④ (le closer) prend la parole pour la dernière ligne droite. Transition : « Une solution pour une institution comme le Port ne peut pas s'arrêter à un bel écran… »

---

## 7 · Gouvernance : rapports officiels & administration `[2 min · Intervenant ④]`

Une solution pour une institution comme le Port ne peut pas s'arrêter à un bel écran. Il faut des **traces, des documents, du contrôle.** Nous y avons pensé.

### 7.1 · Les rapports officiels

[Page Rapports.] En un clic, PortFlow génère un rapport complet du trafic — en **PDF, Word et Excel** — reprenant les mêmes chiffres réels, exactement. Et ces documents ne sont pas des exports bruts : ils sortent **à la charte graphique officielle**, avec la page de garde institutionnelle, prêts à être transmis à une hiérarchie ou archivés. Un rapport de PortFlow ressemble à un rapport du Port.

### 7.2 · L'administration

〈option〉 [Page Admin.] Et le système reste maître à bord. Un administrateur peut ajuster les axes, **corriger un tracé directement sur la carte en déplaçant les points**, gérer les seuils. PortFlow n'est pas une boîte noire figée — c'est un outil que le Port garde sous son propre contrôle. 〈/option〉

---

## 8 · L'impact pour le Port `[3 min · Intervenant ④]`

> [Ralentissez. C'est la séquence qui parle au Directeur Général. Regardez-le.]

Alors, qu'est-ce que PortFlow change, concrètement, pour le Port d'Abidjan ?

**Un : on passe de la réaction à l'anticipation.** Aujourd'hui, on constate l'embouteillage. Avec PortFlow, on le voit se former, et on agit avant qu'il ne bloque tout. Chaque convoi rerouté à temps, c'est du temps machine et du carburant économisés.

**Deux : on décide sur des faits, plus sur des impressions.** Fini le « il paraît que ça bouchonne à Vridi ». On a le chiffre, horodaté, sourcé. La décision devient défendable.

**Trois : on rend visible un coût qui était invisible.** En mesurant les minutes perdues axe par axe, on donne enfin au Port un indicateur qu'il pourra suivre, et donc **améliorer.** On ne pilote bien que ce que l'on mesure.

**Quatre : c'est déployable immédiatement.** PortFlow tourne dans un simple navigateur. Pas de matériel à installer sur les routes, pas de capteurs, pas de travaux. La donnée existe déjà — nous, on la rend utile. Le coût d'entrée est proche de zéro.

〈option〉 Et j'ajoute un point stratégique : un Port qui pilote sa fluidité, c'est un Port plus compétitif. Dans une région où les corridors se disputent les flux, **la fluidité est un argument commercial.** 〈/option〉

---

## 9 · Perspectives `[2 min · Intervenant ④]`

PortFlow existe, il fonctionne, il est devant vous. Mais nous voyons trois chemins pour aller plus loin :

- **Étendre la couverture** — passer de trois axes à l'ensemble du réseau portuaire, et même au niveau plus fin des tronçons, que le système gère déjà.
- **Muscler la prédiction** — laisser la collecte automatique enrichir le modèle jusqu'à des prévisions fiables à l'heure près, puis déclencher des **alertes anticipées** : prévenir *avant* que le rouge n'apparaisse.
- **Connecter PortFlow aux opérations** — relier ces alertes aux transporteurs et au poste de commandement, pour que l'information ne s'arrête pas à l'écran mais déclenche une action.

[Phrase de cadrage :] Autrement dit, ce que vous voyez aujourd'hui n'est pas un aboutissement. C'est **une fondation solide, déjà opérationnelle,** sur laquelle on peut bâtir.

---

## 10 · Clôture & appel à décision `[1,5 min · Intervenant ④]`

> [Revenez au chauffeur de l'ouverture. Fermez la boucle. C'est ce que la salle retiendra.]

Revenons à notre camion du début. 7 h 40, il sort de CARENA.

Avec PortFlow, avant même de démarrer, l'exploitant voit l'axe passer à l'orange. Il temporise dix minutes, ou il bascule sur SODECI. Le chauffeur arrive à Palm Beach en vingt-sept minutes, comme prévu.

[Un temps.]

La donnée était là depuis le début. Tout ce qui manquait, c'était **les yeux pour la voir.** Ces yeux, aujourd'hui, existent. Ils s'appellent PortFlow.

Monsieur le Directeur, mesdames et messieurs du jury — nous ne vous proposons pas une maquette. Nous vous proposons un outil **qui tourne, qui se nourrit tout seul, et qui n'attend qu'une chose : servir le Port.**

Je vous remercie. [Temps.] Je suis à votre entière disposition pour vos questions.

---

## Annexe · Questions probables & réponses courtes

> [À relire juste avant. Réponses de 20 secondes maximum, calmes.]

- **« La précision du modèle n'est que de 80 % ? »**
  → « C'est une preuve de concept honnête, sur nos premières données. Le point clé, c'est que la collecte automatique enrichit la base en continu : la précision est faite pour monter, sans réintervention de notre part. »

- **« Vos données viennent de TomTom, pas de vos propres capteurs. »**
  → « Exactement, et c'est un choix : zéro matériel à déployer, une source déjà validée par l'industrie de la navigation. Nous transformons une donnée existante en décision — c'est là qu'est notre valeur. »

- **« Combien ça coûte à faire tourner ? »**
  → « L'infrastructure repose sur des services cloud à très faible coût et une collecte automatisée. Il n'y a pas d'investissement lourd : le coût d'entrée est proche de zéro. »

- **« Pourquoi seulement trois axes ? »**
  → « Ce sont trois axes stratégiques choisis pour la démonstration. L'architecture est prévue pour en ajouter à volonté, jusqu'aux tronçons — c'est déjà dans le système. »

- **« En quoi c'est différent de Google Maps ? »**
  → « Google Maps répond à un conducteur isolé. PortFlow donne au Port une vue *institutionnelle* de *ses* axes : historique, seuils, rapports officiels, prédiction, administration. C'est un outil de pilotage, pas un GPS. »

- **« Est-ce fiable si Internet tombe ? »**
  → « Le système a une source de secours pour la collecte, un repli sur les tracés de référence, et il affiche toujours la fraîcheur de la donnée. On ne montre jamais un chiffre sans dire de quand il date. »
```
