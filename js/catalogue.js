// Catalogue BrickLink des figurines (fichier data/figurines.tsv, une ligne par figurine :
// code, nom, catégorie, année). Sert à la recherche par nom et à reconnaître le thème.

const Catalogue = {
  liste: null,
  parCode: null,
  date: null,          // date du catalogue (AAAA-MM-JJ)
  _chargement: null,

  // Priorité au catalogue mis à jour depuis le téléphone ; sinon celui livré avec l'appli
  charger() {
    if (!this._chargement) {
      this._chargement = (async () => {
        const perso = await Memoire.lire("catalogue");
        let texte = perso && perso.texte;
        if (!texte) {
          const rep = await fetch("data/figurines.tsv");
          if (!rep.ok) throw new Error("catalogue absent");
          texte = await rep.text();
        }
        this._lire(texte);
        return this.liste;
      })().catch(err => { this._chargement = null; throw err; });
    }
    return this._chargement;
  },

  _lire(texte) {
    this.liste = [];
    this.parCode = new Map();
    this.date = null;
    for (const ligne of texte.split("\n")) {
      if (ligne.startsWith("#date ")) { this.date = ligne.slice(6).trim(); continue; }
      const [code, nom, categorie, annee] = ligne.replace(/\r$/, "").split("\t");
      if (!code || code === "code" || code.startsWith("#")) continue;
      const f = { code: code.toUpperCase(), nom: nom || "", categorie: categorie || "", annee: annee || "" };
      f.recherche = normaliser(`${f.code} ${f.nom} ${f.categorie}`);
      this.liste.push(f);
      this.parCode.set(f.code, f);
    }
  },

  // Rappel à partir du 2 du mois si le catalogue date d'un mois précédent (ou s'il n'y en a pas)
  aMettreAJour(aujourdhui = new Date()) {
    if (aujourdhui.getDate() < 2) return false;
    if (!this.date) return true;
    const mois = aujourdhui.getFullYear() * 12 + aujourdhui.getMonth();
    const [a, m] = this.date.split("-").map(Number);
    return a * 12 + (m - 1) < mois;
  },

  // Transforme le fichier téléchargé sur BrickLink (Minifigures.txt, séparé par des tabulations)
  // en catalogue de l'appli, le garde dans le téléphone et le recharge. Renvoie le nombre de figurines.
  async installer(brut) {
    const texte = convertirCatalogueBrickLink(brut, new Date().toISOString().slice(0, 10));
    const n = texte.split("\n").length - 2;
    if (n < 100) throw new Error(`seulement ${Math.max(0, n)} figurines trouvées dans ce fichier`);
    await Memoire.ecrire({ texte, date: new Date().toISOString() }, "catalogue");
    this._chargement = null;
    await this.charger();
    return this.liste.length;
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
// ex. « Star Wars / Star Wars Episode 4/5/6 », « Town / City », « Super Heroes / Batman II ».
// Les séries à collectionner sous licence (« Collectible Minifigures / The Simpsons / ... »)
// vont dans l'onglet de leur thème ; les autres séries dans « Minifigs à collectionner ».
function themeDeCategorie(categorie) {
  const c = normaliser(categorie);
  if (!c) return null;
  const serie = /^collectible minifigures/.test(c);
  const reste = c.replace(/^collectible minifigures( \/ )?/, "");
  const regles = [
    [/^star wars/, "Star Wars"],
    [/simpsons/, "Simpsons"],
    [/lord of the rings|hobbit/, "Seigneur des Anneaux"],
    [/harry potter|fantastic beasts/, "Harry Potter"],
    [/super heroes|marvel|dc comics|batman|spider-man/, "Super-héros"],
    [/ninjago/, "Ninjago"],
    [/jurassic/, "Jurassic World"],
    [/^disney/, "Disney"],
    [/^town|^city/, "Town & City"],
  ];
  const r = regles.find(([re]) => re.test(reste));
  if (r) return r[1];
  return serie ? "Minifigs à collectionner" : null;
}

// Fichier BrickLink -> « code, nom, catégorie, année » (une figurine par ligne)
function convertirCatalogueBrickLink(brut, date) {
  const decodeur = document.createElement("textarea");
  const decoder = t => { decodeur.innerHTML = t; return decodeur.value; };
  const lignes = brut.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
  if (!lignes.length) throw new Error("fichier vide");
  const entete = lignes[0].split("\t").map(t => t.trim().toLowerCase());
  const col = re => entete.findIndex(t => re.test(t));
  let iCode = col(/^(number|item ?no\.?|item number)$/), iNom = col(/^(name|item ?name)$/),
      iCat = col(/^category ?name$/), iAnnee = col(/year/), debut = 1;
  if (iCode < 0 || iNom < 0) { // pas d'en-tête reconnu : ordre habituel de BrickLink
    [iCat, iCode, iNom, iAnnee, debut] = [1, 2, 3, 4, 0];
  }
  const sortie = [`#date ${date}`, "code\tnom\tcategorie\tannee"];
  for (let i = debut; i < lignes.length; i++) {
    const c = lignes[i].split("\t");
    const code = (c[iCode] || "").trim();
    if (!/^[A-Za-z0-9]+(-\d+)?$/.test(code)) continue;
    const nettoyer = t => decoder(t || "").replace(/[\t\r\n]+/g, " ").trim();
    const annee = iAnnee >= 0 && /^\d{4}$/.test((c[iAnnee] || "").trim()) ? c[iAnnee].trim() : "";
    sortie.push([code, nettoyer(c[iNom]), iCat >= 0 ? nettoyer(c[iCat]) : "", annee].join("\t"));
  }
  return sortie.join("\n");
}
