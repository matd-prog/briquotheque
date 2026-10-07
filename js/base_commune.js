// Base commune de reconnaissance des blisters : tous les blisters photographiés (par l'utilisateur, son ami, les
// collectionneurs), qu'on les possède ou non. Plus elle est riche, mieux la photo d'un blister est reconnue, dans
// les deux applis.
// - dépôt public (lu par les deux applis, sans jeton) : data/jb_commune.tsv (code BC-…, nom ; même format que les
//   autres listes du catalogue JB, js/catalogue_jb.js) et data/jb_empreintes_commune.tsv (empreinte du décor,
//   js/empreinte.js), data/jb_versos.tsv (texte imprimé au dos, js/catalogue_jb.js) : des noms, des empreintes et
//   des textes seulement, pas de photo ;
// - dépôt privé : les photos (album_photos/commune/BC-…_recto.jpg, _verso.jpg) et album_photos/commune.tsv
//   (numéro, qui l'a envoyé, date).
// Seule l'appli principale envoie (jeton GitHub de l'écran Valeur, qui doit donner accès aux deux dépôts) ;
// la mini-appli de l'ami envoie un fichier .zip, que l'utilisateur ajoute à la base commune (Base.reprendre).

const DEPOT_PUBLIC = "matd-prog/briquotheque";

