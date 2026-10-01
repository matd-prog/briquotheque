// Consulter la base des figurines JB : catalogue JB Spielwaren (en vente), figurines retirées (brickshellcases,
// archives, eBay.de), blisters photographiés par des collectionneurs (code ALB-…), et « mes photos » de blisters
// (album_photos/ du dépôt privé, lues avec le jeton GitHub de l'écran Valeur : elles ne sont pas publiées).

const Consulter = {
  PAR_PAGE: 60,
  affichees: 0,
  resultats: [],
  mesPhotos: null,   // Map code -> [chemins], depuis album_photos/blisters.tsv du dépôt privé
  _images: new Map(), // chemin -> URL locale (blob) déjà téléchargée

  async ouvrir() {
    afficher("consulter");
    $("consulter-info").textContent = "Chargement de la base…";
    try { await CatalogueJB.charger(); } catch (err) { $("consulter-info").textContent = "Base JB indisponible (réseau ?)."; return; }
    await this._chargerMesPhotos();
    await this._chargerMaBase();
    this.lister();
  },

  // Blisters photographiés dans l'appli (« Ma base de blisters », gardés dans le téléphone) : rattachés à la figurine
  // du catalogue (code, sinon même nom) ; les autres deviennent des fiches « Ma base de blisters »
  maBase: new Map(),   // code du catalogue -> [blisters]
  persos: [],          // fiches des blisters absents du catalogue
  async _chargerMaBase() {
    this.maBase = new Map(); this.persos = [];
    let entrees = [];
    try { entrees = ((await Memoire.lire("base")) || []).filter(e => e.photo && e.nom && e.possede !== false); } catch (err) { console.warn(err); }
    const parNom = new Map(CatalogueJB.liste.map(f => [normaliser(nomCustomPourFichier(f.nom)), f]));
    const groupes = new Map();
    for (const e of entrees) {
      const f = (e.code && CatalogueJB.trouver(e.code)) || (!e.precision && parNom.get(normaliser(e.nom))) || null;
      if (f) {
        const k = f.code.toUpperCase();
        if (!this.maBase.has(k)) this.maBase.set(k, []);
        this.maBase.get(k).push(e);
      } else {
        const k = cleFigurine(e.nom, e.precision);
        if (!groupes.has(k)) groupes.set(k, []);
        groupes.get(k).push(e);
      }
    }
    for (const [k, l] of groupes)
      this.persos.push({ code: "PERSO-" + k, nom: nomComplet(l[0]), categorie: "", lien: "", image: "", source: "perso",
                         recherche: normaliser(nomComplet(l[0])), perso: l });
  },

  // Photos de l'album (dépôt privé) d'une figurine, sous son code et ses alias
  _album(f) {
    if (!this.mesPhotos) return [];
    const codes = f.alias ? CatalogueJB.codes(f) : [f.code.toUpperCase()];
    return codes.flatMap(c => this.mesPhotos.get(c) || []);
  },

  _miennes(f) { return f.perso || this.maBase.get(f.code.toUpperCase()) || []; },

  async _chargerMesPhotos() {
    if (this.mesPhotos) return;
    try {
      Valeur.jeton = Valeur.jeton || await Memoire.lire("jeton-github");
      if (!Valeur.jeton) return;
      const rep = await Valeur._api("/contents/album_photos/blisters.tsv", { headers: { Accept: "application/vnd.github.raw" } });
      if (!rep.ok) return;
      this.mesPhotos = new Map();
      for (const l of (await rep.text()).split("\n").slice(1)) {
        const [photo, nom, numero, code] = l.split("\t");
        if (!photo || !code) continue;
        const k = code.toUpperCase();
        if (!this.mesPhotos.has(k)) this.mesPhotos.set(k, []);
        this.mesPhotos.get(k).push({ photo, nom, numero });
      }
      // photos de la base commune (album_photos/commune.tsv, js/base_commune.js)
      const rc = await Valeur._api("/contents/album_photos/commune.tsv", { headers: { Accept: "application/vnd.github.raw" } });
      if (rc.ok) for (const l of (await rc.text()).split("\n").slice(1)) {
        const [code, nom, , numero, serie, , , , photo] = l.split("\t");
        if (!code || !photo) continue;
        const k = code.toUpperCase();
        if (!this.mesPhotos.has(k)) this.mesPhotos.set(k, []);
        this.mesPhotos.get(k).push({ photo, nom, numero: numero ? `${numero}${serie ? "/" + serie : ""}` : "" });
      }
    } catch (err) { console.warn(err); }
  },

  _source(f) {
    return f.source === "jb" && f.epuisee ? `Épuisée chez JB${f.prix ? ` (était à ${f.prix.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })})` : ""}`
      : f.source === "jb" ? (f.prix ? `En vente chez JB · ${f.prix.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}` : "Catalogue JB")
      : f.source === "album" ? "Photo de collectionneur" : f.source === "perso" ? "Ma base de blisters · pas encore dans la base JB" : f.source === "commune" ? "Base commune (photo d'un collectionneur)"
      : f.source === "brickshell" ? "Retirée · brickshellcases"
      : f.source === "archive" ? "Retirée · archives" : "Retirée · eBay.de";
  },

  lister() {
    const q = $("consulter-recherche").value.trim(), filtre = $("consulter-filtre").value;
    let liste = q ? CatalogueJB.chercher(q, 100000) : CatalogueJB.liste.slice();
    const nq = normaliser(q);
    liste = liste.concat(this.persos.filter(f => !nq || nq.split(" ").every(m => f.recherche.includes(m))));
    const mes = f => this._album(f).length > 0 || this._miennes(f).length > 0;
    if (filtre === "jb") liste = liste.filter(f => f.source === "jb" && !f.epuisee);
    else if (filtre === "retirees") liste = liste.filter(f => f.epuisee || ["brickshell", "archive", "ebay"].includes(f.source));
    else if (filtre === "album") liste = liste.filter(f => f.source === "album");
    else if (filtre === "mes") liste = liste.filter(mes);
    // blisters avec photo d'abord, puis par nom
    const aPhoto = f => !!f.image || mes(f);
    liste.sort((a, b) => aPhoto(b) - aPhoto(a) || a.nom.localeCompare(b.nom));
    this.resultats = liste; this.affichees = 0;
    $("consulter-liste").innerHTML = "";
    const n = liste.length;
    const nMes = liste.filter(mes).length;
    $("consulter-info").textContent = `${n} figurine${n > 1 ? "s" : ""}` + (nMes ? `, dont ${nMes} avec vos photos (📷)` : "") +
      (!this.mesPhotos && filtre === "mes" ? ". Photos de l'album : enregistrez votre jeton GitHub (écran Valeur) pour les voir aussi." : "");
    this.suite();
  },

  suite() {
    const lot = this.resultats.slice(this.affichees, this.affichees + this.PAR_PAGE);
    const mes = f => this._album(f);
    const debut = this.affichees;
    const html = lot.map((f, k) => {
      const photos = mes(f), miennes = this._miennes(f);
      const voirMiennes = (miennes.length || photos.length) && ($("consulter-filtre").value === "mes" || !f.image);
      const nums = miennes.map(e => e.numero).filter(Boolean);
      return `<button class="proposition" data-fiche="${debut + k}">
        ${voirMiennes && miennes.length ? `<img src="${URL.createObjectURL(miennes[0].photo)}" alt="">`
          : voirMiennes ? `<img data-photo="${echapper(photos[0].photo)}" alt="">`
          : f.image ? `<img src="${echapper(f.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<div class="sans-photo">Pas de photo</div>`}
        <span class="nom-court">${echapper(f.nom)}</span>
        <span class="score">${echapper(this._source(f))}${miennes.length ? ` · 📚 ${miennes.length} dans ma base${nums.length ? ` (n° ${echapper(nums.join(", "))})` : ""}` : ""}${photos.length ? ` · 📷 ${photos.length} (album)` : ""}</span>
      </button>`;
    }).join("");
    $("consulter-liste").insertAdjacentHTML("beforeend", html);
    this.affichees += lot.length;
    $("consulter-plus").hidden = this.affichees >= this.resultats.length;
    this._chargerImages();
  },

  // Photo d'un blister (code JB-… ou ALB-…) prise dans l'album de l'utilisateur, ou "" (pas de jeton, pas de photo)
  async maPhoto(code) {
    await this._chargerMesPhotos();
    const f = CatalogueJB.trouver(code);
    const photos = f ? this._album(f) : (this.mesPhotos && this.mesPhotos.get((code || "").toUpperCase()));
    if (!photos || !photos.length) return "";
    const chemin = photos[0].photo;
    try {
      if (!this._images.has(chemin)) {
        const rep = await Valeur._api(`/contents/album_photos/${chemin}`, { headers: { Accept: "application/vnd.github.raw" } });
        if (!rep.ok) return "";
        this._images.set(chemin, URL.createObjectURL(await rep.blob()));
      }
      return this._images.get(chemin);
    } catch (err) { console.warn(err); return ""; }
  },

  // Images vides (blisters de collectionneur, sans photo publique) : remplies avec vos photos d'album
  completerPhotos(racine) {
    for (const img of (racine || document).querySelectorAll("img[data-ma-photo]:not([src])"))
      this.maPhoto(img.dataset.maPhoto).then(url => { if (url) { img.src = url; img.style.visibility = ""; } });
  },

  // Fiche d'une figurine : mes blisters (recto et verso), photos de l'album, photo du catalogue, lien vers sa page
  fiche(f) {
    const images = [];
    for (const e of this._miennes(f)) images.push(...Base.imagesBlister(e).map(im => ({ ...im, legende: "Mon blister · " + im.legende })));
    const album = this._album(f);
    album.forEach((ph, i) => images.push({ src: this._imageAlbum(ph.photo),
      legende: `Photo de collectionneur ${i + 1}/${album.length}${ph.numero ? ` · n° ${ph.numero}` : ""}` }));
    if (f.image) images.push({ src: f.image, legende: this._source(f) });
    Visionneuse.ouvrir(f.nom, images, f.lien, f.ebay ? "Chercher sur eBay.de" : "Voir sa page");
  },

  async _imageAlbum(chemin) {
    if (!this._images.has(chemin)) {
      const rep = await Valeur._api(`/contents/album_photos/${chemin}`, { headers: { Accept: "application/vnd.github.raw" } });
      if (!rep.ok) return "";
      this._images.set(chemin, URL.createObjectURL(await rep.blob()));
    }
    return this._images.get(chemin);
  },

  // Photos du dépôt privé : téléchargées une à une avec le jeton (pas d'adresse publique)
  async _chargerImages() {
    for (const img of $("consulter-liste").querySelectorAll("img[data-photo]:not([src])")) {
      const chemin = img.dataset.photo;
      try {
        if (!this._images.has(chemin)) {
          const rep = await Valeur._api(`/contents/album_photos/${chemin}`, { headers: { Accept: "application/vnd.github.raw" } });
          if (!rep.ok) continue;
          this._images.set(chemin, URL.createObjectURL(await rep.blob()));
        }
        img.src = this._images.get(chemin);
      } catch (err) { console.warn(err); }
    }
  },
};

if ($("consulter-recherche")) {
  let minuteur;
  $("consulter-recherche").addEventListener("input", () => { clearTimeout(minuteur); minuteur = setTimeout(() => Consulter.lister(), 250); });
  $("consulter-filtre").addEventListener("change", () => Consulter.lister());
  $("consulter-plus").addEventListener("click", () => Consulter.suite());
  $("consulter-liste").addEventListener("click", e => {
    const b = e.target.closest("[data-fiche]");
    if (b) Consulter.fiche(Consulter.resultats[+b.dataset.fiche]);
  });
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (b && b.dataset.action === "consulter") Consulter.ouvrir();
});
