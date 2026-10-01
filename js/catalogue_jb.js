// Catalogue des figurines custom JB Spielwaren (data/jb.tsv, créé par outils/catalogue_jb.py) :
// code JB-<numéro d'article>, nom, catégorie, lien de la page, adresse de la photo sur leur site.
// S'y ajoutent des listes facultatives de figurines plus en vente chez JB, au même format :
// - data/jb_brickshell.tsv (outils/brickshell_jb.py) : revendues par brickshellcases.com, code JB-…
//   quand le numéro d'article est connu (sinon BSC-…), lien vers leur page brickshellcases ;
// - data/jb_archive.tsv (outils/archive_jb.py) : retrouvées dans les copies archivées du site JB
//   (web.archive.org), code JB-…, lien vers la page archivée (ou une recherche eBay.de) ;
// - data/jb_ebay.tsv (outils/ebay_jb.py) : vues sur eBay.de, code EBAY-…, lien vers une recherche
//   eBay.de ; une fois choisies, elles reçoivent un code CUS-… comme les autres customs.

const SOURCES_JB = [
  { source: "jb", fichier: "data/jb.tsv", codes: /^JB-/, obligatoire: true },
  { source: "brickshell", fichier: "data/jb_brickshell.tsv", codes: /^(JB|BSC)-/ },
  { source: "archive", fichier: "data/jb_archive.tsv", codes: /^JB-/ },
  { source: "ebay", fichier: "data/jb_ebay.tsv", codes: /^EBAY-/ },
  // blisters photographiés par des collectionneurs (base commune), absents des autres listes : code ALB-…
  { source: "album", fichier: "data/jb_album.tsv", codes: /^ALB-/ },
  // base commune : blisters photographiés dans les applis (js/base_commune.js), possédés ou non : code BC-…
  { source: "commune", fichier: "data/jb_commune.tsv", codes: /^BC-/ },
];

