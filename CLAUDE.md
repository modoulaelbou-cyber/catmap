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

Il choisit ensuite une couleur parmi six, une race parmi huit (« Je ne sais pas » compris — la plupart des chats de rue n'ont pas de race, et une devinette vaut moins qu'un aveu), et une situation parmi trois : Errant, Promenade, Perdu. La position vient du GPS du navigateur.

Au moment de l'envoi, l'app cherche les chats déjà enregistrés de la même couleur dans un rayon de 300 m (distance haversine). S'il y en a, elle affiche la photo du plus proche et demande si c'est le même animal. Si oui, elle incrémente le compteur d'observations et met à jour la position ; sinon elle crée une nouvelle fiche.

La carte affiche une silhouette de chat par fiche, remplie de sa couleur et dessinée d'après sa race, avec un contour rouge pour les chats perdus. La position de l'utilisateur est un point bleu.

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
  breed: 'Maine Coon',    // Européen | Chartreux | Siamois | Persan | Maine Coon
                          // | Poil long | Sphynx | Je ne sais pas — optionnel
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

Collection `photos` — une photo par document, chargée seulement à l'ouverture
d'une fiche : `{ data: 'data:image/jpeg;base64,...' }` (photo 900px, ~250 Ko).
La première photo d'un chat ou d'un lieu porte l'id de la fiche, les suivantes
`{id}-2`, `{id}-3`… (4 maximum, champ `pics` sur la fiche). Ces ids prévisibles
évitent une requête indexée : on sait quoi charger sans interroger la collection.

Le champ `flags` compte les signalements. À 3, l'app masque les photos de la
fiche et la grise sur la carte. Sans comptes ni modérateur, ce seuil collectif
est le seul garde-fou possible — ne pas le retirer sans le remplacer.

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

**Comptes : anonyme d'abord, rattachement ensuite.** Firebase Auth ouvre une
session **anonyme** dès le lancement — personne n'est jamais bloqué à l'entrée.
Créer un vrai compte se fait en **rattachant** cette session (`linkWithPopup` /
`linkWithCredential`), ce qui conserve le même `uid` : progression et
signalements déjà faits restent attachés à la même personne. Ne jamais remplacer
ce rattachement par un `signIn` simple, qui créerait un nouvel `uid` et
détacherait tout.

Fournisseurs activés : **Google**, **e-mail/mot de passe**, **anonyme**.
**Apple est impossible** sans l'Apple Developer Program (99 €/an) : Firebase
réclame un « ID de service » qui ne se crée que dans la console développeur
Apple. L'écran de compte le dit explicitement.

Le « nettoyage automatique » des comptes anonymes est **volontairement désactivé**
dans la console : il supprimerait après 30 jours d'inactivité les comptes de gens
qui n'ont pas encore créé de vrai compte, avec leur progression.

Chaque `cats` et `places` porte un `uid`. Les règles laissent l'auteur modifier et
supprimer sa fiche, et n'autorisent aux autres que la contribution (`seen`,
`spots`, `flags`, `ok`, `last`, `status`). Les fiches créées avant les comptes
n'ont pas d'`uid` : elles restent contribuables mais personne ne peut les
supprimer.

**La progression vit dans `users/{uid}`**, avec `localStorage` (`catmap.me.v1`)
comme simple cache d'affichage au lancement. Le document serveur fait foi : il
peut venir d'un autre appareil.

**Pas d'IA de reconnaissance de couleur ou de race.** La sélection manuelle suffit
et produit de meilleures données au départ.

## Suite envisagée

1. Comptes anonymes (Firebase Auth) — permettrait de modifier et supprimer ses
   propres signalements, et de limiter le spam
2. Vraies notifications push quand un chat est signalé perdu à proximité —
   aujourd'hui il y a un résumé au lancement (ce qui a été ajouté dans un rayon
   de 2 km depuis la dernière visite, via `catmap.lastopen.v1`), une bannière et
   une pastille sur l'onglet. Le push web est trop faible sur iOS, ce qui pousse
   vers une version native. Ne pas présenter le résumé comme une notification :
   il n'arrive que quand l'utilisateur ouvre l'app
3. Signalement des doublons et modération légère
4. Ne charger que les chats proches — aujourd'hui l'app charge toutes les fiches.
   Léger tant qu'elles pèsent 1 Ko, à revoir vers quelques milliers de chats
5. App Store : la PWA ne peut pas y être publiée telle quelle, il faut l'emballer
   (Capacitor) et un compte développeur Apple à 99 €/an

## Conventions

Interface en français, ton simple, pas de jargon. Sentence case partout, pas de Title Case.

