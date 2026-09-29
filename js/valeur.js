// Valeur de la collection : prix des ventes BrickLink des 6 derniers mois, relevés dans le dépôt GitHub
// PRIVÉ de l'utilisateur (matd-prog/collection-lego-prive : codes.txt -> action « Prix BrickLink » -> prix.tsv).
// L'appli y dépose la liste des codes (figurines et sets du fichier Excel, codes seulement), lance le relevé
// et lit les prix, avec un jeton d'accès GitHub limité à ce dépôt, gardé uniquement dans le téléphone.

const DEPOT_PRIVE = "matd-prog/collection-lego-prive";

// « Les plus précieux », par catégorie
const GROUPES_VALEUR = [
  ["🧍 Figurines les plus précieuses", d => d.type === "MINIFIG"],
  ["🧱 Sets les plus précieux", d => d.type === "SET"],
  ["🔑 Porte-clés et objets dérivés", d => d.type === "GEAR"],
  ["📦 Boîtes seules", d => d.type === "BOX"],
];

const Valeur = {
  jeton: null,

  async _api(chemin, options = {}) {
    const rep = await fetch(`https://api.github.com/repos/${DEPOT_PRIVE}${chemin}`, {
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
    if (this.jeton) this.afficher();
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
        if (c.code && !/^(JB|CUS|BSC|EBAY)-/i.test(c.code)) {
          // dans les onglets de figurines : aussi des sets (30612-1, packs) et des porte-clés ou objets (850353)
          const type = /^\d{4,7}-\d+$/.test(c.code) ? "SET" : /^\d{5,8}$/.test(c.code) ? "GEAR" : "MINIFIG";
          if (type === "MINIFIG" && codeInvalide(c.code)) continue;
          res.push({ type, code: c.code.toLowerCase(), nom: c.nom, onglet, etat: "" });
        }
    try { await CatalogueSets.charger(); } catch (e) { /* sans catalogue : sets comptés comme sets entiers */ }
    for (const s of await lireSets(etat.classeur)) {
      const code = /-\d+$/.test(s.code) ? s.code : s.code + "-1";
      const cat = CatalogueSets.sets && CatalogueSets.sets.get(code.toLowerCase());
      const figs = (CatalogueSets.figurines && CatalogueSets.figurines.get(code.toLowerCase())) || [];
      const a = { type: "SET", code, nom: s.nom, onglet: "Sets", etat: s.etat, quantite: s.quantite || 1 };
      if (/boîte seule|boite seule/i.test(s.etat)) a.type = "BOX"; // boîte vide : prix des boîtes d'origine vendues
      else if (cat && /^Collectible Minifigures/.test(cat.theme) && figs.length === 1 && figs[0].bricklink)
        Object.assign(a, { type: "MINIFIG", code: figs[0].bricklink.toLowerCase() }); // figurine de série : prix de la figurine
      else if (/sans fig/i.test(s.etat)) // set sans ses figurines : prix du set moins celui de ses figurines
        a.moins = figs.filter(f => f.bricklink).map(f => ({ code: f.bricklink.toLowerCase(), quantite: f.quantite || 1 }));
      res.push(a);
    }
    for (const o of await lireObjets(etat.classeur))
      res.push({ type: "GEAR", code: o.code, nom: o.nom || o.type, onglet: ONGLET_OBJETS, etat: o.etat, quantite: o.quantite });
    return res;
  },

  // Dépose codes.txt (codes seulement) puis lance le relevé des prix
  async envoyer() {
    if (!etat.classeur) { await demander("Ouvrez d'abord votre fichier Excel.", "OK", "Fermer"); return; }
    const articles = await this._articles();
    const codes = [...new Set(articles.flatMap(a => [`${a.type} ${a.code}`, ...(a.moins || []).map(m => `MINIFIG ${m.code}`)]))].sort();
    $("valeur-etat").textContent = `Envoi de la liste (${codes.length} articles)…`;
    try {
      const actuel = await this._api("/contents/codes.txt");
      const sha = actuel.ok ? (await actuel.json()).sha : undefined;
      const texte = `# Collection (envoyée par l'appli le ${new Date().toLocaleDateString("fr-FR")}) : codes seulement\n${codes.join("\n")}\n`;
      const contenu = btoa(unescape(encodeURIComponent(texte)));
      const rep = await this._api("/contents/codes.txt", { method: "PUT",
        body: JSON.stringify({ message: `Liste de la collection (${codes.length} articles)`, content: contenu, sha }) });
      if (!rep.ok) throw new Error("envoi refusé");
      const lance = await this._api("/actions/workflows/prix.yml/dispatches", { method: "POST", body: JSON.stringify({ ref: "main" }) });
      if (lance.status !== 204) throw new Error("relevé des prix non lancé");
      $("valeur-etat").textContent = `Liste envoyée (${codes.length} articles) et relevé des prix lancé. Comptez environ 1 minute par 100 nouveaux articles` +
        " (BrickLink limite à 2 250 articles par jour : une très grande collection se relève sur plusieurs jours). Touchez ensuite « Actualiser ».";
    } catch (err) {
      console.error(err);
      $("valeur-etat").textContent = "Échec : " + err.message;
    }
  },

  // Lit prix.tsv et calcule la valeur : figurines au prix d'occasion, sets au prix neuf s'ils sont scellés
  async afficher() {
    if (!etat.classeur) { $("valeur-etat").textContent = "Ouvrez d'abord votre fichier Excel pour voir sa valeur."; return; }
    $("valeur-etat").textContent = "Lecture des prix…";
    try {
      const rep = await this._api("/contents/prix.tsv", { headers: { Accept: "application/vnd.github.raw" } });
      if (!rep.ok) { $("valeur-etat").textContent = "Pas encore de prix : touchez « Envoyer ma liste et relever les prix »."; return; }
      const lignes = (await rep.text()).split("\n").map(l => l.split("\t"));
      const entete = lignes.shift();
      const prix = new Map(lignes.filter(l => l.length === entete.length).map(l => [`${l[0]} ${l[1].toLowerCase()}`, Object.fromEntries(entete.map((c, i) => [c, l[i]]))]));
      const articles = await this._articles();
      let total = 0, sans = [], date = "";
      const parOnglet = {}, details = [];
      for (const a of articles) {
        const p = prix.get(`${a.type} ${a.code.toLowerCase()}`);
        const neuf = (a.type === "SET" && /scell/i.test(a.etat)) || (a.type === "GEAR" && /neuf/i.test(a.etat));
        const lirePrix = (q, n) => q ? parseFloat(n ? (q.neuf_median || q.neuf_moyen) : (q.occasion_median || q.occasion_moyen)) || 0 : 0;
        let v = lirePrix(p, neuf) || lirePrix(p, !neuf); // pas de vente dans cet état : prix de l'autre état
        if (!p || !v) { sans.push(a); continue; }
        for (const m of a.moins || []) v -= lirePrix(prix.get(`MINIFIG ${m.code}`), false) * m.quantite;
        v = Math.max(0, v) * (a.quantite || 1);
        if (p.date > date) date = p.date;
        total += v;
        parOnglet[a.onglet] = (parOnglet[a.onglet] || 0) + v;
        details.push({ ...a, v, ventes: neuf ? p.neuf_ventes : p.occasion_ventes, neuf });
      }
      if (!details.length) {
        $("valeur-etat").textContent = "";
        $("valeur-resultat").innerHTML = `<div class="carte"><p>⏳ Aucun prix pour l'instant : le relevé BrickLink est sans doute encore en cours` +
          ` (environ 1 minute par 100 articles). Touchez « Actualiser » un peu plus tard.</p></div>`;
        return;
      }
      const euros = v => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
      details.sort((x, y) => y.v - x.v);
      $("valeur-etat").textContent = date ? `Prix du ${new Date(date).toLocaleDateString("fr-FR")} : médiane des ventes BrickLink des 6 derniers mois.` : "";
      $("valeur-resultat").innerHTML = `
        <div class="carte valeur-total"><div class="score">Valeur estimée de la collection</div><div class="montant">${euros(total)}</div>
          <div class="score">${details.length} article(s) valorisé(s)${sans.length ? ` · ${sans.length} sans prix pour l'instant` : ""}</div></div>
        <div class="carte"><p class="sous-titre">Par onglet</p>
          ${Object.entries(parOnglet).sort((a, b) => b[1] - a[1]).map(([o, v]) => `<div class="ligne-valeur"><span>${echapper(o)}</span><b>${euros(v)}</b></div>`).join("")}</div>
        ${GROUPES_VALEUR.map(([titre, test]) => {
          const g = details.filter(test);
          if (!g.length) return "";
          const total = g.reduce((n, d) => n + d.v, 0);
          return `<div class="carte"><p class="sous-titre">${titre} : ${euros(total)} <span class="score">(${g.length})</span></p>
            ${g.slice(0, 10).map(d => `<div class="ligne-valeur"><span>${echapper(d.nom || d.code)} <span class="score">${echapper(d.code)}${d.quantite > 1 ? ` ×${d.quantite}` : ""}${d.neuf ? " · neuf" : ""}${d.moins ? " · sans figurines" : ""} · ${d.ventes} ventes</span></span><b>${euros(d.v)}</b></div>`).join("")}
            ${g.length > 10 ? `<p class="score">… et ${g.length - 10} autre(s)</p>` : ""}</div>`;
        }).join("")}
        <p class="aide">Figurines au prix d'occasion ; sets au prix neuf s'ils sont notés « Neuf scellé », sinon d'occasion ; boîtes seules au prix des boîtes vides ; objets dérivés au prix neuf s'ils sont notés neufs ; sets sans figurines : prix du set moins celui de ses figurines. Customs (JB…) non valorisées.</p>`;
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
});
