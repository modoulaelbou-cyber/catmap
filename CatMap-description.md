# CatMap — description complète de l'application

Document de référence pour reconstruire l'app. Tout y est : structure, écrans,
parcours, règles, données, apparence et ton.

---

## 1. Ce qu'est l'app

**CatMap est une carte collaborative des chats de quartier.**

Tu croises un chat dans la rue, tu le photographies, tu dis de quelle couleur il
est et à quoi il ressemble, et il rejoint une carte partagée que tous tes voisins
voient. Plus les gens le revoient, plus on sait où il vit.

On y répertorie aussi les **lieux utiles** aux chats : gamelles, points d'eau,
abris, et zones dangereuses.

**La fonction première est le recensement, pas les chats perdus.** Le signalement
d'un chat perdu existe, mais c'est une fonction secondaire qui s'appuie sur
l'atlas déjà constitué. Cette hiérarchie est délibérée : une app « chats perdus »
n'est ouverte que par ceux qui viennent d'en perdre un, alors qu'un recensement
s'utilise tous les jours — et le jour où quelqu'un perd son chat, la carte est
déjà peuplée. **Ne jamais remettre les chats perdus au centre.**

Public : tout le monde, pas des développeurs. Interface en français, ton simple,
aucun jargon.

Usage réel : dehors, à une main, souvent en plein soleil. D'où des cibles
tactiles larges, des contrastes francs, et aucune action importante en haut de
l'écran.

---

## 2. Plateforme et contraintes

- **PWA installable** (application web progressive), pensée mobile d'abord,
  portrait uniquement
