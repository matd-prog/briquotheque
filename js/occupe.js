// Indicateur « en cours / terminé » pour tous les boutons : après un appui, si l'appli travaille encore au bout de
// 0,3 s (réseau, fichier Excel, mémoire du téléphone, photos…), un bandeau « ⏳ En cours… » s'affiche en haut de l'écran
// et le bouton touché est grisé ; quand tout est fini, « ✔ Terminé » s'affiche un instant. Les travaux sont comptés
// en enveloppant les fonctions qui attendent (fetch, JSZip, Memoire, photos) : pas besoin de modifier chaque bouton.

const Occupe = {
  enCours: 0,          // travaux en attente
  bouton: null,        // bouton touché
  depuis: 0,           // moment de l'appui
  actif: false,        // bandeau affiché
  _minuteur: null,

  suivre(promesse) {
    this.enCours++;
    const fin = () => { this.enCours = Math.max(0, this.enCours - 1); };
    promesse.then(fin, fin);
    return promesse;
  },

  envelopper(objet, nom) {
    const f = objet && objet[nom];
    if (typeof f !== "function" || f._occupe) return;
    const occ = this;
    const g = function (...args) {
      const r = f.apply(this, args);
      return r && typeof r.then === "function" ? occ.suivre(r) : r;
    };
    g._occupe = true;
    objet[nom] = g;
  },

  appui(bouton) {
    this.bouton = bouton;
    this.depuis = Date.now();
    if (!this.actif) { clearTimeout(this._minuteur); this._minuteur = setTimeout(() => this._verifier(), 300); }
  },

  _dialogueOuvert: () => { const d = document.getElementById("dialogue"); return !!(d && d.open); },

  // vérifié toutes les 0,25 s tant qu'un appui est suivi
  _verifier() {
    clearTimeout(this._minuteur);
    if (!this.depuis && !this.actif) return;
    const occupe = this.enCours > 0 && !this._dialogueOuvert();
    if (occupe && !this.actif && Date.now() - this.depuis >= 300) this._afficher(true);
    if (!occupe && this.actif) {
      // petite attente : un travail en enchaîne souvent un autre
      this._minuteur = setTimeout(() => {
        if (this.enCours === 0 || this._dialogueOuvert()) this._afficher(false); else this._verifier();
      }, 400);
      return;
    }
    if (!occupe && !this.actif && Date.now() - this.depuis > 1000) { this.depuis = 0; this.bouton = null; return; } // rien de long
    this._minuteur = setTimeout(() => this._verifier(), 250);
  },

  _afficher(occupe) {
    let b = document.getElementById("bandeau-occupe");
    if (!b) {
      b = document.createElement("div");
      b.id = "bandeau-occupe";
      b.setAttribute("role", "status");
      document.body.appendChild(b);
    }
    if (occupe) {
      this.actif = true;
      b.className = "bandeau-occupe";
      b.textContent = "⏳ En cours… patientez";
      b.hidden = false;
      if (this.bouton) { this.bouton.classList.add("bouton-occupe"); this.bouton.setAttribute("aria-busy", "true"); }
    } else {
      this.actif = false;
      if (this.bouton) { this.bouton.classList.remove("bouton-occupe"); this.bouton.removeAttribute("aria-busy"); }
      this.bouton = null; this.depuis = 0;
      if (this._dialogueOuvert()) { b.hidden = true; return; } // l'appli attend une réponse : pas de « terminé »
      b.className = "bandeau-occupe fini";
      b.textContent = "✔ Terminé";
      setTimeout(() => { if (!this.actif) b.hidden = true; }, 1500);
    }
  },
};

// travaux suivis
if (window.fetch) Occupe.envelopper(window, "fetch");
if (window.createImageBitmap) Occupe.envelopper(window, "createImageBitmap");
if (typeof JSZip !== "undefined") {
  Occupe.envelopper(JSZip, "loadAsync");
  Occupe.envelopper(JSZip.prototype, "generateAsync");
  Occupe.envelopper(JSZip.prototype, "loadAsync");
  try { Occupe.envelopper(Object.getPrototypeOf(new JSZip().file("a", "b").file("a")), "async"); } catch (e) { /* version sans ZipObject */ }
}
if (typeof Memoire !== "undefined") for (const f of ["lire", "ecrire"]) Occupe.envelopper(Memoire, f);

// appuis sur les boutons (et les cases « photo » qui ouvrent l'appareil : leur travail commence au retour)
document.addEventListener("click", e => {
  const b = e.target.closest("button, .tuile, .gros-bouton, .bouton, [data-action]");
  if (b && !b.closest("#dialogue")) Occupe.appui(b);
}, true);
document.addEventListener("change", e => {
  if (e.target.type === "file") Occupe.appui(e.target.closest("label") || e.target);
}, true);
// réponse à une question : le travail reprend, on suit à nouveau
document.addEventListener("close", e => { if (e.target.id === "dialogue") { Occupe.depuis = Date.now(); Occupe._verifier(); } }, true);
// le bandeau qui disparaît quand une question s'ouvre revient à sa fermeture (réponse = travail qui reprend)
