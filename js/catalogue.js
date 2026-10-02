// Catalogue BrickLink des figurines (fichier data/figurines.tsv, une ligne par figurine :
// code, nom, catégorie, année). Sert à la recherche par nom et à reconnaître le thème.

const Catalogue = {
  liste: null,
  parCode: null,
  date: null,          // date du catalogue (AAAA-MM-JJ)
  _chargement: null,

  // Le plus récent entre le catalogue de l'appli (data/figurines.tsv, complété chaque mois par l'API BrickLink :
  // catalogue_bricklink.py du dépôt privé) et celui importé à la main dans le téléphone
  charger() {
    if (!this._chargement) {
      this._chargement = (async () => {
        const perso = await Memoire.lire("catalogue");
        let texte = null;
        try { const rep = await fetch("data/figurines.tsv"); if (rep.ok) texte = await rep.text(); } catch (err) { console.warn(err); }
        const dateDe = t => ((/^#date (\S+)/m.exec(t || "") || [])[1] || "");
        if (perso && perso.texte && (!texte || dateDe(perso.texte) > dateDe(texte))) texte = perso.texte;
        if (!texte) throw new Error("catalogue absent");
        this._lire(texte);
        if (typeof Nouveautes !== "undefined") this._ajouterNouveautes(await Nouveautes.charger());
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

  // Catalogue mis à jour tout seul chaque mois : rappel seulement s'il a plus de deux mois (mise à jour en panne)
  aMettreAJour(aujourdhui = new Date()) {
    if (!this.date) return true;
    const mois = aujourdhui.getFullYear() * 12 + aujourdhui.getMonth();
    const [a, m] = this.date.split("-").map(Number);
    return a * 12 + (m - 1) < mois - 2;
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

  // Nouvelles figurines (Rebrickable) absentes du catalogue BrickLink de l'appli : ajoutées pour la recherche,
  // sous leur code BrickLink s'il est déjà connu, sinon sous leur code Rebrickable (FIG-…)
  _ajouterNouveautes(liste) {
    for (const n of liste) {
      if (n.type !== "figurine") continue;
      const code = Nouveautes.codeAppli(n);
      if (this.parCode.has(code)) continue;
      const f = { code, nom: n.nom, categorie: n.theme, annee: n.annee, image: n.image, nouveaute: true };
      f.recherche = normaliser(`${f.code} ${f.nom} ${f.categorie}`);
      this.liste.push(f);
      this.parCode.set(code, f);
    }
  },

  trouver(code) {
    return this.parCode ? this.parCode.get((code || "").toUpperCase()) || null : null;
  },

  // Tous les mots tapés doivent se retrouver dans le code, le nom ou la catégorie
  // Variantes d'une figurine : mêmes éléments visibles, seule la tête change (couleur de peau, homme ou
  // femme, expression du visage) ; sous un casque, une photo ne peut pas les distinguer.
  // « Snowtrooper - Female, Printed Legs, Dark Tan Hands, Light Nougat Head, Angry Smile » et
  // « Snowtrooper, Printed Legs, Dark Tan Hands, Cheek Lines, Lopsided Grin » : même personnage.
  variantes(code) {
    if (!this.liste) return [];
    if (!this._groupes) {
      this._groupes = new Map();
      for (const f of this.liste) {
        const cle = cleVariante(f);
        if (!this._groupes.has(cle)) this._groupes.set(cle, []);
        this._groupes.get(cle).push(f);
      }
    }
    const f = this.trouver(code);
    const groupe = f ? this._groupes.get(cleVariante(f)) || [] : [];
    return groupe.length > 1 ? groupe.slice().sort((a, b) => (b.annee || "").localeCompare(a.annee || "") || a.code.localeCompare(b.code)) : [];
  },

  // Séries récentes (catégories BrickLink dont une figurine date de cette année ou de l'an dernier),
  // les plus récentes d'abord : [{ categorie, annee, n }]. Utile quand la reconnaissance par photo
  // (Brickognize) ne connaît pas encore une nouvelle série (ex. minifigures Shrek).
  seriesRecentes(max = 30) {
    if (!this.liste) return [];
    const depuis = String(new Date().getFullYear() - 1), series = new Map();
    for (const f of this.liste) {
      if (!f.categorie || (f.annee || "") < depuis) continue;
      const s = series.get(f.categorie) || { categorie: f.categorie, annee: "", n: 0 };
      s.n++; if (f.annee > s.annee) s.annee = f.annee;
      series.set(f.categorie, s);
    }
    const collection = c => /^Collectible Minifigures/i.test(c) ? 1 : 0; // minifigs à collectionner d'abord
    return [...series.values()].sort((a, b) => b.annee.localeCompare(a.annee) || collection(b.categorie) - collection(a.categorie) || b.n - a.n).slice(0, max);
  },

  // Figurines récentes (cette année et l'an dernier) d'une catégorie : les plus récentes d'abord,
  // puis dans l'ordre des codes (ordre de la série)
  parCategorie(categorie) {
    const depuis = String(new Date().getFullYear() - 1);
    return this.liste ? this.liste.filter(f => f.categorie === categorie && (f.annee || "") >= depuis)
      .sort((a, b) => b.annee.localeCompare(a.annee) || a.code.localeCompare(b.code, "en", { numeric: true })) : [];
  },

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

// Nom d'une figurine sans ce qui touche à la tête (« Light Nougat Head », « Female », « Angry Smile »…),
// précédé de la racine de sa catégorie : même clé = variantes qui ne diffèrent que par la tête
const MOTS_TETE = /head|face|smile|frown|grin|grimace|smirk|scowl|\bfemale\b|\bmale\b|cheek|eyebrow|freckle|stubble|mouth|angry|scared|teeth|wink|lopsided|beard|goatee|moustache|mustache|sneer|determined|worried|pupils|eyelashes|lips|crooked|raised/i;
function cleVariante(f) {
  const morceaux = f.nom.split(/,| - |\//).map(m => m.trim().toLowerCase()).filter(m => m && !MOTS_TETE.test(m));
  return `${(f.categorie || "").split(" / ")[0].toLowerCase()}#${morceaux.join("|")}`;
}

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