- HTTPS obligatoire : sans lui, ni caméra ni GPS
- Carte : **Leaflet** avec les tuiles **OpenStreetMap** (libre, sans clé d'API)
- Base de données : **Firebase Firestore** en temps réel (tout le monde voit les
  mêmes données instantanément)
- Authentification : **Firebase Auth** — Google, e-mail/mot de passe, et anonyme
- **Pas de service de stockage de fichiers** : les photos sont compressées et
  stockées en base64 directement dans la base
- **Aucune notification sortante** : ni e-mail, ni push. Tout passe par une
  section Notifications *dans* l'app

---

## 3. Identité visuelle

### Logo
Carré à coins très arrondis, fond anthracite presque noir. Dessus, **un chat
assis vu de profil, tourné vers la droite**, en crème cassé, cadré serré et coupé
par les bords bas et gauche. Il a un vrai museau (front, arête du nez, truffe,
bouche, menton), un œil en amande incliné, deux oreilles dont l'arrière est plus
grande et arrondie, l'avant plus petite et pointue, séparées par une encoche
profonde. Un **repère de carte bleu-indigo** se pose en bas à droite, chevauchant
le poitrail, avec un trou circulaire crème au centre.

### Couleurs

**Thème clair**
| Rôle | Valeur |
|---|---|
| Fond | `#f6f4f0` (blanc cassé chaud) |
| Surface / cartes | `#ffffff` |
| Surface secondaire | `#efeae2` |
| Texte principal | `#1a1714` |
| Texte secondaire | `#6f665c` |
| Texte tertiaire | `#a2988c` |
| Traits / bordures | `#e7e1d7` |
| **Marque (indigo)** | `#4b40d9` |
| Danger / perdu | `#d92d20` |
| Succès | `#15803d` |
| Or (gamelle) | `#b7791f` |
| Eau | `#0a6fb5` |
| Admin (teal) | `#0f766e` |

**Thème sombre** (suit le réglage du système)
| Rôle | Valeur |
|---|---|
| Fond | `#141210` |
| Surface | `#1f1b18` |
| Surface secondaire | `#2a2521` |
| Texte principal | `#f6f2eb` |
| Texte secondaire | `#a89d90` |
| Traits | `#332d27` |
| Marque | `#8f86ff` |
| Danger | `#f87171` |
| Succès | `#5ddb92` |
| Admin | `#5eead4` |

### Formes et typographie
- Rayons d'arrondi : 16 px (standard), 22 px (large), 28 px (très large),
  100 px (pastilles et boutons pilules)
- Police système (`-apple-system`, `Segoe UI`, `Roboto`)
- Titres : gras marqué (700–780), interlettrage resserré (`-0.03em` à `-0.04em`)
- **Sentence case partout**, jamais de Majuscules À Chaque Mot
- Ombres douces et diffuses, jamais dures

---

## 4. Structure : trois volets qu'on parcourt au doigt

L'app est un **carrousel horizontal de trois volets**, comme Snapchat. On glisse
le doigt pour passer de l'un à l'autre, et on n'en sort jamais.

```
←  1. CARTE        2. APPAREIL PHOTO        3. PROFIL  →
                      (accueil)
```

- Défilement à aimantation (scroll-snap) : chaque volet se cale exactement
- Un geste rapide ne peut pas sauter par-dessus le volet du milieu
- Une **barre de navigation en bas** avec trois entrées : Carte, Photo, Profil.
  Elle est indispensable : sur le volet carte, le doigt sert à déplacer la carte,
  donc le glissement ne change pas de volet à cet endroit
- Une **cloche de notifications flottante** en haut à droite, visible sur les
  trois volets, avec une pastille rouge comptant les nouveautés

**Au lancement, l'app s'ouvre sur le volet du milieu : l'appareil photo.**
Croiser un chat et le photographier doit tenir en un geste.

Deux exceptions : si l'accès à la caméra a déjà été refusé, l'app s'ouvre sur la
carte ; et à la toute première visite, un écran de présentation passe d'abord.

---

## 5. Volet 1 — La carte

Carte plein écran, centrée sur la position de l'utilisateur.

- **Rendu neutre et désaturé** : les tuiles OpenStreetMap passent par un filtre
  qui les décolore, pour que les chats et les lieux ressortent. En thème sombre,
  les tuiles sont inversées puis réajustées en luminosité et contraste
- **Filtres en haut** (pastilles) : Tout · Chats · Perdus · Lieux
- **Position de l'utilisateur** : un point bleu
- **En bas à gauche** : une pastille « Le quartier » qui ouvre la liste complète
- **En bas à droite** : un bouton rond `+` (ajouter), et au-dessus un bouton de
  recentrage sur soi
- **Pastille rouge** sur l'onglet Carte : le nombre de chats perdus à moins de 2 km

### Ce que la carte affiche

Pour chaque chat, **deux choses superposées** :

1. **Une zone de territoire** : un cercle coloré, translucide, qui représente où
   le chat traîne probablement. En pointillés tant qu'il y a moins de 3
   observations, plein ensuite. Contour rouge si le chat est perdu.
2. **Une silhouette de chat dessinée**, remplie de sa couleur réelle, posée au
   centre de la zone.

Pour chaque lieu : un repère en forme de goutte, coloré selon le type, avec un
pictogramme dedans (gamelle, goutte d'eau, maison, triangle d'alerte).

---

## 6. Le mécanisme central : la zone qui se resserre

**C'est le cœur de l'app. Il ne faut surtout pas le simplifier en « dernière
position connue ».**

Chaque fiche de chat garde une **liste des endroits où il a été vu** (maximum 12,
arrondis à 5 décimales). À partir de cette liste on calcule :

- **Le centre** de la zone : la moyenne des positions observées
- **Le rayon** : `dispersion des points + 220 / √(nombre d'observations)`

Conséquence : **une seule observation donne un grand cercle flou en pointillés ;
chaque nouvelle observation le resserre.** C'est ce qui donne envie de signaler
un chat qu'on recroise.

Trois paliers affichés :
| Observations | Libellé | Phrase d'accompagnement |
|---|---|---|
| 1–2 | Zone approximative | « Une seule observation — signale-le si tu le croises, la zone se resserrera. » |
| 3–5 | Zone probable | « Quelques observations : la zone se précise déjà. » |
| 6 et + | Zone bien connue | « Le quartier l'a vu assez souvent pour cerner son territoire. » |

---

## 7. Les silhouettes de chat sur la carte

Le marqueur n'est **pas un rond de couleur** : c'est une **silhouette de tête de
chat dessinée**, remplie de la couleur choisie, et découpée selon la **race**.

La race ne redessine pas tout — elle joue sur les deux seuls traits qui restent
lisibles à 46 pixels :

| Race | Oreilles | Poil long | Particularité |
|---|---|---|---|
| Européen | normales | non | la silhouette de référence |
| Chartreux | petites | non | |
| Siamois | grandes | non | |
| Persan | minuscules | **oui** | |
| Maine Coon | grandes | **oui** | plumets aux pointes d'oreilles |
| Poil long | normales | **oui** | |
| Sphynx | énormes | non | |
| Je ne sais pas | normales | non | retombe sur l'européen |

Le « poil long » se rend par une **couronne de pointes** autour de la tête.

Deux détails de dessin qui comptent :
- Le point interne de chaque oreille doit redescendre au niveau du sommet du
  crâne. Plus haut, les deux oreilles se croisent en X au lieu de former une
  encoche en V — d'autant plus visible que l'oreille est grande.
- Le « Tigré » ajoute des rayures sur le front et les joues ; le « Bicolore »
  ajoute une tache blanche sur une moitié de la tête.

Un chat marqué **Retrouvé** s'affiche plus petit et très transparent.
Un chat **signalé 3 fois** s'affiche en gris.

---

## 8. Volet 2 — L'appareil photo (l'accueil)

Viseur plein écran, caméra arrière.

- En haut à gauche : le logo et la phrase « Un chat ? Photographie-le. »
- En bas, une rangée : **galerie** (choisir une photo existante) · **déclencheur**
  (gros bouton rond blanc) · **retournement** de caméra
- En dessous : une pastille « **Mes publications** » avec un chevron vers le
  haut. On peut aussi l'ouvrir en **balayant vers le haut**
- Un éclair blanc et une vibration courte confirment la prise de vue

### Règles de la caméra (importantes)

1. **Le flux se coupe** dès qu'on quitte le volet ou que l'app passe en
   arrière-plan. Une caméra laissée ouverte vide la batterie et garde le témoin
   d'enregistrement allumé — les gens le remarquent et désinstallent.
2. **La demande d'autorisation attend l'écran de présentation** à la première
   visite. Demander l'accès avant d'avoir rien expliqué se solde par un refus, et
   sur iPhone un refus ne se rattrape que dans les réglages du système.
3. **Un refus n'enferme jamais.** L'écran propose alors « Choisir une photo » et
   « Aller à la carte », et les ouvertures suivantes se font sur la carte plutôt
   que sur un viseur noir.

### Mes publications
Panneau qui remonte du bas, avec deux onglets : **Chats** et **Lieux**. Ne
contient que les fiches créées par l'utilisateur connecté.

---

## 9. Le parcours d'ajout d'un chat — 6 étapes

Déclenché par le bouton de prise de vue. La photo étant déjà faite, on saute
directement à l'étape 2. Une barre de progression en haut, un bouton de fermeture.

### Étape 1 — Photographie le chat
*(sautée si on vient du déclencheur ; accessible en revenant en arrière)*

Conseils affichés :
- « Cadre le chat en entier, d'assez près pour voir son pelage. »
- « Évite le contre-jour : sans lumière, sa couleur est impossible à distinguer. »

Jusqu'à **4 photos** par fiche. Si une photo est trop sombre (luminance moyenne
inférieure à un seuil), un avertissement s'affiche : « Une photo est trop sombre
pour distinguer sa couleur. Reprends-la si tu peux. »

