// Mes achats de customs (onglet « Customs achetées ») : prix payé de chaque exemplaire, pour la revente.
// - « À nommer » : achats en lot de vente en direct Whatnot (« Custom JB (lot du …) ») dont on ne connaît que le prix ;
//   on leur donne le nom de la figurine (catalogue JB, nom déjà connu ou photo du blister), du plus cher au moins cher.
// - « Par figurine » : exemplaires regroupés par figurine, prix payé de chacun et prix de revente conseillé
//   (couvre les frais de vente et la marge voulue, réglables).

const REGLAGES_REVENTE = { frais: 11, fixe: 0.3, marge: 20 }; // Whatnot : commission + paiement (à vérifier), marge voulue

const EcranAchats = {
  achats: [],
  propositions: new Map(), // n° de commande Whatnot -> { figurine, code, confiance, photos } (propositions_lots.tsv du dépôt privé)
  vue: "nommer",
  ouvert: null,   // ligne en cours de nommage
  choix: null,    // figurine du catalogue JB choisie { nom, code }

  reglages() {
    try { return { ...REGLAGES_REVENTE, ...JSON.parse(localStorage.getItem("revente") || "{}") }; }
    catch (e) { return { ...REGLAGES_REVENTE }; }
  },

  async ouvrir() {
    if (!etat.classeur) { await demander("Ouvrez d'abord votre fichier Excel.", "OK", "Fermer"); return; }
    const r = this.reglages();
    $("achats-frais").value = r.frais; $("achats-fixe").value = r.fixe; $("achats-marge").value = r.marge;
    afficher("achats");
    CatalogueJB.charger().catch(() => {});
    await this._chargerPropositions();
    await this.lister();
  },

  // Propositions de noms pour les achats en lot, retrouvées d'après les photos et captures des ventes en direct
  async _chargerPropositions() {
    try {
      Valeur.jeton = Valeur.jeton || await Memoire.lire("jeton-github");
      if (!Valeur.jeton) return;
      const rep = await Valeur._api("/contents/propositions_lots.tsv", { headers: { Accept: "application/vnd.github.raw" } });
      if (!rep.ok) return;
      this.propositions = new Map();
      for (const l of (await rep.text()).split("\n").slice(1)) {
        const [vente, figurine, code, photos, commande, , , confiance] = l.split("\t");
        if (commande && figurine) this.propositions.set(commande, { vente, figurine, code, photos, confiance: (confiance || "").split(" (")[0] });
      }
    } catch (err) { console.warn(err); }
  },

  proposition(a) {
    const m = /(\d{6,})/.exec(a.justificatif || "");
    return m ? this.propositions.get(m[1]) : null;
  },

  estLot: a => /^Custom JB \(lot/.test(a.nom),

  async lister() {
    this.achats = await lireCustomsAchetees(etat.classeur);
    const lots = this.achats.filter(this.estLot);
    $("achats-onglet-nommer").textContent = `À nommer (${lots.length})`;
    $("achats-onglet-nommer").classList.toggle("actif", this.vue === "nommer");
    $("achats-onglet-figurines").classList.toggle("actif", this.vue === "figurines");
    $("achats-filtre").hidden = this.vue !== "figurines";
    if (!this.achats.length) {
      $("achats-liste").innerHTML = `<p class="aide">L'onglet « ${ONGLET_CUSTOMS_ACHETEES} » est vide : dans l'écran Valeur, touchez
        « 📥 Ajouter mes customs achetées ».</p>`;
      return;
    }
    if (this.vue === "nommer") this._listerLots(lots); else this._listerFigurines();
  },

  _prix: v => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }),

  _listerLots(lots) {
    lots.sort((a, b) => !!this.proposition(b) - !!this.proposition(a) || b.prix - a.prix || a.row - b.row);
    $("achats-liste").innerHTML = lots.length ? `<p class="aide">Du plus cher au moins cher. Retrouvez la commande dans l'appli Whatnot
      (Profil › Achats, à la date indiquée), puis touchez la ligne pour donner le nom de la figurine.</p>` +
      lots.map(a => `<div class="achat" data-achat="${a.row}">
        <div class="ligne-valeur"><span>${echapper(a.date)} · <span class="score">${echapper(a.justificatif)}</span>${this.proposition(a) ? `<br>💡 ${echapper(this.proposition(a).figurine)} <span class="score">(${echapper(this.proposition(a).confiance)})</span>` : ""}</span><b>${this._prix(a.prix)}</b></div>
        ${this.ouvert === a.row ? this._editeur() : ""}</div>`).join("")
      : `<p class="aide">Tous vos achats ont un nom ✔</p>`;
    $("achats-liste").querySelectorAll("[data-achat] > .ligne-valeur").forEach(l => l.addEventListener("click", () => {
      const row = +l.parentElement.dataset.achat;
      this.ouvert = this.ouvert === row ? null : row; this.choix = null;
      this._listerLots(this.achats.filter(this.estLot));
      if (this.ouvert) $("achat-nom").focus();
    }));
    if (this.ouvert) {
      this._brancherEditeur();
      const a = this.achats.find(x => x.row === this.ouvert), p = a && this.proposition(a);
      if (p) {
        this._afficherSuggestions([{ nom: p.figurine.replace(/\s*\(.*\)\s*$/, "").toUpperCase(), code: p.code && /^JB-/.test(p.code) ? p.code : "" }]);
        $("achat-etat").textContent = `💡 Proposition d'après vos captures de la vente du ${p.vente} (${p.confiance}, photos ${p.photos}) : touchez-la pour la choisir.`;
      }
    }
  },

  _editeur() {
    return `<div class="achat-editeur">
      <input id="achat-nom" class="champ" autocomplete="off" placeholder="Nom de la figurine (ex. SHINY DARK LORD)">
      <div id="achat-suggestions" class="suggestions"></div>
      <label class="bouton gris">📷 Lire le nom sur le blister
        <input type="file" id="input-achat-photo" accept="image/*" capture="environment" hidden></label>
      <p class="aide" id="achat-etat"></p>
      <button class="gros-bouton vert" data-action="achat-valider">✔ Enregistrer ce nom</button>
    </div>`;
  },

  _brancherEditeur() {
    const champ = $("achat-nom");
    champ.addEventListener("input", () => { this.choix = null; this._suggerer(champ.value); });
    $("input-achat-photo").addEventListener("change", async e => {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      $("achat-etat").textContent = "Lecture du nom…";
      try {
        await CatalogueJB.charger();
        const lu = await Blister.lireEntier(f, (i, n) => { if (i > 1) $("achat-etat").textContent = `Lecture du nom… (essai ${i} sur ${n})`; });
        const connues = lu.trouve ? CatalogueJB.rapprocher(lu.texte).slice(0, 4) : [];
        if (connues.length) { this._afficherSuggestions(connues.map(f => ({ nom: nomCustomPourFichier(f.nom), code: f.code, prix: f.prix }))); $("achat-etat").textContent = "Choisissez la bonne figurine :"; }
        else { champ.value = (nomProbable(lu.texte) || "").toUpperCase(); $("achat-etat").textContent = "Vérifiez le nom lu (corrigez-le si besoin)."; }
      } catch (err) { console.error(err); $("achat-etat").textContent = "Le nom n'a pas pu être lu : tapez-le."; }
    });
  },

  _suggerer(texte) {
    if (normaliser(texte).length < 2) { $("achat-suggestions").innerHTML = ""; return; }
    const q = normaliser(texte);
    const connus = [...new Map(this.achats.filter(a => !this.estLot(a) && normaliser(a.nom).includes(q))
      .map(a => [normaliser(a.nom), { nom: a.nom, code: a.code }])).values()].slice(0, 4);
    const jb = CatalogueJB.chercher(texte, 6).map(f => ({ nom: nomCustomPourFichier(f.nom), code: f.code, prix: f.prix }));
    this._afficherSuggestions([...connus, ...jb.filter(j => !connus.some(c => normaliser(c.nom) === normaliser(j.nom)))]);
  },

  _afficherSuggestions(liste) {
    $("achat-suggestions").innerHTML = liste.map((s, i) => `<button class="petit" data-sugg="${i}">${echapper(s.nom)}${s.prix ? ` · ${this._prix(s.prix)} chez JB` : ""}</button>`).join("");
    $("achat-suggestions").querySelectorAll("[data-sugg]").forEach(b => b.addEventListener("click", () => {
      this.choix = liste[+b.dataset.sugg];
      $("achat-nom").value = this.choix.nom;
      $("achat-suggestions").innerHTML = "";
    }));
  },

  async valider() {
    const nom = $("achat-nom").value.trim().toUpperCase();
    if (!nom) { toast("Tapez ou choisissez le nom de la figurine."); return; }
    const a = this.achats.find(x => x.row === this.ouvert);
    if (!a) return;
    const code = this.choix && normaliser(this.choix.nom) === normaliser(nom) ? (this.choix.code || "") : "";
    const cl = etat.classeur, o = ONGLET_CUSTOMS_ACHETEES;
    await cl.ecrireTexte(o, "A" + a.row, nom);
    if (code || a.code) await cl.ecrireTexte(o, "F" + a.row, code);
    await cl.ecrireTexte(o, "G" + a.row, /nom à compléter/.test(a.remarques) ? "nommée depuis l'appli (achat en vente en direct)" : a.remarques);
    etat.nonEnregistres++;
    await memoriser();
    toast(`${nom} : ${this._prix(a.prix)} ✔ (pensez à enregistrer)`);
    this.ouvert = null; this.choix = null;
    await this.lister();
  },

  // Prix de vente pour retrouver le prix payé + la marge, une fois les frais de vente retirés
  _revente(cout) {
    const r = this.reglages();
    return Math.ceil((cout * (1 + r.marge / 100) + r.fixe) / (1 - r.frais / 100));
  },

  _listerFigurines() {
    const groupes = new Map();
    for (const a of this.achats) {
      if (this.estLot(a)) continue;
      const cle = a.code ? a.code.toUpperCase() : normaliser(nomCustomPourFichier(a.nom));
      const g = groupes.get(cle) || { nom: a.nom, code: a.code, ex: [] };
      g.ex.push(a); groupes.set(cle, g);
    }
    const doublons = $("achats-doublons").checked;
    const liste = [...groupes.values()].filter(g => !doublons || g.ex.length > 1)
      .sort((a, b) => b.ex.length - a.ex.length || a.nom.localeCompare(b.nom));
    const nbLots = this.achats.filter(this.estLot).length;
    $("achats-liste").innerHTML = (nbLots ? `<p class="aide">${nbLots} achats en lot ne sont pas encore nommés (onglet « À nommer ») :
      ils n'apparaissent pas ici.</p>` : "") + (liste.length ? liste.map(g => {
        const jb = g.code && CatalogueJB.parCode && CatalogueJB.parCode.get(g.code.toUpperCase());
        const total = g.ex.reduce((n, a) => n + a.prix, 0);
        return `<div class="carte achat-figurine">
          <p class="sous-titre">${echapper(g.nom)}${g.ex.length > 1 ? ` <span class="badge">×${g.ex.length}</span>` : ""}</p>
          ${jb && jb.prix && jb.source === "jb" ? `<p class="score">Encore en vente chez JB : ${this._prix(jb.prix)}</p>` : ""}
          ${g.ex.sort((a, b) => a.prix - b.prix).map(a => `<div class="ligne-valeur"><span>${echapper(a.date)} · <span class="score">${echapper(a.vendeur)}</span></span>
            <span>payé <b>${this._prix(a.prix)}</b> → revendre <b>${this._prix(this._revente(a.prix))}</b></span></div>`).join("")}
          ${g.ex.length > 1 ? `<p class="score">Total payé ${this._prix(total)} · prix moyen ${this._prix(total / g.ex.length)}</p>` : ""}
        </div>`;
      }).join("") : `<p class="aide">Aucune figurine ${doublons ? "en plusieurs exemplaires " : ""}pour l'instant.</p>`);
  },

  async regler() {
    const lire = (id, def) => { const v = parseFloat(String($(id).value).replace(",", ".")); return isFinite(v) && v >= 0 ? v : def; };
    const r = { frais: Math.min(90, lire("achats-frais", REGLAGES_REVENTE.frais)), fixe: lire("achats-fixe", REGLAGES_REVENTE.fixe), marge: lire("achats-marge", REGLAGES_REVENTE.marge) };
    try { localStorage.setItem("revente", JSON.stringify(r)); } catch (e) { /* réglage non gardé */ }
    if (this.vue === "figurines") this._listerFigurines();
  },
};

for (const id of ["achats-frais", "achats-fixe", "achats-marge"]) if ($(id)) $(id).addEventListener("change", () => EcranAchats.regler());
if ($("achats-doublons")) $("achats-doublons").addEventListener("change", () => EcranAchats.lister());

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "achats") EcranAchats.ouvrir();
  else if (a === "achats-nommer") { EcranAchats.vue = "nommer"; EcranAchats.lister(); }
  else if (a === "achats-figurines") { EcranAchats.vue = "figurines"; EcranAchats.ouvert = null; EcranAchats.lister(); }
  else if (a === "achat-valider") EcranAchats.valider();
});
