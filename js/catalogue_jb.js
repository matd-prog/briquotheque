// Catalogue des figurines custom JB Spielwaren (data/jb.tsv, créé par outils/catalogue_jb.py) :
// code JB-<numéro d'article>, nom, catégorie, lien de la page, adresse de la photo sur leur site.

const CatalogueJB = {
  liste: null,
  parCode: null,
  date: null,
  _chargement: null,

  charger() {
    if (!this._chargement) {
      this._chargement = fetch("data/jb.tsv")
        .then(rep => { if (!rep.ok) throw new Error("catalogue JB absent"); return rep.text(); })
        .then(texte => {
          this.liste = [];
          this.parCode = new Map();
          for (const ligne of texte.split("\n")) {
            if (ligne.startsWith("#date ")) { this.date = ligne.slice(6).trim(); continue; }
            const [code, nom, categorie, lien, image] = ligne.split("\t");
            if (!code || !code.startsWith("JB-")) continue;
            const f = { code, nom, categorie, lien, image, recherche: normaliser(`${code} ${nom} ${categorie}`) };
            this.liste.push(f);
            this.parCode.set(code.toUpperCase(), f);
          }
          return this.liste;
        })
        .catch(err => { this._chargement = null; throw err; });
    }
    return this._chargement;
  },

  trouver(code) {
    return this.parCode ? this.parCode.get((code || "").toUpperCase()) || null : null;
  },

  chercher(texte, max = 30) {
    if (!this.liste) return [];
    const mots = normaliser(texte).split(" ").filter(Boolean);
    if (!mots.length) return [];
    return this.liste.filter(f => mots.every(m => f.recherche.includes(m))).slice(0, max);
  },
};

// « Alien Prosecutor Custom Minifigure » -> « ALIEN PROSECUTOR » (style de votre fichier)
function nomCustomPourFichier(nom) {
  const court = nom.replace(/\s*\bc[ou]s?t[ou]m\s+minifig(ure|ur)?s?\b/i, "").replace(/\s+/g, " ").trim();
  const m = /^(.*?)\s+(designed by .*|\d+ of \d+|halloween .*|christmas .*)$/i.exec(court);
  return m ? `${m[1].toUpperCase()} ${m[2]}` : court.toUpperCase();
}