### Étape 2 — Sa couleur
« Celle qu'on voit sur ta photo. Elle donnera sa couleur sur la carte. »

Six pavés carrés colorés : **Gris** `#9b9b9b` · **Roux** `#d2691e` ·
**Noir** `#2c2c2c` · **Blanc** `#e8e6e1` · **Tigré** `#8b6f47` ·
**Bicolore** `#6b6b6b`

### Étape 3 — Sa race
« Au jugé, d'après son allure. C'est elle qui dessine sa silhouette sur la carte. »

Huit choix présentés **chacun avec sa silhouette, déjà peinte dans la couleur
qu'on vient de choisir** — on choisit le dessin qui ressemble le plus au chat
qu'on a devant soi, pas un mot.

Note affichée : « La plupart des chats de rue n'ont pas de race : "Je ne sais
pas" est une bonne réponse, mieux qu'une devinette. »

### Étape 4 — Sa situation
« Ce que tu observes en ce moment. »

- **Errant** — « Il vit ou se promène seul dans le quartier »
- **En promenade** — « Il est accompagné de quelqu'un »
- **Perdu** — « Il a disparu, on le recherche »

### Étape 5 — Son maître *(uniquement si « Perdu »)*
Deux champs facultatifs : un **nom** et un **contact**.

**Avertissement obligatoire : le contact est public.** Tout le monde peut le voir.

