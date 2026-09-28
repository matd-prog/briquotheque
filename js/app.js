// Fonctionnement de l'écran : photo -> identification -> « Ajouter à ma collection ? » -> étiquette dans Excel

const BRICKOGNIZE = "https://api.brickognize.com/predict/figs/";
const $ = id => document.getElementById(id);

const etat = {
  classeur: null,      // le fichier Excel ouvert (objet Classeur)
  nomFichier: "",
  nonEnregistres: 0,   // nombre d'ajouts pas encore enregistrés
  table: [],           // lignes de la Table camps
  collection: null,    // contenu des 3 onglets colorés
  photos: [],          // photos envoyées pour la figurine en cours (face, dos) et leurs résultats
  candidats: [],
  choisi: null,
  theme: null,
  origine: "photo",    // d'où viennent les propositions : "photo" ou "recherche"
  camp: null,
  dernierFichier: null,
};

// ---------- navigation ----------

function afficher(ecran) {
  document.querySelectorAll(".ecran").forEach(e => e.hidden = e.id !== "ecran-" + ecran);
  window.scrollTo(0, 0);
}

function toast(texte, duree = 3500) {
  const t = $("toast");
  t.textContent = texte; t.hidden = false;
  clearTimeout(toast.minuteur);
  toast.minuteur = setTimeout(() => t.hidden = true, duree);
}

function demander(texte, oui = "Oui", non = "Non") {
  return new Promise(ok => {
    const d = $("dialogue");
    $("dialogue-texte").textContent = texte;
    $("dialogue-oui").textContent = oui;
    $("dialogue-non").textContent = non;
    $("dialogue-oui").onclick = () => { d.close(); ok(true); };
    $("dialogue-non").onclick = () => { d.close(); ok(false); };
    d.oncancel = () => ok(false);
    d.showModal();
  });
}

function echapper(t) {
  return String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- mémoire du téléphone (le fichier survit si la page se recharge) ----------

const Memoire = {
  _db() {
    return new Promise((ok, ko) => {
      const r = indexedDB.open("etiquettes-figurines", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("donnees");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
  },
  async ecrire(valeur, cle = "classeur") {
    try {
      const db = await this._db();
      await new Promise((ok, ko) => {
        const tx = db.transaction("donnees", "readwrite");
        tx.objectStore("donnees").put(valeur, cle);
        tx.oncomplete = ok; tx.onerror = () => ko(tx.error);
      });
    } catch (e) { console.warn("Mémoire indisponible", e); }
  },
  async lire(cle = "classeur") {
    try {
      const db = await this._db();
      return await new Promise(ok => {
        const r = db.transaction("donnees").objectStore("donnees").get(cle);
        r.onsuccess = () => ok(r.result || null);
        r.onerror = () => ok(null);
      });
    } catch (e) { return null; }
  },
  async effacer() { await this.ecrire(null); },
};

// ---------- fichier Excel ----------

async function chargerClasseur(octets, nom, nonEnregistres = 0) {
  const cl = await Classeur.ouvrir(octets);
  for (const o of ONGLETS_AUTORISES) cl.feuille(o); // vérifie que les 4 onglets existent
  etat.classeur = cl;
  etat.nomFichier = nom;
  etat.nonEnregistres = nonEnregistres;
  await relireContenu();
}

async function relireContenu() {
  etat.table = await lireTableCamps(etat.classeur);
  etat.collection = await lireCollection(etat.classeur);
  const nb = Object.values(etat.collection).reduce((s, o) => s + o.cases.filter(c => c.code).length, 0);
  $("fichier-info").textContent = `📗 ${etat.nomFichier} · ${nb} figurines`;
  majBandeau();
}

function majBandeau() {
  $("bandeau-save").hidden = !etat.nonEnregistres;
  $("bandeau-texte").textContent = etat.nonEnregistres === 1
    ? "1 ajout pas encore enregistré" : `${etat.nonEnregistres} ajouts pas encore enregistrés`;
}

// Sauvegarde dans la mémoire du téléphone après chaque modification
async function memoriser() {
  const octets = await etat.classeur.enregistrer();
  await Memoire.ecrire({ nom: etat.nomFichier, octets, nonEnregistres: etat.nonEnregistres });
  // on repart du fichier tout juste écrit, pour être sûr de travailler sur ce qui est enregistré
  etat.classeur = await Classeur.ouvrir(octets);
  return octets;
}

$("input-fichier").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const octets = new Uint8Array(await f.arrayBuffer());
    await chargerClasseur(octets, f.name);
    await Memoire.ecrire({ nom: f.name, octets, nonEnregistres: 0 });
    afficher("accueil");
    toast("Fichier ouvert ✔");
  } catch (err) {
    console.error(err);
    await demander("Impossible d'utiliser ce fichier : " + err.message, "OK", "Fermer");
  }
});

// ---------- photo et identification ----------

const NB_PROPOSITIONS = 5;

// Nouvelle photo (de face) : recadrage puis identification
for (const id of ["input-photo", "input-galerie"]) {
  $(id).addEventListener("change", async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    $("recadrage-titre").textContent = "Encadrez la figurine : glissez le cadre, ou tirez ses coins.";
    const photo = await Recadrage.ouvrir(f).catch(() => null);
    if (!photo) { afficher("accueil"); return; }
    etat.photos = [];
    identifier(photo);
  });
}

