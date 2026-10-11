// Recherche tolérante dans les listes (Ma collection, base de blisters, mini-appli de l'ami), 11/10/2026 :
// Mathias cherchait « vegan barbecue luc » et la figurine s'appelle « VEGAN BBQ LUKE ». Chaque mot tapé doit se
// retrouver dans le nom, mais il suffit qu'il corresponde :
//  - tel quel, dans un mot (comme avant : « 143 », « chrom ») ;
//  - à une abréviation (barbecue / bbq, noël / christmas) ou à sa traduction anglaise (noir / black, argent / silver…) ;
//  - au même son, à la française (« luc » / « luke », « fantom » / « phantom », « kristal » / « crystal ») ;
//  - à une faute de frappe près (une lettre de travers à partir de 5 lettres ; deux à partir de 8 lettres).
const Recherche = {
  // abréviations et variantes, dans les deux sens
  EQUIVALENTS: [["barbecue", "bbq", "barbeque"], ["noel", "christmas", "xmas"], ["halloween", "hallowen"], ["zombie", "zombi"]],
  // mot français tapé -> mots anglais des noms (dans ce sens seulement : « trooper » ne ramène pas « soldier »)
  FRANCAIS: {
    noir: ["black"], blanc: ["white"], rouge: ["red"], bleu: ["blue"], vert: ["green"], jaune: ["yellow"], rose: ["pink"],
    violet: ["purple"], gris: ["grey", "gray"], marron: ["brown"], argent: ["silver"], argente: ["silver"],
    or: ["gold", "golden"], dore: ["gold", "golden"], transparent: ["clear", "trans"], pere: ["father"], roi: ["king"],
    reine: ["queen"], chevalier: ["knight"], sorcier: ["wizard"], sorciere: ["witch"], soldat: ["soldier", "trooper"],
    fantome: ["ghost"], squelette: ["skeleton"], dragon: ["dragon"], espace: ["space"], pere_noel: ["santa"],
  },
  // petits mots des noms, jamais retrouvés « à peu près » (« witch » ne doit pas ramener « with »)
  VIDES: new Set(["with", "the", "of", "and", "by", "from", "for", "custom", "minifigure", "minifigur", "figure", "a", "an", "in", "on", "de", "du", "la", "le", "les", "des"]),
  synonymes(m) {
    const eq = this.EQUIVALENTS.find(g => g.includes(m));
    return [...(eq || []), ...(this.FRANCAIS[m] || [])].filter(x => x !== m);
  },
  normaliser(t) {
    return (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  },
  // son approché : « luke » et « luc » -> « luk », « phantom » et « fantom » -> « fantom »
  son(m) {
    return m.replace(/ph/g, "f").replace(/ck|qu|q/g, "k").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k")
      .replace(/y/g, "i").replace(/h/g, "").replace(/(.)\1+/g, "$1").replace(/(.{3,})[esx]$/, "$1");
  },
  distance(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cour = [i];
      for (let j = 1; j <= b.length; j++)
        cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prec = cour;
    }
    return prec[b.length];
  },
  // un mot tapé retrouvé parmi les mots du texte ?
  _mot(m, mots, texte) {
    if (texte.includes(m)) return true; // comme avant : morceau de mot (« chrom », « 143 »)
    if (this.synonymes(m).some(s => mots.includes(s))) return true;
    if (m.length < 3 || /^\d+$/.test(m)) return false;
    const sm = this.son(m);
    for (const w of mots) {
      if (w.length < 2 || /^\d+$/.test(w) || this.VIDES.has(w)) continue;
      const sw = this.son(w);
      if (sw === sm || (sm.length >= 4 && sw.startsWith(sm))) return true; // même son, ou début du mot au même son
      const tol = m.length >= 8 ? 2 : m.length >= 5 ? 1 : 0; // faute de frappe, sur le mot tel qu'écrit
      if (tol && this.distance(m, w) <= tol) return true;
    }
    return false;
  },
  // tous les mots de la requête retrouvés dans le texte
  correspond(texte, requete) {
    const q = this.normaliser(requete).split(" ").filter(Boolean);
    if (!q.length) return true;
    const t = this.normaliser(texte), mots = t.split(" ");
    return q.every(m => this._mot(m, mots, t));
  },
};