const CatalogueJB = {
  liste: null,
  parCode: null,
  date: null,
  nb: { jb: 0, brickshell: 0, archive: 0, ebay: 0, album: 0, commune: 0 },
  _chargement: null,

  charger() {
    if (!this._chargement) {
      // éléments écartés après vérification des images (data/jb_exclus.tsv) : pas des blisters, ou image fausse
      const exclus = fetch("data/jb_exclus.tsv").then(rep => rep.ok ? rep.text() : "").catch(() => "");
      const textes = SOURCES_JB.map(s => fetch(s.fichier)
        .then(rep => { if (rep.ok) return rep.text(); if (s.obligatoire) throw new Error("catalogue JB absent"); return ""; })
        .catch(err => { if (s.obligatoire) throw err; return ""; }));
      this._chargement = Promise.all([exclus, ...textes])
        .then(([texteExclus, ...liste]) => {
          this.exclus = new Map();
          for (const l of texteExclus.split("\n")) {
            const [code, action] = l.split("\t");
            if (code && !code.startsWith("#") && action) this.exclus.set(code.trim().toUpperCase(), action.trim());
          }
          this.liste = [];
          this.parCode = new Map();
          this.nb = { jb: 0, brickshell: 0, archive: 0, ebay: 0, album: 0, commune: 0 };
          // même figurine dans plusieurs listes (ex. vue sur eBay.de et photographiée par un collectionneur) : une
          // seule fiche, celle de la première liste ; les autres codes deviennent ses alias (photos d'album, empreintes)
          const parNom = new Map();
          SOURCES_JB.forEach(({ source, codes }, i) => {
            for (const ligne of liste[i].split("\n")) {
              if (ligne.startsWith("#date ")) { if (source === "jb") this.date = ligne.slice(6).trim(); continue; }
              const [code, nom, categorie, lien, image, prix, dispo, rattache] = ligne.split("\t");
              if (!code || !codes.test(code) || this.parCode.has(code.toUpperCase())) continue;
              const exclu = this.exclus.get(code.toUpperCase());
              if (exclu === "retirer") continue;
              const cleNom = normaliser(nomCustomPourFichier(nom || ""));
              // base commune : photo d'une figurine déjà connue (code reconnu au moment de la photo, ou même nom)
              const meme = (rattache && this.parCode.get(rattache.trim().toUpperCase())) || (source !== "jb" && cleNom && parNom.get(cleNom));
              if (meme) {
                (meme.alias = meme.alias || []).push(code);
                this.parCode.set(code.toUpperCase(), meme);
                if (!meme.image && image && exclu !== "sans_image") meme.image = image;
                continue;
              }
              // prix : prix de vente TTC relevé sur le site ; dispo « non » : épuisée chez JB (prix = dernier prix JB)
              // base commune : « NOM IMPRIMÉ – précision » ; le nom imprimé seul sert à la lecture du carton
              const coupe = source === "commune" ? decouperNomBlister(nom || "") : null;
              const f = { code, nom, nomImprime: coupe ? coupe.nom : "", precision: coupe ? coupe.precision : "", categorie, lien, image: exclu === "sans_image" ? "" : image, sansImage: exclu === "sans_image", prix: parseFloat(prix) || 0, epuisee: source === "jb" && dispo === "non", source, ebay: source === "ebay",
                          recherche: normaliser(`${code} ${nom} ${categorie}`) };
              this.liste.push(f);
              this.parCode.set(code.toUpperCase(), f);
              if (cleNom && !parNom.has(cleNom)) parNom.set(cleNom, f);
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

  // Empreintes des blisters : photos du catalogue JB (data/jb_empreintes.tsv, outils/empreintes_jb.js) et photos de
  // collectionneurs (data/jb_empreintes_album.tsv, outils/album_blisters.py) ; plusieurs empreintes possibles par blister
  empreintes: null,
  chargerEmpreintes() {
    if (!this._chargementEmpreintes) {
      const lire = f => fetch(f).then(rep => rep.ok ? rep.text() : "").catch(() => "");
      this._chargementEmpreintes = Promise.all([lire("data/jb_empreintes.tsv"), lire("data/jb_empreintes_album.tsv"), lire("data/jb_empreintes_commune.tsv"),
                                                lire("data/jb_empreintes_figurine.tsv")])
        .then(([catalogue, album, commune, figurine]) => {
          // figurine seule au centre du blister (empreinteCentreBlister) : pour départager des blisters au même carton
          this.empreintesFigurine = new Map();
          for (const ligne of figurine.split("\n")) {
            const [code, e] = ligne.split("\t");
            if (!code || code === "code" || !e) continue;
            const k = code.toUpperCase();
            if (!this.empreintesFigurine.has(k)) this.empreintesFigurine.set(k, []);
            this.empreintesFigurine.get(k).push(empreinteDepuisTexte(e));
          }
          if (!catalogue) throw new Error("empreintes JB absentes");
          this.empreintes = new Map();
          for (const ligne of (catalogue + "\n" + album + "\n" + commune).split("\n")) {
            const [code, e] = ligne.split("\t");
            if (!code || !/^(JB|ALB|BC)-/.test(code) || !e) continue;
            const k = code.toUpperCase();
            if (!this.empreintes.has(k)) this.empreintes.set(k, []);
            this.empreintes.get(k).push(empreinteDepuisTexte(e));
          }
          return this.empreintes;
        })
        .catch(err => { this._chargementEmpreintes = null; throw err; });
    }
    return this._chargementEmpreintes;
  },

  // Blisters au même carton (décor presque identique) : classés par la ressemblance de la figurine seule ;
  // renvoie [{ f, score }] pour ceux qui ont une empreinte de figurine (au moins deux, sinon rien)
  departager(source, fiches) {
    if (!this.empreintesFigurine || fiches.length < 2) return [];
    const e = empreinteCentreBlister(source);
    const res = fiches.map(f => {
      const refs = this.codes(f).flatMap(c => this.empreintesFigurine.get(c) || []);
      return refs.length ? { f, score: Math.max(...refs.map(r => similarite(e, r))) } : null;
    }).filter(Boolean);
    return res.length >= 2 ? res.sort((a, b) => b.score - a.score) : [];
  },

  // Blisters du catalogue dont le décor ressemble le plus à la photo : [{ f, score }], du plus ressemblant au moins
  classerParDecor(source, max = 10) {
    if (!this.empreintes || !this.liste) return [];
    const e = empreinteImage(source, false);
    const res = [];
    for (const f of this.liste) {
      if (f.sansImage) continue; // empreinte calculée sur une image fausse
      const refs = this.codes(f).flatMap(c => this.empreintes.get(c) || []);
      if (refs.length) res.push({ f, score: Math.max(...refs.map(ref => similarite(e, ref))) });
    }
    return res.sort((a, b) => b.score - a.score).slice(0, max);
  },

  // Code de la fiche et ses alias (même figurine dans une autre liste), en majuscules
  codes(f) { return [f.code, ...(f.alias || [])].map(c => c.toUpperCase()); },

  trouver(code) {
    return this.parCode ? this.parCode.get((code || "").toUpperCase()) || null : null;
  },

  // Figurines dont le nom ressemble au texte lu sur un blister (tolère une lettre mal lue par mot).
  // Noms de 1 ou 2 mots : tous les mots doivent être lus ; au-delà, au moins les deux tiers
  // (sinon « GOLDEN » seul sur un blister faisait trouver « Golden DJ ») ; nom d'un seul mot : lu
  // exactement (« CHROME » ne doit pas donner « Chromie »).
  rapprocher(texte, max = 6) {
    if (!this.liste) return [];
    const lus = normaliser(texte).split(/[^a-z0-9]+/).filter(m => m.length >= 2);
    if (!lus.length) return [];
    const ignores = new Set(["custom", "costum", "minifigure", "minifigur", "minifig", "designed", "the", "and", "with", "von", "spielwaren", "by", "of", "bricks", "maze", "limited", "pieces"]);
    const lusUtiles = lus.filter(m => !ignores.has(m));
    const proche = (a, b) => a === b || (b.length >= 5 && distanceTexte(a, b) <= 1);
    // mots de chaque ligne lue : un nom lu en entier sur une même ligne passe devant un nom dont les
    // mots sont épars (ex. « BLACK KRRSANTAN » devant « EX-BOUNTY / HUNTER » d'une citation)
    const lignes = texte.split("\n").map(l => normaliser(l).split(/[^a-z0-9]+/).filter(m => m.length >= 2 && !ignores.has(m))).filter(l => l.length);
    const res = [];
    for (const f of this.liste) {
      const mots = normaliser(f.nomImprime || f.nom).split(/[^a-z0-9]+/).filter(m => m.length >= 2 && !ignores.has(m) && !/^\d+$/.test(m));
      if (!mots.length || !mots.some(m => m.length >= 3)) continue;
      const lu = (m, liste) => liste.some(l => mots.length === 1 ? l === m : proche(l, m));
      const trouves = mots.filter(m => lu(m, lusUtiles)).length;
      const score = trouves / mots.length;
      if (score < (mots.length <= 2 ? 1 : 2 / 3)) continue;
      // meilleure ligne : part du nom qu'elle contient, puis part de la ligne occupée par le nom
      let ligne = 0, part = 0;
      for (const l of lignes) {
        const n = mots.filter(m => lu(m, l)).length;
        if (n / mots.length > ligne || (n / mots.length === ligne && n / l.length > part)) { ligne = n / mots.length; part = n / l.length; }
      }
      res.push({ f, score, trouves, ligne, part });
    }
    res.sort((a, b) => b.score - a.score || b.ligne - a.ligne || b.part - a.part || b.trouves - a.trouves);
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
// « SPECIAL WHATNOT FIGURE 2025 – DARK VADOR CHROME ORANGE » ou « … 2025 (DROÏDE OR) » -> nom imprimé et précision
function decouperNomBlister(nom) {
  let m = /^(.*?)\s+–\s+(.+)$/.exec(nom) || /^(.*?)\s*\(([^()]+)\)\s*$/.exec(nom);
  return m ? { nom: m[1].trim(), precision: m[2].trim() } : { nom: nom.trim(), precision: "" };
}

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
