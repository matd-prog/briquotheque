// Consultation de la collection (lecture seule) : figurines des onglets de l'appli,
// en liste ou en planche (les étiquettes telles qu'imprimées), avec une recherche globale.

const Collection = {
  onglet: null,
  vue: "liste",
  _urls: [],
  _tour: 0, // évite qu'un ancien affichage (plus lent) remplace le plus récent

  ouvrir(vue) {
    // planche (étiquettes telles qu'imprimées) : seulement depuis l'écran Impression ; sinon liste ou vignettes
    this.vue = vue || (this.vue === "planche" ? "liste" : this.vue);
    this._chargerArticles().then(() => this.rendre()).catch(() => {}); // sets et objets dérivés
    if (typeof Consulter !== "undefined") Consulter._chargerMesPhotos().catch(() => {}); // vos photos d'album (fiche)
    CatalogueJB.charger().then(() => this.rendre()).catch(() => {}); // photos des customs JB
    this._chargerMesBlisters().then(() => this.rendre()).catch(() => {});
    const onglets = this._onglets();
    if (!onglets.includes(this.onglet) && !(this.vue !== "planche" && this._estArticles(this.onglet))) this.onglet = onglets.find(o => this._figurines(o).length) || onglets[0];
    $("collection-recherche").value = "";
    afficher("collection");
    this.rendre();
  },

  installer() {
    let minuteur;
    $("collection-recherche").addEventListener("input", () => {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => this.rendre(), 200);
    });
    // loupe (ou Entrée) du clavier : résultats tout de suite, clavier refermé pour les voir en entier
    $("collection-recherche").addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      clearTimeout(minuteur);
      this.rendre();
      e.target.blur();
    });
    $("collection-bascule").addEventListener("click", e => {
      const b = e.target.closest("[data-vue]");
      if (b) { this.vue = b.dataset.vue; this.rendre(); }
    });
    $("collection-onglets").addEventListener("click", e => {
      const b = e.target.closest("[data-onglet]");
      if (!b) return;
      this.onglet = b.dataset.onglet;
      $("collection-recherche").value = "";
      this.rendre();
    });
    $("collection-contenu").addEventListener("click", e => this.clic(e));
  },

  // Sets et objets dérivés, montrés à côté des figurines (tableaux « Sets » et « Objets dérivés »)
  ARTICLES: { [ONGLET_SETS]: { icone: "🧱", lire: cl => lireSets(cl), quantite: "K", colonnes: COLONNES_SETS },
              [ONGLET_OBJETS]: { icone: "🔑", lire: cl => lireObjets(cl), quantite: "E", colonnes: COLONNES_OBJETS } },
  _articles: { [ONGLET_SETS]: [], [ONGLET_OBJETS]: [] },
  _estArticles(o) { return !!this.ARTICLES[o]; },
  themeArticle: {}, // thème choisi dans Sets, Objets dérivés ("" : tous)

  // Thème d'un set ou d'un objet, avec les noms des onglets de figurines quand c'est possible (Star Wars, Super-héros…)
  _themeArticle(a, onglet) {
    if (onglet === ONGLET_SETS) {
      if (!estLego(a)) return "Autres marques";
      const t = String(a.theme || "").trim();
      if (!t) return "Autres thèmes";
      return themeDeCategorie(t) || this.THEMES_SETS[normaliser(t.split(" / ")[0])] || t.split(" / ")[0];
    }
    // objets dérivés : d'après le nom (porte-clés Dark Vador -> Star Wars)
    const n = normaliser(`${a.nom} ${a.remarques || ""}`);
    const r = [[/star wars|darth|vader|yoda|stormtrooper|mandalorian|grogu|chewbacca|clone|boba fett|kylo|r2-d2|c-3po|luke|leia/, "Star Wars"],
      [/harry potter|hogwarts|poudlard|hermione|dumbledore/, "Harry Potter"], [/ninjago/, "Ninjago"],
      [/marvel|spider|batman|avengers|iron man|captain america|hulk|thor|joker|superman|wonder woman|dc /, "Super-héros"],
      [/disney|mickey|minnie|frozen|stitch|pixar/, "Disney"], [/simpsons|homer/, "Simpsons"], [/city|police|pompier|fire/, "Town & City"],
      [/jurassic|dino/, "Jurassic World"], [/friends/, "Friends"]].find(([re]) => re.test(n));
    return r ? r[1] : (a.type && String(a.type).trim()) || "Autres thèmes";
  },
  THEMES_SETS: { "dimensions": "Dimensions", "icons": "Icons", "lego ideas and cuusoo": "Ideas", "brickheadz": "BrickHeadz",
    "technic": "Technic", "castle": "Château", "seasonal": "Fêtes (Noël…)", "promotional": "Promotionnels", "other": "Autres thèmes",
    "sculptures": "Sculptures", "super mario": "Super Mario", "the legend of zelda": "Zelda", "ghostbusters": "Ghostbusters",
    "creator": "Creator", "architecture": "Architecture", "friends": "Friends", "duplo": "Duplo", "minecraft": "Minecraft" },
  // ordre des thèmes : comme les onglets de figurines, puis les autres par ordre alphabétique, « Autres … » à la fin
  _rangTheme(t) {
    const i = [THEME_STAR_WARS_UNIQUE.onglet, ...ONGLETS_THEMES].indexOf(t);
    return /^Autres/.test(t) ? 1000 : i >= 0 ? i : 100;
  },
  _quantite(o) { return this._articles[o].reduce((s, a) => s + (a.quantite || 1), 0); },
  async _chargerArticles() {
    for (const [o, d] of Object.entries(this.ARTICLES)) {
      try { this._articles[o] = etat.classeur ? (await d.lire(etat.classeur)).sort((a, b) => String(a.nom || a.code).localeCompare(String(b.nom || b.code), "fr")) : []; }
      catch (err) { console.warn(err); this._articles[o] = []; }
    }
  },
  _ficheArticle(a, onglet, vignette = false) {
    const set = onglet === ONGLET_SETS, lego = !set || estLego(a);
    const image = set ? (lego ? urlImageSet(a.code) : "") : `https://img.bricklink.com/ItemImage/GN/0/${encodeURIComponent(a.code)}.png`;
    const photo = image ? `<img class="photo" loading="lazy" src="${echapper(image)}" alt="" onerror="this.style.visibility='hidden'">`
      : `<span class="photo-custom">${this.ARTICLES[onglet].icone}</span>`;
    const lien = set ? (lego ? urlBricklinkSet(a.code) : urlEbayMarque(a)) : `https://www.bricklink.com/v2/catalog/catalogitem.page?G=${encodeURIComponent(a.code)}`;
    const bouton = `<a class="lien-ebay" href="${echapper(lien)}" target="_blank" rel="noopener">${lego ? "🔗 BrickLink" : "🔎 eBay.fr"}</a>`;
    const n = a.quantite || 1, nom = a.nom || a.type || a.code;
    const details = [!lego ? a.marque : "", a.code, set ? a.annee : a.type, a.etat].filter(Boolean).join(" · ");
    const attrs = `data-onglet="${echapper(onglet)}" data-article="${a.row}"`;
    if (vignette) return `<div class="vignette cliquable" ${attrs}>${photo}
        <div class="nom-court">${echapper(nom)}${n > 1 ? ` <span class="badge">×${n}</span>` : ""}</div><div class="code">${echapper(details)}</div></div>`;
    return `<div class="fiche cliquable" ${attrs}>${photo}
        <div class="infos"><div class="nom-court">${echapper(nom)}${n > 1 ? ` <span class="badge">×${n}</span>` : ""}</div>
          <div class="code">${echapper(details)}</div><div class="lieu">${echapper(onglet)}</div></div>${bouton}</div>`;
  },

  // Set ou objet touché : fiche avec sa photo et ses options (modifier, un de plus, un de moins)
  _ficheArticle2(onglet, row) {
    const a = this._articles[onglet].find(x => String(x.row) === String(row));
    if (!a) return;
    const set = onglet === ONGLET_SETS, lego = !set || estLego(a), n = a.quantite || 1;
    const image = set ? (lego ? urlImageSet(a.code) : "") : `https://img.bricklink.com/ItemImage/GN/0/${encodeURIComponent(a.code)}.png`;
    const lien = set ? (lego ? urlBricklinkSet(a.code) : urlEbayMarque(a)) : `https://www.bricklink.com/v2/catalog/catalogitem.page?G=${encodeURIComponent(a.code)}`;
    const details = [!lego ? a.marque : "", a.code, a.etat, n > 1 ? `${n} exemplaires` : ""].filter(Boolean).join(" · ");
    Visionneuse.ouvrir(`${a.nom || a.code} · ${details}`, image ? [{ src: image, legende: lego ? "Photo BrickLink" : "" }] : [], lien,
      lego ? "Voir sur BrickLink" : "Chercher sur eBay.fr", [
        { texte: "✏️ Modifier (nom, état, prix, remarques…)", faire: () => this._modifierArticle(onglet, a) },
        { texte: "➕ Un exemplaire de plus", faire: () => this._detailsArticle(onglet, row, 1) },
        { texte: n > 1 ? "➖ En retirer un" : "➖ Retirer de la collection", faire: () => this._detailsArticle(onglet, row, 2) }]);
  },

  // Set ou objet : un de plus, un de moins (ou le retirer) ; choix déjà fait (fiche), sinon petit menu
  async _detailsArticle(onglet, row, choix) {
    const a = this._articles[onglet].find(x => String(x.row) === String(row));
    if (!a) return;
    const d = this.ARTICLES[onglet], n = a.quantite || 1;
    const i = choix != null ? choix : await choisirAction(`${a.nom || a.code}\n${a.code} · ${onglet}\n${n > 1 ? `${n} exemplaires` : "1 exemplaire"}`,
      ["✏️ Modifier (nom, état, prix, remarques…)", "➕ Un exemplaire de plus", n > 1 ? "➖ En retirer un" : "➖ Retirer de la collection"]);
    if (i < 0) return;
    if (i === 0) { await this._modifierArticle(onglet, a); return; }
    try {
      if (i === 1 || n > 1) await etat.classeur.ecrireTexte(onglet, d.quantite + row, String(i === 1 ? n + 1 : n - 1));
      else {
        if (!(await demander(`Retirer « ${a.nom || a.code} » de votre collection ?`, "Retirer", "Annuler"))) return;
        for (const [l] of d.colonnes) await etat.classeur.viderCellule(onglet, l + row);
      }
      etat.nonEnregistres++;
      await memoriser();
      toast(i === 1 ? `« ${a.nom || a.code} » : ${n + 1} exemplaires ✔` : n > 1 ? `« ${a.nom || a.code} » : ${n - 1} exemplaire${n - 1 > 1 ? "s" : ""} ✔` : "Retiré ✔");
    } catch (err) { console.error(err); await demander("La modification a échoué : " + err.message, "OK", "Fermer"); }
    await this._chargerArticles();
    this.rendre();
  },

  // Fiche d'un set ou d'un objet : tous ses champs modifiables (même colonnes que l'onglet du fichier)
  async _modifierArticle(onglet, a) {
    const set = onglet === ONGLET_SETS, lego = !set || estLego(a), ouiNon = v => /^(oui|true|1|x)$/i.test(String(v || "").trim());
    const champs = set ? [
      { cle: "B", titre: "Nom", valeur: a.nom },
      ...(lego ? [] : [{ cle: "M", titre: "Marque", valeur: a.marque }]),
      { cle: "F", titre: "État", type: "choix", valeur: a.etat, options: ["Neuf scellé", "Monté", "Démonté (en boîte)", "Sans figurines", "Incomplet", "Boîte seule (vide)", "Autre"] },
      { cle: "G", titre: "Boîte d'origine", type: "case", valeur: ouiNon(a.boite) },
      { cle: "H", titre: "Notice", type: "case", valeur: ouiNon(a.notice) },
      { cle: "K", titre: "Quantité", type: "nombre", valeur: a.quantite || 1 },
      { cle: "N", titre: "Prix payé (€)", type: "nombre", valeur: a.prixPaye || "" },
      ...(lego ? [] : [{ cle: "O", titre: "Prix fabricant (€)", type: "nombre", valeur: a.prixFabricant || "" }]),
      { cle: "L", titre: "Remarques", valeur: a.remarques },
    ] : [
      { cle: "B", titre: "Nom", valeur: a.nom },
      { cle: "C", titre: "Type (porte-clés, lampe…)", valeur: a.type },
      { cle: "D", titre: "État", type: "choix", valeur: a.etat, options: ["Neuf (emballage)", "Occasion"] },
      { cle: "E", titre: "Quantité", type: "nombre", valeur: a.quantite || 1 },
      { cle: "F", titre: "Remarques", valeur: a.remarques },
    ];
    const v = await demanderFormulaire(`${a.nom || a.code}\n${a.code} · ${onglet}`, champs);
    if (!v) return;
    try {
      for (const c of champs) {
        let val = v[c.cle];
        if (c.type === "case") val = val ? "oui" : "non";
        if (c.type === "nombre") val = String(val).replace(",", ".").replace(/[^\d.]/g, "");
        if (c.cle === "K" || c.cle === "E") val = String(Math.max(1, parseInt(val, 10) || 1));
        await etat.classeur.ecrireTexte(onglet, c.cle + a.row, val);
      }
      etat.nonEnregistres++;
      await memoriser();
      toast(`« ${v.B || a.code} » modifié ✔`);
    } catch (err) { console.error(err); await demander("La modification a échoué : " + err.message, "OK", "Fermer"); }
    await this._chargerArticles();
    this.rendre();
  },

  // Fiche ou vignette touchée : sa photo -> photos en grand ; le reste -> menu (exemplaires, numéro, nom)
  clic(e) {
    if (e.target.closest("a")) return; // lien vers la page (JB, eBay.de, BrickLink)
    const th = e.target.closest("[data-theme-article]");
    if (th) { this.themeArticle[this.onglet] = th.dataset.themeArticle; this.rendre(); return; }
    const art = e.target.closest("[data-article]");
    if (art) { this._ficheArticle2(art.dataset.onglet, art.dataset.article); return; }
    const b = e.target.closest("[data-case]");
    if (!b) return;
    if (b.dataset.vue !== "planche") this._photos(b.dataset.onglet, b.dataset.case); // fiche : photos (les vôtres d'abord) et options
    else this._details(b.dataset.onglet, b.dataset.case);
  },

  // Onglets montrés : Gentils (vert), Méchants (rouge) et Zone grise réunis sous « Star Wars » (le camp ne sert qu'à la
  // couleur des étiquettes, à l'impression) ; la planche (depuis Impression) garde les vrais onglets
  _onglets() {
    const vrais = Object.keys(etat.collection || {});
    return this.vue === "planche" ? vrais : [...new Set(vrais.map(ongletAffiche))];
  },
  // Figurines d'un onglet montré, chacune avec son vrai onglet (pour les modifier)
  _figurines(onglet) {
    const vrais = this.vue === "planche" ? [onglet] : Object.keys(etat.collection).filter(o => ongletAffiche(o) === onglet);
    return vrais.flatMap(o => etat.collection[o].cases.filter(c => c.code).map(c => ({ ...c, onglet: o })));
  },

  async rendre() {
    const tour = ++this._tour;
    this._urls.forEach(u => URL.revokeObjectURL(u));
    this._urls = [];
    const texte = $("collection-recherche").value.trim();
    const onglets = this._onglets();

    $("collection-onglets").innerHTML = onglets.map(o => `
      <button class="puce ${!texte && o === this.onglet ? "choisi" : ""}" data-onglet="${echapper(o)}">
        <span class="pastille" style="background:${couleurOnglet(o)}"></span>${echapper(o)} (${this._figurines(o).length})
      </button>`).join("") + (this.vue === "planche" ? "" : Object.entries(this.ARTICLES).map(([o, d]) => `
      <button class="puce ${!texte && o === this.onglet ? "choisi" : ""}" data-onglet="${echapper(o)}">${d.icone} ${echapper(o)} (${this._quantite(o)})</button>`).join(""));
    $("collection-bascule").hidden = !!texte || this.vue === "planche"; // planche : ouverte depuis Impression
    $("collection-bascule").querySelectorAll("[data-vue]").forEach(b => b.classList.toggle("choisi", b.dataset.vue === this.vue));

    const contenu = $("collection-contenu");
    if (texte) {
      const mots = normaliser(texte).split(" ").filter(Boolean);
      const res = [];
      for (const o of onglets)
        for (const c of this._figurines(o))
          if (mots.every(m => normaliser(`${c.nom} ${c.code}`).includes(m))) res.push(c);
      const total = onglets.reduce((s, o) => s + this._figurines(o).length, 0);
      $("collection-info").textContent = res.length
        ? `${res.length} résultat(s) sur ${total} figurines.`
        : "Aucune figurine de votre collection ne correspond.";
      const articles = Object.keys(this.ARTICLES).flatMap(o => this._articles[o]
        .filter(a => mots.every(m => normaliser(`${a.nom} ${a.code} ${a.marque || ""} ${a.type || ""}`).includes(m))).map(a => this._ficheArticle(a, o)));
      if (articles.length) $("collection-info").textContent = `${res.length + articles.length} résultat(s).`;
      contenu.innerHTML = this._regrouper(res).map(g => this._fiche(g.cases[0], g.onglet, g.cases)).join("") + articles.join("");
      if (typeof Consulter !== "undefined") { Consulter.completerPhotos(contenu); this._photosAlbum(contenu); }
      return;
    }

    if (this._estArticles(this.onglet)) { // sets, objets dérivés : rangés par thème
      const o = this.onglet, tous = this._articles[o];
      const themes = new Map();
      for (const a of tous) { const t = this._themeArticle(a, o); if (!themes.has(t)) themes.set(t, []); themes.get(t).push(a); }
      const ordre = [...themes.keys()].sort((a, b) => this._rangTheme(a) - this._rangTheme(b) || a.localeCompare(b, "fr"));
      const choisi = themes.has(this.themeArticle[o]) ? this.themeArticle[o] : "";
      const n = l => l.reduce((s, a) => s + (a.quantite || 1), 0);
      const puces = `<div class="puces sous-puces"><button class="puce ${choisi ? "" : "choisi"}" data-theme-article="">Tous (${n(tous)})</button>` +
        ordre.map(t => `<button class="puce ${t === choisi ? "choisi" : ""}" data-theme-article="${echapper(t)}">${echapper(t)} (${n(themes.get(t))})</button>`).join("") + "</div>";
      const bloc = l => this.vue === "vignettes" ? `<div class="vignettes">${l.map(a => this._ficheArticle(a, o, true)).join("")}</div>`
        : l.map(a => this._ficheArticle(a, o)).join("");
      $("collection-info").textContent = `${tous.length} article(s) différent(s), ${n(tous)} en tout dans « ${o} ». ` +
        "Touchez un thème pour n'afficher que lui, un article pour en ajouter ou en retirer un.";
      contenu.innerHTML = puces + (choisi ? bloc(themes.get(choisi))
        : ordre.map(t => `<p class="sous-titre theme-titre">${echapper(t)} (${n(themes.get(t))})</p>${bloc(themes.get(t))}`).join(""));
      return;
    }

    const figs = this._figurines(this.onglet);
    if (this.vue === "liste" || this.vue === "vignettes") {
      const groupes = this._regrouper(figs);
      $("collection-info").textContent = `${groupes.length} figurine(s) différente(s), ${figs.length} exemplaire(s) dans « ${this.onglet} ». ` +
        "Touchez la photo pour la voir en grand, le reste pour ajouter, retirer un exemplaire ou corriger un numéro.";
      contenu.innerHTML = this.vue === "liste" ? groupes.map(g => this._fiche(g.cases[0], g.onglet, g.cases)).join("")
        : `<div class="vignettes">${groupes.map(g => this._vignette(g.cases[0], g.onglet, g.cases)).join("")}</div>`;
      if (typeof Consulter !== "undefined") { Consulter.completerPhotos(contenu); this._photosAlbum(contenu); }
      return;
    }

    // Planche (depuis Impression) : la grille des cases A à E telle qu'elle sera imprimée
    $("collection-info").textContent = `Planche « ${this.onglet} » : ${figs.length} figurine(s). Touchez une case pour son détail.`;
    contenu.innerHTML = `<p class="aide">Chargement…</p>`;
    const images = await etat.classeur.imagesEtiquettes(this.onglet);
    if (tour !== this._tour) return;
    const couleur = couleurOnglet(this.onglet);
    contenu.innerHTML = `<div class="planche">${etat.collection[this.onglet].cases.map(c => {
      const image = images.get(`${c.row}:${c.col}`);
      let dedans = "";
      if (image) {
        const url = URL.createObjectURL(image);
        this._urls.push(url);
        dedans = `<img src="${url}" alt="${echapper(c.code)}">`;
      } else if (c.code) {
        dedans = `<span class="sans">${echapper(c.code)}<br>sans étiquette</span>`;
      }
      return `<button class="case" style="background:${couleur}" data-vue="planche" data-onglet="${echapper(this.onglet)}" data-case="${c.ref}"
        aria-label="${echapper(c.ref + " " + (c.nom || "case vide"))}">${dedans}</button>`;
    }).join("")}</div>`;
  },

  // Page à ouvrir : lien de la custom, ou page BrickLink ; null s'il n'y en a pas
  _lien(c, onglet) {
    if (onglet === THEME_CUSTOMS.onglet) return c.lien || null;
    return codeInvalide(c.code) ? null : urlBricklink(c.code);
  },

  // Photos de « Ma base de blisters » (gardées dans le téléphone), par nom de figurine
  _mesBlisters: new Map(),
  async _chargerMesBlisters() {
    const m = new Map();
    for (const e of ((await Memoire.lire("base")) || []).filter(e => e.photo && e.nom && e.possede !== false))
      for (const k of new Set([normaliser(e.nom), normaliser(nomComplet(e)), ...(e.code ? ["#" + e.code.toUpperCase()] : [])])) {
        if (!m.has(k)) m.set(k, []); m.get(k).push(e);
      }
    this._mesBlisters = m;
  },
  // Photos de votre album (dépôt privé, avec le jeton) à la place de celles du site JB, quand il y en a
  _photosAlbum(racine) {
    for (const img of racine.querySelectorAll("img[data-ma-photo-prio]"))
      Consulter.maPhoto(img.dataset.maPhotoPrio).then(url => { if (url && img.isConnected) { img.src = url; img.style.visibility = ""; } }).catch(() => {});
  },
  // Mes blisters (base de blisters) d'une custom : par son code (JB-…, et ses autres codes du catalogue), puis par son nom
  _miens(c) {
    const f = CatalogueJB.liste && CatalogueJB.trouver(c.code);
    const codes = f ? CatalogueJB.codes(f) : [String(c.code || "").toUpperCase()];
    const res = [...codes.flatMap(k => this._mesBlisters.get("#" + k) || []), ...(this._mesBlisters.get(normaliser(this._sansNumero(c.nom))) || [])];
    return [...new Set(res)];
  },

  // Figurine du catalogue JB d'une custom : par son code (JB-…), son lien, ou son nom (codes CUS-… : « BLACK KRRSANTAN 52/150 »)
  _jbDe(c) {
    if (!CatalogueJB.liste) return null;
    const parCode = CatalogueJB.trouver(c.code) || CatalogueJB.parLien(c.lien);
    if (parCode) return parCode;
    if (!this._jbParNom) this._jbParNom = new Map(CatalogueJB.liste.map(f => [normaliser(nomCustomPourFichier(f.nom)), f]));
    return this._jbParNom.get(normaliser(this._sansNumero(c.nom))) || null;
  },
  // n° à la fin du nom : « 52/150 », ou seul (« CUTIE POOL 36 » : jusqu'à 3 chiffres, pour ne pas prendre une année)
  _sansNumero(nom) { return (nom || "").replace(/\s*(\d{1,4}\s*\/\s*\d{1,4}|\s\d{1,3})\s*$/, "").trim(); },

  // Photo d'une custom : celle du catalogue JB, sinon votre photo de blister (base de blisters, puis album
  // photo du dépôt privé), sinon un pictogramme
  _photoCustom(c) {
    const jb = this._jbDe(c);
    // votre photo de blister d'abord (c'est votre collection), sinon celle du catalogue JB
    const mien = this._miens(c)[0];
    if (mien) { const u = URL.createObjectURL(mien.photo); this._urls.push(u); return `<img class="photo" src="${u}" alt="">`; }
    // photo de votre album (dépôt privé) : remplace celle du site JB dès qu'elle est chargée (Consulter.maPhoto)
    if (jb && jb.image) return `<img class="photo" loading="lazy" src="${echapper(jb.image)}" alt="" data-ma-photo-prio="${echapper(jb.code)}" onerror="this.style.visibility='hidden'">`;
    if (jb) return `<img class="photo" data-ma-photo="${echapper(jb.code)}" alt="" style="visibility:hidden">`;
    return `<span class="photo-custom">🎨</span>`;
  },

  // Exemplaires d'une même figurine regroupés : même onglet, même code (customs : même nom, sans le n°)
  _cle(c, onglet) {
    return `${onglet}|${(c.code || "").toUpperCase()}` + (onglet === THEME_CUSTOMS.onglet ? `|${normaliser(this._sansNumero(c.nom))}` : "");
  },
  _regrouper(cases) {
    const groupes = new Map();
    for (const c of cases) {
      const k = this._cle(c, c.onglet);
      if (!groupes.has(k)) groupes.set(k, { onglet: c.onglet, cases: [] });
      groupes.get(k).cases.push(c);
    }
    for (const g of groupes.values()) g.cases = this._parNumero(g.cases);
    return [...groupes.values()];
  },
  // Exemplaires dans l'ordre croissant de leur n° (sans n° à la fin)
  _parNumero(cases) {
    const n = x => parseInt(this._numero(x), 10);
    return cases.slice().sort((a, b) => (isNaN(n(a)) ? Infinity : n(a)) - (isNaN(n(b)) ? Infinity : n(b)));
  },
  _numero(c) {
    const m = /(\d{1,4})\s*\/\s*(\d{1,4})\s*$/.exec(c.nom || ""), seul = !m && c.onglet === THEME_CUSTOMS.onglet && /\s(\d{1,3})\s*$/.exec(c.nom || "");
    return m ? `${m[1]}/${m[2]}` : seul ? seul[1] : "";
  },
  _base() { return !!(etat.classeur && etat.classeur.estBase); },
  _groupeDe(onglet, ref) {
    const c = etat.collection[onglet].cases.find(x => x.ref === ref);
    if (!c || !c.code) return null;
    const k = this._cle(c, onglet);
    return { c: { ...c, onglet }, cases: this._parNumero(etat.collection[onglet].cases.filter(x => x.code && this._cle(x, onglet) === k).map(x => ({ ...x, onglet }))) };
  },

  _fiche(c, onglet, cases = [c]) {
    const custom = onglet === THEME_CUSTOMS.onglet, n = cases.length;
    const nums = cases.map(x => this._numero(x)).filter(Boolean);
    const lieux = n > 1 ? `cases ${cases.map(x => x.ref).join(", ")}` : `case ${c.ref}`;
    cases = cases.map(x => ({ ...x, onglet }));
    return `
      <div class="fiche cliquable" data-onglet="${echapper(onglet)}" data-case="${c.ref}">
        ${custom ? this._photoCustom(c) : imageHtml({ id: c.code }, "photo")}
        <div class="infos">
          <div class="nom-court">${this._pastilleCamp(onglet)}${echapper((custom ? this._sansNumero(c.nom) : c.nom) || "(sans nom)")}${n > 1 ? ` <span class="badge">×${n}</span>` : ""}</div>
          <div class="code">${this._ligneCode(c, onglet, nums)}</div>
          <div class="lieu">${echapper(ongletAffiche(onglet))}${etat.classeur && etat.classeur.estBase ? "" : `, ${lieux}${cases.some(x => !x.image) ? " · sans étiquette" : ""}`}</div>
        </div>
        ${liensFiche(this._lien(c, onglet), "Voir la page")}
      </div>`;
  },

  // Camp d'une figurine Star Wars (couleur de son étiquette) : petite pastille verte, rouge ou grise devant le nom
  _pastilleCamp(onglet) {
    if (!ONGLETS_COLORES.includes(onglet)) return "";
    const camp = { "Gentils (vert)": "Gentil", "Méchants (rouge)": "Méchant", "Zone grise": "Zone grise" }[onglet] || onglet;
    return `<span class="pastille pastille-camp" style="background:${couleurOnglet(onglet)}" title="${camp}" aria-label="${camp}"></span>`;
  },

  // Ligne sous le nom : n° des exemplaires ; le code (celui des étiquettes) seulement pour les figurines LEGO, où c'est
  // la référence BrickLink — les codes des customs (CUS-…, JB-…) ne servent qu'à l'impression des étiquettes
  _ligneCode(c, onglet, nums) {
    const custom = onglet === THEME_CUSTOMS.onglet;
    return echapper([custom ? "" : c.code, nums.length ? `n° ${nums.join(", ")}` : ""].filter(Boolean).join(" · "));
  },

  // Vignette : grande photo, nom, nombre d'exemplaires et n°
  _vignette(c, onglet, cases = [c]) {
    const custom = onglet === THEME_CUSTOMS.onglet, n = cases.length;
    const nums = cases.map(x => this._numero({ ...x, onglet })).filter(Boolean);
    return `
      <div class="vignette cliquable" data-onglet="${echapper(onglet)}" data-case="${c.ref}">
        ${custom ? this._photoCustom(c) : imageHtml({ id: c.code }, "photo")}
        <div class="nom-court">${this._pastilleCamp(onglet)}${echapper((custom ? this._sansNumero(c.nom) : c.nom) || "(sans nom)")}${n > 1 ? ` <span class="badge">×${n}</span>` : ""}</div>
        <div class="code">${this._ligneCode(c, onglet, nums)}</div>
      </div>`;
  },

  // Photos en grand d'une figurine : vos blisters (recto, verso de chaque exemplaire), puis la photo du catalogue ;
  // lien vers sa page (JB Spielwaren, eBay.de, BrickLink)
  _photos(onglet, ref) {
    const g = this._groupeDe(onglet, ref);
    if (!g) return;
    const { c, cases } = g, custom = onglet === THEME_CUSTOMS.onglet, lien = this._lien(c, onglet);
    const nom = (custom ? this._sansNumero(c.nom) : c.nom) || c.code;
    const images = [];
    if (custom) {
      // exemplaires photographiés avec la même photo (ex. 8 blisters ajoutés d'un coup) : la photo une seule fois,
      // avec tous leurs n° dessous, dans l'ordre croissant
      const memes = new Map();
      for (const e of this._miens(c)) {
        const k = `${e.photo.size}|${e.verso ? e.verso.size : 0}`;
        if (!memes.has(k)) memes.set(k, []);
        memes.get(k).push(e);
      }
      for (const l of memes.values()) {
        const nums = l.filter(e => e.numero).sort((a, b) => a.numero - b.numero).map(e => e.numero + (e.serie ? "/" + e.serie : ""));
        const qui = l.length > 1 ? (nums.length ? ` · n° ${nums.join(", ")}` : ` · ${l.length} exemplaires`) : "";
        images.push(...Base.imagesBlister(l[0]).map(im => ({ ...im, legende: "Ma photo · " + (l.length > 1 ? im.legende.split(" · ")[0] + qui : im.legende) })));
      }
      const jb = this._jbDe(c);
      // vos photos de blister suffisent : celles de l'album et du site JB seulement s'il n'y en a pas
      if (!images.length && jb && typeof Consulter !== "undefined" && Consulter.mesPhotos) { // vos photos d'album (dépôt privé)
        const album = Consulter._album(jb);
        album.forEach((ph, i) => images.push({ src: Consulter._imageAlbum(ph.photo), legende: `Mon album ${i + 1}/${album.length}${ph.numero ? ` · n° ${ph.numero}` : ""}` }));
      }
      if (!images.length && jb && jb.image) images.push({ src: jb.image, legende: "Photo du site JB Spielwaren" });
    } else images.push({ src: imageBricklink(c.code), legende: "Photo BrickLink" });
    const texte = !lien ? "" : estLienEbay(lien) ? "Chercher sur eBay.de" : /jb-spielwaren/i.test(lien) ? "Voir chez JB Spielwaren"
      : /bricklink/i.test(lien) ? "Voir sur BrickLink" : "Voir sa page";
    const nums = cases.map(x => this._numero(x)).filter(Boolean);
    const titre = `${nom}${custom ? "" : ` · ${c.code}`} · ${cases.length > 1 ? `${cases.length} exemplaires` : "1 exemplaire"}${nums.length ? ` (n° ${nums.join(", ")})` : ""}`;
    Visionneuse.ouvrir(titre, images, lien || "", texte, this._actionsFigurine(onglet, g).filter(a => a.cle !== "lien"));
  },

  // Options d'une figurine (fiche avec photos, ou menu de la planche)
  _actionsFigurine(onglet, g) {
    const { c, cases } = g, custom = onglet === THEME_CUSTOMS.onglet, lien = this._lien(c, onglet);
    const nums = cases.map(x => this._numero({ ...x, onglet })).filter(Boolean);
    const a = (cle, texte, faire) => ({ cle, texte, faire });
    return [
      ...(custom ? [a("blister", this._miens(c).length ? "📷 Changer les photos (recto, verso), recadrer, n°, note" : "📷 Ajouter la photo du blister", () => this._blisters(c, cases))] : []),
      // custom déjà photographiée : comme au recensement (même photo, n° à taper, « nouveau ✔ » en vert), sans étiquette
      a("plus", "➕ Ajouter un exemplaire" + (custom ? " (nouveau n°)" : ""), async () => {
        const mien = custom && this._miens(c)[0];
        if (!mien) { exemplaireEnPlus(c, onglet); return; }
        await Base.ouvrir();
        Base.exemplaireDe(mien.id);
      }),
      a("moins", cases.length > 1 ? "➖ Retirer un exemplaire" : "➖ Retirer de la collection", () => this._retirer(onglet, cases)),
      ...(custom ? [a("numero", nums.length ? "✏️ Corriger un numéro" : "✏️ Indiquer le numéro", () => this._corrigerNumero(onglet, cases))] : []),
      a("nom", "🔤 Renommer" + (cases.length > 1 ? ` (les ${cases.length} exemplaires)` : ""), () => this._renommer(onglet, cases)),
      ...(lien ? [a("lien", custom ? "🔗 Voir la page" : "🔗 Voir sur BrickLink", () => {
        const l = lienOuvrable(lien);
        if (l.startsWith("intent:")) location.href = l; else window.open(l, "_blank", "noopener");
      })] : []),
    ];
  },

  // Case de la planche touchée : petit menu (exemplaire de plus sans photo, en retirer un, corriger un n°, page BrickLink ou du fabricant)
  async _details(onglet, ref) {
    const g = this._groupeDe(onglet, ref);
    if (!g) { toast(`Case ${ref} : vide.`); return; }
    const { c, cases } = g, custom = onglet === THEME_CUSTOMS.onglet, lien = this._lien(c, onglet);
    const nums = cases.map(x => this._numero({ ...x, onglet })).filter(Boolean);
    const actions = this._actionsFigurine(onglet, g);
    const titre = `${(custom ? this._sansNumero(c.nom) : c.nom) || "(sans nom)"}\n${custom ? "" : c.code + " · "}${ongletAffiche(onglet)}\n` +
      (cases.length > 1 ? `${cases.length} exemplaires` : "1 exemplaire") + (nums.length ? ` (n° ${nums.join(", ")})` : "") +
      (etat.classeur && etat.classeur.estBase ? "" : ` · ${cases.length > 1 ? "cases" : "case"} ${cases.map(x => x.ref).join(", ")}`);
    const i = await choisirAction(titre, actions.map(a => a.texte));
    if (i >= 0) await actions[i].faire();
  },

  // Blisters de cette custom dans « Ma base de blisters » (photos recto et verso, n°, note) : ouverts là-bas, la fiche
  // de modification directement s'il n'y en a qu'un. Sans photo : la photo choisie crée un blister par exemplaire.
  async _blisters(c, cases) {
    const nom = this._sansNumero(c.nom).toUpperCase();
    if (!this._miens(c).length) {
      const fichier = await new Promise(ok => {
        const input = document.createElement("input");
        input.type = "file"; input.accept = "image/*";
        input.onchange = () => ok(input.files[0] || null);
        input.click();
      });
      if (!fichier) return;
      await Base.ouvrir();
      const { blob, cadre } = await Base._preparer(fichier, 0, "recto");
      const jb = /^JB-/i.test(c.code) ? c.code : "";
      for (const x of cases) {
        const n = this._numero(x), [numero, serie] = n.includes("/") ? n.split("/") : [n, ""];
        Base.entrees.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, recadre: true, nom, precision: "",
          numerote: !!n, numero, serie, remarque: "", code: jb, photo: blob, verso: null, exporte: false, possede: true, date: new Date().toISOString() });
      }
      // photo encore recadrable (« ✂️ Recadrer le recto » dans la fiche de chaque blister créé)
      const crees = Base.entrees.slice(-cases.length);
      const r = { cote: "recto", fichier, sens: 0, cadre, cibles: crees, carte: null };
      Base._remplacements = Base._remplacements || {};
      for (const x of crees) Base._remplacements[`${x.id}|recto`] = r;
      await Memoire.ecrire(Base.entrees, "base");
      await this._chargerMesBlisters();
      toast(`Photo ajoutée ✔ : ajoutez le verso, recadrez si besoin`, 4500);
    } else await Base.ouvrir();
    // vos blisters de cette figurine (par son code JB, ou son nom) : la liste filtrée sur leur nom imprimé
    const ids = new Set(this._miens(c).map(e => e.id));
    let miens = Base.entrees.filter(e => ids.has(e.id));
    if (!miens.length) miens = Base.entrees.filter(e => normaliser(e.nom) === normaliser(nom) || normaliser(nomComplet(e)) === normaliser(nom));
    const garder = new Set(miens.map(e => e.id));
    Base.filtrerSur(miens.length ? miens[0].nom : nom, e => garder.has(e.id));
    Base.vue = "photos";
    Base._afficherListe();
    if (miens.length === 1) Base.modifier(miens[0].id);
    const zone = $("base-liste");
    if (zone) zone.scrollIntoView({ block: "start" });
  },

  // Exemplaire concerné : le seul, ou celui choisi dans la liste (n° et case)
  async _choisirExemplaire(question, cases) {
    if (cases.length === 1) return cases[0];
    const i = await choisirAction(question, cases.map(x => `${this._numero(x) ? "n° " + this._numero(x) : "sans n°"}${this._base() ? "" : ` · case ${x.ref}`}`));
    return i >= 0 ? cases[i] : null;
  },

  async _modifierFichier(faire, message) {
    try {
      await faire();
      etat.nonEnregistres++;
      await memoriser();
      await relireContenu();
      toast(`${message} ✔${this._base() ? "" : " (pensez à « Enregistrer »)"}`, 4500);
    } catch (err) {
      console.error(err);
      const m = await Memoire.lire();
      if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
      await demander("La modification a échoué : " + err.message, "OK", "Fermer");
    }
    this.rendre();
  },

  async _retirer(onglet, cases) {
    const x = await this._choisirExemplaire("Quel exemplaire retirer ?", cases);
    if (!x) return;
    const quoi = this._base() ? `« ${x.nom || x.code} »` : `« ${x.nom || x.code} » (${onglet}, case ${x.ref})`;
    if (!(await demander(`Retirer ${quoi} de votre collection ?` + (this._base() ? "" : "\n\nSon étiquette est effacée et la case redevient libre."), "Retirer", "Annuler"))) return;
    await this._modifierFichier(() => retirerFigurine(etat.classeur, onglet, x.row, x.col), `${quoi} retiré`);
  },

  // Nouveau nom pour tous les exemplaires de la figurine (customs : chaque exemplaire garde son n°)
  async _renommer(onglet, cases) {
    const custom = onglet === THEME_CUSTOMS.onglet, actuel = custom ? this._sansNumero(cases[0].nom) : cases[0].nom;
    const saisi = await demanderTexte(`Nouveau nom${cases.length > 1 ? ` (pour les ${cases.length} exemplaires)` : ""}${custom ? ", sans le numéro" : ""} :`, actuel || "");
    if (saisi == null || !saisi.trim() || saisi.trim() === actuel) return;
    const nom = saisi.trim().replace(/\s+/g, " ");
    await this._modifierFichier(async () => {
      for (const x of cases) {
        const num = custom ? this._numero(x) : "";
        await renommerFigurine(etat.classeur, onglet, x.row, x.col, num ? `${nom} ${num}` : nom);
      }
    }, `Renommé « ${nom} »${cases.length > 1 ? ` (${cases.length} exemplaires)` : ""}`);
  },

  async _corrigerNumero(onglet, cases) {
    const x = await this._choisirExemplaire("Quel exemplaire corriger ?", cases);
    if (!x) return;
    const ancien = this._numero(x), serie = ancien.split("/")[1] || (cases.map(y => this._numero(y)).find(Boolean) || "").split("/")[1] || "";
    const saisi = await demanderTexte(`Numéro de cet exemplaire${this._base() ? "" : ` (case ${x.ref})`}${serie ? `, série limitée à ${serie}` : ""} :`, ancien || (serie ? "/" + serie : ""), { chiffres: true });
    if (saisi == null) return;
    const m = /^(\d{1,4})\s*(?:\/\s*(\d{1,4}))?$/.exec(saisi);
    if (!m) { await demander(`« ${saisi} » : tapez un numéro, par exemple 52 ou 52/150.`, "OK", "Fermer"); return; }
    const nouveau = `${+m[1]}${m[2] || serie ? "/" + (m[2] || serie) : ""}`;
    if (nouveau === ancien) return;
    const pris = cases.find(y => y !== x && this._numero(y) === nouveau);
    if (pris) { await demander(`Le n° ${nouveau} est déjà enregistré${this._base() ? "" : ` (case ${pris.ref})`}.`, "OK", "Fermer"); return; }
    const nom = `${this._sansNumero(x.nom)} ${nouveau}`.trim();
    await this._modifierFichier(() => renommerFigurine(etat.classeur, onglet, x.row, x.col, nom), this._base() ? `N° ${nouveau}` : `Case ${x.ref} : n° ${nouveau}`);
  },
};