### Étape 6 — Où l'as-tu vu ?
« Le GPS se trompe souvent de quelques mètres. Ajuste l'épingle. »

Une petite carte avec une **épingle déplaçable**, pré-posée sur la position GPS.
On peut la faire glisser ou toucher la carte pour la reposer.

*Le GPS d'un téléphone se trompe couramment de 10 à 30 m en ville, et on
photographie souvent un chat d'en face. D'où cette confirmation.*

### Étape 7 — Tout est prêt
Récapitulatif : la miniature, la couleur (ou le nom si perdu), la situation, la
race, le nombre de photos. Plus un champ **note** facultatif
(« Très craintif, ne pas approcher »).

Bouton : **Ajouter à la carte**.

### La détection de doublon

Au moment de l'envoi, l'app cherche les chats déjà enregistrés **de la même
couleur dans un rayon de 300 mètres**.

S'il y en a, un panneau s'ouvre : la photo du plus proche, la distance, et la
question « **Ce chat est déjà connu ?** ».

- **Oui, c'est lui** → on n'ajoute pas de fiche : on **incrémente le compteur
  d'observations**, on ajoute la position à la liste, la zone se resserre.
  L'utilisateur gagne moins de points qu'une création, mais il gagne quelque chose.
- **Non, c'est un autre** → nouvelle fiche.

---

## 10. Le parcours d'ajout d'un lieu

Ouvert par le bouton `+` de la carte, puis « Un lieu utile ».

Quatre types :
| Type | Couleur | Description affichée |
|---|---|---|
| **Gamelle** | or | « Un endroit où on leur pose à manger » |
| **Point d'eau** | bleu | « Vital en été, souvent le plus manquant » |
| **Abri** | vert | « Un coin sec où ils se réfugient » |
| **Zone dangereuse** | rouge | « Route passante, chantier, piège » |

Plus : une **note** facultative (publique), jusqu'à **4 photos** facultatives, et
la même **épingle déplaçable** pour poser l'endroit exact.

Sur la fiche d'un lieu, n'importe qui peut **confirmer que c'est toujours là** —
un compteur de confirmations monte.

---

## 11. Volet 3 — Le profil

### La carte de niveau
Un grand cercle avec le total d'XP, le nom du rang, une barre de progression et
la phrase « Encore N XP pour devenir *rang suivant* ».

**Six rangs :**
| XP | Rang |
|---|---|
| 0 | Curieux |
| 120 | Observateur |
| 350 | Éclaireur |
| 800 | Pisteur |
| 1 600 | Gardien du quartier |
| 3 200 | Légende féline |

### Trois compteurs
Chats recensés · Observations · Lieux ajoutés

### Les points
| Action | XP |
|---|---|
| Recenser un nouveau chat | **+25** |
| Ajouter un lieu utile | **+15** |
| Confirmer l'observation d'un chat connu | **+10** |
| Confirmer qu'un lieu est toujours là | **+5** |
| Signaler qu'un chat perdu a été retrouvé | **+50** |

*Le barème récompense la contribution nouvelle plus que la répétition, mais
n'oublie jamais celui qui confirme : c'est lui qui resserre les zones.*

### Les objectifs
Une liste de quêtes cochées au fur et à mesure :
- Recenser un premier chat (+25)
- Confirmer une observation (+10)
- Ajouter un lieu utile (+15)
- Recenser 5 chats (+25)
- Recenser 20 chats (+25)

### Le reste du profil
- Un bloc « Le quartier » : le total collectif de chats et de lieux
- Un bouton **Mon compte**
- Un bouton **Réglages** (changer son nom, se déconnecter, supprimer son compte)
- Pour l'administrateur seulement : un **panneau de modération**

### Célébrations
Chaque gain de points déclenche une animation plein écran courte avec le nombre
d'XP. Un changement de rang est annoncé plus fortement.

---

## 12. Les notifications — dans l'app uniquement

