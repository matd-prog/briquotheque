# Étiquettes figurines Lego

Appli pour téléphone Android (page web installable) :

1. photographier une figurine ;
2. l'identifier avec Brickognize et ouvrir sa fiche BrickLink ;
3. « Ajouter à ma collection ? » → Oui : étiquette QR code (lien BrickLink) sur la couleur du camp,
   insérée dans le bon onglet du fichier Excel (Gentils (vert), Méchants (rouge), Zone grise) + Table camps.

Tout fonctionne dans le téléphone : le fichier Excel est ouvert depuis Google Drive, modifié
dans le téléphone, puis renvoyé vers Drive sous un nouveau nom (daté). Le fichier d'origine
n'est jamais écrasé.

Fichiers :
- `index.html`, `style.css` : l'écran de l'appli
- `js/app.js` : déroulé photo → identification → ajout
- `js/label.js` : dessin des étiquettes (QR code + code)
- `js/camps.js` : choix automatique du camp
- `js/xlsx.js` : modification du fichier Excel
- `lib/` : JSZip (lecture/écriture .xlsx) et qrcode-generator (QR codes), licences MIT
