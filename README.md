# Étiquettes figurines Lego

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

Fichiers :
- `index.html`, `style.css` : l'écran de l'appli
- `js/app.js` : déroulé photo → identification → ajout
- `js/label.js` : dessin des étiquettes (QR code + code)
- `js/camps.js` : choix automatique du camp (Star Wars)
- `js/label.js` contient aussi la liste des thèmes et de leurs couleurs (`THEMES`)
- `js/xlsx.js` : modification du fichier Excel
- `js/recadrage.js` : recadrage de la photo
- `js/catalogue.js` : catalogue BrickLink (recherche, thème par catégorie, mise à jour)
- `lib/` : JSZip (lecture/écriture .xlsx) et qrcode-generator (QR codes), licences MIT
