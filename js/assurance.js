// Dossier pour l'assureur : inventaire complet de la collection (photo, code, nom, état, quantité, prix, source)
// avec le total, la méthode d'estimation et la date des prix. Mis en page pour « Enregistrer en PDF »
// (menu Imprimer du téléphone) ; aussi en tableur (.csv, s'ouvre dans Excel). Calcul : Valeur.calculer().

const CATEGORIES_ASSURANCE = [
  ["Figurines", d => d.type === "MINIFIG"],
  ["Sets", d => d.type === "SET"],
  ["Objets dérivés et porte-clés", d => d.type === "GEAR"],
  ["Figurines personnalisées (customs)", d => d.type === "CUSTOM"],
  ["Boîtes seules", d => d.type === "BOX"],
];
const IMAGE_BRICKLINK = { MINIFIG: "MN", SET: "SN", GEAR: "GN", BOX: "ON" };
// photo d'un article : BrickLink, ou pour une custom la photo du catalogue JB
const photoArticle = d => d.type === "CUSTOM" ? ((CatalogueJB.parCode && (CatalogueJB.parCode.get(d.code) || {}).image) || "")
  : `https://img.bricklink.com/ItemImage/${IMAGE_BRICKLINK[d.type]}/0/${encodeURIComponent(d.code)}.png`;

