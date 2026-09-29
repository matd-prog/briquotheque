// Catalogue des figurines custom JB Spielwaren (data/jb.tsv, créé par outils/catalogue_jb.py) :
// code JB-<numéro d'article>, nom, catégorie, lien de la page, adresse de la photo sur leur site.
// S'y ajoutent deux listes facultatives de figurines plus en vente chez JB, au même format :
// - data/jb_brickshell.tsv (outils/brickshell_jb.py) : revendues par brickshellcases.com, code JB-…
//   quand le numéro d'article est connu (sinon BSC-…), lien vers leur page brickshellcases ;
// - data/jb_ebay.tsv (outils/ebay_jb.py) : vues sur eBay.de, code EBAY-…, lien vers une recherche
//   eBay.de ; une fois choisies, elles reçoivent un code CUS-… comme les autres customs.

const SOURCES_JB = [
  { source: "jb", fichier: "data/jb.tsv", codes: /^JB-/, obligatoire: true },
  { source: "brickshell", fichier: "data/jb_brickshell.tsv", codes: /^(JB|BSC)-/ },
  { source: "ebay", fichier: "data/jb_ebay.tsv", codes: /^EBAY-/ },
];

const CatalogueJB = {
  liste: null,
  parCode: null,
  date: null,
  nb: { jb: 0, brickshell: 0, ebay: 0 },
  _chargement: null,

  charger() {
    if (!this._chargement) {
      const textes = SOURCES_JB.map(s => fetch(s.fichier)
        .then(rep => { if (rep.ok) return rep.text(); if (s.obligatoire) throw new Error("catalogue JB absent"); return ""; })
        .catch(err => { if (s.obligatoire) throw err; return ""; }));
      this._chargement = Promise.all(textes)
        .then(liste => {
          this.liste = [];
          this.parCode = new Map();
          this.nb = { jb: 0, brickshell: 0, ebay: 0 };
          SOURCES_JB.forEach(({ source, codes }, i) => {
            for (const ligne of liste[i].split("\n")) {
              if (ligne.startsWith("#date ")) { if (source === "jb") this.date = ligne.slice(6).trim(); continue; }
              const [code, nom, categorie, lien, image] = ligne.split("\t");
              if (!code || !codes.test(code) || this.parCode.has(code.toUpperCase())) continue;
              const f = { code, nom, categorie, lien, image, source, ebay: source === "ebay",
                          recherche: normaliser(`${code} ${nom} ${categorie}`) };
              this.liste.push(f);
              this.parCode.set(code.toUpperCase(), f);
              this.nb[source]++;
            }
          });
          return this.liste;
        })
        .catch(err => { this._chargement = null; throw err; });
    }
    return this._chargement;
  },

  // Figurine du catalogue dont c'est le lien (pour garder son code JB-… : lien brickshellcases)
  parLien(lien) {
    return (lien && this.liste && this.liste.find(f => f.lien === lien)) || null;
  },

  // Empreintes des blisters (data/jb_empreintes.tsv, créées par outils/empreintes_jb.js)
  empreintes: null,
  chargerEmpreintes() {
    if (!this._chargementEmpreintes) {
      this._chargementEmpreintes = fetch("data/jb_empreintes.tsv")
        .then(rep => { if (!rep.ok) throw new Error("empreintes JB absentes"); return rep.text(); })
        .then(texte => {
          this.empreintes = new Map();
          for (const ligne of texte.split("\n")) {
            const [code, e] = ligne.split("\t");
            if (code && code.startsWith("JB-") && e) this.empreintes.set(code.toUpperCase(), empreinteDepuisTexte(e));
          }
          return this.empreintes;
        })
        .catch(err => { this._chargementEmpreintes = null; throw err; });
    }
    return this._chargementEmpreintes;
  },

  // Blisters du catalogue dont le décor ressemble le plus à la photo : [{ f, score }], du plus ressemblant au moins
  classerParDecor(source, max = 10) {
    if (!this.empreintes || !this.liste) return [];
    const e = empreinteImage(source, false);
    const res = [];
    for (const f of this.liste) {
      const ref = this.empreintes.get(f.code.toUpperCase());
      if (ref) res.push({ f, score: similarite(e, ref) });
    }
    return res.sort((a, b) => b.score - a.score).slice(0, max);
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
