# CatMap

PWA de recensement collaboratif des chats de quartier. L'utilisateur photographie un chat qu'il croise, indique sa couleur et sa situation, et le chat rejoint une carte partagée. On y répertorie aussi les lieux utiles : gamelles, points d'eau, abris, zones dangereuses.

**La fonction première est le recensement**, pas les chats perdus. Le signalement d'un chat perdu est une fonction secondaire qui s'appuie sur l'atlas déjà constitué. Cette hiérarchie est délibérée : une app « chats perdus » n'est ouverte que par ceux qui viennent d'en perdre un, alors qu'un recensement s'utilise tous les jours — et le jour où quelqu'un perd son chat, la carte est déjà peuplée. Ne pas remettre les chats perdus au centre.

Le porteur du projet n'est pas développeur. Explique les choix techniques en français simple, propose la meilleure option plutôt que d'attendre des instructions précises, et signale quand une demande part dans une mauvaise direction.

## État actuel

MVP fonctionnel, déployé sur Netlify, testé sur mobile. Vanilla JS sans framework ni build step : les fichiers sont servis tels quels.

```
index.html      toute l'app (markup + CSS + JS inline)
sw.js           service worker, network-first sur le HTML
manifest.json   manifeste PWA
icon-192.png    icônes générées
icon-512.png
```

Dépendance externe unique : Leaflet 1.9.4 via CDN unpkg, avec les tuiles OpenStreetMap. Pas de clé API, pas de compte, gratuit.

## Fonctionnement

L'utilisateur prend une photo via l'appareil natif (`capture="environment"`). L'image est redimensionnée à 900 px max et compressée en JPEG qualité 0.75 sur un canvas avant stockage — sinon le quota localStorage explose au bout de quelques photos.

Il choisit ensuite une couleur parmi six et une situation parmi trois : Errant, Promenade, Perdu. La position vient du GPS du navigateur.

Au moment de l'envoi, l'app cherche les chats déjà enregistrés de la même couleur dans un rayon de 300 m (distance haversine). S'il y en a, elle affiche la photo du plus proche et demande si c'est le même animal. Si oui, elle incrémente le compteur d'observations et met à jour la position ; sinon elle crée une nouvelle fiche.

La carte affiche un marqueur circulaire par chat, rempli de sa couleur, avec un contour rouge pour les chats perdus. La position de l'utilisateur est un point bleu.

## Modèle de données

Projet Firebase `catmap-9b132`, Firestore en région `eur3`, plan Spark (gratuit).

Collection `cats` — fiche légère, chargée entièrement à chaque ouverture :

```js
{
  color: 'Roux',          // Gris | Roux | Noir | Blanc | Tigré | Bicolore
  status: 'Errant',       // Errant | Promenade | Perdu | Retrouvé
  thumb: 'data:image/jpeg;base64,...',  // miniature 120px, ~1 Ko
  lat: 49.1917,
  lng: 2.4083,
  first: '2026-09-02T18:00:00.000Z',
  last:  '2026-09-02T18:00:00.000Z',
  seen: 1,                // nombre d'observations
  name: 'Minou',          // optionnel, chats perdus seulement
  contact: '06 12 34 56 78'  // optionnel, chats perdus seulement — PUBLIC
}
```

`spots` est la liste des positions observées, plafonnée à 12 (`.slice(-12)`) et
arrondie à 5 décimales. C'est elle qui fait vivre la **zone de territoire** : le
centre des observations donne le cœur, leur dispersion la taille, et le terme
`220/√n` l'incertitude restante. Une seule observation donne un large cercle en
pointillés ; chaque observation supplémentaire le resserre. Ne pas remplacer ce
tableau par une simple dernière position — c'est le mécanisme central de l'app.

Collection `places` — lieux utiles, indépendants des chats :

```js
{
  type: 'Gamelle',        // Gamelle | Eau | Abri | Danger
  lat: 49.1917, lng: 2.4083,
  first: '...', last: '...',
  ok: 1,                  // nombre de confirmations « c'est toujours là »
  note: 'Derrière le local à vélos'   // optionnel, PUBLIC
}
```

