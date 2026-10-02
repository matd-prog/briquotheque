// Base commune de reconnaissance des blisters : tous les blisters photographiés (par l'utilisateur, son ami, les
// collectionneurs), qu'on les possède ou non. Plus elle est riche, mieux la photo d'un blister est reconnue, dans
// les deux applis.
// - dépôt public (lu par les deux applis, sans jeton) : data/jb_commune.tsv (code BC-…, nom ; même format que les
//   autres listes du catalogue JB, js/catalogue_jb.js) et data/jb_empreintes_commune.tsv (empreinte du décor,
//   js/empreinte.js) : des noms et des empreintes seulement, pas de photo ;
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
    const connues = new Set();
    try {
      const { texte } = await this._lire(DEPOT_PUBLIC, "data/jb_commune.tsv");
      for (const l of texte.split("\n").slice(1)) { const nom = l.split("\t")[1]; if (nom) connues.add(cle(nom)); }
    } catch (err) { console.warn("base commune : liste des noms illisible", err); }
    const groupes = new Map(); // figurine -> exemplaires en attente
    for (const e of enAttente) {
      const k = cle(nomComplet(e));
      if (!groupes.has(k)) groupes.set(k, []);
      groupes.get(k).push(e);
    }
    const liste = [], doublons = [];
    for (const [k, g] of groupes) {
      if (connues.has(k)) { doublons.push(...g); continue; } // déjà dans la base commune
      const rep = g.find(e => e.verso) || g[0]; // de préférence un exemplaire photographié recto et verso
      liste.push(rep);
      doublons.push(...g.filter(e => e !== rep));
    }
    if (!liste.length) { for (const e of doublons) e.commune = true; return 0; }
    const date = new Date().toISOString().slice(0, 10), noms = [], empreintes = [], figurines = [], prives = [];
    let n = 0;
    for (const e of liste) {
      const code = e.communeCode || `BC-${e.id.toUpperCase()}`;
      const bitmap = await createImageBitmap(e.photo);
      const empreinte = empreinteEnTexte(empreinteImage(bitmap, false));
      const empreinteFig = empreinteEnTexte(empreinteCentreBlister(bitmap));
      bitmap.close && bitmap.close();
      const recto = `album_photos/commune/${code}_recto.jpg`, verso = e.verso ? `album_photos/commune/${code}_verso.jpg` : "";
      await this._ecrire(DEPOT_PRIVE, recto, await this._blobEn64(e.photo), null, `Base commune : ${nomComplet(e)} (recto)`);
      if (e.verso) await this._ecrire(DEPOT_PRIVE, verso, await this._blobEn64(e.verso), null, `Base commune : ${nomComplet(e)} (verso)`);
      const propre = v => String(v || "").replace(/[\t\n]/g, " ").trim();
      // nom ; catégorie ; lien, image, prix, dispo vides ; figurine du catalogue à laquelle la rattacher (code reconnu)
      noms.push([code, propre(nomComplet(e)), "Base commune", "", "", "", "", propre(e.code)].join("\t"));
      empreintes.push(`${code}\t${empreinte}`);
      figurines.push(`${code}\t${empreinteFig}`);
      prives.push([code, e.nom, e.precision, e.numero, e.serie, e.code, qui, date, recto.replace("album_photos/", ""), verso.replace("album_photos/", "")].map(propre).join("\t"));
      e.communeCode = code;
      n++;
      if (progression) progression(n, liste.length);
    }
    // listes : une seule écriture par fichier pour tout l'envoi
    const ajouter = async (depot, chemin, entete, lignes) => {
      const { texte, sha } = await this._lire(depot, chemin);
      const base = texte.trim() ? texte.replace(/\n*$/, "\n") : entete + "\n";
      const deja = new Set(base.split("\n").map(l => l.split("\t")[0]));
      const nouvelles = lignes.filter(l => !deja.has(l.split("\t")[0])); // envoi précédent interrompu
      if (nouvelles.length) await this._ecrire(depot, chemin, this._texteEn64(base + nouvelles.join("\n") + "\n"), sha, `Base commune : ${nouvelles.length} blister(s)`);
    };
    await ajouter(DEPOT_PRIVE, "album_photos/commune.tsv", "code\tnom\tprecision\tnumero\tserie\tcode_catalogue\tqui\tdate\tphoto\tverso", prives);
    try {
      await ajouter(DEPOT_PUBLIC, "data/jb_commune.tsv", "code\tnom\tcategorie\tlien\timage\tprix\tdispo\trattache", noms);
      await ajouter(DEPOT_PUBLIC, "data/jb_empreintes_commune.tsv", "code\tempreinte", empreintes);
      await ajouter(DEPOT_PUBLIC, "data/jb_empreintes_figurine.tsv", "code\tempreinte", figurines);
    } catch (err) {
      if (err.statut === 403 || err.statut === 404 || /40[34]/.test(err.message)) {
        const e2 = new Error("acces-public"); e2.cause = err; throw e2;
      }
      throw err;
    }
    for (const e of [...liste, ...doublons]) e.commune = true;
    return n;
  },

  // Envoi discret après un ajout (appli principale, avec jeton) ; une erreur n'empêche rien : réessayé plus tard
  async envoyerEnFond(base) {
    if (this._enCours || !(await this.jeton()) || !this.enAttente(base.entrees).length) return;
    this._enCours = this.envoyer(base.entrees, "moi")
      .then(async n => { await Memoire.ecrire(base.entrees, "base"); if (n) toast(`🌐 ${n} nouvelle${n > 1 ? "s" : ""} figurine${n > 1 ? "s" : ""} dans la base commune`); })
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