const BaseCommune = {
  _enCours: null,

  async _api(depot, chemin, options = {}) {
    const rep = await fetch(`https://api.github.com/repos/${depot}${chemin}`, {
      cache: "no-store", ...options,
      headers: { Authorization: `Bearer ${Valeur.jeton}`, Accept: "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", ...(options.headers || {}) },
    });
    if (!rep.ok && rep.status !== 404 && rep.status !== 422) {
      const err = new Error(`GitHub a répondu ${rep.status}`);
      err.statut = rep.status;
      throw err;
    }
    return rep;
  },

  // Fichier texte d'un dépôt : { texte, sha } (sha null s'il n'existe pas encore)
  async _lire(depot, chemin) {
    const rep = await this._api(depot, `/contents/${chemin}`);
    if (rep.status === 404) return { texte: "", sha: null };
    const j = await rep.json();
    let texte = j.content ? decodeURIComponent(escape(atob(j.content.replace(/\n/g, "")))) : "";
    if (!j.content && j.size) { // plus de 1 Mo : contenu à part
      const brut = await this._api(depot, `/contents/${chemin}`, { headers: { Accept: "application/vnd.github.raw" } });
      texte = await brut.text();
    }
    return { texte, sha: j.sha };
  },

  async _ecrire(depot, chemin, base64, sha, message) {
    const rep = await this._api(depot, `/contents/${chemin}`, { method: "PUT",
      body: JSON.stringify({ message, content: base64, ...(sha ? { sha } : {}) }) });
    if (rep.status === 422 && !sha) return; // photo déjà envoyée (envoi précédent interrompu)
    if (!rep.ok) throw new Error(`GitHub a répondu ${rep.status} pour ${chemin}`);
  },

  _texteEn64(t) { return btoa(unescape(encodeURIComponent(t))); },
  _blobEn64(b) {
    return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(b); });
  },

  async jeton() {
    if (typeof Valeur === "undefined") return null;
    Valeur.jeton = Valeur.jeton || await Memoire.lire("jeton-github");
    return Valeur.jeton;
  },

  enAttente(entrees) { return entrees.filter(e => e.photo && e.nom && !e.commune); },

  // Envoie des blisters à la base commune ; renvoie le nombre de figurines envoyées. qui : « moi » ou « ami ».
  // Une seule photo par figurine (nom + précision) : plusieurs exemplaires d'un même blister ne changent que le n°,
  // la reconnaissance n'a besoin que d'une photo (demande de Mathias, 02/10). Figurine déjà dans la base commune :
  // rien n'est envoyé. Chaque blister est marqué traité (e.commune) ; celui envoyé reçoit son code BC-… (e.communeCode).
  async envoyer(entrees, qui = "moi", progression) {
    if (!(await this.jeton())) throw new Error("pas de jeton GitHub (écran Valeur)");
    const enAttente = this.enAttente(entrees);
    if (!enAttente.length) return 0;
    const cle = t => normaliser(t).replace(/[^a-z0-9]+/g, " ").trim();
    const connues = new Map(), avecVerso = new Set(); // nom -> figurine de la base commune ; figurines au verso déjà lu
    try {
      const [{ texte }, versos] = await Promise.all([this._lire(DEPOT_PUBLIC, "data/jb_commune.tsv"), this._lire(DEPOT_PUBLIC, "data/jb_versos.tsv")]);
      for (const l of texte.split("\n").slice(1)) { const [code, nom, , , , , , rattache] = l.split("\t"); if (nom) connues.set(cle(nom), (rattache || "").trim() || code); }
      for (const l of versos.texte.split("\n").slice(1)) { const code = l.split("\t")[0]; if (code) avecVerso.add(code.toUpperCase()); }
    } catch (err) { console.warn("base commune : liste des noms illisible", err); }
    // texte du verso (data/jb_versos.tsv, public : c'est le texte imprimé au dos), lu au besoin
    const versos = [];
    const texteDuVerso = async e => {
      if (!e.versoTexte && e.verso && typeof Paddle !== "undefined") {
        try { e.versoTexte = texteVerso((await Paddle.lignes(await createImageBitmap(e.verso))).map(l => l.texte).join("\n")); }
        catch (err) { console.warn("verso illisible", err); }
      }
      return texteVerso(e.versoTexte || "").split("\n").map(l => l.replace(/[\t\/]/g, " ").trim()).filter(Boolean).join(" / ");
    };
    const ajouterVerso = async (code, e) => {
      if (!code || avecVerso.has(code.toUpperCase()) || !e || !e.verso) return;
      const t = await texteDuVerso(e);
      if (t.length >= 20) { versos.push(`${code}\t${t}`); avecVerso.add(code.toUpperCase()); }
    };
    const groupes = new Map(); // figurine -> exemplaires en attente
    for (const e of enAttente) {
      const k = cle(nomComplet(e));
      if (!groupes.has(k)) groupes.set(k, []);
      groupes.get(k).push(e);
    }
    const liste = [], doublons = [];
    for (const [k, g] of groupes) {
      if (connues.has(k)) { // déjà dans la base commune : seulement le texte du verso, s'il manque
        doublons.push(...g);
        const e = g.find(x => x.verso);
        await ajouterVerso(e && e.code || connues.get(k), e);
        continue;
      }
      const rep = g.find(e => e.verso) || g[0]; // de préférence un exemplaire photographié recto et verso
      liste.push(rep);
      doublons.push(...g.filter(e => e !== rep));
    }
    if (!liste.length) {
      if (versos.length) await this._ajouterVersos(versos).catch(err => console.warn("base commune : versos", err));
      for (const e of doublons) e.commune = true;
      return 0;
    }
    const date = new Date().toISOString().slice(0, 10), noms = [], empreintes = [], figurines = [], visions = [], prives = [];
    let n = 0;
    for (const e of liste) {
      const code = e.communeCode || `BC-${e.id.toUpperCase()}`;
      const bitmap = await createImageBitmap(e.photo);
      const empreinte = empreinteEnTexte(empreinteImage(bitmap, false));
      const empreinteFig = empreinteEnTexte(empreinteCentreBlister(bitmap));
      const vision = await this._vision(bitmap);
      bitmap.close && bitmap.close();
      const recto = `album_photos/commune/${code}_recto.jpg`, verso = e.verso ? `album_photos/commune/${code}_verso.jpg` : "";
      await this._ecrire(DEPOT_PRIVE, recto, await this._blobEn64(e.photo), null, `Base commune : ${nomComplet(e)} (recto)`);
      if (e.verso) await this._ecrire(DEPOT_PRIVE, verso, await this._blobEn64(e.verso), null, `Base commune : ${nomComplet(e)} (verso)`);
      const propre = v => String(v || "").replace(/[\t\n]/g, " ").trim();
      // nom ; catégorie ; lien, image, prix, dispo vides ; figurine du catalogue à laquelle la rattacher (code reconnu)
      noms.push([code, propre(nomComplet(e)), "Base commune", "", "", "", "", propre(e.code)].join("\t"));
      empreintes.push(`${code}\t${empreinte}`);
      figurines.push(`${code}\t${empreinteFig}`);
      if (vision) visions.push(`${code}\t${vision}`);
      prives.push([code, e.nom, e.precision, e.numero, e.serie, e.code, qui, date, recto.replace("album_photos/", ""), verso.replace("album_photos/", "")].map(propre).join("\t"));
      await ajouterVerso(propre(e.code) || code, e);
      e.communeCode = code;
      n++;
      if (progression) progression(n, liste.length);
    }
    const ajouter = (...a) => this._ajouterLignes(...a);
    await ajouter(DEPOT_PRIVE, "album_photos/commune.tsv", "code\tnom\tprecision\tnumero\tserie\tcode_catalogue\tqui\tdate\tphoto\tverso", prives);
    try {
      await ajouter(DEPOT_PUBLIC, "data/jb_commune.tsv", "code\tnom\tcategorie\tlien\timage\tprix\tdispo\trattache", noms);
      await ajouter(DEPOT_PUBLIC, "data/jb_empreintes_commune.tsv", "code\tempreinte", empreintes);
      await ajouter(DEPOT_PUBLIC, "data/jb_empreintes_figurine.tsv", "code\tempreinte", figurines);
      if (visions.length) await ajouter(DEPOT_PUBLIC, "data/jb_vision_commune.tsv", "code\tvecteur", visions);
      if (versos.length) await this._ajouterVersos(versos);
    } catch (err) {
      if (err.statut === 403 || err.statut === 404 || /40[34]/.test(err.message)) {
        const e2 = new Error("acces-public"); e2.cause = err; throw e2;
      }
      throw err;
    }
    for (const e of [...liste, ...doublons]) e.commune = true;
    return n;
  },

  // Photo refaite (Mathias, 07/10) : la base commune garde une photo par figurine, la première envoyée ; quand un
  // blister déjà envoyé est re-photographié (photo bien cadrée), son empreinte (décor et figurine, dépôt public)
  // et ses photos (dépôt privé) sont remplacées par les nouvelles, pour une meilleure reconnaissance chez tous.
  // Une seule photo par figurine : la plus récente. Photo encore prise de loin : rien n'est changé (en attente).
  async majPhotos(entrees) {
    const aFaire = entrees.filter(e => e.communeMaj && e.photo && e.nom);
    if (!aFaire.length) return 0;
    const cle = t => normaliser(t).replace(/[^a-z0-9]+/g, " ").trim();
    const bonne = async b => { const im = await createImageBitmap(b); const ok = !Base.formeSuspecte(im.width, im.height); im.close && im.close(); return ok; };
    // code BC-… de chaque figurine : celui de l'exemplaire envoyé, sinon d'après le nom dans la base commune
    const parNom = new Map();
    for (const l of (await this._lire(DEPOT_PUBLIC, "data/jb_commune.tsv")).texte.split("\n").slice(1)) {
      const [code, nom] = l.split("\t");
      if (/^BC-/.test(code || "") && nom && !parNom.has(cle(nom))) parNom.set(cle(nom), code);
    }
    const parFig = new Map(); // figurine -> photo refaite la plus récente
    for (const e of aFaire.sort((a, b) => a.communeMaj - b.communeMaj)) parFig.set(cle(nomComplet(e)), e);
    const empreintes = new Map(), figurines = new Map(), visions = new Map(), faits = [];
    for (const [k, e] of parFig) {
      const code = e.communeCode || (entrees.find(x => x.communeCode && cle(nomComplet(x)) === k) || {}).communeCode || parNom.get(k);
      const memes = aFaire.filter(x => cle(nomComplet(x)) === k);
      if (!code) { memes.forEach(x => delete x.communeMaj); continue; } // pas dans la base commune : rien à remplacer
      if (!(await bonne(e.photo))) continue; // encore prise de loin ou mal cadrée : on attend la bonne
      const bitmap = await createImageBitmap(e.photo);
      empreintes.set(code, empreinteEnTexte(empreinteImage(bitmap, false)));
      figurines.set(code, empreinteEnTexte(empreinteCentreBlister(bitmap)));
      const vision = await this._vision(bitmap);
      if (vision) visions.set(code, vision);
      bitmap.close && bitmap.close();
      await this._remplacerFichier(DEPOT_PRIVE, `album_photos/commune/${code}_recto.jpg`, e.photo, `Base commune : ${nomComplet(e)} (photo refaite, recto)`);
      if (e.verso) await this._remplacerFichier(DEPOT_PRIVE, `album_photos/commune/${code}_verso.jpg`, e.verso, `Base commune : ${nomComplet(e)} (photo refaite, verso)`);
      faits.push(...memes);
    }
    if (!empreintes.size) return 0;
    await this._remplacerLignes(DEPOT_PUBLIC, "data/jb_empreintes_commune.tsv", "code\tempreinte", empreintes);
    await this._remplacerLignes(DEPOT_PUBLIC, "data/jb_empreintes_figurine.tsv", "code\tempreinte", figurines);
    if (visions.size) await this._remplacerLignes(DEPOT_PUBLIC, "data/jb_vision_commune.tsv", "code\tvecteur", visions);
    faits.forEach(x => delete x.communeMaj);
    return empreintes.size;
  },

  // Repérage, une fois : figurines dont la photo de la base commune est prise de loin (ou a été refaite depuis
  // l'envoi) alors qu'une bonne photo existe dans « Ma base de blisters » : marquées pour majPhotos
  async reperer(entrees) {
    const rep = await fetch("data/jb_empreintes_commune.tsv", { cache: "no-cache" });
    if (!rep.ok) return;
    const envoyees = new Map((await rep.text()).split("\n").map(l => l.split("\t")).filter(([c, e]) => c && e).map(([c, e]) => [c, e]));
    const cle = t => normaliser(t).replace(/[^a-z0-9]+/g, " ").trim();
    const dims = async b => { const im = await createImageBitmap(b); const r = [im.width, im.height]; im.close && im.close(); return r; };
    let n = 0;
    for (const e of entrees.filter(x => x.communeCode && x.photo && envoyees.has(x.communeCode))) {
      const k = cle(nomComplet(e));
      const [w, h] = await dims(e.photo);
      if (!Base.formeSuspecte(w, h)) { // photo bien cadrée : refaite depuis l'envoi ?
        const im = await createImageBitmap(e.photo), emp = empreinteEnTexte(empreinteImage(im, false));
        im.close && im.close();
        if (emp !== envoyees.get(e.communeCode)) { e.communeMaj = Date.now(); n++; }
        continue;
      }
      // photo envoyée prise de loin : une bonne photo d'un autre exemplaire de la même figurine ?
      for (const x of entrees.filter(y => y !== e && y.photo && y.commune && cle(nomComplet(y)) === k)) {
        const [w2, h2] = await dims(x.photo);
        if (!Base.formeSuspecte(w2, h2)) { x.communeMaj = Date.now(); n++; break; }
      }
    }
    await Memoire.ecrire(entrees, "base");
    await Memoire.ecrire(new Date().toISOString(), "commune-photos-reperees");
    return n;
  },

  // Fichier (photo) remplacé dans un dépôt : il faut le sha de l'ancien
  // Résumé de la photo par le modèle de vision (js/vision.js), pour la reconnaissance d'image ; vide si indisponible
  async _vision(bitmap) {
    if (typeof Vision === "undefined") return "";
    try { return Vision.enTexte(await Vision.vecteur(bitmap)); }
    catch (err) { console.warn("vision indisponible", err); return ""; }
  },

  async _remplacerFichier(depot, chemin, blob, message) {
    const rep = await this._api(depot, `/contents/${chemin}`);
    const sha = rep.status === 404 ? null : (await rep.json()).sha;
    await this._ecrire(depot, chemin, await this._blobEn64(blob), sha, message);
  },

  // Lignes d'une liste remplacées (code -> nouvelle valeur), ajoutées si absentes ; une seule écriture
  async _remplacerLignes(depot, chemin, entete, valeurs) {
    const { texte, sha } = await this._lire(depot, chemin);
    const lignes = (texte.trim() ? texte.trim() : entete).split("\n"), vus = new Set(), res = [];
    for (const l of lignes) {
      const code = l.split("\t")[0];
      if (!valeurs.has(code)) { res.push(l); continue; }
      if (vus.has(code)) continue; // un seul exemplaire de la ligne
      vus.add(code); res.push(`${code}\t${valeurs.get(code)}`);
    }
    for (const [code, v] of valeurs) if (!vus.has(code)) res.push(`${code}\t${v}`);
    await this._ecrire(depot, chemin, this._texteEn64(res.join("\n") + "\n"), sha, `Base commune : ${valeurs.size} photo(s) refaite(s)`);
  },

  // listes : une seule écriture par fichier pour tout l'envoi
  async _ajouterLignes(depot, chemin, entete, lignes) {
    const { texte, sha } = await this._lire(depot, chemin);
    const base = texte.trim() ? texte.replace(/\n*$/, "\n") : entete + "\n";
    const deja = new Set(base.split("\n").map(l => l.split("\t")[0]));
    const nouvelles = lignes.filter(l => !deja.has(l.split("\t")[0])); // envoi précédent interrompu
    if (nouvelles.length) await this._ecrire(depot, chemin, this._texteEn64(base + nouvelles.join("\n") + "\n"), sha, `Base commune : ${nouvelles.length} blister(s)`);
  },
  _ajouterVersos(lignes) { return this._ajouterLignes(DEPOT_PUBLIC, "data/jb_versos.tsv", "code\ttexte", lignes); },

  // Envoi discret après un ajout (appli principale, avec jeton) ; une erreur n'empêche rien : réessayé plus tard.
  // Aussi les photos refaites (e.communeMaj) : la base commune prend la nouvelle (voir majPhotos).
  async envoyerEnFond(base) {
    if (this._enCours || !(await this.jeton())) return;
    if (!(await Memoire.lire("commune-photos-reperees"))) await this.reperer(base.entrees).catch(err => console.warn("base commune : repérage", err));
    if (!this.enAttente(base.entrees).length && !base.entrees.some(e => e.communeMaj)) return;
    this._enCours = this.envoyer(base.entrees, "moi")
      .then(async n => {
        const m = await this.majPhotos(base.entrees);
        await Memoire.ecrire(base.entrees, "base");
        if (n) toast(`🌐 ${n} nouvelle${n > 1 ? "s" : ""} figurine${n > 1 ? "s" : ""} dans la base commune`);
        if (m) toast(`🌐 ${m} photo${m > 1 ? "s" : ""} refaite${m > 1 ? "s" : ""} reportée${m > 1 ? "s" : ""} dans la base commune : reconnaissance améliorée`, 5000);
      })
      .catch(err => console.warn("base commune :", err))
      .finally(() => { this._enCours = null; base._afficherListe(); });
    return this._enCours;
  },

  // Bouton « Envoyer à la base commune » : tout ce qui attend, avec un message clair en cas de souci
  async envoyerTout(base) {
    if (!(await this.jeton())) { await demander("Enregistrez d'abord votre jeton GitHub dans l'écran Valeur.", "OK", "Fermer"); return; }
    if (this._enCours) await this._enCours.catch(() => {});
    const n0 = this.enAttente(base.entrees).length;
    if (!n0) { toast("Tous vos blisters sont déjà dans la base commune ✔"); return; }
    $("base-commune-etat").textContent = `🌐 Envoi à la base commune… 0 / ${n0}`;
    try {
      const n = await this.envoyer(base.entrees, "moi", (i, t) => { $("base-commune-etat").textContent = `🌐 Envoi à la base commune… ${i} / ${t}`; });
      await Memoire.ecrire(base.entrees, "base");
      toast(n ? `🌐 ${n} nouvelle${n > 1 ? "s" : ""} figurine${n > 1 ? "s" : ""} dans la base commune ✔` : "Ces figurines étaient déjà dans la base commune ✔", 5000);
    } catch (err) {
      console.error(err);
      await demander(err.message === "acces-public" ? this.MESSAGE_ACCES : "L'envoi à la base commune a échoué : " + err.message, "OK", "Fermer");
    }
    base._afficherListe();
  },

  MESSAGE_ACCES: "Les photos sont bien parties dans votre dépôt privé, mais votre jeton GitHub ne peut pas encore écrire " +
    "dans le dépôt de l'appli (briquotheque), où va la liste commune.\n\nSur github.com : Paramètres (Settings) → Paramètres du " +
    "développeur (Developer settings) → Jetons d'accès personnels (Personal access tokens) → Jetons à granularité fine " +
    "(Fine-grained tokens) → votre jeton → Modifier (Edit) → Accès au référentiel (Repository access) : ajoutez « briquotheque » " +
    "→ Autorisations (Permissions) : Contenu (Contents) « Lecture et écriture » (Read and write) → Mettre à jour (Update). " +
    "Puis touchez à nouveau « Envoyer à la base commune ».",

  // Envoi .zip d'un ami : ses blisters vont seulement dans la base commune (pas dans votre collection)
  async ajouterEnvoiAmi(entrees) {
    if (!(await this.jeton())) { await demander("Enregistrez d'abord votre jeton GitHub dans l'écran Valeur.", "OK", "Fermer"); return; }
    $("base-commune-etat").textContent = `🌐 Envoi à la base commune… 0 / ${entrees.length}`;
    try {
      const n = await this.envoyer(entrees, "ami", (i, t) => { $("base-commune-etat").textContent = `🌐 Envoi à la base commune… ${i} / ${t}`; });
      await demander((n ? `${n} nouvelle${n > 1 ? "s" : ""} figurine${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""} à la base commune ✔` : "Rien de nouveau : ces figurines étaient déjà dans la base commune.") +
        `\n\n${entrees.length} blister${entrees.length > 1 ? "s" : ""} reçu${entrees.length > 1 ? "s" : ""} : une seule photo par figurine est gardée pour la reconnaissance. Ils ne sont pas dans votre collection.`, "OK", "Fermer");
    } catch (err) {
      console.error(err);
      await demander(err.message === "acces-public" ? this.MESSAGE_ACCES : "L'envoi à la base commune a échoué : " + err.message, "OK", "Fermer");
    }
    Base._afficherListe();
  },
};
