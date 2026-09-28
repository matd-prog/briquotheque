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

  // Figurines dont le nom ressemble au texte lu sur un blister (tolère les erreurs de lecture)
  rapprocher(texte, max = 6) {
    if (!this.liste) return [];
    const lus = normaliser(texte).split(/[^a-z0-9]+/).filter(m => m.length >= 3);
    if (!lus.length) return [];
    const ignores = new Set(["custom", "costum", "minifigure", "minifigur", "minifig", "designed", "the", "and", "with", "von", "spielwaren"]);
    const lusUtiles = lus.filter(m => !ignores.has(m));
    const proche = (a, b) => a === b || (b.length >= 5 && distanceTexte(a, b) <= 1);
    const res = [];
    for (const f of this.liste) {
      const mots = normaliser(f.nom).split(/[^a-z0-9]+/).filter(m => m.length >= 3 && !ignores.has(m));
      if (!mots.length) continue;
      const trouves = mots.filter(m => lusUtiles.some(l => proche(l, m))).length;
      if (trouves && trouves / mots.length >= 0.5) res.push({ f, score: trouves / mots.length, trouves });
    }
    res.sort((a, b) => b.score - a.score || b.trouves - a.trouves);
    return res.slice(0, max).map(r => r.f);
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

// Nombre de lettres à changer pour passer d'un mot à l'autre (distance de Levenshtein)
function distanceTexte(a, b) {
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cour = [i];
    for (let j = 1; j <= b.length; j++)
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prec = cour;
  }
  return prec[b.length];
}
