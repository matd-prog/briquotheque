// Base commune des blisters JB : on photographie ses blisters un par un, le nom est lu (js/blister.js),
// on le vérifie, et la photo réduite + le nom sont gardés dans le téléphone. « Exporter » crée un .zip
// (base.tsv + photos/) à intégrer ensuite à la base de l'appli, pour reconnaître ces blisters (nom et décor),
// en particulier les anciennes éditions introuvables en ligne. Utilisable sans fichier Excel.

const Base = {
  photo: null,     // photo en cours (Blob JPEG réduit, remis d'aplomb)
  codeLu: "",      // code de la figurine reconnue, s'il y en a une, et son nom (nomLu)
  nomLu: "",
  entrees: [],     // [{ id, nom, serie, remarque, code, date, photo, exporte }]

  async ouvrir() {
    this.entrees = (await Memoire.lire("base")) || [];
    this._nouvelle();
    afficher("base");
    this._afficherListe();
    CatalogueJB.charger().catch(() => {});
  },

  _nouvelle() {
    this.photo = null; this.codeLu = ""; this.nomLu = "";
    $("base-photo").removeAttribute("src");
    $("base-fiche").hidden = true;
    $("base-etat").textContent = "";
    for (const id of ["base-nom", "base-serie", "base-remarque"]) $(id).value = "";
    $("base-suggestions").innerHTML = "";
  },

  // Photo réduite (1000 px au plus), éventuellement tournée d'un quart de tour
  async _reduire(fichier, sens) {
    let image = await createImageBitmap(fichier);
    if (sens) image = tourner(image, sens);
    const k = Math.min(1, 1000 / Math.max(image.width, image.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(image.width * k); cv.height = Math.round(image.height * k);
    cv.getContext("2d").drawImage(image, 0, 0, cv.width, cv.height);
    return new Promise(ok => cv.toBlob(ok, "image/jpeg", 0.82));
  },

  async lirePhoto(fichier) {
    this._nouvelle();
    $("base-photo").src = URL.createObjectURL(fichier);
    $("base-etat").textContent = "Lecture du nom… (la première fois, téléchargement de l'outil de lecture, environ 27 Mo)";
    let lecture = { texte: "", trouve: false, sens: 0 };
    try {
      await CatalogueJB.charger();
      lecture = await Blister.lireEntier(fichier, (i, n) => {
        if (i > 1) $("base-etat").textContent = `Lecture du nom… (essai ${i} sur ${n})`;
      });
    } catch (err) { console.error(err); }
    this.photo = await this._reduire(fichier, lecture.sens);
    $("base-photo").src = URL.createObjectURL(this.photo);
    // propositions : figurines connues dont le nom a été lu, puis le nom le plus probable du carton
    const connues = lecture.trouve ? CatalogueJB.rapprocher(lecture.texte).slice(0, 4) : [];
    const court = f => f.nom.replace(/\s*[-–]?\s*\bc[ou]s?t[ou]m\b.*$/i, "").replace(/\s+minifig\w*.*$/i, "").trim();
    const noms = [...connues.map(f => ({ nom: court(f).toUpperCase(), code: f.code })), ...(nomProbable(lecture.texte) ? [{ nom: nomProbable(lecture.texte).toUpperCase(), code: "" }] : [])]
      .filter((s, i, t) => s.nom && t.findIndex(x => x.nom === s.nom) === i);
    if (noms.length) { $("base-nom").value = this.nomLu = noms[0].nom; this.codeLu = noms[0].code; }
    $("base-suggestions").innerHTML = noms.length > 1
      ? noms.map((s, i) => `<button class="petit" data-base-nom="${i}">${echapper(s.nom)}</button>`).join("") : "";
    $("base-suggestions").querySelectorAll("[data-base-nom]").forEach(b => b.addEventListener("click", () => {
      const s = noms[+b.dataset.baseNom];
      $("base-nom").value = this.nomLu = s.nom; this.codeLu = s.code;
    }));
    const serie = /limited\s*to\s*(\d{2,4})|\b(?:of|von)\s*(\d{2,4})\b/i.exec(lecture.texte);
    if (serie) $("base-serie").value = serie[1] || serie[2];
    $("base-etat").textContent = noms.length ? "Vérifiez le nom (corrigez-le si besoin), puis « Ajouter à la base »."
      : "Le nom n'a pas été lu : tapez-le tel qu'il est imprimé sur le blister, puis « Ajouter à la base ».";
    $("base-fiche").hidden = false;
  },

  async ajouter() {
    const nom = $("base-nom").value.trim().toUpperCase();
    if (!this.photo) { toast("Photographiez d'abord un blister."); return; }
    if (!nom) { await demander("Tapez le nom imprimé sur le blister.", "OK", "Fermer"); return; }
    // nom corrigé à la main : le code de la figurine proposée ne vaut plus
    const code = this.codeLu && normaliser(nom) === normaliser(this.nomLu) ? this.codeLu : "";
    const doublon = this.entrees.find(e => normaliser(e.nom) === normaliser(nom));
    if (doublon && !(await demander(`« ${nom} » est déjà dans la liste. L'ajouter quand même (autre photo) ?`))) return;
    this.entrees.push({
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      nom, serie: $("base-serie").value.trim(), remarque: $("base-remarque").value.trim(),
      code, date: new Date().toISOString(), photo: this.photo, exporte: false,
    });
    await Memoire.ecrire(this.entrees, "base");
    toast(`« ${nom} » ajouté à la base ✔`);
    this._nouvelle();
    this._afficherListe();
  },

  async supprimer(id) {
    const e = this.entrees.find(x => x.id === id);
    if (!e || !(await demander(`Retirer « ${e.nom} » de la liste ?`))) return;
    this.entrees = this.entrees.filter(x => x.id !== id);
    await Memoire.ecrire(this.entrees, "base");
    this._afficherListe();
  },

  _afficherListe() {
    const n = this.entrees.length, attente = this.entrees.filter(e => !e.exporte).length;
    $("base-compte").textContent = n
      ? `${n} blister${n > 1 ? "s" : ""} dans le téléphone, dont ${attente} pas encore exporté${attente > 1 ? "s" : ""}`
      : "Aucun blister ajouté pour l'instant.";
    $("btn-base-exporter").hidden = !n;
    $("btn-base-vider").hidden = !this.entrees.some(e => e.exporte);
    $("base-liste").innerHTML = this.entrees.slice().reverse().map(e => `
      <div class="fiche">
        <img class="photo" src="${URL.createObjectURL(e.photo)}" alt="">
        <div class="infos"><div class="nom-court">${echapper(e.nom)}</div>
          <div class="lieu">${echapper([e.serie && `série ${e.serie}`, e.code, e.exporte ? "exporté" : "pas encore exporté"].filter(Boolean).join(" · "))}</div></div>
        <button class="petit" data-base-suppr="${e.id}" title="Retirer">✕</button>
      </div>`).join("");
    $("base-liste").querySelectorAll("[data-base-suppr]").forEach(b => b.addEventListener("click", () => this.supprimer(b.dataset.baseSuppr)));
  },

  // .zip : base.tsv (id, nom, série, remarque, code reconnu, date, photo) + photos/<id>.jpg
  async exporter() {
    if (!this.entrees.length) return;
    const zip = new JSZip();
    const lignes = ["id\tnom\tserie\tremarque\tcode\tdate\tphoto"];
    for (const e of this.entrees) {
      zip.file(`photos/${e.id}.jpg`, e.photo);
      lignes.push([e.id, e.nom, e.serie, e.remarque, e.code, e.date, `photos/${e.id}.jpg`].map(v => String(v || "").replace(/[\t\n]/g, " ")).join("\t"));
    }
    zip.file("base.tsv", lignes.join("\n") + "\n");
    const contenu = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(contenu);
    a.download = `blisters_JB_${horodatage()}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    for (const e of this.entrees) e.exporte = true;
    await Memoire.ecrire(this.entrees, "base");
    this._afficherListe();
    await demander(`Fichier « ${a.download} » enregistré dans Téléchargements (${this.entrees.length} blisters).\n\n` +
      "Envoyez-le moi (ou mettez-le dans Google Drive) pour que je l'ajoute à la base de l'appli.", "OK", "Fermer");
  },

  async vider() {
    const n = this.entrees.filter(e => e.exporte).length;
    if (!n || !(await demander(`Effacer du téléphone les ${n} blisters déjà exportés ? (le fichier exporté les garde)`))) return;
    this.entrees = this.entrees.filter(e => !e.exporte);
    await Memoire.ecrire(this.entrees, "base");
    this._afficherListe();
  },
};

$("input-base").addEventListener("change", e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) Base.lirePhoto(f);
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action === "base") Base.ouvrir();
  else if (action === "base-ajouter") Base.ajouter();
  else if (action === "base-exporter") Base.exporter();
  else if (action === "base-vider") Base.vider();
});
