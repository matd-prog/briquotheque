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

  // sets dont le nom (ou le thème) contient tous les mots tapés : les plus récents d'abord
  chercherNom(texte, max = 30) {
    const mots = normaliser(texte).split(/\s+/).filter(m => m.length >= 2);
    if (!mots.length || !this.sets) return [];
    const res = [];
    for (const s of this.sets.values()) if (mots.every(m => s.recherche.includes(m))) res.push(s);
    const dansNom = x => { const n = normaliser(x.nom); return mots.filter(m => n.includes(m)).length; }; // mots trouvés dans le nom d'abord
    return res.sort((a, b) => dansNom(b) - dansNom(a) || (+b.annee || 0) - (+a.annee || 0) || (+b.pieces || 0) - (+a.pieces || 0)).slice(0, max);
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

const ETATS_SET = ["Neuf scellé", "Monté", "Démonté (en boîte)", "Sans figurines", "Incomplet", "Boîte seule (vide)", "Autre"];
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
    // marque : LEGO par défaut ; la dernière autre marque choisie reste proposée pendant la session (plusieurs Cobi à la suite)
    $("set-marque").innerHTML = ["LEGO", ...MARQUES_ALTERNATIVES].map(m => `<option>${echapper(m)}</option>`).join("") +
      `<option value="autre">Autre marque…</option>`;
    $("set-marque").value = this.marqueRetenue || "LEGO";
    if (this.marqueAutre) { $("set-marque").value = "autre"; $("set-marque-autre").value = this.marqueAutre.trim(); }
    for (const id of ["set-m-numero", "set-m-nom", "set-m-pieces", "set-m-annee", "set-m-prix", "set-m-prix-fabricant"]) $(id).value = "";
    this.majMarque();
    afficher("set");
    $("set-info").textContent = "Chargement du catalogue des sets…";
    try {
      await Promise.all([CatalogueSets.charger(), Catalogue.charger().catch(() => {}), typeof Nouveautes !== "undefined" ? Nouveautes.charger().catch(() => {}) : null]);
      $("set-info").textContent = `Tapez le numéro du set (ex. 75192) ou son nom (ex. étoile de la mort, millennium falcon). Catalogue : ${CatalogueSets.sets.size.toLocaleString("fr-FR")} sets` +
        (CatalogueSets.date ? ` (${new Date(CatalogueSets.date).toLocaleDateString("fr-FR")})` : "") + ".";
    } catch (e) {
      $("set-info").textContent = "Le catalogue des sets n'est pas encore disponible.";
    }
    setTimeout(() => $(estLego({ marque: this.marque() }) ? "set-numero" : "set-m-numero").focus(), 50);
  },

  marque() {
    const v = $("set-marque").value;
    return v === "autre" ? $("set-marque-autre").value.trim() : v;
  },

  // LEGO : recherche dans le catalogue ; autre marque : saisie à la main (état, boîte, notice gardés ; pas de figurines)
  majMarque() {
    const autre = $("set-marque").value === "autre", lego = !autre && $("set-marque").value === "LEGO";
    $("set-marque-autre").hidden = !autre;
    $("set-bloc-lego").hidden = !lego;
    $("set-bloc-marque").hidden = lego;
    if (lego) { $("set-details").hidden = !this.set; return; }
    this.set = null; this.figs = [];
    $("set-figs-titre").textContent = ""; $("set-figs").innerHTML = "";
    $("set-etat").value = ETATS_SET[0]; $("set-boite").checked = true; $("set-notice").checked = true;
    $("set-details").hidden = false;
  },

  async ajouterMarque() {
    const marque = this.marque();
    const numero = $("set-m-numero").value.trim(), nom = $("set-m-nom").value.trim();
    if (!marque) { await demander("Tapez le nom de la marque.", "OK", "Fermer"); return; }
    if (!numero && !nom) { await demander("Indiquez au moins le numéro ou le nom de l'article.", "OK", "Fermer"); return; }
    const euros = id => parseFloat($(id).value.replace(/\s|€/g, "").replace(",", ".")) || 0;
    const prixPaye = euros("set-m-prix"), prixFabricant = euros("set-m-prix-fabricant");
    const code = numero || nom;
    const deja = (await lireSets(etat.classeur)).some(x => !estLego(x) && x.marque.toLowerCase() === marque.toLowerCase() && x.code.toLowerCase() === code.toLowerCase());
    if (deja && !(await demander(`${marque} ${code} est déjà dans votre collection. L'ajouter quand même (autre exemplaire) ?`))) return;
    $("texte-chargement").textContent = "Ajout…";
    afficher("chargement");
    try {
      await ajouterSet(etat.classeur, { code, nom: nom || `${marque} ${numero}`, annee: $("set-m-annee").value.trim(), theme: "",
        pieces: $("set-m-pieces").value.trim(), etat: $("set-etat").value, boite: $("set-boite").checked, notice: $("set-notice").checked,
        marque, prixPaye, prixFabricant });
      etat.nonEnregistres++;
      await memoriser();
      await relireContenu();
      afficher("accueil");
      await demander(`${marque} ${numero ? numero + " " : ""}${nom ? `« ${nom} » ` : ""}ajouté à votre collection (avec vos sets).\n\n` +
        (prixFabricant ? "Sa valeur : le prix du fabricant que vous avez indiqué, tant qu'il le vend."
          : "Sa valeur sera estimée d'après les annonces eBay France au prochain relevé des prix" + (prixPaye ? ", sinon d'après votre prix payé." : ".")), "OK", "Fermer");
    } catch (err) {
      console.error(err);
      afficher("set");
      await demander("L'ajout a échoué : " + err.message, "OK", "Fermer");
    }
  },

  chercher() {
    const numero = $("set-numero").value;
    const versions = CatalogueSets.versions(numero);
    const s = CatalogueSets.trouver(numero);
    // pas un numéro : recherche par le nom du set (en anglais dans le catalogue ; quelques noms français traduits)
    if (!s && /[a-zà-ÿ]{2}/i.test(numero)) {
      const trad = { "etoile de la mort": "death star", "faucon millenium": "millennium falcon", "faucon millennium": "millennium falcon",
        "encyclopedie": "encyclopedia", "dictionnaire visuel": "visual dictionary", "dictionnaire": "dictionary",
        "chasseur": "fighter", "croiseur": "destroyer", "chateau": "castle", "poudlard": "hogwarts", "bateau": "ship" };
      let q = normaliser(numero);
      for (const [fr, en] of Object.entries(trad)) q = q.replace(fr, en);
      const res = CatalogueSets.chercherNom(q);
      $("set-details").hidden = true;
      $("set-fiche").innerHTML = res.length ? `<p class="aide">${res.length === 30 ? "30 premiers sets" : `${res.length} set(s)`} dont le nom contient « ${echapper(numero.trim())} » :</p>
        <div class="grille">${res.map(x => `<button class="proposition" data-set="${echapper(x.code)}">
          <img src="${urlImageSet(x.code)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
          <span class="nom-court">${echapper(x.nom)}</span>
          <span class="code">${echapper(x.code)} <span class="score">· ${echapper([x.annee, x.pieces && `${x.pieces} pièces`].filter(Boolean).join(" · "))}</span></span>
        </button>`).join("")}</div>` : `<p class="aide">Aucun set dont le nom contient « ${echapper(numero.trim())} ». Les noms du catalogue sont en anglais (ex. « Death Star », « Castle »).</p>`;
      $("set-fiche").querySelectorAll("[data-set]").forEach(b => b.addEventListener("click", () => {
        const x = CatalogueSets.trouver(b.dataset.set);
        $("set-numero").value = x.code;
        this.choisir(x, CatalogueSets.versions(x.code));
      }));
      return;
    }
    // set annoncé ou tout juste sorti, pas encore dans le catalogue Rebrickable : fiche tirée des nouveautés (Brickset)
    const nv = !s && typeof Nouveautes !== "undefined" && Nouveautes.liste.find(n => n.type === "set" &&
      n.code.toLowerCase() === numero.trim().toLowerCase().replace(/^(\d+)$/, "$1-1"));
    if (nv) return this.choisir({ code: nv.code, nom: nv.nom, annee: nv.annee, theme: nv.theme, pieces: "", image: nv.image }, []);
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
          <img src="${echapper(s.image || urlImageSet(s.code))}" alt="" onerror="this.style.visibility='hidden'">
          <div><div class="nom">${echapper(s.nom)}</div><div class="code">${echapper(s.code)}</div>
            <div class="score">${echapper([s.annee, s.theme, s.pieces && `${s.pieces} pièces`].filter(Boolean).join(" · "))}</div></div>
        </div>
        ${versions.length > 1 ? `<div class="suggestions">${versions.map(v =>
          `<button class="petit" data-version="${echapper(v.code)}">${echapper(v.code)}${v.code === s.code ? " ✔" : ""}</button>`).join("")}</div>` : ""}
        ${deja.length ? `<div class="alerte">Déjà dans votre onglet « Sets » (ligne ${deja.map(d => d.row).join(", ")}).</div>` : ""}
        <a class="bouton bleu" href="${urlBricklinkSet(s.code)}" target="_blank" rel="noopener">🔗 Voir la page BrickLink</a>
        ${typeof Souhaits !== "undefined" ? Souhaits.bouton("Set", s.code.replace(/-1$/, ""), s.nom, s.theme || "") : ""}
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
    // une figurine qui pose problème reste affichée, sans code, plutôt que de vider toute la liste
    this.figs = liste.map(f => { try { return this._preparer(f, f.bricklink); } catch (err) { console.warn(err); return this._preparer(f, ""); } });
    this._afficherFigurines();
  },

  // Figurine du set avec le code BrickLink choisi : thème, camp, onglet, déjà dans la collection ?
  _preparer(f, codeBL, choisiParVous = false) {
    const fiche = codeBL ? Catalogue.trouver(codeBL) : null;
    const code = fiche ? fiche.code : "";
    const cand = { id: code, nom: fiche ? fiche.nom : f.nom, categorie: fiche ? fiche.categorie : "" };
    const theme = code ? proposerTheme(cand) : null;
    const camp = code ? proposerCamp(code, cand.nom, etat.table).camp : null;
    const onglet = code ? (theme === STAR_WARS ? CAMPS[camp].onglet : theme) : null;
    const deja = code ? ouFigurine(code) : [];
    const sur = code && (choisiParVous || f.ressemblance >= 0.6);
    return { ...f, code, nomBL: cand.nom, theme, camp, onglet, deja, sur, cocher: sur && !deja.length };
  },

  _afficherFigurines() {
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
          ${this._menuVariantes(f, i)}
        </div>
      </label>`).join("");
    $("set-figs").querySelectorAll("[data-fig]").forEach(c => c.addEventListener("change", () => { this.figs[+c.dataset.fig].cocher = c.checked; }));
    $("set-figs").querySelectorAll("[data-variante-fig]").forEach(m => m.addEventListener("change", () => {
      const i = +m.dataset.varianteFig;
      this.figs[i] = this._preparer(this.figs[i], m.value, true);
      this._afficherFigurines();
    }));
  },

  // Autres versions du même personnage (tête différente, cachée par un casque) : menu pour choisir
  _menuVariantes(f, i) {
    let v = [];
    try { v = f.code && Catalogue.variantes ? Catalogue.variantes(f.code) : []; } catch (err) { console.warn("variantes", err); }
    if (v.length < 2) return "";
    return `<select class="champ petit-champ" data-variante-fig="${i}" onclick="event.stopPropagation()">
      ${v.map(x => `<option value="${echapper(x.code)}" ${x.code === f.code ? "selected" : ""}>${echapper(x.code)}${x.annee ? ` (${echapper(x.annee)})` : ""} – ${echapper(x.nom)}</option>`).join("")}
    </select>`;
  },

  async ajouter() {
    if (!estLego({ marque: this.marque() })) return this.ajouterMarque();
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

$("set-marque").addEventListener("change", () => {
  EcranSet.marqueRetenue = $("set-marque").value === "autre" ? "LEGO" : $("set-marque").value;
  EcranSet.marqueAutre = $("set-marque").value === "autre" ? $("set-marque-autre").value.trim() || " " : "";
  EcranSet.majMarque();
});
$("set-marque-autre").addEventListener("input", () => { EcranSet.marqueAutre = $("set-marque-autre").value.trim() || " "; });

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
