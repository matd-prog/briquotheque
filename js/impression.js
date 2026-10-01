// Impression d'étiquettes à la taille choisie (planche A4 d'étiquettes autocollantes, ou rouleau d'imprimante
// d'étiquettes). Indépendant du fichier Excel : chaque utilisateur règle la taille de ses étiquettes, ses marges et
// le contenu (QR code, code, nom, couleur du thème). Le réglage est gardé dans le téléphone (Memoire
// « format_etiquettes ») ; avec un fichier Excel, le modèle « Comme mon fichier Excel » reprend la taille des cases.
// Les étiquettes imprimées sont retenues (Memoire « etiquettes_imprimees ») pour n'imprimer ensuite que les nouvelles.

const MM_EN_PX = 96 / 25.4;
const PAGES = { A4: [210, 297], Lettre: [215.9, 279.4] };

// Modèles courants. Planches : marges et espaces relevés sur les fiches des fabricants ; une impression d'essai sur
// papier ordinaire, posée sur la planche à contre-jour, permet de vérifier avant de gâcher une planche.
const MODELES_ETIQUETTES = [
  { id: "avery-l7651", nom: "Avery L7651 / J8651 : 38,1 × 21,2 mm, 65 par page", page: "A4", l: 38.1, h: 21.2, mh: 10.7, mg: 4.7, eh: 2.5, ev: 0 },
  { id: "avery-l4732", nom: "Avery L4732 : 35,6 × 16,9 mm, 80 par page", page: "A4", l: 35.6, h: 16.9, mh: 13.3, mg: 11, eh: 2.5, ev: 0 },
  { id: "avery-l7159", nom: "Avery L7159 / J8159 : 63,5 × 33,9 mm, 24 par page", page: "A4", l: 63.5, h: 33.9, mh: 12.9, mg: 6.5, eh: 2.5, ev: 0 },
  { id: "avery-l7160", nom: "Avery L7160 / J8160 : 63,5 × 38,1 mm, 21 par page", page: "A4", l: 63.5, h: 38.1, mh: 15.15, mg: 7.2, eh: 2.5, ev: 0 },
  { id: "avery-l7163", nom: "Avery L7163 / J8163 : 99,1 × 38,1 mm, 14 par page", page: "A4", l: 99.1, h: 38.1, mh: 15.15, mg: 4.7, eh: 2.5, ev: 0 },
  { id: "brother-dk11204", nom: "Rouleau Brother DK-11204 : 54 × 17 mm", page: "rouleau", l: 54, h: 17 },
  { id: "brother-dk11209", nom: "Rouleau Brother DK-11209 : 62 × 29 mm", page: "rouleau", l: 62, h: 29 },
  { id: "dymo-11355", nom: "Rouleau Dymo 11355 : 51 × 19 mm", page: "rouleau", l: 51, h: 19 },
  { id: "dymo-11352", nom: "Rouleau Dymo 11352 : 54 × 25 mm", page: "rouleau", l: 54, h: 25 },
  { id: "libre-a4", nom: "Papier A4 ordinaire (à découper) : 40 × 20 mm", page: "A4", l: 40, h: 20, mh: 10, mg: 10, eh: 2, ev: 2 },
];