Collection `photos` — un document par chat, même id que la fiche, chargé
seulement à l'ouverture d'une fiche : `{ data: 'data:image/jpeg;base64,...' }`
(photo 900px, ~250 Ko).

Cette séparation est le point important : la fiche doit rester légère parce que
l'app télécharge toutes les fiches à chaque ouverture. Avant la séparation, une
fiche pesait 244 Ko contre 1 Ko après. Ne jamais remettre la photo pleine taille
dans `cats`.

Les fiches créées avant la séparation portent encore un champ `photo` en ligne
et pas de `thumb` ; le code lit `k.thumb || k.photo` partout et `loadPhoto()`
retombe sur ce champ. Ne pas retirer ces reprises tant que d'anciennes fiches
existent en base.

`name` et `contact` sont saisis par les utilisateurs : toujours les échapper
(`esc()`) avant tout `innerHTML`, ou passer par `textContent`.

Les règles de sécurité Firestore valident la forme des documents à l'écriture
(champs autorisés, types, tailles, statuts). Toute nouvelle propriété doit y
être ajoutée, sinon l'écriture est refusée en silence.

## Décisions prises

**Photos dans Firestore, pas dans Firebase Storage** (2026-09-02). Storage exige
le plan payant Blaze avec carte bancaire ; Firestore reste gratuit sur Spark.
Une photo compressée tient largement sous la limite de 1 Mo par document. À
revoir seulement si les photos deviennent nettement plus lourdes.

**Pas de comptes utilisateurs pour l'instant.** L'app ne demande ni e-mail ni mot
de passe, ce qui supprime toute friction à l'entrée. En contrepartie personne ne
peut modifier ou supprimer sa propre fiche, et il n'y a aucune modération. C'est
le prochain arbitrage à faire si l'usage décolle (Firebase Auth anonyme donnerait
une identité stable sans friction).

**La progression (XP, niveaux, objectifs) est locale à l'appareil**, dans
`localStorage` sous `catmap.me.v1`. C'est une conséquence directe de l'absence de
comptes, pas un oubli : il ne peut donc pas y avoir de classement entre
utilisateurs. L'interface le dit explicitement dans l'onglet « Moi » plutôt que de
laisser croire à une compétition. Le seul chiffre réellement collectif est le
compteur du quartier, calculé depuis Firestore. Ne pas ajouter de classement sans
ajouter d'abord une vraie authentification.

**Pas d'IA de reconnaissance de couleur ou de race.** La sélection manuelle suffit
et produit de meilleures données au départ.

## Suite envisagée

1. Comptes anonymes (Firebase Auth) — permettrait de modifier et supprimer ses
   propres signalements, et de limiter le spam
2. Vraies notifications push quand un chat est signalé perdu à proximité —
   aujourd'hui l'alerte est seulement visible à l'ouverture de l'app (bannière +
   pastille sur l'onglet Chats). Le push web est trop faible sur iOS, ce qui
   pousse vers une version native
3. Signalement des doublons et modération légère
4. Ne charger que les chats proches — aujourd'hui l'app charge toutes les fiches.
   Léger tant qu'elles pèsent 1 Ko, à revoir vers quelques milliers de chats
5. App Store : la PWA ne peut pas y être publiée telle quelle, il faut l'emballer
   (Capacitor) et un compte développeur Apple à 99 €/an

## Conventions

Interface en français, ton simple, pas de jargon. Sentence case partout, pas de Title Case.

Rester en vanilla JS tant que ça tient : pas de framework, pas de bundler, pas d'étape de build. Un `git push` doit suffire à déployer.

Le service worker est en network-first sur le HTML et le manifeste, cache-first sur le reste. Si tu changes cette logique, vérifie que les mises à jour arrivent toujours sur le téléphone sans désinstaller l'app — c'est un bug qui a déjà été rencontré.

L'app est utilisée dehors, à une main, souvent au soleil. Cibles tactiles larges, contrastes francs, aucune action critique en haut de l'écran.

## Déploiement

GitHub → Netlify, déploiement automatique à chaque push. Pas de build command, dossier de publication à la racine. HTTPS obligatoire : sans lui, ni la caméra ni le GPS ne fonctionnent.
