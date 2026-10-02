// Base de données de la collection, dans l'appli (sans fichier Excel) : version à diffuser.
// Rangement : IndexedDB du navigateur (base « figotheque », un enregistrement par figurine, set, objet, souhait…),
// lu en entier au démarrage et écrit à chaque modification (pas de bouton « Enregistrer »). Une sauvegarde
// (.json) et des exports (Excel, PDF…) se font depuis « 📤 Exporter » ; js/exports.js.
//
// Tables :
//  - « Figurines » : { id, onglet, code, nom, lien, camp, ajoute } (onglet = Gentils (vert), Simpsons, Customs…)
//  - les tableaux (Sets, Objets dérivés, Souhaits, Customs achetées, Valeurs déclarées, À vendre) :
//    { id, champs: { <titre de colonne>: valeur } } avec les mêmes colonnes que les onglets Excel (COLONNES_…).
//
// Pour que tout le reste de l'appli marche sans changement, la base répond aux mêmes appels que le classeur Excel
// (js/xlsx.js) : valeur(onglet, "B5"), ecrireTexte(…), derniereLigne(…), lignes(…) pour les tableaux (ligne = id + 1,
// la ligne 1 étant celle des titres) ; les fonctions de figurines (lireCollection, ajouterFigurine…) passent par
// les méthodes « fig… » ci-dessous (voir le début de ces fonctions dans js/xlsx.js).

const TABLES_BASE = {
  [ONGLET_SETS]: COLONNES_SETS, [ONGLET_OBJETS]: COLONNES_OBJETS, [ONGLET_SOUHAITS]: COLONNES_SOUHAITS,
  [ONGLET_CUSTOMS_ACHETEES]: COLONNES_CUSTOMS_ACHETEES, [ONGLET_VALEURS_DECLAREES]: COLONNES_VALEURS_DECLAREES,
  [ONGLET_A_VENDRE]: COLONNES_A_VENDRE,
};
const TABLE_FIGURINES = "Figurines";
const TAILLE_ETIQUETTE_BASE = { w: 96, h: 56 }; // aperçu « planche » (pixels) ; l'impression a son propre format

class BaseCollection {
  constructor() { this.estBase = true; this.tables = new Map(); this._file = Promise.resolve(); }

