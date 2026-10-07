// « Ma collection » de la mini-appli (contribuer.html) : les blisters de l'ami regroupés par figurine, présentés comme
// « Ma collection » de l'appli principale (Liste ou Vignettes, ×N, n° triés), sans onglets de thèmes. Toucher une
// figurine : ses photos et les mêmes options (changer les photos, ajouter, retirer, corriger un n°, renommer).
// Les blisters restent ceux de « Ma base de blisters » (Base.entrees) : rien n'est copié.
const MesBlisters = {
  vue: "vignettes",
  _urls: [],

  installer() {
    $("ami-onglets").addEventListener("click", e => { const b = e.target.closest("[data-ecran-ami]"); if (b) this.ecran(b.dataset.ecranAmi); });
    $("ami-bascule").addEventListener("click", e => { const b = e.target.closest("[data-vue]"); if (b) { this.vue = b.dataset.vue; this.rendre(); } });
    let minuteur;
    $("ami-recherche").addEventListener("input", () => { clearTimeout(minuteur); minuteur = setTimeout(() => this.rendre(), 200); });
    // loupe (ou Entrée) du clavier : résultats tout de suite, clavier refermé
    $("ami-recherche").addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault(); clearTimeout(minuteur); this.rendre(); e.target.blur();
    });
    $("ami-contenu").addEventListener("click", e => {
      const f = e.target.closest("[data-groupe]");
      if (f) this.ouvrir(f.dataset.groupe);
    });
  },

  // Écran montré : « base » (photographier) ou « collection »
  ecran(nom) {
    $("ecran-base").hidden = nom !== "base";
    $("ecran-ami-collection").hidden = nom !== "collection";
    $("ami-onglets").querySelectorAll("[data-ecran-ami]").forEach(b => b.classList.toggle("choisi", b.dataset.ecranAmi === nom));
    if (nom === "collection") this.rendre();
    else Base._afficherListe();
    window.scrollTo(0, 0);
  },

  // Blisters regroupés par figurine (même nom imprimé et même précision), exemplaires dans l'ordre de leur n°
  _groupes() {
    const groupes = new Map();
    for (const e of Base.entrees) {
      if (!e.photo || !e.nom) continue;
      const k = cleFigurine(e.nom, e.precision);
      if (!groupes.has(k)) groupes.set(k, { cle: k, nom: nomComplet(e), blisters: [] });
      groupes.get(k).blisters.push(e);
    }
    const n = e => parseInt(e.numero, 10);
    for (const g of groupes.values()) g.blisters.sort((a, b) => (isNaN(n(a)) ? Infinity : n(a)) - (isNaN(n(b)) ? Infinity : n(b)));
    return [...groupes.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  },
  _num(e) { return e.numero ? e.numero + (e.serie ? "/" + e.serie : "") : ""; },
  _nums(g) { return g.blisters.map(e => this._num(e)).filter(Boolean); },
  _photo(g) {
    const e = g.blisters.find(x => !Base.aRefaire(x)) || g.blisters[0];
    const u = URL.createObjectURL(e.photo);
    this._urls.push(u);
    return `<img class="photo" src="${u}" alt="">`;
  },
  _ligne(g) {
    const nums = this._nums(g);
    return echapper(nums.length ? `n° ${nums.join(", ")}` : g.blisters.some(e => e.numerote === false) ? "non numérotée" : "sans n°");
  },
  _alerte(g) {
    const n = g.blisters.filter(e => Base.aRefaire(e)).length;
    return n ? `<div class="recense-ecart">📏 ${n > 1 ? `${n} photos à refaire (de loin ou mal cadrées)` : "Photo à refaire (de loin ou mal cadrée)"}</div>` : "";
  },

  rendre() {
    this._urls.forEach(u => URL.revokeObjectURL(u));
    this._urls = [];
    const tous = this._groupes(), texte = $("ami-recherche").value.trim();
    const mots = normaliser(texte).split(" ").filter(Boolean);
    const groupes = mots.length ? tous.filter(g => mots.every(m => normaliser(`${g.nom} ${this._nums(g).join(" ")}`).includes(m))) : tous;
    $("ami-bascule").querySelectorAll("[data-vue]").forEach(b => b.classList.toggle("choisi", b.dataset.vue === this.vue));
    const blisters = tous.reduce((s, g) => s + g.blisters.length, 0);
    const aRefaire = Base.entrees.filter(e => Base.aRefaire(e)).length, attente = Base.entrees.filter(e => !e.exporte).length;
    $("ami-resume").innerHTML = blisters
      ? `<b>${tous.length} figurine${tous.length > 1 ? "s" : ""} différente${tous.length > 1 ? "s" : ""}, ${blisters} blister${blisters > 1 ? "s" : ""}</b>` +
        (aRefaire ? ` · <span class="recense-ecart">📏 ${aRefaire} à refaire</span>` : " · photos bien cadrées ✔") +
        (attente ? ` · ${attente} pas encore envoyé${attente > 1 ? "s" : ""}` : " · tout est envoyé ✔")
      : "Aucun blister pour l'instant : photographiez-en un depuis « 📷 Photographier ».";
    $("ami-info").textContent = mots.length ? (groupes.length ? `${groupes.length} résultat(s).` : "Aucun blister ne correspond.")
      : blisters ? "Touchez une figurine pour voir ses photos, changer une photo, ajouter ou retirer un exemplaire, corriger un numéro ou la renommer." : "";
    $("ami-contenu").innerHTML = this.vue === "liste"
      ? groupes.map(g => `
        <div class="fiche cliquable" data-groupe="${echapper(g.cle)}">
          ${this._photo(g)}
          <div class="infos">
            <div class="nom-court">${echapper(g.nom)}${g.blisters.length > 1 ? ` <span class="badge">×${g.blisters.length}</span>` : ""}</div>
            <div class="code">${this._ligne(g)}</div>
            ${g.blisters.some(e => e.possede === false) ? `<div class="lieu">pas à moi (base commune seulement)</div>` : ""}
            ${this._alerte(g)}
          </div>
        </div>`).join("")
      : `<div class="vignettes">${groupes.map(g => `
        <div class="vignette cliquable" data-groupe="${echapper(g.cle)}">
          ${this._photo(g)}
          <div class="nom-court">${echapper(g.nom)}${g.blisters.length > 1 ? ` <span class="badge">×${g.blisters.length}</span>` : ""}</div>
          <div class="code">${this._ligne(g)}</div>
          ${this._alerte(g)}
        </div>`).join("")}</div>`;
  },

  // Fiche d'une figurine : ses photos (une seule fois pour les exemplaires pris avec la même photo, tous les n°
  // dessous), puis les options
  ouvrir(cle) {
    const g = this._groupes().find(x => x.cle === cle);
    if (!g) return;
    const memes = new Map();
    for (const e of g.blisters) {
      const k = `${e.photo.size}|${e.verso ? e.verso.size : 0}`;
      if (!memes.has(k)) memes.set(k, []);
      memes.get(k).push(e);
    }
    const images = [];
    for (const l of memes.values()) {
      const nums = l.map(e => this._num(e)).filter(Boolean);
      const qui = [nums.length ? `n° ${nums.join(", ")}` : "", l.length === 1 && l[0].remarque, Base.aRefaire(l[0]) && "📏 à refaire"].filter(Boolean).join(" · ");
      images.push({ src: URL.createObjectURL(l[0].photo), legende: `Recto${qui ? " · " + qui : ""}` });
      if (l[0].verso) images.push({ src: URL.createObjectURL(l[0].verso), legende: `Verso${qui ? " · " + qui : ""}` });
    }
    const nums = this._nums(g), n = g.blisters.length;
    const titre = `${g.nom} · ${n > 1 ? `${n} exemplaires` : "1 exemplaire"}${nums.length ? ` (n° ${nums.join(", ")})` : ""}`;
    Visionneuse.ouvrir(titre, images, "", "", [
      { texte: "📷 Changer les photos (recto, verso), recadrer, n°, note", faire: () => this.changer(g) },
      { texte: "➕ Ajouter un exemplaire (nouveau n°)", faire: () => { this.ecran("base"); Base.exemplaireDe(g.blisters[0].id); } },
      { texte: n > 1 ? "➖ Retirer un exemplaire" : "➖ Retirer de ma collection", faire: () => this.retirer(g) },
      { texte: nums.length ? "✏️ Corriger un numéro" : "✏️ Indiquer le numéro", faire: () => this.corrigerNumero(g) },
      { texte: "🔤 Renommer" + (n > 1 ? ` (les ${n} exemplaires)` : ""), faire: () => this.renommer(g) },
    ]);
  },

  // Exemplaire concerné : le seul, ou celui choisi (par son n°)
  async _exemplaire(question, g) {
    if (g.blisters.length === 1) return g.blisters[0];
    const i = await this.choisir(question, g.blisters.map(e => this._num(e) ? `n° ${this._num(e)}` : `sans n°${e.remarque ? " · " + e.remarque : ""}`));
    return i >= 0 ? g.blisters[i] : null;
  },

  // Fiche ✏️ du blister dans « Ma base de blisters » (photos recto et verso, recadrage, n°, note)
  async changer(g) {
    const e = await this._exemplaire("Quel exemplaire ?", g);
    if (!e) return;
    const ids = new Set(g.blisters.map(x => x.id));
    this.ecran("base");
    Base.filtrerSur(g.nom, x => ids.has(x.id));
    Base.vue = "photos";
    Base._afficherListe();
    Base.modifier(e.id);
    const carte = $("base-liste").querySelector(`[data-fiche="${e.id}"]`);
    if (carte) carte.scrollIntoView({ block: "start" });
  },

  async retirer(g) {
    const e = await this._exemplaire("Quel exemplaire retirer ?", g);
    if (!e) return;
    if (!(await demander(`Retirer « ${nomComplet(e)} »${this._num(e) ? ` n° ${this._num(e)}` : ""} de votre collection ?\n\nSes photos sont effacées du téléphone.`, "Retirer", "Annuler"))) return;
    Base.entrees = Base.entrees.filter(x => x !== e);
    await Memoire.ecrire(Base.entrees, "base");
    toast("Exemplaire retiré ✔");
    this.rendre();
  },

  async corrigerNumero(g) {
    const e = await this._exemplaire("Quel exemplaire corriger ?", g);
    if (!e) return;
    const serie = e.serie || (g.blisters.find(x => x.serie) || {}).serie || "";
    const saisi = await this.demanderTexte(`Numéro de cet exemplaire${serie ? `, série limitée à ${serie}` : ""} :`, this._num(e) || (serie ? "/" + serie : ""), true);
    if (saisi == null) return;
    const m = /^(\d{1,4})\s*(?:\/\s*(\d{1,4}))?$/.exec(saisi.trim());
    if (!m) { await demander(`« ${saisi} » : tapez un numéro, par exemple 52 ou 52/150.`, "OK", "Fermer"); return; }
    const numero = String(+m[1]), nouvelleSerie = m[2] || serie;
    if (numero === e.numero && nouvelleSerie === (e.serie || "")) return;
    if (g.blisters.some(x => x !== e && x.numero === numero)) { await demander(`Le n° ${numero} est déjà enregistré pour cette figurine.`, "OK", "Fermer"); return; }
    Object.assign(e, { numero, serie: nouvelleSerie, numerote: true, exporte: false });
    await Memoire.ecrire(Base.entrees, "base");
    toast(`N° ${numero}${nouvelleSerie ? "/" + nouvelleSerie : ""} ✔`);
    this.rendre();
  },

  async renommer(g) {
    const e0 = g.blisters[0];
    const saisi = await this.demanderTexte(`Nouveau nom imprimé${g.blisters.length > 1 ? ` (pour les ${g.blisters.length} exemplaires)` : ""} :`, e0.nom);
    if (saisi == null) return;
    const nom = saisi.trim().replace(/\s+/g, " ").toUpperCase();
    if (!nom || nom === e0.nom) return;
    const autre = normaliser(nom) !== normaliser(e0.nom);
    // autre figurine : le code reconnu ne vaut plus (comme « ✏️ Modifier »)
    for (const e of g.blisters) Object.assign(e, { nom, exporte: false }, autre ? { code: "" } : {});
    await Memoire.ecrire(Base.entrees, "base");
    toast(`Renommé « ${nom} » ✔`);
    this.rendre();
  },

  // Petites fenêtres : un choix dans une liste, ou un texte à taper (null si annulé)
  choisir(titre, options) {
    return new Promise(ok => {
      const d = this._fenetre();
      d.innerHTML = `<p class="sous-titre">${echapper(titre)}</p>
        <div class="visionneuse-actions">${options.map((o, i) => `<button class="bouton bleu" data-i="${i}">${echapper(o)}</button>`).join("")}
        <button class="bouton gris" data-i="-1">Annuler</button></div>`;
      d.onclick = ev => { const b = ev.target.closest("[data-i]"); if (b) { d.close(); ok(+b.dataset.i); } };
      d.oncancel = () => ok(-1);
      d.showModal();
    });
  },
  demanderTexte(titre, valeur = "", chiffres = false) {
    return new Promise(ok => {
      const d = this._fenetre();
      d.innerHTML = `<p class="sous-titre">${echapper(titre)}</p>
        <input class="champ" id="ami-texte" autocomplete="off" ${chiffres ? 'inputmode="numeric"' : 'autocapitalize="characters"'} value="${echapper(valeur)}">
        <div class="dialogue-boutons"><button class="bouton gris" data-r="non">Annuler</button><button class="bouton vert" data-r="oui">OK</button></div>`;
      const champ = d.querySelector("#ami-texte");
      const fin = r => { d.close(); ok(r ? champ.value : null); };
      d.onclick = ev => { const b = ev.target.closest("[data-r]"); if (b) fin(b.dataset.r === "oui"); };
      champ.onkeydown = ev => { if (ev.key === "Enter") { ev.preventDefault(); fin(true); } };
      d.oncancel = () => ok(null);
      d.showModal();
      champ.focus(); champ.select();
    });
  },
  _fenetre() {
    let d = $("ami-fenetre");
    if (!d) { d = document.createElement("dialog"); d.id = "ami-fenetre"; d.className = "dialogue"; document.body.appendChild(d); }
    return d;
  },
};
