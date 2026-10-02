// Base commune des blisters JB : on photographie ses blisters un par un, le nom est lu (js/blister.js),
// on le vérifie, et la photo réduite + le nom sont gardés dans le téléphone. « Exporter » crée un .zip
// (base.tsv + photos/) à intégrer ensuite à la base de l'appli, pour reconnaître ces blisters (nom et décor),
// en particulier les anciennes éditions introuvables en ligne. Utilisable sans fichier Excel.

// Figurine = nom imprimé + précision éventuelle (ex. « CHROME COLLECTION » + « Harley Quinn, chromée rose ») :
// deux figurines de même nom imprimé mais de précision différente ne sont pas comptées ensemble
const nomComplet = e => [e.nom, e.precision].filter(Boolean).join(" – ");
const cleFigurine = (nom, precision) => normaliser([nom, precision].filter(Boolean).join(" "));

const Base = {
  photo: null,     // photo en cours (Blob JPEG réduit, remis d'aplomb)
  codeLu: "",      // code de la figurine reconnue, s'il y en a une, et son nom (nomLu)
  nomLu: "",
  verso: null,     // photo du verso (demandée à chaque blister, « Passer » possible)
  source: null,    // photos d'origine { fichier, sens } du recto et du verso, pour recadrer à nouveau
  sourceVerso: null,
  cadre: null,     // cadre du blister sur la photo (fractions { x, y, l, h }), trouvé seul ou ajusté ; null = photo entière
  cadreVerso: null,
  versoPasse: false,
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
    this.photo = null; this.verso = null; this.versoPasse = false;
    this.source = this.sourceVerso = this.cadre = this.cadreVerso = null;
    if ($("base-recadrage")) $("base-recadrage").hidden = true;
    if ($("base-recadrer-boutons")) $("base-recadrer-boutons").hidden = true; this.codeLu = ""; this.nomLu = ""; this.decor = []; this.proches = []; this.semblables = [];
    if ($("base-identite")) $("base-identite").innerHTML = "";
    $("base-photo").removeAttribute("src");
    if ($("base-verso")) { $("base-verso").removeAttribute("src"); $("base-verso").hidden = true; }
    for (const id of ["base-etape-verso", "base-verso-refaire", "base-autre"]) if ($(id)) $(id).hidden = true;
    $("base-fiche").hidden = true;
    $("base-etat").textContent = "";
    for (const id of ["base-nom", "base-precision", "base-serie", "base-remarque", "base-numero"]) if ($(id)) $(id).value = "";
    if ($("base-nombre")) { $("base-nombre").value = 1; this._grilleNumeros(); }
    if ($("base-non-numerote")) { $("base-non-numerote").checked = false; this._numerote(); }
    if ($("base-deja")) $("base-deja").textContent = "";
    $("base-suggestions").innerHTML = "";
    if ($("base-bloc-excel")) $("base-bloc-excel").hidden = !(typeof etat !== "undefined" && etat.classeur);
  },

  // Photo réduite (1000 px au plus), éventuellement tournée d'un quart de tour et recadrée (cadre en fractions)
  async _reduire(fichier, sens, cadre) {
    let image = await createImageBitmap(fichier);
    if (sens) image = tourner(image, sens);
    const c = cadre || { x: 0, y: 0, l: 1, h: 1 };
    const sx = Math.round(c.x * image.width), sy = Math.round(c.y * image.height);
    const sw = Math.max(1, Math.round(c.l * image.width)), sh = Math.max(1, Math.round(c.h * image.height));
    const k = Math.min(1, 1000 / Math.max(sw, sh));
    const cv = document.createElement("canvas");
    cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
    cv.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    return new Promise(ok => cv.toBlob(ok, "image/jpeg", 0.82));
  },

  // Cadre du blister sur la photo : fond estimé sur le pourtour, pixels qui s'en écartent (couleur, ou contraste
  // du carton imprimé), puis la plus longue bande de lignes et de colonnes « pleines ». null si incertain (on garde
  // alors la photo entière ; « ✂️ Recadrer » permet d'ajuster à la main).
  _cadreAuto(image) {
    const L = 160, k = L / Math.max(image.width, image.height);
    const w = Math.max(8, Math.round(image.width * k)), h = Math.max(8, Math.round(image.height * k));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cx = cv.getContext("2d"); cx.drawImage(image, 0, 0, w, h);
    const px = cx.getImageData(0, 0, w, h).data;
    const b = Math.max(1, Math.round(Math.min(w, h) * 0.04)), bord = [[], [], []];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (x < b || y < b || x >= w - b || y >= h - b) { const i = (y * w + x) * 4; for (let c = 0; c < 3; c++) bord[c].push(px[i + c]); }
    const med = bord.map(t => t.sort((a, z) => a - z)[t.length >> 1]);
    const masque = new Uint8Array(w * h);
    const lum = i => px[i] * .3 + px[i + 1] * .59 + px[i + 2] * .11;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const d = Math.abs(px[i] - med[0]) + Math.abs(px[i + 1] - med[1]) + Math.abs(px[i + 2] - med[2]);
      const g = Math.abs(lum(i + 4) - lum(i - 4)) + Math.abs(lum(i + 4 * w) - lum(i - 4 * w));
      masque[y * w + x] = d > 90 || (d > 45 && g > 25) ? 1 : 0;
    }
    const bande = (n, part) => { // plus longue suite d'indices « pleins » (petits trous tolérés)
      let best = [0, -1], debut = -1, trou = 0;
      for (let i = 0; i <= n; i++) {
        if (i < n && part(i) > 0.18) { if (debut < 0) debut = i; trou = 0; }
        else if (debut >= 0 && (++trou > Math.max(2, n * 0.03) || i === n)) {
          const fin = i - trou; if (fin - debut > best[1] - best[0]) best = [debut, fin]; debut = -1; trou = 0;
        }
      }
      return best;
    };
    const [y0, y1] = bande(h, y => { let s = 0; for (let x = 0; x < w; x++) s += masque[y * w + x]; return s / w; });
    if (y1 - y0 < h * 0.15) return null;
    const [x0, x1] = bande(w, x => { let s = 0; for (let y = y0; y <= y1; y++) s += masque[y * w + x]; return s / (y1 - y0 + 1); });
    if (x1 - x0 < w * 0.15) return null;
    const m = 0.03, c = { x: Math.max(0, x0 / w - m), y: Math.max(0, y0 / h - m) };
    c.l = Math.min(1, (x1 + 1) / w + m) - c.x; c.h = Math.min(1, (y1 + 1) / h + m) - c.y;
    return c.l * c.h > 0.9 || c.l * c.h < 0.06 ? null : c;
  },

  // Photo (recto ou verso) : remise d'aplomb, recadrée sur le blister si on le trouve
  async _preparer(fichier, sens) {
    const entiere = await this._reduire(fichier, sens);
    let cadre = null;
    try { cadre = this._cadreAuto(await createImageBitmap(entiere)); } catch (err) { console.warn(err); }
    return { blob: cadre ? await this._reduire(fichier, sens, cadre) : entiere, cadre };
  },

  _boutonsRecadrer() {
    if (!$("base-recadrer-boutons")) return;
    $("base-recadrer-boutons").hidden = !this.source;
    $("btn-recadrer-verso").hidden = !this.sourceVerso;
  },

  // Recadrage à la main : cadre de départ = cadre actuel (ou presque toute la photo)
  async recadrer(quoi) {
    const src = quoi === "verso" ? this.sourceVerso : this.source;
    if (!src || !$("base-recadrage")) return;
    const img = $("base-recadrage-image");
    img.src = URL.createObjectURL(await this._reduire(src.fichier, src.sens));
    await img.decode().catch(() => {});
    this._cadreEdite = { ...((quoi === "verso" ? this.cadreVerso : this.cadre) || { x: 0.05, y: 0.05, l: 0.9, h: 0.9 }) };
    this._quoiEdite = quoi;
    $("base-recadrage-titre").textContent = `Ajustez le cadre autour du blister (${quoi}) : glissez-le, ou tirez ses coins.`;
    $("base-recadrage").hidden = false;
    this._dessinerCadre();
    $("base-recadrage").scrollIntoView({ block: "start" });
  },

  _dessinerCadre() {
    const c = this._cadreEdite, el = $("base-recadrage-cadre");
    Object.assign(el.style, { left: c.x * 100 + "%", top: c.y * 100 + "%", width: c.l * 100 + "%", height: c.h * 100 + "%" });
  },

  async finRecadrage(choix) { // "ok", "entiere" ou "annuler"
    $("base-recadrage").hidden = true;
    if (choix === "annuler") return;
    const cadre = choix === "entiere" ? null : this._cadreEdite;
    if (this._quoiEdite === "verso") {
      this.cadreVerso = cadre;
      this.verso = await this._reduire(this.sourceVerso.fichier, this.sourceVerso.sens, cadre);
      $("base-verso").src = URL.createObjectURL(this.verso);
    } else {
      this.cadre = cadre;
      this.photo = await this._reduire(this.source.fichier, this.source.sens, cadre);
      $("base-photo").src = URL.createObjectURL(this.photo);
      // décor et ressemblances recalculés sur la nouvelle image
      try { this.decor = CatalogueJB.classerParDecor(await createImageBitmap(this.photo), 10); } catch (err) { console.warn(err); }
      this.semblables = await this._semblablesCollection().catch(() => []);
      if (!$("base-fiche").hidden) this._deja();
    }
    window.scrollTo(0, 0);
  },

  _installerRecadrage() {
    const zone = $("base-recadrage-zone");
    if (!zone) return;
    let geste = null;
    const MIN = 0.1, borner = (v, a, b) => Math.min(b, Math.max(a, v));
    zone.addEventListener("pointerdown", e => {
      const poignee = e.target.closest("[data-coin]");
      if (!poignee && !e.target.closest("#base-recadrage-cadre")) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      geste = { coin: poignee ? poignee.dataset.coin : null, x0: e.clientX, y0: e.clientY, r: zone.getBoundingClientRect(), depart: { ...this._cadreEdite } };
    });
    zone.addEventListener("pointermove", e => {
      if (!geste) return;
      const dx = (e.clientX - geste.x0) / geste.r.width, dy = (e.clientY - geste.y0) / geste.r.height, d = geste.depart;
      let { x, y, l, h } = d;
      if (!geste.coin) { x = borner(d.x + dx, 0, 1 - d.l); y = borner(d.y + dy, 0, 1 - d.h); }
      else {
        if (geste.coin.includes("g")) { x = borner(d.x + dx, 0, d.x + d.l - MIN); l = d.x + d.l - x; }
        if (geste.coin.includes("d")) l = borner(d.l + dx, MIN, 1 - d.x);
        if (geste.coin.includes("h")) { y = borner(d.y + dy, 0, d.y + d.h - MIN); h = d.y + d.h - y; }
        if (geste.coin.includes("b")) h = borner(d.h + dy, MIN, 1 - d.y);
      }
      this._cadreEdite = { x, y, l, h };
      this._dessinerCadre();
    });
    for (const f of ["pointerup", "pointercancel"]) zone.addEventListener(f, () => { geste = null; });
  },

  // « Non numérotée » : pas de numéro ni de série limitée
  _numerote() {
    const non = $("base-non-numerote") && $("base-non-numerote").checked;
    const champs = [...($("base-numeros") ? $("base-numeros").querySelectorAll("input") : []), $("base-numero"), $("base-serie")].filter(Boolean);
    // grisés (valeurs gardées : décocher les retrouve ; elles sont ignorées à l'ajout)
    for (const c of champs) { c.disabled = non; const l = c.closest("div") && c.closest("div").querySelector("label"); if (l) l.classList.toggle("grise", non); }
    if ($("base-numeros-titre")) $("base-numeros-titre").classList.toggle("grise", non);
    if ($("base-numeros-etat")) $("base-numeros-etat").hidden = non;
  },

  async lirePhoto(fichier) {
    this._nouvelle();
    $("base-photo").src = URL.createObjectURL(fichier);
    this._demanderVerso();
    $("base-etat").textContent = "Lecture du nom… (la première fois, téléchargement de l'outil de lecture, environ 27 Mo)";
    let lecture = { texte: "", trouve: false, sens: 0 };
    try {
      await CatalogueJB.charger();
      lecture = await Blister.lireEntier(fichier, (i, n) => {
        if (i > 1) $("base-etat").textContent = `Lecture du nom… (essai ${i} sur ${n})`;
      });
    } catch (err) { console.error(err); }
    this.source = { fichier, sens: lecture.sens || 0 };
    ({ blob: this.photo, cadre: this.cadre } = await this._preparer(fichier, this.source.sens));
    $("base-photo").src = URL.createObjectURL(this.photo);
    this._boutonsRecadrer();
    // propositions : figurines connues dont le nom a été lu, puis le nom le plus probable du carton
    let connues = lecture.trouve ? CatalogueJB.rapprocher(lecture.texte, 8) : [];
    const lus = new Set(connues); // blisters dont le nom a été lu sur le carton
    // nom lu et décor ensemble : chaque blister a la ressemblance de son décor (0,8 s'il n'a pas d'empreinte), plus un
    // bonus si son nom a été lu. Même nom imprimé (ex. trois « SPECIAL WHATNOT FIGURE 2025 ») : le décor départage.
    this.proches = [];
    try {
      await CatalogueJB.chargerEmpreintes();
      const tous = CatalogueJB.classerParDecor(await createImageBitmap(this.photo), 100000);
      this.decor = tous.slice(0, 10);
      const score = new Map(tous.map(r => [r.f, r.score]));
      const note = f => (score.has(f) ? score.get(f) : 0.8) + (lus.has(f) ? 0.06 : 0);
      connues = [...new Set([...connues, ...tous.slice(0, connues.length ? 3 : 5).map(r => r.f)])].sort((a, b) => note(b) - note(a)).slice(0, 5);
      // plusieurs blisters presque aussi ressemblants : à départager à l'œil (photos)
      // (même nom lu que le premier : un décor voisin d'un autre nom ne compte pas)
      if (connues.length) this.proches = connues.filter(f => score.has(f) && lus.has(f) === lus.has(connues[0]) && note(f) >= note(connues[0]) - 0.03);
      if (this.proches.length < 2) this.proches = [];
      // même carton : la figurine seule départage (ex. Dark Vador doré / droïde argenté / droïde noir)
      const fig = CatalogueJB.departager(await createImageBitmap(this.photo), this.proches);
      if (fig.length) {
        const ordre = [...fig.map(r => r.f), ...this.proches.filter(f => !fig.some(r => r.f === f))];
        connues = [...ordre, ...connues.filter(f => !ordre.includes(f))];
        this.proches = ordre;
      }
    } catch (err) { console.warn(err); }
    const noms = [...connues.map(f => ({ ...this._nomEtPrecision(f), code: f.code })),
                  ...(nomProbable(lecture.texte) ? [{ nom: nomProbable(lecture.texte).toUpperCase(), precision: "", code: "" }] : [])]
      .filter((s, i, t) => s.nom && t.findIndex(x => x.nom === s.nom && x.precision === s.precision) === i);
    if (noms.length) this._choisirNom(noms[0]);
    $("base-suggestions").innerHTML = noms.length > 1
      ? noms.map((s, i) => `<button class="petit" data-base-nom="${i}">${echapper(nomComplet(s))}</button>`).join("") : "";
    $("base-suggestions").querySelectorAll("[data-base-nom]").forEach(b => b.addEventListener("click", () => {
      this._choisirNom(noms[+b.dataset.baseNom]);
      this._deja();
    }));
    this.semblables = await this._semblablesCollection().catch(() => []);
    const serie = /limited\s*to\s*(\d{2,4})|\b(?:of|von)\s*(\d{2,4})\b/i.exec(lecture.texte);
    if (serie) $("base-serie").value = serie[1] || serie[2];
    const numero = /\b(\d{1,4})\s*(?:of|von)\s*\d{2,4}\b/i.exec(lecture.texte);
    if (numero && $("base-numero")) $("base-numero").value = numero[1];
    $("base-etat").textContent = noms.length ? "Vérifiez le nom et le numéro, puis « Ajouter »."
      : "Le nom n'a pas été lu : tapez-le tel qu'il est imprimé sur le blister, ou choisissez un blister qui ressemble.";
    $("base-fiche").hidden = false;
    this._deja();
  },

  // Nom à écrire pour un blister du catalogue : nom imprimé (sans « Custom Minifigure »), et précision pour ceux de
  // la base commune (« SPECIAL WHATNOT FIGURE 2025 » + « DARK VADOR CHROME ORANGE »)
  _nomEtPrecision(f) {
    if (f.nomImprime) return { nom: f.nomImprime.toUpperCase(), precision: (f.precision || "").toUpperCase() };
    const court = f.nom.replace(/\s*[-–]?\s*\bc[ou]s?t[ou]m\b.*$/i, "").replace(/\s+minifig\w*.*$/i, "").trim();
    return { nom: court.toUpperCase(), precision: "" };
  },
  _choisirNom(s) {
    $("base-nom").value = this.nomLu = s.nom; this.codeLu = s.code;
    if ($("base-precision") && (s.precision || s.code)) $("base-precision").value = s.precision || "";
  },

  // Verso : demandé à chaque blister (preuve et état pour l'assureur, photos prêtes pour une annonce)
  _demanderVerso() {
    if (!$("base-etape-verso")) return;
    $("base-etape-verso").hidden = !!this.verso || this.versoPasse;
    if ($("base-verso-refaire")) $("base-verso-refaire").hidden = !this.verso;
  },

  async prendreVerso(fichier) {
    this.sourceVerso = { fichier, sens: 0 };
    ({ blob: this.verso, cadre: this.cadreVerso } = await this._preparer(fichier, 0));
    this._boutonsRecadrer();
    $("base-verso").src = URL.createObjectURL(this.verso);
    $("base-verso").hidden = false;
    this._demanderVerso();
  },

  passerVerso() { this.versoPasse = true; this._demanderVerso(); },

  // Numéros des exemplaires : un champ par exemplaire (le 1er garde l'id base-numero), valeurs déjà tapées conservées
  _grilleNumeros() {
    const zone = $("base-numeros");
    if (!zone) return;
    const n = Math.min(99, Math.max(1, parseInt($("base-nombre").value, 10) || 1));
    const champs = [...zone.querySelectorAll("input")];
    for (let i = champs.length; i < n; i++)
      zone.insertAdjacentHTML("beforeend", `<input class="champ numero-sup" inputmode="numeric" autocomplete="off" placeholder="n° ${i + 1}">`);
    [...zone.querySelectorAll("input")].forEach((c, i) => { if (i >= n) c.remove(); });
    $("base-numeros-titre").textContent = n > 1 ? `N° des ${n} exemplaires (même photo pour tous)` : "N° de l'exemplaire";
    this._numerote();
  },

  // Vos blisters déjà recensés dont le décor ressemble à la photo (même figurine photographiée, ou confusion possible)
  async _semblablesCollection() {
    if (typeof empreinteImage !== "function" || !this.photo || !this.entrees.length) return [];
    const e0 = empreinteImage(await createImageBitmap(this.photo), false);
    let calcule = false;
    const res = [];
    for (const e of this.entrees) {
      if (!e.photo) continue;
      if (!e.empreinte) { e.empreinte = empreinteEnTexte(empreinteImage(await createImageBitmap(e.photo), false)); calcule = true; }
      const sc = similarite(e0, empreinteDepuisTexte(e.empreinte));
      if (sc >= 0.93) res.push({ e, sc });
    }
    if (calcule) Memoire.ecrire(this.entrees, "base");
    return res.sort((a, b) => b.sc - a.sc);
  },

  // Fiche d'identification : base JB (connu ? sinon blisters qui ressemblent), votre collection (exemplaires, n° déjà
  // recensés, photos qui ressemblent), et n° tapés (déjà présents ou nouveaux)
  _deja() {
    const zone = $("base-identite");
    const nomImprime = normaliser($("base-nom").value.trim());
    const nom = cleFigurine($("base-nom").value.trim(), $("base-precision") ? $("base-precision").value.trim() : "");
    const code = this.codeLu && normaliser(this.nomLu) === nomImprime ? this.codeLu : "";
    const f = code && CatalogueJB.trouver ? CatalogueJB.trouver(code) : null;
    const source = f => f.source === "jb" ? (f.epuisee ? "catalogue JB, épuisée" : "catalogue JB") : f.source === "album" ? "photo de collectionneur"
      : f.source === "brickshell" ? "retirée, brickshellcases" : f.source === "archive" ? "retirée, archives JB"
      : f.source === "commune" ? "base commune" : "retirée, vue sur eBay.de";
    const carte = (x, i, sorte = "decor") => `<button class="proposition" data-base-${sorte}="${i}">
        ${x.image ? `<img src="${echapper(x.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<div class="sans-photo" data-ma-photo="${echapper(x.code)}">${echapper(source(x))}</div>`}
        <span class="nom-court">${echapper(x.nom)}</span></button>`;
    // 1. base JB
    let jb;
    const proches = (this.proches || []).filter(x => x !== f);
    if (f) jb = `<p>✅ <b>Reconnu</b> : ${echapper(f.nom)} <span class="score">(${echapper(source(f))})</span></p>` +
      (proches.length ? `<p class="alerte">👀 D'autres blisters se ressemblent presque autant : vérifiez la figurine, et touchez la bonne si ce n'est pas celle-ci.</p>
        <div class="grille">${proches.map((x, i) => carte(x, i, "proche")).join("")}</div>` : "");
    else {
      const autres = (this.decor || []).slice(0, 3).map(r => r.f);
      jb = `<p>❓ <b>Pas reconnu dans la base JB.</b> ${autres.length ? "Est-ce l'un de ceux-ci ? Touchez-le pour le choisir." : ""}</p>` +
        (autres.length ? `<div class="grille">${autres.map(carte).join("")}</div>` : "") +
        `<p class="score">Sinon, c'est un blister nouveau pour la base : gardez le nom imprimé ; il enrichira la base commune à l'envoi 📤.</p>`;
    }
    // 2. votre collection
    const memes = nom ? this.entrees.filter(e => cleFigurine(e.nom, e.precision) === nom) : [];
    const autresPrecisions = [...new Set(this.entrees.filter(e => normaliser(e.nom) === nomImprime && cleFigurine(e.nom, e.precision) !== nom)
      .map(e => e.precision).filter(Boolean))];
    const nums = memes.map(e => e.numero).filter(Boolean);
    let aussi = "";
    try { // onglet « Customs » du fichier Excel (appli principale)
      if (code && typeof ouFigurine === "function" && etat.collection) { const n = ouFigurine(code).length; if (n) aussi = ` · ${n} dans l'onglet Customs${etat.classeur && etat.classeur.estBase ? "" : " du fichier"}`; }
      if ($("base-excel-info")) $("base-excel-info").textContent = aussi
        ? `⚠️ Déjà ${aussi.replace(/\D+/g, " ").trim().split(" ")[0]} dans l'onglet Customs : les n° déjà présents ne sont pas ajoutés ; décochez si ce blister y est déjà sans numéro.` : "";
    } catch (e) { /* mini-appli : pas de fichier */ }
    const confus = (this.semblables || []).filter(x => cleFigurine(x.e.nom, x.e.precision) !== nom);
    const confusNoms = [...new Map(confus.map(x => [cleFigurine(x.e.nom, x.e.precision), x.e])).values()].slice(0, 3);
    const coll = (memes.length ? `<p>📦 <b>Dans votre collection : ${memes.length} exemplaire${memes.length > 1 ? "s" : ""}</b>${nums.length ? ` (n° ${echapper(nums.join(", "))})` : ""}${aussi}.
        <button class="bouton-lien" data-action="base-voir-liste">✏️ Voir ou corriger</button></p>`
        : `<p>✨ <b>Pas encore dans votre collection</b>${aussi}.</p>`) +
      (autresPrecisions.length ? `<p class="score">Même nom imprimé, autres figurines déjà dans votre base : ${echapper(autresPrecisions.join(" · "))}. Touchez-en une si c'est la même.</p>
        <div class="suggestions">${autresPrecisions.map(x => `<button class="petit" data-base-precision="${echapper(x)}">${echapper(x)}</button>`).join("")}</div>` : "") +
      (confusNoms.length ? `<p class="alerte">⚠️ Ressemble à votre blister ${confusNoms.map(e => `« ${echapper(nomComplet(e))} »`).join(", ")} : même figurine sous un autre nom ? Vérifiez avant d'ajouter.</p>` : "");
    if (zone) {
      zone.innerHTML = `<div class="carte">${jb}${coll}</div>`;
      // blisters de collectionneur (sans image publique) : photo de l'album, lue dans le dépôt privé (appli principale)
      if (typeof Consulter !== "undefined") zone.querySelectorAll("[data-ma-photo]").forEach(async d => {
        const url = await Consulter.maPhoto(d.dataset.maPhoto);
        if (url && d.isConnected) d.outerHTML = `<img src="${url}" alt="">`;
      });
      zone.querySelectorAll("[data-base-precision]").forEach(b => b.addEventListener("click", () => {
        $("base-precision").value = b.dataset.basePrecision; this._deja();
      }));
      zone.querySelectorAll("[data-base-decor]").forEach(b => b.addEventListener("click", () => {
        const x = (this.decor || [])[+b.dataset.baseDecor].f;
        this._choisirNom({ ...this._nomEtPrecision(x), code: x.code });
        this._deja();
      }));
      zone.querySelectorAll("[data-base-proche]").forEach(b => b.addEventListener("click", () => {
        const x = proches[+b.dataset.baseProche];
        this._choisirNom({ ...this._nomEtPrecision(x), code: x.code });
        this._deja();
      }));
    }
    if ($("base-deja")) $("base-deja").textContent = "";
    this._etatNumeros();
  },

  // chaque n° tapé : déjà recensé pour cette figurine, ou nouveau
  _etatNumeros() {
    const z = $("base-numeros-etat");
    if (!z) return;
    const nom = cleFigurine($("base-nom").value.trim(), $("base-precision") ? $("base-precision").value.trim() : "");
    const deja = new Set(this.entrees.filter(e => cleFigurine(e.nom, e.precision) === nom).map(e => e.numero).filter(Boolean));
    const tapes = $("base-numeros") ? [...$("base-numeros").querySelectorAll("input")].map(c => c.value.trim()).filter(Boolean) : [];
    z.innerHTML = tapes.map((n, i) => deja.has(n) ? `<span class="recense-ecart">n° ${echapper(n)} déjà dans votre base</span>`
      : tapes.indexOf(n) !== i ? `<span class="recense-ecart">n° ${echapper(n)} tapé deux fois</span>`
      : `<span class="recense-ok">n° ${echapper(n)} nouveau ✔</span>`).join(" · ");
  },

  // Blister que l'on n'a pas : seulement pour la base commune de reconnaissance (pas de n°, pas dans la collection)
  async ajouterCommune() {
    const nom = $("base-nom").value.trim().toUpperCase();
    if (!this.photo) { toast("Photographiez d'abord un blister."); return; }
    if (!nom) { await demander("Tapez le nom imprimé sur le blister.", "OK", "Fermer"); return; }
    const precision = $("base-precision") ? $("base-precision").value.trim() : "";
    const code = this.codeLu && normaliser(nom) === normaliser(this.nomLu) ? this.codeLu : "";
    this.entrees.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, recadre: true, nom, precision, numerote: false,
                        numero: "", serie: "", remarque: $("base-remarque").value.trim(), code, photo: this.photo, verso: this.verso,
                        exporte: false, possede: false, date: new Date().toISOString() });
    await Memoire.ecrire(this.entrees, "base");
    toast(`« ${nomComplet({ nom, precision })} » ajouté à la base commune ✔ (pas dans votre collection)`, 4500);
    this._precedent = null;
    this._nouvelle();
    if ($("base-autre")) $("base-autre").hidden = true;
    window.scrollTo(0, 0);
    this._afficherListe();
    if (typeof BaseCommune !== "undefined") BaseCommune.envoyerEnFond(this);
  },

  async ajouter() {
    const nom = $("base-nom").value.trim().toUpperCase();
    if (!this.photo) { toast("Photographiez d'abord un blister."); return; }
    if (!nom) { await demander("Tapez le nom imprimé sur le blister.", "OK", "Fermer"); return; }
    if (!this.verso && !this.versoPasse && $("base-etape-verso") &&
        !(await demander("Pas de photo du verso. Ajouter ce blister sans verso ?", "Ajouter sans verso", "Annuler"))) return;
    // nom corrigé à la main : le code de la figurine proposée ne vaut plus
    const code = this.codeLu && normaliser(nom) === normaliser(this.nomLu) ? this.codeLu : "";
    const nonNumerote = !!($("base-non-numerote") && $("base-non-numerote").checked);
    let n = $("base-nombre") ? Math.min(99, Math.max(1, parseInt($("base-nombre").value, 10) || 1)) : 1;
    let numeros = $("base-numeros") ? [...$("base-numeros").querySelectorAll("input")].slice(0, n).map(c => c.value.trim())
      : [$("base-numero") ? $("base-numero").value.trim() : ""];
    while (numeros.length < n) numeros.push("");
    const precision = $("base-precision") ? $("base-precision").value.trim() : "";
    const memes = this.entrees.filter(e => e.possede !== false && cleFigurine(e.nom, e.precision) === cleFigurine(nom, precision));
    const doublesSaisie = numeros.filter((x, i) => x && numeros.indexOf(x) !== i);
    const dejaLa = numeros.filter(x => x && memes.some(e => e.numero === x));
    // n° en double : seuls ces n° sont écartés, les autres restent saisis (et peuvent être ajoutés tout de suite)
    if (doublesSaisie.length || dejaLa.length) {
      const ecarte = (x, i) => x && (dejaLa.includes(x) || numeros.indexOf(x) !== i);
      const garder = numeros.filter((x, i) => !ecarte(x, i));
      const pluriel = l => l.length > 1 ? "s" : "";
      const txt = [dejaLa.length && `n° ${dejaLa.join(", ")} déjà dans votre base pour « ${nomComplet({ nom, precision })} » (sans doute le même blister compté deux fois)`,
                   doublesSaisie.length && `n° ${doublesSaisie.join(", ")} tapé deux fois`].filter(Boolean).join(" ; ");
      const champs = $("base-numeros") ? [...$("base-numeros").querySelectorAll("input")] : [];
      const viderDoublons = () => { // seuls les champs en double sont vidés
        champs.forEach((c, i) => { if (i < numeros.length && ecarte(numeros[i], i)) c.value = ""; });
        const vide = champs.find((c, i) => i < numeros.length && ecarte(numeros[i], i));
        this._etatNumeros();
        if (vide) vide.focus();
      };
      if (!garder.length) { await demander(`${txt}.\n\nCorrigez le numéro, puis « Ajouter ».`, "OK", "Fermer"); viderDoublons(); return; }
      if (!(await demander(`${txt}.\n\nAjouter les ${garder.length} autre${pluriel(garder)} exemplaire${pluriel(garder)} sans ${dejaLa.length + doublesSaisie.length > 1 ? "ces numéros" : "ce numéro"} ?`,
          `Ajouter les ${garder.length} autre${pluriel(garder)}`, "Corriger d'abord"))) { viderDoublons(); return; }
      numeros = garder; n = garder.length;
    }
    const commun = { recadre: true, nom, precision, numerote: !nonNumerote, serie: nonNumerote ? "" : $("base-serie").value.trim(), remarque: $("base-remarque").value.trim(),
                     code, photo: this.photo, verso: this.verso, exporte: false };
    for (const numero of numeros)
      this.entrees.push({ ...commun, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
                          numero: nonNumerote ? "" : numero, date: new Date().toISOString() });
    $("base-etat").textContent = "Enregistrement du blister dans le téléphone…";
    if (!(await Memoire.ecrire(this.entrees, "base"))) {
      this.entrees.splice(this.entrees.length - numeros.length, numeros.length); // pas enregistré : retiré de la liste
      $("base-etat").textContent = "⚠️ Le blister n'a pas pu être enregistré dans le téléphone (voir le message). Réessayez.";
      return;
    }
    const total = memes.length + n;
    toast(`« ${nomComplet(commun)} » : ${n > 1 ? `${n} exemplaires ajoutés` : "ajouté"} ✔ (${total} au total)`);
    // appli principale : aussi dans l'onglet Customs du fichier Excel (case cochée)
    let compteExcel = "";
    if ($("base-excel") && $("base-excel").checked && !$("base-bloc-excel").hidden && typeof ajouterCustomsDepuisBase === "function") {
      $("base-etat").textContent = "Ajout à votre collection (Customs)…";
      try { // jamais bloqué : au plus 30 s
        compteExcel = await Promise.race([ajouterCustomsDepuisBase({ nom, precision, code, numeros, serie: commun.serie.replace(/\D/g, ""), nonNumerote }),
          new Promise(ok => setTimeout(() => ok("⚠️ L'ajout aux Customs prend trop de temps : vérifiez Ma collection, et réessayez si besoin."), 30000))]);
      } catch (err) { console.error(err); compteExcel = "⚠️ L'ajout aux Customs a échoué : " + err.message; }
    }
    // on garde la figurine : « Autre exemplaire » ne demande que le numéro
    this._precedent = { source: this.source, sourceVerso: this.sourceVerso, cadre: this.cadre, cadreVerso: this.cadreVerso,
                        nom, precision, code, nomLu: this.nomLu, codeLu: this.codeLu, photo: this.photo, verso: this.verso, serie: commun.serie,
                        remarque: commun.remarque, nonNumerote };
    this._nouvelle();
    if (compteExcel) $("base-etat").textContent = compteExcel;
    window.scrollTo(0, 0); // « 📷 Photographier un blister » (suivant) et « Autre exemplaire » juste sous les yeux
    if ($("base-autre")) { $("base-autre").hidden = false; $("btn-base-autre").textContent = `Autre exemplaire de « ${nomComplet(commun)} » : photographier`; }
    this._afficherListe();
    if (typeof BaseCommune !== "undefined") BaseCommune.envoyerEnFond(this);
  },

  // Exemplaire de plus d'un blister déjà dans la base (nouveau n°), sans reprendre de photo : mêmes photos, nom,
  // précision, série et note ; seul le numéro reste à taper (on peut aussi reprendre une photo)
  exemplaireDe(id) {
    const e = this.entrees.find(x => x.id === id);
    if (!e) return;
    this._precedent = { photo: e.photo, verso: e.verso, nom: e.nom, precision: e.precision || "", code: e.code || "",
                        nomLu: e.nom, codeLu: e.code || "", serie: e.serie || "", remarque: e.remarque || "", nonNumerote: e.numerote === false,
                        source: null, sourceVerso: null, cadre: null, cadreVerso: null };
    this.autreExemplaire();
    $("base-etat").textContent = "Exemplaire de plus, mêmes photos : tapez seulement son numéro, puis « Ajouter ». Pour prendre des photos de cet exemplaire, touchez « Autre exemplaire … : photographier ».";
    if ($("base-autre")) { $("base-autre").hidden = false; $("btn-base-autre").textContent = `Autre exemplaire de « ${nomComplet(e)} » : photographier`; }
    $("base-fiche").scrollIntoView({ block: "start" });
    if ($("base-numero") && e.numerote !== false) setTimeout(() => $("base-numero").focus(), 300);
  },

  // Exemplaire suivant de la même figurine : nom, série et note repris ; nouvelles photos recto et verso (état et
  // numéro propres à chaque exemplaire), ou la même photo (fichier = rien) ; seul le numéro reste à taper
  async autreExemplaire(fichier) {
    const p = this._precedent;
    if (!p) return;
    this._nouvelle();
    if (fichier) {
      $("base-photo").src = URL.createObjectURL(fichier);
      const { blob, cadre } = await this._preparer(fichier, 0);
      Object.assign(this, { photo: blob, cadre, source: { fichier, sens: 0 }, nomLu: p.nomLu, codeLu: p.codeLu });
      this._demanderVerso();
    } else Object.assign(this, { photo: p.photo, verso: p.verso, versoPasse: !p.verso, nomLu: p.nomLu, codeLu: p.codeLu,
                                 source: p.source, sourceVerso: p.sourceVerso, cadre: p.cadre, cadreVerso: p.cadreVerso });
    this._boutonsRecadrer();
    $("base-photo").src = URL.createObjectURL(this.photo);
    if (this.verso) { $("base-verso").src = URL.createObjectURL(this.verso); $("base-verso").hidden = false; }
    $("base-nom").value = p.nom; if ($("base-precision")) $("base-precision").value = p.precision || ""; $("base-serie").value = p.serie; $("base-remarque").value = p.remarque;
    if ($("base-non-numerote")) { $("base-non-numerote").checked = p.nonNumerote; this._numerote(); }
    $("base-fiche").hidden = false;
    $("base-etat").textContent = fichier ? "Même figurine : photographiez le verso, puis tapez le numéro de cet exemplaire."
      : "Même figurine, même photo : tapez seulement le numéro de cet exemplaire.";
    this.semblables = fichier ? await this._semblablesCollection().catch(() => []) : [];
    this._deja();
    if ($("base-numero") && !p.nonNumerote) $("base-numero").focus();
  },


  // Reprendre des blisters d'un fichier .zip « Envoyer » (autre téléphone, ou Safari avant l'installation sur l'écran
  // d'accueil : sur iPhone, l'appli installée ne voit pas ce qui a été fait dans Safari). Déjà présents : ignorés.
  async reprendre(fichier) {
    let zip;
    try { zip = await JSZip.loadAsync(fichier); } catch (err) { await demander("Ce fichier n'est pas un envoi de blisters (.zip).", "OK", "Fermer"); return; }
    const tsv = zip.file("base.tsv");
    if (!tsv) { await demander("Ce fichier .zip ne contient pas de blisters.", "OK", "Fermer"); return; }
    const [entete, ...lignes] = (await tsv.async("string")).split("\n").filter(l => l.trim());
    const col = entete.split("\t");
    // appli principale : l'envoi d'un ami va seulement dans la base commune (sa collection reste la sienne)
    const ami = typeof BaseCommune !== "undefined" &&
      !(await demander("Ce fichier de blisters vient de qui ?\n\n• De vous (photos faites avant, ou sur un autre téléphone) : ils reviennent dans votre collection.\n" +
        "• D'un ami : ses blisters vont seulement dans la base commune de reconnaissance.", "De moi", "D'un ami"));
    if (ami) {
      const envoi = [];
      for (const l of lignes) {
        const v = {}; l.split("\t").forEach((x, i) => { v[col[i]] = x; });
        const photo = v.id && v.nom && zip.file(v.photo || `photos/${v.id}.jpg`), verso = v.verso && zip.file(v.verso);
        if (!photo) continue;
        envoi.push({ id: "A" + v.id, nom: v.nom, precision: v.precision || "", numero: v.numero || "", serie: v.serie || "", code: v.code || "",
          photo: new Blob([await photo.async("arraybuffer")], { type: "image/jpeg" }),
          verso: verso ? new Blob([await verso.async("arraybuffer")], { type: "image/jpeg" }) : null });
      }
      await BaseCommune.ajouterEnvoiAmi(envoi);
      return;
    }
    const connus = new Set(this.entrees.map(e => e.id));
    let ajoutes = 0, deja = 0;
    for (const l of lignes) {
      const v = {}; l.split("\t").forEach((x, i) => { v[col[i]] = x; });
      if (!v.id || !v.nom) continue;
      if (connus.has(v.id)) { deja++; continue; }
      const photo = zip.file(v.photo || `photos/${v.id}.jpg`), verso = v.verso && zip.file(v.verso);
      if (!photo) continue;
      this.entrees.push({ id: v.id, nom: v.nom, precision: v.precision || "", numerote: v.numerote !== "non", numero: v.numero || "", serie: v.serie || "",
        remarque: v.remarque || "", code: v.code || "", date: v.date || new Date().toISOString(),
        photo: new Blob([await photo.async("arraybuffer")], { type: "image/jpeg" }),
        verso: verso ? new Blob([await verso.async("arraybuffer")], { type: "image/jpeg" }) : null, exporte: false, possede: v.possede !== "non" });
      connus.add(v.id); ajoutes++;
    }
    await Memoire.ecrire(this.entrees, "base");
    this._afficherListe();
    await demander((ajoutes ? `${ajoutes} blister${ajoutes > 1 ? "s repris" : " repris"} ✔` : "Aucun nouveau blister dans ce fichier") + (deja ? ` (${deja} déjà dans l'appli)` : "") +
      ".\n\nVous pouvez continuer à photographier : rien n'est perdu.", "OK", "Fermer");
  },

  // Première ouverture de l'appli installée, sans aucun blister : proposer de reprendre ceux faits avant
  async proposerReprise() {
    if (this.entrees.length || (await Memoire.lire("reprise-proposee"))) return;
    await Memoire.ecrire(true, "reprise-proposee");
    const safari = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!(await demander("Avez-vous déjà photographié des blisters avant d'installer l'appli ?", "Oui, les reprendre", "Non, je commence"))) return;
    await demander("Pour les reprendre :\n\n1. " + (safari ? "Ouvrez le lien de l'appli dans Safari (là où vous les avez photographiés)."
      : "Ouvrez l'appli là où vous les avez photographiés.") +
      "\n2. Touchez « 📤 Envoyer les blisters », puis « Enregistrer dans Fichiers ».\n3. Revenez ici et touchez « 📥 Reprendre des blisters déjà photographiés », " +
      "puis choisissez ce fichier.\n\nUn fichier .zip déjà envoyé (Messages, Mail…) convient aussi : enregistrez-le dans Fichiers, puis choisissez-le.", "OK", "Fermer");
  },

  async supprimer(id) {
    const e = this.entrees.find(x => x.id === id);
    if (!e || !(await demander(`Retirer « ${nomComplet(e)} » de la liste ?`))) return;
    this.entrees = this.entrees.filter(x => x.id !== id);
    await Memoire.ecrire(this.entrees, "base");
    this._afficherListe();
  },

  _afficherListe() {
    const n = this.entrees.length, attente = this.entrees.filter(e => !e.exporte).length, pasAMoi = this.entrees.filter(e => e.possede === false).length;
    $("base-compte").textContent = n
      ? `${n - pasAMoi} blister${n - pasAMoi > 1 ? "s" : ""} à vous${pasAMoi ? ` + ${pasAMoi} pour la base commune seulement` : ""}` +
        (typeof BaseCommune === "undefined" ? `, dont ${attente} pas encore exporté${attente > 1 ? "s" : ""}` : "")
      : "Aucun blister dans votre base pour l'instant.";
    if ($("base-commune-etat") && typeof BaseCommune !== "undefined") {
      const a = BaseCommune.enAttente(this.entrees).length;
      $("base-commune-etat").textContent = a ? `🌐 ${a} blister${a > 1 ? "s" : ""} pas encore dans la base commune.` : n ? "🌐 Tous vos blisters sont dans la base commune ✔" : "";
      $("btn-base-commune").hidden = !a;
    }
    $("btn-base-exporter").hidden = !n;
    $("btn-base-vider").hidden = !this.entrees.some(e => e.exporte);
    if ($("btn-base-recadrer-tout")) {
      const n = this.entrees.filter(e => !e.recadre).length;
      $("btn-base-recadrer-tout").hidden = !n;
      $("btn-base-recadrer-tout").textContent = `✂️ Recadrer les photos déjà prises (${n} blister${n > 1 ? "s" : ""})`;
    }
    if ($("base-vue-photos")) {
      $("base-vue-photos").classList.toggle("actif", this.vue === "photos");
      $("base-vue-compte").classList.toggle("actif", this.vue === "compte");
    }
    if (this.vue === "compte") { this._afficherCompte(); return; }
    const q = $("base-filtre") ? normaliser($("base-filtre").value.trim()) : "";
    const trouve = e => !q || q.split(" ").every(m => normaliser([nomComplet(e), e.numero, e.serie, e.remarque].filter(Boolean).join(" ")).includes(m));
    const liste = this.entrees.slice().reverse().filter(trouve);
    $("base-liste").innerHTML = (q ? `<p class="aide">${liste.length} blister${liste.length > 1 ? "s" : ""} trouvé${liste.length > 1 ? "s" : ""}.</p>` : "") +
      liste.slice(0, q ? 300 : 100).map(e => `
      <div class="fiche" data-fiche="${e.id}">
        <img class="photo" src="${URL.createObjectURL(e.photo)}" alt="Recto" data-base-voir="${e.id}" title="Voir le recto et le verso">
        <div class="infos"><div class="nom-court">${echapper(nomComplet(e))}</div>
          <div class="lieu">${echapper([e.possede === false && "pas à moi, pour la base commune", e.possede !== false && e.numerote === false && "non numérotée", e.numero && `n° ${e.numero}${e.serie ? ` / ${e.serie}` : ""}`, !e.numero && e.serie && `série ${e.serie}`, e.remarque,
            e.verso ? "recto + verso" : "sans verso", e.origine === "album" && "d'après l'album photo", e.code, typeof BaseCommune !== "undefined" ? (e.commune ? "🌐 dans la base commune" : "🌐 en attente") : e.exporte ? "exporté" : "pas encore exporté"].filter(Boolean).join(" · "))}</div></div>
        ${e.verso ? "" : `<label class="petit" title="Ajouter le verso">📷 verso<input type="file" accept="image/*" capture="environment" data-base-verso="${e.id}" hidden></label>`}
        <button class="petit" data-base-plus="${e.id}" title="Ajouter un exemplaire (nouveau n°), même photo">➕</button>
        <button class="petit" data-base-modif="${e.id}" title="Modifier">✏️</button>
        <button class="petit" data-base-suppr="${e.id}" title="Retirer">✕</button>
      </div>`).join("");
    $("base-liste").querySelectorAll("[data-base-voir]").forEach(im => im.addEventListener("click", () => {
      const e = this.entrees.find(x => x.id === im.dataset.baseVoir);
      if (e) Visionneuse.ouvrir(nomComplet(e), Base.imagesBlister(e), "", "",
        [{ texte: "➕ Ajouter un exemplaire (nouveau n°)", faire: () => this.exemplaireDe(e.id) }]);
    }));
    $("base-liste").querySelectorAll("[data-base-modif]").forEach(b => b.addEventListener("click", () => this.modifier(b.dataset.baseModif)));
    $("base-liste").querySelectorAll("[data-base-plus]").forEach(b => b.addEventListener("click", () => this.exemplaireDe(b.dataset.basePlus)));
    $("base-liste").querySelectorAll("[data-base-suppr]").forEach(b => b.addEventListener("click", () => this.supprimer(b.dataset.baseSuppr)));
    $("base-liste").querySelectorAll("[data-base-verso]").forEach(c => c.addEventListener("change", async () => {
      const f = c.files[0], e = this.entrees.find(x => x.id === c.dataset.baseVerso);
      if (!f || !e) return;
      e.verso = await this._reduire(f, 0);
      e.exporte = false; // à renvoyer avec son verso
      await Memoire.ecrire(this.entrees, "base");
      toast(`Verso de « ${nomComplet(e)} » ajouté ✔`);
      this._afficherListe();
    }));
  },

  // Recto et verso d'un blister de la base, pour la visionneuse
  imagesBlister(e) {
    const qui = [e.numero && `n° ${e.numero}${e.serie ? ` / ${e.serie}` : ""}`, e.numerote === false && "non numérotée", e.remarque].filter(Boolean).join(" · ");
    return [{ src: URL.createObjectURL(e.photo), legende: `Recto${qui ? " · " + qui : ""}` },
            ...(e.verso ? [{ src: URL.createObjectURL(e.verso), legende: `Verso${qui ? " · " + qui : ""}` }] : [])];
  },

  // Modifier un blister déjà recensé (nom, précision, n°, série, note) : fiche ouverte à la place de sa ligne
  modifier(id) {
    const e = this.entrees.find(x => x.id === id), ligne = $("base-liste").querySelector(`[data-fiche="${id}"]`);
    if (!e || !ligne) return;
    const champ = (cle, titre, val, attrs = "") => `<label class="etiquette-champ">${titre}</label>
      <input class="champ" data-modif="${cle}" value="${echapper(val || "")}" autocomplete="off" ${attrs}>`;
    ligne.outerHTML = `<div class="carte" data-fiche="${id}">
      <p class="sous-titre">✏️ Modifier ce blister</p>
      ${champ("nom", "Nom imprimé", e.nom, 'autocapitalize="characters"')}${champ("precision", "Précision (personnage, couleur…)", e.precision, 'autocapitalize="characters"')}
      <div class="deux-champs"><div>${champ("numero", "N° de l'exemplaire", e.numero, 'inputmode="numeric"')}</div>
        <div>${champ("serie", "Série limitée à", e.serie, 'inputmode="numeric"')}</div></div>
      <label class="case-a-cocher"><input type="checkbox" data-modif="nonnum" ${e.numerote === false ? "checked" : ""}> Non numérotée</label>
      ${champ("remarque", "Note particulière", e.remarque)}
      <button class="gros-bouton vert" data-modif-ok>✔ Enregistrer</button>
      <button class="bouton-lien" data-modif-annuler>Annuler</button></div>`;
    const carte = $("base-liste").querySelector(`[data-fiche="${id}"]`);
    carte.querySelector("[data-modif-annuler]").addEventListener("click", () => this._afficherListe());
    carte.querySelector("[data-modif-ok]").addEventListener("click", () => this._enregistrerModif(e, carte));
    const griser = () => {
      const non = carte.querySelector('[data-modif="nonnum"]').checked;
      for (const k of ["numero", "serie"]) {
        const c = carte.querySelector(`[data-modif="${k}"]`);
        c.disabled = non; c.previousElementSibling.classList.toggle("grise", non);
      }
    };
    carte.querySelector('[data-modif="nonnum"]').addEventListener("change", griser);
    griser();
    if (e.numerote !== false) carte.querySelector('[data-modif="numero"]').focus();
  },

  async _enregistrerModif(e, carte) {
    const v = k => carte.querySelector(`[data-modif="${k}"]`).value.trim();
    const nonNum = carte.querySelector('[data-modif="nonnum"]').checked;
    const nouveau = { nom: v("nom").toUpperCase(), precision: v("precision"), numero: nonNum ? "" : v("numero"),
                      serie: nonNum ? "" : v("serie").replace(/\D/g, ""), remarque: v("remarque"), numerote: !nonNum };
    if (!nouveau.nom) { await demander("Le nom ne peut pas être vide.", "OK", "Fermer"); return; }
    const cle = cleFigurine(nouveau.nom, nouveau.precision);
    const doublon = nouveau.numero && this.entrees.find(x => x !== e && x.numero === nouveau.numero && cleFigurine(x.nom, x.precision) === cle);
    if (doublon) { await demander(`Le n° ${nouveau.numero} est déjà dans votre base pour « ${nomComplet(nouveau)} » : corrigez le numéro.`, "OK", "Fermer"); return; }
    const ancien = { numero: e.numero, serie: e.serie, code: e.code, nom: e.nom };
    if (normaliser(nouveau.nom) !== normaliser(e.nom)) e.code = ""; // autre figurine : le code reconnu ne vaut plus
    Object.assign(e, nouveau, { exporte: false }); // à renvoyer corrigé
    await Memoire.ecrire(this.entrees, "base");
    let compteExcel = "";
    if (ancien.numero !== e.numero && typeof corrigerNumeroCustoms === "function")
      compteExcel = await corrigerNumeroCustoms({ code: ancien.code, nom: ancien.nom, ancien: ancien.numero, serie: ancien.serie, nouveau: e.numero, nouvelleSerie: e.serie });
    toast(`« ${nomComplet(e)} » modifié ✔${compteExcel ? " · " + compteExcel : ""}`, 5000);
    this._afficherListe();
  },

  // Figurine du panneau d'identification : liste filtrée sur elle, pour corriger un n°
  voirDansLaListe() {
    if (!$("base-filtre")) return;
    $("base-filtre").value = [$("base-nom").value.trim(), $("base-precision") ? $("base-precision").value.trim() : ""].filter(Boolean).join(" ");
    this.vue = "photos";
    this._afficherListe();
    $("base-filtre").scrollIntoView({ block: "start" });
  },

  // Exemplaires recensés par figurine, comparés au nombre acheté (onglet « Customs achetées » du fichier Excel)
  async _afficherCompte() {
    const groupes = new Map();
    for (const e of this.entrees.filter(e => e.possede !== false)) {
      const k = cleFigurine(e.nom, e.precision);
      const g = groupes.get(k) || { nom: nomComplet(e), numeros: [], notes: [], n: 0 };
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
      if (!nouveaux.length) { await demander("Tous les blisters de votre album sont déjà dans la base de blisters.", "OK", "Fermer"); return; }
      if (!(await demander(`Ajouter à la base de blisters ${nouveaux.length} blister(s) identifiés sur vos photos (${nouveaux.filter(e => e.numero).length} avec leur n°) ?\n\n` +
          "Ils seront marqués « d'après l'album photo » : vérifiez-les en photographiant vos blisters (un blister vendu ou donné depuis est à retirer).",
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
      toast(`${i} blister(s) de l'album ajoutés à votre base ✔`, 5000);
      this._afficherListe();
    } catch (err) { console.error(err); await demander("La reprise de l'album a échoué : " + err.message, "OK", "Fermer"); }
  },

  // .zip : base.tsv (id, nom, série, remarque, code reconnu, date, photo) + photos/<id>.jpg
  async exporter() {
    if (!this.entrees.length) return;
    const zip = new JSZip();
    const lignes = ["id\tnom\tnumerote\tnumero\tserie\tremarque\tcode\tdate\tphoto\tverso\tprecision\tpossede"];
    for (const e of this.entrees) {
      zip.file(`photos/${e.id}.jpg`, e.photo);
      if (e.verso) zip.file(`photos/${e.id}_verso.jpg`, e.verso);
      lignes.push([e.id, e.nom, e.numerote === false ? "non" : "oui", e.numero, e.serie, e.remarque, e.code, e.date, `photos/${e.id}.jpg`, e.verso ? `photos/${e.id}_verso.jpg` : "", e.precision, e.possede === false ? "non" : "oui"].map(v => String(v || "").replace(/[\t\n]/g, " ")).join("\t"));
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

  // Recadre sur le blister les photos déjà recensées (recto et verso), une seule fois par blister. Une photo où le
  // blister n'est pas trouvé avec assez de certitude reste entière (« ✂️ » n'existe que pendant la saisie).
  async recadrerTout() {
    const liste = this.entrees.filter(e => !e.recadre);
    if (!liste.length) return;
    if (!(await demander(`Recadrer sur le blister les photos de ${liste.length} blister${liste.length > 1 ? "s" : ""} déjà dans votre base ?\n\n` +
        "Les photos où le blister n'est pas trouvé avec certitude restent entières. Le recadrage ne peut pas être annulé.", "✂️ Recadrer", "Annuler"))) return;
    let recto = 0, verso = 0, i = 0;
    const couper = async blob => {
      const cadre = this._cadreAuto(await createImageBitmap(blob));
      return cadre ? this._reduire(blob, 0, cadre) : null;
    };
    for (const e of liste) {
      $("base-etat").textContent = `Recadrage des photos… (${++i} sur ${liste.length})`;
      try {
        const r = e.photo && await couper(e.photo);
        if (r) { e.photo = r; delete e.empreinte; recto++; }
        const v = e.verso && await couper(e.verso);
        if (v) { e.verso = v; verso++; }
      } catch (err) { console.warn(err); }
      e.recadre = true;
      if (i % 20 === 0) await Memoire.ecrire(this.entrees, "base");
    }
    await Memoire.ecrire(this.entrees, "base");
    $("base-etat").textContent = "";
    this._afficherListe();
    await demander(`Recadrage terminé : ${recto} recto${recto > 1 ? "s" : ""} et ${verso} verso${verso > 1 ? "s" : ""} recadrés.\n\n` +
      `Les autres photos sont restées entières (blister déjà bien cadré, ou pas trouvé avec certitude).`, "OK", "Fermer");
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
if ($("base-precision")) $("base-precision").addEventListener("input", () => Base._deja());
if ($("base-filtre")) { let m; $("base-filtre").addEventListener("input", () => { clearTimeout(m); m = setTimeout(() => { Base.vue = "photos"; Base._afficherListe(); }, 250); }); }
if ($("base-numeros")) $("base-numeros").addEventListener("input", () => Base._etatNumeros());
if ($("base-notes")) $("base-notes").addEventListener("click", e => {
  const b = e.target.closest("[data-note]");
  if (!b) return;
  const champ = $("base-remarque"), n = b.dataset.note;
  if (!champ.value.includes(n)) champ.value = champ.value.trim() ? `${champ.value.trim()}, ${n}` : n;
});

for (const id of ["input-base-verso", "input-base-verso2"])
  if ($(id)) $(id).addEventListener("change", e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) Base.prendreVerso(f);
  });

if ($("input-base-autre")) $("input-base-autre").addEventListener("change", e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) Base.autreExemplaire(f);
});

if ($("input-base-reprendre")) $("input-base-reprendre").addEventListener("change", e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (f) Base.reprendre(f);
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
  else if (action === "base-ajouter-commune") Base.ajouterCommune();
  else if (action === "base-commune-envoyer") BaseCommune.envoyerTout(Base);
  else if (action === "base-exporter") Base.exporter();
  else if (action === "base-vider") Base.vider();
  else if (action === "base-autre") Base.autreExemplaire();
  else if (action === "base-passer-verso") Base.passerVerso();
  else if (action === "base-recadrer-recto") Base.recadrer("recto");
  else if (action === "base-recadrer-tout") Base.recadrerTout();
  else if (action === "base-voir-liste") Base.voirDansLaListe();
  else if (action === "base-recadrer-verso") Base.recadrer("verso");
  else if (action === "base-recadrage-ok") Base.finRecadrage("ok");
  else if (action === "base-recadrage-entiere") Base.finRecadrage("entiere");
  else if (action === "base-recadrage-annuler") Base.finRecadrage("annuler");
  else if (action === "base-importer-album") Base.importerAlbum();
  else if (action === "base-vue-photos") { Base.vue = "photos"; Base._afficherListe(); }
  else if (action === "base-vue-compte") { Base.vue = "compte"; Base._afficherListe(); }
});

Base._installerRecadrage();

// Appui long sur une photo : pas de menu du navigateur (copier, télécharger, partager l'image)
document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("img, .recadrage-zone")) e.preventDefault(); });