// Photo de dos : même figurine, pour départager les variantes
$("input-dos").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  $("recadrage-titre").textContent = "Photo de dos : encadrez la figurine.";
  const photo = await Recadrage.ouvrir(f).catch(() => null);
  if (!photo) { afficher("resultat"); return; }
  identifier(photo);
});

async function interrogerBrickognize(photo) {
  const form = new FormData();
  form.append("query_image", photo, "photo.jpg");
  const rep = await fetch(BRICKOGNIZE, { method: "POST", body: form });
  if (!rep.ok) throw new Error("Brickognize a répondu " + rep.status);
  const donnees = await rep.json();
  return (donnees.items || []).slice(0, 10).map(it => ({
    id: String(it.id || "").toUpperCase(),
    nom: it.name || "",
    image: it.img_url || "",
    score: typeof it.score === "number" ? it.score : null,
    categorie: it.category || "",
    lien: ((it.external_sites || []).find(s => /bricklink/i.test(s.name || s.url || "")) || {}).url || urlBricklink(String(it.id || "")),
  })).filter(it => it.id);
}

// Combine les résultats de plusieurs photos : moyenne des scores (0 si absente d'une photo)
function combiner(photos) {
  const table = new Map();
  photos.forEach(p => p.items.forEach(it => {
    const x = table.get(it.id) || { ...it, total: 0 };
    x.total += it.score || 0;
    table.set(it.id, x);
  }));
  return [...table.values()]
    .map(x => ({ ...x, score: x.total / photos.length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, NB_PROPOSITIONS);
}

async function identifier(photo) {
  const url = URL.createObjectURL(photo);
  $("photo-apercu").src = url;
  $("texte-chargement").textContent = etat.photos.length ? "Analyse de la photo de dos…" : "Identification en cours…";
  afficher("chargement");
  try {
    const items = await interrogerBrickognize(photo);
    if (!items.length) {
      afficher(etat.photos.length ? "resultat" : "accueil");
      await demander("Aucune figurine reconnue sur cette photo. Essayez avec la figurine seule, bien éclairée, sur un fond uni, en la recadrant au plus près.", "OK", "Fermer");
      return;
    }
    etat.photos.push({ url, items });
    etat.origine = "photo";
    etat.candidats = combiner(etat.photos);
    choisirCandidat(0);
  } catch (err) {
    console.error(err);
    afficher(etat.photos.length ? "resultat" : "accueil");
    const saisir = await demander("Impossible de joindre le service de reconnaissance (Brickognize). Vérifiez la connexion Internet.\n\nVoulez-vous chercher la figurine par son nom ?", "Chercher par nom", "Fermer");
    if (saisir) ouvrirRecherche();
  }
}

function imageBricklink(code) {
  return `https://img.bricklink.com/ItemImage/${typeBricklink(code)}N/0/${encodeURIComponent(code.toLowerCase())}.png`;
}

// Image d'une proposition : photo BrickLink, et à défaut celle de Brickognize
function imageHtml(cand, classe = "") {
  const secours = cand.image && cand.image !== imageBricklink(cand.id) ? cand.image : "";
  return `<img class="${classe}" loading="lazy" src="${echapper(imageBricklink(cand.id))}" alt="" data-secours="${echapper(secours)}"
    onerror="if (this.dataset.secours) { this.src = this.dataset.secours; this.dataset.secours = ''; } else this.style.visibility = 'hidden'">`;
}

// « Luke Skywalker (Hoth, Printed Legs) » -> « LUKE SKYWALKER Hoth, Printed Legs » (style de votre fichier)
function nomPourFichier(nom) {
  const m = /\s\(|\s[-–]\s|,/.exec(nom);
  if (!m) return nom.toUpperCase().trim();
  const detail = nom.slice(m.index).replace(/[()]/g, " ").replace(/\s[-–]\s/g, ", ")
    .replace(/^[\s,]+/, "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim();
  return (nom.slice(0, m.index).toUpperCase() + " " + detail).trim();
}

// ---------- résultat ----------

const STAR_WARS = "Star Wars";

function ouFigurine(code) {
  const c = code.toUpperCase();
  const res = [];
  for (const o of Object.keys(etat.collection))
    for (const cas of etat.collection[o].cases)
      if (cas.code.toUpperCase() === c) res.push(`${o}, case ${cas.ref}`);
  return res;
}

// Thème proposé : d'abord votre Table camps, puis la catégorie du catalogue BrickLink,
// puis celle de Brickognize, et enfin le début du code BrickLink (sw... = Star Wars)
function proposerTheme(cand) {
  const connu = etat.table.find(l => l.code.toUpperCase() === cand.id.toUpperCase());
  if (connu && CAMPS[connu.camp]) return STAR_WARS;
  if (connu && ONGLETS_THEMES.includes(connu.camp)) return connu.camp;
  const fiche = Catalogue.trouver(cand.id);
  const parCategorie = themeDeCategorie(fiche ? fiche.categorie : "") || themeDeCategorie(cand.categorie);
  if (parCategorie) return parCategorie;
  if (estStarWars(cand)) return STAR_WARS;
  return themeDuCode(cand.id).onglet;
}

function couleurChoisie() {
  return etat.theme === STAR_WARS ? CAMPS[etat.camp].couleur : couleurOnglet(etat.theme);
}
function ongletChoisi() {
  return etat.theme === STAR_WARS ? CAMPS[etat.camp].onglet : etat.theme;
}

function choisirCandidat(i) {
  const cand = etat.candidats[i];
  etat.choisi = cand;
  etat.theme = proposerTheme(cand);
  etat.camp = proposerCamp(cand.id, cand.nom, etat.table).camp;
  const deja = ouFigurine(cand.id);
  const nbPhotos = etat.photos.length;
  const score = cand.score != null
    ? `<div class="score">Confiance : ${Math.round(cand.score * 100)} %${nbPhotos > 1 ? ` <span class="badge">${nbPhotos} photos combinées</span>` : ""}</div>` : "";

  $("carte-principale").innerHTML = `
    <div class="comparer">
      ${nbPhotos ? `<figure><div class="vos-photos">${etat.photos.map(p => `<img src="${p.url}" alt="">`).join("")}</div>
        <figcaption>${nbPhotos > 1 ? "Vos photos" : "Votre photo"}</figcaption></figure>` : ""}
      <figure ${nbPhotos ? "" : 'style="grid-column: 1 / -1"'}>${imageHtml(cand)}<figcaption>BrickLink</figcaption></figure>
    </div>
    <div>
      <div class="nom">${echapper(cand.nom || "Nom inconnu")}</div>
      <div class="code">${echapper(cand.id)}</div>
      ${score}
    </div>
    <a class="bouton bleu" href="${echapper(cand.lien)}" target="_blank" rel="noopener">🔗 Voir la page BrickLink</a>`;

  const zone = $("zone-ajout");
  zone.innerHTML = `
    ${deja.length ? `<div class="alerte">Déjà dans votre collection : ${echapper(deja.join(" ; "))}</div>` : ""}
    ${codeInvalide(cand.id) ? `<div class="alerte stop">Code « ${echapper(cand.id)} » : pas un vrai code BrickLink.</div>` : ""}
    <div class="apercu-etiquette" id="apercu"></div>
    <label class="etiquette-champ" for="choix-theme">Thème</label>
    <select id="choix-theme" class="champ">
      ${[STAR_WARS, ...ONGLETS_THEMES.filter(t => t !== THEME_CUSTOMS.onglet)].map(t => `<option ${t === etat.theme ? "selected" : ""}>${echapper(t)}</option>`).join("")}
    </select>
    <div id="bloc-camps">
      <div class="camps">
        ${Object.entries(CAMPS).map(([nom, c]) =>
          `<button class="camp" data-camp="${echapper(nom)}" style="background:${c.couleur}">${nom === "Zone grise" ? "Gris" : echapper(nom)}</button>`).join("")}
      </div>
    </div>
    <p class="camp-raison" id="camp-raison"></p>
    <label class="etiquette-champ" for="champ-nom">Nom dans le fichier</label>
    <input id="champ-nom" class="champ" value="${echapper(nomPourFichier(cand.nom || cand.id))}">
    <p class="question">Ajouter à ma collection ?</p>
    <div class="oui-non">
      <button class="gros-bouton gris" data-action="non">Non</button>
      <button class="gros-bouton vert" data-action="oui">Oui</button>
    </div>`;
  zone.querySelectorAll(".camp").forEach(b => b.addEventListener("click", () => {
    etat.camp = b.dataset.camp;
    majChoix("Couleur choisie par vous.");
  }));
  $("choix-theme").addEventListener("change", e => {
    etat.theme = e.target.value;
    majChoix(null);
  });
  majChoix(null);

  const autres = etat.candidats.map((c, j) => ({ c, j })).filter(x => x.j !== i);
  $("liste-autres").innerHTML = autres.length ? autres.map(({ c, j }) => `
    <button class="proposition" data-candidat="${j}">
      ${imageHtml(c)}
      <span class="nom-court">${echapper(c.nom)}</span>
      <span class="code">${echapper(c.id)}${c.score != null ? `<span class="score"> · ${Math.round(c.score * 100)} %</span>` : ""}</span>
    </button>`).join("") : "";
  $("liste-autres").hidden = !autres.length;
  // photo de dos : seulement après une première photo, et une seule fois
  $("btn-dos").hidden = nbPhotos !== 1 || etat.origine !== "photo";
  $("liste-autres").querySelectorAll("[data-candidat]").forEach(b =>
    b.addEventListener("click", () => choisirCandidat(+b.dataset.candidat)));
  afficher("resultat");
}

// Met à jour l'écran après un changement de thème ou de camp
function majChoix(raison) {
  const sw = etat.theme === STAR_WARS;
  $("bloc-camps").hidden = !sw;
  if (raison) $("camp-raison").textContent = raison;
  else if (sw) $("camp-raison").textContent =
    `Couleur choisie ${proposerCamp(etat.choisi.id, etat.choisi.nom, etat.table).raison}. Touchez une autre couleur pour la changer.`;
  else $("camp-raison").textContent = etat.classeur.aOnglet(etat.theme)
    ? `Rangée dans l'onglet « ${etat.theme} ».`
    : `Nouvel onglet « ${etat.theme} » : il sera créé dans le fichier.`;
  majApercu();
}

async function majApercu() {
  document.querySelectorAll(".camp").forEach(b => b.classList.toggle("choisi", b.dataset.camp === etat.camp));
  // un onglet pas encore créé aura les mêmes cases que l'onglet modèle
  const onglet = etat.classeur.aOnglet(ongletChoisi()) ? ongletChoisi() : ONGLET_MODELE;
  const { w, h } = await dimensionsCase(etat.classeur, onglet, 1, 2);
  const cv = dessinerEtiquette(etat.choisi.id, couleurChoisie(), w, h);
  const zone = $("apercu");
  if (zone) { zone.innerHTML = ""; zone.appendChild(cv); }
}

// ---------- ajout au fichier ----------

async function ajouter() {
  const cand = etat.choisi;
  const code = cand.id.toUpperCase();
  const nom = ($("champ-nom").value || code).trim();
  if (codeInvalide(code)) {
    await demander(`« ${code} » n'est pas un vrai code BrickLink : impossible de créer un QR code fiable.`, "OK", "Fermer");
    return;
  }
  const deja = ouFigurine(code);
  if (deja.length && !(await demander(`Vous avez déjà cette figurine (${deja.join(" ; ")}).\n\nL'ajouter quand même ?`))) return;

  const couleur = couleurChoisie();
  $("texte-chargement").textContent = "Ajout dans le fichier…";
  afficher("chargement");
  try {
    const choix = etat.theme === STAR_WARS ? { camp: etat.camp } : { theme: etat.theme };
    const nouvelOnglet = !etat.classeur.aOnglet(ongletChoisi());
    const res = await ajouterFigurine(etat.classeur, { code, nom, ...choix });
    etat.nonEnregistres++;
    const octets = await memoriser();
    const ok = await verifierAjout(octets, { onglet: res.onglet, row: res.row, col: res.col, code });
    if (!ok) throw new Error("vérification après écriture échouée");
    await relireContenu();
    $("texte-ok").textContent = `Ajoutée dans ${res.onglet}, case ${res.ref}` +
      (nouvelOnglet ? " (nouvel onglet créé)" : res.nouvelleLigne ? " (nouvelle ligne créée)" : "");
    const { w, h } = await dimensionsCase(etat.classeur, res.onglet, res.row, res.col);
    $("apercu-ok").innerHTML = "";
    $("apercu-ok").appendChild(dessinerEtiquette(code, couleur, w, h));
    afficher("ok");
  } catch (err) {
    console.error(err);
    // on revient à la dernière version enregistrée dans le téléphone
    const m = await Memoire.lire();
    if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
    afficher("resultat");
    await demander("L'ajout a échoué : " + err.message, "OK", "Fermer");
  }
}

// ---------- recherche par nom (catalogue BrickLink) ----------

async function ouvrirRecherche() {
  afficher("recherche");
  $("recherche-resultats").innerHTML = "";
  $("recherche-info").textContent = "Chargement du catalogue…";
  try {
    const liste = await Catalogue.charger();
    $("recherche-info").textContent = `${liste.length.toLocaleString("fr-FR")} figurines dans le catalogue. Tapez au moins 2 lettres.`;
    lancerRecherche();
  } catch (e) {
    $("recherche-info").textContent = "Le catalogue BrickLink n'est pas encore installé dans l'appli.";
  }
  setTimeout(() => $("recherche-texte").focus(), 50);
}

function lancerRecherche() {
  const texte = $("recherche-texte").value;
  const zone = $("recherche-resultats");
  if (!Catalogue.liste || texte.trim().length < 2) { zone.innerHTML = ""; return; }
  const res = Catalogue.chercher(texte);
  $("recherche-info").textContent = res.length ? `${res.length >= 40 ? "40 premiers résultats" : res.length + " résultat(s)"} : touchez la bonne figurine.`
    : "Aucune figurine trouvée. Essayez un autre mot (en anglais).";
  zone.innerHTML = res.map((f, i) => `
    <button class="proposition" data-resultat="${i}">
      ${imageHtml({ id: f.code })}
      <span class="nom-court">${echapper(f.nom)}</span>
      <span class="code">${echapper(f.code)}</span>
      <span class="score">${echapper(f.categorie)}${f.annee ? " · " + echapper(f.annee) : ""}</span>
    </button>`).join("");
  zone.querySelectorAll("[data-resultat]").forEach(b => b.addEventListener("click", () => {
    const f = res[+b.dataset.resultat];
    etat.candidats = [{ id: f.code, nom: f.nom, image: "", score: null, categorie: f.categorie, lien: urlBricklink(f.code) }];
    etat.origine = "recherche";
    choisirCandidat(0);
  }));
}

let minuteurRecherche;
$("recherche-texte").addEventListener("input", () => {
  clearTimeout(minuteurRecherche);
  minuteurRecherche = setTimeout(lancerRecherche, 250);
});

// ---------- mise à jour du catalogue BrickLink ----------

async function majInfosCatalogue() {
  try {
    const liste = await Catalogue.charger();
    const date = Catalogue.date ? new Date(Catalogue.date).toLocaleDateString("fr-FR") : "date inconnue";
    $("catalogue-info").textContent = `Catalogue actuel : ${liste.length.toLocaleString("fr-FR")} figurines (${date}).`;
  } catch (e) {
    $("catalogue-info").textContent = "Aucun catalogue installé pour l'instant.";
  }
  $("bandeau-catalogue").hidden = !Catalogue.aMettreAJour();
}

$("input-catalogue").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const n = await Catalogue.installer(await f.text());
    await majInfosCatalogue();
    toast(`Catalogue mis à jour ✔ (${n.toLocaleString("fr-FR")} figurines)`);
  } catch (err) {
    console.error(err);
    await demander("Ce fichier n'a pas pu être utilisé : " + err.message +
      "\n\nVérifiez sur BrickLink : « Catalog Items », « Minifigures », « Tab-Delimited File ».", "OK", "Fermer");
  }
});

// ---------- figurines custom (JB Spielwaren ou autre) ----------

// Premier lien http(s) trouvé dans le texte collé (le partage Android ajoute parfois le titre de la page)
function lienDansTexte(texte) {
  const m = /https?:\/\/\S+/i.exec(texte || "");
  return m ? m[0] : "";
}

// JB Spielwaren : …/nya-custom-minifigure/a-648654818/ -> JB-648654818 ; sinon CUS-001, CUS-002…
function codeCustom(lien) {
  const jb = /jb-spielwaren\.[a-z]+\/.*?\/a-(\d+)/i.exec(lien);
  if (jb) return "JB-" + jb[1];
  let max = 0;
  const codes = [...Object.values(etat.collection).flatMap(o => o.cases.map(c => c.code)), ...etat.table.map(l => l.code)];
  for (const c of codes) { const x = /^CUS-(\d+)$/i.exec(c || ""); if (x) max = Math.max(max, +x[1]); }
  return "CUS-" + String(max + 1).padStart(3, "0");
}

// Nom proposé d'après l'adresse JB : …/nya-custom-minifigure/a-… -> « NYA »
function nomDepuisLien(lien) {
  const m = /\/([a-z0-9-]+)\/a-\d+/i.exec(lien);
  return m ? m[1].replace(/-?custom-minifigures?$/i, "").replace(/-/g, " ").trim().toUpperCase() : "";
}

function ouvrirCustom() {
  $("custom-lien").value = "";
  $("custom-nom").value = "";
  delete $("custom-nom").dataset.auto;
  afficher("custom");
  majCustom();
}

function majCustom() {
  const lien = lienDansTexte($("custom-lien").value);
  const code = codeCustom(lien);
  const nom = $("custom-nom");
  const propose = nomDepuisLien(lien);
  if (propose && (!nom.value || nom.dataset.auto)) { nom.value = propose; nom.dataset.auto = "1"; }
  $("custom-code").textContent = `Code de l'étiquette : ${code}` +
    (code.startsWith("JB-") ? " (numéro d'article JB Spielwaren)" : lien ? "" : " — pas de lien : étiquette sans QR code");
  const deja = ouFigurine(code);
  $("custom-alerte").innerHTML = deja.length ? `<div class="alerte">Déjà dans votre collection : ${echapper(deja.join(" ; "))}</div>` : "";
  const onglet = etat.classeur.aOnglet(THEME_CUSTOMS.onglet) ? THEME_CUSTOMS.onglet : ONGLET_MODELE;
  dimensionsCase(etat.classeur, onglet, 1, 2).then(({ w, h }) => {
    $("custom-apercu").innerHTML = "";
    $("custom-apercu").appendChild(dessinerEtiquette(code, THEME_CUSTOMS.couleur, w, h, lien || null));
  });
}

let minuteurCustom;
for (const id of ["custom-lien", "custom-nom"]) {
  $(id).addEventListener("input", e => {
    if (id === "custom-nom") delete $("custom-nom").dataset.auto; // nom tapé à la main : on n'y touche plus
    clearTimeout(minuteurCustom);
    minuteurCustom = setTimeout(majCustom, 250);
  });
}

async function ajouterCustom() {
  const lien = lienDansTexte($("custom-lien").value);
  const code = codeCustom(lien);
  const nom = $("custom-nom").value.trim();
  if (!nom) { await demander("Donnez un nom à la figurine.", "OK", "Fermer"); return; }
  const deja = ouFigurine(code);
  if (deja.length && !(await demander(`Vous avez déjà cette figurine (${deja.join(" ; ")}).\n\nL'ajouter quand même ?`))) return;
  const onglet = THEME_CUSTOMS.onglet;
  const nouvelOnglet = !etat.classeur.aOnglet(onglet);
  $("texte-chargement").textContent = "Ajout dans le fichier…";
  $("photo-apercu").removeAttribute("src");
  afficher("chargement");
  try {
    const res = await ajouterFigurine(etat.classeur, { code, nom, theme: onglet, lien });
    etat.nonEnregistres++;
    const octets = await memoriser();
    if (!(await verifierAjout(octets, { onglet, row: res.row, col: res.col, code }))) throw new Error("vérification après écriture échouée");
    await relireContenu();
    $("texte-ok").textContent = `Ajoutée dans ${onglet}, case ${res.ref}` + (nouvelOnglet ? " (nouvel onglet créé)" : "");
    const { w, h } = await dimensionsCase(etat.classeur, onglet, res.row, res.col);
    $("apercu-ok").innerHTML = "";
    $("apercu-ok").appendChild(dessinerEtiquette(code, THEME_CUSTOMS.couleur, w, h, lien || null));
    afficher("ok");
  } catch (err) {
    console.error(err);
    const m = await Memoire.lire();
    if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
    afficher("custom");
    await demander("L'ajout a échoué : " + err.message, "OK", "Fermer");
  }
}

// ---------- saisie manuelle ----------

function ouvrirSaisie() {
  $("saisie-code").value = "";
  afficher("saisie");
  setTimeout(() => $("saisie-code").focus(), 50);
}

async function validerSaisie() {
  const code = $("saisie-code").value.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return;
  const connu = etat.table.find(l => l.code.toUpperCase() === code);
  const fiche = Catalogue.trouver(code);
  etat.candidats = [{
    id: code, nom: fiche ? fiche.nom : connu ? connu.personnage : "", image: "",
    score: null, categorie: fiche ? fiche.categorie : "", lien: urlBricklink(code),
  }];
  etat.photos = [];
  etat.origine = "recherche";
  choisirCandidat(0);
}

// ---------- enregistrement (Google Drive / téléchargement) ----------

function horodatage() {
  const d = new Date(), z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}h${z(d.getMinutes())}`;
}

async function preparerEnregistrement() {
  const octets = await etat.classeur.enregistrer();
  const base = etat.nomFichier.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\.xlsx$/i, "").replace(/_\d{4}-\d{2}-\d{2}_\d{2}h\d{2}$/, "");
  const nom = `${base}_${horodatage()}.xlsx`;
  const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  etat.dernierFichier = new File([octets], nom, { type });
  $("nom-save").textContent = nom;
  const lien = $("lien-telecharger");
  if (lien.href) URL.revokeObjectURL(lien.href);
  lien.href = URL.createObjectURL(etat.dernierFichier);
  lien.download = nom;
  let partageOk = false;
  try { partageOk = !!(navigator.canShare && navigator.canShare({ files: [etat.dernierFichier] })); } catch (e) {}
  $("btn-partager").hidden = !partageOk;
  afficher("save");
}

async function partager() {
  try {
    await navigator.share({ files: [etat.dernierFichier], title: etat.dernierFichier.name });
    fichierEnregistre();
  } catch (err) {
    if (err.name === "AbortError") return; // partage annulé par vous
    $("btn-partager").hidden = true;
    await demander("Votre téléphone ne permet pas de partager directement ce fichier Excel.\n\n" +
      "Touchez « 1. Télécharger le fichier », puis suivez les 3 étapes pour le mettre dans Google Drive.", "OK", "Fermer");
  }
}

async function fichierEnregistre() {
  etat.nonEnregistres = 0;
  etat.nomFichier = etat.dernierFichier.name;
  await memoriser();
  await relireContenu();
  toast("Fichier enregistré ✔");
}

$("lien-telecharger").addEventListener("click", () => setTimeout(fichierEnregistre, 500));

// ---------- régénération en lot ----------

async function regenerer() {
  if (!(await demander("Refaire toutes les étiquettes (onglets Star Wars et onglets de thèmes) avec le modèle QR code ?\n\nLes anciennes images seront remplacées dans le nouveau fichier ; votre fichier d'origine reste intact.")))
    return;
  const zone = $("regen-etat");
  zone.innerHTML = `<progress max="1" value="0"></progress><p class="aide">Préparation…</p>`;
  const barre = zone.querySelector("progress"), texte = zone.querySelector("p");
  try {
    const rapport = await regenererTout(etat.classeur, (i, total) => {
      barre.max = total; barre.value = i; texte.textContent = `${i} / ${total} étiquettes`;
    });
    etat.nonEnregistres++;
    texte.textContent = "Vérification…";
    await memoriser();
    await relireContenu();
    let msg = `✅ ${rapport.faites} étiquettes refaites.`;
    if (rapport.ignorees.length)
      msg += `<br>⚠️ Sans étiquette, code à vérifier dans le fichier : ` +
        rapport.ignorees.map(x => `${echapper(x.code)} – ${echapper(x.nom)} (${echapper(x.onglet)}, ${x.ref})`).join(" ; ");
    zone.innerHTML = `<div class="alerte">${msg}</div><button class="bouton vert" data-action="enregistrer">📤 Enregistrer le fichier</button>`;
  } catch (err) {
    console.error(err);
    const m = await Memoire.lire();
    if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
    zone.innerHTML = `<div class="alerte stop">Échec : ${echapper(err.message)}</div>`;
  }
}

// ---------- boutons ----------

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action === "accueil") afficher(etat.classeur ? "accueil" : "fichier");
  else if (action === "saisie") ouvrirSaisie();
  else if (action === "collection") Collection.ouvrir();
  else if (action === "custom") ouvrirCustom();
  else if (action === "custom-oui") ajouterCustom();
  else if (action === "voir-catalogue") {
    $("outils").open = true;
    $("bloc-catalogue").scrollIntoView({ behavior: "smooth" });
  }
  else if (action === "recherche") {
    // depuis l'accueil : nouvelle figurine, on oublie les photos précédentes ;
    // depuis un résultat : on garde la photo pour comparer
    if (b.closest("#ecran-accueil")) etat.photos = [];
    ouvrirRecherche();
  }
  else if (action === "recadrage-ok") Recadrage.valider(false);
  else if (action === "recadrage-entiere") Recadrage.valider(true);
  else if (action === "recadrage-annuler") Recadrage.annuler();
  else if (action === "valider-saisie") validerSaisie();
  else if (action === "oui") ajouter();
  else if (action === "non") { afficher("accueil"); toast("Rien n'a été ajouté."); }
  else if (action === "enregistrer") preparerEnregistrement();
  else if (action === "partager") partager();
  else if (action === "regenerer") regenerer();
  else if (action === "changer-fichier") {
    if (etat.nonEnregistres && !(await demander("Des ajouts n'ont pas été enregistrés. Les abandonner ?"))) return;
    await Memoire.effacer();
    etat.classeur = null;
    $("fichier-info").textContent = "";
    etat.nonEnregistres = 0; majBandeau();
    afficher("fichier");
  }
});
$("saisie-code").addEventListener("keydown", e => { if (e.key === "Enter") validerSaisie(); });

// ---------- démarrage ----------

(async function demarrer() {
  Recadrage.installer();
  Collection.installer();
  // en arrière-plan : sert à la recherche par nom et à reconnaître le thème
  Catalogue.charger().catch(() => {}).then(majInfosCatalogue);
  if ("serviceWorker" in navigator && location.protocol === "https:")
    navigator.serviceWorker.register("sw.js").catch(() => {});
  const m = await Memoire.lire();
  if (m && m.octets) {
    try {
      await chargerClasseur(m.octets, m.nom, m.nonEnregistres || 0);
      afficher("accueil");
      return;
    } catch (e) { console.warn(e); }
  }
  afficher("fichier");
})();
