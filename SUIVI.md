# Suivi du projet « Briquothèque » (ex « Figothèque », ex « Figurines LEGO ») (mis à jour le 01/10/2026)

Appli en ligne : https://matd-prog.github.io/briquotheque/ (nom « Briquothèque », ex « Figothèque », icône tête de figurine souriante).
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
- Photos en grand (01/10/2026, cache v44, vérifié sur le téléphone) : dans la liste de la base de blisters, la vignette
  montre le recto seul ; la toucher ouvre une page avec le recto et le verso (aussi dans la
  mini-appli). Dans Consulter, toucher une vignette ouvre sa fiche : mes blisters (recto et
  verso), toutes les photos de collectionneur (ex. « 📷 4 »), la photo du catalogue et le lien
  vers sa page. Le retour (ou ✕ Fermer) referme la page.

## Publié, à confirmer sur le téléphone

- Customs : onglet « Customs » (corail), code JB-<article> ou CUS-001…, QR vers la page
  du fabricant (lien gardé colonnes S à W), n° d'exemplaire ajouté au nom (ex. 189/250).
- Catalogue JB Spielwaren (data/jb.tsv, 281 figurines au 28/09/2026) + recherche.
- Blister JB : photo entière → lecture du nom (Tesseract.js, dans le téléphone) +
  comparaison du décor (data/jb_empreintes.tsv, 279 empreintes) + indice Brickognize.
  Essai sur « The Ring Addict » : nom trouvé et confirmé par le décor en ~3 s (ordinateur).

- Nouveautés LEGO automatiques (01/10/2026, cache v45) : chaque jour à 4h50 UTC, l'action « Catalogue des sets
  et nouveautés » (.github/workflows/sets.yml, avant : le 2 du mois) relit Rebrickable : data/sets.tsv,
  data/sets_figurines.tsv, data/nouveautes.tsv (outils/nouveautes_rebrickable.py : figurines, sets, objets dérivés
  de l'année, et de l'an dernier de janvier à mars ; date de première apparition gardée d'un passage à l'autre)
  et data/nouveautes_empreintes.tsv (outils/empreintes_nouveautes.js : empreinte de la photo officielle de
  chaque nouvelle figurine, empreinteFigurine de js/empreinte.js : fond retiré, couleurs tête/buste/jambes).
  Dans l'appli (js/nouveautes.js) :
  - les nouvelles figurines s'ajoutent à la recherche par nom et aux séries récentes, sous leur code BrickLink
    s'il est déjà sûr (ressemblance du nom >= 0,7), sinon sous leur code Rebrickable (FIG-…, lien et photo
    Rebrickable). À faire plus tard : remplacer ces codes FIG-… par le code BrickLink une fois connu ;
  - photo d'une figurine : si Brickognize n'est pas sûr (< 85 %), les 4 nouveautés les plus ressemblantes
    sont proposées (« 🆕 nouveauté ») ; devant s'il hésite (< 50 %) et qu'une nouveauté ressemble à 80 % ou plus ;
  - « 🆕 Nouveautés » : date de mise à jour et bouton « 🔄 Actualiser » ;
  - Objet dérivé : en tapant le nom, les objets dérivés récents proposés ; un toucher remplit le numéro.
  Essai avec des figurines dessinées : 5 sur 5 bien retrouvées ; à vérifier avec de vraies photos.
  Premier passage réel (01/10) : 2 338 nouveautés (926 figurines dont 492 avec code BrickLink, 727 sets,
  685 objets dérivés), 583 empreintes de figurines.