**Il n'y a ni e-mail ni notification push. C'est un choix, pas une limite subie.**

Une **cloche** en haut à droite, avec une pastille comptant les nouveautés. Elle
ouvre un panneau qui rassemble, dans un rayon de **2 km** :

1. *(Admin seulement)* Les fiches signalées à traiter
2. Les **chats perdus** à proximité
3. L'**activité sur ses propres fiches** : « *Minou* a été revu — 4 observations
   au total, sa zone se resserre »
4. Les **nouveautés du quartier** : « 3 nouveaux chats près de toi »

Le panneau **s'ouvre tout seul au lancement s'il y a réellement du neuf** depuis
la dernière visite. Jamais autrement.

**À ne pas présenter comme une notification** : ça n'arrive que quand
l'utilisateur ouvre l'app.

---

## 13. Les comptes

### Principe : anonyme d'abord, rattachement ensuite

Une **session anonyme s'ouvre dès le lancement**. Personne n'est jamais bloqué à
l'entrée, tout est utilisable immédiatement.

Créer un vrai compte **rattache** cette session existante au lieu d'en créer une
nouvelle. L'identifiant reste le même, donc **la progression et les fiches déjà
créées restent attachées à la personne**.

*C'est le point le plus important de cette partie : ne jamais remplacer ce
rattachement par une simple connexion, qui créerait un nouvel identifiant et
détacherait tout.*

### Moyens de connexion
- **Google**
- **E-mail + mot de passe** (avec réinitialisation du mot de passe)
- **Anonyme** (par défaut)
- **Apple : impossible** sans le programme développeur Apple à 99 €/an.
  L'écran de compte le dit explicitement plutôt que de laisser un bouton mort.

### Réglages
Changer son nom d'affichage · Se déconnecter · Supprimer son compte

---

## 14. Modération et signalements

Sur chaque fiche, un bouton « **Signaler** » : photo incorrecte, position fausse,
couleur ou situation erronée, note déplacée.

**Au bout de 3 signalements**, les photos de la fiche sont automatiquement
masquées et le marqueur devient gris sur la carte, en attendant vérification.

*Sans modérateur permanent, ce seuil collectif est le seul garde-fou possible.
Ne pas le retirer sans le remplacer.*

### Propriété des fiches
- **L'auteur** peut modifier et supprimer sa fiche
- **Tout le monde** peut contribuer : ajouter une observation, confirmer un lieu,
  signaler, marquer un chat comme retrouvé
- **Personne d'autre** ne peut modifier le fond d'une fiche

### L'administrateur
Identifié par une **adresse e-mail Google vérifiée**. Il voit un panneau de
modération, reçoit les signalements dans sa section Notifications, peut effacer
les signalements d'une fiche ou la supprimer.

Deux règles :
- La vérification de l'adresse est **indispensable** : sans elle, n'importe qui
  pourrait s'inscrire en e-mail/mot de passe avec cette adresse et devenir admin.
- Les surfaces admin ont **leur propre couleur (teal) et jamais le rouge** : le
  rouge reste réservé aux chats perdus et aux actions destructrices. Un panneau
  de modération en rouge diluerait le seul signal d'urgence de l'app.

---

## 15. L'écran de présentation (première visite seulement)

Titre : « **Recense les chats de ton quartier.** »

Sous-titre : « Chaque chat croisé, chaque gamelle, chaque coin dangereux. À
plusieurs, on finit par tous les connaître. »

Trois points :
- **Tu croises un chat** — « Une photo bien cadrée, sa couleur, et il rejoint la carte. »
- **Sa zone se précise** — « Chaque nouvelle observation resserre le territoire où le trouver. »
- **Tu repères un lieu utile** — « Gamelle, point d'eau, abri, ou route dangereuse à éviter. »

Bouton : **Commencer**. Puis une mention légale : « En continuant, tu acceptes
que tes signalements soient visibles publiquement. »

---

## 16. Modèle de données

### Collection `cats`
Fiche **légère**, car l'app télécharge toutes les fiches à chaque ouverture.

