// Base commune des blisters JB : on photographie ses blisters un par un, le nom est lu (js/blister.js),
// on le vérifie, et la photo réduite + le nom sont gardés dans le téléphone. « Exporter » crée un .zip
// (base.tsv + photos/) à intégrer ensuite à la base de l'appli, pour reconnaître ces blisters (nom et décor),
// en particulier les anciennes éditions introuvables en ligne. Utilisable sans fichier Excel.

const Base = {
  photo: null,     // photo en cours (Blob JPEG réduit, remis d'aplomb)
  codeLu: "",      // code de la figurine reconnue, s'il y en a une, et son nom (nomLu)
  nomLu: "",
  verso: null,     // photo du verso (facultative)
  vue: "photos",   // « photos » (dernières photos) ou « compte » (exemplaires par figurine, comparés aux achats)
  entrees: [],     // [{ id, nom, numero, serie, remarque, code, date, photo, verso, exporte }]

  async ouvrir() {
    this.entrees = (await Memoire.lire("base")) || [];
    this._nouvelle();
    afficher("base");
    this._afficherListe();
    CatalogueJB.charger().catch(() => {});
  },

  _nouvelle() {
    this.photo = null; this.verso = null; this.codeLu = ""; this.nomLu = "";
    $("base-photo").removeAttribute("src");
    if ($("base-verso")) { $("base-verso").removeAttribute("src"); $("base-verso").hidden = true; }
    $("base-fiche").hidden = true;
    $("base-etat").textContent = "";
    for (const id of ["base-nom", "base-serie", "base-remarque", "base-numero"]) if ($(id)) $(id).value = "";
    if ($("base-nombre")) { $("base-nombre").value = 1; this._grilleNumeros(); }
    if ($("base-non-numerote")) { $("base-non-numerote").checked = false; this._numerote(); }
    if ($("base-deja")) $("base-deja").textContent = "";
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

  // « Non numérotée » : pas de numéro ni de série limitée
  _numerote() {
    const non = $("base-non-numerote") && $("base-non-numerote").checked;
    const champs = [...($("base-numeros") ? $("base-numeros").querySelectorAll("input") : []), $("base-numero"), $("base-serie")].filter(Boolean);
    for (const c of champs) { c.disabled = non; if (non) c.value = ""; }
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
    let connues = lecture.trouve ? CatalogueJB.rapprocher(lecture.texte).slice(0, 4) : [];
    // décor : blisters les plus ressemblants (catalogue et photos de collectionneurs). Un nom lu dont le décor ne
    // ressemble pas passe derrière un décor presque identique (texte du carton pris pour un nom).
    try {
      await CatalogueJB.chargerEmpreintes();
      const decor = CatalogueJB.classerParDecor(await createImageBitmap(this.photo), 10);
      const confirme = connues.some(f => decor.some(r => r.f === f));
      const surs = decor.filter(r => r.score >= 0.95).slice(0, 2).map(r => r.f);
      connues = confirme || !surs.length ? [...connues, ...decor.slice(0, connues.length ? 1 : 3).map(r => r.f)] : [...surs, ...connues];
      connues = connues.filter((f, i, t) => t.indexOf(f) === i).slice(0, 5);
    } catch (err) { console.warn(err); }
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
    const numero = /\b(\d{1,4})\s*(?:of|von)\s*\d{2,4}\b/i.exec(lecture.texte);
    if (numero && $("base-numero")) $("base-numero").value = numero[1];
    $("base-etat").textContent = noms.length ? "Vérifiez le nom (corrigez-le si besoin), puis « Ajouter à la base »."
      : "Le nom n'a pas été lu : tapez-le tel qu'il est imprimé sur le blister, puis « Ajouter à la base ».";
    $("base-fiche").hidden = false;
    if ($("btn-base-autre")) $("btn-base-autre").hidden = true;
    this._deja();
  },

  // Numéros des exemplaires : un champ par exemplaire (le 1er garde l'id base-numero), valeurs déjà tapées conservées
  _grilleNumeros() {
    const zone = $("base-numeros");
    if (!zone) return;
    const n = Math.min(99, Math.max(1, parseInt($("base-nombre").value, 10) || 1));
    const champs = [...zone.querySelectorAll("input")];
    for (let i = champs.length; i < n; i++)
      zone.insertAdjacentHTML("beforeend", `<input class="champ numero-sup" inputmode="numeric" autocomplete="off" placeholder="n° ${i + 1}">`);
    [...zone.querySelectorAll("input")].forEach((c, i) => { if (i >= n) c.remove(); });
    $("base-numeros-titre").textContent = n > 1 ? `N° des ${n} exemplaires` : "N° de l'exemplaire";
    this._numerote();
  },

  // « Déjà recensé » pour le nom affiché
  _deja() {
    if (!$("base-deja")) return;
    const nom = normaliser($("base-nom").value);
    const memes = nom ? this.entrees.filter(e => normaliser(e.nom) === nom) : [];
    const nums = memes.map(e => e.numero).filter(Boolean);
    $("base-deja").textContent = memes.length ? `Déjà recensé : ${memes.length} exemplaire${memes.length > 1 ? "s" : ""}${nums.length ? ` (n° ${nums.join(", ")})` : ""}.` : "";
  },

  async ajouter() {
    const nom = $("base-nom").value.trim().toUpperCase();
    if (!this.photo) { toast("Photographiez d'abord un blister."); return; }
    if (!nom) { await demander("Tapez le nom imprimé sur le blister.", "OK", "Fermer"); return; }
    // nom corrigé à la main : le code de la figurine proposée ne vaut plus
    const code = this.codeLu && normaliser(nom) === normaliser(this.nomLu) ? this.codeLu : "";
    const nonNumerote = !!($("base-non-numerote") && $("base-non-numerote").checked);
    const n = $("base-nombre") ? Math.min(99, Math.max(1, parseInt($("base-nombre").value, 10) || 1)) : 1;
    const numeros = $("base-numeros") ? [...$("base-numeros").querySelectorAll("input")].slice(0, n).map(c => c.value.trim())
      : [$("base-numero") ? $("base-numero").value.trim() : ""];
    while (numeros.length < n) numeros.push("");
    const memes = this.entrees.filter(e => normaliser(e.nom) === normaliser(nom));
    const doublesSaisie = numeros.filter((x, i) => x && numeros.indexOf(x) !== i);
    const dejaLa = numeros.filter(x => x && memes.some(e => e.numero === x));
    if (doublesSaisie.length && !(await demander(`Le n° ${doublesSaisie.join(", ")} est tapé deux fois. Ajouter quand même ?`))) return;
    if (dejaLa.length && !(await demander(`« ${nom} » n° ${dejaLa.join(", ")} est déjà recensé : sans doute le même blister compté deux fois. Ajouter quand même ?`))) return;
    const commun = { nom, numerote: !nonNumerote, serie: $("base-serie").value.trim(), remarque: $("base-remarque").value.trim(),
                     code, photo: this.photo, verso: this.verso, exporte: false };
    for (const numero of numeros)
      this.entrees.push({ ...commun, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
                          numero: nonNumerote ? "" : numero, date: new Date().toISOString() });
    await Memoire.ecrire(this.entrees, "base");
    const total = memes.length + n;
    toast(`« ${nom} » : ${n > 1 ? `${n} exemplaires ajoutés` : "ajouté"} ✔ (${total} au total)`);
    // on garde la figurine : « Autre exemplaire » ne demande que le numéro
    this._precedent = { nom, code, nomLu: this.nomLu, codeLu: this.codeLu, photo: this.photo, verso: this.verso, serie: commun.serie,
                        remarque: commun.remarque, nonNumerote };
    this._nouvelle();
    if ($("btn-base-autre")) { $("btn-base-autre").hidden = false; $("btn-base-autre").textContent = `➕ Autre exemplaire de « ${nom} » (même photo)`; }
    this._afficherListe();
  },

  // Exemplaire suivant de la même figurine : nom, série, note et photo repris ; seul le numéro reste à taper
  autreExemplaire() {
    const p = this._precedent;
    if (!p) return;
    this._nouvelle();
    Object.assign(this, { photo: p.photo, verso: p.verso, nomLu: p.nomLu, codeLu: p.codeLu });
    $("base-photo").src = URL.createObjectURL(p.photo);
    $("base-nom").value = p.nom; $("base-serie").value = p.serie; $("base-remarque").value = p.remarque;
    if ($("base-non-numerote")) { $("base-non-numerote").checked = p.nonNumerote; this._numerote(); }
    $("base-fiche").hidden = false;
    $("base-etat").textContent = "Même figurine : tapez seulement le numéro de cet exemplaire.";
    this._deja();
    if ($("base-numero") && !p.nonNumerote) $("base-numero").focus();
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
      ? `${n} blister${n > 1 ? "s" : ""} recensé${n > 1 ? "s" : ""}, dont ${attente} pas encore exporté${attente > 1 ? "s" : ""}`
      : "Aucun blister recensé pour l'instant.";
    $("btn-base-exporter").hidden = !n;
    $("btn-base-vider").hidden = !this.entrees.some(e => e.exporte);
    if ($("base-vue-photos")) {
      $("base-vue-photos").classList.toggle("actif", this.vue === "photos");
      $("base-vue-compte").classList.toggle("actif", this.vue === "compte");
    }
    if (this.vue === "compte") { this._afficherCompte(); return; }
    $("base-liste").innerHTML = this.entrees.slice().reverse().slice(0, 100).map(e => `
      <div class="fiche">
        <img class="photo" src="${URL.createObjectURL(e.photo)}" alt="">
        <div class="infos"><div class="nom-court">${echapper(e.nom)}</div>
          <div class="lieu">${echapper([e.numerote === false && "non numérotée", e.numero && `n° ${e.numero}${e.serie ? ` / ${e.serie}` : ""}`, !e.numero && e.serie && `série ${e.serie}`, e.remarque,
            e.verso && "recto + verso", e.origine === "album" && "d'après l'album photo", e.code, e.exporte ? "exporté" : "pas encore exporté"].filter(Boolean).join(" · "))}</div></div>
        <button class="petit" data-base-suppr="${e.id}" title="Retirer">✕</button>
      </div>`).join("");
    $("base-liste").querySelectorAll("[data-base-suppr]").forEach(b => b.addEventListener("click", () => this.supprimer(b.dataset.baseSuppr)));
  },

  // Exemplaires recensés par figurine, comparés au nombre acheté (onglet « Customs achetées » du fichier Excel)
  async _afficherCompte() {
    const groupes = new Map();
    for (const e of this.entrees) {
      const k = normaliser(e.nom);
      const g = groupes.get(k) || { nom: e.nom, numeros: [], notes: [], n: 0 };
      g.n++; if (e.numero) g.numeros.push(e.numero); if (e.remarque) g.notes.push(e.remarque); groupes.set(k, g);
    }
    let achats = [];
    try { if (etat.classeur) achats = (await lireCustomsAchetees(etat.classeur)).filter(a => !/^Custom JB \(lot/.test(a.nom)); } catch (err) { console.warn(err); }
    const mots = t => motsCustom(t);
    const achete = nom => {
      const m = mots(nom);
      return m.size ? achats.filter(a => { const x = mots(a.nom); return x.size && [...m].every(w => x.has(w)) && m.size / x.size >= 0.6; }).length : 0;
    };
    const liste = [...groupes.values()].sort((a, b) => b.n - a.n || a.nom.localeCompare(b.nom));
    $("base-liste").innerHTML = liste.length ? `<p class="aide">« Acheté » : achats nommés de votre fichier Excel. Les achats en lot pas encore
      nommés n'y sont pas : un blister compté sans achat correspondant vient peut-être d'un lot.</p>` + liste.map(g => {
        const a = achete(g.nom);
        const etatTxt = !a ? "" : a === g.n ? `<span class="recense-ok">= acheté ${a}</span>` : `<span class="recense-ecart">acheté ${a}</span>`;
        return `<div class="ligne-valeur"><span>${echapper(g.nom)}${g.numeros.length ? ` <span class="score">n° ${echapper(g.numeros.join(", "))}</span>` : ""}${g.notes.length ? ` <span class="badge">${echapper(g.notes.join(" · "))}</span>` : ""}</span>
          <span><b>×${g.n}</b> ${etatTxt}</span></div>`;
      }).join("") : "";
  },

  // Blisters identifiés sur l'album photo partagé (album_photos/recensement.tsv du dépôt privé, lu avec le jeton GitHub) :
  // ajoutés au recensement avec leur photo, sans ceux déjà recensés (même nom et même n°, ou même nom sans n°)
  async importerAlbum() {
    try {
      Valeur.jeton = Valeur.jeton || await Memoire.lire("jeton-github");
      if (!Valeur.jeton) { await demander("Enregistrez d'abord votre jeton GitHub dans l'écran Valeur.", "OK", "Fermer"); return; }
      const rep = await Valeur._api("/contents/album_photos/recensement.tsv", { headers: { Accept: "application/vnd.github.raw" } });
      if (!rep.ok) { await demander("La liste des blisters de l'album n'est pas dans votre dépôt privé.", "OK", "Fermer"); return; }
      const album = (await rep.text()).split("\n").slice(1).filter(Boolean).map(l => {
        const [nom, numero, serie, code, photo] = l.split("\t");
        return { nom: nom.toUpperCase(), numero, serie, code, photo };
      });
      const deja = e => this.entrees.some(x => normaliser(x.nom) === normaliser(e.nom) && (e.numero ? x.numero === e.numero : true));
      const nouveaux = album.filter(e => !deja(e));
      if (!nouveaux.length) { await demander("Tous les blisters de votre album sont déjà dans le recensement.", "OK", "Fermer"); return; }
      if (!(await demander(`Ajouter au recensement ${nouveaux.length} blister(s) identifiés sur vos photos (${nouveaux.filter(e => e.numero).length} avec leur n°) ?\n\n` +
          "Ils seront marqués « d'après l'album photo » : vérifiez-les pendant votre recensement physique (un blister vendu ou donné depuis est à retirer).",
          "Ajouter", "Annuler"))) return;
      let i = 0;
      for (const e of nouveaux) {
        $("base-etat").textContent = `Reprise de l'album… (${++i} sur ${nouveaux.length})`;
        let photo = null;
        try {
          const r = await Valeur._api(`/contents/album_photos/${e.photo}`, { headers: { Accept: "application/vnd.github.raw" } });
          if (r.ok) photo = await r.blob();
        } catch (err) { console.warn(err); }
        if (!photo) continue;
        this.entrees.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nom: e.nom, numero: e.numero || "",
          numerote: true, serie: e.serie || "", remarque: "", origine: "album", code: e.code || "", date: new Date().toISOString(),
          photo, verso: null, exporte: true });
      }
      await Memoire.ecrire(this.entrees, "base");
      $("base-etat").textContent = "";
      toast(`${i} blister(s) de l'album ajoutés au recensement ✔`, 5000);
      this._afficherListe();
    } catch (err) { console.error(err); await demander("La reprise de l'album a échoué : " + err.message, "OK", "Fermer"); }
  },

  // .zip : base.tsv (id, nom, série, remarque, code reconnu, date, photo) + photos/<id>.jpg
  async exporter() {
    if (!this.entrees.length) return;
    const zip = new JSZip();
    const lignes = ["id\tnom\tnumerote\tnumero\tserie\tremarque\tcode\tdate\tphoto\tverso"];
    for (const e of this.entrees) {
      zip.file(`photos/${e.id}.jpg`, e.photo);
      if (e.verso) zip.file(`photos/${e.id}_verso.jpg`, e.verso);
      lignes.push([e.id, e.nom, e.numerote === false ? "non" : "oui", e.numero, e.serie, e.remarque, e.code, e.date, `photos/${e.id}.jpg`, e.verso ? `photos/${e.id}_verso.jpg` : ""].map(v => String(v || "").replace(/[\t\n]/g, " ")).join("\t"));
    }
    zip.file("base.tsv", lignes.join("\n") + "\n");
    const contenu = await zip.generateAsync({ type: "blob" });
    const nom = `blisters_JB_${horodatage()}.zip`;
    const fichier = new File([contenu], nom, { type: "application/zip" });
    // iPhone (et Android) : menu « Partager » (Messages, WhatsApp, Mail, AirDrop, Fichiers…) ; sinon téléchargement
    let envoye = false;
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      if (await demander(`Fichier prêt : ${this.entrees.length} blister${this.entrees.length > 1 ? "s" : ""}.\n\nTouchez « Envoyer » puis choisissez Messages, ` +
          "WhatsApp, Mail… (ou « Enregistrer dans Fichiers »).", "📤 Envoyer", "Annuler")) {
        try {
          await navigator.share({ files: [fichier], title: "Blisters JB", text: `${this.entrees.length} blisters JB pour la base commune` });
          envoye = true;
        } catch (err) {
          if (err.name !== "AbortError") { console.error(err); envoye = this._telecharger(fichier); }
        }
      }
    } else envoye = this._telecharger(fichier);
    if (!envoye) return;
    for (const e of this.entrees) e.exporte = true;
    await Memoire.ecrire(this.entrees, "base");
    this._afficherListe();
    toast(`${this.entrees.length} blister${this.entrees.length > 1 ? "s envoyés" : " envoyé"} ✔ Merci !`, 5000);
  },

  _telecharger(fichier) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(fichier);
    a.download = fichier.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    demander(`Fichier « ${fichier.name} » enregistré dans Téléchargements.\n\n` +
      "Envoyez-le moi (ou mettez-le dans Google Drive) pour que je l'ajoute à la base de l'appli.", "OK", "Fermer");
    return true;
  },

  async vider() {
    const n = this.entrees.filter(e => e.exporte).length;
    if (!n || !(await demander(`Effacer du téléphone les ${n} blisters déjà exportés ? (le fichier exporté les garde)`))) return;
    this.entrees = this.entrees.filter(e => !e.exporte);
    await Memoire.ecrire(this.entrees, "base");
    this._afficherListe();
  },
};

