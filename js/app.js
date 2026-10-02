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
  if (ecran !== ecranActuel && typeof Occupe !== "undefined" && Occupe.bouton && !Occupe.bouton.closest("#ecran-" + ecran)) Occupe.liberer();
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
  const fleche = document.getElementById("bouton-retour-entete"); // flèche du bandeau rouge (ordinateur, iPhone…)
  if (fleche) fleche.hidden = aLaRacine() || ECRANS_PASSAGE.includes(ecran);
  if (typeof Arborescence !== "undefined") Arborescence.suivre(ecran);
}

// Flèche ← du bandeau : même chose que le bouton retour du téléphone, pour les appareils qui n'en ont pas
function retourEntete() {
  if ($("menu-actions").open) { $("menu-fermer").click(); return; }
  if (pileEcrans.length) afficher(pileEcrans.pop(), true);
  else afficher(etat.classeur ? "accueil" : "fichier", true);
}
// Le nom de l'appli, dans le bandeau, ramène à l'accueil
document.getElementById("titre-appli").addEventListener("click", () => {
  if (!aLaRacine() && !ECRANS_PASSAGE.includes(ecranActuel)) afficher(etat.classeur ? "accueil" : "fichier");
});

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

const VERSION_APPLI = "v99"; // même numéro que le cache de sw.js (« briquotheque-vNN »)

// Erreurs inattendues : montrées à l'écran (message) et gardées dans les Outils, pour les signaler
const ERREURS = [];
function noterErreur(texte) {
  const t = `${new Date().toLocaleTimeString("fr-FR")} ${String(texte).slice(0, 300)}`;
  ERREURS.unshift(t); ERREURS.length = Math.min(ERREURS.length, 8);
  const l = document.getElementById("liste-erreurs");
  if (l) { l.textContent = ERREURS.join("\n"); document.getElementById("bloc-erreurs").hidden = false; }
  if (typeof toast === "function") toast("⚠️ Erreur : " + String(texte).slice(0, 160) + " (Outils → 📨 Signaler un problème)", 9000);
}