```js
{
  color:  'Roux',          // Gris | Roux | Noir | Blanc | Tigré | Bicolore
  breed:  'Maine Coon',    // facultatif — 8 valeurs possibles
  status: 'Errant',        // Errant | Promenade | Perdu | Retrouvé
  thumb:  'data:image/jpeg;base64,…',  // miniature 120 px, ~1 Ko
  lat: 49.1917, lng: 2.4083,
  spots: [{a:49.19170, o:2.40830}],    // positions observées, 12 maximum
  first: '2026-09-14T18:00:00.000Z',
  last:  '2026-09-14T18:00:00.000Z',
  seen: 1,                 // nombre d'observations
  pics: 2,                 // nombre de photos (4 maximum)
  uid:  'abc123',          // auteur
  flags: 0,                // signalements ; à 3, les photos sont masquées
  name: 'Minou',           // facultatif, chats perdus seulement
  contact: '06 12 34 56 78',  // facultatif, chats perdus seulement — PUBLIC
  note: 'Très craintif'    // facultatif — PUBLIC
}
```

### Collection `places`
```js
{
  type: 'Gamelle',         // Gamelle | Eau | Abri | Danger
  lat: 49.1917, lng: 2.4083,
  first: '…', last: '…',
  ok: 1,                   // confirmations « c'est toujours là »
  pics: 1, uid: 'abc123', flags: 0,
  note: 'Derrière le local à vélos'   // facultatif — PUBLIC
}
```

### Collection `photos`
Une photo par document, chargée **seulement à l'ouverture d'une fiche** :
```js
{ data: 'data:image/jpeg;base64,…' }   // photo 900 px, ~250 Ko
```

**C'est le point technique le plus important.** La fiche doit rester légère parce
que l'app télécharge toutes les fiches à chaque ouverture. Avant cette
séparation, une fiche pesait 244 Ko ; après, 1 Ko. **Ne jamais remettre la photo
pleine taille dans la fiche.**

La première photo porte l'identifiant de la fiche, les suivantes `{id}-2`,
`{id}-3`… Ces identifiants prévisibles évitent une requête indexée.

### Collection `users`
```js
{ xp: 0, cats: 0, obs: 0, places: 0, name: '', since: '…' }
```
Le document serveur fait foi : il peut venir d'un autre appareil. Le stockage
local ne sert que de cache d'affichage au lancement.

### Traitement des photos
Redimensionnées à **900 px maximum**, compressées en **JPEG qualité 0.75** sur un
canvas avant envoi. Une miniature de **120 px** est produite en parallèle pour la
fiche.

---

## 17. Sécurité

Les règles de la base valident **la forme de chaque document à l'écriture** :
champs autorisés, types, tailles, valeurs permises. Toute nouvelle propriété doit
y être ajoutée, **sinon l'écriture est refusée en silence**.

Autres règles :
- Les noms, contacts et notes sont saisis par les utilisateurs : **toujours les
  échapper** avant de les insérer dans la page
- Le **contact d'un chat perdu est public** — l'interface doit le dire
- Les fiches créées avant l'arrivée des comptes n'ont pas d'auteur : elles restent
  contribuables mais personne ne peut les supprimer

---

## 18. Ton et rédaction

- **Français, tutoiement**, phrases courtes, aucun jargon
- **Sentence case** partout
- Chaque bouton dit ce qu'il fait, pas « OK » ou « Valider »
- Les états vides expliquent quoi faire, pas seulement qu'il n'y a rien :
  « Tu n'as encore recensé aucun chat — Photographie-en un depuis le volet du
  milieu, il apparaîtra ici. »
- Les messages d'erreur disent la suite, pas la panne

---

## 19. Ce qu'il ne faut pas faire

1. Ne pas remettre les chats perdus au centre de l'app
2. Ne pas remplacer la zone de territoire par une simple dernière position
3. Ne pas remettre les photos pleine taille dans les fiches
4. Ne pas laisser la caméra tourner quand on n'est pas sur son volet
5. Ne pas retirer la barre de navigation du bas (seul chemin depuis la carte)
6. Ne pas remplacer le rattachement de compte par une simple connexion
7. Ne pas supprimer le seuil de 3 signalements sans le remplacer
8. Ne pas utiliser le rouge pour l'administration
9. Ne pas bloquer l'entrée de l'app : ni la caméra, ni le compte, ni le GPS ne
   doivent être obligatoires pour entrer