const Assurance = {
  calcul: null,

  async ouvrir() {
    afficher("assurance");
    const infos = (await Memoire.lire("assurance")) || {};
    for (const c of ["nom", "adresse", "contrat"]) $("assurance-" + c).value = infos[c] || "";
    $("assurance-dossier").innerHTML = "";
    $("assurance-sortie").hidden = true;
    $("assurance-etat").textContent = "";
  },

  _source(d) {
    if (d.sourceCustom) return d.sourceCustom;
    if (d.enVente) return "Prix LEGO (encore en vente)";
    return `BrickLink, médiane de ${d.ventes || 0} vente(s) ${d.neuf ? "neuf" : "occasion (aucune vente neuve)"}, ` +
      (d.zone === "monde" ? "monde entier" : "Europe");
  },

  _etat(d) {
    if (d.type === "MINIFIG" && !d.etat) return "Occasion";
    return d.etat || "";
  },

  async preparer() {
    if (!etat.classeur) { await demander("Ouvrez d'abord votre collection.", "OK", "Fermer"); return; }
    if (!(await Memoire.lire("jeton-github"))) { await demander("Collez d'abord votre jeton dans « 💶 Valeur ».", "OK", "Fermer"); return; }
    const infos = { nom: $("assurance-nom").value.trim(), adresse: $("assurance-adresse").value.trim(), contrat: $("assurance-contrat").value.trim() };
    await Memoire.ecrire(infos, "assurance");
    $("assurance-etat").textContent = "Préparation du dossier…";
    try {
      Valeur.jeton = await Memoire.lire("jeton-github");
      this.calcul = await Valeur.calculer();
      if (!this.calcul) { $("assurance-etat").textContent = "Pas encore de prix : passez d'abord par « 💶 Valeur » → « Envoyer ma liste »."; return; }
    } catch (err) {
      console.error(err);
      $("assurance-etat").textContent = "Échec : " + err.message;
      return;
    }
    const { details, sans, total, totalOccasion, date } = this.calcul;
    // articles sans prix : LEGO sans vente récente, customs sans prix JB ni prix d'achat retrouvé
    const customs = sans.filter(a => a.type === "CUSTOM");
    const sansLego = sans.filter(a => a.type !== "CUSTOM");
    const photos = $("assurance-photos").checked;
    const euros = v => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
    const jour = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const nbPieces = details.reduce((n, d) => n + (d.quantite || 1), 0);
    const ligne = d => `<tr>
        ${photos ? `<td class="ph">${photoArticle(d) ? `<img src="${echapper(photoArticle(d))}" alt="" loading="eager" onerror="this.remove()">` : ""}</td>` : ""}
        <td>${echapper(d.code)}</td><td>${echapper(d.nom || "")}${d.detail ? `<br><small>figurines du set ${euros(d.detail.figsSet)} + reste du set ${euros(d.detail.reste)}` +
          `${d.figsAilleurs ? ` ; ${d.figsAilleurs} figurine(s) inventoriée(s) dans « Figurines »` : ""}${d.sansFigs ? " ; set sans ses figurines" : ""}</small>` : ""}</td>
        <td>${echapper(this._etat(d))}</td><td class="n">${d.quantite || 1}</td><td class="n">${euros(d.unitaire)}</td>
        <td><small>${echapper(this._source(d))}</small></td><td class="n"><b>${euros(d.v)}</b></td><td class="n">${euros(d.vOccasion)}</td></tr>`;
    const sections = CATEGORIES_ASSURANCE.map(([titre, test]) => {
      const g = details.filter(test).sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));
      if (!g.length) return "";
      const sousTotal = g.reduce((n, d) => n + d.v, 0), sousTotalOcc = g.reduce((n, d) => n + d.vOccasion, 0);
      return `<h2>${titre} <span>(${g.reduce((n, d) => n + (d.quantite || 1), 0)} article(s) · ${euros(sousTotal)})</span></h2>
        <table><thead><tr>${photos ? "<th></th>" : ""}<th>Référence</th><th>Désignation</th><th>État</th><th>Qté</th><th>Prix unit.</th><th>Source du prix</th><th>Rachat à neuf</th><th>Occasion</th></tr></thead>
        <tbody>${g.map(ligne).join("")}</tbody>
        <tfoot><tr><td colspan="${photos ? 7 : 6}">Sous-total ${titre.toLowerCase()}</td><td class="n"><b>${euros(sousTotal)}</b></td><td class="n">${euros(sousTotalOcc)}</td></tr></tfoot></table>`;
    }).join("");
    $("assurance-dossier").innerHTML = `
      <div class="dossier">
        <h1>Inventaire et estimation d'une collection LEGO</h1>
        <p class="entete">${infos.nom ? `<b>Propriétaire :</b> ${echapper(infos.nom)}<br>` : ""}${infos.adresse ? `<b>Adresse :</b> ${echapper(infos.adresse)}<br>` : ""}
          ${infos.contrat ? `<b>Contrat d'assurance :</b> ${echapper(infos.contrat)}<br>` : ""}<b>Date du dossier :</b> ${jour}</p>
        <div class="resume">
          <div><small>Coût de rachat à neuf</small><b>${euros(total)}</b></div>
          <div><small>Valeur d'occasion</small><b>${euros(totalOccasion)}</b></div>
          <div><small>Articles estimés</small><b>${nbPieces}</b></div>
          ${CATEGORIES_ASSURANCE.map(([titre, test]) => { const g = details.filter(test); return g.length ? `<div><small>${titre}</small><b>${euros(g.reduce((n, d) => n + d.v, 0))}</b></div>` : ""; }).join("")}
        </div>
        <h2>Méthode d'estimation</h2>
        <p>Chaque article est identifié par sa référence dans le catalogue BrickLink (la plus grande place de marché mondiale
          de LEGO). La <b>valeur retenue est le coût de rachat à neuf</b> : la <b>médiane des prix de vente d'articles neufs
          réellement conclus sur BrickLink au cours des 6 derniers mois, en Europe, TVA comprise</b>, en euros (et non les prix
          demandés par les vendeurs ; ventes du monde entier quand il n'y en a eu aucune en Europe). Les sets <b>encore vendus
          par LEGO</b> sont estimés à leur <b>prix de vente public LEGO en France</b> (source : Avenue de la Brique, comparateur de prix français ; dates de commercialisation : Brickset). Quand un article n'a eu aucune
          vente à l'état neuf, son prix d'occasion est retenu (indiqué dans la colonne « Source du prix »).
          Les figurines d'un set monté sont estimées <b>une à une</b> (elles valent souvent plus que le set lui-même), et le
          <b>reste du set</b> (briques, boîte, notice) à part : prix du set moins celui de ses figurines, sans jamais descendre
          sous 50 % de son prix LEGO d'origine, ni sous 85 % du prix demandé sur eBay.de pour ce set vendu sans figurines (deux annonces au moins). Les <b>figurines personnalisées</b> (« customs », hors catalogue LEGO) sont
          estimées à leur prix de vente chez leur fabricant (JB Spielwaren) si elles sont encore vendues ; épuisées, au plus haut
          entre leur prix d'achat justifié, frais de port compris (reçus, historique d'achats Whatnot), leur dernier prix chez le
          fabricant et le prix demandé sur eBay.de (au moins deux annonces) ; à défaut, au prix habituel d'une custom
          dans cet historique (médiane des lots achetés en vente en direct). Une figurine inventoriée dans la partie « Figurines » n'est pas comptée une
          seconde fois dans son set. À titre d'information, la colonne « Occasion » donne la valeur de revente d'occasion
          (même méthode, ventes d'occasion). Prix relevés le ${date ? new Date(date).toLocaleDateString("fr-FR") : jour}.
          Méthode détaillée, avec des exemples : <b>${echapper(new URL("methode.html", location.href).href)}</b></p>
        ${sections}
        ${sans.length ? `<h2>Articles non estimés</h2><p>${sansLego.length ? `${sansLego.length} article(s) sans vente récente connue sur BrickLink : ` +
          echapper(sansLego.map(a => `${a.code}${a.nom ? ` (${a.nom})` : ""}`).join(", ")) + ". " : ""}${customs.length ? `${customs.length} figurine(s) personnalisée(s) ` +
          `(« customs », hors catalogue LEGO), plus vendues par leur fabricant et sans prix d'achat retrouvé : ` + echapper(customs.map(c => c.nom || c.code).join(", ")) + "." : ""}</p>` : ""}
        <h2>Attestation</h2>
        <p>Je soussigné(e) ${infos.nom ? echapper(infos.nom) : "………………………………"} certifie être propriétaire des articles ci-dessus,
          présents à mon domicile à la date du présent dossier.</p>
        <p class="signature">Fait à ……………………………… , le ${jour}.<br><br>Signature :</p>
        <p class="pied">Dossier établi avec l'appli Briquothèque. Photos : catalogue BrickLink (photos de référence des articles).</p>
      </div>`;
    $("assurance-sortie").hidden = false;
    $("assurance-etat").textContent = `Dossier prêt : ${nbPieces} articles, rachat à neuf ${euros(total)}. Vérifiez-le ci-dessous, puis enregistrez-le en PDF.`;
  },

  // Attend le chargement des photos (10 s au plus), puis ouvre le menu Imprimer (« Enregistrer en PDF »)
  async imprimer() {
    const images = [...document.querySelectorAll("#assurance-dossier img")].filter(i => !i.complete);
    if (images.length) {
      $("assurance-etat").textContent = `Chargement des photos (${images.length})…`;
      await Promise.race([Promise.all(images.map(i => new Promise(ok => { i.onload = i.onerror = ok; }))), new Promise(ok => setTimeout(ok, 10000))]);
    }
    $("assurance-etat").textContent = "Dans le menu qui s'ouvre, choisissez « Enregistrer au format PDF ».";
    const titre = document.title;
    document.title = `Inventaire LEGO ${horodatage()}`; // nom proposé pour le fichier PDF
    window.print();
    setTimeout(() => document.title = titre, 2000);
  },

  // Même inventaire en tableur (.csv, point-virgule, s'ouvre dans Excel)
  tableur() {
    if (!this.calcul) return;
    const c = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const nombre = v => v.toFixed(2).replace(".", ",");
    const lignes = [["Catégorie", "Référence", "Désignation", "État", "Quantité", "Prix unitaire (€)", "Rachat à neuf (€)", "Occasion (€)", "Source du prix", "Rangement / onglet"].map(c).join(";")];
    for (const [titre, test] of CATEGORIES_ASSURANCE)
      for (const d of this.calcul.details.filter(test))
        lignes.push([titre, d.code, d.nom, this._etat(d), d.quantite || 1, nombre(d.unitaire), nombre(d.v), nombre(d.vOccasion), this._source(d), d.remarques || d.onglet].map(c).join(";"));
    lignes.push(["Total", "", "", "", "", "", nombre(this.calcul.total), nombre(this.calcul.totalOccasion), "", ""].map(c).join(";"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv" }));
    a.download = `inventaire_LEGO_${horodatage()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast("Tableur enregistré dans Téléchargements ✔");
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "assurance") Assurance.ouvrir();
  else if (a === "assurance-preparer") Assurance.preparer();
  else if (a === "assurance-imprimer") Assurance.imprimer();
  else if (a === "assurance-tableur") Assurance.tableur();
});
