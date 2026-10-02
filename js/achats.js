// Mes achats de customs (onglet « Customs achetées ») : prix payé de chaque exemplaire, pour la revente.
// - « À nommer » : achats en lot de vente en direct Whatnot (« Custom JB (lot du …) ») dont on ne connaît que le prix ;
//   on leur donne le nom de la figurine (catalogue JB, nom déjà connu ou photo du blister), du plus cher au moins cher.
// - « Par figurine » : exemplaires regroupés par figurine, prix payé de chacun et prix de revente conseillé
//   (couvre les frais de vente et la marge voulue, réglables).

const REGLAGES_REVENTE = { frais: 11, fixe: 0.3, marge: 20 }; // Whatnot : commission + paiement (à vérifier), marge voulue

const EcranAchats = {
  achats: [],
  ebay: [],                 // prix demandés sur eBay.de (prix_ebay.tsv du dépôt privé, outils/prix_ebay_jb.py)
  propositions: new Map(), // n° de commande Whatnot -> { figurine, code, confiance, photos } (propositions_lots.tsv du dépôt privé)
  vue: "nommer",
  ouvert: null,   // ligne en cours de nommage
  choix: null,    // figurine du catalogue JB choisie { nom, code }

  reglages() {
    try { return { ...REGLAGES_REVENTE, ...JSON.parse(localStorage.getItem("revente") || "{}") }; }
    catch (e) { return { ...REGLAGES_REVENTE }; }
  },

  async ouvrir() {
    if (!etat.classeur) { await demander("Ouvrez d'abord votre collection.", "OK", "Fermer"); return; }
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
      const [rep, eb] = await Promise.all(["propositions_lots.tsv", "prix_ebay.tsv"].map(f =>
        Valeur._api(`/contents/${f}`, { headers: { Accept: "application/vnd.github.raw" } }).catch(() => null)));
      if (rep && rep.ok) {
        this.propositions = new Map();
        for (const l of (await rep.text()).split("\n").slice(1)) {
          const [vente, figurine, code, photos, commande, , , confiance] = l.split("\t");
          if (commande && figurine) this.propositions.set(commande, { vente, figurine, code, photos, confiance: (confiance || "").split(" (")[0] });
        }
      }
      if (eb && eb.ok) this.ebay = (await eb.text()).split("\n").slice(1).map(l => l.split("\t"))
        .filter(c => +c[1] > 0).map(([nom, n, min, med, max, port, date]) => ({ nom, n: +n, min: +min, med: +med, max: +max, port: port === "" ? null : +port, date, mots: motsCustom(nom) }));
    } catch (err) { console.warn(err); }
  },


  // Prix eBay.de du nom le plus précis dont tous les mots sont dans le nom de la figurine
  ebayPour(nom) {
    // mots du nom + nombres (« 25 Years » ≠ « 26 years ») ; il faut presque tout le nom, pas seulement une partie
    const mots = t => new Set([...motsCustom(t), ...(normaliser(t).match(/\b\d{2,4}\b/g) || [])]);
    const m = mots(nom);
    let best = null, sc = 0;
    for (const e of this.ebay) {
      e.tous = e.tous || mots(e.nom);
      if (!e.tous.size || ![...e.tous].every(x => m.has(x))) continue;
      const r = e.tous.size / m.size;
      if (r >= 0.75 && r > sc) { sc = r; best = e; }
    }
    return best;
  },

  proposition(a) {
    const m = /(\d{6,})/.exec(a.justificatif || "");
    return m ? this.propositions.get(m[1]) : null;
  },

  // ---------- À vendre : pour chaque blister en plusieurs exemplaires, on garde le n° le plus bas (et ceux qui ont une
  // note : signé, Comic Con…) ; les autres sont à vendre, au plus haut entre le prix de revente conseillé et le prix
  // demandé sur eBay.de, sans dépasser le prix JB si la figurine y est encore vendue ----------
  async _exemplaires() {
    const recense = ((await Memoire.lire("base")) || []).filter(e => e.nom);
    if (recense.length) return { source: "recensement", liste: recense.map(e => ({ nom: nomComplet(e), numero: e.numero || "", serie: e.serie || "", code: e.code || "", note: e.remarque || "",
      groupe: e.precision ? cleFigurine(e.nom, e.precision) : "" })) };
    const liste = [];
    const onglet = etat.collection && etat.collection[THEME_CUSTOMS.onglet];
    for (const c of (onglet ? onglet.cases : [])) {
      if (!c.code) continue;
      const m = /^(.*?)\s+(\d{1,4})\s*\/\s*(\d{1,4})\s*$/.exec(c.nom || "");
      liste.push({ nom: m ? m[1] : c.nom || c.code, numero: m ? m[2] : "", serie: m ? m[3] : "", code: /^(JB|ALB|BSC|EBAY)-/i.test(c.code) ? c.code : "", note: "" });
    }
    return { source: "collection", liste };
  },

  async _listerVente() {
    const { source, liste: tous } = await this._exemplaires();
    // exemplaires notés « vendu » dans l'onglet « À vendre » : plus dans la collection
    const vendus = new Set((await lireAVendre(etat.classeur).catch(() => [])).filter(x => /vendu/i.test(x.statut))
      .map(x => `${normaliser(nomCustomPourFichier(x.nom))}|${x.numero}`));
    const liste = tous.filter(e => !(e.numero && vendus.has(`${normaliser(nomCustomPourFichier(e.nom))}|${e.numero}`)));
    const groupes = new Map();
    for (const e of liste) {
      const k = e.groupe || (e.code ? e.code.toUpperCase() : normaliser(nomCustomPourFichier(e.nom)));
      if (!groupes.has(k)) groupes.set(k, { nom: e.nom, code: e.code, ex: [] });
      groupes.get(k).ex.push(e);
    }
    const achetes = this.achats.filter(a => !this.estLot(a));
    const paye = nom => { // prix payés des achats nommés qui correspondent à ce nom
      const m = motsCustom(nom);
      return achetes.filter(a => { const x = motsCustom(a.nom); return m.size && x.size && [...m].every(w => x.has(w)) && m.size / x.size >= 0.6; }).map(a => a.prix);
    };
    const med = l => { const t = [...l].sort((a, b) => a - b); return t.length ? t[Math.floor(t.length / 2)] : 0; };
    const numeroDe = e => parseInt(e.numero, 10);
    const lignes = [];
    for (const g of groupes.values()) {
      if (g.ex.length < 2) continue;
      g.ex.sort((a, b) => (isNaN(numeroDe(a)) - isNaN(numeroDe(b))) || numeroDe(a) - numeroDe(b));
      const garde = [g.ex[0], ...g.ex.slice(1).filter(e => e.note)];
      const vendre = g.ex.filter(e => !garde.includes(e));
      if (!vendre.length) continue;
      const jb = (g.code && CatalogueJB.parCode && CatalogueJB.parCode.get(g.code.toUpperCase())) || null;
      const cout = med(paye(g.nom));
      const eb = this.ebayPour(g.nom) || (jb && this.ebayPour(jb.nom));
      const conseille = cout ? this._revente(cout) : 0;
      let prix = Math.max(conseille, eb ? Math.round(eb.med) : 0);
      const enVente = jb && jb.source === "jb" && !jb.epuisee && jb.prix;
      const plafond = enVente && prix > jb.prix;
      if (plafond) prix = Math.floor(jb.prix);
      if (!prix && enVente) prix = Math.floor(jb.prix); // pas d'autre repère : le prix JB
      lignes.push({ g, garde, vendre, jb, cout, eb, conseille, prix, plafond, enVente });
    }
    lignes.sort((a, b) => b.prix * b.vendre.length - a.prix * a.vendre.length);
    this._vente = lignes;
    const nb = lignes.reduce((n, l) => n + l.vendre.length, 0);
    const total = lignes.reduce((n, l) => n + l.prix * l.vendre.length, 0);
    const coutTotal = lignes.reduce((n, l) => n + l.cout * l.vendre.length, 0);
    const sansPrix = lignes.filter(l => !l.prix).length;
    const num = e => e.numero ? `n° ${e.numero}${e.serie ? `/${e.serie}` : ""}` : "sans n°";
    $("achats-liste").innerHTML = `<p class="aide">D'après ${source === "recensement" ? "vos blisters (écran « Base de blisters »)"
        : "l'onglet « Customs » de votre fichier (photographiez vos blisters dans « Base de blisters » pour une liste exacte, avec leurs numéros)"}. Pour chaque figurine en
        plusieurs exemplaires, le n° le plus bas est gardé, ainsi que les exemplaires qui ont une note (signé, Comic Con…).</p>
      <div class="carte valeur-total"><div class="score">${nb} exemplaire${nb > 1 ? "s" : ""} à vendre (${lignes.length} figurines)</div>
        <div class="montant">${this._prix(total)}</div>
        <div class="ligne-valeur"><span>Prix payé de ces exemplaires</span><b>${this._prix(coutTotal)}</b></div>
        ${sansPrix ? `<div class="score">${sansPrix} figurine(s) sans prix connu (ni achat retrouvé, ni annonce eBay)</div>` : ""}
        <button class="bouton vert" data-action="achats-vendre-maj">🔄 Mettre à jour la liste « À vendre »</button>
        <p class="score">${this._majVente ? `Dernière mise à jour : ${echapper(this._majVente)}` : "Cette liste se recalcule à chaque ouverture, d'après votre base de blisters ; « Mettre à jour » l'enregistre dans l'onglet « À vendre » (le statut « vendu » et le prix de vente réel que vous y notez sont gardés)."}</p>
        <button class="bouton gris" data-action="achats-vendre-csv">📊 Liste pour mes annonces (.csv)</button></div>` +
      (lignes.length ? lignes.map(l => `<div class="carte achat-figurine">
        <p class="sous-titre">${echapper(l.g.nom)} <span class="badge">×${l.g.ex.length}</span></p>
        <div class="ligne-valeur"><span>🏠 Garder</span><span>${echapper(l.garde.map(e => num(e) + (e.note ? ` (${e.note})` : "")).join(", "))}</span></div>
        <div class="ligne-valeur"><span>🏷️ À vendre</span><span>${echapper(l.vendre.map(num).join(", "))}</span></div>
        <div class="ligne-valeur"><span>Prix proposé</span><span><b>${l.prix ? this._prix(l.prix) : "?"}</b>${l.vendre.length > 1 && l.prix ? ` × ${l.vendre.length} = <b>${this._prix(l.prix * l.vendre.length)}</b>` : ""}</span></div>
        <p class="score">${[l.cout && `payé ~${this._prix(l.cout)} → revente conseillée ${this._prix(l.conseille)}`,
          l.eb && `eBay.de ${this._prix(l.eb.med)} (${l.eb.n} annonce${l.eb.n > 1 ? "s" : ""})`,
          l.enVente && `encore vendue chez JB ${this._prix(l.jb.prix)}${l.plafond ? " : prix ramené au prix JB" : ""}`,
          l.jb && l.jb.epuisee && "épuisée chez JB"].filter(Boolean).join(" · ") || "aucun prix connu : fixez-le vous-même"}</p>
      </div>`).join("") : `<p class="aide">Aucune figurine en plusieurs exemplaires pour l'instant.</p>`);
  },

  async majVente() {
    const lignes = [];
    for (const x of this._vente || []) for (const e of x.vendre)
      lignes.push({ nom: x.g.nom, numero: e.numero, serie: e.serie, prix: x.prix || "", paye: x.cout || "", ebay: x.eb ? x.eb.med : "", code: x.g.code || "" });
    try {
      const r = await ecrireAVendre(etat.classeur, lignes);
      etat.nonEnregistres++;
      await memoriser();
      this._majVente = new Date().toLocaleString("fr-FR");
      await demander(`Onglet « ${ONGLET_A_VENDRE} » mis à jour : ${lignes.length} exemplaire(s) à vendre` +
        (r.vendus ? `, ${r.vendus} déjà vendu(s) gardé(s)` : "") + ".\n\nDans Excel, notez « vendu » dans la colonne Statut et le prix obtenu : ils seront gardés à la prochaine mise à jour.\n\nPensez à enregistrer le fichier.", "OK", "Fermer");
      this._listerVente();
    } catch (err) { console.error(err); await demander("La mise à jour a échoué : " + err.message, "OK", "Fermer"); }
  },

  exporterVente() {
    const l = this._vente || [];
    const lignes = [["Figurine", "N° exemplaire", "Série", "Prix proposé (€)", "Prix payé (€)", "Prix eBay.de (€)", "Garder"].join(";")];
    for (const x of l) for (const e of x.vendre)
      lignes.push([x.g.nom, e.numero, e.serie, x.prix || "", x.cout ? x.cout.toFixed(2) : "", x.eb ? x.eb.med.toFixed(2) : "",
                   x.garde.map(g => g.numero || "sans n°").join(" ")].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";").replace(/\./g, ","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + lignes.join("\r\n")], { type: "text/csv" }));
    a.download = `a_vendre_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  },

  estLot: a => /^Custom JB \(lot/.test(a.nom),

  async lister() {
    this.achats = await lireCustomsAchetees(etat.classeur);
    const lots = this.achats.filter(this.estLot);
    $("achats-onglet-nommer").textContent = `À nommer (${lots.length})`;
    $("achats-onglet-nommer").classList.toggle("actif", this.vue === "nommer");
    $("achats-onglet-figurines").classList.toggle("actif", this.vue === "figurines");
    $("achats-onglet-vendre").classList.toggle("actif", this.vue === "vendre");
    if (this.vue === "vendre") { $("achats-filtre").hidden = true; return this._listerVente(); }
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
          ${jb && jb.prix && jb.source === "jb" ? `<p class="score">${jb.epuisee ? `Épuisée chez JB (était à ${this._prix(jb.prix)})` : `Encore en vente chez JB : ${this._prix(jb.prix)}`}</p>` : ""}
          ${(e => e ? `<p class="score">eBay.de (prix demandés) : <b>${this._prix(e.med)}</b> au milieu, de ${this._prix(e.min)} à ${this._prix(e.max)}` +
            ` · ${e.n} annonce${e.n > 1 ? "s" : ""}${e.port ? ` + port ~${this._prix(e.port)}` : ""} · <a href="https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent("JB Spielwaren " + e.nom)}" target="_blank" rel="noopener">voir</a></p>` : "")(this.ebayPour(g.nom))}
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
  else if (a === "achats-vendre") { EcranAchats.vue = "vendre"; EcranAchats.ouvert = null; EcranAchats.lister(); }
  else if (a === "achats-vendre-csv") EcranAchats.exporterVente();
  else if (a === "achats-vendre-maj") EcranAchats.majVente();
});
