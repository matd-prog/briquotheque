// Catalogue BrickLink des figurines (fichier data/figurines.tsv, une ligne par figurine :
// code, nom, catégorie, année). Sert à la recherche par nom et à reconnaître le thème.

const Catalogue = {
  liste: null,
  parCode: null,
  _chargement: null,

  charger() {
    if (!this._chargement) {
      this._chargement = fetch("data/figurines.tsv")
        .then(rep => { if (!rep.ok) throw new Error("catalogue absent"); return rep.text(); })
        .then(texte => {
          this.liste = [];
          this.parCode = new Map();
          for (const ligne of texte.split("\n")) {
            const [code, nom, categorie, annee] = ligne.replace(/\r$/, "").split("\t");
            if (!code || code === "code") continue;
            const f = { code: code.toUpperCase(), nom: nom || "", categorie: categorie || "", annee: annee || "" };
            f.recherche = normaliser(`${f.code} ${f.nom} ${f.categorie}`);
            this.liste.push(f);
            this.parCode.set(f.code, f);
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

  // Tous les mots tapés doivent se retrouver dans le code, le nom ou la catégorie
  chercher(texte, max = 40) {
    if (!this.liste) return [];
    const mots = normaliser(texte).split(" ").filter(Boolean);
    if (!mots.length) return [];
    const code = texte.trim().toUpperCase();
    const res = [];
    for (const f of this.liste) {
      if (mots.every(m => f.recherche.includes(m))) res.push(f);
    }
    res.sort((a, b) => (b.code === code) - (a.code === code) || (b.annee || "").localeCompare(a.annee || "") || a.nom.length - b.nom.length);
    return res.slice(0, max);
  },
};

// Thème (Star Wars ou onglet de thème) d'après une catégorie BrickLink ou Brickognize,
// ex. « Star Wars / Star Wars Episode 4/5/6 », « The Simpsons », « Super Heroes / Batman »
function themeDeCategorie(categorie) {
  const c = normaliser(categorie);
  if (!c) return null;
  const regles = [
    [/^star wars/, "Star Wars"],
    [/^collectible minifigures/, "Minifigs à collectionner"],
    [/simpsons/, "Simpsons"],
    [/lord of the rings|hobbit/, "Seigneur des Anneaux"],
    [/harry potter|fantastic beasts/, "Harry Potter"],
    [/super heroes|marvel|dc comics|batman/, "Super-héros"],
    [/ninjago/, "Ninjago"],
    [/jurassic/, "Jurassic World"],
    [/disney/, "Disney"],
    [/^town|^city/, "City"],
  ];
  const r = regles.find(([re]) => re.test(c));
  return r ? r[1] : null;
}
