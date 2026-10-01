// Liste de souhaits : figurines officielles, customs (JB…), sets et objets dérivés que l'on veut. Rangée dans l'onglet
// « Souhaits » du fichier Excel (js/xlsx.js : lireSouhaits, ajouterSouhait, retirerSouhait). Bouton « ⭐ Ajouter à ma
// liste de souhaits » sur les fiches (figurine, custom, set, objet, catalogue JB) ; écran « ⭐ Ma liste de souhaits »
// avec la date de sortie connue (nouveautés), ✅ quand l'article est maintenant dans la collection, et un toucher pour
// l'ajouter. L'écran Nouveautés signale les souhaits qui sortent dans le mois (js/ecran_nouveautes.js).

const Souhaits = {
  liste: [],

  async charger() {
    try { this.liste = etat.classeur ? await lireSouhaits(etat.classeur) : []; } catch (err) { console.warn(err); this.liste = []; }
    return this.liste;
  },

  _cle(type, code, nom) { return `${type}|${String(code || nom || "").toUpperCase()}`; },
  contient(type, code, nom) { return this.liste.some(s => this._cle(s.type, s.code, s.nom) === this._cle(type, code, nom)); },

  async ajouter({ type, code, nom, theme, sortie }) {
    if (!etat.classeur) { await demander("Ouvrez d'abord votre fichier Excel : la liste de souhaits y est rangée (onglet « Souhaits »).", "OK", "Fermer"); return; }
    await this.charger();
    if (this.contient(type, code, nom)) { toast(`« ${nom || code} » est déjà dans votre liste de souhaits ⭐`); return; }
    try {
      await ajouterSouhait(etat.classeur, { type, code, nom, theme, sortie: sortie || this.sortie({ type, code }) });
      etat.nonEnregistres++;
      await memoriser();
      await this.charger();
      toast(`⭐ « ${nom || code} » ajouté à votre liste de souhaits (pensez à « Enregistrer »)`, 4500);
    } catch (err) {
      console.error(err);
      await demander("L'ajout à la liste de souhaits a échoué : " + err.message, "OK", "Fermer");
    }
  },

  // Date de sortie connue (nouveautés : Brickset pour les sets, premier set pour une figurine)
  sortie(s) {
    if (typeof Nouveautes === "undefined") return "";
    const c = String(s.code || "").toLowerCase();
    if (s.type === "Set") { const x = Nouveautes.sorties && Nouveautes.sorties.get(c.includes("-") ? c : c + "-1"); return (x && x.sortie) || ""; }
    const n = Nouveautes.liste.find(n => (s.type === "Figurine" ? Nouveautes.codeAppli(n).toLowerCase() : String(n.bricklink || "").toLowerCase()) === c);
    return (n && n.sortie) || "";
  },

  // Déjà dans la collection ? (figurine : onglets de figurines ; custom : onglet Customs, même figurine du catalogue JB ;
  // set : onglet Sets ; objet : onglet Objets dérivés)
  async _possedes() {
    const sets = new Set(), objets = new Set(), customs = new Set();
    try { for (const s of await lireSets(etat.classeur)) sets.add(String(s.code).toLowerCase().replace(/-1$/, "")); } catch (err) { /* pas d'onglet */ }
    try { for (const o of await lireObjets(etat.classeur)) objets.add(String(o.code).toUpperCase()); } catch (err) { /* pas d'onglet */ }
    try {
      await CatalogueJB.charger();
      const o = etat.collection && etat.collection[THEME_CUSTOMS.onglet];
      for (const c of (o ? o.cases : []).filter(c => c.code)) {
        customs.add(c.code.toUpperCase());
        const f = Collection._jbDe(c); if (f) CatalogueJB.codes(f).forEach(k => customs.add(k));
      }
    } catch (err) { console.warn(err); }
    return s => s.type === "Figurine" ? ouFigurine(s.code).length > 0
      : s.type === "Set" ? sets.has(String(s.code).toLowerCase().replace(/-1$/, ""))
      : s.type === "Objet" ? objets.has(String(s.code).toUpperCase())
      : (() => { const f = CatalogueJB.trouver(s.code); return customs.has(String(s.code).toUpperCase()) || (f && CatalogueJB.codes(f).some(k => customs.has(k))); })();
  },

  _image(s) {
    if (s.type === "Figurine") return imageHtml({ id: s.code });
    if (s.type === "Set") return `<img src="${echapper(((typeof Nouveautes !== "undefined" && Nouveautes.liste.find(n => n.type === "set" && n.code.toLowerCase() === (/-\d+$/.test(s.code) ? s.code : s.code + "-1").toLowerCase())) || {}).image || urlImageSet(/-\d+$/.test(s.code) ? s.code : s.code + "-1"))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
    if (s.type === "Custom") {
      const f = CatalogueJB.trouver(s.code);
      return f && f.image ? `<img src="${echapper(f.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
        : `<img data-ma-photo="${echapper(s.code)}" alt="">`;
    }
    const o = typeof CatalogueObjets !== "undefined" && CatalogueObjets.liste.find(x => x.bricklink.toUpperCase() === String(s.code).toUpperCase());
    return o && o.image ? `<img src="${echapper(o.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<div class="sans-photo">🔑</div>`;
  },

  async ouvrir() {
    afficher("souhaits");
    $("sh-contenu").innerHTML = `<p class="aide">Chargement…</p>`;
    if (!etat.classeur) { $("sh-contenu").innerHTML = `<p class="aide">Ouvrez d'abord votre fichier Excel.</p>`; return; }
    await Promise.all([this.charger(), Nouveautes.charger(), CatalogueJB.charger().catch(() => {}),
                       typeof CatalogueObjets !== "undefined" ? CatalogueObjets.charger() : null]);
    this.rendre();
  },

  async rendre() {
    const possede = await this._possedes();
    const mois = new Date().toISOString().slice(0, 7);
    const liste = this.liste.map(s => ({ ...s, sortie: s.sortie || this.sortie(s), deja: possede(s) }));
    const ceMois = liste.filter(s => s.sortie && s.sortie.startsWith(mois)).length;
    const aVenir = liste.filter(s => s.sortie && s.sortie.slice(0, 7) > mois).length;
    $("sh-info").textContent = liste.length
      ? `${liste.length} souhait(s)` + (ceMois ? ` · ⭐ ${ceMois} sort(ent) ce mois-ci` : "") + (aVenir ? ` · ${aVenir} à venir` : "") +
        (liste.some(s => s.deja) ? ` · ✅ ${liste.filter(s => s.deja).length} déjà dans votre collection` : "")
      : "Votre liste est vide. Sur la fiche d'une figurine, d'une custom, d'un set ou d'un objet, touchez « ⭐ Ajouter à ma liste de souhaits ».";
    const ordre = { Figurine: 0, Custom: 1, Set: 2, Objet: 3 }, titres = { Figurine: "🧍 Figurines", Custom: "🎨 Customs", Set: "🧱 Sets", Objet: "🔑 Objets dérivés" };
    const groupes = Object.keys(ordre).map(t => [t, liste.filter(s => (ordre[s.type] != null ? s.type : "Objet") === t)
      .sort((a, b) => (b.deja ? -1 : 0) - (a.deja ? -1 : 0) || (a.sortie || "9999").localeCompare(b.sortie || "9999") || (a.nom || "").localeCompare(b.nom || ""))]).filter(([, l]) => l.length);
    this._affiches = [];
    $("sh-contenu").innerHTML = groupes.map(([t, l]) => `<p class="sous-titre">${titres[t]} (${l.length})</p><div class="grille">${l.map(s => {
      const i = this._affiches.push(s) - 1;
      const sortie = s.sortie ? (s.sortie.startsWith(mois) ? "⭐ sort ce mois-ci" : s.sortie.slice(0, 7) > mois ? `sortie le ${new Date(s.sortie + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}` : "") : "";
      return `<button class="proposition" data-sh="${i}">${this._image(s)}
        <span class="nom-court">${s.deja ? "✅ " : ""}${echapper(s.nom || s.code)}</span>
        <span class="code">${echapper(s.code)}</span>
        <span class="score">${echapper([s.deja ? "dans votre collection" : sortie, s.theme].filter(Boolean).join(" · "))}</span></button>`;
    }).join("")}</div>`).join("");
    if (typeof Consulter !== "undefined") Consulter.completerPhotos($("sh-contenu"));
  },

  // Souhait touché : l'ajouter à la collection (écran d'ajout prérempli), ou le retirer de la liste
  async toucher(s) {
    const i = await choisirAction(`${s.nom || s.code}\n${s.code} · ${s.type}${s.deja ? "\n✅ Déjà dans votre collection" : ""}`,
      [s.deja ? "🗑️ Retirer de ma liste (je l'ai)" : "➕ Je l'ai : ajouter à ma collection", ...(s.deja ? [] : ["🗑️ Retirer de ma liste"])]);
    if (i < 0) return;
    const action = s.deja || i === 1 ? "retirer" : "ajouter";
    if (action === "retirer") {
      try {
        await retirerSouhait(etat.classeur, s.row);
        etat.nonEnregistres++;
        await memoriser();
        await this.charger();
        toast(`« ${s.nom || s.code} » retiré de votre liste de souhaits (pensez à « Enregistrer »)`);
      } catch (err) { await demander("Le retrait a échoué : " + err.message, "OK", "Fermer"); }
      return this.rendre();
    }
    if (s.type === "Figurine") {
      etat.photos = []; etat.origine = "recherche";
      const f = Catalogue.trouver(s.code);
      etat.candidats = [{ id: s.code.toUpperCase(), nom: f ? f.nom : s.nom, image: "", score: null, categorie: f ? f.categorie : s.theme, lien: urlBricklink(s.code) }];
      choisirCandidat(0);
    } else if (s.type === "Custom") {
      ouvrirCustom("Custom de votre liste de souhaits : tapez son numéro.");
      const f = CatalogueJB.trouver(s.code);
      if (f) choisirJB(f); else { $("custom-nom").value = s.nom || ""; majCustom(); }
    } else if (s.type === "Set") {
      await EcranSet.ouvrir();
      await Nouveautes.charger();
      $("set-numero").value = s.code; EcranSet.chercher();
    } else {
      await EcranObjet.ouvrir();
      await CatalogueObjets.charger();
      const o = CatalogueObjets.liste.find(x => x.bricklink.toUpperCase() === String(s.code).toUpperCase());
      if (o) EcranObjet.choisir(o); else { $("objet-nom").value = s.nom || ""; $("objet-code").value = s.code; }
    }
  },

  // Bouton « ⭐ Ajouter à ma liste de souhaits » à poser sur une fiche
  bouton(type, code, nom, theme) {
    return `<button class="bouton gris" data-souhait='${echapper(JSON.stringify({ type, code, nom, theme }))}'>⭐ Ajouter à ma liste de souhaits</button>`;
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-souhait]");
  if (b) { e.preventDefault(); Souhaits.ajouter(JSON.parse(b.dataset.souhait)); return; }
  const c = e.target.closest("[data-sh]");
  if (c && Souhaits._affiches) Souhaits.toucher(Souhaits._affiches[+c.dataset.sh]);
  const a = e.target.closest("[data-action='souhaits']");
  if (a) Souhaits.ouvrir();
});
