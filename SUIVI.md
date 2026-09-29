# Suivi du projet « Figurines LEGO » (mis à jour le 29/09/2026)

Appli en ligne : https://matd-prog.github.io/etiquettes_figurines/ (icône « Figs LEGO »).
Tout le code et les données sont dans ce dépôt ; ce fichier sert à reprendre le travail.

## Ce qui fonctionne (publié et vérifié sur le téléphone)

- Photo d'une figurine → recadrage → Brickognize → 5 propositions avec photos BrickLink,
  photo de dos facultative, recherche par nom (catalogue BrickLink 19 250 figurines).
- Étiquette QR code (lien BrickLink) sur la couleur du camp / du thème, ajout dans Excel.
- Star Wars : onglets Gentils (vert), Méchants (rouge), Zone grise + Table camps.
- Autres thèmes : un onglet par thème (Simpsons, Seigneur des Anneaux, Harry Potter,
  Super-héros, Minifigs à collectionner, Disney, Ninjago, Town & City, Jurassic World,
  Autres thèmes). « Town & City » et non « City » (conflit avec l'onglet CITY existant).
- « Ma collection » : liste, planche, recherche (lecture seule).
- Enregistrement : téléchargement puis import dans Google Drive (Chrome Android ne peut
  pas partager un .xlsx directement).
- Catalogue BrickLink : mise à jour depuis le téléphone (Outils) ; rappel le 2 du mois
  dans l'appli et dans Google Agenda (19h00).

## Publié, à confirmer sur le téléphone

- Customs : onglet « Customs » (corail), code JB-<article> ou CUS-001…, QR vers la page
  du fabricant (lien gardé colonnes S à W), n° d'exemplaire ajouté au nom (ex. 189/250).
- Catalogue JB Spielwaren (data/jb.tsv, 281 figurines au 28/09/2026) + recherche.
- Blister JB : photo entière → lecture du nom (Tesseract.js, dans le téléphone) +
  comparaison du décor (data/jb_empreintes.tsv, 279 empreintes) + indice Brickognize.
  Essai sur « The Ring Addict » : nom trouvé et confirmé par le décor en ~3 s (ordinateur).

## Fichier Excel de l'utilisateur

Dernière version fournie : etiquettes_figurines_LEGO_tri-1_2026-09-28_22h04.xlsx
(646 figurines : anciens onglets transférés vers les onglets par thème, 6 anciens onglets
Star Wars supprimés, SW1348 / SW1394 séparées). Restent sans étiquette : CUSTOM
(Stormtrooper transparent), 10 customs des VITRINE (Albator, Chucky…), code SW75340 invalide.
Point jamais vérifié : ouverture du fichier dans Excel sur ordinateur.

## Tâche automatique

« Mise à jour catalogue JB » (trig_011Ds34iarCiCVXumdMSDeEY) : le 2 de chaque mois à 6h50
(Paris), relance outils/catalogue_jb.py puis outils/empreintes_jb.js, publie data/jb.tsv et
data/jb_empreintes.tsv s'il y a du changement. Essai du 28/09 : terminé sans publication
(normal), mais compte rendu non lu : on ne sait pas encore si la tâche a le droit de publier.

## Domaines autorisés dans l'environnement

www.jb-spielwaren.de, *.jb-spielwaren.de, cdn03.plentyone.com, brickshellcases.com,
cdn.shopify.com, api.ebay.com, i.ebayimg.com (accessibles). web.archive.org : encore
refusé → ajouter *.archive.org.

## Prochaines étapes

1. Retours de l'utilisateur sur un vrai blister (qualité, temps de lecture).
2. brickshellcases.com (Shopify, collection « jb-toys-custom-figures ») : ajouter noms et
   empreintes de blisters au catalogue JB (lire /collections/…/products.json, poliment).
3. eBay : accès OK (testé le 29/09/2026). Clés dans les variables d'environnement
   EBAY_CLIENT_ID et EBAY_CLIENT_SECRET (ne jamais les afficher) ; jeton envoyé en Basic.
   `python3 outils/ebay.py "JB Spielwaren custom" 10` → 281 annonces sur eBay.de, titres et
   photos lisibles ; téléchargement des photos i.ebayimg.com OK (s-l1600 = grande taille).
   L'identifiant API « eBay » de l'environnement peut être supprimé.
   Ensuite : noms (titres nettoyés et recoupés avec data/jb.tsv) + empreintes des photos de
   blisters, photos non conservées.
4. Archives (web.archive.org) : anciennes figurines JB retirées de la vente.
5. Éventuel contact avec JB Spielwaren pour une base officielle de leurs blisters.
6. Vérifier le compte rendu de la tâche automatique ; corriger si elle ne peut pas publier.
