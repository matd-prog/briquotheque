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

  // Set ou objet touché : un de plus, un de moins (ou le retirer), voir sa page
  async _detailsArticle(onglet, row) {
    const a = this._articles[onglet].find(x => String(x.row) === String(row));
    if (!a) return;
    const d = this.ARTICLES[onglet], n = a.quantite || 1;
    const i = await choisirAction(`${a.nom || a.code}\n${a.code} · ${onglet}\n${n > 1 ? `${n} exemplaires` : "1 exemplaire"}`,
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
    if (art) { this._detailsArticle(art.dataset.onglet, art.dataset.article); return; }
    const b = e.target.closest("[data-case]");
    if (!b) return;
    if (e.target.closest(".photo, .photo-custom") && b.dataset.vue !== "planche") this._photos(b.dataset.onglet, b.dataset.case);
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
      if (typeof Consulter !== "undefined") Consulter.completerPhotos(contenu);
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
      if (typeof Consulter !== "undefined") Consulter.completerPhotos(contenu);
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
      for (const k of new Set([normaliser(e.nom), normaliser(nomComplet(e))])) { if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
    this._mesBlisters = m;
  },
  // Mes blisters (base de blisters) d'une custom, d'après son nom
  _miens(c) { return this._mesBlisters.get(normaliser(this._sansNumero(c.nom))) || []; },

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
    if (jb && jb.image) return `<img class="photo" loading="lazy" src="${echapper(jb.image)}" alt="" onerror="this.style.visibility='hidden'">`;
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
    return [...groupes.values()];
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
    return { c: { ...c, onglet }, cases: etat.collection[onglet].cases.filter(x => x.code && this._cle(x, onglet) === k).map(x => ({ ...x, onglet })) };
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
          <div class="code">${echapper(c.code)}${nums.length ? ` · n° ${echapper(nums.join(", "))}` : ""}</div>
          <div class="lieu">${echapper(ongletAffiche(onglet))}${etat.classeur && etat.classeur.estBase ? "" : `, ${lieux}`}${cases.some(x => !x.image) ? " · sans étiquette" : ""}</div>
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

  // Vignette : grande photo, nom, nombre d'exemplaires et n°
  _vignette(c, onglet, cases = [c]) {
    const custom = onglet === THEME_CUSTOMS.onglet, n = cases.length;
    const nums = cases.map(x => this._numero({ ...x, onglet })).filter(Boolean);
    return `
      <div class="vignette cliquable" data-onglet="${echapper(onglet)}" data-case="${c.ref}">
        ${custom ? this._photoCustom(c) : imageHtml({ id: c.code }, "photo")}
        <div class="nom-court">${this._pastilleCamp(onglet)}${echapper((custom ? this._sansNumero(c.nom) : c.nom) || "(sans nom)")}${n > 1 ? ` <span class="badge">×${n}</span>` : ""}</div>
        <div class="code">${echapper(c.code)}${nums.length ? ` · n° ${echapper(nums.join(", "))}` : ""}</div>
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
      for (const e of this._miens(c)) images.push(...Base.imagesBlister(e).map(im => ({ ...im, legende: "Mon blister · " + im.legende })));
      const jb = this._jbDe(c);
      if (jb && jb.image) images.push({ src: jb.image, legende: "Photo du site JB Spielwaren" });
    } else images.push({ src: imageBricklink(c.code), legende: "Photo BrickLink" });
    const texte = !lien ? "" : estLienEbay(lien) ? "Chercher sur eBay.de" : /jb-spielwaren/i.test(lien) ? "Voir chez JB Spielwaren"
      : /bricklink/i.test(lien) ? "Voir sur BrickLink" : "Voir sa page";
    Visionneuse.ouvrir(`${nom} · ${c.code}`, images, lien || "", texte,
      [{ texte: "✏️ Exemplaires, numéros, nom…", faire: () => this._details(onglet, ref) }]);
  },

  // Figurine touchée : petit menu (exemplaire de plus sans photo, en retirer un, corriger un n°, page BrickLink ou du fabricant)
  async _details(onglet, ref) {
    const g = this._groupeDe(onglet, ref);
    if (!g) { toast(`Case ${ref} : vide.`); return; }
    const { c, cases } = g, custom = onglet === THEME_CUSTOMS.onglet, lien = this._lien(c, onglet);
    const nums = cases.map(x => this._numero({ ...x, onglet })).filter(Boolean);
    const actions = [["plus", "➕ Ajouter un exemplaire" + (custom ? " (nouveau n°)" : "")],
                     ["moins", cases.length > 1 ? "➖ Retirer un exemplaire" : "➖ Retirer de la collection"]];
    if (custom) actions.push(["blister", this._miens(c).length ? "📷 Photos du blister (recto, verso), n°, note" : "📷 Ajouter la photo du blister"]);
    if (custom) actions.push(["numero", nums.length ? "✏️ Corriger un numéro" : "✏️ Indiquer le numéro"]);
    actions.push(["nom", "🔤 Renommer" + (cases.length > 1 ? ` (les ${cases.length} exemplaires)` : "")]);
    if (lien) actions.push(["lien", custom ? "🔗 Voir la page" : "🔗 Voir sur BrickLink"]);
    const titre = `${(custom ? this._sansNumero(c.nom) : c.nom) || "(sans nom)"}\n${c.code} · ${ongletAffiche(onglet)}\n` +
      (cases.length > 1 ? `${cases.length} exemplaires` : "1 exemplaire") + (nums.length ? ` (n° ${nums.join(", ")})` : "") +
      (etat.classeur && etat.classeur.estBase ? "" : ` · ${cases.length > 1 ? "cases" : "case"} ${cases.map(x => x.ref).join(", ")}`);
    const i = await choisirAction(titre, actions.map(a => a[1]));
    const action = i >= 0 ? actions[i][0] : "";
    if (action === "plus") exemplaireEnPlus(c, onglet);
    else if (action === "moins") await this._retirer(onglet, cases);
    else if (action === "numero") await this._corrigerNumero(onglet, cases);
    else if (action === "blister") await this._blisters(c, cases);
    else if (action === "nom") await this._renommer(onglet, cases);
    else if (action === "lien") {
      const l = lienOuvrable(lien);
      if (l.startsWith("intent:")) location.href = l; else window.open(l, "_blank", "noopener");
    }
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
      const { blob } = await Base._preparer(fichier, 0, "recto");
      const jb = /^JB-/i.test(c.code) ? c.code : "";
      for (const x of cases) {
        const n = this._numero(x), [numero, serie] = n.includes("/") ? n.split("/") : [n, ""];
        Base.entrees.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, recadre: true, nom, precision: "",
          numerote: !!n, numero, serie, remarque: "", code: jb, photo: blob, verso: null, exporte: false, possede: true, date: new Date().toISOString() });
      }
      await Memoire.ecrire(Base.entrees, "base");
      await this._chargerMesBlisters();
      toast(`Photo ajoutée ✔ : ajoutez le verso, recadrez si besoin`, 4500);
    } else await Base.ouvrir();
    if ($("base-filtre")) $("base-filtre").value = nom;
    Base.vue = "photos";
    Base._afficherListe();
    const miens = Base.entrees.filter(e => normaliser(e.nom) === normaliser(nom) || normaliser(nomComplet(e)) === normaliser(nom));
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