  static _db() {
    return new Promise((ok, ko) => {
      const r = indexedDB.open("figotheque", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("enregistrements", { keyPath: "cle" });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  }

  static async ouvrir() {
    const b = new BaseCollection();
    const db = await BaseCollection._db();
    const tout = await new Promise((ok, ko) => {
      const r = db.transaction("enregistrements").objectStore("enregistrements").getAll();
      r.onsuccess = () => ok(r.result || []); r.onerror = () => ko(r.error);
    });
    db.close();
    for (const e of tout) b._table(e.table).set(e.id, e);
    // un seul onglet Star Wars (pas de camps) : figurines rangées par camp avant ce choix, regroupées
    const anciennes = [...b._table(TABLE_FIGURINES).values()].filter(f => ONGLETS_COLORES.includes(f.onglet));
    for (const f of anciennes) b._poser(TABLE_FIGURINES, f.id, { ...f, onglet: THEME_STAR_WARS_UNIQUE.onglet });
    return b;
  }

  _table(nom) { if (!this.tables.has(nom)) this.tables.set(nom, new Map()); return this.tables.get(nom); }

  // Écritures dans IndexedDB, dans l'ordre (la mémoire de l'appli est à jour tout de suite)
  _persister(ecrire, supprimer) {
    this._file = this._file.then(async () => {
      const db = await BaseCollection._db();
      await new Promise((ok, ko) => {
        const tx = db.transaction("enregistrements", "readwrite"), st = tx.objectStore("enregistrements");
        (ecrire || []).forEach(e => st.put(e));
        (supprimer || []).forEach(c => st.delete(c));
        tx.oncomplete = ok; tx.onerror = () => ko(tx.error);
      });
      db.close();
    }).catch(err => { console.error(err); toast("⚠️ Écriture dans la base impossible : " + err.message, 6000); });
    return this._file;
  }
  attendre() { return this._file; }

  _poser(table, id, e) {
    const rec = { ...e, cle: `${table}|${id}`, table, id };
    this._table(table).set(id, rec);
    this._persister([rec]);
    return rec;
  }
  _enlever(table, id) {
    if (!this._table(table).delete(id)) return;
    this._persister(null, [`${table}|${id}`]);
  }
  _prochainId(table) { return Math.max(0, ...this._table(table).keys()) + 1; }

  // ----- tableaux, adressés comme dans Excel (ligne 1 = titres) -----

  _colonnes(nom) { return TABLES_BASE[nom] || null; }
  _titre(nom, lettre) { const c = (this._colonnes(nom) || []).find(c => c[0] === lettre); return c ? c[1] : lettre; }

  aOnglet(nom) {
    if (nom === THEME_STAR_WARS_UNIQUE.onglet || nom === ONGLET_TABLE) return true;
    if (ONGLETS_COLORES.includes(nom)) return false;
    if (this._colonnes(nom)) return this._table(nom).size > 0 || this._table("_onglets").has(nom);
    return [...this._table(TABLE_FIGURINES).values()].some(f => f.onglet === nom) || this._table("_onglets").has(nom);
  }
  feuille(nom) { return { nom }; }
  get feuilles() {
    return [THEME_STAR_WARS_UNIQUE.onglet, ONGLET_TABLE, ...ONGLETS_THEMES, ...Object.keys(TABLES_BASE)].filter(o => this.aOnglet(o)).map(nom => ({ nom }));
  }

  async valeur(nom, ref) {
    const { col, row } = decouperRef(ref), lettre = lettreColonne(col);
    if (row === 1) return this._colonnes(nom) && this.aOnglet(nom) ? this._titre(nom, lettre) : "";
    const e = this._table(nom).get(row - 1);
    return e ? String(e.champs[this._titre(nom, lettre)] ?? "").trim() : "";
  }

  async ecrireTexte(nom, ref, texte) {
    const { col, row } = decouperRef(ref);
    if (!this._colonnes(nom)) throw new Error(`Modification interdite de « ${nom} » dans la base.`);
    if (row === 1) return;
    const id = row - 1, titre = this._titre(nom, lettreColonne(col));
    const e = this._table(nom).get(id) || { champs: {} };
    const champs = { ...e.champs };
    if (texte === "" || texte == null) delete champs[titre]; else champs[titre] = String(texte);
    if (!Object.keys(champs).length) return this._enlever(nom, id);
    this._poser(nom, id, { champs });
  }
  async viderCellule(nom, ref) { return this.ecrireTexte(nom, ref, ""); }

  async derniereLigne(nom) {
    if (nom === ONGLET_TABLE) return 1;
    if (!this.aOnglet(nom)) return 0;
    return 1 + Math.max(0, ...this._table(nom).keys());
  }

  async lignes(nom) {
    const cols = this._colonnes(nom) || [];
    const res = this.aOnglet(nom) ? [{ row: 1, cellules: Object.fromEntries(cols.map(([l, t]) => [l, t])) }] : [];
    for (const [id, e] of [...this._table(nom).entries()].sort((a, b) => a[0] - b[0])) {
      const cellules = {};
      for (const [l, t] of cols) if (e.champs[t] != null && String(e.champs[t]).trim()) cellules[l] = String(e.champs[t]).trim();
      if (Object.keys(cellules).length) res.push({ row: id + 1, cellules });
    }
    return res;
  }

  async creerOngletSets(nom = ONGLET_SETS) { if (!this.aOnglet(nom)) this._poser("_onglets", nom, {}); }
  async creerOnglet(nom) { if (!this.aOnglet(nom)) this._poser("_onglets", nom, {}); }
  async styleColonne() { return null; }
  async enregistrer() { await this.attendre(); return null; }

  // ----- figurines -----

  _figs(onglet) {
    return [...this._table(TABLE_FIGURINES).values()].filter(f => !onglet || f.onglet === onglet).sort((a, b) => a.id - b.id);
  }

  figLireCollection() {
    const res = {};
    for (const nom of [THEME_STAR_WARS_UNIQUE.onglet, ...ONGLETS_THEMES.filter(o => this.aOnglet(o))]) {
      const cases = this._figs(nom).map(f => ({ row: f.id, col: 1, ref: `n°${f.id}`, code: f.code, nom: f.nom || "", lien: f.lien || "", image: true }));
      res[nom] = { derniere: cases.length, cases };
    }
    return res;
  }

  figLireTable() {
    return this._figs().map(f => ({ row: f.id, code: f.code, personnage: f.nom || "", camp: f.camp || f.onglet, statut: "Confirmé", origine: `${f.onglet}!n°${f.id}` }));
  }

  figAjouter({ code, nom, camp, theme, lien }) {
    const onglet = camp ? THEME_STAR_WARS_UNIQUE.onglet : theme; // un seul onglet Star Wars, sans camps
    const id = this._prochainId(TABLE_FIGURINES);
    this._poser(TABLE_FIGURINES, id, { onglet, code, nom: nom || "", lien: lien || "", camp: "", ajoute: new Date().toLocaleDateString("fr-FR") });
    return { onglet, ref: `n°${id}`, row: id, col: 1, nouvelleLigne: false };
  }

  figRetirer(row) { this._enlever(TABLE_FIGURINES, row); }
  figRenommer(row, nom) { const f = this._table(TABLE_FIGURINES).get(row); if (f) this._poser(TABLE_FIGURINES, row, { ...f, nom }); }

  // Étiquettes dessinées à la demande (vue « planche » de Ma collection)
  async imagesEtiquettes(onglet) {
    const res = new Map(), { w, h } = TAILLE_ETIQUETTE_BASE;
    for (const f of this._figs(onglet).filter(f => !codeInvalide(f.code))) {
      const cv = dessinerEtiquette(f.code, couleurOnglet(onglet) || "#fff", w, h, lienEtiquette(onglet, f.lien));
      res.set(`${f.id}:1`, await new Promise(ok => cv.toBlob(ok, "image/png")));
    }
    return res;
  }
  async positionsImages(onglet) { return new Set(this._figs(onglet).map(f => `${f.id}:1`)); }
  async supprimerImages() {}
  async ajouterImage() {}

  // ----- sauvegarde, reprise -----

  async exporter() { return [...this.tables.values()].flatMap(t => [...t.values()]).map(({ cle, ...e }) => e); }

  async remplacerTout(enregistrements) {
    const anciens = [...this.tables].flatMap(([t, m]) => [...m.keys()].map(id => `${t}|${id}`));
    this.tables = new Map();
    const nouveaux = enregistrements.map(e => ({ ...e, cle: `${e.table}|${e.id}` }));
    for (const e of nouveaux) this._table(e.table).set(e.id, e);
    await this._persister(null, anciens);
    await this._persister(nouveaux);
  }

  // Reprend un fichier Excel de l'appli (onglets d'étiquettes, Sets, Objets, Souhaits…) : remplace le contenu
  static async depuisExcel(octets, progression) {
    const cl = await Classeur.ouvrir(octets);
    const e = [], jour = new Date().toLocaleDateString("fr-FR");
    let id = 0;
    const camps = Object.fromEntries(Object.entries(CAMPS).map(([camp, c]) => [c.onglet, camp]));
    const collection = await lireCollection(cl);
    for (const onglet of Object.keys(collection)) {
      for (const c of collection[onglet].cases.filter(c => c.code))
        e.push({ table: TABLE_FIGURINES, id: ++id, onglet: camps[onglet] ? THEME_STAR_WARS_UNIQUE.onglet : onglet, code: c.code, nom: c.nom || "", lien: c.lien || "", camp: camps[onglet] || "", ajoute: jour });
      if (progression) progression(onglet);
    }
    for (const [nom, cols] of Object.entries(TABLES_BASE)) {
      if (!cl.aOnglet(nom)) continue;
      for (const { row, cellules } of await cl.lignes(nom)) {
        if (row === 1) continue;
        const champs = {};
        for (const [l, t] of cols) if (cellules[l]) champs[t] = cellules[l];
        if (Object.keys(champs).length) e.push({ table: nom, id: row - 1, champs });
      }
      e.push({ table: "_onglets", id: nom });
    }
    return e;
  }
}
