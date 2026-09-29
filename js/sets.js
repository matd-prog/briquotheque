// Sets LEGO : catalogue (data/sets.tsv, data/sets_figurines.tsv, créés par outils/sets_rebrickable.py)
// et écran « Ajouter un set » : numéro -> fiche du set, état, boîte, notice, figurines contenues ;
// le set va dans l'onglet « Sets » du fichier Excel, et ses figurines peuvent être ajoutées d'un coup
// à la collection (mêmes onglets et étiquettes qu'une figurine ajoutée seule).

const CatalogueSets = {
  sets: null,      // Map code -> { code, nom, annee, theme, pieces, nbFigurines }
  figurines: null, // Map code -> [{ fig, quantite, nom, bricklink, ressemblance }]
  date: null,
  _chargement: null,

  charger() {
    if (!this._chargement) {
      const lire = f => fetch(f).then(r => { if (!r.ok) throw new Error("catalogue des sets absent"); return r.text(); });
      this._chargement = Promise.all([lire("data/sets.tsv"), lire("data/sets_figurines.tsv")]).then(([s, f]) => {
        this.sets = new Map();
        for (const l of s.split("\n")) {
          if (l.startsWith("#date ")) { this.date = l.slice(6).trim(); continue; }
          const [code, nom, annee, theme, pieces, nb] = l.split("\t");
          if (!code || code === "code" || !nom) continue;
          this.sets.set(code.toLowerCase(), { code, nom, annee, theme, pieces, nbFigurines: +nb || 0,
                                             recherche: normaliser(`${code} ${nom} ${theme}`) });
        }
        this.figurines = new Map();
        for (const l of f.split("\n")) {
          const [set, fig, q, nom, bricklink, r] = l.split("\t");
          if (!set || set === "set" || set.startsWith("#")) continue;
          const liste = this.figurines.get(set.toLowerCase()) || [];
          liste.push({ fig, quantite: +q || 1, nom, bricklink: (bricklink || "").toUpperCase(), ressemblance: +r || 0 });
          this.figurines.set(set.toLowerCase(), liste);
        }
        return this.sets;
      }).catch(err => { this._chargement = null; throw err; });
    }
    return this._chargement;
  },

  // « 75192 » -> 75192-1 ; « 75192-2 » tel quel
  trouver(numero) {
    const n = (numero || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!n || !this.sets) return null;
    return this.sets.get(n) || this.sets.get(n + "-1") || null;
  },

  // autres versions du même numéro (75192-1, 75192-2…)
  versions(numero) {
    const n = (numero || "").trim().toLowerCase().replace(/-\d+$/, "");
    if (!n || !this.sets) return [];
    const res = [];
    for (let v = 1; v <= 9; v++) { const s = this.sets.get(`${n}-${v}`); if (s) res.push(s); }
    return res;
  },
};

const ETATS_SET = ["Neuf scellé", "Monté", "Démonté (en boîte)", "Incomplet", "Autre"];
const urlImageSet = code => `https://img.bricklink.com/ItemImage/SN/0/${encodeURIComponent(code)}.png`;
const urlBricklinkSet = code => `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${encodeURIComponent(code)}`;