// Champs « nombre » (exemplaires, séries, quantité) : 1 affiché par défaut ; au toucher, le champ se vide (le 1 reste
// visible en grisé) pour taper directement le bon nombre ; laissé vide, il reprend sa valeur d'avant.
document.addEventListener("focusin", e => {
  const c = e.target;
  if (!(c.matches && c.matches('input[type="number"]'))) return;
  c.dataset.avant = c.value;
  c.placeholder = c.value;
  c.value = "";
});
document.addEventListener("focusout", e => {
  const c = e.target;
  if (!(c.matches && c.matches('input[type="number"]')) || c.value.trim() !== "") return;
  c.value = c.dataset.avant || c.min || "";
});

// Visionneuse : une fiche plein écran avec plusieurs photos en grand (recto, verso, photos de collectionneur…).
// images : [{ src (adresse, ou promesse d'adresse ; vide = photo retirée), legende }]
const Visionneuse = {
  ouvrir(titre, images, lien, lienTexte, actions = []) {
    let d = $("visionneuse");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "visionneuse";
      d.className = "visionneuse";
      document.body.appendChild(d);
      d.addEventListener("click", ev => { if (ev.target.closest("[data-fermer]") || ev.target === d) d.close(); });
    }
    d.innerHTML = `<div class="visionneuse-tete"><b>${echapper(titre)}</b><button class="petit" data-fermer>✕ Fermer</button></div>
      ${lien ? `<a class="bouton bleu" href="${echapper(lien)}" target="_blank" rel="noopener">🔗 ${echapper(lienTexte || "Voir la page")}</a>` : ""}
      ${actions.map((a, i) => `<button class="gros-bouton vert" data-vaction="${i}">${echapper(a.texte)}</button>`).join("")}
      <div class="visionneuse-images">${images.length ? images.map((im, i) => `<figure><img data-vi="${i}" alt="">
        <figcaption>${echapper(im.legende || "")}</figcaption></figure>`).join("") : `<p class="aide">Pas de photo.</p>`}</div>`;
    d.querySelectorAll("[data-vaction]").forEach(b => b.addEventListener("click", () => { d.close(); actions[+b.dataset.vaction].faire(); }));
    images.forEach(async (im, i) => {
      const el = d.querySelector(`img[data-vi="${i}"]`);
      let src = "";
      try { src = await im.src; } catch (err) { console.warn(err); }
      if (!el) return;
      if (src) el.src = src; else el.closest("figure").remove();
    });
    if (!d.open) {
      d.showModal();
      // Sans la gestion du retour de l'appli principale (mini-appli) : le retour ferme les photos au lieu de quitter
      if (typeof armerRetour === "undefined") {
        history.pushState({ visionneuse: true }, "");
        const surRetour = () => { window.removeEventListener("popstate", surRetour); d.close(); };
        window.addEventListener("popstate", surRetour);
        d.addEventListener("close", () => { window.removeEventListener("popstate", surRetour);
          if (history.state && history.state.visionneuse) history.back(); }, { once: true });
      }
    }
    d.scrollTop = 0;
  },
  fermer() { const d = $("visionneuse"); if (d && d.open) { d.close(); return true; } return false; },
};
