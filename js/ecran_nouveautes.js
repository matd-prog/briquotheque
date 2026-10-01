// Écran « 🆕 Nouveautés » : les sorties LEGO de l'année (data/nouveautes.tsv, relu chaque nuit depuis Rebrickable,
// js/nouveautes.js), en quatre onglets : récentes (apparues ces dernières semaines), figurines, sets et objets
// dérivés, classés par thème (Star Wars, City, Harry Potter… ; boutiques LEGO et BAM à part). Chaque article dit
// s'il est déjà dans la collection (✅) ; un toucher l'ouvre pour l'ajouter.

const EcranNouveautes = {
  onglet: "mois",
  theme: "",
  mois: "",
  _possedes: { sets: new Set(), objets: new Set() },

  async ouvrir() {
    afficher("nouveautes");
    $("nv-recherche").value = "";
    $("nv-contenu").innerHTML = `<p class="aide">Chargement des nouveautés…</p>`;
    await Promise.all([Nouveautes.charger(), CatalogueSets.charger().catch(() => {}), Catalogue.charger().catch(() => {})]);
    await this._chargerPossedes();
    if (typeof Souhaits !== "undefined") await Souhaits.charger();
    this.rendre();
  },

  async _chargerPossedes() {
    const sets = new Set(), objets = new Set();
    try { if (etat.classeur) for (const s of await lireSets(etat.classeur)) sets.add(String(s.code || "").toLowerCase()); } catch (err) { console.warn(err); }
    try { if (etat.classeur) for (const o of await lireObjets(etat.classeur)) objets.add(String(o.code || "").toUpperCase()); } catch (err) { console.warn(err); }
    this._possedes = { sets, objets };
  },

  _possede(n) {
    if (n.type === "figurine") return typeof ouFigurine === "function" && etat.collection ? ouFigurine(Nouveautes.codeAppli(n)).length : 0;
    if (n.type === "set") return this._possedes.sets.has(n.code.toLowerCase()) ? 1 : 0;
    return this._possedes.objets.has(String(n.bricklink || n.code).toUpperCase()) ? 1 : 0;
  },

  // Article de la liste de souhaits (js/souhaits.js) ?
  _souhaite(n) {
    if (typeof Souhaits === "undefined" || !Souhaits.liste.length) return false;
    if (n.type === "figurine") return Souhaits.contient("Figurine", Nouveautes.codeAppli(n)) || (n.bricklink && Souhaits.contient("Figurine", n.bricklink));
    if (n.type === "set") return Souhaits.contient("Set", n.code.replace(/-1$/, "")) || Souhaits.contient("Set", n.code);
    return Souhaits.contient("Objet", n.bricklink || n.code);
  },

  // Thème d'un article : le thème principal (« Star Wars ») ; les séries de minifigs à collectionner gardent leur
  // série ; les boutiques LEGO (BAM, cadeaux, mini-modèles du mois) sont regroupées
  _theme(n) {
    const t = n.theme || "Autres";
    if (/^Collectible Minifigures/i.test(t)) return t.replace(/^Collectible Minifigures\s*\/?\s*/i, "🎁 Minifigs à collectionner ").trim();
    if (/^LEGO Brand Store/i.test(t)) return "🏪 Boutiques LEGO (BAM…)";
    if (/^Gear/i.test(t)) { // objets dérivés : par sorte d'objet
      const sorte = t.split(" / ")[1] || "";
      return { "Key Chain": "🔑 Porte-clés", "Magnets": "🧲 Magnets", "Stationery and Office Supplies": "✏️ Papeterie",
        "Bags, Totes, & Luggage": "🎒 Sacs", "Bag and Luggage Tags": "🏷️ Étiquettes de sac", "Clothing & Footwear": "👕 Vêtements",
        "Houseware": "🏠 Maison", "Tabletop Games and Puzzles": "🧩 Jeux et puzzles", "Plush Toys": "🧸 Peluches",
        "Posters and Art Prints": "🖼️ Affiches", "Clocks and Watches": "⏰ Montres et réveils" }[sorte] || "Autres objets";
    }
    return t.split(" / ")[0];
  },

  _type() { return { figurines: "figurine", sets: "set", objets: "objet" }[this.onglet]; },

  rendre() {
    $("nv-maj").textContent = Nouveautes.date ? `à jour du ${Nouveautes.dateLisible()}` : "pas encore disponibles";
    $("nv-onglets").querySelectorAll("[data-nv]").forEach(b => b.classList.toggle("choisi", b.dataset.nv === this.onglet));
    const q = normaliser($("nv-recherche").value.trim());
    const trouve = n => !q || q.split(" ").every(m => n.recherche.includes(m) || normaliser(this._theme(n)).includes(m));
    const recent = (a, b) => (b.vu_le || "").localeCompare(a.vu_le || "") || (b.annee || "").localeCompare(a.annee || "") || a.code.localeCompare(b.code, "en", { numeric: true });

    // Par mois de sortie (Brickset) : un mois choisi, ses sorties classées par thème (sets puis figurines)
    if (this.onglet === "mois" && Nouveautes.sorties && Nouveautes.sorties.size) {
      const nomMois = m => new Date(m + "-01T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const datees = Nouveautes.liste.filter(n => n.sortie && trouve(n));
      const parMois = new Map();
      for (const n of datees) { const m = n.sortie.slice(0, 7); if (!parMois.has(m)) parMois.set(m, []); parMois.get(m).push(n); }
      const tousMois = [...parMois.keys()].sort();
      const actuel = new Date().toISOString().slice(0, 7);
      const voisins = tousMois.filter(m => m >= tousMois.find(x => x >= actuel.slice(0, 4) + "-01") || "");
      if (!parMois.has(this.mois)) this.mois = parMois.has(actuel) ? actuel : (tousMois.find(m => m > actuel) || tousMois[tousMois.length - 1] || "");
      $("nv-themes").innerHTML = voisins.map(m => `<button class="puce ${m === this.mois ? "choisi" : ""}" data-nv-mois="${m}">${m === actuel ? "📍 " : ""}${nomMois(m)} (${parMois.get(m).length})${parMois.get(m).some(n => this._souhaite(n) && !this._possede(n)) ? " ⭐" : ""}</button>`).join("");
      const liste = (parMois.get(this.mois) || []).slice();
      const ordre = { set: 0, figurine: 1, objet: 2 };
      const parTheme = new Map();
      for (const n of liste.sort((a, b) => ordre[a.type] - ordre[b.type] || a.sortie.localeCompare(b.sortie) || a.code.localeCompare(b.code, "en", { numeric: true }))) {
        const th = this._theme(n); if (!parTheme.has(th)) parTheme.set(th, []); parTheme.get(th).push(n);
      }
      const themes = [...parTheme.entries()].sort((a, b) => b[1].filter(n => n.type === "set").length - a[1].filter(n => n.type === "set").length || b[1].length - a[1].length);
      const nSets = liste.filter(n => n.type === "set").length, nFigs = liste.filter(n => n.type === "figurine").length;
      let i0 = 0; const ordreAffiche = [];
      const voulus = liste.filter(n => this._souhaite(n) && !this._possede(n));
      const bandeau = voulus.length ? `<div class="alerte info">⭐ <b>${voulus.length} article(s) de votre liste de souhaits ${this.mois === actuel ? "sort(ent) ce mois-ci" : this.mois > actuel ? `sort(ent) en ${nomMois(this.mois)}` : `est (sont) sorti(s) en ${nomMois(this.mois)}`}</b> : ${voulus.map(n => echapper(n.nom)).join(", ")}.</div>` : "";
      $("nv-contenu").innerHTML = bandeau + `<p class="aide">Sorties de ${this.mois ? nomMois(this.mois) : "?"} : ${nSets} set(s), ${nFigs} nouvelle(s) figurine(s). Dates : Brickset ; prix français : Avenue de la Brique (prix LEGO France, et meilleur prix du moment).</p>` +
        themes.map(([th, l]) => { const g = this._grille(l, i0); i0 += l.length; ordreAffiche.push(...l);
          return `<p class="sous-titre">${echapper(th)} <span class="score">${l.filter(n => n.type === "set").length} set(s), ${l.filter(n => n.type === "figurine").length} figurine(s)</span></p>${g}`; }).join("");
      return this._brancher(ordreAffiche);
    }

    if (this.onglet === "mois") {
      $("nv-themes").innerHTML = "";
      const depuis = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
      let liste = Nouveautes.liste.filter(n => n.vu_le && n.vu_le >= depuis && trouve(n)).sort(recent);
      let info = liste.length ? `${liste.length} article(s) apparu(s) ces 45 derniers jours, les plus récents d'abord.` : "";
      if (!liste.length) {
        const annee = String(new Date().getFullYear());
        liste = Nouveautes.liste.filter(n => n.annee > annee && trouve(n)).sort(recent);
        info = "Les dates d'apparition sont suivies depuis le 1er octobre 2026 : les sorties des prochaines semaines s'afficheront ici. " +
          (liste.length ? `En attendant, les ${liste.length} article(s) déjà annoncé(s) pour l'an prochain :` : "");
      }
      $("nv-contenu").innerHTML = `<p class="aide">${echapper(info)}</p>` + this._grille(liste.slice(0, 120));
      return this._brancher(liste);
    }

    const type = this._type();
    const tous = Nouveautes.liste.filter(n => n.type === type && trouve(n));
    const parTheme = new Map();
    for (const n of tous) { const t = this._theme(n); if (!parTheme.has(t)) parTheme.set(t, []); parTheme.get(t).push(n); }
    const themes = [...parTheme.entries()].sort((a, b) => (a[0].startsWith("🎁") ? -1 : 0) - (b[0].startsWith("🎁") ? -1 : 0) || b[1].length - a[1].length);
    if (this.theme && !parTheme.has(this.theme)) this.theme = "";
    $("nv-themes").innerHTML = `<button class="puce ${this.theme ? "" : "choisi"}" data-nv-theme="">Tous (${tous.length})</button>` +
      themes.map(([t, l]) => `<button class="puce ${t === this.theme ? "choisi" : ""}" data-nv-theme="${echapper(t)}">${echapper(t)} (${l.length})</button>`).join("");
    const liste = (this.theme ? parTheme.get(this.theme) : tous).slice().sort(recent);
    const n = liste.filter(x => this._possede(x)).length;
    $("nv-contenu").innerHTML = `<p class="aide">${liste.length} ${{ figurine: "figurine(s)", set: "set(s)", objet: "objet(s) dérivé(s)" }[type]}` +
      `${n ? `, dont ${n} déjà à vous ✅` : ""}. Touchez-en un pour l'ajouter à votre collection.</p>` + this._grille(liste.slice(0, 150)) +
      (liste.length > 150 ? `<p class="aide">… et ${liste.length - 150} autres : choisissez un thème ou filtrez.</p>` : "");
    this._brancher(liste);
  },

  _grille(liste, depart = 0) {
    return `<div class="grille">${liste.map((n, k) => { const i = depart + k;
      const s = n.type === "set" && CatalogueSets.sets ? CatalogueSets.sets.get(n.code.toLowerCase()) : null;
      const detail = n.type === "set" ? [n.code, s && s.pieces && `${s.pieces} pièces`, s && s.nbFigurines && `👤 ${s.nbFigurines}`].filter(Boolean).join(" · ")
        : n.type === "figurine" ? (n.bricklink || n.code) : (n.bricklink || n.code);
      return `<button class="proposition" data-nv-i="${i}">
        ${n.image ? `<img src="${echapper(n.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<div class="sans-photo">Pas de photo</div>`}
        <span class="nom-court">${this._possede(n) ? "✅ " : this._souhaite(n) ? "⭐ " : ""}${echapper(n.nom)}</span>
        <span class="code">${echapper(detail)}</span>
        <span class="score">${echapper(this.onglet === "mois" ? { figurine: "Figurine", set: "Set", objet: "Objet" }[n.type] : this._theme(n))}${
          n.sortie ? ` · sortie le ${new Date(n.sortie + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
          : n.vu_le ? ` · vu le ${new Date(n.vu_le).toLocaleDateString("fr-FR")}` : ` · ${echapper(n.annee)}`}${n.prix ? ` · LEGO ${(+n.prix).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}` : ""}${
          n.meilleur && (!n.prix || +n.meilleur < +n.prix) ? ` · dès ${(+n.meilleur).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}` : ""}</span>
      </button>`;
    }).join("")}</div>`;
  },

  _brancher(liste) {
    $("nv-contenu").querySelectorAll("[data-nv-i]").forEach(b => b.addEventListener("click", () => this.ouvrirArticle(liste[+b.dataset.nvI])));
  },

  // Article touché : figurine -> écran de résultat (ajout) ; set -> écran Ajouter un set ; objet -> écran Objet dérivé
  async ouvrirArticle(n) {
    if (n.type === "figurine") {
      etat.photos = [];
      etat.candidats = [Nouveautes.candidat(n)];
      etat.origine = "recherche";
      choisirCandidat(0);
    } else if (n.type === "set") {
      await EcranSet.ouvrir();
      const s = CatalogueSets.trouver(n.code);
      if (s) { $("set-numero").value = s.code; EcranSet.choisir(s, CatalogueSets.versions(s.code)); }
      else { $("set-numero").value = n.code; EcranSet.chercher(); }
    } else {
      await EcranObjet.ouvrir();
      await CatalogueObjets.charger();
      const o = CatalogueObjets.liste.find(x => x.code === n.code) ||
        { code: n.code, bricklink: n.bricklink, reference: (n.bricklink || "").replace(/^LGL-/, ""), nom: n.nom, theme: n.theme, annee: n.annee, image: n.image };
      EcranObjet.choisir(o);
    }
  },

  async actualiser(bouton) {
    bouton.disabled = true; bouton.textContent = "Actualisation…";
    await Nouveautes.actualiser();
    bouton.disabled = false; bouton.textContent = "🔄 Actualiser";
    toast(Nouveautes.date ? `Nouveautés à jour du ${Nouveautes.dateLisible()} ✔` : "Nouveautés indisponibles (réseau ?)");
    this.rendre();
  },
};

if ($("ecran-nouveautes")) {
  let minuteur;
  $("nv-recherche").addEventListener("input", () => { clearTimeout(minuteur); minuteur = setTimeout(() => EcranNouveautes.rendre(), 250); });
  $("nv-onglets").addEventListener("click", e => {
    const b = e.target.closest("[data-nv]");
    if (b) { EcranNouveautes.onglet = b.dataset.nv; EcranNouveautes.theme = ""; EcranNouveautes.rendre(); }
  });
  $("nv-themes").addEventListener("click", e => {
    const m = e.target.closest("[data-nv-mois]");
    if (m) { EcranNouveautes.mois = m.dataset.nvMois; EcranNouveautes.rendre(); return; }
    const b = e.target.closest("[data-nv-theme]");
    if (b) { EcranNouveautes.theme = b.dataset.nvTheme; EcranNouveautes.rendre(); window.scrollTo(0, $("nv-contenu").offsetTop - 80); }
  });
  $("nv-actualiser").addEventListener("click", e => EcranNouveautes.actualiser(e.currentTarget));
}
