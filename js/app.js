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

// Bouton retour du téléphone : il ramène à l'écran précédent ; depuis l'accueil, il ferme l'appli tout de suite
// (comme toute appli Android : elle passe en arrière-plan, rien n'est perdu). Une appli web ne peut pas se fermer
// elle-même par un bouton « Quitter » : c'est donc le retour depuis l'accueil qui ferme.
// Hors de l'accueil, des étapes « garde » sont gardées dans l'historique : chaque retour en retire une (popstate) et
// l'appli change d'écran. À l'accueil, il n'y en a aucune : le retour sort de l'appli. Les écrans de passage (lecture
// en cours, recadrage) ne sont pas mémorisés ; après un ajout (écran « ok »), l'écran précédent est l'accueil.
const ECRANS_RACINE = ["accueil", "fichier"], ECRANS_PASSAGE = ["chargement", "recadrage"];
let ecranActuel = null, pileEcrans = [];
const aLaRacine = () => ECRANS_RACINE.includes(ecranActuel);

// Chrome saute (retour = sortie directe) une étape ajoutée sans que l'écran ait été touché. Hors de l'accueil, on
// garde donc quelques étapes d'avance, ajoutées à chaque toucher. À l'accueil, un toucher sur une case photo (dont
// l'écran suivant s'ouvre plus tard, au retour de l'appareil photo) en ajoute aussi.
const RESERVE_RETOUR = 3;
const niveauRetour = () => (history.state && history.state.garde) ? (history.state.n || 1) : 0;
let ignorerRetours = 0; // retours faits par l'appli elle-même (retrait des étapes à l'arrivée sur l'accueil)
function armerRetour() {
  if (!aLaRacine() && niveauRetour() === 0 && !ignorerRetours) history.pushState({ garde: true, n: 1 }, "");
}
function desarmerRetour() {
  const n = niveauRetour();
  if (n > 0 && !ignorerRetours) { ignorerRetours++; history.go(-n); }
}
for (const evt of ["click", "keydown"])
  document.addEventListener(evt, e => {
    if (aLaRacine() && !(e.target.closest && e.target.closest("label, [data-action]"))) return;
    for (let n = niveauRetour() + 1; n <= RESERVE_RETOUR; n++) history.pushState({ garde: true, n }, "");
  }, true);

function afficher(ecran, retour = false) {
  document.querySelectorAll(".ecran").forEach(e => e.hidden = e.id !== "ecran-" + ecran);
  window.scrollTo(0, 0);
  if (ECRANS_RACINE.includes(ecran)) pileEcrans = [];
  else if (ecran === "ok") pileEcrans = [etat.classeur ? "accueil" : "fichier"];
  else if (!retour && ecranActuel && ecranActuel !== ecran) {
    if (pileEcrans[pileEcrans.length - 1] === ecran) pileEcrans.pop(); // A -> B -> A : pas de boucle
    else if (!ECRANS_PASSAGE.includes(ecranActuel)) pileEcrans.push(ecranActuel);
  }
  ecranActuel = ecran;
  if (aLaRacine()) desarmerRetour(); else armerRetour();
}

window.addEventListener("popstate", () => {
  if (ignorerRetours > 0) { // arrivée sur la page de départ après desarmerRetour
    ignorerRetours--;
    if (!aLaRacine()) armerRetour(); // entre-temps, un autre écran s'est ouvert
    return;
  }
  if ($("dialogue").open) { $("dialogue-non").click(); armerRetour(); return; } // une question ouverte : retour = « non »
  if (typeof Visionneuse !== "undefined" && Visionneuse.fermer()) { armerRetour(); return; } // photos en grand : retour = fermer
  if ($("menu-actions").open) { $("menu-fermer").click(); armerRetour(); return; } // menu ouvert : retour = fermer
  if (ecranActuel === "chargement") { armerRetour(); toast("Patientez, lecture en cours…"); return; }
  if (ecranActuel === "recadrage") { armerRetour(); Recadrage.annuler(); return; } // l'appelant choisit l'écran suivant
  if (pileEcrans.length) { afficher(pileEcrans.pop(), true); return; }
  if (!aLaRacine()) { afficher(etat.classeur ? "accueil" : "fichier", true); return; }
  // accueil avec des étapes restantes (case photo touchée puis appareil annulé) : on les retire, le retour suivant ferme
  desarmerRetour();
});

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

// Petit menu : un bouton par action ; renvoie le numéro de l'action touchée, ou -1 (Fermer, retour)
function choisirAction(titre, actions) {
  return new Promise(ok => {
    const d = $("menu-actions");
    $("menu-titre").textContent = titre;
    $("menu-boutons").innerHTML = actions.map((a, i) => `<button class="gros-bouton ${i ? "bleu" : "vert"}" data-i="${i}">${echapper(a)}</button>`).join("");
    const fin = i => { if (d.open) d.close(); ok(i); };
    $("menu-boutons").onclick = e => { const b = e.target.closest("[data-i]"); if (b) fin(+b.dataset.i); };
    $("menu-fermer").onclick = () => fin(-1);
    d.oncancel = () => ok(-1);
    d.showModal();
  });
}

