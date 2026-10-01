// Consultation de la collection (lecture seule) : figurines des onglets de l'appli,
// en liste ou en planche (les étiquettes telles qu'imprimées), avec une recherche globale.

const Collection = {
  onglet: null,
  vue: "liste",
  _urls: [],
  _tour: 0, // évite qu'un ancien affichage (plus lent) remplace le plus récent

  ouvrir() {
    CatalogueJB.charger().then(() => this.rendre()).catch(() => {}); // photos des customs JB
    this._chargerMesBlisters().then(() => this.rendre()).catch(() => {});
    const onglets = Object.keys(etat.collection || {});
    if (!onglets.includes(this.onglet)) this.onglet = onglets.find(o => this._figurines(o).length) || onglets[0];
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
    $("collection-contenu").addEventListener("click", e => {
      if (e.target.closest("a")) return; // lien 🔗 de la fiche
      const b = e.target.closest("[data-case]");
      if (b) this._details(b.dataset.onglet, b.dataset.case);
    });
  },

  _figurines(onglet) {
    return etat.collection[onglet].cases.filter(c => c.code);
  },

  async rendre() {
    const tour = ++this._tour;
    this._urls.forEach(u => URL.revokeObjectURL(u));
    this._urls = [];
    const texte = $("collection-recherche").value.trim();
    const onglets = Object.keys(etat.collection);

    $("collection-onglets").innerHTML = onglets.map(o => `
      <button class="puce ${!texte && o === this.onglet ? "choisi" : ""}" data-onglet="${echapper(o)}">
        <span class="pastille" style="background:${couleurOnglet(o)}"></span>${echapper(o)} (${this._figurines(o).length})
      </button>`).join("");
    $("collection-bascule").hidden = !!texte;
    $("collection-bascule").querySelectorAll("[data-vue]").forEach(b => b.classList.toggle("choisi", b.dataset.vue === this.vue));

    const contenu = $("collection-contenu");
    if (texte) {
      const mots = normaliser(texte).split(" ").filter(Boolean);
      const res = [];
      for (const o of onglets)
        for (const c of this._figurines(o))
          if (mots.every(m => normaliser(`${c.nom} ${c.code}`).includes(m))) res.push({ ...c, onglet: o });
      const total = onglets.reduce((s, o) => s + this._figurines(o).length, 0);
      $("collection-info").textContent = res.length
        ? `${res.length} résultat(s) sur ${total} figurines.`
        : "Aucune figurine de votre collection ne correspond.";
      contenu.innerHTML = this._regrouper(res).map(g => this._fiche(g.cases[0], g.onglet, g.cases)).join("");
      if (typeof Consulter !== "undefined") Consulter.completerPhotos(contenu);
      return;
    }

    const figs = this._figurines(this.onglet);
    if (this.vue === "liste") {
      const groupes = this._regrouper(figs.map(c => ({ ...c, onglet: this.onglet })));
      $("collection-info").textContent = `${groupes.length} figurine(s) différente(s), ${figs.length} exemplaire(s) dans « ${this.onglet} ». ` +
        "Touchez une figurine pour ajouter, retirer un exemplaire ou corriger un numéro.";
      contenu.innerHTML = groupes.map(g => this._fiche(g.cases[0], g.onglet, g.cases)).join("");
      if (typeof Consulter !== "undefined") Consulter.completerPhotos(contenu);
      return;
    }

    // Planche : la grille des cases A à E telle qu'elle sera imprimée
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
      return `<button class="case" style="background:${couleur}" data-onglet="${echapper(this.onglet)}" data-case="${c.ref}"
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
    for (const e of ((await Memoire.lire("base")) || []).filter(e => e.photo && e.nom))
      for (const k of [normaliser(e.nom), normaliser(nomComplet(e))]) if (!m.has(k)) m.set(k, e.photo);
    this._mesBlisters = m;
  },

  // Figurine du catalogue JB d'une custom : par son code (JB-…), son lien, ou son nom (codes CUS-… : « BLACK KRRSANTAN 52/150 »)
  _jbDe(c) {
    if (!CatalogueJB.liste) return null;
    const parCode = CatalogueJB.trouver(c.code) || CatalogueJB.parLien(c.lien);
    if (parCode) return parCode;
    if (!this._jbParNom) this._jbParNom = new Map(CatalogueJB.liste.map(f => [normaliser(nomCustomPourFichier(f.nom)), f]));
    return this._jbParNom.get(normaliser(this._sansNumero(c.nom))) || null;
  },
  _sansNumero(nom) { return (nom || "").replace(/\s*\d{1,4}\s*\/\s*\d{1,4}\s*$/, "").trim(); },

  // Photo d'une custom : celle du catalogue JB, sinon votre photo de blister (base de blisters, puis album
  // photo du dépôt privé), sinon un pictogramme
  _photoCustom(c) {
    const jb = this._jbDe(c);
    if (jb && jb.image) return `<img class="photo" loading="lazy" src="${echapper(jb.image)}" alt="" onerror="this.style.visibility='hidden'">`;
    const mien = this._mesBlisters.get(normaliser(this._sansNumero(c.nom)));
    if (mien) { const u = URL.createObjectURL(mien); this._urls.push(u); return `<img class="photo" src="${u}" alt="">`; }
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
  _numero(c) { const m = /(\d{1,4})\s*\/\s*(\d{1,4})\s*$/.exec(c.nom || ""); return m ? `${m[1]}/${m[2]}` : ""; },
  _groupeDe(onglet, ref) {
    const c = etat.collection[onglet].cases.find(x => x.ref === ref);
    if (!c || !c.code) return null;
    const k = this._cle(c, onglet);
    return { c, cases: etat.collection[onglet].cases.filter(x => x.code && this._cle(x, onglet) === k) };
  },

  _fiche(c, onglet, cases = [c]) {
    const custom = onglet === THEME_CUSTOMS.onglet, n = cases.length;
    const nums = cases.map(x => this._numero(x)).filter(Boolean);
    const lieux = n > 1 ? `cases ${cases.map(x => x.ref).join(", ")}` : `case ${c.ref}`;
    return `
      <div class="fiche cliquable" data-onglet="${echapper(onglet)}" data-case="${c.ref}">
        ${custom ? this._photoCustom(c) : imageHtml({ id: c.code }, "photo")}
        <div class="infos">
          <div class="nom-court">${echapper((custom ? this._sansNumero(c.nom) : c.nom) || "(sans nom)")}${n > 1 ? ` <span class="badge">×${n}</span>` : ""}</div>
          <div class="code">${echapper(c.code)}${nums.length ? ` · n° ${echapper(nums.join(", "))}` : ""}</div>
          <div class="lieu">${echapper(onglet)}, ${lieux}${cases.some(x => !x.image) ? " · sans étiquette" : ""}</div>
        </div>
        ${liensFiche(this._lien(c, onglet), "Voir la page")}
      </div>`;
  },

  // Figurine touchée : petit menu (exemplaire de plus sans photo, en retirer un, corriger un n°, page BrickLink ou du fabricant)
  async _details(onglet, ref) {
    const g = this._groupeDe(onglet, ref);
    if (!g) { toast(`Case ${ref} : vide.`); return; }
    const { c, cases } = g, custom = onglet === THEME_CUSTOMS.onglet, lien = this._lien(c, onglet);
    const nums = cases.map(x => this._numero(x)).filter(Boolean);
    const actions = [["plus", "➕ Ajouter un exemplaire" + (custom ? " (nouveau n°)" : "")],
                     ["moins", cases.length > 1 ? "➖ Retirer un exemplaire" : "➖ Retirer de la collection"]];
    if (custom) actions.push(["numero", nums.length ? "✏️ Corriger un numéro" : "✏️ Indiquer le numéro"]);
    if (lien) actions.push(["lien", custom ? "🔗 Voir la page" : "🔗 Voir sur BrickLink"]);
    const titre = `${(custom ? this._sansNumero(c.nom) : c.nom) || "(sans nom)"}\n${c.code} · ${onglet}\n` +
      (cases.length > 1 ? `${cases.length} exemplaires` : "1 exemplaire") + (nums.length ? ` (n° ${nums.join(", ")})` : "") +
      ` · ${cases.length > 1 ? "cases" : "case"} ${cases.map(x => x.ref).join(", ")}`;
    const i = await choisirAction(titre, actions.map(a => a[1]));
    const action = i >= 0 ? actions[i][0] : "";
    if (action === "plus") exemplaireEnPlus(c, onglet);
    else if (action === "moins") await this._retirer(onglet, cases);
    else if (action === "numero") await this._corrigerNumero(onglet, cases);
    else if (action === "lien") {
      const l = lienOuvrable(lien);
      if (l.startsWith("intent:")) location.href = l; else window.open(l, "_blank", "noopener");
    }
  },

  // Exemplaire concerné : le seul, ou celui choisi dans la liste (n° et case)
  async _choisirExemplaire(question, cases) {
    if (cases.length === 1) return cases[0];
    const i = await choisirAction(question, cases.map(x => `${this._numero(x) ? "n° " + this._numero(x) : "sans n°"} · case ${x.ref}`));
    return i >= 0 ? cases[i] : null;
  },

  async _modifierFichier(faire, message) {
    try {
      await faire();
      etat.nonEnregistres++;
      await memoriser();
      await relireContenu();
      toast(`${message} ✔ (pensez à « Enregistrer »)`, 4500);
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
    const quoi = `« ${x.nom || x.code} » (${onglet}, case ${x.ref})`;
    if (!(await demander(`Retirer ${quoi} de votre collection ?\n\nSon étiquette est effacée et la case redevient libre.`, "Retirer", "Annuler"))) return;
    await this._modifierFichier(() => retirerFigurine(etat.classeur, onglet, x.row, x.col), `${quoi} retiré`);
  },

  async _corrigerNumero(onglet, cases) {
    const x = await this._choisirExemplaire("Quel exemplaire corriger ?", cases);
    if (!x) return;
    const ancien = this._numero(x), serie = ancien.split("/")[1] || (cases.map(y => this._numero(y)).find(Boolean) || "").split("/")[1] || "";
    const saisi = await demanderTexte(`Numéro de cet exemplaire (case ${x.ref})${serie ? `, série limitée à ${serie}` : ""} :`, ancien || (serie ? "/" + serie : ""), { chiffres: true });
    if (saisi == null) return;
    const m = /^(\d{1,4})\s*(?:\/\s*(\d{1,4}))?$/.exec(saisi);
    if (!m) { await demander(`« ${saisi} » : tapez un numéro, par exemple 52 ou 52/150.`, "OK", "Fermer"); return; }
    const nouveau = `${+m[1]}${m[2] || serie ? "/" + (m[2] || serie) : ""}`;
    if (nouveau === ancien) return;
    const pris = cases.find(y => y !== x && this._numero(y) === nouveau);
    if (pris) { await demander(`Le n° ${nouveau} est déjà enregistré (case ${pris.ref}).`, "OK", "Fermer"); return; }
    const nom = `${this._sansNumero(x.nom)} ${nouveau}`.trim();
    await this._modifierFichier(() => renommerFigurine(etat.classeur, onglet, x.row, x.col, nom), `Case ${x.ref} : n° ${nouveau}`);
  },
};