Rester en vanilla JS tant que ça tient : pas de framework, pas de bundler, pas d'étape de build. Un `git push` doit suffire à déployer.

Le service worker est en network-first sur le HTML et le manifeste, cache-first sur le reste. Si tu changes cette logique, vérifie que les mises à jour arrivent toujours sur le téléphone sans désinstaller l'app — c'est un bug qui a déjà été rencontré.

**Les icônes étant en cache-first, il faut incrémenter `CACHE` dans `sw.js` à
chaque fois qu'elles changent**, sinon un téléphone qui a déjà installé l'app
continue de servir les anciennes indéfiniment. Ça s'est produit : le logo était
correct dans le dépôt et faux sur le téléphone. Sur iOS, l'icône de l'écran
d'accueil est en plus figée par le système — il faut retirer l'app de l'écran
d'accueil et la rajouter pour la voir changer.

L'app est utilisée dehors, à une main, souvent au soleil. Cibles tactiles larges, contrastes francs, aucune action critique en haut de l'écran — le haut est réservé à ce qui s'affiche (filtres, titre, cloche).

## Déploiement

GitHub → Netlify, déploiement automatique à chaque push. Pas de build command, dossier de publication à la racine. HTTPS obligatoire : sans lui, ni la caméra ni le GPS ne fonctionnent.

## Admin et modération

Les surfaces admin utilisent leur propre couleur (`--admin`, teal) et **jamais le
rouge** : le rouge reste réservé aux chats perdus et aux actions destructrices.
Un panneau de modération en rouge diluait le seul signal d'urgence de l'app.

L'admin est identifié par son **e-mail Google vérifié** (`modoula.elbou@hotmail.com`),
dans les règles Firestore ET dans l'app (`isAdmin()`). La condition
`email_verified == true` est indispensable : sans elle, n'importe qui pourrait
s'inscrire en e-mail/mot de passe avec cette adresse et devenir admin, Firebase
ne vérifiant pas l'adresse à l'inscription. L'admin doit donc se connecter avec
Google. Pour changer d'administrateur, modifier l'adresse aux deux endroits.

**Aucune notification sortante — c'est un choix, pas une limite subie.** Le
porteur ne veut pas d'e-mail : tout passe par la **section Notifications** dans
l'app (cloche de l'en-tête, `catmap.notif.v1` mémorise la dernière lecture).
Elle regroupe les fiches signalées à traiter (admin), les chats perdus proches,
l'activité sur ses propres signalements, et les nouveautés du quartier. Elle
s'ouvre seule au lancement s'il y a du neuf. E-mail et push resteraient de toute
façon impossibles sur Spark (Cloud Functions = plan Blaze).

## Structure : trois volets

L'app est un carrousel horizontal de trois volets, à la manière de Snap. On passe
de l'un à l'autre **au doigt**, et on n'en sort jamais :

1. **La carte** — l'atlas, ses filtres, l'ajout d'un lieu, et « Le quartier »
2. **L'appareil photo** — l'accueil, et l'accès à « Mes publications »
3. **Le profil** — rang, XP, objectifs, compte, modération

Le défilement est le **scroll-snap natif** du navigateur (`.pager` / `.pane`),
pas une simulation en JS : l'inertie, le rebond et la vitesse sont ceux du
système, et rien ne se désynchronise. `scroll-snap-stop:always` interdit de
sauter par-dessus l'appareil photo d'un coup de doigt rapide.

**`setPane()` fait un saut direct, sans glissement animé, et c'est délibéré.**
Deux façons de l'animer ont été essayées et échouent : `scrollTo({behavior:
'smooth'})` est purement ignoré sur un conteneur à aimantation obligatoire, et
une animation image par image dépend de `requestAnimationFrame`, qui se met en
pause dès que l'onglet passe en arrière-plan — le bouton ne ferait alors plus
rien. La barre du bas étant le seul chemin hors du volet carte, elle doit marcher
en toutes circonstances. `setPane()` bascule aussi l'état **tout de suite** au
lieu d'attendre l'observateur, qui est suspendu dans les mêmes conditions ;
l'observateur ne sert qu'au glissement du doigt. Le volet courant se
lit avec un `IntersectionObserver` sur `.pager`, pas au `scroll` : ça suit aussi
bien le doigt qu'un défilement programmé, sans minuteur ni seuil arbitraire.

**La carte capte le doigt pour elle** (`#map{touch-action:none}`), sinon la faire
glisser ferait aussi défiler le volet dessous et on ne saurait jamais lequel des
deux bouge. C'est pourquoi **la barre du bas doit rester** : depuis la carte,
c'est le seul chemin vers les autres volets.

