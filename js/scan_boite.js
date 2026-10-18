// Scan du code-barres d'une boîte de set (Mathias, 18/10/2026, idée reprise d'une autre appli : « scanner en magasin ») :
// photo du code-barres -> numéro du set -> écran « Ajouter un set » déjà rempli.
// Codes-barres : data/codes_barres.tsv (outils/brickset_codes_barres.py, API Brickset, relu chaque mois). Lecture du
// code-barres par le téléphone lui-même (BarcodeDetector : Chrome sur Android ; pas Safari sur iPhone).
// Code-barres inconnu : on tape le numéro du set une fois, l'appli le retient pour ce code-barres (dans le téléphone).

const ScanBoite = {
  codes: null,        // Map code-barres (chiffres, sans les 0 de tête) -> code du set (« 75192-1 »)
  _chargement: null,
  enAttente: null,    // code-barres lu mais inconnu : retenu avec le set choisi ensuite

  cle(chiffres) { return String(chiffres || "").replace(/\D/g, "").replace(/^0+/, ""); }, // UPC-A = EAN-13 avec un 0 devant

  charger() {
    if (!this._chargement) {
      this._chargement = Promise.all([
        fetch("data/codes_barres.tsv").then(r => r.ok ? r.text() : "").catch(() => ""),
        Memoire.lire("codes-barres").catch(() => null),
      ]).then(([texte, appris]) => {
        this.codes = new Map();
        for (const l of texte.split("\n")) {
          const [code, ean, upc] = l.split("\t");
          if (!code || code === "code" || code.startsWith("#")) continue;
          for (const b of [ean, upc]) if (this.cle(b)) this.codes.set(this.cle(b), code);
        }
        for (const [b, code] of Object.entries(appris || {})) this.codes.set(b, code);
        return this.codes;
      });
    }
    return this._chargement;
  },

  // code-barres -> set retenu dans ce téléphone (celui qu'on a tapé à la main la première fois)
  async retenir(code) {
    const b = this.enAttente;
    this.enAttente = null;
    if (!b || !code) return;
    const appris = (await Memoire.lire("codes-barres").catch(() => null)) || {};
    appris[b] = code;
    await Memoire.ecrire(appris, "codes-barres");
    if (this.codes) this.codes.set(b, code);
    toast(`Code-barres retenu pour le set ${code} ✔`);
  },

  async lire(fichier) {
    if (!("BarcodeDetector" in window)) {
      await demander("Ce téléphone ne sait pas lire les codes-barres depuis le navigateur (c'est le cas de Safari sur iPhone). " +
        "Tapez plutôt le numéro du set, écrit en gros sur la boîte.", "Taper le numéro", "Fermer") && EcranSet.ouvrir();
      return;
    }
    $("texte-chargement").textContent = "Lecture du code-barres…";
    afficher("chargement");
    let lus = [];
    try {
      const formats = (await BarcodeDetector.getSupportedFormats()).filter(f => ["ean_13", "upc_a", "ean_8", "upc_e"].includes(f));
      const detecteur = new BarcodeDetector(formats.length ? { formats } : undefined);
      const image = await createImageBitmap(fichier);
      lus = (await detecteur.detect(image)).map(c => c.rawValue).filter(v => /^\d{8,14}$/.test(v));
    } catch (err) {
      console.warn("lecture du code-barres", err);
    }
    await this.charger();
    const trouve = lus.map(v => this.codes.get(this.cle(v))).find(Boolean);
    await EcranSet.ouvrir();
    if (trouve) {
      $("set-numero").value = trouve;
      EcranSet.chercher();
      return;
    }
    if (lus.length) {
      this.enAttente = this.cle(lus[0]);
      $("set-info").textContent = `Code-barres ${lus[0]} pas encore connu : tapez le numéro du set (écrit en gros sur la boîte), ` +
        "l'appli le retiendra pour la prochaine fois.";
    } else {
      $("set-info").textContent = "Aucun code-barres lu sur la photo : reprenez-la de plus près, bien nette et sans reflet, " +
        "ou tapez le numéro du set (écrit en gros sur la boîte).";
    }
  },
};

// le set choisi après un code-barres inconnu est retenu pour ce code-barres
const choisirSetSansScan = EcranSet.choisir;
EcranSet.choisir = async function (s, versions) {
  if (ScanBoite.enAttente && s && s.code) ScanBoite.retenir(s.code).catch(err => console.warn(err));
  return choisirSetSansScan.call(this, s, versions);
};
const ouvrirSetSansScan = EcranSet.ouvrir;
EcranSet.ouvrir = async function () { // ouvert autrement que par un scan : rien en attente
  if (!ScanBoite._ouvertureScan) ScanBoite.enAttente = null;
  return ouvrirSetSansScan.call(this);
};

for (const id of ["input-boite", "input-boite-collection"]) {
  const champ = $(id);
  if (!champ) continue;
  champ.addEventListener("change", async () => {
    const f = champ.files[0];
    champ.value = "";
    if (!f) return;
    ScanBoite._ouvertureScan = true;
    try { await ScanBoite.lire(f); } finally { ScanBoite._ouvertureScan = false; }
  });
}