const EcranSet = {
  set: null,
  figs: [],  // [{ ...figurine du set, code, nomBL, theme, camp, onglet, deja, cocher }]

  async ouvrir() {
    this.set = null;
    $("set-numero").value = "";
    $("set-fiche").innerHTML = "";
    $("set-details").hidden = true;
    afficher("set");
    $("set-info").textContent = "Chargement du catalogue des sets…";
    try {
      await Promise.all([CatalogueSets.charger(), Catalogue.charger().catch(() => {})]);
      $("set-info").textContent = `Tapez le numéro du set (ex. 75192). Catalogue : ${CatalogueSets.sets.size.toLocaleString("fr-FR")} sets` +
        (CatalogueSets.date ? ` (${new Date(CatalogueSets.date).toLocaleDateString("fr-FR")})` : "") + ".";
    } catch (e) {
      $("set-info").textContent = "Le catalogue des sets n'est pas encore disponible.";
    }
    setTimeout(() => $("set-numero").focus(), 50);
  },

  chercher() {
    const numero = $("set-numero").value;
    const versions = CatalogueSets.versions(numero);
    const s = CatalogueSets.trouver(numero);
    if (!s) {
      $("set-fiche").innerHTML = numero.trim().length >= 3 ? `<p class="aide">Aucun set « ${echapper(numero.trim())} » dans le catalogue.</p>` : "";
      $("set-details").hidden = true;
      return;
    }
    this.choisir(s, versions);
  },

  async choisir(s, versions = []) {
    this.set = s;
    const deja = (await lireSets(etat.classeur)).filter(x => x.code.toLowerCase() === s.code.toLowerCase());
    $("set-fiche").innerHTML = `
      <div class="carte">
        <div class="haut">
          <img src="${urlImageSet(s.code)}" alt="" onerror="this.style.visibility='hidden'">
          <div><div class="nom">${echapper(s.nom)}</div><div class="code">${echapper(s.code)}</div>
            <div class="score">${echapper([s.annee, s.theme, s.pieces && `${s.pieces} pièces`].filter(Boolean).join(" · "))}</div></div>
        </div>
        ${versions.length > 1 ? `<div class="suggestions">${versions.map(v =>
          `<button class="petit" data-version="${echapper(v.code)}">${echapper(v.code)}${v.code === s.code ? " ✔" : ""}</button>`).join("")}</div>` : ""}
        ${deja.length ? `<div class="alerte">Déjà dans votre onglet « Sets » (ligne ${deja.map(d => d.row).join(", ")}).</div>` : ""}
        <a class="bouton bleu" href="${urlBricklinkSet(s.code)}" target="_blank" rel="noopener">🔗 Voir la page BrickLink</a>
      </div>`;
    $("set-fiche").querySelectorAll("[data-version]").forEach(b => b.addEventListener("click", () =>
      this.choisir(CatalogueSets.trouver(b.dataset.version), versions)));
    $("set-etat").value = ETATS_SET[0];
    $("set-boite").checked = true;
    $("set-notice").checked = true;
    this._figurines();
    $("set-details").hidden = false;
  },

  // Figurines du set : code BrickLink proposé, onglet de destination, déjà dans la collection ?
  _figurines() {
    const liste = CatalogueSets.figurines.get(this.set.code.toLowerCase()) || [];
    this.figs = liste.map(f => {
      const fiche = f.bricklink ? Catalogue.trouver(f.bricklink) : null;
      const code = fiche ? fiche.code : "";
      const cand = { id: code, nom: fiche ? fiche.nom : f.nom, categorie: fiche ? fiche.categorie : "" };
      const theme = code ? proposerTheme(cand) : null;
      const camp = code ? proposerCamp(code, cand.nom, etat.table).camp : null;
      const onglet = code ? (theme === STAR_WARS ? CAMPS[camp].onglet : theme) : null;
      const deja = code ? ouFigurine(code) : [];
      const sur = code && f.ressemblance >= 0.7;
      return { ...f, code, nomBL: cand.nom, theme, camp, onglet, deja, sur, cocher: sur && !deja.length };
    });
    $("set-figs-titre").textContent = this.figs.length
      ? `Figurines du set (${this.figs.reduce((n, f) => n + f.quantite, 0)}) : cochez celles à ajouter à votre collection`
      : "Aucune figurine dans ce set.";
    $("set-figs").innerHTML = this.figs.map((f, i) => `
      <label class="fiche fig-set">
        <input type="checkbox" data-fig="${i}" ${f.cocher ? "checked" : ""} ${f.code ? "" : "disabled"}>
        ${f.code ? `${imageHtml({ id: f.code }, "photo")}` : `<span class="photo-custom">❔</span>`}
        <div class="infos">
          <div class="nom-court">${echapper(f.code ? f.nomBL : f.nom)}${f.quantite > 1 ? ` × ${f.quantite}` : ""}</div>
          <div class="lieu">${f.code ? `${echapper(f.code)} → ${echapper(f.onglet)}` : "code BrickLink inconnu : à ajouter à part (photo ou recherche)"}
            ${f.code && !f.sur ? ` · <b>à vérifier</b> (Rebrickable : « ${echapper(f.nom)} »)` : ""}
            ${f.deja.length ? ` · <b>déjà dans votre collection</b>` : ""}</div>
        </div>
      </label>`).join("");
    $("set-figs").querySelectorAll("[data-fig]").forEach(c => c.addEventListener("change", () => { this.figs[+c.dataset.fig].cocher = c.checked; }));
  },

  async ajouter() {
    if (!this.set) return;
    const s = this.set, choisies = this.figs.filter(f => f.cocher && f.code);
    const deja = (await lireSets(etat.classeur)).some(x => x.code.toLowerCase() === s.code.toLowerCase());
    if (deja && !(await demander(`Le set ${s.code} est déjà dans votre onglet « Sets ». L'ajouter quand même (autre exemplaire) ?`))) return;
    $("texte-chargement").textContent = `Ajout du set${choisies.length ? ` et de ${choisies.length} figurine(s)` : ""}…`;
    afficher("chargement");
    const ajoutees = [];
    try {
      await ajouterSet(etat.classeur, {
        code: s.code, nom: s.nom, annee: s.annee, theme: s.theme, pieces: s.pieces, etat: $("set-etat").value,
        boite: $("set-boite").checked, notice: $("set-notice").checked,
        // code BrickLink si sûr ou coché par vous, sinon le nom donné par Rebrickable
        figurines: this.figs.map(f => ((f.code && (f.sur || f.cocher)) ? f.code : f.nom) + (f.quantite > 1 ? ` ×${f.quantite}` : "")).join(", "),
      });
      etat.nonEnregistres++;
      for (const f of choisies) {
        $("texte-chargement").textContent = `Ajout des figurines… (${ajoutees.length + 1} sur ${choisies.length})`;
        const choix = f.theme === STAR_WARS ? { camp: f.camp } : { theme: f.theme };
        const res = await ajouterFigurine(etat.classeur, { code: f.code, nom: nomPourFichier(f.nomBL || f.code), ...choix });
        ajoutees.push(`${f.code} → ${res.onglet}, case ${res.ref}`);
        etat.nonEnregistres++;
      }
      await memoriser();
      await relireContenu();
      afficher("accueil");
      await demander(`Set ${s.code} « ${s.nom} » ajouté à l'onglet « Sets ».` +
        (ajoutees.length ? `\n\nFigurines ajoutées :\n${ajoutees.join("\n")}` : "") +
        "\n\nPensez à enregistrer le fichier.", "OK", "Fermer");
    } catch (err) {
      console.error(err);
      const m = await Memoire.lire(); // retour à la dernière version gardée dans le téléphone
      if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
      afficher("set");
      await demander("L'ajout a échoué : " + err.message, "OK", "Fermer");
    }
  },
};

let minuteurSet;
$("set-numero").addEventListener("input", () => {
  clearTimeout(minuteurSet);
  minuteurSet = setTimeout(() => EcranSet.chercher(), 300);
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  if (b.dataset.action === "set") EcranSet.ouvrir();
  else if (b.dataset.action === "set-ajouter") EcranSet.ajouter();
});