const Impression = {
  format: null,      // { modele, page, l, h, mh, mg, eh, ev, qr, nom, couleur, traits }
  choix: new Set(),  // sources cochées : nom d'onglet, « Sets », « Objets dérivés »
  imprimees: new Set(),
  _articles: [],

  async ouvrir() {
    afficher("impression");
    $("imp-feuilles").innerHTML = "";
    const f = await Memoire.lire("format_etiquettes");
    this.imprimees = new Set((await Memoire.lire("etiquettes_imprimees")) || []);
    this._excel = await this._formatExcel();
    this.format = f || this._depuisModele(this._excel || MODELES_ETIQUETTES[0]);
    await this._chargerArticles();
    if (!this.choix.size) this._sources().forEach(s => this.choix.add(s.nom));
    this._remplirFormulaire();
    this.majCompte();
  },

  // Taille des cases du fichier Excel (cases d'étiquettes A à E de la première planche)
  async _formatExcel() {
    if (!etat.classeur || etat.classeur.estBase || typeof dimensionsCase !== "function") return null;
    try {
      const onglet = ongletsEtiquettes(etat.classeur).find(o => etat.classeur.aOnglet(o));
      const { w, h } = await dimensionsCase(etat.classeur, onglet, 1, 1, 0);
      if (!(w > 10 && h > 10)) return null;
      const l = Math.round(w / MM_EN_PX * 10) / 10, hh = Math.round(h / MM_EN_PX * 10) / 10;
      return { id: "excel", nom: `Comme mon fichier Excel : ${String(l).replace(".", ",")} × ${String(hh).replace(".", ",")} mm`, page: "A4", l, h: hh, mh: 10, mg: 10, eh: 0, ev: 0 };
    } catch (err) { console.warn(err); return null; }
  },

  _depuisModele(m) {
    return { modele: m.id, page: m.page, l: m.l, h: m.h, mh: m.mh ?? 10, mg: m.mg ?? 10, eh: m.eh ?? 2, ev: m.ev ?? 2,
             qr: true, nom: false, couleur: true, traits: m.page !== "rouleau" && !/^avery/.test(m.id) };
  },

  _modeles() { return [...(this._excel ? [this._excel] : []), ...MODELES_ETIQUETTES]; },

  // Étiquettes possibles : figurines (onglets de thèmes et customs), sets, objets dérivés
  async _chargerArticles() {
    const res = [];
    for (const [onglet, o] of Object.entries(etat.collection || {}))
      for (const c of o.cases.filter(c => c.code && !codeInvalide(c.code)))
        res.push({ source: onglet, cle: `${onglet}|${c.ref}|${c.code}`, code: c.code, nom: c.nom || "", couleur: couleurOnglet(onglet) || "#fff",
                   lien: lienEtiquette(onglet, c.lien) === undefined ? urlBricklink(c.code) : lienEtiquette(onglet, c.lien) });
    try {
      for (const s of await lireSets(etat.classeur)) {
        const code = /-\d+$/.test(s.code) ? s.code : s.code + "-1";
        for (let k = 0; k < (s.quantite || 1); k++)
          res.push({ source: ONGLET_SETS, cle: `${ONGLET_SETS}|${s.row}|${s.code}|${k}`, code: s.code, nom: s.nom || "", couleur: "#ffd500", lien: urlBricklinkSet(code) });
      }
    } catch (err) { console.warn(err); }
    try {
      for (const o of await lireObjets(etat.classeur)) {
        const code = String(o.code || "").trim();
        if (!code) continue;
        for (let k = 0; k < (o.quantite || 1); k++)
          res.push({ source: ONGLET_OBJETS, cle: `${ONGLET_OBJETS}|${o.row}|${code}|${k}`, code, nom: o.nom || "", couleur: "#d9d9d6",
                     lien: `https://www.bricklink.com/v2/catalog/catalogitem.page?G=${encodeURIComponent(code)}` });
      }
    } catch (err) { console.warn(err); }
    this._articles = res;
  },

  _sources() {
    const n = new Map();
    for (const a of this._articles) n.set(a.source, (n.get(a.source) || 0) + 1);
    return [...n.entries()].map(([nom, nb]) => ({ nom, nb }));
  },

  _selection() {
    const nouvelles = $("imp-nouvelles").checked;
    return this._articles.filter(a => this.choix.has(a.source) && !(nouvelles && this.imprimees.has(a.cle)));
  },

  _remplirFormulaire() {
    const f = this.format;
    $("imp-sources").innerHTML = this._sources().map(s => `<button class="puce ${this.choix.has(s.nom) ? "choisi" : ""}" data-imp-source="${echapper(s.nom)}">
      <span class="pastille" style="background:${couleurOnglet(s.nom) || (s.nom === ONGLET_SETS ? "#ffd500" : "#d9d9d6")}"></span>${echapper(s.nom)} (${s.nb})</button>`).join("")
      || `<p class="aide">Aucune figurine, aucun set ni objet dans votre collection pour l'instant.</p>`;
    $("imp-modele").innerHTML = this._modeles().map(m => `<option value="${m.id}" ${m.id === f.modele ? "selected" : ""}>${echapper(m.nom)}</option>`).join("") +
      `<option value="perso" ${f.modele === "perso" ? "selected" : ""}>Format personnalisé (vos mesures)</option>`;
    $("imp-page").value = f.page;
    for (const k of ["l", "h", "mh", "mg", "eh", "ev"]) $("imp-" + k).value = String(f[k] ?? 0);
    for (const k of ["qr", "nom", "couleur", "traits"]) $("imp-" + k).checked = !!f[k];
    this._majPlanche();
  },

  // Colonnes et lignes par page, d'après la taille des étiquettes, les marges (symétriques) et les espaces
  _grille(f = this.format) {
    if (f.page === "rouleau") return { cols: 1, lignes: 1 };
    const [pw, ph] = PAGES[f.page] || PAGES.A4;
    const cols = Math.max(1, Math.floor((pw - 2 * f.mg + f.eh + 0.05) / (f.l + f.eh)));
    const lignes = Math.max(1, Math.floor((ph - 2 * f.mh + f.ev + 0.05) / (f.h + f.ev)));
    return { cols, lignes };
  },

  _majPlanche() {
    const f = this.format, { cols, lignes } = this._grille();
    const rouleau = f.page === "rouleau";
    $("imp-marges").hidden = rouleau;
    $("imp-depart-bloc").hidden = rouleau;
    $("imp-planche").textContent = rouleau ? `Rouleau : une étiquette de ${this._mm(f.l)} × ${this._mm(f.h)} mm par page.`
      : `${cols} × ${lignes} = ${cols * lignes} étiquettes par page (${this._mm(f.l)} × ${this._mm(f.h)} mm).`;
  },

  _mm(x) { return String(Math.round(x * 100) / 100).replace(".", ","); },

  _lireFormulaire(champ) {
    const f = this.format, nombre = id => Math.max(0, parseFloat(String($(id).value).replace(",", ".")) || 0);
    if (champ === "imp-modele") {
      const id = $("imp-modele").value;
      const m = this._modeles().find(m => m.id === id);
      if (m) { const garde = { qr: f.qr, nom: f.nom, couleur: f.couleur }; this.format = { ...this._depuisModele(m), ...garde }; this._remplirFormulaire(); }
      else f.modele = "perso";
    } else {
      f.page = $("imp-page").value;
      for (const k of ["l", "h", "mh", "mg", "eh", "ev"]) f[k] = nombre("imp-" + k);
      f.l = Math.max(10, f.l); f.h = Math.max(8, f.h);
      for (const k of ["qr", "nom", "couleur", "traits"]) f[k] = $("imp-" + k).checked;
      if (/^imp-(page|l|h|mh|mg|eh|ev)$/.test(champ)) { f.modele = "perso"; $("imp-modele").value = "perso"; }
    }
    this._majPlanche();
    Memoire.ecrire(this.format, "format_etiquettes");
  },

  majCompte() {
    const n = this._selection().length, deja = this._articles.filter(a => this.choix.has(a.source) && this.imprimees.has(a.cle)).length;
    $("imp-compte").textContent = `${n} étiquette(s) à imprimer` + (deja && !$("imp-nouvelles").checked ? ` (dont ${deja} déjà imprimée(s))` : "") + ".";
  },

  // Dessin d'une étiquette à la taille voulue (rendu 6 fois plus fin que l'écran : net à l'impression)
  dessiner(a, f = this.format) {
    const S = ECHELLE, W = Math.round(f.l * MM_EN_PX) * S, H = Math.round(f.h * MM_EN_PX) * S;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = f.couleur ? a.couleur : "#fff";
    ctx.fillRect(0, 0, W, H);
    const pad = Math.round(Math.min(W, H) * 0.06);
    const qr = f.qr && a.lien;
    const cote = qr ? Math.min(H - 2 * pad, Math.round(W * 0.48)) : 0;
    if (qr) dessinerQr(ctx, a.lien, pad, cote);
    const x0 = qr ? pad + cote + pad : pad, zoneW = W - x0 - pad, zoneH = H - 2 * pad;
    const police = (t, gras) => `${gras ? "bold " : ""}${t}px Roboto, Arial, Helvetica, sans-serif`;
    ctx.fillStyle = "#000"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const lignes = lignesDuCode(a.code);
    const hCode = f.nom && a.nom ? zoneH * 0.66 : zoneH, hLigne = hCode / lignes.length, cx = x0 + zoneW / 2;
    lignes.forEach((l, i) => {
      let t = Math.floor(hLigne * 0.95);
      ctx.font = police(t, true);
      while (t > 8 && ctx.measureText(l).width > zoneW) { t -= 2; ctx.font = police(t, true); }
      ctx.fillText(l, cx, pad + hLigne * (i + 0.5));
    });
    if (f.nom && a.nom) { // nom sur deux lignes au plus, réduit pour tenir
      const hNom = zoneH - hCode, mots = a.nom.split(/\s+/);
      let t = Math.floor(hNom * 0.45), essai;
      const couper = () => {
        const ls = [""];
        for (const m of mots) { const x = ls[ls.length - 1] ? ls[ls.length - 1] + " " + m : m; if (ctx.measureText(x).width <= zoneW || !ls[ls.length - 1]) ls[ls.length - 1] = x; else ls.push(m); }
        return ls;
      };
      const mini = Math.max(6, Math.floor(hNom * 0.32)); // en dessous, illisible : le nom est plutôt coupé (« … »)
      do { ctx.font = police(t, false); essai = couper(); t -= 2; } while (t >= mini && (essai.length > 2 || essai.some(l => ctx.measureText(l).width > zoneW)));
      if (essai.length > 2) essai = [essai[0], essai.slice(1).join(" ")];
      essai = essai.map(l => { if (ctx.measureText(l).width <= zoneW) return l;
        while (l.length > 1 && ctx.measureText(l + "…").width > zoneW) l = l.slice(0, -1);
        return l + "…"; });
      essai.forEach((l, i) => ctx.fillText(l, cx, pad + hCode + hNom / essai.length * (i + 0.5)));
    }
    return cv;
  },

  // Pages à imprimer (aussi l'aperçu à l'écran, réduit à la largeur du téléphone)
  async preparer() {
    const liste = this._selection();
    if (!liste.length) { toast("Aucune étiquette à imprimer : choisissez au moins une catégorie."); return false; }
    const f = this.format, rouleau = f.page === "rouleau";
    const [pw, ph] = rouleau ? [f.l, f.h] : PAGES[f.page] || PAGES.A4;
    const { cols, lignes } = this._grille();
    const parPage = cols * lignes;
    const depart = rouleau ? 0 : Math.min(parPage - 1, Math.max(0, (parseInt($("imp-depart").value, 10) || 1) - 1));
    $("imp-etat").textContent = `Préparation de ${liste.length} étiquette(s)…`;
    await new Promise(r => setTimeout(r, 30));
    const urls = [];
    for (let i = 0; i < liste.length; i++) {
      urls.push(this.dessiner(liste[i]).toDataURL("image/png"));
      if (i % 20 === 19) await new Promise(r => setTimeout(r, 0));
    }
    const pages = [];
    for (let i = 0; i < liste.length + depart; i += parPage) {
      const cases = [];
      for (let k = 0; k < parPage; k++) {
        const j = i + k - depart;
        if (j < 0 || j >= liste.length) continue;
        const c = k % cols, r = Math.floor(k / cols);
        const x = rouleau ? 0 : f.mg + c * (f.l + f.eh), y = rouleau ? 0 : f.mh + r * (f.h + f.ev);
        cases.push(`<img class="etq ${f.traits ? "trait" : ""}" src="${urls[j]}" alt="${echapper(liste[j].code)}" style="left:${x}mm;top:${y}mm;width:${f.l}mm;height:${f.h}mm">`);
      }
      pages.push(`<div class="page-etq" style="width:${pw}mm;height:${ph}mm">${cases.join("")}</div>`);
    }
    const zone = $("imp-feuilles");
    zone.innerHTML = pages.join("");
    const echelle = Math.min(1, (zone.clientWidth || 360) / (pw * MM_EN_PX));
    zone.style.setProperty("--zoom-etq", echelle);
    this._page = `@media print { @page { size: ${pw}mm ${ph}mm; margin: 0; } }`;
    this._derniere = liste;
    $("imp-etat").textContent = `${liste.length} étiquette(s) sur ${pages.length} page(s). Aperçu ci-dessous.`;
    return true;
  },

  async imprimer() {
    if (!(await this.preparer())) return;
    $("imp-etat").textContent = "Dans le menu qui s'ouvre : choisissez l'imprimante (ou « Enregistrer au format PDF »), taille réelle (100 %), sans marges.";
    const titre = document.title;
    document.title = `Étiquettes ${horodatage()}`;
    document.body.classList.add("impression-etiquettes");
    $("style-impression").textContent = this._page; // format de page des étiquettes, le temps de l'impression
    window.print();
    setTimeout(async () => {
      document.title = titre;
      $("style-impression").textContent = "";
      document.body.classList.remove("impression-etiquettes");
      if (await demander(`L'impression s'est bien passée ? Les ${this._derniere.length} étiquette(s) seront retenues comme imprimées (pour n'imprimer ensuite que les nouvelles).`, "Oui, retenir", "Non")) {
        this._derniere.forEach(a => this.imprimees.add(a.cle));
        await Memoire.ecrire([...this.imprimees], "etiquettes_imprimees");
        this.majCompte();
      }
    }, 1500);
  },
};

$("imp-reglages").addEventListener("change", e => { if (e.target.id) Impression._lireFormulaire(e.target.id); });
$("imp-nouvelles").addEventListener("change", () => Impression.majCompte());
document.addEventListener("click", e => {
  if (e.target.closest("[data-action='impression']")) return Impression.ouvrir();
  const s = e.target.closest("[data-imp-source]");
  if (s) {
    const n = s.dataset.impSource;
    Impression.choix.has(n) ? Impression.choix.delete(n) : Impression.choix.add(n);
    s.classList.toggle("choisi", Impression.choix.has(n));
    return Impression.majCompte();
  }
  const b = e.target.closest("[data-imp]");
  if (b && b.dataset.imp === "apercu") Impression.preparer();
  else if (b && b.dataset.imp === "imprimer") Impression.imprimer();
  else if (b && b.dataset.imp === "oublier") {
    Impression.imprimees = new Set();
    Memoire.ecrire([], "etiquettes_imprimees");
    Impression.majCompte();
    toast("Toutes les étiquettes sont de nouveau « à imprimer ».");
  }
});
