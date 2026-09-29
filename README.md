# Figothèque (figurines et sets LEGO)

Appli pour téléphone Android (page web installable) :

1. photographier une figurine ;
2. l'identifier avec Brickognize et ouvrir sa fiche BrickLink ;
3. « Ajouter à ma collection ? » → Oui : étiquette QR code (lien BrickLink) sur la bonne couleur,
   insérée dans le bon onglet du fichier Excel + une ligne dans la Table camps :
   - Star Wars : Gentils (vert), Méchants (rouge), Zone grise (camp proposé, modifiable) ;
   - autres thèmes : un onglet par thème, créé automatiquement la première fois avec la même
     mise en page (Simpsons, Seigneur des Anneaux, Harry Potter, Super-héros, Minifigs à
     collectionner, Disney, Ninjago, Town & City, Jurassic World, Autres thèmes). Le thème est reconnu
     grâce au début du code BrickLink (sim, lor, hp…) et peut être changé à la main.

Tout fonctionne dans le téléphone : le fichier Excel est ouvert depuis Google Drive, modifié
dans le téléphone, puis renvoyé vers Drive sous un nouveau nom (daté). Le fichier d'origine
n'est jamais écrasé.

Reconnaissance : photo recadrée envoyée à Brickognize, 5 propositions comparées à la photo
BrickLink, photo de dos facultative (scores combinés), recherche par nom dans le catalogue BrickLink.

Catalogue BrickLink (`data/figurines.tsv`, 19 250 figurines au 28/09/2026) : sert à la recherche
par nom et à reconnaître le thème. Mise à jour mensuelle depuis le téléphone : Outils →
« Mettre à jour le catalogue BrickLink » avec le fichier Minifigures.txt téléchargé sur
https://www.bricklink.com/catalogDownload.asp (Catalog Items / Minifigures / Tab-Delimited File).

Figurines custom (JB Spielwaren ou autre) : bouton « Ajouter une figurine custom », onglet
« Customs » (corail). Code JB-<numéro d'article> pour un lien JB Spielwaren, sinon CUS-001…
Le QR code ouvre le lien collé (gardé dans l'onglet Customs, colonnes S à W) ; sans lien,
l'étiquette n'a pas de QR code.

Catalogue JB Spielwaren (`data/jb.tsv`) : figurines custom en vente sur jb-spielwaren.de
(nom, catégorie, lien, adresse de la photo, sans copie des photos). Mise à jour :
`python3 outils/catalogue_jb.py` (lit les catégories « Custom Minifigures », 1 page / 2 s).

Blister JB : bouton « Photographier un blister JB » ; l'appli cherche le nom sur la photo entière (sinon on encadre le nom), le lit
(Tesseract.js inclus dans lib/tesseract, lecture dans le téléphone) et propose les figurines du
catalogue JB qui correspondent. Le n° d'exemplaire (ex. 189/250) est ajouté au nom.

Décor des blisters : `data/jb_empreintes.tsv` contient une « empreinte » (couleurs et disposition)
de chaque photo de blister du catalogue JB, calculée par `node outils/empreintes_jb.js` avec le
même code que l'appli (`js/empreinte.js`) ; les photos ne sont pas conservées. L'appli compare la
photo du blister à ces empreintes pour confirmer le nom lu, ou proposer les blisters ressemblants.

Figurines JB revendues par brickshellcases.com (`data/jb_brickshell.tsv`, `python3 outils/brickshell_jb.py`) :
celles qui ne sont plus sur le site JB. Leurs photos sont celles du site JB et portent le numéro d'article :
elles gardent leur code JB-… (sinon BSC-…) ; lien vers la page brickshellcases ; empreintes du décor comprises.

Figurines JB retirées de la vente (`data/jb_ebay.tsv`) : noms tirés des annonces eBay.de (API officielle
« Browse »), avec `python3 outils/ebay_jb.py` (clés dans les variables d'environnement EBAY_CLIENT_ID et
EBAY_CLIENT_SECRET). Les figurines déjà au catalogue JB ou sur brickshellcases.com sont écartées
(lancer `brickshell_jb.py` avant). Elles sont proposées dans la
recherche et la lecture des blisters ; le lien de l'étiquette est une recherche eBay.de, le code CUS-….

Fichiers :
- `index.html`, `style.css` : l'écran de l'appli
- `js/app.js` : déroulé photo → identification → ajout
- `js/label.js` : dessin des étiquettes (QR code + code)
- `js/camps.js` : choix automatique du camp (Star Wars)
- `js/label.js` contient aussi la liste des thèmes et de leurs couleurs (`THEMES`)
- `js/xlsx.js` : modification du fichier Excel
- `js/recadrage.js` : recadrage de la photo
- `js/collection.js` : consultation de la collection (liste, planche, recherche)
- `js/catalogue.js` : catalogue BrickLink (recherche, thème par catégorie, mise à jour)
- `js/blister.js` : lecture du nom sur un blister (PaddleOCR d'abord, Tesseract ensuite)
- `js/lecture_paddle.js` et `lib/paddle/` : lecture PaddleOCR dans le téléphone (onnxruntime-web, MIT ;
  modèles PP-OCRv4, Apache 2.0, réduits aux caractères latins par `outils/modele_paddle.py`)
- `lib/tesseract/` : Tesseract.js et données anglaises (licence Apache 2.0)
- `lib/` : JSZip (lecture/écriture .xlsx) et qrcode-generator (QR codes), licences MIT
