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

## Publié le 29/09/2026, à confirmer sur le téléphone

- Figurines JB retirées de la vente, vues sur eBay.de (data/jb_ebay.tsv, 223 noms, créé par
  outils/ebay_jb.py) : proposées dans la recherche custom et la lecture des blisters, marquées
  « Retirée · eBay.de ». Lien de l'étiquette = recherche eBay.de (reste valable quand l'annonce
  se termine), code CUS-…. Ex. Lagertha, Baron Zemo, The Daywalker, The Princess.
  Noms tirés des titres d'annonces : quelques doublons ou noms imparfaits (« Jedi Bob Movie »,
  « Vegan Milk Luke » / « Vegan Blue Milk Luke »…) ; on les corrige au besoin dans le champ Nom.
- Liens eBay (🔗 de l'appli) : ouverts de force dans Chrome sur Android, car l'application eBay
  du téléphone (réglée sur eBay.fr) les interceptait et ne trouvait rien (test « Zemo » du 29/09 :
  0 résultat dans l'appli eBay, 2 dans Chrome). Les QR codes des étiquettes gardent le lien normal :
  scannés avec l'appareil photo, ils peuvent encore ouvrir l'application eBay.

## Fichier Excel de l'utilisateur

Dernière version fournie : etiquettes_figurines_LEGO_tri-1_2026-09-28_22h04.xlsx
(646 figurines : anciens onglets transférés vers les onglets par thème, 6 anciens onglets
Star Wars supprimés, SW1348 / SW1394 séparées). Restent sans étiquette : CUSTOM
(Stormtrooper transparent), 10 customs des VITRINE (Albator, Chucky…), code SW75340 invalide.
Point jamais vérifié : ouverture du fichier dans Excel sur ordinateur.

## Tâche automatique

« Mise à jour catalogue JB » (trig_011Ds34iarCiCVXumdMSDeEY) : le 2 de chaque mois à 6h50
(Paris), relance outils/catalogue_jb.py puis outils/empreintes_jb.js, puis (depuis le 29/09) outils/ebay_jb.py ;
publie data/jb.tsv, data/jb_empreintes.tsv et data/jb_ebay.tsv s'il y a du changement.
Les deux parties (site JB, eBay.de) sont indépendantes : l'échec de l'une ne bloque pas l'autre. Essai du 28/09 : terminé sans publication
(normal), mais compte rendu non lu : on ne sait pas encore si la tâche a le droit de publier.

## Domaines autorisés dans l'environnement

www.jb-spielwaren.de, *.jb-spielwaren.de, cdn03.plentyone.com, brickshellcases.com,
cdn.shopify.com, api.ebay.com, i.ebayimg.com (accessibles). web.archive.org : encore
refusé → ajouter *.archive.org.

## Prochaines étapes

1. Retours de l'utilisateur sur un vrai blister (qualité, temps de lecture).
2. brickshellcases.com (Shopify, collection « jb-toys-custom-figures ») : ajouter noms et
   empreintes de blisters au catalogue JB (lire /collections/…/products.json, poliment).
3. eBay.de (la meilleure source : JB Spielwaren est allemand) : accès OK (29/09/2026).
   Clés dans EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (ne jamais les afficher), jeton en Basic.
   `python3 outils/ebay_jb.py [--detail]` : ~660 annonces lues ; 160 annonces de 78 figurines déjà
   au catalogue ; 223 figurines absentes -> data/jb_ebay.tsv ; lots et objets divers écartés.
   Le sitemap du site JB ne liste que les articles en vente : pas de n° d'article pour les retirées.
   Empreintes du décor à partir des photos eBay : essayées puis ABANDONNÉES (photos d'un même
   vendeur trop semblables entre elles : elles passaient devant le bon blister dans 35 cas sur 40).
   Constat au passage : sur 40 photos eBay de blisters du catalogue, la comparaison du décor ne met
   le bon blister en tête qu'une fois (3 fois dans les 3 premiers) ; la lecture du nom reste la
   méthode principale. Piste : recadrer sur le carton avant de calculer l'empreinte.
   Ajouté à la tâche mensuelle le 29/09/2026.
4. Archives (web.archive.org) : anciennes figurines JB retirées de la vente.
5. Éventuel contact avec JB Spielwaren pour une base officielle de leurs blisters.
6. Vérifier le compte rendu de la tâche automatique ; corriger si elle ne peut pas publier.
