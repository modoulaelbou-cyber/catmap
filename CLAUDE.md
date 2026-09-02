# CatMap

PWA de signalement collaboratif des chats de quartier. L'utilisateur photographie un chat qu'il croise, indique sa couleur et sa situation, et le chat apparaît sur une carte partagée. Objectif principal : retrouver les chats perdus grâce aux observations des voisins.

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

Un chat, tel que stocké aujourd'hui dans `localStorage` sous la clé `catmap.v1` :

```js
{
  id: 1735820400000,      // Date.now()
  color: 'Roux',          // Gris | Roux | Noir | Blanc | Tigré | Bicolore
  status: 'Errant',       // Errant | Promenade | Perdu
  photo: 'data:image/jpeg;base64,...',
  lat: 49.1917,
  lng: 2.4083,
  first: '2026-09-02T18:00:00.000Z',
  last:  '2026-09-02T18:00:00.000Z',
  seen: 1                 // nombre d'observations
}
```

## Limite bloquante

Les données vivent dans le `localStorage` du téléphone. Deux utilisateurs ne voient pas les chats l'un de l'autre, ce qui vide l'app de son intérêt : sans partage, personne ne peut aider à retrouver un chat perdu.

C'est le chantier prioritaire. Migration vers Firebase Firestore, en conservant la même forme d'objet pour limiter les changements dans le code. Prévoir un mode hors ligne cohérent : la persistance locale de Firestore couvre le cas.

Les photos restent stockées en base64 directement dans le document Firestore (comme dans localStorage aujourd'hui), et non dans Firebase Storage : Storage exige le plan payant Blaze (carte bancaire), alors que Firestore reste gratuit sur le plan Spark. Une photo compressée (JPEG ~900px, qualité 0.75) tient largement sous la limite de 1 Mo par document Firestore. Décision prise le 2026-09-02, à revoir seulement si les photos deviennent plus lourdes.

## Suite envisagée

Une fois les données partagées, dans cet ordre :

1. Comptes utilisateurs (Firebase Auth, connexion anonyme ou par e-mail)
2. Notification quand un chat est signalé perdu à proximité — c'est la fonctionnalité qui justifie l'app
3. Signalement des doublons et modération légère
4. Version React Native, parce que les notifications push PWA sont trop faibles sur iOS

L'IA de reconnaissance de couleur ou de race a été écartée volontairement : la sélection manuelle suffit et produit de meilleures données au départ.

## Conventions

Interface en français, ton simple, pas de jargon. Sentence case partout, pas de Title Case.

Rester en vanilla JS tant que ça tient : pas de framework, pas de bundler, pas d'étape de build. Un `git push` doit suffire à déployer.

Le service worker est en network-first sur le HTML et le manifeste, cache-first sur le reste. Si tu changes cette logique, vérifie que les mises à jour arrivent toujours sur le téléphone sans désinstaller l'app — c'est un bug qui a déjà été rencontré.

L'app est utilisée dehors, à une main, souvent au soleil. Cibles tactiles larges, contrastes francs, aucune action critique en haut de l'écran.

## Déploiement

GitHub → Netlify, déploiement automatique à chaque push. Pas de build command, dossier de publication à la racine. HTTPS obligatoire : sans lui, ni la caméra ni le GPS ne fonctionnent.