- Objets dérivés (01/10, cache v46) : data/objets.tsv = tous les objets dérivés Rebrickable, toutes années
  (numéro BrickLink probable : « LGLKE48H-1 » -> « LGL-KE48H », à vérifier ; référence imprimée « KE48H »).
  Écran Objet dérivé : « 📷 Photographier l'étiquette (face avant) » lit la référence au-dessus du code-barres
  (Tesseract, par bandes agrandies, photo droite puis tournée) et retrouve l'objet ; ou recherche par nom/référence.
  Essai sur les photos de l'utilisateur : KE48H (fantôme) et KE247H (Dark Vador blanc) lus (12 à 27 s) ;
  le dos de l'étiquette ne porte pas la référence.
  Premier catalogue réel : 7 970 objets, 206 porte-clés lumineux. Beaucoup sont rangés sous un numéro LEGO
  (ex. fantôme KE48H = « Ghost Key Light » 5005667). Comparaison des photos essayée puis abandonnée (le fantôme
  n'était pas dans les 10 premiers : objets blancs, fond clair). Référence absente (cache v48) : l'utilisateur tape
  le nom, les porte-clés lumineux d'abord, touche le bon ; la correspondance référence -> objet est gardée dans le
  téléphone (Memoire « objets-references ») et reconnue directement la fois suivante. Plus de numéro deviné.
- Ma collection, photos des customs (01/10, cache v50, vérifié sur le téléphone) : codes CUS-… -> figurine JB retrouvée par le lien ou le
  nom (sans le n° « 52/150 ») ; photo du catalogue, sinon photo de « Ma base de blisters », sinon photo de l'album
  (jeton GitHub), sinon 🎨. Signalé par l'utilisateur (capture : BLACK KRRSANTAN, SHINY DARK LORD… sans photo).
- Dates de sortie Brickset (01/10, cache v60) : clé API dans le secret GitHub BRICKSET_KEY (créée par l'utilisateur,
  compte Brickset « barjo44 ») ; outils/brickset_sorties.py -> data/sorties.tsv chaque nuit (sets de l'année et de la
  suivante : thème, sous-thème, sortie, fin, pièces, figurines, image). Écran Nouveautés : onglet « 📅 Par mois »
  (mois choisi, sorties classées par thème, sets puis figurines ; une figurine prend la date de son premier set).
  PRIX : toujours le prix public FRANÇAIS (choix de l'utilisateur ; seuls les prix JB Spielwaren sont allemands).
  Brickset n'a que le prix LEGO allemand : non gardé. lego.com/fr-fr refuse (403, même depuis GitHub). Source retenue :
  Avenue de la Brique (comparateur français ; /recherche/<numéro> -> fiche ; « 59.99 € | chez LEGO » = prix public
  LEGO France ; itemprop lowPrice = meilleur prix du moment). outils/prix_lego_fr.py -> data/prix_fr.tsv (code, prix,
  meilleur, url, date), sets sortis depuis 60 jours ou à venir, 150 par nuit, relus après 7 jours. Essais de structure :
  outils/sonde_prix_fr.py + .github/workflows/sonde.yml (à la main). HOTH BRICKS joignable aussi (BAM du mois ?).
  Premier relevé (01/10, cache v61) : 66 sets, 62 avec le prix LEGO France, 56 avec un meilleur prix (ex. 76347 Quinjet
  59,99 € / dès 46,89 € ; 75457 Executor 749,99 €). Écran « Par mois » : « LEGO 59,99 € · dès 46,89 € ».
  Valorisation basculée sur le prix français (01/10, cache v62) : prix_lego.py (dépôt privé) ajoute la colonne prix_fr
  (Avenue de la Brique) à lego.tsv ; valeur.js n'utilise plus que prix_fr pour « encore en vente » (le prix allemand
  sert seulement de plancher pour le prix d'origine). Il faut relancer « 📤 Envoyer ma liste » (💶 Valeur) pour que
  lego.tsv reçoive la colonne.
- Version diffusable, nuit du 01 au 02/10 (caches v64 à v67, testé sur ordinateur, PAS encore sur le téléphone) :
  · 🖨️ Imprimer des étiquettes (js/impression.js) : taille au choix (modèles Avery, rouleaux Brother/Dymo, format perso,
    « Comme mon fichier Excel »), départ sur planche entamée, QR/nom/couleur/traits au choix, mémoire des étiquettes imprimées.
  · 📤 Exporter (js/exports.js) : Excel neuf (un onglet par catégorie), PDF (liste), CSV, BrickLink XML (souhaits ou
    collection), sauvegarde .json + restauration.
  · 🗄️ Collection dans l'appli sans Excel (js/base_collection.js, IndexedDB « figotheque ») : choix à l'écran de départ,
    reprise d'un fichier Excel dans la base, enregistrement immédiat ; mêmes appels que le classeur (dispatch « estBase »
    au début des fonctions de figurines de js/xlsx.js). Le mode Excel de Mathias est inchangé (vérifié).
  · 📈 Courbe de la valeur (valeur.js, Memoire « historique_valeur », un point par jour de consultation).
  · 📊 Statistiques (js/statistiques.js) : totaux, par onglet, séries de minifigs commencées (manquantes → souhaits),
    catégories BrickLink, customs JB.
  · Version diffusable : un seul onglet « Star Wars » (jaune), sans camps ; les camps rouge/vert/gris restent pour le
    fichier Excel de Mathias (ses étiquettes perso). Figurines rangées par camp dans la base : regroupées à l'ouverture.
  · 02/10 matin : le téléphone a envoyé 2 listes VIDES (« 0 articles ») au dépôt privé -> lego.tsv vidé par le relevé,
    valeur réduite aux customs. codes.txt et lego.tsv remis (commit 4d70e24 du dépôt privé) ; garde-fou ajouté dans
    valeur.js (refus d'une liste vide, confirmation si moins de la moitié de la précédente). Cause à confirmer avec Mathias
    Cause confirmée : le téléphone était sur la collection de l’appli (🗄️, vide). Ajouté (v69) : confirmation avant de
    quitter Excel, copie du fichier Excel gardée (Memoire « classeur_excel »), bandeau « 📗 Utiliser mon fichier Excel ».
  · DÉCISION de Mathias (02/10) : une seule version, sur la BASE DE DONNÉES (plus d'Excel) ; sa seule différence :
    réglage « Star Wars rangé par camps » (Outils, case à cocher ; table _reglages/camps_star_wars de la base). Le camp de
    chaque figurine est toujours gardé (champ camp) ; onglet stocké « Star Wars », onglet affiché = camp si réglage actif.
    v70 : bouton « 🗄️ Passer à la base de données (reprend ce fichier Excel) » dans les Outils (mode Excel), question
    « garder les camps ? » à la reprise ; écran de départ : « Commencer ma collection » / « Reprendre d'un fichier Excel »,
    Excel = ancienne méthode. Sauvegarde en ligne automatique (1 min après une modif, et à la mise en arrière-plan) dans
    le dépôt privé : sauvegarde/collection.json (jeton de 💶 Valeur) ; boutons Sauvegarder / Restaurer dans les Outils.
  · v71 : case « camps » cachée aux autres utilisateurs (visible seulement si la base a le réglage, posé à la reprise
    d'un fichier Excel rangé par camps). Mesures d'impression exactes du fichier Excel (formatDepuisExcel, impression.js :
    largeur des colonnes A-E règle Excel Calibri 11, hauteur de ligne, étiquette à 3 px du bord, marges, échelle,
    centrage) gardées dans la base (_reglages/format_etiquettes_excel) à la reprise, modèle « Mes étiquettes (mesures de
    mon fichier Excel) » ; le format choisi est aussi gardé dans la base (_reglages/format_etiquettes). À valider par une
    impression d'essai de Mathias (règle en main), réglable au centième de mm.
  · Étiquettes de Mathias : collées sur la grande face inclinée d'une pente 33° 3×4 (BrickLink 3297, face ≈ 31,8 × 18 mm).
    Il GARDE les mesures de son fichier Excel (26,19 × 13,23 mm, modèle « Mes étiquettes… ») : un peu de marge, voulu
    (évite que l'étiquette frotte et se décolle). Ne pas changer.
  · v76-v77 (02/10, VÉRIFIÉ sur le téléphone) : blocage de « Je l'ai » sur un blister résolu (écritures en mémoire
    sécurisées, une seule connexion IndexedDB, étapes affichées). Un seul bouton « 📚 Ajouter à ma collection » (va aussi
    dans la base commune) + lien « pas à moi : seulement base commune » ; idem contribuer.html, brouillon Gmail de l'ami
    mis à jour. Erreurs affichées et gardées dans les Outils ; version affichée (VERSION_APPLI dans app.js = cache sw.js).
  · v78-v79 : Outils « 📨 Signaler un problème ou suggérer une amélioration » (🐞 problème / 💡 suggestion) (version, appareil, écran, travaux en cours, 15 dernières actions,
    erreurs ; rien de la collection) : partage du téléphone, sinon e-mail (ADRESSE_RAPPORT dans app.js, VIDE : adresse à
    choisir par Mathias pour la version diffusée) + copie dans le presse-papiers.
  · v81 (02/10) : appli RENOMMÉE « Briquothèque » (choix de Mathias ; « Figothèque » rappelait Figolu / la figue ;
    Brickodex et BrickDex déjà pris ; « Bricothèque » = prêt d'outils de bricolage). Sauvegardes .json
    « Figothèque » toujours acceptées. INPI vérifié par Mathias (02/10) : une seule marque
    « BRIQUOTHEQUE » (n° 1695257, Wienerberger, 1991, classe 19 matériaux de construction), EXPIRÉE le 25/09/2021 ->
    nom libre en France. EUIPO « Briquothèque » et « Briquotheque » : 0 marque -> nom libre en France et dans l'UE ; dépôt éventuel classes 9 et 42 avant une diffusion commerciale.
  · v140 (10/10) : retouches du thème sobre : contour de sélection gris discret (plus l'orange du navigateur) ; fiche
    d'une figurine avec une seule action principale noire, les autres en boutons blancs bordés.
  · v139 (10/10) : THÈME SOBRE (validé sur son téléphone le 10/10 ; Mathias : « plus pro, moins flashy, gris, noir, plus design »). Couche ajoutée en fin
    de style.css : en-tête noir anthracite (#18181b, aussi la mini-appli), une seule couleur d'action (noir), boutons
    secondaires blancs bordés de gris, cartes et tuiles blanches à liseré fin, messages neutres, rouge et vert gardés
    pour erreur / réussite (tons atténués), icônes des tuiles en niveaux de gris, police Inter / système.
    theme-color et manifestes en #18181b. Rien n'a changé dans le fonctionnement.
  · v138 (09/10) : RECADRAGE : le cadre part des bords de la PHOTO ENTIÈRE (Mathias : le cadre proposé, trouvé tout
    seul ou à 5 % du bord, était plus petit que la photo ; on resserre ensuite si besoin). Marge de 22 px autour de la
    photo où les coins s'attrapent encore (doigt qui déborde du bord), sans défilement de l'écran (.cadre-marge).
  · v137 (08/10) : numéro de version affiché en bas de la mini-appli (lu dans sw.js), pour que l'ami vérifie qu'il a
    la dernière (mise à jour automatique à chaque ouverture avec Internet ; sur iPhone, fermer complètement l'appli).
  · v136 (08/10) : CADRE DES BLISTERS À 4 COINS LIBRES (Mathias : « quand on bouge un coin, les autres ne doivent pas
    bouger » ; le cadre rectangle déplaçait forcément les deux coins voisins). Chaque coin se place seul (un bord tiré
    déplace ses deux coins, le milieu déplace tout) ; cadre croisé, aplati (angle < 20°) ou trop petit refusé. La photo
    est ensuite redressée en rectangle (perspective, comme un scanner de documents : Base._redresser). Cadre gardé
    { x, y, l, h, coins } (x, y, l, h = rectangle englobant, pour le reste du code) ; cadre mémorisé compris.
    Recadrage des figurines : rectangle (v135) inchangé.
  · v135 (08/10) : RECADRAGE REVU (demande de Mathias : photo plus grande, coins qui ne font pas bouger le reste).
    Blisters : plein écran sur fond sombre, photo la plus grande possible. Blisters et figurines (js/cadre_tactile.js) :
    le doigt attrape le coin le plus proche jusqu'à 60 px (avant : il fallait toucher le petit rond, sinon tout le
    cadre partait), ou le bord le plus proche jusqu'à 40 px (seul ce bord bouge), le milieu déplace tout le cadre ;
    loupe ×2,5 au-dessus du doigt pendant qu'on tire un coin ou un bord.
  · v134 (08/10) : INSTALLATION GUIDÉE DE LA MINI-APPLI (l'ami de Mathias n'arrivait pas à l'installer ; le mode
    d'emploi ne parlait que d'iPhone/Safari). contribuer.html détecte le cas : page ouverte dans Messenger, Facebook,
    Instagram, Gmail… -> « ouvrez dans Chrome/Safari » + bouton « Ouvrir dans Chrome » (Android) et « Copier le
    lien » ; Android -> bouton « 📲 Installer l'appli » (fenêtre d'installation du téléphone), sinon chemin du menu ⋮ ;
    iPhone -> Partager -> « Sur l'écran d'accueil ». Message à l'ami simplifié (brouillon Gmail du mode d'emploi).
  · v133 (08/10) : la LOUPE du clavier retire aussi le clavier (vérifié sur le téléphone de Mathias le 08/10 ; signalé par lui : sur son téléphone elle
    n'envoyait pas d'Entrée reconnue). Écoutés : Entrée sous toutes ses formes (avant les autres gestionnaires),
    événement « search », validation (change), et chaque champ de recherche placé dans un petit formulaire
    invisible (display: contents) que la loupe valide. js/clavier.js.
  · v132 (08/10) : CLAVIER DES RECHERCHES (demande de Mathias ; vérifié sur son téléphone le 08/10) : dans tous les champs de recherche (collection,
    customs, nouveautés, consulter, sets, blisters, mini-appli), touche « Rechercher » au clavier ; le clavier se
    retire à cette touche, après 1,5 s sans taper (les résultats s'affichent au fil de la frappe), en touchant un
    résultat ou en faisant défiler l'écran. Toucher le champ le fait revenir. js/clavier.js (appli et mini-appli).
  · v131 (07/10) : RECONNAISSANCE D'IMAGE (DINOv2) + COMBINAISON DES SIGNAUX + « PAS SÛR » EN PHOTOS. Modèle de
    vision DINOv2 (petite version, ONNX q8, 24 Mo, lib/vision/, récupéré par le workflow « Modèle de vision » car
    Hugging Face est bloqué pour Claude) : js/vision.js résume la photo (carré central 280 px) en 768 nombres,
    comparés aux références data/jb_vision.tsv (700 : photos du catalogue JB/BrickShell/archives/eBay + album ;
    outils/vision_jb.js) et data/jb_vision_commune.tsv (243 ; complété à chaque envoi et photo refaite,
    js/base_commune.js). Combinaison (Base._combiner) : image, décor, nom lu, figurine, premier choix de l'ancienne
    méthode, poids réglés par validation croisée sur les blisters de la base commune ; probabilité < 0,9 ->
    « 🤔 Probablement … » et les 3 plus probables en photos. 22 blisters de la base commune rattachés à leur fiche du
    catalogue (même figurine en double : « THE UNDEAD MERC » / « Undead Merc »…). Mesure (283 blisters) :
    JAMAIS VU (243) : 210 justes au premier choix (86 %, v130 : 56 %) ; 155 reconnus seuls + 67 en un geste parmi
    3 photos = 222 (91 %) ; 8 erreurs silencieuses (3 %) ; restent surtout les variantes au même nom imprimé
    sans photo de référence (World Record Clone en 5 couleurs, Silver/Golden DJ…). DÉJÀ CONNU (40) : 38 au premier
    choix (les 2 autres : même figurine sous deux fiches). Mode d'emploi de l'ami mis à jour (✅ / 🤔).
  · v130 (07/10) : LECTURE DU NOM PLUS TENACE + VERSO QUI DÉCIDE. Lecture : ne s'arrête plus au premier nom à peu
    près lu, seulement sur une lecture nette ; sinon relecture agrandie de 4 morceaux de la photo (Paddle), puis
    Tesseract ; textes de toutes les lectures cumulés ; une lettre de travers tolérée dès 5 lettres (2 dès 6).
    Verso : si le nom du recto n'était pas net et que vous ne l'avez pas changé, le texte du verso choisit la
    figurine (la mieux classée au recto parmi celles qu'il désigne). Mesure en deux cas (honnêtes, séparés) :
    blister JAMAIS VU (243, sa photo, son empreinte et son verso retirés) 124 -> 134 (55 %) ; figurine DÉJÀ CONNUE
    photographiée autrement (40 vraies autres photos) 37 -> 37 (92,5 %). Objectif de Mathias : plus de 90 % sans
    erreur -> étapes suivantes : modèle de vision DINOv2 (workflow « Modèle de vision », Hugging Face bloqué pour
    Claude), fusion des signaux réglée sur les 369 blisters, seuil de confiance avec choix en photos.
    Les 71 % annoncés en v129 mélangeaient les deux cas.
  · v129 (07/10) : RECONNAISSANCE AMÉLIORÉE, MESURÉE (présentation pour JB). Mesure sur les 369 blisters de la base
    commune, chacun re-photographié avec SA propre empreinte retirée (pire cas : blister jamais vu par la base) :
    59 % -> 71 % reconnus du premier coup (bien cadrés : 52 -> 66 %). Cause : un nom lu en entier sur l'étiquette du
    carton (« THE GOLDEN DJ ») ne pesait que +0,06 face au décor d'un voisin au même fond (« Silver DJ » 0,94). Nom lu
    net (tous ses mots sur une ligne qu'il occupe presque seul) : +0,2 ; nom plus long lu en entier (même sur deux
    lignes, « IMPERIAL / DONUTS IN SPACE ») prioritaire sur le nom court qu'il contient ; pas de bonus au nom court si
    une figurine au nom plus long qui le contient a un décor plus ressemblant. Outil : outils/presentation/taux_reconnaissance.js.
  · v128 (07/10) : SEULEMENT LES PHOTOS BIEN PRISES (Mathias : même figurine avec une photo de loin et une bonne, les
    deux montrées). Base._fusionnerPhotos, après la mesure des photos (les deux applis) : pour chaque figurine
    (nom + précision), la photo prise de loin (recto, verso) d'un exemplaire est remplacée par une bonne photo d'un
    autre exemplaire ; verso absent repris aussi quand le recto est remplacé. Sans bonne photo : gardée (repère 📏).
    Message « N photos prises de loin remplacées » ; base commune mise à jour (communeMaj, v127). Fiches : la photo une
    seule fois avec tous les n°.
  · v127 (07/10) : PHOTO REFAITE -> BASE COMMUNE MISE À JOUR (Mathias). La base commune garde une photo par figurine
    (la première envoyée) ; une photo refaite bien cadrée la remplace : empreintes du décor et de la figurine
    (data/jb_empreintes_commune.tsv, jb_empreintes_figurine.tsv, ligne du code BC-… remplacée) et photos du dépôt
    privé (album_photos/commune/BC-…). Repérage une fois (Memoire « commune-photos-reperees ») : figurine envoyée
    avec une photo prise de loin alors qu'un autre exemplaire a une bonne photo, ou photo refaite depuis l'envoi
    (empreinte différente). Ensuite chaque remplacement de photo (✏️, Ma collection) d'un blister déjà dans la base
    commune est reporté en arrière-plan (e.communeMaj) ; photo encore mal cadrée : en attente. Testé avec un faux GitHub.
  · v126 (07/10) : « MA COLLECTION » DANS LA MINI-APPLI DE L'AMI (Mathias). Onglets « 📷 Photographier » / « 📚 Ma
    collection » en haut de contribuer.html. Ma collection (js/ma_collection_ami.js) : ses blisters regroupés par
    figurine (nom imprimé + précision), présentés comme Ma collection de l'appli principale, sans onglets de thèmes :
    Liste ou Vignettes, ×N, n° triés, recherche (loupe : clavier refermé), résumé (figurines, blisters, 📏 à refaire,
    pas encore envoyés). Figurine touchée : photos (même photo montrée une fois, tous les n° dessous) et mêmes options
    que Mathias : changer les photos (fiche ✏️ : recto, verso, recadrage, n°, note), ajouter un exemplaire, retirer,
    corriger un n°, renommer. Les blisters restent ceux de la base (rien de copié, rien d'effacé).
  · v125 (07/10) : VÉRIFICATION AVANT D'ENVOYER LA MINI-APPLI À L'AMI. Passage v108 (version reçue le 02/10) -> v125
    testé dans le même navigateur : blisters gardés (photos, n°, verso), ajout, envoi .zip, n° en double refusé. Deux
    corrections : (1) série de scans : le recadrage automatique coupait parfois un morceau d'un scan déjà serré (forme
    anormale) : scan gardé entier (fausses alertes 📏 sur scans : 43 -> 1 sur 282) ; (2) la fin de la mesure des
    photos (v124) réaffichait la liste et refermait la fiche ✏️ ouverte (« Changer les photos » depuis Ma collection) :
    seul le bouton 📏 est mis à jour tant qu'une fiche est ouverte.
  · v124 (07/10) : PHOTOS PRISES DE LOIN OU MAL CADRÉES SIGNALÉES (Mathias). Un blister bien cadré a la forme de son
    carton (environ 4/3) ; photo bien plus large (> 1,53) ou en hauteur (< 0,85) : à refaire. Essai sur ses 369 rectos :
    les 70 prises de loin repérées, 2 fausses alertes. Ma base de blisters : bouton « 📏 Photos prises de loin ou mal
    cadrées (N) » (liste filtrée sur elles), repère rouge sur chaque blister concerné ; avertissement dès la prise de
    photo (recto, verso, remplacement, ajout depuis Ma collection). Forme mesurée une fois par photo, gardée avec le
    blister. Aussi dans la mini-appli de l'ami (contribuer.html).
  · v123 (07/10) : IDÉES NOTÉES PAR MATHIAS. Fiche d'une custom : exemplaires pris avec la même photo montrés une seule
    fois, tous leurs n° dessous ; n° triés dans l'ordre croissant partout dans Ma collection. « Ajouter un exemplaire »
    d'une custom déjà photographiée : fiche du recensement (même photo, « n° … nouveau ✔ » en vert) ; écran Custom : n°
    tapés marqués « nouveau ✔ » ou « déjà enregistré », plus de code CUS ni d'aperçu d'étiquette (code-barres) en mode
    collection, ni dans le message d'ajout. Liste des blisters ouverte sur une figurine (Ma collection, « Voir ou
    corriger ») : ses blisters seulement (« DONUTS IN SPACE » ne montre plus « IMPERIAL DONUTS IN SPACE »). Libellé
    « Changer la photo ». Recherche de Ma collection : la loupe du clavier referme le clavier. Surveillance des mails de
    JB arrêtée (Mathias s'en occupe).
  · v122 (03/10) : PLUS RIEN DES ÉTIQUETTES DANS MA COLLECTION (Mathias : les codes ne servent qu'à l'impression). Customs :
    plus de code CUS-… / JB-… (liste, vignettes, fiche, menu), seulement nom, ×n, n° ; « sans étiquette » retiré (gardé
    pour un fichier Excel). Figurines LEGO : leur référence BrickLink (SW0906…) reste, elle distingue les versions.
  · v121 (03/10) : fiche d'une custom : si vous avez vos photos de blister, ni la photo du site JB ni celles de l'album
    (Mathias : « il faut supprimer la photo de JB puisque j'ai les miennes ») ; sinon album, sinon photo JB.
  · v120 (03/10) : FICHE DE LA FIGURINE dans Ma collection (Mathias). Toucher une figurine, un set ou un objet ouvre une
    fenêtre : photos (les vôtres d'abord : blisters recto/verso de chaque exemplaire, puis votre album du dépôt privé,
    puis JB / BrickLink ; deux par ligne, une photo touchée passe en grand), puis toutes les options (📷 changer les
    photos -> fiche ✏️ du blister avec remplacement et recadrage, exemplaires, n°, renommer, page). Liste et vignettes :
    votre photo d'abord ; vos blisters retrouvés aussi par le code JB (nom imprimé différent) ; sinon votre photo d'album
    remplace celle du site JB. Collection._actionsFigurine, _ficheArticle2, Visionneuse (photos puis actions).
  · v119 (03/10) : RECADRAGE PARTOUT où une photo change (Mathias). Photo ajoutée depuis Ma collection (« 📷 Ajouter la
    photo du blister ») : « ✂️ Recadrer le recto » dans la fiche ✏️ de chaque blister créé (le recadrage vaut pour tous).
    Bouton « 📷 verso » de la liste : passe par le remplacement (recadrage auto, fiche ouverte, « ✂️ Recadrer le verso »,
    texte du verso lu). Base.modifier montre « Recadrer » pour toute photo remplacée ou ajoutée pendant la session.
  · v118 (03/10) : TOUT MODIFIER DEPUIS MA COLLECTION (Mathias). Custom touchée : « 📷 Photos du blister (recto, verso), n°,
    note » -> base de blisters filtrée sur la figurine (fiche ✏️ ouverte s'il n'y en a qu'un : remplacer, recadrer…) ;
    sans blister : « 📷 Ajouter la photo du blister » -> la photo choisie crée un blister par exemplaire (n°, code JB).
    Set / objet touché : « ✏️ Modifier » -> formulaire (nom, marque, état, boîte, notice, quantité, prix payé, prix
    fabricant, remarques ; objets : nom, type, état, quantité, remarques). demanderFormulaire (app.js). Retour dans Ma
    collection : photos et listes relues.
  · v117 (03/10) : photo de remplacement (recto ou verso) : MÊME RECADRAGE qu'à la prise (Mathias). Recadrage automatique
    (cadre mémorisé compris), puis « ✂️ Recadrer le recto / verso » dans la fiche : le cadre de recadrage s'y ouvre
    (déplacé dans la fiche, remis à sa place ensuite) avec « Garder ce cadre », « Garder la photo entière », « Garder ce
    cadre pour les photos suivantes ». Base._remplacements, _appliquerRemplacement, recadrer(quoi, rempl). Deux applis.
  · v116 (03/10) : NOTES EN MAJUSCULES partout (Mathias) : boutons rapides (SIGNÉE, COMIC CON, ÉDITION SPÉCIALE, ERREUR
    D'IMPRESSION, CADEAU, BRICKS OF MAZE), note tapée (ajout et modification), anciennes notes converties à l'ouverture
    de la base de blisters. Deux applis.
  · v115 (03/10) : REMPLACER LES PHOTOS d'un blister déjà recensé (Mathias : vieilles photos mal prises). « ✏️ Modifier »
    montre recto et verso, avec « 📷 Nouveau recto / verso » et « 🖼️ … depuis les photos » ; recadrage comme à la prise,
    enregistré tout de suite ; proposé aussi pour les autres exemplaires de la figurine qui avaient la même photo ;
    texte du nouveau verso relu. Base.remplacerPhoto (deux applis). Note rapide « 🧩 Bricks of Maze » (customiseur pour
    JB) ajoutée aux notes (deux applis).
  · v114 (03/10) : BUG D'AFFICHAGE base de blisters (capture de Mathias : nom écrit une lettre par ligne). Un blister sans
    verso avait 4 boutons à droite (📷 verso, ➕, ✏️, ✕) qui prenaient toute la largeur. Boutons sur leur propre ligne, sous
    le nom (.fiche-base, .fiche-actions) ; les deux applis.
  · v113 (03/10) : sets et objets dérivés de Ma collection RANGÉS PAR THÈME (Mathias) : petites puces « Tous, Star Wars,
    Super-héros… » (un thème touché = lui seul) ; « Tous » = sections titrées. Sets : themeDeCategorie (mêmes noms que les
    onglets de figurines), sinon thème BrickLink traduit (THEMES_SETS), « Autres marques » pour Youmko, Pantasy… Objets :
    d'après le nom (Vador -> Star Wars…), sinon leur type. Collection._themeArticle, _rangTheme.
  · v112 (03/10) : MA COLLECTION REGROUPE TOUT (Mathias) : puces « 🧱 Sets » et « 🔑 Objets dérivés » après les onglets de
    figurines (liste ou vignettes : photo BrickLink, nom, ×quantité, marque/code/année/état ; lien « 🔗 BrickLink » ou
    « 🔎 eBay.fr » pour les autres marques). Touchés : un exemplaire de plus / en retirer un / retirer (colonne Quantité,
    ou ligne vidée). La recherche trouve aussi sets et objets. Collection.ARTICLES, _chargerArticles, _detailsArticle.
  · v111 (03/10) : pastille ronde du camp (verte, rouge, grise) devant le nom des figurines Star Wars, dans les fiches et
    les vignettes de Ma collection (Collection._pastilleCamp ; info-bulle Gentil / Méchant / Zone grise).
  · v110 (03/10) : CAMPS STAR WARS CACHÉS (Mathias). Gentils (vert), Méchants (rouge), Zone grise réunis sous « Star Wars »
    dans Ma collection (onglets, fiches, recherche), les statistiques et les messages « déjà … exemplaires » (ongletAffiche,
    lieuExemplaire, sans « case » en mode base). Le camp reste enregistré (choisi tout seul à l'ajout, js/camps.js ; plus
    affiché) pour la couleur des étiquettes : planche depuis Impression = vrais onglets.
  · v109 (03/10) : MA COLLECTION (demandes de Mathias). Vues « Liste » et « Vignettes » (grille de photos) ; la
    « Planche » n'est plus là : écran Impression -> « 🗂️ Voir les étiquettes rangées en planches ». Plus de « case n°… »
    (collection dans l'appli) dans les menus, questions et messages. Photo touchée : photos en grand (vos blisters recto
    et verso, puis photo JB), lien vers la page, bouton « ✏️ Exemplaires, numéros, nom… » ; le reste de la fiche ouvre le
    menu. Photo de la fiche : la vôtre d'abord. Liens nommés comme « 🔎 eBay.de » : « 🔗 JB », « 🔗 BrickLink »,
    « 🔗 Brickshell ». REGROUPEMENT : n° seul à la fin du nom (« CUTIE POOL 36 », « 144 ») = numéro (3 chiffres au plus,
    pas une année) ; regrouperCustoms par nom (sans le lien) : les CUS-… prennent le code JB-… de la même figurine s'il
    existe, sinon le premier CUS-… (Junkyard Fatty CUS-010 + CUS-013 -> CUS-010, avec le lien eBay.de).
  · v108 (02/10) : PHOTOS COUCHÉES SUR IPHONE (Mathias : pas de rotation automatique sur la version iPhone). Safari ne
    tient pas toujours compte du sens EXIF dans createImageBitmap (les <img> oui). js/orientation.js (chargé en premier,
    deux applis) : test au démarrage avec une photo 4×2 « à tourner » ; si elle n'est pas tournée, chaque photo passe par
    une <img> redessinée sur un canvas. Sans effet sur Android/Chrome. Vérifié par simulation (EXIF ignoré) : 400×200 ->
    200×400 ; pas encore vu sur un vrai iPhone.
  · v107 (02/10) : étiquette retirée de l'écran « Ajoutée » (collection dans l'appli ; Mathias : elle ne sert qu'au
    moment d'imprimer, écran Impression). Gardée avec un fichier Excel.
  · v106 (02/10) : ÉCRAN « AJOUTÉE » REFAIT (demande de Mathias). Message court (« Ajoutée à votre collection
    (2 exemplaires en tout) ») ; fiche de la figurine comme dans Ma collection (photo, nom, ×n, code, n°), touchable
    (même menu) ; étiquette plus petite ; « 📚 Voir dans Ma collection » (sur son onglet). Collection dans l'appli : plus
    de « Enregistrer le fichier » ni de « case n°… » (ici et dans les fiches de Ma collection). Fichier Excel : inchangé.
  · v105 (02/10) : CUSTOMS NON REGROUPÉES (capture de Mathias : trois « The Emerald Marksman » en CUS-060, 061, 062).
    codeCustom donnait un nouveau CUS-… à chaque exemplaire d'une figurine hors catalogue JB (lien = recherche eBay.de).
    Il reprend maintenant le code d'une figurine déjà présente au même lien et au même nom sans le n° (cleCustom) ;
    les n° en double sont donc aussi repérés. regrouperCustoms (à chaque relecture, collection dans l'appli) recode les
    exemplaires déjà enregistrés sous le premier code (BaseCollection.figRecoder). Variantes de couleur (nom différent,
    ex. World Record Clone Rouge / Orange) : codes distincts.
  · v104 (02/10) : BUG « Ajouter à ma collection ⏳ » bloqué (capture de Mathias) : la lecture du verso (v103) occupait
    le téléphone sans laisser passer les appuis (PaddleOCR enchaîne les lignes sans rendre la main). Pause entre deux
    lignes (lecture_paddle.js) ; une lecture à la fois (file d'attente Paddle.lignes) ; blister ajouté avant la fin de
    la lecture : il reçoit son texte ensuite. Occupe : un bouton touché pendant un autre travail restait grisé ⏳ pour
    toujours (seul le dernier était dégrisé) ; tous les boutons grisés sont maintenant dégrisés.
  · v103 (02/10) : TEXTE DU VERSO POUR RECONNAÎTRE LA FIGURINE (idée de Mathias : au dos, certaines figurines ont leur
    histoire, « THE FORMIDABLE DARK-FORCE WARLORD DARTH DONUT… »). Le verso est lu (PaddleOCR) après le recto ; mentions
    communes retirées (texteVerso : choking hazard, not an official LEGO product, logo JB…) ; comparaison par morceaux de
    4 lettres pondérés (la lecture colle des mots). « 📜 Le texte du verso confirme : X » ou « ce serait plutôt : [X] »
    (bouton). Texte générique (Whatnot, même texte sur plus de 3 figurines) : rien. Même histoire pour 2-3 variantes
    (ex. Homer) : toutes proposées. data/jb_versos.tsv (public : code de la figurine, texte imprimé) : 73 textes / 71
    figurines, tirés des 159 versos de la base commune ; essai « un verso retiré » : 107 justes, 0 faux, 16 sans
    réponse (génériques ou variantes). Envoi base commune : texte du verso ajouté (lu au besoin), aussi pour une
    figurine déjà connue sans texte. Export .zip : colonne texte_verso. Bouton « Passer » du verso supprimé (deux
    applis) : verso demandé à chaque blister, confirmation pour ajouter sans verso.
  · v102 (02/10) : IMPORT DE SCANS EN PDF (scanner de documents de l'iPhone, app Fichiers ou Notes : il enregistre en PDF,
    pas dans Photos). Base._pagesDesPdf : chaque page -> photo JPEG (2000 px), dans l'ordre des pages ; pdf.js 4.10.38
    (Mozilla, build « legacy » pour Safari) dans lib/pdfjs, chargé seulement au premier PDF. Champs galerie et série :
    accept image/*,application/pdf ; un PDF choisi comme « photo déjà prise » part en série. Mail de l'ami : conseil de
    tout scanner avec l'app Fichiers, puis « Importer une série de scans ».
  · v101 (02/10) : IMPORT D'UNE SÉRIE DE SCANS (Mathias scanne tous ses blisters avec le scanner de documents du Samsung,
    bien meilleur : coins, redressement, reflets, couleurs). « 🗂️ Importer une série de scans » (les deux applis) : photos
    rangées par date de prise, recto+verso alternés ou rectos seuls (question), présentées une par une ; après « Ajouter »
    (ou « pas à moi ») le suivant s'affiche ; « Passer ce blister », « Arrêter la série ». Aussi : « 🖼️ Choisir une photo
    déjà prise » ajouté à l'appli principale, « 🖼️ Choisir le verso dans les photos » (les deux).
  · v100 (02/10) : CADRE MÉMORISÉ pour les photos de blisters en série (les deux applis). Détection auto du bord de la
    coque transparente sur carton essayée sur la photo d'origine de Mathias (carton sur table grise, support noir) : bords
    du plastique trop discrets dans les fibres du carton, même plus sensible -> abandonnée. Recadrage manuel : case
    « 📌 Garder ce cadre pour les photos suivantes » (recto et verso séparés, Memoire « cadres_memorises ») ; _preparer
    l'applique au lieu du cadrage auto ; mention « 📌 Cadre mémorisé… Oublier ce cadre » sous le bouton Photographier.
    Consigne : tracer le cadre sur les bords arrondis extérieurs de la coque (Mathias, choix B).
  · v99 (02/10) : resserrage v98 DÉSACTIVÉ (Mathias : garder le blister entier, bords transparents compris ; couper
    seulement le fond extérieur). Retour au cadre v97 (_cadreBlister). À faire : se caler sur le bord extérieur de la coque
    transparente, par différence avec le fond (s'inspirer du cadrage du Samsung S26 Ultra, photo à recevoir) ; puis, si ça
    marche, ajouter au mail de l'ami le conseil du bout de carton derrière le blister.
  · v98 (02/10) : RESSERRAGE SUR LE CARTON IMPRIMÉ (photo de Mathias sur fond carton : la coque transparente laissait voir le
    carton du fond tout autour). Base._resserrer : dans le cadre du blister, de chaque côté, trait droit et net où l'on
    passe du fond (dehors) au carton imprimé (dedans) ; 30 % max en haut (attache), 20 % ailleurs ; gardé seulement si les
    4 côtés sont nets. Fonds variés 0,78 -> 0,85, unis 0,82 -> 0,94, carton 0,82 -> 0,89 ; 24/41 photos réelles resserrées,
    aucune coupée (limite à 30 % partout : le « Vegan BBQ Luke » était coupé). Conseil de prise de vue donné : fond uni,
    mat, moyen (gris ou carton), 2-3 cm de marge, de face, sans flash.
  · v97 (02/10) : RECADRAGE QUEL QUE SOIT LE FOND (Mathias : « il faut qu'il se cadre par rapport au bord du blister »).
    Banc d'essai : 24 blisters de l'album collés sur 6 fonds (plaque perforée, bois, carreaux, cyan, sombre, journal) +
    41 photos réelles. Essayés et écartés : traits droits (bords du rectangle) seuls, puis en couleur (cyan réglé, mais
    trompés par les fonds à motifs) ; « motif » seul (coupe le bas du carton sur les vraies photos). Retenu :
    _cadreFondUni (ex-_cadreAuto v96) d'abord ; _cadreMotif (fond appris sur le pourtour par carrés de 8 px : couleur,
    contraste, quarts ; seuil = variété du fond ; extension aux carrés voisins à 65 % du seuil ; proportions 0,8-2,2)
    seulement s'il échoue : pas de cadre, cadre à côté (recouvrement < 50 %), ou plus de 1,8 fois plus grand avec une
    bande en plus faite de fond. Carreaux : 0 -> 0,66-0,85 ; réelles : inchangées sauf 6 photos gardées entières, cadrées.
  · v96 (02/10) : RECADRAGE AUTOMATIQUE des blisters amélioré (photo de Mathias sur plaque perforée : photo entière gardée).
    Base._cadreAuto combine _cadreContraste (ancienne méthode) et _cadreZone (masque débruité 5×5 + plus grande zone d'un
    seul tenant) : l'ancienne gardée si elle englobe la nouvelle sans dépasser 1,6 fois sa surface. Essai sur la plaque +
    40 photos de l'album : plaque recadrée, 9 photos sans cadre au lieu de 19 (déjà serrées), aucune régression vue.
    Vaut aussi pour la mini-appli de l'ami (même js/base.js).
  · v95 (02/10) : doublons retirés des listes publiques de la base commune (data/jb_commune.tsv, jb_empreintes_commune.tsv,
    jb_empreintes_figurine.tsv : 290 -> 164 blisters, 1 par figurine, de préférence avec verso ; rattachement au catalogue
    recopié s'il était sur un doublon). Photos et lignes du dépôt privé (album_photos/commune.tsv, n° des exemplaires)
    gardées. catalogue_jb.js : le nom imprimé d'un blister rattaché à une autre fiche devient un autre nom de cette fiche
    (nomsImprimes : lecture du carton et recherche) ; avant, il n'était gardé que par hasard, via un doublon non rattaché.
  · v94 (02/10) : BASE COMMUNE, UNE PHOTO PAR FIGURINE (Mathias : plusieurs exemplaires d'un blister ne changent que le n°).
    BaseCommune.envoyer regroupe par nom + précision : un seul exemplaire envoyé (de préférence avec verso), les autres
    marqués traités ; figurine déjà dans data/jb_commune.tsv : rien d'envoyé. Vaut aussi pour l'import d'un envoi d'ami.
    Constat : 290 blisters envoyés pour 165 figurines (Darth Donut ×11) -> doublons retirés des listes publiques.
  · v93 (02/10) : LIVRES avec figurine exclusive (encyclopédies, dictionnaires visuels… : 549 livres au catalogue des
    sets Rebrickable, thème « Books », dont 443 avec figurine) : ajoutés par la tuile Set (recherche en français :
    « encyclopédie », « dictionnaire visuel » traduits). BrickLink les range dans ses « Books » sous d'autres numéros : sans
    prix du livre, la valeur compte au moins ses figurines une à une (avant : article « sans prix », figurine perdue).
  · v92 (02/10) : autres marques = SETS seulement (Mathias : leurs figurines sont des accessoires) : choix du type retiré.
    Youmko, Pantasy, Reobrix en tête de liste (Mathias a Youmko YM011 Nazgûl/Fell Beast et YM014 Oscorp Tower ; une tour de
    l'horloge de Retour vers le futur et l'église des Simpsons, marque à confirmer : Reobrix 55012 « The Clock Tower » ?).
    Colonne O « Prix fabricant (€) » saisie à l'ajout : coût de rachat tant que le fabricant vend le set (comme le prix
    LEGO), occasion d'après eBay.fr. Relevé automatique impossible : sonde du 02/10 (dépôt privé), youmko.com sans prix
    lisible, reobrix.com en USD seulement (règle : prix publics français uniquement).
  · v91 (02/10) : AUTRES MARQUES (demande de Mathias, pistes 1 et 2 de l'étude du 02/10 : Merlins Bricks SetDB couvre 92
    marques mais en site web, sans API connue). Écran Set : choix de la marque (LEGO par défaut, liste MARQUES_ALTERNATIVES,
    « Autre marque… ») ; hors LEGO : saisie à la main (type, numéro, nom, pièces, année, prix payé, état/boîte/notice).
    Onglet Sets : colonnes M « Marque » et N « Prix payé (€) ». Valeur : type MARQUE, hors liste BrickLink ; rachat = prix du
    milieu des annonces eBay.fr (2 au moins, prix_ebay_marques.tsv du dépôt privé), occasion 85 % ; sinon prix payé.
    outils/prix_ebay_marques.py (EBAY_FR, marque + numéro dans le titre, « COB2661 » accepté ; essai 9/9 articles réels
    trouvés). Lancé par prix.yml du dépôt privé si les secrets EBAY_CLIENT_ID / EBAY_CLIENT_SECRET y sont (sinon sauté).
    Aussi : étiquettes (lien eBay.fr, couleur bleue), exports (marque, prix payé), dossier assureur, statistiques.
  · v90 (02/10) : CORRECTION tuile Valeur grisée ⏳ et intouchable (js/occupe.js : le suivi du relevé des prix
    interroge GitHub en continu, le travail ne semblait jamais fini). Le bouton grisé est libéré au changement d'écran
    (Occupe.liberer dans afficher) et au plus tard 45 s après l'appui.
  · v89 (02/10) : ajout en masse : tout est coché au départ (même hors catalogue), sauf « déjà dans votre collection » ;
    boutons « ✅ Tout cocher » / « Tout décocher » (demande de Mathias : décocher plutôt que cocher une par une).
  · v88 (02/10) : « 📷 Lire les codes sur des photos (vitrines, présentoirs…) » dans « Plusieurs figurines d'un coup » :
    PaddleOCR par morceaux de 1100 px (chevauchement 220 ; 800 et 1280 testés, pas mieux), codes reconnus seulement s'ils
    sont au catalogue (confusions O/0, I/1, S/5… corrigées, suffixes « as »/« s »), dédoublonnés entre photos, ajoutés à la
    liste à vérifier. Essai sur les 4 photos de l'armurerie Iron Man : 60 justes sur 63 en 44 s (SH0254 et SH0612 de biais
    manqués, SH0072a lu SH0072), 1 lecture en trop (SH0223, étiquette coupée).
  · v87 (02/10) : AJOUT EN MASSE — écran « ⌨️ Saisir un code » → « 📋 Plusieurs figurines d'un coup » : codes collés
    (espaces, virgules, retours), liste vérifiée (nom catalogue, onglet proposé comme pour un ajout seul, « déjà N dans
    votre collection » et inconnues décochées), puis un bouton « ➕ Ajouter N figurines ». Un code répété = N exemplaires.
    Testé sur une copie de la collection de Mathias avec ses 63 Iron Man (photos de sa vitrine) : 53 ajoutées, 10 déjà là.
  · Site (02/10) : depuis le renommage, GitHub ne relançait plus la publication Pages après un envoi -> tâche
    .github/workflows/site.yml (à chaque envoi sur main : POST pages/builds avec GITHUB_TOKEN). Testée : OK.
  · v86 (02/10) : CORRECTION mini-appli de l'ami (contribuer.html) : son Memoire.ecrire ne renvoyait rien, alors que
    Base.ajouter (depuis v77) attend true -> « 📚 Ajouter à ma collection » affichait toujours « n'a pas pu être
    enregistré ». Aligné sur js/app.js (true/false + message). Vérif complète avant envoi à l'ami : photo recto/verso,
    lecture du nom, n°, ajout, « pas à moi », export .zip, import « D'un ami » dans l'appli principale (envoi GitHub
    simulé : bons dépôts briquotheque / briquotheque-prive), affichage iPhone. Aucun lien cassé.
  · v85 (02/10) : ARBORESCENCE des menus à gauche sur grand écran (≥ 1000 px : ordinateur, tablette en largeur),
    js/arborescence.js. Construite à partir de l'accueil (rubriques, gros boutons, tuiles, puis Outils) : un menu ajouté
    à l'accueil y apparaît seul ; un clic « touche » le bouton de l'accueil. Écran affiché mis en évidence. Cachée sur
    téléphone et sur l'écran de départ.
  · v84 (02/10) : flèche ← dans le bandeau rouge (hors accueil) = retour à l'écran précédent, et le nom
    « Briquothèque » du bandeau ramène à l'accueil : sur ordinateur (et iPhone), pas de bouton retour du téléphone, et
    plusieurs écrans (Valeur, Assurance, custom, objet…) n'avaient pas de bouton « Retour ».
  · v82 (02/10) : HARMONISATION DÉFINITIVE des noms (demande de Mathias) — tout s'appelle « briquotheque » :
    dépôts matd-prog/briquotheque (public, adresse https://matd-prog.github.io/briquotheque/) et
    matd-prog/briquotheque-prive (privé) ; bases du téléphone « briquotheque-memoire » et « briquotheque-collection »
    (recopie automatique des anciennes « etiquettes-figurines » / « figotheque », gardées en secours) ; icônes
    briquotheque-*.png ; cache « briquotheque-vNN » = VERSION_APPLI (app.js). Mode « fichier Excel » SUPPRIMÉ (Excel ne
    sert plus qu'à l'export et à la reprise d'une collection). Ancien dépôt « etiquettes_figurines » recréé en simple
    redirection vers la nouvelle adresse (QR codes eBay des étiquettes déjà imprimées : …/ebay.html?q=…) : en
    place le 02/10 (index.html, 404.html, sw.js qui se désinscrit ; Pages activé sur main).
  · Mises à jour en un bouton (v74) : BrickLink exige désormais une connexion compte LEGO (identity.lego.com, protection
    anti-robots) pour télécharger son catalogue -> abandon du téléchargement. Nouvelles figurines par l'API BrickLink
    (mêmes clés que les prix) : catalogue_bricklink.py + .github/workflows/catalogue.yml du DÉPÔT PRIVÉ (mensuel le 2,
    ou bouton) : subsets des sets récents avec figurines (data/sets.tsv) -> ajoute à data/figurines.tsv du dépôt public.
    Secret à créer par Mathias dans le dépôt privé : JETON_DEPOT_PUBLIC (jeton avec écriture sur briquotheque).
    Appli : catalogue = le plus récent entre data/figurines.tsv et l'import manuel ; Outils « 🔄 Tout mettre à jour »
    (relit tout, lance catalogue.yml) ; import manuel replié en secours ; rappel seulement si catalogue > 2 mois.
  À FAIRE : document de plan « version diffusable » (synchro cloud Supabase, comptes, conditions Brickognize/BrickLink,
  valeur sans dépôt privé, nom/marque), alertes, multi-figurines par photo, vitrine partagée.
- Liste de souhaits (01/10, cache v63, js/souhaits.js) : onglet Excel « Souhaits » (Type, Code, Nom, Thème / série,
  Sortie, Remarques, Ajouté le). Bouton « ⭐ Ajouter à ma liste de souhaits » sur les fiches figurine, custom, set et
  objet ; tuile « ⭐ Ma liste de souhaits » (rubrique Ma collection) : souhaits par type, date de sortie (nouveautés),
  ✅ si déjà dans la collection ; toucher = « Je l'ai : ajouter » (écran d'ajout prérempli) ou « Retirer ».
  Nouveautés : ⭐ sur les articles souhaités et sur les puces de mois, bandeau « ⭐ N article(s) de votre liste de
  souhaits sort(ent) ce mois-ci ». Les sets annoncés absents du catalogue Rebrickable (Brickset seul) ont maintenant
  une fiche (avant : « Aucun set dans le catalogue »).
- Accueil réorganisé (01/10, cache v59, vérifié sur le téléphone) : « ➕ Ajouter à ma collection » (gros boutons Photographier une figurine /
  un blister JB, puis photo déjà prise, nom, code, custom, set, objet dérivé), « 📖 Ma collection » (collection,
  valeur, achats, assureur), « 🔎 Découvrir » (nouveautés, catalogue JB, base de blisters) ; Outils inchangés.
- Écran « 🆕 Nouveautés » refait (01/10, cache v58, js/ecran_nouveautes.js) : onglets 📅 Récentes (apparues depuis
  45 jours ; sinon annonces de l'an prochain), 🧍 Figurines, 🧱 Sets, 🔑 Objets ; puces par thème (minifigs à
  collectionner par série d'abord ; « 🏪 Boutiques LEGO (BAM…) » ; objets par sorte : porte-clés, magnets…) ; filtre ;
  ✅ si déjà dans la collection ; toucher -> écran d'ajout (figurine), « Ajouter un set », « Objet dérivé ».
  L'ancien bouton « séries récentes » de l'écran de résultat d'une photo reste (action nouveautes-series).
  Étape 2 en attente : clé Brickset (secret GitHub BRICKSET_KEY, à créer par l'utilisateur) pour le mois de sortie
  exact par thème ; BAM du mois : vérifier si Brickset les liste, sinon un site d'actualités.
- Base commune de reconnaissance (01/10, cache v53, demande de l'utilisateur) : la base de blisters sert à reconnaître
  TOUS les blisters (les miens, ceux de l'ami, des collectionneurs), possédés ou non ; la collection (Excel) = ce que
  je possède seulement ; celle de l'ami reste dans son appli. js/base_commune.js :
  - à chaque photo, « 📚 Je l'ai » (comme avant, n°, Excel) ou « 🌐 Je ne l'ai pas : seulement pour la base commune »
    (entrée possede:false, sans n°, hors collection et hors comptes) ; les deux applis ;
  - appli principale (jeton GitHub) : envoi automatique après chaque ajout, sinon bouton « 🌐 Envoyer à la base
    commune » : photos -> dépôt privé album_photos/commune/BC-…_recto/_verso.jpg + album_photos/commune.tsv (n°, qui,
    date) ; noms et empreintes -> dépôt public data/jb_commune.tsv et data/jb_empreintes_commune.tsv (pas de photo) ;
  - CatalogueJB : source « commune » (codes BC-…), rattachée à la figurine connue (code reconnu, ou même nom) sinon
    nouvelle fiche ; ses empreintes servent à la comparaison du décor (essai : le même blister ressort en tête à 1,00) ;
    Consulter montre leurs photos (jeton) ;
  - « 📥 Ajouter un envoi de blisters (.zip) » : « De moi » (retour dans ma base) ou « D'un ami » (base commune seulement).
  ⚠️ Le jeton GitHub doit aussi donner accès au dépôt public (Contents : lecture et écriture), sinon message avec la
  marche à suivre ; les photos partent quand même dans le dépôt privé.
  Fait le 01/10 : jeton étendu au dépôt public par l'utilisateur, premier envoi : 286 blisters (441 photos dans le
  dépôt privé) ; 261 rattachés à une figurine connue, 25 sans code -> 15 nouvelles fiches « Base commune » ; 147 fiches
  du catalogue ont maintenant aussi les photos de l'utilisateur comme référence pour la comparaison du décor.
- Reconnaissance nom + décor (01/10, cache v54) : chaque blister du catalogue reçoit la ressemblance de son décor
  (0,8 sans empreinte) + 0,06 si son nom a été lu ; même nom imprimé (ex. 3 « SPECIAL WHATNOT FIGURE 2025 »
  de la base commune) : le décor départage, la précision est remplie (« DARK VADOR CHROME ORANGE »). Blisters à
  moins de 0,03 du premier (même nom lu, ou décor seul si rien n'est lu) : montrés en photos « 👀 se ressemblent
  presque autant ». Base commune : nom imprimé et précision séparés (decouperNomBlister, js/catalogue_jb.js).
  Essai sur la capture de l'utilisateur (Dark Vador chrome orange) : trouvé en premier, les 2 autres à côté.
  Sur le téléphone, « droïde or » passait devant (écart 0,005 sur le blister entier). Ajout (cache v55) : empreinte de
  la figurine seule au centre du blister, fond retiré (empreinteCentreBlister, js/empreinte.js) ->
  data/jb_empreintes_figurine.tsv (455 photos de la base commune et de l'album, calculées le 01/10 ; ajoutée à chaque
  envoi à la base commune) ; CatalogueJB.departager reclasse les blisters « très proches ». Essai : Vador doré 0,765,
  droïde 0,711, noir 0,579 (avant : 0,902 / 0,897 / 0,889).
  Confirmé par l'utilisateur : le droïde doré est la « Multicolored Protocol Droid » (autre carton, doré) ; les 2
  « DROÏDE OR » sont la Special Whatnot Figure 2025 au droïde argenté, mains grises (rareté) -> corrigés dans
  data/jb_commune.tsv et album_photos/commune.tsv (rattachés à ALB-SPECIAL-WHATNOT-FIGURE-2025). 4e version vue sur
  eBay (droïde bronze mat), annonce titrée « Let's Go! » (slogan du carton) -> renommée par data/jb_exclus.tsv, nouvelle
  action « nom=… » (cache v56). Précision séparée aussi pour l'album et eBay (« … (droïde argent) »).
- « Ma base de blisters » renommée « Base de blisters » (commune à tous, demande de l'utilisateur, cache v56) ;
  bouton « 📚 Je l'ai : ajouter à ma collection ».
- Ma collection regroupée (01/10, cache v52) : une ligne par figurine (même onglet et même code ; customs : même nom
  sans le n°) avec ×N, les n° et les cases. Toucher -> menu : ➕ Ajouter un exemplaire, ➖ Retirer un exemplaire (choix
  de l'exemplaire, confirmation ; retirerFigurine dans js/xlsx.js : nom, code, lien, étiquette effacés, ligne de la
  Table camps vidée, la case redevient libre), ✏️ Corriger un numéro (customs ; renommerFigurine : case et Table
  camps), 🔤 Renommer (tous les exemplaires ; customs : chacun garde son n° ; cache v57), 🔗 page. Planche : même menu. Le n° corrigé ici ne change pas la base de blisters (sens inverse seulement).
- Doublons du catalogue JB fusionnés (01/10, cache v51) : même nom dans plusieurs listes (surtout eBay.de + photos de
  collectionneurs, ex. Black Krrsantan, Shiny Dark Lord) -> une seule fiche (celle de la première liste), les autres
  codes en alias (CatalogueJB.codes : photos d'album, empreintes, trouver). 580 -> 560 fiches. Les doublons entre deux
  articles JB (JB-… et JB-…, ex. Schwabenstein 2024 Pirate) sont gardés : peut-être deux éditions.
- Exemplaire de plus sans reprendre de photo (01/10, cache v47) :
  - Ma collection : toucher une figurine (liste ou planche) -> menu « ➕ Ajouter un exemplaire » / « 🔗 Voir… »
    (choisirAction, exemplaireEnPlus dans js/app.js) : écran de résultat avec le même onglet et le même nom ;
    customs : écran Custom avec la même figurine (série reprise), il reste le n° à taper ;
  - base de blisters (les deux applis) : bouton ➕ sur chaque blister, et dans la visionneuse (Base.exemplaireDe) :
    mêmes photos, nom, précision, série, note ; seul le n° à taper.

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

- Enregistrement du fichier Excel simplifié (29/09, à tester sur le téléphone) : bouton « 💾 Enregistrer »
  avec la fenêtre d'enregistrement du téléphone (Google Drive compris) la 1re fois, puis un seul appui
  (même fichier remplacé ; Drive garde les versions). Emplacement oublié si on ouvre un autre fichier.
  Visible seulement si le navigateur le permet (showSaveFilePicker) ; sinon, ancienne méthode
  (télécharger puis importer dans Drive). Si le téléphone ne le permet pas : connexion directe à
  Google Drive (il faudra créer un identifiant dans la console Google Cloud).
- Base commune des blisters JB (29/09, à tester) : écran « 📚 Base commune » (accueil, et écran
  d'ouverture sans fichier Excel) et mini-appli pour l'ami de l'utilisateur :
  https://matd-prog.github.io/briquotheque/contribuer.html (« Blisters JB », sans Excel ni
  étiquettes). Photo -> nom lu (vérifié/corrigé) -> « Ajouter à la base » ; série limitée lue
  (LIMITED TO / OF). « Exporter » : blisters_JB_<date>.zip (base.tsv + photos/ réduites à 1000 px).
  Reste à faire : outil d'intégration des .zip reçus (-> data/jb_perso.tsv + photos + empreintes).
  L'utilisateur a ~150 blisters, son ami ~300 (beaucoup d'anciennes éditions). L'utilisateur a aussi
  écrit à JB Spielwaren pour demander une liste officielle.
- Archives du web : Internet Archive refuse l'environnement cloud (429). L'outil outils/archive_jb.py
  tourne sur GitHub Actions (.github/workflows/archive_jb.yml, « Run workflow ») : ça marche (1er
  essai : 261 figurines vues dans 20 copies), avec des refus de connexion passagers (nouveaux essais).

- Nouvelles séries pas encore reconnues en photo par Brickognize (ex. minifigures Shrek 2026, pourtant
  dans le catalogue BrickLink : colshr01-12) : « Chercher par nom » montre, case vide, les séries
  récentes (cette année et l'an dernier ; minifigs à collectionner d'abord) ; une série touchée montre
  ses figurines avec photo. Bouton « 🆕 Nouveautés » sur l'écran de résultat d'une photo. (29/09)
  Confirmé sur le téléphone le 29/09 (minifigs Shrek).

- Sets LEGO (29/09, à tester) : bouton « 🧱 Ajouter un set LEGO » (accueil) -> numéro -> fiche (nom, année,
  thème, pièces, photo BrickLink), état, boîte, notice -> ligne dans l'onglet « Sets » du fichier Excel
  (créé au premier set ; colonnes Numéro, Nom, Année, Thème, Pièces, État, Boîte, Notice, Figurines,
  Ajouté le). Les figurines du set cochées sont ajoutées d'un coup à la collection (mêmes onglets et
  étiquettes qu'une figurine seule). Catalogue : data/sets.tsv (20 090 sets) et data/sets_figurines.tsv,
  faits par outils/sets_rebrickable.py (fichiers publics Rebrickable) sur GitHub (.github/workflows/
  sets.yml, le 2 de chaque mois). Rebrickable n'a pas les codes BrickLink des figurines : rapprochés par
  le nom (même personnage, même époque, un code par figurine d'un set) ; « à vérifier » sous 0,6 (2 figurines de sets sur 3 au-dessus).
  Choix de l'utilisateur : même fichier Excel, identification par numéro, pas d'étiquettes pour les sets.
- Variantes (29/09) : même figurine, seule la tête change (couleur de peau, homme/femme, expression),
  invisible sous un casque : l'écran de résultat d'une photo propose « 🪖 N autres versions du même
  personnage » ; dans un set, menu des variantes pour chaque figurine. (Catalogue.variantes)
- Mini-appli « Blisters JB » (contribuer.html) finalisée pour l'iPhone de l'ami (29/09) : envoi du .zip par le
  menu Partager (navigator.share : Messages, WhatsApp, Mail, AirDrop, Fichiers ; téléchargement sinon), bouton
  « Choisir une photo déjà prise », bandeau « Sur l'écran d'accueil » dans Safari (sinon Safari peut effacer les
  données après 7 jours sans visite), navigator.storage.persist(). Testé en iPhone simulé (Chromium) ; à
  confirmer sur un vrai iPhone (lecture PaddleOCR en WASM, mémoire).

## Valeur de la collection (29/09/2026)

- But à terme : gestionnaire de collection commercialisable (valeur, dossier pour assureurs).
  Choix de l'utilisateur : prix = ventes BrickLink des 6 derniers mois (pas les prix affichés).
- Dépôt PRIVÉ matd-prog/briquotheque-prive (la collection et les prix ne vont JAMAIS dans le dépôt public) :
  codes.txt (MINIFIG / SET / BOX / GEAR + code) -> action « Prix BrickLink » (prix.yml : le 3 du mois, ou lancée
  par l'appli ; une seule à la fois, relevés fusionnés à l'enregistrement) -> prix_bricklink.py (API BrickLink,
  OAuth1, 4 secrets BRICKLINK_*) -> prix.tsv (médiane pondérée par la quantité, moyenne, ventes, mini, maxi,
  neuf et occasion ; pas redemandé avant 25 jours). Limite BrickLink : 5 000 appels/jour (2 par article).
- Appli : case « 💶 Valeur » (js/valeur.js). Jeton GitHub (github_pat_, limité au dépôt privé) collé une fois,
  gardé dans le téléphone (Memoire « jeton-github »). « Envoyer ma liste » dépose codes.txt et lance l'action ;
  « Actualiser » lit prix.tsv. Règles : figurines d'occasion ; sets neufs si « Neuf scellé » ; boîte seule =
  prix BrickLink des boîtes vides (ORIGINAL_BOX) ; set « Sans figurines » = set moins ses figurines ; figurine
  de série (71005-1…) = prix de la figurine ; objets dérivés (GEAR) neufs si notés neufs ; codes 850353
  (porte-clés) et 30612-1 rangés dans les onglets de figurines -> GEAR / SET ; aucun prix dans l'état voulu
  -> prix de l'autre état. Affichage : total, par onglet, puis les plus précieux par catégorie (figurines,
  sets, objets dérivés, boîtes). Premier relevé réel fait le 29/09 (836 articles).
- Import d'une liste de sets (Sets -> « 📥 Importer une liste ») : js/import_sets.js ; testé sur Collection_Sets.xlsx
  de l'utilisateur (254 lignes -> 278 articles, tout reconnu). Colonnes Quantité et Remarques (rangement : Carton 1…)
  ajoutées à l'onglet Sets ; états « Sans figurines » et « Boîte seule (vide) ».
- Précisé par l'utilisateur (29/09) : tous ses sets sont montés, complets, avec boîte et notice (pas de boîte sans
  set ; « sans fig » = figurines rangées avec les autres). Réimporter la liste corrige les états et vide les lignes
  en double. Valeur : une figurine des onglets de figurines n'est pas recomptée dans son set (retirée du prix du set)
  ni comme figurine de série de l'onglet Sets. Un seul fichier Excel : tout est dans le fichier principal
  (Collection_Sets.xlsx ne sert plus qu'à l'import).
- Valeur principale = coût de rachat à neuf (demande de l'utilisateur, pour l'assureur, 29/09) : prix des ventes
  neuves BrickLink, en Europe (region=europe), TVA comprise (vat=Y), monde entier s'il n'y a eu aucune vente en
  Europe ; prix LEGO pour les sets encore vendus ; prix d'occasion s'il n'y a eu aucune vente neuve. Valeur
  d'occasion affichée en complément (écran Valeur, colonne du dossier assureur). prix.tsv : colonnes neuf_zone et
  occasion_zone (europe / monde). Pendant le relevé, prix provisoires toutes les 10 s sur la branche
  releve-en-cours (commit sans historique) : total en direct dans l'appli, article par article (cadran retiré le 30/09 à la demande de l'utilisateur : inutile).
- Méthode (demandée par l'utilisateur le 29/09) : figurines d'un set monté estimées une à une (prix du marché
  BrickLink), plus le reste du set = prix du set (LEGO si encore vendu, sinon BrickLink) moins ses figurines, jamais
  moins de 50 % du prix LEGO d'origine (PART_RESTE_SET, 30 % avant le 30/09), ni moins de 85 % du prix eBay.de du set sans figurines (prix_ebay_sets.tsv, outils/prix_ebay_sets.py, 2 annonces au moins) ; set encore vendu par LEGO : prix LEGO, sans minimum. Figurine déjà dans les onglets de figurines :
  comptée là, pas dans le set. Sur 48 sets chiffrés, 10 avaient des figurines valant plus que le set.
- Customs JB (30/09) : prix de vente JB (data/jb.tsv, colonne prix, relevée par outils/catalogue_jb.py) si encore en
  vente, sinon prix d'achat (achats.tsv du dépôt privé, relevé dans Gmail avec l'accord de l'utilisateur : confirmations
  JB et reçus PayPal JB, prix HT × 1,2 ; les reçus PayPal Whatnot n'ont que le montant), rapproché par le nom. Piste
  suivante : prix des annonces eBay.de (indicatif) pour les customs retirées sans reçu.
- Whatnot (30/09) : export « order report » du site (1 146 commandes, 23 902,81 €) -> whatnot_commandes.csv et
  import_whatnot.py (dépôt privé) -> achats.tsv, prix = total payé (port et taxes compris). ~440 « lots custom » au nom
  générique (figurine dévoilée en direct) : leur médiane (~23 €) sert de prix pour une custom sans achat retrouvé.
  Chaque exemplaire consomme son propre achat (plusieurs exemplaires, plusieurs prix). L'utilisateur peut aussi
  enregistrer la page des achats (images des blisters) pour la base de reconnaissance.
- Onglet « Customs achetées » (30/09, solution choisie par l'utilisateur) : ses blisters JB n'étaient pas dans le fichier
  Excel. customs_achetees.py (dépôt privé) tire de achats.tsv 646 figurines (206 nommées, 440 de lots « Spontane » :
  « Custom JB (lot du …) », nom à compléter), 16 717 € payés ; écarte LEGO officiel, sets, tuiles, briques, posters,
  cadeaux. Bouton « 📥 Ajouter mes customs achetées » (💶 Valeur) : une ligne par exemplaire (Nom, Vendeur, Date,
  Prix payé, Justificatif, Code JB, Remarques), sans doublon (justificatif). Valeur : prix JB si encore vendue (par le
  nom), sinon prix payé de la ligne.
- Sets encore vendus par LEGO : prix LEGO en € (demande de l'utilisateur : la Death Star 75419 ne vaut pas 526 €
  mais 999,99 €). Source : pages publiques Brickset (RRP, Launch/exit) lues par prix_lego.py dans l'action « Prix
  BrickLink » -> lego.tsv (dépôt privé) ; le site LEGO refuse les lectures automatiques (403). Encore en vente =
  fin de vente non annoncée ({t.b.a}) ou à venir.
- Objets dérivés (« 🔑 Objet dérivé », js/objets.js) : onglet « Objets dérivés » (numéro BrickLink Gear, nom,
  type, état, quantité, remarques) ; numéro trouvé par une recherche BrickLink. Pas de catalogue Gear dans l'appli.
- Ajout d'une mini-série entière d'un coup (nouveautés, ou « Voir toute la série » depuis la recherche).
- Bouton retour : réserve de 3 étapes d'historique remise à chaque toucher (Chrome saute les étapes ajoutées
  sans toucher l'écran) ; à confirmer sur le téléphone.
- Dossier pour l'assureur (« 🛡️ Dossier assureur », js/assurance.js, 29/09) : propriétaire, adresse, n° de contrat
  (gardés dans le téléphone), résumé par catégorie, méthode d'estimation, tableaux par catégorie (photo BrickLink,
  référence, désignation, état, quantité, prix unitaire, source du prix, valeur), articles non estimés (sans vente
  récente, customs), attestation à signer. « Enregistrer en PDF » = menu Imprimer du téléphone (styles @media print,
  A4) ; « Tableur (.csv) » pour Excel. Calcul commun avec l'écran Valeur (Valeur.calculer()).

## Fichier Excel de l'utilisateur

Dernière version fournie : briquotheque_LEGO_tri-1_2026-09-28_22h04.xlsx
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

Pour reprendre le 30/09 au matin :
- L'utilisateur relance « Envoyer ma liste » (💶 Valeur) : relevé complet au nouveau format (Europe, TVA comprise,
  rachat à neuf), ~1 135 articles ; limite BrickLink 5 000 appels/jour (arrêt propre si atteinte, suite au passage
  suivant). Vérifier prix.tsv (15 colonnes), le compteur en direct, le total rachat à neuf / occasion.
- Vérifier sur le téléphone : doublons supprimés, sets « Boîte seule » corrigés, Death Star 75419 unique.
- Dossier assureur : produire le PDF réel et le relire avec l'utilisateur.
- Mini-appli iPhone de l'ami : premier essai réel ; intégrer son .zip de blisters quand il arrive.
- Plus tard : outil d'intégration des .zip de blisters (data/jb_perso.tsv, photos, empreintes).

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
4. Archives (web.archive.org) : action GitHub « Archives JB » en place ; lancer la lecture complète.
- Étiquettes des boîtes de rangement JB (08/10/2026) : modèle gardé dans le dépôt PRIVÉ (logo de JB = leur marque,
  usage personnel) : collection-lego-prive/etiquettes_boites/ (logo_jb_spielwaren.png, generer.py, PDF). 09/10 : étiquettes
  17 x 7 cm pour la tranche des boîtes, 4 par A4 (papier akaca photo brillant autocollant, A4 entier, découpé à la main :
  traits de coupe), logo sur bloc foncé à gauche, nom du groupe + sous-titre à droite, page vierge. EN ATTENTE : Mathias donnera les
  regroupements (Star Wars ; Marvel et DC ensemble ; Divers…) -> modifier GROUPES dans generer.py et relancer.
5. Éventuel contact avec JB Spielwaren pour une base officielle de leurs blisters.
   Premier mail le 29/09/2026 (demande de transmettre à Hendrik) ; relance envoyée par Mathias le 08/10/2026 (même fil
   « Hilfsgesuch », en allemand) : Hendrik invité à le contacter par e-mail, aucun coût pour JB, accès au catalogue
   (nom, n° d'article, photo du blister, date de sortie), appli multilingue, intérêt pour JB (clients français).
   Présentations FR/DE prêtes (Artifacts, voir CLAUDE.md). En attente de réponse.
6. Vérifier le compte rendu de la tâche automatique ; corriger si elle ne peut pas publier.
- Mes achats de customs (30/09, js/achats.js, tuile « 🏷️ ») : l'utilisateur veut le prix payé de chaque figurine pour
  revendre ses doubles avec une marge. Onglet « À nommer » : achats en lot Whatnot (« Custom JB (lot du …) », 440),
  du plus cher au moins cher, à nommer (catalogue JB, noms déjà connus, photo du blister) → colonnes A/F/G de
  « Customs achetées ». Onglet « Par figurine » : exemplaires regroupés (code JB ou nom), prix payé et prix de revente
  conseillé = (payé × (1 + marge) + frais fixes) / (1 − frais %), réglages gardés dans le téléphone (défaut 11 % +
  0,30 € de frais, 20 % de marge : frais Whatnot à vérifier). Piste complète : détail des commandes demandé à JB.
- Album photo de l'utilisateur (30/09, 992 images Google Photos, lien partagé) : tri (ventes en direct, blisters, tiles…),
  captures de rediffusions Whatnot -> propositions_lots.tsv (dépôt privé, 70 achats reliés à une figurine), 169 photos
  de blisters de face lues à l'œil, remises d'aplomb -> data/jb_album.tsv (63 blisters absents des catalogues, code
  ALB-…) et data/jb_empreintes_album.tsv (empreintes de décor ; plusieurs par blister, CatalogueJB garde la meilleure).
  Reconnaissance par le décor (une autre photo du même blister) : 36/83 en tête, contre 3/79 avec le catalogue seul.
  Les photos elles-mêmes restent dans le dépôt privé (album_photos/blisters/).
- Prix de revente pratiqués (30/09) : outils/prix_ebay_jb.py relève les prix DEMANDÉS sur eBay.de (API Browse, annonces à
  prix fixe, lots écartés, titre = tous les mots du nom) pour les figurines de l'utilisateur -> prix_ebay.tsv du dépôt
  privé (252 noms, 83 avec annonces). Affichés dans « Mes achats customs › Par figurine » (médiane, min-max, port, lien
  vers la recherche eBay.de). Pas les ventes conclues (l'API ne les donne pas). À relancer à la demande (clés eBay de
  l'environnement cloud).
- Customs épuisées (30/09, demande de l'utilisateur : « elles valent plus que leur prix d'achat ») : outils/catalogue_jb.py
  relève aussi la disponibilité (« isSalable ») -> colonne dispo de data/jb.tsv (169 oui, 112 non ; dernier prix JB gardé).
  js/valeur.js : custom en vente chez JB = prix JB ; épuisée ou hors catalogue = le plus haut entre prix payé, dernier prix
  JB et prix demandé eBay.de (prix_ebay.tsv du dépôt privé, 2 annonces au moins). Méthode, dossier assureur, Consulter et
  Mes achats indiquent « Épuisée chez JB ».
- À vendre (30/09, js/achats.js onglet « À vendre ») : d'après le recensement des blisters (sinon l'onglet Customs), pour
  chaque figurine en plusieurs exemplaires on garde le n° le plus bas et ceux qui ont une note ; les autres sont à vendre au
  plus haut entre revente conseillée (prix payé médian + marge + frais) et prix eBay.de, plafonné au prix JB si encore en
  vente. « Mettre à jour » écrit l'onglet Excel « À vendre » (statut et prix réel gardés ; « vendu » = sorti de la liste).

## Recensement : identification à la photo (2026-09-30)
- Après la photo d'un blister (appli principale ET mini-appli contribuer.html) : panneau « base JB » (✅ connu, source, épuisée ;
  ❓ inconnu → 3 blisters au décor proche à toucher, sinon nouveau pour la base à l'envoi), « votre collection » (nombre
  d'exemplaires et numéros déjà recensés), ⚠️ si une de vos photos ressemble à un blister d'un autre nom.
- Chaque numéro tapé : « déjà recensé », « tapé deux fois » ou « nouveau ✔ ». « ➕ Autre exemplaire » garde la fiche.
- contribuer.html reprend la fiche complète (verso, exemplaires, non numérotée, notes, vue « Par figurine »).
- Reprise des blisters (30/09) : « 📥 Reprendre des blisters déjà photographiés (.zip) » dans contribuer.html (import d'un envoi,
  doublons ignorés par id). Sur iPhone, Safari et l'appli installée ont des mémoires séparées : dans Safari avec des blisters,
  le bandeau d'installation dit de les « Envoyer → Enregistrer dans Fichiers » d'abord ; à la 1re ouverture de l'appli installée
  sans blister, question « Avez-vous déjà photographié des blisters ? » et mode d'emploi.
- Recto + verso (30/09, demande de l'utilisateur) : dès la photo du recto, « 📷 Maintenant le verso » (pendant la lecture du nom),
  « Passer » possible ; sans verso ni « Passer », question avant l'ajout. Liste : « sans verso » + bouton « 📷 verso » pour
  compléter plus tard. « ➕ Autre exemplaire » : nouvelles photos recto + verso par défaut (état propre à chaque exemplaire),
  « garder la même photo » en option. Le champ « Exemplaires » (plusieurs n° d'un coup) garde une seule photo pour tous.
  Mêmes changements dans contribuer.html.
- Un seul chemin pour les blisters (30/09, anomalie relevée par l'utilisateur : pas de verso via « 📦 Photographier un blister ») :
  la tuile 📦 ouvre le recensement (recto, verso, identification, n°). Case « Ajouter aussi à mon fichier Excel (onglet Customs,
  avec étiquette) », cochée par défaut quand un fichier est ouvert (ajouterCustomsDepuisBase, js/app.js) : un exemplaire par n°,
  n° déjà présents dans Customs écartés, avertissement si la figurine y est déjà. Tuile 📚 renommée « Mes blisters recensés ».
  Perdus avec l'ancien chemin : indice Brickognize et encadrement manuel du nom (PaddleOCR lit désormais bien les noms).
- Champ « Précision » (30/09, demande de l'utilisateur : blister « CHROME COLLECTION » = Harley Quinn chromée rose) : nom imprimé
  + précision = la figurine (cleFigurine / nomComplet, js/base.js). Comptage, n° déjà recensés, « Par figurine », « À vendre »
  (achats.js, champ groupe) et nom dans l'onglet Customs (« Chrome Collection – Harley Quinn, chromée rose 12/50 ») en tiennent
  compte ; autres précisions déjà recensées pour le même nom imprimé proposées à toucher. Export .zip : colonne precision (à la fin).
  La « Note particulière » (signée, Comic Con…) reste à part. Appli et mini-appli.
- Retours du 30/09 après-midi : (3) blisters de collectionneur (ALB-…) sans image dans les propositions : photo lue dans le dépôt privé
  (Consulter.maPhoto, album_photos/blisters.tsv, jeton GitHub) ; toujours sans image dans la mini-appli de l'ami (pas de jeton).
  (4) Nombre d'exemplaires remis à 1 à chaque nouvelle custom (ouvrirCustom ; le recensement le faisait déjà).
  (5) Après un ajout, « suivante » reste dans la même catégorie (preparerSuivante : photo -> appareil photo tout de suite,
  custom -> écran custom, recherche -> recherche) + « Retour à l'accueil » ; recensement : retour en haut de l'écran après l'ajout.
- « Enregistrer le mot de passe ? » (Chrome, 30/09) : venait du champ du jeton GitHub (type="password", écran Valeur). Passé en
  champ texte masqué par CSS (-webkit-text-security), sans saisie automatique : Chrome ne le voit plus comme un mot de passe.
- Photos de collectionneur aussi dans l'écran « 🎨 Figurine custom » (résultats et fiche choisie) : Consulter.completerPhotos
  (img[data-ma-photo], photo de l'album lue dans le dépôt privé). Capture de l'utilisateur : « Junkyard Fatty » sans image.
- Quitter l'appli (30/09, anomalie : « Quitter » ne fermait pas, puis « Appuyez encore sur retour » et le retour ne faisait
  qu'effacer le message) : le toucher sur « Quitter » rajoutait des étapes de réserve dans l'historique. Remplacé par le
  « double retour » Android : à l'accueil, 1er retour = message 2,5 s et étapes « garde » retirées (history.go), 2e retour =
  fermeture ; sans 2e retour, l'appli se réarme. Plus de question Quitter / Rester.
- Quitter (30/09, 2e retour de l'utilisateur : le « double retour » passait l'appli en arrière-plan dès le 1er retour, sans
  message ; il veut quitter sans 2e confirmation). Une appli web ne peut pas se fermer par un bouton (window.close refusé ;
  essai « recharger avec un historique d'une page » : l'historique garde les étapes suivantes, refusé aussi). Choix :
  depuis l'accueil, le retour ferme directement (aucune étape « garde » à l'accueil : desarmerRetour) ; ailleurs, le retour
  ramène à l'écran précédent. Plus de question « Quitter / Rester ».
- N° en double au recensement (30/09, retour de l'utilisateur : « non » semblait effacer toute la saisie) : la question propose
  « Ajouter les N autres » (le n° en double est écarté, les autres sont ajoutés) ou « Corriger d'abord » (seul le champ en double
  est vidé, les autres n° restent). Plus d'« ajouter quand même » : un n° de série limitée est unique. Appli et mini-appli.
- Recadrage des photos de blisters (30/09, demande de l'utilisateur) : recto et verso recadrés tout seuls sur le blister
  (Base._cadreAuto : fond estimé sur le pourtour, écart de couleur / contraste, plus longue bande pleine en lignes et colonnes ;
  essai sur 14 photos : 10 bien cadrées, 4 laissées entières dont 2 déjà serrées). « ✂️ Recadrer le recto / le verso » :
  cadre à glisser et coins à tirer (départ = cadre trouvé), « Garder la photo entière », « Annuler ». Photo d'origine gardée
  pendant la saisie (Base.source) pour recadrer à nouveau ; décor et ressemblances recalculés après recadrage. Appli et mini-appli.
- « ✂️ Recadrer les photos déjà prises (N blisters) » (30/09, demande de l'utilisateur) : sous la liste du recensement, recadre
  une fois (champ recadre) recto et verso de chaque blister déjà recensé avec Base._cadreAuto ; photo laissée entière si le
  blister n'est pas trouvé avec certitude ; irréversible (question avant). Photos d'album du dépôt privé (album_photos/blisters/)
  non recadrées : les empreintes de décor de l'album ont été calculées dessus. Appli et mini-appli.
- Champs « nombre » (exemplaires, séries complètes, quantité d'objets) : 1 affiché par défaut ; au toucher le champ se vide
  (ancienne valeur en grisé, placeholder) ; laissé vide -> il reprend sa valeur d'avant (30/09, demande de l'utilisateur). Écouteurs focusin/focusout en fin de js/base.js
  (chargé par les deux applis).
- Modifier un blister recensé (30/09, demande de l'utilisateur : n° mal saisi) : bouton ✏️ sur chaque ligne de la liste (nom,
  précision, n°, série, non numérotée, note), n° déjà pris pour la même figurine refusé, blister remis « pas encore exporté ».
  Recherche dans la liste (#base-filtre : nom, n°, note). Panneau d'identification : « ✏️ Voir ou corriger » filtre la liste
  sur la figurine. Appli principale : n° corrigé aussi dans l'onglet Customs (nom de la case + Table camps,
  corrigerNumeroCustoms dans js/app.js). Appli et mini-appli.
- « Non numérotée » (30/09) : cases n° et série grisées (fond gris, libellés gris, état des n° masqué), valeurs gardées
  (décocher les retrouve) mais ignorées à l'ajout (série vidée) ; même grisage dans la fiche ✏️ de modification. Appli et mini-appli.
- Recto et verso côte à côte (30/09, demande de l'utilisateur) : en haut de l'écran de recensement (.recto-verso), dès que le verso
  est pris ; dans la liste, deux vignettes (recto, verso). Appli et mini-appli.
- Vocabulaire (30/09, choix de l'utilisateur) : « recensement » remplacé par « base de blisters » dans tout ce qui s'affiche
  (bouton « 📚 Ajouter à ma base de blisters », tuile « Ma base de blisters », « déjà dans votre base », recherche…).
  Noms internes inchangés (Base, champ recense-*, album_photos/recensement.tsv).
- Appui long sur une photo (30/09, capture de l'utilisateur pendant le recadrage) : plus de menu « Copier / Télécharger / Partager
  l'image » (contextmenu annulé sur les images, -webkit-touch-callout: none ; image du cadre sans pointer-events).
- Champs Nom et Précision (saisie et fiche ✏️) : clavier en majuscules par défaut (autocapitalize="characters"), 30/09.
- Consulter la base (01/10, retours de l'utilisateur) : (1) ses blisters photographiés dans l'appli (Memoire « base ») apparaissent :
  rattachés à la figurine du catalogue (code, sinon même nom) avec « 📚 N dans ma base (n° …) », photo à lui affichée dans le filtre
  « Mes photos de blisters » ou si le catalogue n'a pas d'image ; blisters absents du catalogue = fiches « Ma base de blisters · pas
  encore dans la base JB » (cherchables). (2) Vérification visuelle des ~600 images de la base : 13 éléments qui ne sont pas des
  blisters retirés (bannières, brique, boîtes, ticket, tuile, diorama, packs) et 3 images fausses enlevées (Birthday Girl, Jedi Bob
  Movie, Temple Guard) : data/jb_exclus.tsv (code, retirer|sans_image, raison), lu par CatalogueJB.charger, donc valable aussi après
  la mise à jour mensuelle des catalogues. Les images de jb_archive (web.archive.org) n'ont pas pu être vérifiées (inaccessibles).
