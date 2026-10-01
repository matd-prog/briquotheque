// Nouveautés LEGO (data/nouveautes.tsv, mis à jour chaque jour depuis Rebrickable par outils/nouveautes_rebrickable.py) :
// figurines, sets et objets dérivés de l'année, souvent connus avant leur arrivée en magasin.
// - les figurines s'ajoutent au catalogue de recherche (Catalogue), même sans code BrickLink encore connu ;
// - une photo est aussi comparée aux photos officielles des nouvelles figurines (data/nouveautes_empreintes.tsv),
//   que Brickognize ne reconnaît souvent que des semaines après leur sortie.

const Nouveautes = {
  liste: [],
  date: null,
  _chargement: null,
  _empreintes: null,

  charger(frais = false) {
    if (!this._chargement || frais) {
      this._empreintes = null;
      this._chargement = fetch("data/nouveautes.tsv", frais ? { cache: "reload" } : {}).then(r => r.ok ? r.text() : "").then(texte => {
        this.liste = []; this.date = null;
        let colonnes = null;
        for (const l of texte.split("\n")) {
          if (l.startsWith("#date ")) { this.date = l.slice(6).trim(); continue; }
          const c = l.replace(/\r$/, "").split("\t");
          if (c[0] === "type") { colonnes = c; continue; }
          if (!colonnes || c.length < colonnes.length) continue;
          const n = Object.fromEntries(colonnes.map((k, i) => [k, c[i]]));
          n.recherche = normaliser(`${n.code} ${n.bricklink} ${n.nom} ${n.theme}`);
          this.liste.push(n);
        }
        return this._ajouterSorties();
      }).then(() => this.liste).catch(err => { console.warn(err); return this.liste; });
    }
    return this._chargement;
  },

  // Dates de sortie (data/sorties.tsv, Brickset, outils/brickset_sorties.py) : chaque set reçoit sa date de sortie,
  // chaque figurine celle du premier set qui la contient ; les sets annoncés que Rebrickable n'a pas encore sont ajoutés
  sorties: new Map(),
  async _ajouterSorties() {
    let texte = "";
    try { const r = await fetch("data/sorties.tsv"); if (r.ok) texte = await r.text(); } catch (err) { console.warn(err); }
    this.sorties = new Map();
    let col = null; // colonnes lues par leur nom (la colonne « prix » allemand d'un ancien fichier est ignorée)
    for (const l of texte.split("\n")) {
      const c = l.replace(/\r$/, "").split("\t");
      if (c[0] === "code") { col = c; continue; }
      if (!col || !c[0] || c[0].startsWith("#")) continue;
      const v = k => c[col.indexOf(k)] || "";
      this.sorties.set(c[0].toLowerCase(), { code: c[0], nom: v("nom"), theme: v("theme"), sousTheme: v("sous_theme"), annee: v("annee"),
        sortie: v("sortie"), fin: v("fin"), pieces: v("pieces"), figurines: v("figurines"), image: v("image") });
    }
    // prix public LEGO France (data/prix_fr.tsv, outils/prix_lego_fr.py) ; jamais le prix allemand
    try {
      const r = await fetch("data/prix_fr.tsv");
      if (r.ok) for (const l of (await r.text()).split("\n")) {
        const [code, prix, meilleur] = l.split("\t");
        const s = code && this.sorties.get(code.toLowerCase());
        if (s && +prix) s.prix = prix;
        if (s && +meilleur) s.meilleur = meilleur; // meilleur prix du moment chez un marchand français
      }
    } catch (err) { console.warn(err); }
    if (!this.sorties.size) return;
    const connus = new Set();
    for (const n of this.liste) {
      if (n.type === "set" || n.type === "objet") {
        const s = this.sorties.get(n.code.toLowerCase());
        if (s) { n.sortie = s.sortie; n.prix = s.prix; n.meilleur = s.meilleur; connus.add(n.code.toLowerCase()); }
      } else if (n.type === "figurine") {
        const dates = (n.sets || "").split(" ").map(c => (this.sorties.get(c.toLowerCase()) || {}).sortie).filter(Boolean).sort();
        if (dates.length) n.sortie = dates[0];
      }
    }
    for (const s of this.sorties.values()) {
      if (connus.has(s.code.toLowerCase())) continue;
      const n = { type: "set", code: s.code, bricklink: s.code, nom: s.nom, theme: [s.theme, s.sousTheme].filter(Boolean).join(" / "),
                  annee: s.annee, image: s.image, vu_le: "", sets: "", sortie: s.sortie, prix: s.prix, meilleur: s.meilleur, brickset: true };
      n.recherche = normaliser(`${n.code} ${n.nom} ${n.theme}`);
      this.liste.push(n);
    }
  },


  // Code sous lequel l'appli range la nouveauté : BrickLink s'il est connu, sinon celui de Rebrickable (FIG-…)
  codeAppli(n) { return (n.bricklink || n.code).toUpperCase(); },

  lienPage(n) {
    if (n.bricklink) return urlBricklink(n.bricklink);
    return `https://rebrickable.com/${n.type === "figurine" ? "minifigs" : "sets"}/${encodeURIComponent(n.code.toLowerCase())}/`;
  },

  // Proposition pour l'écran de résultat (même forme que celles de Brickognize)
  candidat(n) {
    return { id: this.codeAppli(n), nom: n.nom, image: n.image, score: null, categorie: n.theme,
             lien: this.lienPage(n), nouveaute: true };
  },

  async _chargerEmpreintes() {
    if (!this._empreintes) {
      this._empreintes = fetch("data/nouveautes_empreintes.tsv").then(r => r.ok ? r.text() : "").then(t => {
        const m = new Map();
        for (const l of t.split("\n").slice(1)) {
          const [code, e] = l.split("\t");
          if (code && e) m.set(code, empreinteDepuisTexte(e));
        }
        return m;
      }).catch(() => new Map());
    }
    return this._empreintes;
  },

  // Nouvelles figurines qui ressemblent à la photo : [{ n, s }] (s : ressemblance, 0 à 1)
  async semblables(photo, max = 4) {
    await this.charger();
    const empreintes = await this._chargerEmpreintes();
    if (!empreintes.size) return [];
    const image = await createImageBitmap(photo);
    const e = empreinteFigurine(image);
    image.close && image.close();
    return this.liste.filter(n => n.type === "figurine" && empreintes.has(n.code))
      .map(n => ({ n, s: similarite(e, empreintes.get(n.code)) }))
      .sort((a, b) => b.s - a.s).slice(0, max);
  },

  // Relit les nouveautés publiées (sans attendre la copie gardée dans le téléphone)
  async actualiser() {
    await this.charger(true);
    if (typeof Catalogue !== "undefined") { Catalogue._chargement = null; Catalogue._groupes = null; await Catalogue.charger().catch(() => {}); }
    if (typeof CatalogueSets !== "undefined") CatalogueSets._chargement = null;
    return this.liste.length;
  },

  // « 1 octobre 2026 »
  dateLisible() {
    return this.date ? new Date(this.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  },
};
