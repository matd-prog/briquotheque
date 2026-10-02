// Valeur de la collection : prix des ventes BrickLink des 6 derniers mois, relevés dans le dépôt GitHub
// PRIVÉ de l'utilisateur (matd-prog/briquotheque-prive : codes.txt -> action « Prix BrickLink » -> prix.tsv).
// L'appli y dépose la liste des codes (figurines et sets du fichier Excel, codes seulement), lance le relevé
// et lit les prix, avec un jeton d'accès GitHub limité à ce dépôt, gardé uniquement dans le téléphone.

const DEPOT_PRIVE = "matd-prog/briquotheque-prive";

// Reste d'un set monté (briques, boîte, notice) quand ses figurines valent presque autant que le set, ou plus :
// jamais moins de cette part du prix LEGO d'origine
// (0,3 jusqu'au 30/09/2026 ; test sur 57 sets : vendus sans figurines sur eBay.de à 62 % du prix LEGO en médiane)
const PART_RESTE_SET = 0.5;
// part retenue du prix demandé sur eBay.de pour un set sans figurines (prix demandé -> prix de vente réel)
const PART_EBAY_SANS_FIGS = 0.85;

// Mots significatifs d'un nom de figurine custom (sans « custom minifigure », accents, ponctuation)
function motsCustom(t) {
  return new Set(normaliser(t).replace(/\b(custom|minifig\w*|figurine?|figur|jb|spielwaren|mit|with|the|der|die|das|and|und|exklusive?|neu|new|stream\w*|edition)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ").split(" ").filter(m => m.length > 2));
}

// « Les plus précieux », par catégorie
const GROUPES_VALEUR = [
  ["🧍 Figurines les plus précieuses", d => d.type === "MINIFIG"],
  ["🧱 Sets les plus précieux", d => d.type === "SET"],
  ["🔑 Porte-clés et objets dérivés", d => d.type === "GEAR"],
  ["🎨 Figurines customs (JB…)", d => d.type === "CUSTOM"],
  ["📦 Boîtes seules", d => d.type === "BOX"],
];

const Valeur = {
  jeton: null,

  async _api(chemin, options = {}) {
    const rep = await fetch(`https://api.github.com/repos/${DEPOT_PRIVE}${chemin}`, {
      cache: "no-store", // prix mis à jour pendant le relevé : jamais de copie gardée par le navigateur
      ...options,
      headers: { Authorization: `Bearer ${this.jeton}`, Accept: "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", ...(options.headers || {}) },
    });
    if (!rep.ok && rep.status !== 404) throw new Error(`GitHub a répondu ${rep.status}` + (rep.status === 401 ? " (jeton refusé ou expiré)" : ""));
    return rep;
  },

  async ouvrir() {
    this.jeton = await Memoire.lire("jeton-github");
    afficher("valeur");
    $("valeur-jeton-bloc").hidden = !!this.jeton;
    $("valeur-actions").hidden = !this.jeton;
    $("valeur-resultat").innerHTML = "";
    $("valeur-etat").textContent = this.jeton ? "" : "Collez une fois votre jeton d'accès GitHub (github_pat_…) : il reste dans ce téléphone.";
    if (this.jeton) { this.afficher(); this.suivre(); }
  },

  async enregistrerJeton() {
    const j = $("valeur-jeton").value.trim();
    if (!/^(github_pat_|ghp_)\w+$/.test(j)) { await demander("Ce n'est pas un jeton GitHub (il commence par github_pat_).", "OK", "Fermer"); return; }
    this.jeton = j;
    try {
      const rep = await this._api("");
      if (!rep.ok) throw new Error("dépôt introuvable avec ce jeton");
    } catch (err) {
      this.jeton = null;
      await demander("Le jeton ne marche pas : " + err.message, "OK", "Fermer");
      return;
    }
    await Memoire.ecrire(j, "jeton-github");
    $("valeur-jeton").value = "";
    toast("Jeton enregistré dans le téléphone ✔");
    this.ouvrir();
  },

  async oublierJeton() {
    if (!(await demander("Retirer le jeton GitHub de ce téléphone ?"))) return;
    await Memoire.ecrire(null, "jeton-github");
    this.ouvrir();
  },

  // Articles de la collection ayant un code BrickLink : [{ type, code, nom, onglet, etat }]
  async _articles() {
    const res = [];
    for (const [onglet, o] of Object.entries(etat.collection || {}))
      for (const c of o.cases)
        // figurine custom (code JB-, CUS-…, ou rangée dans l'onglet Customs, même sans code) : pas sur BrickLink
        if ((c.code && /^(JB|CUS|BSC|EBAY)-/i.test(c.code))
            || (onglet === THEME_CUSTOMS.onglet && (c.code || c.nom) && !/^[a-z]{2,7}\d{2,4}[a-z]?$/i.test(c.code || "")))
          res.push({ type: "CUSTOM", code: (c.code || "").toUpperCase(), nom: c.nom, onglet, etat: "" });
        else if (c.code) {
          // dans les onglets de figurines : aussi des sets (30612-1, packs) et des porte-clés ou objets (850353)
          const type = /^\d{4,7}-\d+$/.test(c.code) ? "SET" : /^\d{5,8}$/.test(c.code) ? "GEAR" : "MINIFIG";
          if (type === "MINIFIG" && codeInvalide(c.code)) continue;
          res.push({ type, code: c.code.toLowerCase(), nom: c.nom, onglet, etat: "" });
        }
    try { await CatalogueSets.charger(); } catch (e) { /* sans catalogue : sets comptés comme sets entiers */ }
    // Pas de doublon : une figurine rangée dans les onglets de figurines n'est pas comptée une 2e fois dans un set
    // (elle est retirée du prix du set) ni comme figurine de série de l'onglet Sets. Chaque exemplaire ne sert qu'une fois.
    const dispo = new Map();
    for (const a of res) if (a.type === "MINIFIG") dispo.set(a.code, (dispo.get(a.code) || 0) + 1);
    const prendre = code => { const n = dispo.get(code) || 0; if (n) dispo.set(code, n - 1); return n > 0; };
    for (const s of await lireSets(etat.classeur)) {
      const code = /-\d+$/.test(s.code) ? s.code : s.code + "-1";
      const cat = CatalogueSets.sets && CatalogueSets.sets.get(code.toLowerCase());
      const figs = ((CatalogueSets.figurines && CatalogueSets.figurines.get(code.toLowerCase())) || []).filter(f => f.bricklink);
      const a = { type: "SET", code, nom: s.nom, onglet: "Sets", etat: s.etat, quantite: s.quantite || 1 };
      if (/boîte seule|boite seule/i.test(s.etat)) a.type = "BOX"; // boîte vide : prix des boîtes d'origine vendues
      else if (cat && /^Collectible Minifigures/.test(cat.theme) && figs.length === 1) { // figurine de série : prix de la figurine
        Object.assign(a, { type: "MINIFIG", code: figs[0].bricklink.toLowerCase() });
        if (prendre(a.code)) continue; // déjà dans un onglet de figurines
      } else if (!/scell/i.test(s.etat)) {
        // set monté : ses figurines sont estimées une à une (prix du marché), le reste du set (briques, boîte, notice) à part ;
        // une figurine déjà dans les onglets de figurines y est comptée, pas une 2e fois ici (chaque exemplaire ne sert qu'une fois)
        a.sansFigs = /sans fig/i.test(s.etat);
        a.figs = figs.map(f => {
          const code = f.bricklink.toLowerCase(), q = (f.quantite || 1) * a.quantite;
          let ailleurs = 0;
          if (!a.sansFigs) for (let i = 0; i < q; i++) if (prendre(code)) ailleurs++;
          return { code, quantite: f.quantite || 1, ailleurs };
        });
        a.figsAilleurs = a.figs.reduce((n, f) => n + f.ailleurs, 0);
      }
      res.push(a);
    }
    for (const c of await lireCustomsAchetees(etat.classeur)) // prix payé connu (reçu, historique Whatnot)
      res.push({ type: "CUSTOM", code: (c.code || "").toUpperCase(), nom: c.nom, onglet: ONGLET_CUSTOMS_ACHETEES, etat: "",
                 achat: c.prix > 0 ? { prix: c.prix, vendeur: c.vendeur, date: c.date, lot: /^Custom JB \(lot/.test(c.nom) } : null });
    for (const o of await lireObjets(etat.classeur))
      res.push({ type: "GEAR", code: o.code, nom: o.nom || o.type, onglet: ONGLET_OBJETS, etat: o.etat, quantite: o.quantite });
    return res;
  },

  // Dépose codes.txt (codes seulement) puis lance le relevé des prix
  async envoyer() {
    if (!etat.classeur) { await demander("Ouvrez d'abord votre collection.", "OK", "Fermer"); return; }
    const articles = await this._articles();
    const codes = [...new Set(articles.filter(a => a.type !== "CUSTOM")
      .flatMap(a => [`${a.type} ${a.code}`, ...(a.figs || []).map(f => `MINIFIG ${f.code}`)]))].sort();
    // garde-fou : une liste vide (ou beaucoup plus courte que la précédente) effacerait les prix déjà relevés
    const ouvert = etat.classeur.estBase ? "la collection rangée dans l'appli" : "le fichier Excel ouvert";
    if (!codes.length) {
      await demander(`Aucune figurine, aucun set ni objet n'a été trouvé dans ${ouvert} (en dehors des customs) : la liste n'est pas envoyée, ` +
        "pour ne pas effacer les prix déjà relevés. Vérifiez que c'est bien votre collection qui est ouverte (en haut de l'écran : 📗 = fichier Excel).", "OK", "Fermer");
      return;
    }
    try {
      const avant = await this._api("/contents/codes.txt", { headers: { Accept: "application/vnd.github.raw" } });
      const nAvant = avant.ok ? (await avant.text()).split("\n").filter(l => l && !l.startsWith("#")).length : 0;
      if (nAvant > 20 && codes.length < nAvant / 2 && !(await demander(`La liste envoyée la dernière fois comptait ${nAvant} articles ; celle de ${ouvert} n'en compte que ${codes.length}. ` +
          "Envoyer quand même ? Les articles absents n'auront plus de prix.", "Envoyer quand même", "Annuler"))) { $("valeur-etat").textContent = ""; return; }
    } catch (err) { console.warn(err); }
    $("valeur-etat").textContent = `Envoi de la liste (${codes.length} articles)…`;
    try {
      // nombre d'articles à relever (pas encore de prix, ou prix trop ancien) : pour estimer l'avancement
      const recent = async (fichier, jours, cle) => {
        const r = await this._api(`/contents/${fichier}`, { headers: { Accept: "application/vnd.github.raw" } });
        const vus = new Set();
        if (r.ok) {
          const [entete, ...lignes] = (await r.text()).split("\n").map(l => l.split("\t"));
          for (const c of lignes) { // ligne à l'ancien format : sera relevée à nouveau
            const date = c[c.length - 1];
            if (c.length === entete.length && date && (Date.now() - new Date(date)) / 864e5 < jours) vus.add(cle(c));
          }
        }
        return vus;
      };
      const prixRecents = await recent("prix.tsv", 25, c => `${c[0]} ${(c[1] || "").toLowerCase()}`);
      const legoRecents = await recent("lego.tsv", 7, c => (c[0] || "").toLowerCase());
      const aRelever = { n: codes.filter(c => !prixRecents.has(c.replace(/ (.*)$/, (m, x) => " " + x.toLowerCase()))).length,
                         nLego: codes.filter(c => c.startsWith("SET ") && !legoRecents.has(c.slice(4).toLowerCase())).length,
                         depuis: Date.now() };
      await Memoire.ecrire(aRelever, "releve");
      const actuel = await this._api("/contents/codes.txt");
      const sha = actuel.ok ? (await actuel.json()).sha : undefined;
      const texte = `# Collection (envoyée par l'appli le ${new Date().toLocaleDateString("fr-FR")}) : codes seulement\n${codes.join("\n")}\n`;
      const contenu = btoa(unescape(encodeURIComponent(texte)));
      const rep = await this._api("/contents/codes.txt", { method: "PUT",
        body: JSON.stringify({ message: `Liste de la collection (${codes.length} articles)`, content: contenu, sha }) });
      if (!rep.ok) throw new Error("envoi refusé");
      const lance = await this._api("/actions/workflows/prix.yml/dispatches", { method: "POST", body: JSON.stringify({ ref: "main" }) });
      if (lance.status !== 204) throw new Error("relevé des prix non lancé");
      $("valeur-etat").textContent = `Liste envoyée (${codes.length} articles, dont ${aRelever.n} à relever) : relevé des prix lancé.` +
        " La valeur se mettra à jour toute seule à la fin (BrickLink limite à 2 250 articles par jour : une très grande collection se relève sur plusieurs jours).";
      this.suivre();
    } catch (err) {
      console.error(err);
      $("valeur-etat").textContent = "Échec : " + err.message;
    }
  },

  // Relevé en direct (toutes les 5 s, valeur provisoire toutes les 10 s) : étape en cours de l'action GitHub « Prix BrickLink »
  // et total provisoire de la collection.
  // À la fin, la valeur est relue toute seule.
  async suivre() {
    clearTimeout(this._minuteur);
    if (ecranActuel !== "valeur" || !this.jeton) return;
    const zone = $("valeur-avancement");
    try {
      const releve = (await Memoire.lire("releve")) || { n: 0, nLego: 0, depuis: 0 };
      const runs = await (await this._api("/actions/workflows/prix.yml/runs?per_page=1")).json();
      const run = runs.workflow_runs && runs.workflow_runs[0];
      const cacher = () => { zone.hidden = true; zone.innerHTML = ""; };
      if (!run || new Date(run.created_at) < releve.depuis - 60000) { cacher(); return; }
      if (run.status === "completed") {
        cacher();
        if (this._suivi) { this._suivi = false; this._bandeau(); toast(run.conclusion === "success" ? "Relevé des prix terminé ✔" : "Le relevé des prix s'est arrêté en erreur."); this.afficher(); }
        return;
      }
      this._suivi = true;
      let texte = "En attente d'un ordinateur GitHub…";
      const jobs = run.status === "queued" ? null : await (await this._api(`/actions/runs/${run.id}/jobs`)).json();
      const etapes = (jobs && jobs.jobs && jobs.jobs[0] && jobs.jobs[0].steps) || [];
      const etape = nom => etapes.find(e => e.name.startsWith(nom));
      const bl = etape("Relevé des prix"), lego = etape("Prix LEGO"), fin = etape("Enregistrement");
      if (fin && fin.status !== "queued") texte = "Enregistrement des prix…";
      else if (lego && lego.status === "in_progress") texte = "Prix LEGO France des sets (Avenue de la Brique) et dates (Brickset)…";
      else if (bl && bl.status === "in_progress") texte = `Prix BrickLink (${releve.n} articles à relever)…`;
      else if (run.status === "in_progress") texte = "Démarrage du relevé…";
      // valeur provisoire : prix enregistrés par le relevé toutes les 10 s, relus à chaque passage (5 s)
      if (this._runSuivi !== run.id) { this._runSuivi = run.id; this._valeurDepart = null; this._valeurLue = 0; this._cible = null; }
      if (Date.now() - this._valeurLue > 4000) {
        this._valeurLue = Date.now();
        // prix provisoires seulement pendant le relevé BrickLink (avant : ceux d'un relevé précédent)
        const c = await this.calculer(!!(bl && bl.status !== "queued")).catch(() => null);
        if (c) {
          // valeur de chaque ligne ; ce qui a changé depuis la lecture précédente est « rejoué » article par article
          const valeurs = new Map();
          c.details.forEach(d => { const k = `${d.type} ${d.code} ${d.onglet}`; valeurs.set(k, (valeurs.get(k) || 0) + d.v); });
          if (this._valeurDepart == null) {
            this._valeurDepart = this._cible = this._affichee = c.total; this._file = [];
          } else {
            const noms = new Map(c.details.map(d => [`${d.type} ${d.code} ${d.onglet}`, d]));
            for (const [k, v] of valeurs) {
              const delta = v - (this._valeurs.get(k) || 0);
              if (Math.abs(delta) >= 0.01) this._file.push({ delta, nom: noms.get(k).nom || "", code: noms.get(k).code });
            }
            for (const [k, v] of this._valeurs) if (!valeurs.has(k)) this._file.push({ delta: -v, nom: "", code: k.split(" ")[1] });
            // écart d'arrondi éventuel : dernier pas
            const reste = c.total - this._cible - this._file.reduce((n, f) => n + f.delta, 0);
            if (Math.abs(reste) >= 0.01) this._file.push({ delta: reste, nom: "", code: "" });
          }
          this._valeurs = valeurs; this._nbEstimes = c.details.length;
        }
      }
      this._texteReleve = texte;
      this._bandeau();
      this._compteur(texte);
    } catch (err) { console.warn(err); }
    this._minuteur = setTimeout(() => this.suivre(), 5000);
  },

  // Total de la collection en direct : la valeur provisoire défile en continu vers la dernière valeur lue (animation),
  // avec la hausse depuis le début du relevé et le dernier article relevé.
  _compteur(texte) {
    const zone = $("valeur-avancement");
    zone.hidden = false;
    if (!$("compteur-valeur")) {
      zone.innerHTML = `<p class="sous-titre">⏳ Relevé des prix en cours</p>
        <div class="compteur-valeur" id="compteur-valeur">…</div>
        <div class="compteur-hausse" id="compteur-hausse"></div>
        <div class="compteur-article" id="compteur-article"></div>
        <p class="score" id="compteur-texte"></p>`;
      this._animer();
    }
    $("compteur-texte").textContent = `${texte}${this._nbEstimes ? ` · ${this._nbEstimes} articles estimés` : ""}`;
  },

  // Valeur affichée : les articles relevés depuis la lecture précédente sont ajoutés un par un (répartis sur ~5 s),
  // avec leur nom ; le chiffre file vers chaque nouvelle valeur
  _animer() {
    let avant = performance.now(), prochain = 0;
    const pas = t => {
      if (!$("compteur-valeur") || $("valeur-avancement").hidden) return;
      const dt = (t - avant) / 1000; avant = t;
      if (this._file && this._file.length && t >= prochain) {
        const a = this._file.shift();
        this._cible += a.delta;
        if (a.code && a.delta > 0) {
          const euros = v => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
          $("compteur-article").textContent = `+ ${euros(a.delta)} · ${a.nom ? a.nom + " " : ""}${a.code}`;
          $("compteur-article").classList.remove("eclat"); void $("compteur-article").offsetWidth; $("compteur-article").classList.add("eclat");
        }
        prochain = t + Math.max(120, Math.min(1500, 5000 / (this._file.length + 1)));
      }
      if (this._cible != null) {
        const ecart = this._cible - this._affichee;
        this._affichee += Math.abs(ecart) < 0.01 ? ecart : ecart * Math.min(1, dt * 6);
        const euros = v => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
        $("compteur-valeur").textContent = euros(this._affichee);
        const hausse = this._affichee - this._valeurDepart;
        $("compteur-hausse").textContent = `${hausse >= 0 ? "+" : ""}${euros(hausse)} depuis le début du relevé`;
      }
      requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  },

  // Ajoute au fichier Excel l'onglet « Customs achetées » : figurines relevées dans les reçus JB et l'historique Whatnot
  // (customs_achetees.tsv du dépôt privé), une ligne par exemplaire ; les lignes déjà présentes (même justificatif) sont ignorées
  async ajouterCustoms() {
    if (!etat.classeur) { await demander("Ouvrez d'abord votre collection.", "OK", "Fermer"); return; }
    const rep = await this._api("/contents/customs_achetees.tsv", { headers: { Accept: "application/vnd.github.raw" } });
    if (!rep.ok) { await demander("La liste des customs achetées n'est pas encore prête dans votre dépôt privé.", "OK", "Fermer"); return; }
    const toutes = (await rep.text()).split("\n").slice(1).filter(Boolean).map(l => {
      const [date, vendeur, nom, prix, justificatif, lot] = l.split("\t");
      return { date: date.split("-").reverse().join("/"), vendeur, nom, prix: parseFloat(prix) || 0, justificatif, remarques: lot ? "figurine dévoilée en vente en direct : nom à compléter" : "" };
    });
    const deja = new Set((await lireCustomsAchetees(etat.classeur)).map(c => c.justificatif));
    const nouvelles = toutes.filter(c => !deja.has(c.justificatif));
    const lots = nouvelles.filter(c => c.remarques).length;
    const total = nouvelles.reduce((n, c) => n + c.prix, 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
    if (!nouvelles.length) { await demander("Toutes vos customs achetées sont déjà dans l'onglet « Customs achetées ».", "OK", "Fermer"); return; }
    if (!(await demander(`Ajouter ${nouvelles.length} figurines customs à l'onglet « ${ONGLET_CUSTOMS_ACHETEES} » (${total} payés, port compris) ?\n\n` +
        `${nouvelles.length - lots} avec leur nom, ${lots} achetées en lots de vente en direct (« Custom JB (lot du …) » : ` +
        "vous pourrez corriger leur nom dans le fichier).\n\nSets et figurines LEGO officiels, tuiles, briques, posters et cadeaux ne sont pas repris.",
        "Ajouter", "Annuler"))) return;
    afficher("chargement");
    try {
      await ajouterCustomsAchetees(etat.classeur, nouvelles, (i, n) => $("texte-chargement").textContent = `Ajout des customs… (${i} sur ${n})`);
      etat.nonEnregistres++;
      await memoriser();
      await relireContenu();
      afficher("valeur");
      await demander(`${nouvelles.length} figurines ajoutées à l'onglet « ${ONGLET_CUSTOMS_ACHETEES} ».\n\nPensez à enregistrer le fichier.`, "OK", "Fermer");
      this.afficher();
    } catch (err) {
      console.error(err);
      const m = await Memoire.lire();
      if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
      afficher("valeur");
      await demander("L'ajout a échoué : " + err.message, "OK", "Fermer");
    }
  },

  // Lignes en double de l'onglet « Sets » (même numéro) : on garde celle qui a des remarques (rangement), sinon la 1re.
  // Plusieurs exemplaires d'un même set : une seule ligne, avec la quantité.
  async _doublons() {
    const groupes = new Map();
    for (const s of await lireSets(etat.classeur)) {
      const g = groupes.get(s.code.toLowerCase()) || [];
      g.push(s); groupes.set(s.code.toLowerCase(), g);
    }
    const res = [];
    for (const g of groupes.values()) {
      if (g.length < 2) continue;
      const garde = g.find(s => s.remarques) || g[0];
      res.push(...g.filter(s => s !== garde));
    }
    return res;
  },

  async supprimerDoublons() {
    const doublons = await this._doublons();
    if (!doublons.length) return;
    if (!(await demander(`Supprimer ${doublons.length} ligne(s) en double de l'onglet « Sets » ?\n\n` +
        doublons.map(d => `${d.code} ${d.nom || ""} (ligne ${d.row})`).join("\n") +
        "\n\nPour chaque set, la ligne avec le rangement (remarques) est gardée.", "Supprimer", "Annuler"))) return;
    for (const d of doublons) // ligne vidée : l'appli ignore les lignes sans numéro
      for (const [c] of COLONNES_SETS) await etat.classeur.ecrireTexte(ONGLET_SETS, c + d.row, "");
    etat.nonEnregistres++;
    await memoriser();
    await relireContenu();
    toast(`${doublons.length} doublon(s) supprimé(s) ✔ Pensez à enregistrer, puis « Envoyer ma liste ».`);
    this.afficher();
  },

  // Sets notés « Boîte seule (vide) » -> « Monté », boîte et notice (l'utilisateur n'a aucune boîte sans son set)
  async corrigerBoites() {
    const boites = (await lireSets(etat.classeur)).filter(x => /boîte seule|boite seule/i.test(x.etat));
    if (!boites.length || !(await demander(`Passer ${boites.length} set(s) de « Boîte seule (vide) » à « Monté », avec boîte et notice ?`, "Oui", "Non"))) return;
    for (const b of boites) {
      await etat.classeur.ecrireTexte(ONGLET_SETS, "F" + b.row, "Monté");
      await etat.classeur.ecrireTexte(ONGLET_SETS, "G" + b.row, "oui");
      await etat.classeur.ecrireTexte(ONGLET_SETS, "H" + b.row, "oui");
    }
    etat.nonEnregistres++;
    await memoriser();
    await relireContenu();
    toast(`${boites.length} set(s) corrigé(s) ✔ Pensez à enregistrer, puis « Envoyer ma liste ».`, 6000);
    this.afficher();
  },

  // Lit prix.tsv (BrickLink) et lego.tsv (prix LEGO) et calcule la valeur de chaque article :
  // { details: [{...article, v, brut, ventes, neuf, enVente}], sans, total, parOnglet, date } ; null si pas encore de prix
  // provisoire : prix en cours de relevé (branche releve-en-cours, mise à jour toutes les 10 s), sinon ceux de main
  async calculer(provisoire = false) {
    let rep = provisoire ? await this._api("/contents/prix.tsv?ref=releve-en-cours", { headers: { Accept: "application/vnd.github.raw" } }) : null;
    if (!rep || !rep.ok) rep = await this._api("/contents/prix.tsv", { headers: { Accept: "application/vnd.github.raw" } });
    if (!rep.ok) return null;
    const lignes = (await rep.text()).split("\n").map(l => l.split("\t"));
    const entete = lignes.shift();
    const prix = new Map(lignes.filter(l => l.length === entete.length).map(l => [`${l[0]} ${l[1].toLowerCase()}`, Object.fromEntries(entete.map((c, i) => [c, l[i]]))]));
    // Prix public LEGO FRANCE (lego.tsv, colonne prix_fr : Avenue de la Brique ; dates de vente : Brickset). Un set encore
    // en vente vaut son prix LEGO France (fin de vente non annoncée ou à venir) ; sans prix français, il est estimé comme
    // un set retiré (ventes BrickLink) : jamais le prix allemand (règle de l'utilisateur, 01/10/2026). Le prix allemand
    // (colonne prix_lego) ne sert plus que de prix d'origine pour le plancher du reste d'un set, faute de prix français.
    const lego = new Map(), prixOrigine = new Map(); // prix LEGO France des sets encore en vente ; prix LEGO d'origine de tous
    const repLego = await this._api("/contents/lego.tsv", { headers: { Accept: "application/vnd.github.raw" } });
    if (repLego.ok) {
      const [entete, ...lignesLego] = (await repLego.text()).split("\n");
      const col = entete.split("\t"), i = k => col.indexOf(k);
      for (const l of lignesLego) {
        const c = l.split("\t"), code = (c[0] || "").toLowerCase();
        const fr = i("prix_fr") >= 0 ? parseFloat(c[i("prix_fr")]) : NaN, de = parseFloat(c[i("prix_lego")]), fin = c[i("fin")] || "";
        if (!code || !(fr || de)) continue;
        prixOrigine.set(code, fr || de);
        if (fr && (!fin || fin >= new Date().toISOString().slice(0, 10))) lego.set(code, fr);
      }
    }
    const articles = await this._articles();
    // Figurines customs : prix JB (encore en vente, catalogue de l'appli) sinon prix d'achat (achats.tsv du dépôt privé,
    // relevé dans les reçus), rapproché par le nom
    try { await CatalogueJB.charger(); } catch (e) { /* sans catalogue JB : prix d'achat seulement */ }
    const achats = [], lots = []; // achats nommés (rapprochés par le nom) ; lots Whatnot de customs non nommées
    const repAchats = await this._api("/contents/achats.tsv", { headers: { Accept: "application/vnd.github.raw" } });
    if (repAchats.ok) for (const l of (await repAchats.text()).split("\n").slice(1)) {
      const [date, vendeur, source, article, , qte, ttc, remarque] = l.split("\t");
      if (!article || !(parseFloat(ttc) > 0)) continue;
      if (remarque === "lot custom") lots.push(parseFloat(ttc));
      else if (!remarque) // un exemplaire par quantité achetée
        for (let i = 0; i < (+qte || 1); i++) achats.push({ date, vendeur, source, article, prix: parseFloat(ttc), mots: motsCustom(article) });
    }
    lots.sort((x, y) => x - y);
    const prixLot = lots.length ? lots[Math.floor(lots.length / 2)] : 0; // médiane : prix habituel d'une custom sur Whatnot
    // sets vendus sans leurs figurines sur eBay.de (prix_ebay_sets.tsv, outils/prix_ebay_sets.py) : au moins 2 annonces
    const sansFigsEbay = new Map();
    const repSets = await this._api("/contents/prix_ebay_sets.tsv", { headers: { Accept: "application/vnd.github.raw" } }).catch(() => null);
    if (repSets && repSets.ok) for (const l of (await repSets.text()).split("\n").slice(1)) {
      const [code, n, , med] = l.split("\t");
      if (code && +n >= 2 && +med > 0) sansFigsEbay.set(code.toLowerCase(), { n: +n, med: +med });
    }
    // prix demandés sur eBay.de (prix_ebay.tsv, outils/prix_ebay_jb.py) : coût de rachat d'une custom qu'on ne trouve plus chez JB
    const ebay = [];
    const repEbay = await this._api("/contents/prix_ebay.tsv", { headers: { Accept: "application/vnd.github.raw" } }).catch(() => null);
    if (repEbay && repEbay.ok) for (const l of (await repEbay.text()).split("\n").slice(1)) {
      const [nom, n, , med] = l.split("\t");
      if (+n >= 2 && +med > 0) ebay.push({ nom, n: +n, med: +med, mots: new Set([...motsCustom(nom), ...(normaliser(nom).match(/\b\d{2,4}\b/g) || [])]) });
    }
    const prixEbay = nom => { // annonce dont tous les mots sont dans le nom, et qui couvre au moins les 3/4 du nom
      const m = new Set([...motsCustom(nom), ...(normaliser(nom).match(/\b\d{2,4}\b/g) || [])]);
      let best = null, sc = 0;
      for (const e of ebay) {
        if (!e.mots.size || ![...e.mots].every(x => m.has(x))) continue;
        const r = e.mots.size / m.size;
        if (r >= 0.75 && r > sc) { sc = r; best = e; }
      }
      return best;
    };
    const utilises = new Set(); // chaque achat ne sert qu'à un exemplaire (plusieurs exemplaires : plusieurs achats, plusieurs prix)
    // Custom qu'on ne peut plus acheter chez JB (épuisée, ou absente du catalogue) : coût de rachat = le plus haut entre
    // son prix payé, le dernier prix JB et le prix demandé sur eBay.de (au moins 2 annonces)
    const prixCustom = a => {
      const jb0 = CatalogueJB.parCode && CatalogueJB.parCode.get(a.code);
      const r = prixCustomBase(a);
      if (r && r.enVente) return r;
      const jb = r && r.jb || jb0;
      const cands = r ? [r] : [];
      if (jb && jb.epuisee && jb.prix) cands.push({ v: jb.prix, source: "Épuisée chez JB Spielwaren : dernier prix JB" });
      const e = prixEbay([a.nom, jb && jb.nom].filter(Boolean).join(" ")) || (jb && prixEbay(jb.nom));
      if (e) cands.push({ v: e.med, source: `Plus en vente chez JB : prix demandé sur eBay.de (médiane de ${e.n} annonces)` });
      if (!cands.length) return null;
      const m = cands.reduce((x, y) => y.v > x.v ? y : x);
      return (jb && jb.epuisee && m !== cands.find(c => /Épuisée/.test(c.source))) ? { ...m, source: m.source + " · épuisée chez JB" } : m;
    };
    const prixCustomBase = a => {
      let jb = CatalogueJB.parCode && CatalogueJB.parCode.get(a.code);
      const proche = (motsA, liste, motsDe) => { // élément de la liste dont le nom ressemble le plus (0,75 au moins)
        let m = null, sc = 0;
        for (const x of liste) {
          const mx = motsDe(x), communs = [...mx].filter(w => motsA.has(w)).length;
          const r = communs / Math.max(1, Math.min(mx.size, 4));
          if (r > sc) { sc = r; m = x; }
        }
        return sc >= 0.75 ? m : null;
      };
      if (!jb && a.nom && !(a.achat && a.achat.lot) && CatalogueJB.liste) // sans code JB : recherche par le nom dans le catalogue JB actuel
        jb = proche(motsCustom(a.nom), CatalogueJB.liste.filter(x => x.source === "jb" && x.prix), x => x.mots || (x.mots = motsCustom(x.nom)));
      if (jb && jb.prix && jb.source === "jb" && !jb.epuisee) return { v: jb.prix, enVente: true, source: "Prix JB Spielwaren (encore en vente)" };
      if (a.achat) { // ligne de l'onglet Customs achetées : son propre prix payé (port compris)
        const quand = /^\d{4}-\d\d-\d\d$/.test(a.achat.date) ? new Date(a.achat.date).toLocaleDateString("fr-FR") : a.achat.date;
        return { v: a.achat.prix, jb, source: a.achat.lot ? `Prix payé (lot ${a.achat.vendeur}, ${quand})` : `Prix d'achat (${a.achat.vendeur}, ${quand})` };
      }
      const mots = motsCustom([a.nom, jb && jb.nom].filter(Boolean).join(" "));
      let meilleur = null, score = 0, dejaPris = null;
      for (const x of achats) {
        if (mots.size === 1 && x.mots.size > 2) continue; // nom d'un seul mot (« VADER ») : seulement un article au nom aussi court
        const communs = [...x.mots].filter(m => mots.has(m)).length;
        const r = communs / Math.max(1, Math.min(x.mots.size, mots.size, 4)) + (utilises.has(x) ? 0 : 0.001); // un achat pas encore utilisé d'abord
        if (r > score) { score = r; meilleur = x; }
      }
      if (meilleur && score >= 0.75) {
        dejaPris = utilises.has(meilleur);
        utilises.add(meilleur);
        return { v: meilleur.prix, jb, achat: meilleur.article,
                 source: `Prix d'achat (${meilleur.vendeur}, ${new Date(meilleur.date).toLocaleDateString("fr-FR")}${dejaPris ? ", même prix qu'un autre exemplaire" : ""})` };
      }
      if (prixLot) return { v: prixLot, jb, source: `Prix d'achat habituel d'une custom sur Whatnot (médiane de ${lots.length} achats)` };
      return null;
    };
    const lirePrix = (q, n) => q ? parseFloat(n ? (q.neuf_median || q.neuf_moyen) : (q.occasion_median || q.occasion_moyen)) || 0 : 0;
    // Deux valeurs par article (prix BrickLink : ventes en Europe TVA comprise, sinon monde entier) :
    //  - rachat : ce que coûterait le rachat à neuf (prix neuf ; prix LEGO si le set est encore vendu ;
    //    prix d'occasion s'il n'y a eu aucune vente neuve) : valeur principale, pour l'assureur ;
    //  - occasion : revente d'occasion (neuf pour les sets scellés et objets neufs), en complément.
    const evaluer = (a, rachat) => {
      const p = prix.get(`${a.type} ${a.code.toLowerCase()}`);
      const enVente = rachat && a.type === "SET" ? lego.get(a.code.toLowerCase()) : 0;
      const neufVoulu = rachat || (a.type === "SET" && /scell/i.test(a.etat)) || (a.type === "GEAR" && /neuf/i.test(a.etat));
      const pn = lirePrix(p, neufVoulu), pAutre = lirePrix(p, !neufVoulu);
      let v = enVente || pn || pAutre || (!rachat && a.type === "SET" ? lego.get(a.code.toLowerCase()) || 0 : 0);
      if (!v) return null;
      const neuf = !enVente && (pn ? neufVoulu : !neufVoulu);
      const unitaire = v, qte = a.quantite || 1;
      let detail = null;
      if (a.figs && a.figs.length) {
        // figurines une à une + reste du set (prix du set moins ses figurines, jamais moins de
        // PART_RESTE_SET du prix LEGO d'origine : briques, boîte et notice gardent une valeur)
        const pf = f => { const q = prix.get(`MINIFIG ${f.code}`); return lirePrix(q, rachat) || lirePrix(q, !rachat); };
        const figsSet = a.figs.reduce((n, f) => n + pf(f) * f.quantite, 0);
        const eb = sansFigsEbay.get(a.code.toLowerCase());
        const resteEbay = eb ? PART_EBAY_SANS_FIGS * eb.med : 0;
        // set encore vendu par LEGO : son rachat coûte le prix LEGO, figurines comprises (pas de minimum pour le reste)
        const reste = enVente ? v - figsSet
          : Math.max(v - figsSet, PART_RESTE_SET * (prixOrigine.get(a.code.toLowerCase()) || v), resteEbay);
        const figsIci = a.sansFigs ? 0 : a.figs.reduce((n, f) => n + pf(f) * (f.quantite * qte - f.ailleurs), 0);
        v = reste * qte + figsIci;
        detail = { figsSet, reste, figsIci, resteEbay: resteEbay && reste === resteEbay ? eb : null };
      } else v = v * qte;
      return { v, unitaire, detail, neuf, enVente: !!enVente, date: p ? p.date : "",
               ventes: p ? (neuf ? p.neuf_ventes : p.occasion_ventes) : 0, zone: p ? (neuf ? p.neuf_zone : p.occasion_zone) || "" : "" };
    };
    let total = 0, totalOccasion = 0, date = "";
    const sans = [], parOnglet = {}, details = [];
    // valeurs déclarées à la main (onglet « Valeurs déclarées ») : remplacent l'estimation, pour chaque exemplaire
    const declarees = await lireValeursDeclarees(etat.classeur).catch(() => []);
    const restants = new Map(declarees.map(d => [d, d.exemplaires])); // exemplaires encore à valoriser à la valeur déclarée
    const declaree = a => {
      const d = declarees.find(d => ((a.code && d.cle.toUpperCase() === a.code.toUpperCase()) ||
        (a.nom && normaliser(d.cle) === normaliser(a.nom))) && restants.get(d) > 0);
      if (d) restants.set(d, restants.get(d) - (a.quantite || 1));
      return d;
    };
    for (const a of articles) {
      const dv = declaree(a);
      if (dv) {
        const v = dv.valeur * Math.min(a.quantite || 1, dv.exemplaires);
        total += v; totalOccasion += v;
        parOnglet[a.onglet] = (parOnglet[a.onglet] || 0) + v;
        details.push({ ...a, v, vOccasion: v, unitaire: dv.valeur, brut: v, declaree: true, ventes: 0, neuf: true,
                       sourceCustom: `✍️ valeur déclarée${dv.justification ? ` : ${dv.justification}` : ""}` });
        continue;
      }
      if (a.type === "CUSTOM") {
        const c = prixCustom(a);
        if (!c) { sans.push(a); continue; }
        total += c.v; totalOccasion += c.v;
        parOnglet[a.onglet] = (parOnglet[a.onglet] || 0) + c.v;
        details.push({ ...a, v: c.v, vOccasion: c.v, unitaire: c.v, brut: c.v, sourceCustom: c.source, ventes: 0, neuf: true });
        continue;
      }
      const r = evaluer(a, true), o = evaluer(a, false);
      if (!r) { sans.push(a); continue; }
      if (r.date > date) date = r.date;
      total += r.v; totalOccasion += o ? o.v : 0;
      parOnglet[a.onglet] = (parOnglet[a.onglet] || 0) + r.v;
      details.push({ ...a, ...r, brut: r.unitaire * (a.quantite || 1), vOccasion: o ? o.v : 0 });
    }
    details.sort((x, y) => y.v - x.v);
    return { details, sans, total, totalOccasion, parOnglet, date };
  },

  // ✍️ Valeurs déclarées : liste et formulaire (article de la collection, valeur par exemplaire, justification)
  _carteDeclarees(details, sans) {
    const euros = v => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
    const vus = new Map();
    for (const a of [...details, ...sans]) {
      const cle = a.code || a.nom;
      if (cle && !vus.has(cle)) vus.set(cle, { cle, nom: a.nom || "", code: a.code || "", estim: a.declaree ? null : a.unitaire || null, declaree: a.declaree });
    }
    this._choixDeclarer = [...vus.values()];
    const decl = details.filter(d => d.declaree);
    const faites = [...new Map(decl.map(d => [d.code || d.nom, d])).values()];
    return `<div class="carte"><p class="sous-titre">✍️ Valeurs déclarées${faites.length ? ` (${faites.length})` : ""}</p>
      <p class="score">Pour une pièce exceptionnelle (signée, exemplaire rare…) : la valeur que vous déclarez remplace l'estimation.
        Gardez une preuve (photo de la signature, certificat, annonce comparable).</p>
      ${faites.map(d => `<div class="ligne-valeur"><span>${echapper(d.nom || d.code)}${decl.filter(x => (x.code || x.nom) === (d.code || d.nom)).length > 1 ? ` ×${decl.filter(x => (x.code || x.nom) === (d.code || d.nom)).length}` : ""} <span class="score">${echapper(d.sourceCustom.replace(/^✍️ valeur déclarée :? ?/, ""))}</span></span>
        <span><b>${euros(d.unitaire)}</b> <button class="petit" data-declaree-suppr="${echapper(d.code || d.nom)}" title="Retirer">✕</button></span></div>`).join("")}
      <details id="declarer-bloc"><summary>➕ Déclarer une valeur</summary>
        <label for="declarer-article" class="etiquette-champ">Article de la collection</label>
        <input id="declarer-article" class="champ" list="declarer-liste" autocomplete="off" placeholder="Tapez le nom ou le code">
        <datalist id="declarer-liste">${this._choixDeclarer.map(c => `<option value="${echapper(c.nom ? `${c.nom}${c.code ? ` (${c.code})` : ""}` : c.code)}">`).join("")}</datalist>
        <label for="declarer-valeur" class="etiquette-champ">Valeur déclarée, par exemplaire (€)</label>
        <input id="declarer-valeur" class="champ" inputmode="decimal" placeholder="ex. 250">
        <label for="declarer-exemplaires" class="etiquette-champ">Nombre d'exemplaires concernés</label>
        <input id="declarer-exemplaires" class="champ" inputmode="numeric" value="1">
        <label for="declarer-justif" class="etiquette-champ">Justification</label>
        <input id="declarer-justif" class="champ" autocomplete="off" placeholder="ex. signée par Paul Brooke, n° 12/50, certificat">
        <button class="bouton vert" data-action="valeur-declarer">✔ Enregistrer la valeur déclarée</button>
      </details></div>`;
  },

  async declarer() {
    const texte = $("declarer-article").value.trim();
    const choix = (this._choixDeclarer || []).find(c => texte === (c.nom ? `${c.nom}${c.code ? ` (${c.code})` : ""}` : c.code))
      || (this._choixDeclarer || []).find(c => normaliser(c.nom) === normaliser(texte) || (c.code && c.code.toUpperCase() === texte.toUpperCase()));
    const valeur = parseFloat($("declarer-valeur").value.replace(/\s/g, "").replace(",", "."));
    if (!choix) { await demander("Choisissez l'article dans la liste proposée (tapez quelques lettres de son nom).", "OK", "Fermer"); return; }
    if (!(valeur > 0)) { await demander("Indiquez une valeur en euros (ex. 250).", "OK", "Fermer"); return; }
    await declarerValeur(etat.classeur, { cle: choix.code || choix.nom, nom: choix.nom, valeur, justification: $("declarer-justif").value.trim(),
                                           exemplaires: parseInt($("declarer-exemplaires").value, 10) || 1 });
    etat.nonEnregistres++;
    await memoriser();
    toast(`${choix.nom || choix.code} : ${valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} déclarés ✔ (pensez à enregistrer)`);
    this.afficher();
  },

  async retirerDeclaree(cle) {
    if (!(await demander(`Retirer la valeur déclarée de « ${cle} » ? L'article reprendra sa valeur estimée.`))) return;
    await declarerValeur(etat.classeur, { cle, valeur: 0 });
    etat.nonEnregistres++;
    await memoriser();
    this.afficher();
  },

  // Historique de la valeur (gardé dans le téléphone) : un point par jour de consultation, le dernier du jour gagne
  async _historiser(total, totalOccasion, n) {
    const jour = new Date().toISOString().slice(0, 10);
    const h = ((await Memoire.lire("historique_valeur")) || []).filter(p => p.jour !== jour);
    h.push({ jour, total: Math.round(total * 100) / 100, occasion: Math.round(totalOccasion * 100) / 100, n });
    h.sort((a, b) => a.jour.localeCompare(b.jour));
    await Memoire.ecrire(h, "historique_valeur");
    return h;
  },

  // Courbe de la valeur dans le temps (rachat à neuf, et occasion en pointillés)
  _carteHistorique(h, euros) {
    if (h.length < 2) return `<div class="carte"><p class="sous-titre">📈 Évolution de la valeur</p><p class="score">La courbe apparaîtra à
      partir de la prochaine consultation un autre jour : la valeur du jour est retenue à chaque visite de cet écran.</p></div>`;
    const W = 320, H = 140, m = 6;
    const t0 = new Date(h[0].jour).getTime(), t1 = new Date(h[h.length - 1].jour).getTime() || t0 + 1;
    const vals = h.flatMap(p => [p.total, p.occasion]), min = Math.min(...vals) * 0.95, max = Math.max(...vals) * 1.02 || 1;
    const x = p => m + (W - 2 * m) * ((new Date(p.jour).getTime() - t0) / Math.max(1, t1 - t0));
    const y = v => H - m - (H - 2 * m) * ((v - min) / Math.max(1, max - min));
    const ligne = k => h.map(p => `${x(p).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
    const premier = h[0], dernier = h[h.length - 1], ecart = dernier.total - premier.total;
    const date = j => new Date(j + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    return `<div class="carte"><p class="sous-titre">📈 Évolution de la valeur</p>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Courbe de la valeur de la collection">
        <polyline points="${ligne("occasion")}" fill="none" stroke="#6b7075" stroke-width="2" stroke-dasharray="5 4"/>
        <polyline points="${ligne("total")}" fill="none" stroke="#00852b" stroke-width="3"/>
        ${h.map(p => `<circle cx="${x(p).toFixed(1)}" cy="${y(p.total).toFixed(1)}" r="3" fill="#00852b"/>`).join("")}
      </svg>
      <div class="ligne-valeur"><span>Du ${date(premier.jour)} au ${date(dernier.jour)}</span><b class="${ecart >= 0 ? "hausse" : "baisse"}">${ecart >= 0 ? "+" : ""}${euros(ecart)}</b></div>
      <p class="score">Trait plein : rachat à neuf ; pointillés : occasion. ${h.length} relevés.</p></div>`;
  },

  // Bandeau d'état : « actualisation en cours » tant qu'un calcul ou un relevé des prix tourne (le total peut encore
  // changer), puis « valeur à jour »
  _bandeau() {
    const b = $("valeur-bandeau"), enCours = (this._calculs || 0) > 0 || !!this._suivi;
    b.hidden = !enCours && !this._aJour;
    b.className = "bandeau " + (enCours ? "en-cours" : "a-jour");
    b.textContent = enCours ? `⏳ Actualisation en cours : le total peut encore changer${this._suivi && this._texteReleve ? ` (${this._texteReleve.replace(/…$/, "")})` : ""}…`
      : `✅ Valeur à jour${this._aJour && this._aJour.date ? ` · prix du ${new Date(this._aJour.date).toLocaleDateString("fr-FR")}` : ""}`;
    $("valeur-resultat").classList.toggle("provisoire", enCours);
  },

  async afficher() {
    this._calculs = (this._calculs || 0) + 1;
    this._bandeau();
    try { await this._afficher(); } finally { this._calculs--; this._bandeau(); }
  },

  async _afficher() {
    if (!etat.classeur) { $("valeur-etat").textContent = "Ouvrez d'abord votre collection pour voir sa valeur."; return; }
    $("valeur-etat").textContent = "Lecture des prix…";
    try {
      const calcul = await this.calculer();
      if (!calcul) { $("valeur-etat").textContent = "Pas encore de prix : touchez « Envoyer ma liste et relever les prix »."; return; }
      const { details, sans, total, totalOccasion, parOnglet, date } = calcul;
      this._aJour = { date };
      if (!details.length) {
        $("valeur-etat").textContent = "";
        $("valeur-resultat").innerHTML = `<div class="carte"><p>⏳ Aucun prix pour l'instant : le relevé BrickLink est sans doute encore en cours` +
          ` (environ 1 minute par 100 articles). Touchez « Actualiser » un peu plus tard.</p></div>`;
        return;
      }
      const euros = v => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
      $("valeur-etat").textContent = date ? `Prix du ${new Date(date).toLocaleDateString("fr-FR")} : médiane des ventes BrickLink des 6 derniers mois en Europe, TVA comprise.` : "";
      const historique = await this._historiser(total, totalOccasion, details.length);
      const doublons = await this._doublons();
      const boites = (await lireSets(etat.classeur)).filter(x => /boîte seule|boite seule/i.test(x.etat));
      $("valeur-resultat").innerHTML = (doublons.length ? `<div class="carte alerte">⚠️ <b>${doublons.length} ligne(s) en double</b> dans l'onglet « Sets » ` +
          `(comptées deux fois) : ${echapper([...new Set(doublons.map(d => `${d.nom || d.code} ${d.code}`))].join(", "))}.` +
          `<button class="bouton rouge" data-action="valeur-doublons">🧹 Supprimer les doublons</button></div>` : "") +
        (boites.length ? `<div class="carte alerte">📦 <b>${boites.length} set(s) notés « Boîte seule (vide) »</b> dans l'onglet « Sets » : ` +
          `ils sont comptés comme des boîtes vides.<button class="bouton bleu" data-action="valeur-boites">✔ Ce sont des sets montés complets (boîte et notice)</button></div>` : "") + `
        <div class="carte valeur-total"><div class="score">Coût de rachat à neuf de la collection</div><div class="montant">${euros(total)}</div>
          <div class="ligne-valeur"><span>Valeur d'occasion (revente)</span><b>${euros(totalOccasion)}</b></div>
          <div class="score">${details.length} article(s) valorisé(s)${sans.length ? ` · ${sans.length} sans prix pour l'instant` : ""}</div></div>
        ${this._carteHistorique(historique, euros)}
        ${this._carteDeclarees(details, sans)}
        <div class="carte"><p class="sous-titre">Par onglet</p>
          ${Object.entries(parOnglet).sort((a, b) => b[1] - a[1]).map(([o, v]) => `<div class="ligne-valeur"><span>${echapper(o)}</span><b>${euros(v)}</b></div>`).join("")}</div>
        ${GROUPES_VALEUR.map(([titre, test]) => {
          const g = details.filter(test);
          if (!g.length) return "";
          const total = g.reduce((n, d) => n + d.v, 0);
          return `<div class="carte"><p class="sous-titre">${titre} : ${euros(total)} <span class="score">(${g.length})</span></p>
            ${g.slice(0, 10).map(d => `<div class="ligne-valeur"><span>${echapper(d.nom || d.code)} <span class="score">${echapper(d.code)}${d.quantite > 1 ? ` ×${d.quantite}` : ""}${d.sourceCustom ? ` · ${d.sourceCustom}` : d.enVente ? " · prix LEGO France (encore en vente)" : d.neuf ? " · neuf" : " · occasion (aucune vente neuve)"}${d.zone === "monde" ? " · ventes hors Europe" : ""}${d.detail ? ` · figurines ${euros(d.detail.figsSet)} + reste du set ${euros(d.detail.reste)}${d.detail.resteEbay ? ` (d'après ${d.detail.resteEbay.n} annonces eBay.de sans figurines)` : ""}${d.figsAilleurs ? ` (${d.figsAilleurs} figurine(s) comptée(s) dans vos onglets)` : ""}${d.sansFigs ? " · sans figurines" : ""}` : ""}${d.enVente || d.sourceCustom ? "" : ` · ${d.ventes} ventes · occasion ${euros(d.vOccasion)}`}</span></span><b>${euros(d.v)}</b></div>`).join("")}
            ${g.length > 10 ? `<p class="score">… et ${g.length - 10} autre(s)</p>` : ""}</div>`;
        }).join("")}
        ${(() => { // customs sans prix : pour comprendre pourquoi (code, nom)
          const c = sans.filter(a => a.type === "CUSTOM");
          return c.length ? `<div class="carte"><p class="sous-titre">🎨 Customs sans prix (${c.length})</p>
            <p class="score">Ni en vente chez JB Spielwaren, ni retrouvées dans vos reçus d'achat :</p>
            ${c.slice(0, 40).map(a => `<div class="ligne-valeur"><span>${echapper(a.nom || "(sans nom)")} <span class="score">${echapper(a.code || "sans code")} · ${echapper(a.onglet)}</span></span></div>`).join("")}
            ${c.length > 40 ? `<p class="score">… et ${c.length - 40} autre(s)</p>` : ""}</div>` : "";
        })()}
        <p class="aide">Valeur principale : coût de rachat à neuf (ventes neuves BrickLink en Europe, TVA comprise, ou prix public LEGO France si le set est encore vendu). Figurines estimées une à une, plus le reste de chaque set ; rien n'est compté deux fois. Customs : prix JB s'ils sont encore en vente ; épuisés, le plus haut entre prix d'achat (reçus JB, historique Whatnot, port compris), dernier prix JB et prix demandé sur eBay.de ; sinon prix habituel d'une custom sur Whatnot. <a href="methode.html">ℹ️ Comment est calculée la valeur ?</a></p>`;
    } catch (err) {
      console.error(err);
      $("valeur-etat").textContent = "Échec : " + err.message;
    }
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "valeur") Valeur.ouvrir();
  else if (a === "valeur-jeton") Valeur.enregistrerJeton();
  else if (a === "valeur-oublier") Valeur.oublierJeton();
  else if (a === "valeur-envoyer") Valeur.envoyer();
  else if (a === "valeur-actualiser") Valeur.afficher();
  else if (a === "valeur-doublons") Valeur.supprimerDoublons();
  else if (a === "valeur-boites") Valeur.corrigerBoites();
  else if (a === "valeur-customs") Valeur.ajouterCustoms();
  else if (a === "valeur-declarer") Valeur.declarer();
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-declaree-suppr]");
  if (b) Valeur.retirerDeclaree(b.dataset.declareeSuppr);
});