// Liens eBay sur Android : toujours vers eBay.de (JB Spielwaren est allemand : eBay.fr n'a
// presque aucune annonce JB, 2 contre 646 le 29/09/2026). Ouvert d'un toucher, le lien serait
// confié à l'application eBay, réglée sur eBay.fr, qui n'y trouve rien : on passe donc par
// ebay.html, qui redirige vers eBay.de sans toucher ; l'application eBay s'ouvre alors sur eBay.de.
const EST_ANDROID = /android/i.test(navigator.userAgent);
function estLienEbay(lien) { return /^https:\/\/(www\.)?ebay\.[a-z.]+\//i.test(lien || ""); }
function lienOuvrable(lien) {
  if (!EST_ANDROID || !estLienEbay(lien)) return lien;
  const relais = new URL("ebay.html?u=" + encodeURIComponent(lien), location.href).href;
  return `intent://${relais.replace(/^https:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(relais)};end`;
}

// Lien vers une page externe pour une fiche : 🔗, ou « 🔎 eBay.de » pour eBay
// (sur Android, l'intent s'ouvre sans nouvel onglet)
function liensFiche(lien, titre) {
  if (!lien) return "";
  const l = lienOuvrable(lien);
  const cible = l.startsWith("intent:") ? "" : ` target="_blank" rel="noopener"`;
  return estLienEbay(lien)
    ? `<a class="lien-ebay" href="${echapper(l)}"${cible} title="Chercher sur eBay.de">🔎 eBay.de</a>`
    : `<a href="${echapper(l)}"${cible} title="${echapper(titre)}">🔗</a>`;
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
  for (const o of [...ONGLETS_COLORES, ONGLET_TABLE]) cl.feuille(o); // vérifie que les 4 onglets existent (« Sets » : créé au besoin)
  etat.classeur = cl;
  etat.nomFichier = nom;
  etat.nonEnregistres = nonEnregistres;
  await relireContenu();
}

async function relireContenu() {
  etat.table = await lireTableCamps(etat.classeur);
  etat.collection = await lireCollection(etat.classeur);
  const nb = Object.values(etat.collection).reduce((s, o) => s + o.cases.filter(c => c.code).length, 0);
  $("fichier-info").textContent = `📗 Ma collection · ${nb} figurines`; // le fichier Excel n'est qu'une sauvegarde : son nom n'est pas affiché
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
    await Memoire.ecrire(null, "poignee"); // autre fichier : l'emplacement d'enregistrement retenu est oublié
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
  // nouvelles figurines qui ressemblent (Brickognize ne les connaît souvent pas encore) : première photo seulement
  const premiere = !etat.photos.length;
  const pSemblables = premiere && typeof Nouveautes !== "undefined"
    ? Nouveautes.semblables(photo).catch(err => { console.warn(err); return []; }) : Promise.resolve([]);
  try {
    const items = await interrogerBrickognize(photo);
    const proches = await pSemblables;
    const semblables = proches.map(x => Nouveautes.candidat(x.n));
    if (!items.length && !semblables.length) {
      afficher(etat.photos.length ? "resultat" : "accueil");
      await demander("Aucune figurine reconnue sur cette photo. Essayez avec la figurine seule, bien éclairée, sur un fond uni, en la recadrant au plus près.", "OK", "Fermer");
      return;
    }
    etat.photos.push({ url, items });
    etat.origine = "photo";
    etat.candidats = combiner(etat.photos);
    // Brickognize peu sûr : les nouveautés qui ressemblent sont proposées aussi (en premier s'il n'a rien trouvé)
    if (premiere && !(etat.candidats[0] && etat.candidats[0].score >= 0.85)) {
      const deja = new Set(etat.candidats.map(c => c.id));
      etat.semblables = semblables.filter(c => !deja.has(c.id));
      // nouveauté très ressemblante et Brickognize hésitant : la nouveauté passe devant
      const devant = proches.length && proches[0].s >= 0.8 && !(etat.candidats[0] && etat.candidats[0].score >= 0.5);
      etat.candidats = !items.length ? etat.semblables
        : devant ? [...etat.semblables, ...etat.candidats] : [...etat.candidats, ...etat.semblables];
    } else if (premiere) etat.semblables = [];
    else etat.candidats = [...etat.candidats, ...(etat.semblables || []).filter(c => !etat.candidats.some(x => x.id === c.id))];
    choisirCandidat(0);
  } catch (err) {
    console.error(err);
    afficher(etat.photos.length ? "resultat" : "accueil");
    const saisir = await demander("Impossible de joindre le service de reconnaissance (Brickognize). Vérifiez la connexion Internet.\n\nVoulez-vous chercher la figurine par son nom ?", "Chercher par nom", "Fermer");
    if (saisir) ouvrirRecherche();
  }
}

function imageBricklink(code) {
  const f = /^fig-/i.test(code) && typeof Catalogue !== "undefined" && Catalogue.trouver(code);
  if (f && f.image) return f.image;   // nouvelle figurine pas encore sur BrickLink : photo Rebrickable
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

// Nombre d'exemplaires déjà dans la collection, et champ « combien en ajouter »
function blocExemplaires(code, id) {
  const deja = ouFigurine(code);
  const onglets = [...new Set(deja.map(d => d.split(",")[0]))];
  return `<div class="${deja.length ? "alerte" : "carte-info"}" id="${id}-deja">${deja.length
      ? `📦 Vous en avez déjà <b>${deja.length} exemplaire${deja.length > 1 ? "s" : ""}</b> (${echapper(onglets.join(", "))}${deja.length <= 4 ? ` : ${echapper(deja.map(d => d.split("case ")[1]).join(", "))}` : ""}).`
      : "✨ Nouvelle figurine : vous n'en avez pas encore."}</div>
    <label class="etiquette-champ" for="${id}-nombre">Nombre d'exemplaires à ajouter</label>
    <input id="${id}-nombre" class="champ" type="number" inputmode="numeric" min="1" max="99" value="1">`;
}

// Confirmation avant d'ajouter n exemplaires : doublon d'une figurine déjà enregistrée, ou vraiment plusieurs exemplaires ?
async function confirmerExemplaires(code, nom, n) {
  const deja = ouFigurine(code).length;
  if (deja) return demander(`Vous avez déjà ${deja} exemplaire${deja > 1 ? "s" : ""} de « ${nom} ».\n\n` +
    `Est-ce bien ${n > 1 ? `${n} exemplaires de plus` : "un exemplaire de plus"} que vous détenez (total ${deja + n}) ?\n\n` +
    "Si c'est la même figurine déjà enregistrée, touchez « Annuler ».", `Oui, j'en ai ${deja + n}`, "Annuler");
  if (n > 1) return demander(`Ajouter ${n} exemplaires de « ${nom} » ?`, `Oui, ${n} exemplaires`, "Annuler");
  return true;
}

// Numéros d'exemplaire déjà enregistrés pour ce code (fin du nom : « … 189/250 ») : { "189/250": "Customs, case B3" }
function numerosEnregistres(code) {
  const c = code.toUpperCase(), res = {};
  for (const o of Object.keys(etat.collection))
    for (const cas of etat.collection[o].cases) {
      const m = cas.code.toUpperCase() === c && /(\d{1,4}\/\d{1,4})\s*$/.exec(cas.nom || "");
      if (m) res[m[1]] = `${o}, case ${cas.ref}`;
    }
  return res;
}

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

// Autres versions du même personnage, qui ne diffèrent que par la tête (cachée par un casque sur la photo)
function blocVariantes(code) {
  const v = Catalogue.variantes(code).filter(f => f.code !== code.toUpperCase());
  if (!v.length) return "";
  return `<details class="variantes"${v.length <= 6 ? " open" : ""}>
    <summary>🪖 ${v.length} autre${v.length > 1 ? "s" : ""} version${v.length > 1 ? "s" : ""} du même personnage (tête différente, cachée par un casque ?)</summary>
    <div class="grille">${v.map(f => `
      <button class="proposition" data-variante="${echapper(f.code)}">
        ${imageHtml({ id: f.code })}
        <span class="nom-court">${echapper(f.nom)}</span>
        <span class="code">${echapper(f.code)}${f.annee ? ` · ${echapper(f.annee)}` : ""}</span>
      </button>`).join("")}</div>
  </details>`;
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
      <figure ${nbPhotos ? "" : 'style="grid-column: 1 / -1"'}>${imageHtml(cand)}<figcaption>${cand.nouveaute ? "Photo officielle" : "BrickLink"}</figcaption></figure>
    </div>
    <div>
      <div class="nom">${echapper(cand.nom || "Nom inconnu")}</div>
      <div class="code">${echapper(cand.id)}</div>
      ${cand.nouveaute || /^fig-/i.test(cand.id) ? `<div class="score">🆕 Nouveauté LEGO${/^fig-/i.test(cand.id) ? " · pas encore de code BrickLink (code Rebrickable)" : ""}</div>` : ""}
      ${score}
    </div>
    <a class="bouton bleu" href="${echapper(cand.lien)}" target="_blank" rel="noopener">🔗 Voir la page ${/rebrickable/.test(cand.lien) ? "Rebrickable" : "BrickLink"}</a>
    ${blocVariantes(cand.id)}`;
  $("carte-principale").querySelectorAll("[data-variante]").forEach(b => b.addEventListener("click", () => {
    const f = Catalogue.trouver(b.dataset.variante);
    etat.candidats = [{ id: f.code, nom: f.nom, image: "", score: null, categorie: f.categorie, lien: urlBricklink(f.code) }, ...etat.candidats];
    choisirCandidat(0);
    window.scrollTo(0, 0);
  }));

  const zone = $("zone-ajout");
  zone.innerHTML = `
    ${blocExemplaires(cand.id, "ajout")}
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
      <span class="code">${echapper(c.id)}${c.score != null ? `<span class="score"> · ${Math.round(c.score * 100)} %</span>` : ""}${c.nouveaute ? `<span class="score"> · 🆕 nouveauté</span>` : ""}</span>
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
  const n = Math.min(99, Math.max(1, parseInt(($("ajout-nombre") || {}).value, 10) || 1));
  if (!(await confirmerExemplaires(code, nom, n))) return;

  const couleur = couleurChoisie();
  $("texte-chargement").textContent = "Ajout dans le fichier…";
  afficher("chargement");
  try {
    const choix = etat.theme === STAR_WARS ? { camp: etat.camp } : { theme: etat.theme };
    const nouvelOnglet = !etat.classeur.aOnglet(ongletChoisi());
    const cases = [];
    let res;
    for (let i = 0; i < n; i++) {
      if (n > 1) $("texte-chargement").textContent = `Ajout dans le fichier… (${i + 1} sur ${n})`;
      res = await ajouterFigurine(etat.classeur, { code, nom, ...choix });
      cases.push(res.ref);
      etat.nonEnregistres++;
    }
    const octets = await memoriser();
    const ok = await verifierAjout(octets, { onglet: res.onglet, row: res.row, col: res.col, code });
    if (!ok) throw new Error("vérification après écriture échouée");
    await relireContenu();
    const total = ouFigurine(code).length;
    $("texte-ok").textContent = (n > 1 ? `${n} exemplaires ajoutés dans ${res.onglet}, cases ${cases.join(", ")}` : `Ajoutée dans ${res.onglet}, case ${res.ref}`) +
      (nouvelOnglet ? " (nouvel onglet créé)" : res.nouvelleLigne ? " (nouvelle ligne créée)" : "") +
      (total > 1 ? ` · ${total} exemplaires dans la collection` : "");
    const { w, h } = await dimensionsCase(etat.classeur, res.onglet, res.row, res.col);
    $("apercu-ok").innerHTML = "";
    $("apercu-ok").appendChild(dessinerEtiquette(code, couleur, w, h));
    preparerSuivante(etat.origine === "photo" ? "photo" : "recherche");
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

// Un exemplaire de plus d'une figurine déjà dans la collection, sans reprendre de photo : écran de résultat avec le
// même onglet (camp ou thème) et le même nom ; customs : écran Custom avec la même figurine, il reste le n° à taper
function exemplaireEnPlus(c, onglet) {
  etat.photos = [];
  if (onglet === THEME_CUSTOMS.onglet) {
    ouvrirCustom("Exemplaire de plus : tapez son numéro.");
    const jb = typeof CatalogueJB !== "undefined" && CatalogueJB.trouver(c.code);
    if (jb) choisirJB(jb);
    else {
      $("custom-lien").value = c.lien || "";
      $("custom-nom").value = (c.nom || "").replace(/\s*\d{1,4}\/\d{1,4}\s*$/, "");
      majCustom();
    }
    const serie = /\d{1,4}\/(\d{1,4})\s*$/.exec(c.nom || "");
    if (serie) $("custom-serie").value = serie[1];
    majNumerosCustom && majNumerosCustom();
    setTimeout(() => $("custom-exemplaire").focus(), 100);
    return;
  }
  const fiche = Catalogue.trouver(c.code);
  etat.candidats = [{ id: c.code.toUpperCase(), nom: fiche ? fiche.nom : c.nom, image: "", score: null,
                      categorie: fiche ? fiche.categorie : "", lien: urlBricklink(c.code) }];
  etat.origine = "collection";
  choisirCandidat(0);
  // même rangement que l'exemplaire déjà là
  const camp = Object.entries(CAMPS).find(([, x]) => x.onglet === onglet);
  if (camp) { etat.theme = STAR_WARS; etat.camp = camp[0]; } else etat.theme = onglet;
  if ($("choix-theme")) $("choix-theme").value = etat.theme;
  if (c.nom) $("champ-nom").value = c.nom;
  majChoix("Même rangement que l'exemplaire que vous avez déjà.");
  window.scrollTo(0, 0);
}

// ---------- recherche par nom (catalogue BrickLink) ----------

async function ouvrirRecherche(nouveautes = false) {
  afficher("recherche");
  $("recherche-resultats").innerHTML = "";
  $("recherche-info").textContent = "Chargement du catalogue…";
  try {
    const liste = await Catalogue.charger();
    lancerRecherche();
  } catch (e) {
    $("recherche-info").textContent = "Le catalogue BrickLink n'est pas encore installé dans l'appli.";
  }
  if (!nouveautes) setTimeout(() => $("recherche-texte").focus(), 50); // nouveautés : pas de clavier par-dessus
}

function lancerRecherche() {
  const texte = $("recherche-texte").value;
  const zone = $("recherche-resultats");
  if (!Catalogue.liste) { zone.innerHTML = ""; return; }
  if (texte.trim().length < 2) { zone.innerHTML = ""; $("recherche-serie").innerHTML = ""; afficherNouveautes(); return; }
  $("recherche-nouveautes").innerHTML = "";
  const res = Catalogue.chercher(texte);
  afficherResultatsRecherche(res, res.length ? `${res.length >= 40 ? "40 premiers résultats" : res.length + " résultat(s)"} : touchez la bonne figurine.`
    : "Aucune figurine trouvée. Essayez un autre mot (en anglais).");
  // plusieurs résultats d'une même série à collectionner : proposer de voir (et d'ajouter) toute la série
  const compte = {};
  for (const f of res) if (/^Collectible Minifigures/i.test(f.categorie || "")) compte[f.categorie] = (compte[f.categorie] || 0) + 1;
  const [serie, n] = Object.entries(compte).sort((a, b) => b[1] - a[1])[0] || [];
  if (serie && n >= 2) {
    $("recherche-serie").innerHTML = `<button class="bouton bleu">📦 Voir toute la série « ${echapper(nomSerie(serie))} »</button>`;
    $("recherche-serie").firstElementChild.addEventListener("click", () => afficherSerie(serie));
  }
}

const nomSerie = c => c.replace(/^Collectible Minifigures\s*\/\s*/i, "🎁 Minifigs ").replace(/\s*\/\s*/g, " · ");

// Toutes les figurines d'une série (toutes années), avec le bouton pour les ajouter d'un coup
function afficherSerie(categorie, figs) {
  figs = figs || Catalogue.liste.filter(f => f.categorie === categorie).sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  // série à collectionner : seulement les figurines (pas le trophée ou le socle vendus avec)
  if (/^Collectible Minifigures/i.test(categorie) && figs.some(f => /^col/i.test(f.code))) figs = figs.filter(f => /^col/i.test(f.code));
  afficherResultatsRecherche(figs, `${nomSerie(categorie)} : ${figs.length} figurines. Touchez-en une, ou ajoutez toute la série.`);
  $("recherche-serie").innerHTML = `<label for="serie-nombre" class="etiquette-champ">Nombre de séries complètes que vous avez</label>
    <input id="serie-nombre" class="champ" type="number" inputmode="numeric" min="1" max="50" value="1">
    <button class="gros-bouton vert" id="serie-ajouter">➕ Ajouter toute la série (${figs.length} figurines)</button>`;
  $("serie-nombre").addEventListener("input", () => {
    const n = Math.max(1, parseInt($("serie-nombre").value, 10) || 1);
    $("serie-ajouter").textContent = n > 1 ? `➕ Ajouter ${n} séries complètes (${n * figs.length} figurines)` : `➕ Ajouter toute la série (${figs.length} figurines)`;
  });
  $("serie-ajouter").addEventListener("click", () => ajouterSerie(categorie, figs, Math.max(1, parseInt($("serie-nombre").value, 10) || 1)));
  $("recherche-serie").scrollIntoView({ behavior: "smooth" });
}

// Ajoute d'un coup les figurines d'une série qui ne sont pas encore dans la collection
async function ajouterSerie(categorie, figs, series = 1) {
  const prep = figs.map(f => EcranSet._preparer({ nom: f.nom, quantite: 1, ressemblance: 1 }, f.code, true)).filter(f => f.code);
  // n séries complètes : chaque figurine en n exemplaires, en comptant ceux déjà dans la collection
  const nouvelles = prep.flatMap(f => Array(Math.max(0, series - f.deja.length)).fill(f));
  const onglets = [...new Set(nouvelles.map(f => f.onglet))];
  const deja = prep.reduce((n, f) => n + Math.min(series, f.deja.length), 0);
  if (!nouvelles.length) { await demander(series > 1 ? `Vous avez déjà ${series} exemplaires de chaque figurine de cette série.` :
    "Toutes les figurines de cette série sont déjà dans votre collection.", "OK", "Fermer"); return; }
  if (!(await demander(`Ajouter ${nouvelles.length} figurine(s) de « ${nomSerie(categorie)} »${series > 1 ? ` (${series} séries complètes)` : ""} ` +
      `dans l'onglet ${onglets.map(o => `« ${o} »`).join(", ")} ?` +
      (deja ? `\n\n${deja} exemplaire(s) déjà dans votre collection : pas ajouté(s).` : ""), "Ajouter", "Annuler"))) return;
  afficher("chargement");
  const ajoutees = [];
  try {
    for (const f of nouvelles) {
      $("texte-chargement").textContent = `Ajout des figurines… (${ajoutees.length + 1} sur ${nouvelles.length})`;
      const choix = f.theme === STAR_WARS ? { camp: f.camp } : { theme: f.theme };
      const res = await ajouterFigurine(etat.classeur, { code: f.code, nom: nomPourFichier(f.nomBL || f.code), ...choix });
      ajoutees.push(`${f.code} → ${res.onglet}, case ${res.ref}`);
      etat.nonEnregistres++;
    }
    await memoriser();
    await relireContenu();
    afficher("accueil");
    await demander(`${ajoutees.length} figurine(s) ajoutée(s) :\n${ajoutees.join("\n")}\n\nPensez à enregistrer le fichier.`, "OK", "Fermer");
  } catch (err) {
    console.error(err);
    const m = await Memoire.lire(); // retour à la dernière version gardée dans le téléphone
    if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
    afficher("recherche");
    await demander("L'ajout a échoué" + (ajoutees.length ? ` après ${ajoutees.length} figurine(s)` : "") + " : " + err.message, "OK", "Fermer");
  }
}

function afficherResultatsRecherche(res, info) {
  const zone = $("recherche-resultats");
  $("recherche-info").textContent = info;
  $("recherche-serie").innerHTML = "";
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

// Séries récentes : un bouton par série ; touché, il montre toutes les figurines de la série
function afficherNouveautes() {
  const series = Catalogue.seriesRecentes();
  $("recherche-info").textContent = series.length
    ? "Tapez un nom (au moins 2 lettres), ou touchez une série récente :" : "Tapez au moins 2 lettres.";
  const nFig = typeof Nouveautes !== "undefined" ? Nouveautes.liste.filter(n => n.type === "figurine").length : 0;
  $("recherche-nouveautes").innerHTML = (typeof Nouveautes !== "undefined" ? `<p class="aide nouveautes-maj">🆕 Sorties LEGO ${
      Nouveautes.date ? `à jour du ${echapper(Nouveautes.dateLisible())} (${nFig} nouvelles figurines)` : "pas encore chargées"}
      <button class="petit" data-actualiser-nouveautes>🔄 Actualiser</button></p>` : "") +
    series.map((s, i) =>
    `<button class="petit" data-serie="${i}">${echapper(nomSerie(s.categorie))} <span class="score">${s.annee} · ${s.n}</span></button>`).join("");
  const maj = $("recherche-nouveautes").querySelector("[data-actualiser-nouveautes]");
  if (maj) maj.addEventListener("click", async () => {
    maj.disabled = true; maj.textContent = "Actualisation…";
    await Nouveautes.actualiser();
    toast(Nouveautes.date ? `Nouveautés à jour du ${Nouveautes.dateLisible()} ✔` : "Nouveautés indisponibles (réseau ?)");
    lancerRecherche();
  });
  $("recherche-nouveautes").querySelectorAll("[data-serie]").forEach(b => b.addEventListener("click", () => {
    const s = series[+b.dataset.serie];
    afficherSerie(s.categorie, Catalogue.parCategorie(s.categorie));
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
  // figurine JB revendue par brickshellcases.com : son numéro d'article JB est connu
  const f = CatalogueJB.parLien(lien);
  if (f && f.code.startsWith("JB-")) return f.code;
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

// info : message à afficher au-dessus des résultats (ex. nom lu sur un blister) au lieu du texte habituel
function ouvrirCustom(info) {
  $("custom-photo").removeAttribute("src");
  $("custom-lien").value = "";
  delete $("custom-lien").dataset.ebayAuto;
  $("custom-nom").value = "";
  $("custom-recherche").value = "";
  $("custom-exemplaire").value = "";
  $("custom-serie").value = "";
  $("custom-non-numerote").checked = false;
  if ($("custom-nombre-nombre")) $("custom-nombre-nombre").value = 1; // 1 par défaut : plusieurs exemplaires, c'est l'exception
  [...$("custom-numeros").querySelectorAll("input")].slice(1).forEach(c => c.remove());
  $("custom-resultats").innerHTML = "";
  $("custom-choisie").innerHTML = "";
  delete $("custom-nom").dataset.auto;
  afficher("custom");
  majCustom();
  $("custom-indice").innerHTML = "";
  $("btn-encadrer-nom").hidden = true;
  $("custom-recherche-info").textContent = info || "";
  if (info) return;
  CatalogueJB.charger()
    .then(l => {
      const { jb, brickshell, archive, ebay, album } = CatalogueJB.nb;
      const autres = brickshell + archive + ebay + album;
      const retirees = autres ? ` + ${autres} plus en vente chez JB (brickshellcases.com, archives, eBay.de, photos de collectionneurs)` : "";
      $("custom-recherche-info").textContent = `${jb} figurines JB Spielwaren (catalogue du ${new Date(CatalogueJB.date).toLocaleDateString("fr-FR")})${retirees}. Sinon, collez un lien plus bas.`;
    })
    .catch(() => { $("custom-recherche-info").textContent = "Catalogue JB indisponible : collez le lien de la figurine plus bas."; });
}

function chercherJB() {
  afficherResultatsJB(CatalogueJB.chercher($("custom-recherche").value));
}

function afficherResultatsJB(res) {
  $("custom-resultats").innerHTML = res.map((f, i) => `
    <button class="proposition" data-jb="${i}">
      ${f.image ? `<img src="${echapper(f.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<img data-ma-photo="${echapper(f.code)}" alt="">`}
      <span class="nom-court">${echapper(f.nom)}</span>
      <span class="score">${echapper(f.ebay ? "Retirée · eBay.de" : f.source === "brickshell" ? "Retirée · brickshellcases" : f.source === "archive" ? "Retirée · archives" : f.source === "album" ? "Photo de collectionneur" : f.categorie)}</span>
    </button>`).join("");
  if (typeof Consulter !== "undefined") Consulter.completerPhotos($("custom-resultats"));
  $("custom-resultats").querySelectorAll("[data-jb]").forEach(b => b.addEventListener("click", () => choisirJB(res[+b.dataset.jb])));
}

// Remplit le lien et le nom d'après la figurine choisie dans le catalogue JB
function choisirJB(f) {
  $("custom-lien").value = f.lien;
  delete $("custom-lien").dataset.ebayAuto;
  $("custom-nom").value = nomCustomPourFichier(f.nom);
  delete $("custom-nom").dataset.auto;
  $("custom-resultats").innerHTML = "";
  $("custom-recherche").value = "";
  $("custom-choisie").innerHTML = `
    <div class="fiche">
      ${f.image ? `<img class="photo" src="${echapper(f.image)}" alt="" onerror="this.style.visibility='hidden'">` : `<img class="photo" data-ma-photo="${echapper(f.code)}" alt="">`}
      <div class="infos"><div class="nom-court">${echapper(f.nom)}</div><div class="lieu">${echapper(f.categorie)} · ${echapper(f.ebay ? "retirée de la vente, vue sur eBay.de" : f.source === "brickshell" ? `${f.code} · plus en vente chez JB, vendue par brickshellcases.com` : f.source === "archive" ? `${f.code} · plus en vente, retrouvée dans les archives du site JB` : f.code)}</div></div>
      ${liensFiche(f.lien, f.ebay ? "Chercher sur eBay.de" : "Voir la page")}
    </div>`;
  if (typeof Consulter !== "undefined") Consulter.completerPhotos($("custom-choisie"));
  majCustom();
}

// Blister JB : photo du blister entier -> lecture du nom sur le carton + indice Brickognize ;
// si le nom n'est pas trouvé, on peut encadrer le nom soi-même
let photoBlister = null;
let indiceBlister = [];

// « 📦 Photographier un blister » : même chemin que le recensement (recto, verso, identification, n° déjà
// recensés) ; la figurine est ajoutée en même temps à l'onglet Customs du fichier Excel (case cochée par défaut)
$("input-blister").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  await Base.ouvrir();
  Base.lirePhoto(f);
});

// N° corrigé dans le recensement : même correction dans l'onglet Customs (case « Nom 12/50 » et ligne de la Table camps).
// Rend un compte rendu court, ou "" s'il n'y a rien à corriger.
async function corrigerNumeroCustoms({ code, nom, ancien, serie, nouveau, nouvelleSerie }) {
  if (!etat.classeur || !ancien) return "";
  const onglet = THEME_CUSTOMS.onglet, o = etat.collection[onglet];
  if (!o) return "";
  const f = code && CatalogueJB.trouver ? CatalogueJB.trouver(code) : null;
  const codeXL = code && /^JB-/i.test(code) ? code : f && f.lien ? codeCustom(f.lien) : "";
  const ancienEchappe = String(ancien).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fin = new RegExp(`\\s${ancienEchappe}\\s*(?:\/\\s*\\d+)?\\s*$`);
  const cas = o.cases.find(c => c.nom && fin.test(c.nom) && (codeXL ? c.code.toUpperCase() === codeXL.toUpperCase()
    : normaliser(c.nom).startsWith(normaliser(nom).split(" ")[0])));
  if (!cas) return "";
  const s = nouvelleSerie || serie;
  const nomXL = cas.nom.replace(fin, nouveau ? ` ${nouveau}${s ? "/" + s : ""}` : "");
  try {
    await etat.classeur.ecrireTexte(onglet, lettreColonne(6 + cas.col) + cas.row, nomXL);
    const derniere = await etat.classeur.derniereLigne(ONGLET_TABLE);
    for (let r = 2; r <= derniere; r++)
      if (String(await etat.classeur.valeur(ONGLET_TABLE, "E" + r) || "").startsWith(`${onglet}!${cas.ref} `)) {
        await etat.classeur.ecrireTexte(ONGLET_TABLE, "B" + r, nomXL); break;
      }
    etat.nonEnregistres++;
    await memoriser();
    await relireContenu();
    return `fichier Excel corrigé (${onglet}, case ${cas.ref}) : pensez à « Enregistrer »`;
  } catch (err) {
    console.error(err);
    return "⚠️ correction du fichier Excel impossible : " + err.message;
  }
}

// Ajout à l'onglet Customs depuis le recensement : un exemplaire par n° (« 44/150 »), n° déjà présents écartés.
// Rend un compte rendu à afficher.
async function ajouterCustomsDepuisBase({ nom, precision, code, numeros, serie, nonNumerote }) {
  if (!etat.classeur) return "";
  const f = code && CatalogueJB.trouver ? CatalogueJB.trouver(code) : null;
  const lien = f && f.lien ? f.lien : lienRechercheEbay(nom);
  const codeXL = codeCustom(lien);
  const nomXL = [f ? nomCustomPourFichier(f.nom) : nom.replace(/\w\S*/g, m => m[0] + m.slice(1).toLowerCase()), precision].filter(Boolean).join(" – ");
  const deja = numerosEnregistres(codeXL), num = x => x.split("/")[0];
  const liste = numeros.map(x => nonNumerote || !x ? "" : serie ? `${x}/${serie}` : x);
  const ecartes = liste.filter(x => x && Object.keys(deja).some(k => num(k) === num(x)));
  const aAjouter = liste.filter(x => !ecartes.includes(x));
  if (!aAjouter.length) return `Fichier Excel : n° ${ecartes.join(", ")} déjà dans l'onglet Customs, rien ajouté.`;
  const onglet = THEME_CUSTOMS.onglet;
  try {
    let res;
    for (const x of aAjouter) {
      res = await ajouterFigurine(etat.classeur, { code: codeXL, nom: [nomXL, x].filter(Boolean).join(" "), theme: onglet, lien });
      etat.nonEnregistres++;
    }
    const octets = await memoriser();
    if (!(await verifierAjout(octets, { onglet, row: res.row, col: res.col, code: codeXL }))) throw new Error("vérification après écriture échouée");
    await relireContenu();
    return `Fichier Excel : ${aAjouter.length > 1 ? `${aAjouter.length} exemplaires ajoutés` : "ajoutée"} dans ${onglet} (${codeXL}), avec étiquette` +
      (ecartes.length ? ` ; n° ${ecartes.join(", ")} déjà présent(s), non ajouté(s)` : "") + ". Pensez à « Enregistrer ».";
  } catch (err) {
    console.error(err);
    const m = await Memoire.lire();
    if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
    return "⚠️ L'ajout au fichier Excel a échoué : " + err.message + " (le blister est bien dans votre base de blisters).";
  }
}

// Blisters du catalogue JB au décor le plus ressemblant à la photo (vide si indisponible)
let decorBlister = [];
async function comparerDecor(fichier) {
  try {
    await CatalogueJB.chargerEmpreintes();
    return CatalogueJB.classerParDecor(await createImageBitmap(fichier), 10);
  } catch (e) {
    console.warn("comparaison du décor impossible", e);
    return [];
  }
}

// Repli : on encadre soi-même le nom sur la photo du blister (bouton, ou directement si la photo
// entière n'a rien donné)
let indiceEnCours = Promise.resolve([]);
$("btn-encadrer-nom").addEventListener("click", () =>
  encadrerNom("Encadrez SEULEMENT le nom de la figurine (le petit cadre du blister)."));

async function encadrerNom(consigne) {
  if (!photoBlister) return;
  $("recadrage-titre").textContent = consigne;
  const morceau = await Recadrage.ouvrir(photoBlister).catch(() => null);
  if (!morceau) {
    afficher("custom");
    indiceBlister = await indiceEnCours;
    afficherIndice(indiceBlister);
    return;
  }
  $("photo-apercu").src = URL.createObjectURL(morceau);
  $("texte-chargement").textContent = "Lecture du nom…";
  afficher("chargement");
  let texte = "";
  try { texte = await Blister.lire(morceau); } catch (err) { console.error(err); }
  afficherLectureBlister(texte, CatalogueJB.rapprocher(texte).length > 0, true);
  indiceBlister = await indiceEnCours;
  afficherIndice(indiceBlister);
}

// Combine le nom lu et le décor : nom confirmé par le décor, ou blisters au décor ressemblant
function afficherLectureBlister(texte, trouve, encadre) {
  const res = trouve ? CatalogueJB.rapprocher(texte) : [];
  // sans correspondance : nom le plus probable parmi le texte lu (figurine absente de nos listes)
  const lu = res.length ? nomDansTexte(texteAutourDuNom(texte, res[0])) : nomProbable(texte) || (encadre ? nomDansTexte(texte) : "");
  const decor = decorBlister.map(d => d.f);
  const confirme = res.length && decor.some(d => d.code === res[0].code);
  // décor connu seulement pour les blisters du site JB (pas pour les figurines vues sur eBay.de)
  const decorConnu = res.length && CatalogueJB.empreintes && CatalogueJB.empreintes.has(res[0].code.toUpperCase());
  const nomCourt = f => f.nom.replace(/\s*c[ou]s?t[ou]m\s+minifig\w*/i, "");
  const inconnu = `Nom lu : « ${lu} ». Il n'est dans aucune de nos listes (site JB, brickshellcases, eBay.de) : il est repris ci-dessous, vérifiez-le. Le QR code ouvrira une recherche eBay.de sur ce nom (sans résultat tant que personne ne la vend).`;
  let info;
  if (res.length) {
    info = `Nom trouvé sur le blister : « ${nomCourt(res[0])} ».` +
      (confirme ? " ✔ Confirmé par le décor du blister." : decor.length && decorConnu ? " Le décor ne permet pas de le confirmer : vérifiez." : "") +
      " Touchez la bonne figurine :";
  } else if (decor.length) {
    info = (lu ? inconnu + " Si c'est l'un de ces blisters au décor ressemblant, touchez-le :"
               : "Le nom n'a pas été trouvé sur le blister. Voici les blisters dont le décor ressemble le plus à votre photo ; touchez le bon, ou « Encadrer le nom moi-même » :");
  } else {
    info = lu ? inconnu
      : encadre ? "Le nom n'a pas pu être lu. Cherchez la figurine avec un mot, ou tapez son nom ci-dessous."
      : "Le nom n'a pas été trouvé sur la photo entière (reflet, photo floue ?). Touchez « Encadrer le nom moi-même », ou cherchez la figurine avec un mot.";
  }
  ouvrirCustom(info);
  // la photo du blister reste visible (déjà remise d'aplomb si le carton était de travers)
  if (photoBlister) $("custom-photo").src = URL.createObjectURL(photoBlister);
  $("btn-encadrer-nom").hidden = !photoBlister;
  // n° d'exemplaire : seulement s'il est lisible (il est souvent écrit à la main)
  const ex = exemplaireDansTexte(texte);
  if (ex && encadre) {
    const [numero, serie] = ex.split("/");
    $("custom-exemplaire").value = numero || "";
    if (serie) $("custom-serie").value = serie;
  }
  if (res.length) {
    // le nom d'abord ; s'il n'est pas confirmé, les 3 décors les plus ressemblants ensuite
    const autres = confirme ? [] : decor.filter(d => !res.some(r => r.code === d.code)).slice(0, 3);
    afficherResultatsJB([...res, ...autres]);
    return;
  }
  if (decor.length) afficherResultatsJB(decor.slice(0, 6));
  if (lu) {
    // figurine absente de nos listes : QR code vers une recherche eBay.de sur son nom (vide pour
    // l'instant, elle montrera les annonces dès que la figurine sera mise en vente)
    $("custom-nom").value = lu.toUpperCase();
    $("custom-lien").value = lienRechercheEbay(lu);
    $("custom-lien").dataset.ebayAuto = "1";
    majCustom();
  }
}

// Pour l'affichage : la ligne du texte lu qui contient le nom trouvé
function texteAutourDuNom(texte, fig) {
  const mots = normaliser(fig.nom).split(/[^a-z0-9]+/).filter(m => m.length >= 4);
  return (texte.split("\n").find(l => mots.some(m => normaliser(l).includes(m))) || "");
}

// Indice Brickognize : figurine officielle LEGO la plus ressemblante (utile aussi pour un blister officiel)
async function indiceBrickognize(fichier) {
  try {
    const photo = await Recadrage.reduire(fichier);
    const items = await interrogerBrickognize(photo);
    return items.slice(0, 5);
  } catch (e) {
    console.warn("Brickognize indisponible", e);
    return [];
  }
}

function afficherIndice(items) {
  const zone = $("custom-indice");
  if (!items || !items.length) { zone.innerHTML = ""; return; }
  const it = items[0];
  zone.innerHTML = `
    <div class="alerte info">
      🔎 Selon Brickognize, la figurine ressemble à la figurine officielle <b>${echapper(it.nom)}</b> (${echapper(it.id)}${it.score != null ? `, ${Math.round(it.score * 100)} %` : ""}).
      <button class="bouton-lien" id="btn-officielle">C'est une figurine officielle LEGO ? Voir les propositions</button>
    </div>`;
  $("btn-officielle").addEventListener("click", () => {
    etat.photos = photoBlister ? [{ url: URL.createObjectURL(photoBlister), items }] : [];
    etat.origine = "recherche";
    etat.candidats = items;
    choisirCandidat(0);
  });
}

let minuteurJB;
$("custom-recherche").addEventListener("input", () => {
  clearTimeout(minuteurJB);
  minuteurJB = setTimeout(chercherJB, 250);
});

function majCustom() {
  const lien = lienDansTexte($("custom-lien").value);
  const code = codeCustom(lien);
  const nom = $("custom-nom");
  const propose = nomDepuisLien(lien);
  if (propose && (!nom.value || nom.dataset.auto)) { nom.value = propose; nom.dataset.auto = "1"; }
  $("custom-code").textContent = `Code de l'étiquette : ${code}` +
    (code.startsWith("JB-") ? " (numéro d'article JB Spielwaren)" : lien ? "" : " — pas de lien : étiquette sans QR code");
  const n = $("custom-nombre-nombre") ? $("custom-nombre-nombre").value : 1;
  const nums = Object.keys(numerosEnregistres(code));
  $("custom-alerte").innerHTML = blocExemplaires(code, "custom-nombre") +
    (nums.length ? `<p class="score">N° déjà enregistrés : ${echapper(nums.join(", "))}</p>` : "");
  $("custom-nombre-nombre").value = n;
  $("custom-nombre-nombre").addEventListener("input", majNumerosCustom);
  if (nums.length && !$("custom-serie").value) $("custom-serie").value = nums[0].split("/")[1];
  majNumerosCustom();
  const onglet = etat.classeur.aOnglet(THEME_CUSTOMS.onglet) ? THEME_CUSTOMS.onglet : ONGLET_MODELE;
  dimensionsCase(etat.classeur, onglet, 1, 2).then(({ w, h }) => {
    $("custom-apercu").innerHTML = "";
    $("custom-apercu").appendChild(dessinerEtiquette(code, THEME_CUSTOMS.couleur, w, h, lien || null));
  });
}

// Un champ de numéro par exemplaire à ajouter ; « Non numérotée » les masque
function majNumerosCustom() {
  const zone = $("custom-numeros");
  const n = Math.min(99, Math.max(1, parseInt(($("custom-nombre-nombre") || {}).value, 10) || 1));
  const champs = [...zone.querySelectorAll("input")];
  for (let i = champs.length; i < n; i++)
    zone.insertAdjacentHTML("beforeend", `<input class="champ" inputmode="numeric" autocomplete="off" placeholder="n° ${i + 1}">`);
  [...zone.querySelectorAll("input")].forEach((c, i) => { if (i >= n) c.remove(); });
  $("custom-numeros-titre").textContent = n > 1 ? `N° des ${n} exemplaires (écrits sur les blisters)` : "N° de l'exemplaire (écrit sur le blister)";
  $("custom-bloc-numeros").hidden = $("custom-non-numerote").checked;
}
$("custom-non-numerote").addEventListener("change", majNumerosCustom);

// Recherche eBay.de d'une figurine JB par son nom (même forme que les liens de data/jb_ebay.tsv)
function lienRechercheEbay(nom) {
  const mots = nom.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim();
  return "https://www.ebay.de/sch/i.html?_nkw=" + encodeURIComponent("JB Spielwaren " + mots).replace(/%20/g, "+");
}

let minuteurCustom;
for (const id of ["custom-lien", "custom-nom"]) {
  $(id).addEventListener("input", e => {
    if (id === "custom-nom") delete $("custom-nom").dataset.auto; // nom tapé à la main : on n'y touche plus
    if (id === "custom-lien") delete $("custom-lien").dataset.ebayAuto; // lien tapé à la main : idem
    // nom corrigé : la recherche eBay.de proposée d'office suit le nom
    if (id === "custom-nom" && $("custom-lien").dataset.ebayAuto && $("custom-nom").value.trim())
      $("custom-lien").value = lienRechercheEbay($("custom-nom").value);
    clearTimeout(minuteurCustom);
    minuteurCustom = setTimeout(majCustom, 250);
  });
}

async function ajouterCustom() {
  const lien = lienDansTexte($("custom-lien").value);
  const code = codeCustom(lien);
  // n° d'exemplaire : un par exemplaire ajouté, séparés par des virgules (ex. « 12/50, 31/50 »)
  const nonNumerote = $("custom-non-numerote").checked;
  const serie = $("custom-serie").value.trim().replace(/\D/g, "");
  const numeros = nonNumerote ? [] : [...$("custom-numeros").querySelectorAll("input")].map(c => c.value.trim())
    .flatMap(v => v.split(/[,;]/)).map(v => v.trim().replace(/\s*(?:of|sur|von)\s*/i, "/").replace(/\s+/g, "")).filter(Boolean)
    .map(v => v.includes("/") ? v : serie ? `${v}/${serie}` : v);
  if (!$("custom-nom").value.trim()) { await demander("Donnez un nom à la figurine.", "OK", "Fermer"); return; }
  const n = Math.min(99, Math.max(1, parseInt(($("custom-nombre-nombre") || {}).value, 10) || 1, numeros.length));
  // blister numéroté : un numéro déjà enregistré est un doublon (le même blister), pas un exemplaire de plus
  const deja = numerosEnregistres(code);
  const num = x => x.split("/")[0];
  const doublons = numeros.map(x => [x, Object.keys(deja).find(k => num(k) === num(x))]).filter(([, k]) => k).map(([x, k]) => `${x} (${deja[k]})`);
  const tapesDeuxFois = numeros.filter((x, i) => numeros.findIndex(y => num(y) === num(x)) !== i);
  if (doublons.length || tapesDeuxFois.length) {
    await demander((doublons.length ? `Déjà enregistré : n° ${doublons.join(", ")}.\nC'est le même blister : il n'est pas ajouté une 2e fois.` : "") +
      (tapesDeuxFois.length ? `${doublons.length ? "\n\n" : ""}N° tapé deux fois : ${tapesDeuxFois.join(", ")}.` : "") +
      "\n\nCorrigez les numéros, puis réessayez.", "OK", "Fermer");
    return;
  }
  if (!nonNumerote && numeros.length < n && !(await demander(`${n} exemplaire(s), mais ${numeros.length} numéro(s) tapé(s) : ` +
      `les autres seront enregistrés sans numéro. Continuer ?`, "Continuer", "Annuler"))) return;
  if (!(await confirmerExemplaires(code, $("custom-nom").value.trim(), n))) return;
  const nomDe = i => [$("custom-nom").value.trim(), numeros[i] || (numeros.length === 1 && n === 1 ? numeros[0] : "")].filter(Boolean).join(" ");
  const onglet = THEME_CUSTOMS.onglet;
  const nouvelOnglet = !etat.classeur.aOnglet(onglet);
  $("texte-chargement").textContent = "Ajout dans le fichier…";
  $("photo-apercu").removeAttribute("src");
  afficher("chargement");
  try {
    const cases = [];
    let res;
    for (let i = 0; i < n; i++) {
      res = await ajouterFigurine(etat.classeur, { code, nom: nomDe(i), theme: onglet, lien });
      cases.push(res.ref);
      etat.nonEnregistres++;
    }
    const octets = await memoriser();
    if (!(await verifierAjout(octets, { onglet, row: res.row, col: res.col, code }))) throw new Error("vérification après écriture échouée");
    await relireContenu();
    const total = ouFigurine(code).length;
    $("texte-ok").textContent = (n > 1 ? `${n} exemplaires ajoutés dans ${onglet}, cases ${cases.join(", ")}` : `Ajoutée dans ${onglet}, case ${res.ref}`) +
      (nouvelOnglet ? " (nouvel onglet créé)" : "") + (total > 1 ? ` · ${total} exemplaires dans la collection` : "");
    const { w, h } = await dimensionsCase(etat.classeur, onglet, res.row, res.col);
    $("apercu-ok").innerHTML = "";
    $("apercu-ok").appendChild(dessinerEtiquette(code, THEME_CUSTOMS.couleur, w, h, lien || null));
    preparerSuivante("custom");
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
  // nom parlant, le même pour tout le monde : « Figotheque_ma_collection_<date>.xlsx » (sans date en enregistrement direct)
  const nom = `${NOM_FICHIER}_${horodatage()}.xlsx`;
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
  // enregistrement direct : l'emplacement choisi la première fois (ex. Google Drive) est retenu
  const poignee = ENREGISTREMENT_DIRECT ? await Memoire.lire("poignee") : null;
  $("bloc-direct").hidden = !ENREGISTREMENT_DIRECT;
  $("bloc-telechargement").open = !ENREGISTREMENT_DIRECT;
  $("titre-telechargement").textContent = ENREGISTREMENT_DIRECT
    ? "Autre méthode : télécharger, puis importer dans Google Drive" : "Télécharger, puis importer dans Google Drive";
  $("btn-direct").textContent = poignee ? `💾 Enregistrer dans « ${poignee.name} »` : "💾 Enregistrer";
  $("aide-direct").textContent = poignee
    ? "Le fichier est remplacé par la nouvelle version (Google Drive garde les versions précédentes)."
    : "La première fois, choisissez l'emplacement : touchez ☰ puis « Drive », choisissez le dossier, puis « Enregistrer ». Ensuite, un seul appui suffira.";
  $("btn-ailleurs").hidden = !poignee;
  // enregistrement direct : nom fixe (sans date), celui du fichier déjà choisi le cas échéant
  if (ENREGISTREMENT_DIRECT) $("nom-save").textContent = poignee ? poignee.name : nomSansDate(nom);
  afficher("save");
}

// Enregistrement direct dans un fichier choisi une fois avec la fenêtre d'enregistrement du téléphone
// (File System Access) ; son « adresse » est gardée dans le téléphone pour les fois suivantes
const ENREGISTREMENT_DIRECT = "showSaveFilePicker" in window;
const NOM_FICHIER = "Figotheque_ma_collection";
const nomSansDate = nom => nom.replace(/_\d{4}-\d{2}-\d{2}_\d{2}h\d{2}\.xlsx$/i, ".xlsx");
async function enregistrerDirect(ailleurs) {
  let poignee = ailleurs ? null : await Memoire.lire("poignee");
  // ancien fichier (ex. « etiquettes figurines LEGO … ») : on propose une fois d'enregistrer sous le nouveau nom ;
  // l'ancien reste tel quel, en sauvegarde
  if (poignee && !poignee.name.startsWith(NOM_FICHIER) && !(await Memoire.lire("renommage-propose"))) {
    await Memoire.ecrire(true, "renommage-propose");
    if (await demander(`Votre fichier s'appelle « ${poignee.name} ».\n\nL'enregistrer désormais sous un nom plus parlant, « ${NOM_FICHIER}.xlsx », ` +
        "dans le dossier de votre choix ? L'ancien fichier reste tel quel, comme sauvegarde.", "Oui, renommer", "Garder l'ancien nom")) poignee = null;
  }
  try {
    if (poignee && (await poignee.requestPermission({ mode: "readwrite" })) !== "granted") poignee = null;
    if (!poignee) {
      poignee = await window.showSaveFilePicker({
        suggestedName: nomSansDate(etat.dernierFichier.name),
        types: [{ description: "Fichier Excel", accept: { [etat.dernierFichier.type]: [".xlsx"] } }],
      });
      await Memoire.ecrire(poignee, "poignee");
    }
    const flux = await poignee.createWritable();
    await flux.write(etat.dernierFichier);
    await flux.close();
    await fichierEnregistre(poignee.name);
    afficher("accueil");
  } catch (err) {
    if (err.name === "AbortError") return; // fenêtre fermée sans enregistrer
    console.error(err);
    await demander(`L'enregistrement direct n'a pas marché (${err.message}).\n\n` +
      "Utilisez l'autre méthode : « Télécharger », puis importer dans Google Drive.", "OK", "Fermer");
    $("bloc-telechargement").open = true;
  }
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

async function fichierEnregistre(nom = etat.dernierFichier.name) {
  etat.nonEnregistres = 0;
  etat.nomFichier = nom;
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

// « Figurine suivante » : même chemin que la figurine qu'on vient d'ajouter (photo -> appareil photo tout de suite,
// recherche par nom, custom) ; « Retour à l'accueil » pour changer de catégorie
function preparerSuivante(chemin) {
  etat.suivante = chemin;
  $("btn-suivante").textContent = chemin === "photo" ? "📷 Photographier la figurine suivante"
    : chemin === "custom" ? "🎨 Custom suivante" : "🔍 Chercher la figurine suivante";
}

// ---------- boutons ----------

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action === "accueil") afficher(etat.classeur ? "accueil" : "fichier");
  else if (action === "suivante") {
    if (etat.suivante === "photo") { afficher("accueil"); $("input-photo").click(); } // appareil photo ouvert dans le même geste
    else if (etat.suivante === "custom") ouvrirCustom();
    else if (etat.suivante === "recherche") { etat.photos = []; ouvrirRecherche(); }
    else afficher(etat.classeur ? "accueil" : "fichier");
  }
  else if (action === "saisie") ouvrirSaisie();
  else if (action === "nouveautes") { $("recherche-texte").value = ""; ouvrirRecherche(true); }
  else if (action === "collection") Collection.ouvrir();
  else if (action === "custom") { photoBlister = null; ouvrirCustom(); }
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
  else if (action === "enregistrer-direct") enregistrerDirect(false);
  else if (action === "enregistrer-ailleurs") enregistrerDirect(true);
  else if (action === "regenerer") regenerer();
  else if (action === "changer-fichier") {
    if (etat.nonEnregistres && !(await demander("Des ajouts n'ont pas été enregistrés. Les abandonner ?"))) return;
    await Memoire.effacer();
    await Memoire.ecrire(null, "poignee");
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
