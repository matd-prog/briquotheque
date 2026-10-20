// Objets JB Spielwaren autres que les figurines (demande de Mathias, 20/10/2026) : tiles (petites plaques imprimées),
// vignettes, éléments chromés, pièces imprimées, posters, dioramas… Tableau « Objets JB » (js/xlsx.js : ONGLET_JB),
// montré dans Ma collection à côté des sets ; valeur = prix payé × quantité (js/valeur.js, type JB).
// Photo facultative, réduite et gardée dans le téléphone (Memoire « objets-jb-photos » : numéro de ligne -> image).
// Reprise des achats (achats.tsv du dépôt privé, avec le jeton GitHub de l'écran Valeur) : tiles des directs Whatnot,
// vignettes, éléments chromés… une ligne par achat, sans doublon (colonne Source = la commande).

const ObjetsJB = {
  _photos: null, // { row: Blob }
  _urls: {},

  async _charger() {
    if (!this._photos) {
      try { this._photos = (await Memoire.lire("objets-jb-photos")) || {}; } catch (err) { this._photos = {}; }
      if (typeof Collection !== "undefined" && ecranActuel === "collection") Collection.rendre();
    }
    return this._photos;
  },
  // adresse de la photo d'un objet (affichage) ; photos lues une fois en arrière-plan
  urlPhoto(row) {
    if (!this._photos) { this._charger(); return ""; }
    const b = this._photos[row];
    if (!b) return "";
    return this._urls[row] || (this._urls[row] = URL.createObjectURL(b));
  },
  async _poserPhoto(row, blob) {
    await this._charger();
    if (blob) this._photos[row] = blob; else delete this._photos[row];
    if (this._urls[row]) { URL.revokeObjectURL(this._urls[row]); delete this._urls[row]; }
    await Memoire.ecrire(this._photos, "objets-jb-photos");
  },
  oublierPhoto(row) { return this._poserPhoto(row, null).catch(err => console.warn(err)); },

  // photo réduite (1000 px au plus) : un tile se reconnaît très bien, sans remplir la mémoire du téléphone
  async _reduire(fichier) {
    const img = await createImageBitmap(fichier);
    const k = Math.min(1, 1000 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.85));
  },
  choisirPhoto(row) {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "image/*"; i.setAttribute("capture", "environment");
    i.addEventListener("change", async () => {
      const f = i.files[0];
      if (!f) return;
      try { await this._poserPhoto(row, await this._reduire(f)); toast("Photo ajoutée ✔"); }
      catch (err) { console.error(err); toast("Photo illisible : " + err.message); }
      if (typeof Collection !== "undefined") Collection.rendre();
    });
    i.click();
  },

  // Écran d'ajout
  ouvrir() {
    for (const id of ["jb-nom", "jb-prix", "jb-date", "jb-remarques"]) $(id).value = "";
    $("jb-quantite").value = 1;
    $("jb-type").innerHTML = TYPES_JB.map(t => `<option value="${echapper(t)}">${echapper(t)}</option>`).join(""); // valeur en français, quelle que soit la langue affichée
    this._photoAjout = null;
    $("jb-apercu").hidden = true; $("jb-apercu").removeAttribute("src");
    $("jb-importer").hidden = true;
    afficher("objet-jb");
    // reprise des achats : seulement avec le jeton GitHub (dépôt privé des achats, écran Valeur)
    this._jeton().then(j => { $("jb-importer").hidden = !j; });
  },
  async _jeton() {
    try { Valeur.jeton = Valeur.jeton || await Memoire.lire("jeton-github"); } catch (err) { /* pas de jeton */ }
    return Valeur.jeton;
  },
  async photoAjout(f) {
    try {
      this._photoAjout = await this._reduire(f);
      $("jb-apercu").src = URL.createObjectURL(this._photoAjout); $("jb-apercu").hidden = false;
    } catch (err) { console.error(err); toast("Photo illisible : " + err.message); }
  },
  async ajouter() {
    const nom = $("jb-nom").value.trim();
    if (!nom) { await demander("Donnez un nom à l'objet (ex. « Tile Darth Donut » ou ce qui est imprimé dessus).", "OK", "Fermer"); return; }
    const objet = { nom, type: $("jb-type").value, quantite: Math.max(1, parseInt($("jb-quantite").value, 10) || 1),
                    prixPaye: parseFloat($("jb-prix").value.replace(",", ".").replace(/[^\d.]/g, "")) || 0,
                    date: $("jb-date").value.trim(), remarques: $("jb-remarques").value.trim(), source: "" };
    try {
      const row = await ajouterObjetJB(etat.classeur, objet);
      if (this._photoAjout) await this._poserPhoto(row, this._photoAjout);
      etat.nonEnregistres++;
      await memoriser();
      toast(`« ${nom} » ajouté à vos objets JB ✔`);
      this.voir();
    } catch (err) {
      console.error(err);
      await demander("L'ajout a échoué : " + err.message, "OK", "Fermer");
    }
  },
  // Ma collection, onglet « Objets JB »
  voir() {
    Collection.onglet = ONGLET_JB;
    Collection.ouvrir();
  },

  // Type d'un achat d'après son nom (historique Whatnot, reçus JB) ; null : pas un objet JB (figurine, set LEGO…)
  typeAchat(nom, vendeur) {
    if (!/jb ?spielwaren|jbspielwaren/i.test(vendeur || "")) return null;
    if (/^lego\b|\blego (sets?|minifig|star wars minifig|einzelteile)|\[bundle\]|polybag|brickheadz|bricklink order/i.test(nom)) return null;
    if (/fliese|\btiles?\b/i.test(nom)) return TYPES_JB[0];
    if (/vignett/i.test(nom)) return TYPES_JB[1];
    if (/chromelement|chrom.*(helm|schwert|waffe|element)/i.test(nom)) return TYPES_JB[2];
    if (/printed items|bedruckte? (steine|teile)/i.test(nom)) return TYPES_JB[3];
    if (/poster|postkarte|postcard|\bkarte\b/i.test(nom)) return TYPES_JB[4];
    if (/diorama|\bmoc\b|logo made from/i.test(nom)) return TYPES_JB[5];
    return null;
  },
  async importer() {
    if (!(await this._jeton())) { await demander("Enregistrez d'abord votre jeton GitHub dans l'écran Valeur.", "OK", "Fermer"); return; }
    let lignes;
    try {
      const rep = await Valeur._api("/contents/achats.tsv", { headers: { Accept: "application/vnd.github.raw" } });
      if (!rep.ok) throw new Error("achats.tsv introuvable");
      lignes = (await rep.text()).split("\n").slice(1).map(l => l.split("\t"));
    } catch (err) { await demander("Lecture des achats impossible : " + err.message, "OK", "Fermer"); return; }
    const deja = new Set((await lireObjetsJB(etat.classeur)).map(o => o.source).filter(Boolean));
    const nouveaux = [];
    for (const [date, vendeur, source, article, , qte, ttc] of lignes) {
      const type = article && this.typeAchat(article, vendeur);
      if (!type || !(parseFloat(ttc) > 0)) continue;
      const cle = `${source} · ${article}`;
      if (deja.has(cle)) continue;
      deja.add(cle);
      const quand = /^\d{4}-\d\d-\d\d$/.test(date) ? date.split("-").reverse().join("/") : date;
      const nom = article.replace(/^unsere\s+/i, "").replace(/\s*\bNEU\b!?|!/gi, "").replace(/\s+/g, " ").trim();
      nouveaux.push({ nom, type, quantite: +qte || 1, prixPaye: parseFloat(ttc), date: quand, remarques: vendeur, source: cle });
    }
    if (!nouveaux.length) { await demander("Rien de nouveau : tous vos achats de tiles et objets JB sont déjà repris.", "OK", "Fermer"); return; }
    const total = nouveaux.reduce((s, o) => s + o.prixPaye * o.quantite, 0);
    const parType = TYPES_JB.map(t => [t, nouveaux.filter(o => o.type === t).length]).filter(([, n]) => n).map(([t, n]) => `${t} : ${n}`).join("\n");
    if (!(await demander(`Reprendre ${nouveaux.length} achats de vos directs et commandes JB (${total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}, port compris) ?\n\n${parType}`, "Reprendre", "Annuler"))) return;
    $("texte-chargement").textContent = "Reprise des achats…";
    afficher("chargement");
    try {
      let i = 0;
      for (const o of nouveaux) {
        await ajouterObjetJB(etat.classeur, o);
        if (++i % 20 === 0) $("texte-chargement").textContent = `Reprise des achats… (${i} sur ${nouveaux.length})`;
      }
      etat.nonEnregistres++;
      await memoriser();
      toast(`${nouveaux.length} achats repris dans vos objets JB ✔`, 5000);
      this.voir();
    } catch (err) {
      console.error(err);
      afficher("objet-jb");
      await demander("La reprise a échoué : " + err.message, "OK", "Fermer");
    }
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "objet-jb") ObjetsJB.ouvrir();
  else if (a === "objet-jb-ajouter") ObjetsJB.ajouter();
  else if (a === "objet-jb-importer") ObjetsJB.importer();
  else if (a === "objets-jb-voir") ObjetsJB.voir();
  else if (a === "customs-voir") { Collection.onglet = THEME_CUSTOMS.onglet; Collection.ouvrir(); }
});
$("input-jb-photo").addEventListener("change", e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) ObjetsJB.photoAjout(f);
});