Ce qui n'est pas un volet : le questionnaire et l'ajout de lieu (`.view`, couches
plein écran par-dessus tout), et les panneaux (`.sheet`). Ce sont des parcours
qu'on termine ou qu'on abandonne, pas des destinations.

La cloche des notifications flotte (`.bellwrap`, `position:fixed`) au-dessus des
trois volets : tantôt sur une vidéo, tantôt sur la carte, tantôt sur le fond de
l'app. D'où son fond translucide flouté — une couleur pleine raterait au moins
un des trois cas.

## Viseur d'ouverture

**L'app s'ouvre sur l'appareil photo, volet du milieu.** Croiser un chat et le
photographier doit tenir en un geste : un écran d'attente, une carte à traverser
ou un menu à ouvrir suffisent à faire renoncer. Le viseur sert aussi de couverture
au démarrage — la carte se monte dans son volet hors écran et est prête quand on y
glisse. C'est ce qui a remplacé l'ancienne animation d'ouverture, jugée inutile :
le viseur n'a rien à annoncer, il est déjà l'app.

On se place sur ce volet **sans animation avant le premier rendu** (`scrollLeft`
direct, pas `scrollTo`), sinon l'app démarre visiblement sur la carte puis glisse,
et on voit la couture.

Depuis le viseur : le déclencheur, la galerie, le changement de caméra, et
« Mes publications » (bouton, ou balayage vers le haut — un geste en diagonale
appartient au pager et ne doit pas l'ouvrir). « Un chat » depuis la carte ramène
ici : il n'y a qu'une façon d'ajouter un chat.

**Une photo passe toujours par la relecture avant le questionnaire** (`review()`,
`.cam-rev`). L'image est figée en grand, avec « Reprendre » et « Continuer ». Le
flou et le mauvais cadrage ne se voient qu'une fois l'image arrêtée, et c'est le
pelage qu'elle doit montrer — reprendre là coûte un geste, s'en apercevoir à la
fin coûte tout le parcours. C'est aussi là qu'arrive l'avertissement de photo
trop sombre, au moment où il sert encore à quelque chose.

On y montre **l'image redimensionnée qui sera enregistrée**, pas la capture
brute : ce qu'on relit est donc bien ce qu'on garde. Le flux reste ouvert
derrière (la vidéo est seulement mise en pause) pour que « Reprendre » soit
instantané ; quitter le volet ferme la relecture et coupe le flux.

Ensuite seulement, `startCatFrom()` fait `resetCat()` puis saute directement à
« Sa couleur », la première étape venant d'être faite. La galerie suit le même
chemin, et son « Reprendre » rouvre le sélecteur de fichiers plutôt que la
caméra.

Trois règles à ne pas défaire :

- **Le flux est coupé** dès qu'on quitte le volet (`paneChanged`) et sur
  `visibilitychange`. Une caméra laissée ouverte vide la batterie et garde le
  témoin d'enregistrement allumé — les utilisateurs le remarquent et désinstallent.
- **Le viseur passe sous `.intro`.** À la première visite, la présentation
  s'affiche d'abord et ne démarre le flux qu'une fois lue : demander l'accès à la
  caméra sans avoir rien expliqué se solde par un refus, et sur iOS un refus ne se
  rattrape que dans les réglages du système.
- **Un refus n'enferme jamais.** `catmap.camoff.v1` mémorise l'échec : l'écran
  propose la galerie et la carte, et les ouvertures suivantes se font sur le volet
  carte plutôt que sur un viseur noir. La clé est effacée dès qu'un accès réussit.
  Même chemin pour un appareil sans caméra ou une page non sécurisée.

`getUserMedia` ne fonctionne dans une PWA installée sur iOS qu'à partir d'iOS
16.4 ; en dessous, c'est le repli ci-dessus qui s'applique.

## La liste : deux portées

`drawList()` sert deux surfaces avec le même rendu, via `listScope` :

- **« Le quartier »** (depuis la carte) — tout ce qui est recensé, chats perdus
  en tête, avec la bannière des perdus à proximité
- **« Mes publications »** (depuis l'appareil photo) — seulement ses propres
  fiches, `uid` à l'appui

Les fiches d'avant les comptes n'ont pas d'`uid` : elles n'appartiennent à
personne et ne sortent jamais en portée « mine ». Ne pas les rattacher d'office à
qui les consulte.

## Couleurs de la carte

Les tuiles OpenStreetMap sont **saturées au-delà de leur rendu d'origine**
(`saturate(1.45)` en clair, `1.6` en sombre) : vert franc pour les bois et les
parcs, bleu net pour l'eau. La palette d'OSM est volontairement pâle, et deux
versions successives ont été jugées trop fades — d'abord une désaturation à 95 %
qui rendait la carte morte, puis un simple retour aux couleurs d'origine. C'est
au-dessus de 1.4 que la carte devient gaie.

Plafond à ne pas dépasser : vers `1.8` en clair et `2.2` en sombre, les routes
jaunes et oranges d'OSM prennent le dessus et entrent en concurrence avec les
chats roux. C'est la seule contrainte réelle — les marqueurs doivent rester ce
qu'il y a de plus coloré à l'écran.

En thème sombre, `invert(1)` seul retournerait aussi les teintes : le vert
virerait au mauve et l'eau à l'orange. Le `hue-rotate(180deg)` qui suit les
remet d'aplomb. **Ne jamais retirer l'un sans l'autre.**

## Croquis de chat sur la carte

Le marqueur d'un chat est une **silhouette dessinée**, remplie de la couleur
choisie et découpée d'après la **race** (`catSVG(couleur, nomCouleur, race)`).
La race ne redessine pas tout : elle ne joue que sur les deux traits qui tiennent
encore à 46 px, la **taille des oreilles** (`EARS`) et la **fourrure longue** qui
déborde du contour, plus les plumets du maine coon. Une race absente ou inconnue
retombe sur l'européen — ne pas supprimer ce repli, la plupart des fiches n'auront
pas de race.

Deux pièges vérifiés à l'œil, à ne pas réintroduire :

- Le **point interne** de chaque oreille doit redescendre au niveau du sommet du
  crâne (y ≈ 17-22). Plus haut, les deux oreilles se croisent en X au lieu de
  former une encoche en V, et c'est d'autant plus laid que l'oreille est grande.
- **Maine coon et poil long** se confondaient quand ils ne différaient que par
  les plumets. Le maine coon a donc aussi de **grandes oreilles**.

Toute modification du dessin se juge sur une planche aux trois tailles (96, 46,
34 px) et dans les six couleurs — pas dans le questionnaire, où tout est gros.

**L'étape « Cadre sa tête » a été retirée** (2026-09-10) : demander un cadrage
manuel pour fabriquer une vignette était le pas le plus long du questionnaire.
Les fiches d'avant portent encore un champ `mask` et leur marqueur reste la photo
réelle découpée en chat (`catPhotoSVG`) — garder cet affichage, le retirer
effacerait un travail que ces contributeurs ont fait à la main. On n'écrit plus
de `mask`.

## Logo

`_icon.svg` est la source unique : chat assis de profil **tourné à droite**,
crème `#f6f4f0` sur anthracite `#221f1c`, avec un repère de carte indigo
`#3b30d9` en bas à droite, chevauchant le poitrail. **Le trou du repère est
crème, pas noir** — c'est ce qui le détache du fond. Le même dessin est inline
dans `index.html` comme `<symbol id="i-logo">`, avec les couleurs passées en
variables CSS. **Modifier les deux ensemble.**

Le dessin a été tracé à l'œil d'après une image fournie par le porteur du projet.
Trois choses portent la ressemblance, dans l'ordre :

1. **Les deux triangles noirs**, en haut à gauche et en bas à gauche. C'est le
   cadrage serré qui fait l'image — combler l'un des deux et le chat devient une
   vignette centrée quelconque.
2. **Le profil de la face** : front presque vertical, léger creux au stop, museau
   court et rond, encoche nette sous la truffe, menton marqué. Un museau qui
   s'effile donne un renard.
3. **La taille de la tête** par rapport au corps. Le premier essai la faisait
   trop petite et le porteur a dit, à juste titre, que ce n'était pas son dessin.

Les PNG (`icon-192`, `icon-512`) sont générés depuis ce SVG en **carré plein,
sans coins arrondis** : iOS et Android appliquent leur propre masque, arrondir
soi-même produit un liseré. Régénération (aucun convertisseur SVG n'est
installé, on passe par les outils macOS) :

```
sed 's/ rx="24"//' _icon.svg > /tmp/sq.svg
qlmanage -t -s 512 -o /tmp /tmp/sq.svg && sips -z 512 512 /tmp/sq.svg.png --out icon-512.png
sips -z 192 192 /tmp/sq.svg.png --out icon-192.png
```

Toute retouche se juge sur une planche à 300, 110, 60 et **40 px** — 40 px est la
taille réelle sur un écran d'accueil. Le navigateur met `_icon.svg` en cache avec
insistance : ajouter un paramètre d'horodatage à l'URL pendant la mise au point.