// Dernières actions (boutons touchés), pour comprendre un blocage sans erreur
const ACTIONS = [];
document.addEventListener("click", e => {
  const b = e.target.closest("button, [data-action], .tuile, label");
  if (!b) return;
  const nom = b.dataset && b.dataset.action || (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
  ACTIONS.unshift(`${new Date().toLocaleTimeString("fr-FR")} ${typeof ecranActuel !== "undefined" ? ecranActuel : "?"} : ${nom}`);
  ACTIONS.length = Math.min(ACTIONS.length, 15);
}, true);

// Rapport de problème : rien de la collection (ni noms, ni prix, ni photos), seulement l'état de l'appli
function texteRapport(description, idee) {
  if (idee) return ["Suggestion d'amélioration — Briquothèque", `Date : ${new Date().toLocaleString("fr-FR")}`, `Version : ${VERSION_APPLI}`,
                    `Appareil : ${navigator.userAgent}`, "", "Suggestion :", description].join("\n");
  const coll = etat.classeur ? Object.values(etat.collection || {}).reduce((s, o) => s + o.cases.filter(c => c.code).length, 0) : 0;
  return [
    "Rapport de problème — Briquothèque",
    `Date : ${new Date().toLocaleString("fr-FR")}`,
    `Version : ${VERSION_APPLI}`,
    `Rangement : ${!etat.classeur ? "aucune collection ouverte" : etat.classeur.estBase ? "collection dans l'appli" : "fichier Excel"} (${coll} figurines)`,
    `Écran : ${typeof ecranActuel !== "undefined" ? ecranActuel : "?"} · travaux en cours : ${typeof Occupe !== "undefined" ? Occupe.enCours : "?"}`,
    `Appareil : ${navigator.userAgent}`,
    `Écran : ${screen.width}×${screen.height}, en ligne : ${navigator.onLine ? "oui" : "non"}`,
    "",
    "Ce qui se passe :", description || "(non décrit)",
    "",
    "Erreurs :", ...(ERREURS.length ? ERREURS : ["(aucune)"]),
    "",
    "Dernières actions :", ...(ACTIONS.length ? ACTIONS.slice(1) : ["(aucune)"]),
  ].join("\n");
}

async function envoyerRapport() {
  const choix = await choisirAction("Que voulez-vous envoyer ?", ["🐞 Signaler un problème (bug, blocage)", "💡 Suggérer une amélioration"]);
  if (choix < 0) return;
  const idee = choix === 1;
  const description = await demanderTexte(idee ? "Votre suggestion (ex. « pouvoir trier ma collection par année »)"
    : "Décrivez le problème en une phrase (ex. « le bouton Ajouter reste sur le sablier »)", "");
  if (description === null || (idee && !description.trim())) return;
  const texte = texteRapport(description, idee);
  const titre = idee ? "Suggestion d'amélioration — Briquothèque" : "Rapport de problème — Briquothèque";
  try { if (navigator.share) { await navigator.share({ title: titre, text: texte }); return; } }
  catch (err) { if (err.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(texte); } catch (e) { /* presse-papiers indisponible */ }
  location.href = `mailto:${ADRESSE_RAPPORT}?subject=${encodeURIComponent(titre + " " + VERSION_APPLI)}&body=${encodeURIComponent(texte)}`;
  toast("Message copié : collez-le dans un e-mail si celui-ci ne s'ouvre pas.", 6000);
}
const ADRESSE_RAPPORT = ""; // adresse de réception des rapports (à définir pour la version diffusée)
window.addEventListener("error", e => noterErreur(`${e.message} (${(e.filename || "").split("/").pop()}:${e.lineno})`));
window.addEventListener("unhandledrejection", e => noterErreur(e.reason && (e.reason.stack || e.reason.message) || e.reason));

// Base de données de l'appli : rien à « Enregistrer », la mention est retirée des messages
function sansEnregistrer(texte) {
  if (!(etat.classeur && etat.classeur.estBase)) return texte;
  return String(texte).replace(/\s*\(pensez à « Enregistrer »\)/g, "").replace(/\s*[:.]?\s*[Pp]ensez à « Enregistrer »\.?/g, ".")
    .replace(/fichier Excel corrigé/g, "collection corrigée");
}

function toast(texte, duree = 3500) {
  texte = sansEnregistrer(texte);
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

// Petite question avec une réponse à taper ; renvoie le texte, ou null (Annuler)
function demanderTexte(titre, valeur = "", options = {}) {
  return new Promise(ok => {
    const d = $("menu-actions");
    $("menu-titre").textContent = titre;
    $("menu-boutons").innerHTML = `<input class="champ" id="menu-saisie" autocomplete="off" ${options.chiffres ? 'inputmode="numeric"' : ""}>
      <button class="gros-bouton vert" data-ok>✔ Valider</button>`;
    $("menu-saisie").value = valeur;
    const fin = v => { if (d.open) d.close(); ok(v); };
    $("menu-boutons").onclick = e => { if (e.target.closest("[data-ok]")) fin($("menu-saisie").value.trim()); };
    $("menu-saisie").onkeydown = e => { if (e.key === "Enter") fin($("menu-saisie").value.trim()); };
    $("menu-fermer").onclick = () => fin(null);
    d.oncancel = () => ok(null);
    d.showModal();
    setTimeout(() => { $("menu-saisie").focus(); $("menu-saisie").select(); }, 50);
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
  // une seule connexion, gardée (avant : une nouvelle à chaque lecture ou écriture, jamais refermée)
  _db() {
    if (!this._connexion) this._connexion = ouvrirBaseRenommee("briquotheque-memoire", "etiquettes-figurines", "donnees",
      db => db.createObjectStore("donnees")).then(db => {
        db.onclose = db.onversionchange = () => { this._connexion = null; db.close(); };
        return db;
      }, err => { this._connexion = null; throw err; });
    return this._connexion;
  },
  // Écriture : une transaction annulée (ex. mémoire du téléphone pleine) ne bloque plus l'appli : erreur signalée
  async ecrire(valeur, cle = "classeur") {
    try {
      const db = await this._db();
      await new Promise((ok, ko) => {
        const tx = db.transaction("donnees", "readwrite");
        tx.objectStore("donnees").put(valeur, cle);
        tx.oncomplete = ok;
        tx.onerror = () => ko(tx.error);
        tx.onabort = () => ko(tx.error || new Error("écriture annulée par le téléphone"));
      });
      return true;
    } catch (e) {
      console.warn("Mémoire indisponible", e);
      this._connexion = null;
      if (typeof toast === "function") toast(e && e.name === "QuotaExceededError"
        ? "⚠️ Mémoire du téléphone pleine : l'enregistrement a échoué. Libérez de la place (photos, applis), puis réessayez."
        : "⚠️ Enregistrement dans le téléphone impossible : " + (e && e.message || e), 7000);
      return false;
    }
  },
  async lire(cle = "classeur") {
    try {
      const db = await this._db();
      return await new Promise(ok => {
        const tx = db.transaction("donnees"), r = tx.objectStore("donnees").get(cle);
        r.onsuccess = () => ok(r.result || null);
        r.onerror = () => ok(null);
        tx.onabort = () => ok(null);
      });
    } catch (e) { this._connexion = null; return null; }
  },
  async effacer() { await this.ecrire(null); },
};

// ---------- fichier Excel ----------

// octets absents : la collection est dans la base de données de l'appli (js/base_collection.js), sans fichier Excel
async function chargerClasseur(octets, nom, nonEnregistres = 0) {
  const cl = octets ? await Classeur.ouvrir(octets) : await BaseCollection.ouvrir();
  if (octets) for (const o of [...ONGLETS_COLORES, ONGLET_TABLE]) cl.feuille(o); // vérifie que les 4 onglets existent (« Sets » : créé au besoin)
  etat.classeur = cl;
  etat.nomFichier = nom;
  etat.nonEnregistres = nonEnregistres;
  await relireContenu();
}

async function relireContenu() {
  etat.table = await lireTableCamps(etat.classeur);
  etat.collection = await lireCollection(etat.classeur);
  const nb = Object.values(etat.collection).reduce((s, o) => s + o.cases.filter(c => c.code).length, 0);
  $("fichier-info").textContent = `${etat.classeur.estBase ? "🗄️" : "📗"} Ma collection · ${nb} figurines`;
  document.body.classList.toggle("mode-base", !!etat.classeur.estBase);
  document.body.classList.toggle("base-vide", !!etat.classeur.estBase && !nb);
  if (etat.classeur.estBase) {
    // réglage propre à Mathias : visible seulement si sa collection l'a déjà (reprise de son fichier Excel rangé par camps)
    $("bloc-reglage-camps").hidden = !etat.classeur.aReglage("camps_star_wars");
    $("reglage-camps").checked = etat.classeur.campsSW;
    majInfoSauvegarde();
  } // le fichier Excel n'est qu'une sauvegarde : son nom n'est pas affiché
  majBandeau();
}

function majBandeau() {
  $("bandeau-save").hidden = !etat.nonEnregistres;
  $("bandeau-texte").textContent = etat.nonEnregistres === 1
    ? "1 ajout pas encore enregistré" : `${etat.nonEnregistres} ajouts pas encore enregistrés`;
}

// Sauvegarde dans la mémoire du téléphone après chaque modification
async function memoriser() {
  if (etat.classeur.estBase) { // base de données : déjà écrit, rien à « Enregistrer »
    await etat.classeur.attendre();
    etat.nonEnregistres = 0;
    majBandeau();
    return null;
  }
  const octets = await etat.classeur.enregistrer();
  await Memoire.ecrire({ nom: etat.nomFichier, octets, nonEnregistres: etat.nonEnregistres });
  // on repart du fichier tout juste écrit, pour être sûr de travailler sur ce qui est enregistré
  etat.classeur = await Classeur.ouvrir(octets);
  return octets;
}


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
  if (connu && (CAMPS[connu.camp] || connu.camp === STAR_WARS)) return STAR_WARS;
  if (connu && ONGLETS_THEMES.includes(connu.camp)) return connu.camp;
  const fiche = Catalogue.trouver(cand.id);
  const parCategorie = themeDeCategorie(fiche ? fiche.categorie : "") || themeDeCategorie(cand.categorie);
  if (parCategorie) return parCategorie;
  if (estStarWars(cand)) return STAR_WARS;
  return themeDuCode(cand.id).onglet;
}

// Collection rangée dans l'appli (version diffusable) : un seul onglet Star Wars, sans camps
const swUnique = () => !!(etat.classeur && etat.classeur.estBase && !etat.classeur.campsSW);
function couleurChoisie() {
  if (etat.theme === STAR_WARS && swUnique()) return THEME_STAR_WARS_UNIQUE.couleur;
  return etat.theme === STAR_WARS ? CAMPS[etat.camp].couleur : couleurOnglet(etat.theme);
}
function ongletChoisi() {
  if (etat.theme === STAR_WARS && swUnique()) return THEME_STAR_WARS_UNIQUE.onglet;
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
    ${typeof Souhaits !== "undefined" ? Souhaits.bouton("Figurine", cand.id, cand.nom, cand.categorie || "") : ""}
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
  if (etat.theme === STAR_WARS && swUnique()) {
    $("bloc-camps").hidden = true;
    $("camp-raison").textContent = "Rangée dans l'onglet « Star Wars ».";
    return;
  }
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
      (nouvelOnglet && !etat.classeur.estBase ? " (nouvel onglet créé)" : res.nouvelleLigne ? " (nouvelle ligne créée)" : "") +
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

// « 🔄 Tout mettre à jour » : relit tous les catalogues de l'appli (figurines, sets, nouveautés et objets, customs JB) ;
// avec le jeton GitHub de 💶 Valeur, lance aussi la recherche des nouvelles figurines BrickLink (dépôt privé)
async function toutMettreAJour(bouton) {
  bouton.disabled = true;
  const etat_ = t => $("maj-etat").textContent = t;
  etat_("Relecture des catalogues…");
  let lance = false;
  try {
    const jeton = await Memoire.lire("jeton-github");
    if (jeton && typeof DEPOT_PRIVE !== "undefined") {
      const rep = await fetch(`https://api.github.com/repos/${DEPOT_PRIVE}/actions/workflows/catalogue.yml/dispatches`, { method: "POST",
        headers: { Authorization: `Bearer ${jeton}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        body: JSON.stringify({ ref: "main" }) });
      lance = rep.ok;
    }
  } catch (err) { console.warn(err); }
  try {
    Catalogue._chargement = null;
    if (typeof CatalogueSets !== "undefined") CatalogueSets._chargement = null;
    if (typeof CatalogueJB !== "undefined") CatalogueJB._chargement = null;
    if (typeof CatalogueObjets !== "undefined") { CatalogueObjets._chargement = null; CatalogueObjets.liste = []; }
    await Promise.all([
      typeof Nouveautes !== "undefined" ? Nouveautes.actualiser() : null,
      typeof CatalogueSets !== "undefined" ? CatalogueSets.charger().catch(() => {}) : null,
      typeof CatalogueJB !== "undefined" ? CatalogueJB.charger().catch(() => {}) : null,
    ]);
    Catalogue._chargement = null;
    await majInfosCatalogue();
    etat_(`✔ Catalogues relus.${lance ? " Recherche des nouvelles figurines BrickLink lancée : elles arrivent dans quelques minutes (touchez de nouveau ce bouton plus tard)." : ""}`);
  } catch (err) {
    etat_("Échec : " + err.message);
  }
  bouton.disabled = false;
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
      const { jb, brickshell, archive, ebay, album, commune } = CatalogueJB.nb;
      const autres = brickshell + archive + ebay + album + (commune || 0);
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
    </div>
    ${typeof Souhaits !== "undefined" ? Souhaits.bouton("Custom", f.code, f.nom, f.categorie || "") : ""}`;
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
    await renommerFigurine(etat.classeur, onglet, cas.row, cas.col, nomXL); // case et ligne de la Table camps
    etat.nonEnregistres++;
    await memoriser();
    await relireContenu();
    return sansEnregistrer(`fichier Excel corrigé (${onglet}, case ${cas.ref}) : pensez à « Enregistrer »`);
  } catch (err) {
    console.error(err);
    return "⚠️ correction de la collection impossible : " + err.message;
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
  if (!aAjouter.length) return `${etat.classeur.estBase ? "Collection" : "Fichier Excel"} : n° ${ecartes.join(", ")} déjà dans l'onglet Customs, rien ajouté.`;
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
    return `${etat.classeur.estBase ? "Collection" : "Fichier Excel"} : ${aAjouter.length > 1 ? `${aAjouter.length} exemplaires ajoutés` : "ajoutée"} dans ${onglet} (${codeXL})${etat.classeur.estBase ? "" : ", avec étiquette"}` +
      (ecartes.length ? ` ; n° ${ecartes.join(", ")} déjà présent(s), non ajouté(s)` : "") + sansEnregistrer(". Pensez à « Enregistrer ».");
  } catch (err) {
    console.error(err);
    const m = await Memoire.lire();
    if (m) await chargerClasseur(m.octets, m.nom, m.nonEnregistres);
    return "⚠️ L'ajout à votre collection a échoué : " + err.message + " (le blister est bien dans la base de blisters).";
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

// Plusieurs figurines d'un coup (écran Saisir un code) : liste de codes collée, vérifiée puis ajoutée en une fois,
// chacune dans l'onglet qu'elle aurait eu une par une. Un code répété = autant d'exemplaires. Déjà dans la collection
// ou absente du catalogue : décochée au départ.
let listePlusieurs = [];
async function verifierPlusieurs() {
  const codes = $("plusieurs-codes").value.toUpperCase().split(/[\s,;]+/).filter(Boolean);
  const zone = $("plusieurs-liste");
  if (!codes.length) { zone.innerHTML = `<p class="aide">Tapez d'abord les codes.</p>`; return; }
  zone.innerHTML = `<p class="aide">Vérification…</p>`;
  await Catalogue.charger().catch(() => {});
  const parCode = new Map();
  for (const c of codes) parCode.set(c, (parCode.get(c) || 0) + 1);
  listePlusieurs = [...parCode].map(([code, n]) => {
    const fiche = Catalogue.trouver(code), deja = ouFigurine(code).length;
    const nom = fiche ? fiche.nom : "";
    const theme = codeInvalide(code) ? "" : proposerTheme({ id: code, nom, categorie: fiche ? fiche.categorie : "" });
    // tout est coché au départ, sauf ce qui est déjà dans la collection (exemplaire en plus : à cocher soi-même)
    return { code, n, nom, theme, deja, fiche: !!fiche, invalide: codeInvalide(code), coche: !deja && !codeInvalide(code) };
  });
  rendrePlusieurs();
}
function rendrePlusieurs() {
  const l = listePlusieurs, nb = l.filter(x => x.coche).reduce((s, x) => s + x.n, 0);
  const onglet = x => x.theme === STAR_WARS ? (swUnique() ? THEME_STAR_WARS_UNIQUE.onglet : "Star Wars (camp proposé)") : x.theme;
  $("plusieurs-liste").innerHTML = `
    <p class="aide">${l.length} code(s) : ${l.filter(x => x.coche).length} coché(s). Décochez ce que vous ne voulez pas ajouter${l.some(x => x.deja) ? " ; celles déjà dans votre collection sont décochées (cochez-les pour un exemplaire de plus)" : ""}.</p>
    <div class="suggestions"><button class="petit" data-action="plusieurs-tout">✅ Tout cocher</button>
      <button class="petit" data-action="plusieurs-rien">Tout décocher</button></div>
    ${l.map((x, i) => `<label class="case-a-cocher ligne-plusieurs">
      <input type="checkbox" data-plusieurs="${i}"${x.coche ? " checked" : ""}${x.invalide ? " disabled" : ""}>
      <span><b>${echapper(x.code)}</b>${x.n > 1 ? ` × ${x.n}` : ""} ${x.nom ? echapper(x.nom) : ""}
        <small class="score">${x.invalide ? "⚠️ pas un code BrickLink" : !x.fiche ? "❓ pas dans le catalogue BrickLink de l'appli" : "→ " + echapper(onglet(x))}
        ${x.deja ? ` · 📦 déjà ${x.deja} dans votre collection` : ""}</small></span></label>`).join("")}
    <button class="gros-bouton vert" data-action="ajouter-plusieurs"${nb ? "" : " disabled"}>➕ Ajouter ${nb} figurine${nb > 1 ? "s" : ""}</button>`;
}
async function ajouterPlusieurs() {
  const choisies = listePlusieurs.filter(x => x.coche);
  const total = choisies.reduce((s, x) => s + x.n, 0);
  if (!total) return;
  const deja = choisies.filter(x => x.deja);
  if (deja.length && !(await demander(`${deja.length} de ces figurines sont déjà dans votre collection (${deja.map(x => x.code).join(", ")}) : ` +
      "un exemplaire de plus sera ajouté pour chacune. Continuer ?", "Oui, ajouter", "Annuler"))) return;
  $("texte-chargement").textContent = "Ajout des figurines…";
  afficher("chargement");
  let fait = 0;
  const onglets = new Set();
  try {
    for (const x of choisies) {
      const nom = x.nom || x.code;
      const choix = x.theme === STAR_WARS ? { camp: proposerCamp(x.code, nom, etat.table).camp } : { theme: x.theme };
      for (let i = 0; i < x.n; i++) {
        $("texte-chargement").textContent = `Ajout des figurines… (${fait + 1} sur ${total})`;
        const res = await ajouterFigurine(etat.classeur, { code: x.code, nom, ...choix });
        onglets.add(res.onglet);
        fait++; etat.nonEnregistres++;
      }
    }
    await memoriser();
    await relireContenu();
    $("plusieurs-codes").value = ""; $("plusieurs-liste").innerHTML = ""; listePlusieurs = [];
    afficher("accueil");
    await demander(`${fait} figurine${fait > 1 ? "s ajoutées" : " ajoutée"} ✔ (onglet${onglets.size > 1 ? "s" : ""} ${[...onglets].join(", ")}).\n\n` +
      "Leurs étiquettes s'impriment depuis « 🖨️ Imprimer des étiquettes ».", "OK", "Fermer");
  } catch (err) {
    console.error(err);
    await relireContenu().catch(() => {});
    afficher("saisie");
    await verifierPlusieurs(); // les figurines déjà ajoutées apparaissent « déjà dans votre collection » (décochées)
    await demander(`L'ajout s'est arrêté après ${fait} figurine(s) sur ${total} : ${err.message}`, "OK", "Fermer");
  }
}
// Codes lus sur des photos de vitrines ou de présentoirs (étiquettes avec le code BrickLink). La photo est lue par
// morceaux qui se chevauchent : le lecteur réduit chaque image à 1280 px, une vitrine entière rendrait les étiquettes
// trop petites. Seuls les codes du catalogue BrickLink sont gardés ; un code vu sur plusieurs photos compte une fois.
const MORCEAU_PHOTO = 1100, CHEVAUCHEMENT = 220;
function codesDuTexte(texte) {
  const res = [];
  const chiffre = x => x.replace(/O/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/Z/g, "2").replace(/B/g, "8");
  for (const m of texte.toUpperCase().matchAll(/\b([A-Z]{2,4})[\s\-]?([0-9OILSZB]{3,4})([A-Z]{0,3})\b/g)) {
    // 3 ou 4 chiffres (le lecteur confond parfois O/0, I/1, L/1, S/5, Z/2, B/8), puis un suffixe éventuel (« as », « s »)
    const essais = [];
    for (const k of [m[2].length, 3]) {
      if (k > m[2].length) continue;
      const corps = m[1] + chiffre(m[2].slice(0, k)), suite = m[2].slice(k) + m[3];
      if (/\D/.test(corps.slice(m[1].length))) continue;
      essais.push(corps + suite, corps);
    }
    // « SHO072 » : le 0 lu comme la lettre O, rattachée au préfixe
    if (/[OIL]$/.test(m[1]) && m[1].length > 2 && m[2].length === 3) {
      const corps = m[1].slice(0, -1) + chiffre(m[1].slice(-1) + m[2]);
      if (!/\D/.test(corps.slice(m[1].length - 1))) essais.push(corps + m[3], corps);
    }
    const bon = essais.find(c => Catalogue.trouver(c));
    if (bon) res.push(bon);
  }
  return res;
}
async function lireCodesPhotos(fichiers) {
  if (!fichiers.length) return;
  const etatLecture = $("plusieurs-photo-etat");
  await Catalogue.charger().catch(() => {});
  if (!Catalogue.liste) { await demander("Le catalogue BrickLink n'est pas encore installé dans l'appli : impossible de reconnaître les codes.", "OK", "Fermer"); return; }
  const trouves = new Set();
  try {
    etatLecture.textContent = "Préparation du lecteur de texte (la première fois : environ 27 Mo à télécharger)…";
    await Paddle.charger();
    for (let f = 0; f < fichiers.length; f++) {
      const image = await createImageBitmap(fichiers[f]);
      const pas = MORCEAU_PHOTO - CHEVAUCHEMENT;
      const xs = [], ys = [];
      for (let x = 0; ; x += pas) { xs.push(Math.min(x, Math.max(0, image.width - MORCEAU_PHOTO))); if (x + MORCEAU_PHOTO >= image.width) break; }
      for (let y = 0; ; y += pas) { ys.push(Math.min(y, Math.max(0, image.height - MORCEAU_PHOTO))); if (y + MORCEAU_PHOTO >= image.height) break; }
      let n = 0;
      for (const y of ys) for (const x of xs) {
        n++;
        etatLecture.textContent = `Lecture de la photo ${f + 1} sur ${fichiers.length}… (${Math.round(100 * n / (xs.length * ys.length))} %) · ${trouves.size} code(s) trouvé(s)`;
        const cv = document.createElement("canvas");
        cv.width = Math.min(MORCEAU_PHOTO, image.width); cv.height = Math.min(MORCEAU_PHOTO, image.height);
        cv.getContext("2d").drawImage(image, x, y, cv.width, cv.height, 0, 0, cv.width, cv.height);
        for (const l of await Paddle.lignes(cv)) codesDuTexte(l.texte).forEach(c => trouves.add(c));
      }
    }
  } catch (err) {
    console.error(err);
    etatLecture.textContent = "";
    await demander("La lecture de la photo a échoué : " + err.message, "OK", "Fermer");
    return;
  }
  const deja = new Set($("plusieurs-codes").value.toUpperCase().split(/[\s,;]+/).filter(Boolean));
  const nouveaux = [...trouves].filter(c => !deja.has(c)).sort();
  etatLecture.textContent = `${trouves.size} code(s) lu(s) sur ${fichiers.length > 1 ? `les ${fichiers.length} photos` : "la photo"}` +
    (trouves.size - nouveaux.length ? ` (${trouves.size - nouveaux.length} déjà dans la liste)` : "") +
    ". Vérifiez la liste : une étiquette cachée ou floue peut manquer, ajoutez son code à la main.";
  if (nouveaux.length) $("plusieurs-codes").value = ($("plusieurs-codes").value.trim() + " " + nouveaux.join(" ")).trim();
  await verifierPlusieurs();
}
if ($("input-plusieurs-photo")) $("input-plusieurs-photo").addEventListener("change", e => {
  const f = [...e.target.files];
  e.target.value = "";
  lireCodesPhotos(f);
});

document.addEventListener("change", e => {
  const c = e.target.closest("[data-plusieurs]");
  if (c && listePlusieurs[+c.dataset.plusieurs]) { listePlusieurs[+c.dataset.plusieurs].coche = c.checked; rendrePlusieurs(); }
});

// ---------- enregistrement (Google Drive / téléchargement) ----------

function horodatage() {
  const d = new Date(), z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}h${z(d.getMinutes())}`;
}

async function preparerEnregistrement() {
  if (etat.classeur.estBase) return Exports.ouvrir(); // base de données : enregistrée au fur et à mesure ; ici, les exports
  const octets = await etat.classeur.enregistrer();
  // nom parlant, le même pour tout le monde : « Briquotheque_ma_collection_<date>.xlsx » (sans date en enregistrement direct)
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
const NOM_FICHIER = "Briquotheque_ma_collection";
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
  else if (action === "retour-entete") retourEntete();
  else if (action === "suivante") {
    if (etat.suivante === "photo") { afficher("accueil"); $("input-photo").click(); } // appareil photo ouvert dans le même geste
    else if (etat.suivante === "custom") ouvrirCustom();
    else if (etat.suivante === "recherche") { etat.photos = []; ouvrirRecherche(); }
    else afficher(etat.classeur ? "accueil" : "fichier");
  }
  else if (action === "saisie") ouvrirSaisie();
  else if (action === "nouveautes") EcranNouveautes.ouvrir();
  else if (action === "nouveautes-series") { $("recherche-texte").value = ""; ouvrirRecherche(true); }
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
  else if (action === "verifier-plusieurs") verifierPlusieurs();
  else if (action === "ajouter-plusieurs") ajouterPlusieurs();
  else if (action === "plusieurs-tout" || action === "plusieurs-rien") {
    listePlusieurs.forEach(x => { if (!x.invalide) x.coche = action === "plusieurs-tout"; });
    rendrePlusieurs();
  }
  else if (action === "oui") ajouter();
  else if (action === "non") { afficher("accueil"); toast("Rien n'a été ajouté."); }
  else if (action === "enregistrer") preparerEnregistrement();
  else if (action === "partager") partager();
  else if (action === "enregistrer-direct") enregistrerDirect(false);
  else if (action === "enregistrer-ailleurs") enregistrerDirect(true);
  else if (action === "base-creer") demarrerBase(false);
  else if (action === "rapport") envoyerRapport();
  else if (action === "tout-mettre-a-jour") toutMettreAJour(b);
  else if (action === "sauvegarde-en-ligne") sauvegardeEnLigne();
  else if (action === "restaurer-en-ligne") restaurerEnLigne();
  else if (action === "base-depuis-excel") $("input-excel-base").click();
});
$("saisie-code").addEventListener("keydown", e => { if (e.key === "Enter") validerSaisie(); });

// ---------- base de données de l'appli (version sans Excel) ----------

async function demarrerBase(remplacer, enregistrements, sansConfirmation) {
  const depuisExcel = etat.classeur && !etat.classeur.estBase;
  if (depuisExcel && !sansConfirmation && !(await demander("Quitter votre fichier Excel pour la collection rangée dans l'appli (une autre collection, " +
      "distincte de votre fichier) ? Votre fichier Excel reste gardé : « 📗 Revenir à mon fichier Excel » dans les Outils.", "Oui, changer", "Non, rester sur Excel"))) return;
  try {
    // le fichier Excel ouvert (ajouts non enregistrés compris) est gardé, pour y revenir d'un appui
    const m = await Memoire.lire();
    if (m && m.octets) await Memoire.ecrire(m, "classeur_excel");
    const base = await BaseCollection.ouvrir();
    const n = (await base.exporter()).filter(e => e.table !== "_onglets").length;
    if (remplacer && n && !(await demander(`La base de l'appli contient déjà ${n} article(s). Les remplacer par le contenu du fichier Excel ?`, "Remplacer", "Annuler"))) return;
    if (remplacer) await base.remplacerTout(enregistrements);
    await Memoire.ecrire({ base: true, nom: "Base de l'appli", nonEnregistres: 0 });
    await chargerClasseur(null, "Base de l'appli", 0);
    afficher("accueil");
    toast(remplacer ? `Collection reprise dans la base de l'appli ✔ (${enregistrements.length} enregistrements)` : "Collection ouverte ✔ : chaque ajout est enregistré tout de suite", 5000);
  } catch (err) {
    console.error(err);
    await demander("Impossible d'ouvrir la base de l'appli : " + err.message, "OK", "Fermer");
  }
}

// Reprise d'un fichier Excel dans la base : garder ou non le classement Star Wars par camps (étiquettes de couleur)
async function avecCamps(enregistrements) {
  if (!enregistrements.some(e => e.table === TABLE_FIGURINES && e.camp)) return enregistrements;
  const oui = await demander("Vos figurines Star Wars sont rangées par camp (Gentils en vert, Méchants en rouge, Zone grise). " +
    "Garder ce classement, avec les étiquettes de couleur ? (Sinon : un seul onglet « Star Wars » ; réglable ensuite dans les Outils.)", "Garder les camps", "Un seul onglet");
  return [...enregistrements.filter(e => e.table !== "_reglages" || e.id !== "camps_star_wars"), { table: "_reglages", id: "camps_star_wars", valeur: oui }];
}


// Sauvegarde en ligne (dépôt privé) : à la demande, et restauration (nouveau téléphone, données effacées)
async function sauvegardeEnLigne() {
  try {
    const date = await etat.classeur.sauvegarderEnLigne(true);
    if (!date) return demander("Pas de jeton GitHub dans ce téléphone : enregistrez-le d'abord dans 💶 Valeur. Sinon, faites une sauvegarde .json (📤 Exporter).", "OK", "Fermer");
    majInfoSauvegarde();
    toast("Collection sauvegardée en ligne ✔");
  } catch (err) { await demander("La sauvegarde en ligne a échoué : " + err.message, "OK", "Fermer"); }
}
async function restaurerEnLigne() {
  try {
    const c = await BaseCollection.lireSauvegardeEnLigne();
    if (!c || !Array.isArray(c.base)) return demander("Aucune sauvegarde en ligne pour l'instant.", "OK", "Fermer");
    const n = c.base.filter(e => e.table === TABLE_FIGURINES).length;
    if (!(await demander(`Sauvegarde du ${new Date(c.date).toLocaleString("fr-FR")} : ${n} figurines. Remplacer la collection de ce téléphone par cette sauvegarde ?`, "Restaurer", "Annuler"))) return;
    await demarrerBase(true, c.base, true);
  } catch (err) { await demander("La restauration a échoué : " + err.message, "OK", "Fermer"); }
}
async function majInfoSauvegarde() {
  const d = await Memoire.lire("sauvegarde_en_ligne");
  $("info-sauvegarde").textContent = d ? `Dernière sauvegarde en ligne : ${new Date(d).toLocaleString("fr-FR")}` : "Pas encore de sauvegarde en ligne.";
}
// l'appli passe en arrière-plan (téléphone verrouillé, autre appli) : sauvegarde en ligne tout de suite si besoin
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && etat.classeur && etat.classeur.estBase)
    etat.classeur.sauvegarderEnLigne().catch(err => console.warn("Sauvegarde en ligne", err));
});


$("reglage-camps").addEventListener("change", async () => {
  if (!etat.classeur || !etat.classeur.estBase) return;
  etat.classeur.reglerCampsSW($("reglage-camps").checked);
  await etat.classeur.attendre();
  await relireContenu();
  toast($("reglage-camps").checked ? "Star Wars rangé par camps (Gentils, Méchants, Zone grise) ✔" : "Un seul onglet « Star Wars » ✔", 4000);
});

$("input-excel-base").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const enregistrements = await avecCamps(await BaseCollection.depuisExcel(new Uint8Array(await f.arrayBuffer())));
    await demarrerBase(true, enregistrements);
  } catch (err) {
    console.error(err);
    await demander("Impossible de reprendre ce fichier : " + err.message, "OK", "Fermer");
  }
});

// ---------- démarrage ----------

(async function demarrer() {
  if ($("version-appli")) $("version-appli").textContent = `(version ${VERSION_APPLI})`;
  Recadrage.installer();
  Collection.installer();
  // en arrière-plan : sert à la recherche par nom et à reconnaître le thème
  Catalogue.charger().catch(() => {}).then(majInfosCatalogue);
  if ("serviceWorker" in navigator && location.protocol === "https:")
    navigator.serviceWorker.register("sw.js").catch(() => {});
  const m = await Memoire.lire();
  try {
    if (m && m.base) { await chargerClasseur(null, m.nom, 0); afficher("accueil"); return; }
    // ancien rangement dans un fichier Excel (gardé dans le téléphone) : repris dans la base de l'appli, une fois
    if (m && m.octets) { await demarrerBase(true, await avecCamps(await BaseCollection.depuisExcel(m.octets)), true); return; }
  } catch (e) { console.warn(e); }
  afficher("fichier");
})();