if ($("base-non-numerote")) $("base-non-numerote").addEventListener("change", () => Base._numerote());
if ($("base-nombre")) $("base-nombre").addEventListener("input", () => Base._grilleNumeros());
if ($("base-nom")) $("base-nom").addEventListener("input", () => Base._deja());
if ($("base-notes")) $("base-notes").addEventListener("click", e => {
  const b = e.target.closest("[data-note]");
  if (!b) return;
  const champ = $("base-remarque"), n = b.dataset.note;
  if (!champ.value.includes(n)) champ.value = champ.value.trim() ? `${champ.value.trim()}, ${n}` : n;
});

if ($("input-base-verso")) $("input-base-verso").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  Base.verso = await Base._reduire(f, 0);
  $("base-verso").src = URL.createObjectURL(Base.verso);
  $("base-verso").hidden = false;
});

for (const id of ["input-base", "input-base-galerie"]) // appareil photo, ou photo déjà prise (galerie)
  if ($(id)) $(id).addEventListener("change", e => {
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
  else if (action === "base-autre") Base.autreExemplaire();
  else if (action === "base-importer-album") Base.importerAlbum();
  else if (action === "base-vue-photos") { Base.vue = "photos"; Base._afficherListe(); }
  else if (action === "base-vue-compte") { Base.vue = "compte"; Base._afficherListe(); }
});
