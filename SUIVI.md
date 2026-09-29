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
- Liens eBay : un bouton « 🔎 eBay.de » au lieu du 🔗 (fiche de la figurine choisie et « Ma
  collection »). eBay.fr n'a presque aucune annonce JB (2 contre 646 le 29/09) : bouton « Appli
  eBay » (eBay.fr, aucun résultat) retiré. Confirmé sur le téléphone le 29/09 (Zemo : 2 annonces). « Chrome » passe par ebay.html, qui redirige
  vers eBay.de sans toucher (sinon Chrome confiait le lien à l'application eBay : constaté le 29/09).
  Résultat sur le téléphone (29/09, « liens compatibles » de l'appli eBay désactivés) : l'application
  eBay s'ouvre quand même, mais sur eBay.de, avec les bonnes annonces (Zemo : 2). Objectif atteint.
  Chrome par défaut, car l'application eBay
  du téléphone (réglée sur eBay.fr) les interceptait et ne trouvait rien (test « Zemo » du 29/09 :
  0 résultat dans l'appli eBay, 2 dans Chrome). Les QR codes des étiquettes gardent le lien normal :
  scannés avec l'appareil photo, ils peuvent encore ouvrir l'application eBay.
  -> Corrigé le 29/09 : le QR code des figurines eBay contient …/ebay.html?q=<nom> (page relais,
  même densité de QR code) ; le lien gardé dans Excel reste la recherche eBay.de. Confirmé le 29/09
  (étiquette Baron Zemo scannée : 2 annonces sur eBay.de). Les étiquettes eBay faites avant le 29/09 sont à refaire.

- brickshellcases.com (29/09/2026) : 130 figurines JB en vente sur leur site (toutes collections,
  pas seulement « jb-toys-custom-figures ») ; 58 déjà au catalogue JB, 68 autres -> data/jb_brickshell.tsv
  (outils/brickshell_jb.py). Le nom de fichier de leurs photos donne le numéro d'article JB : 55 gardent
  leur code JB-… (ex. Nya JB-648654818), 13 ont un code BSC-… (photo maison, ou lot « Joy, Anger… »
  au numéro partagé : leur étiquette aura un code CUS-…). Lien : page brickshellcases (les pages JB
  des figurines retirées renvoient une erreur 404). 55 empreintes de décor ajoutées (photos du site
  JB, sans effet négatif sur le test des 40 photos eBay). La liste eBay passe de 223 à 193 noms.
- Vinted : écarté (pas d'API publique, collecte automatique interdite par leurs conditions
  d'utilisation, et site bloqué dans l'environnement).

- Blister (retour du 29/09, 3 figurines retirées) : photo entière jamais reconnue ; encadrer le nom
  a marché 2 fois sur 3. Cas étudié (photo reçue) : « CHROME GOLDEN ANTAGONIST », absente de toutes
  nos listes (ni site JB, ni brickshellcases, ni eBay.de). Le nom était bien lu, mais « GOLDEN » seul
  faisait proposer « Golden DJ ». Corrigé : rapprochement plus strict (noms de 1-2 mots : tous les mots ;
  1 mot : lu exactement ; sinon 2/3) ; si rien ne correspond, le nom le plus probable du carton
  (lignes en capitales, sans « LIMITED TO… ») est repris dans le champ Nom (étiquette CUS-…).
  2e photo reçue : « SHINY DARK LORD » (dans la liste eBay), texte blanc sur gris, vertical ; photo
  entière : rien de lu. Les photos reçues dans la conversation sont réduites (924 x 2000) : sur elles,
  même le cadre découpé ne se lit qu'en partie (« SHINY ») ; le téléphone a la pleine définition.
  Ajouté : noir et blanc automatique (Otsu, le fond devient blanc : texte clair sur fond foncé),
  essai de plus sur la photo entière, et pour un nom encadré plus haut que large, essais tourné
  d'un quart de tour. Nom plausible : 8 lettres minimum (écarte « JERE DE »). À retester sur le
  téléphone.
  3e photo : « BLACK KRRSANTAN » (liste eBay), blanc sur fond sombre dans un cadre : rien de lu.
  Essais sans succès (non publiés) : tuiles, repérage automatique des cadres, effacement des traits.
  Conclusion : Tesseract lit mal les noms en lettres très grasses, claires, encadrées (nouveau style
  de blister). Choix de l'utilisateur (29/09) : piste 1 puis piste 2.
  Piste 1 (faite) : si la photo entière ne donne aucun nom, l'encadrement du nom s'ouvre tout seul
  (« Annuler » ramène aux blisters au décor ressemblant) ; essai « texte épars » ajouté au nom encadré.
  Piste 2 (faite le 29/09) : PaddleOCR dans le téléphone (js/lecture_paddle.js, lib/paddle/ :
  onnxruntime-web + PP-OCRv4 ; ~27 Mo téléchargés à la première lecture). D'abord PaddleOCR, puis
  Tesseract s'il ne trouve rien. Sur les 3 photos (même réduites) : Shiny Dark Lord et Black
  Krrsantan trouvés (4-5 s), Chrome Golden Antagonist repris dans le champ Nom (15 s, via Tesseract :
  PaddleOCR fusionne ses deux lignes verticales). Classement : un nom lu sur une même ligne passe
  devant des mots épars (citation « EX-BOUNTY HUNTER »). Confirmé sur le téléphone (29/09) : les
  3 blisters OK sur la photo entière (Shiny Dark Lord et Black Krrsantan trouvés, lecture rapide ;
  Chrome Golden Antagonist repris dans le champ Nom).
- Nom lu mais absent de toutes nos listes (ex. Chrome Golden Antagonist : aucune annonce nulle part
  le 29/09, ni sous « Phasma ») : lien de l'étiquette = recherche eBay.de sur ce nom, rempli d'office
  (QR code via la page relais) ; il suit le nom si on le corrige, et cède la place au lien d'un blister
  proposé si on en choisit un. Confirmé sur le téléphone le 29/09.
- Blister photographié de travers (texte vertical) : la photo est remise d'aplomb après la lecture
  (sens donné par PaddleOCR : rotation qui rend lisible la plupart du texte), pour l'aperçu et
  l'encadrement du nom. Confirmé sur le téléphone le 29/09.
- La photo du blister (remise d'aplomb) reste affichée en haut de l'écran de résultat (Custom).
  Confirmé sur le téléphone le 29/09.
- Bouton retour du téléphone : ramène à l'écran précédent (annule un recadrage, sans effet pendant
  une lecture ; après un ajout, l'écran précédent est l'accueil) ; depuis l'accueil, question
  « Quitter l'appli ? » (Quitter / Rester). Si le téléphone refuse la fermeture par l'appli, message
  « Appuyez encore sur retour pour quitter ».

## Fichier Excel de l'utilisateur

Dernière version fournie : etiquettes_figurines_LEGO_tri-1_2026-09-28_22h04.xlsx
(646 figurines : anciens onglets transférés vers les onglets par thème, 6 anciens onglets
Star Wars supprimés, SW1348 / SW1394 séparées). Restent sans étiquette : CUSTOM
(Stormtrooper transparent), 10 customs des VITRINE (Albator, Chucky…), code SW75340 invalide.
Point jamais vérifié : ouverture du fichier dans Excel sur ordinateur.

## Tâche automatique

« Mise à jour catalogue JB » (trig_011Ds34iarCiCVXumdMSDeEY) : le 2 de chaque mois à 6h50
(Paris), relance outils/catalogue_jb.py, outils/brickshell_jb.py, outils/empreintes_jb.js, puis outils/ebay_jb.py ;
publie data/jb.tsv, data/jb_brickshell.tsv, data/jb_empreintes.tsv et data/jb_ebay.tsv s'il y a du
changement. Chaque source est indépendante : l'échec de l'une ne bloque pas les autres. Essai du 28/09 : terminé sans publication
(normal), mais compte rendu non lu : on ne sait pas encore si la tâche a le droit de publier.

## Domaines autorisés dans l'environnement

www.jb-spielwaren.de, *.jb-spielwaren.de, cdn03.plentyone.com, brickshellcases.com,
cdn.shopify.com, api.ebay.com, i.ebayimg.com (accessibles). web.archive.org : encore
refusé → ajouter *.archive.org.

## Prochaines étapes

1. Blisters : lecture PaddleOCR validée sur le téléphone (29/09) ; à suivre sur d'autres blisters.
2. brickshellcases.com : fait le 29/09 (voir plus haut).
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
