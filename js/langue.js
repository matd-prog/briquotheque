// Langue de l'appli (18/10/2026, demande de Mathias) : français (langue d'origine), anglais, allemand, espagnol.
// Les textes restent écrits en français dans le code ; langues/traductions.tsv (colonnes fr, en, de, es) donne leur
// traduction. Tout texte affiché (nœud de texte, placeholder, title, aria-label) qui figure dans ce tableau est remplacé,
// y compris les textes ajoutés plus tard par l'appli (observateur du document). Un texte avec des parties variables
// s'écrit avec {0}, {1}… dans le tableau (ex. « Ma collection · {0} figurines »). Un texte absent du tableau reste en
// français. Les noms de figurines, séries et sets ne sont jamais traduits (ils ne sont pas dans le tableau).
// Choix : écran de bienvenue et Outils (« 🌐 Langue ») ; par défaut la langue du téléphone si elle est proposée.

const LANGUES = [["fr", "🇫🇷 Français"], ["en", "🇬🇧 English"], ["de", "🇩🇪 Deutsch"], ["es", "🇪🇸 Español"]];

const Langue = {
  code: (() => {
    let choisie = null;
    try { choisie = localStorage.getItem("langue"); } catch (e) { /* pas de stockage */ }
    if (choisie && LANGUES.some(([c]) => c === choisie)) return choisie;
    const tel = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return LANGUES.some(([c]) => c === tel) ? tel : "fr";
  })(),
  dico: new Map(),
  motifs: [],      // [regex, traduction avec {0}…]
  manquants: new Map(), // contrôle : textes affichés restés en français (texte -> nombre de fois), listés dans les Outils
  traduits: new Set(),  // textes déjà dans la langue choisie (pour ne pas les compter comme manquants)
  pret: false,

  _net(s) { return s.replace(/\s+/g, " ").trim(); },

  async charger() {
    document.documentElement.lang = this.code;
    if (this.code === "fr") { this.pret = true; return; }
    try {
      const lignes = (await (await fetch("langues/traductions.tsv")).text()).split("\n");
      const col = lignes.shift().split("\t").indexOf(this.code);
      for (const l of lignes) {
        const c = l.split("\t"), fr = this._net(c[0] || ""), tr = (c[col] || "").trim();
        if (!fr || !tr || fr.startsWith("#")) continue;
        if (/\{#?\d\}/.test(fr)) {
          // {0} : n'importe quel texte ; {#0} : un nombre seulement (« {#0} figurines »)
          const re = new RegExp("^" + fr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\\\{#(\d)\\\}/g, "([\\d\\s\u00a0\u202f.,]+)").replace(/\\\{(\d)\\\}/g, "(.+?)") + "$");
          this.motifs.push([re, tr.replace(/\{#(\d)\}/g, "{$1}"), fr.length]);
        } else { this.dico.set(fr, tr); this.traduits.add(tr); }
      }
      this.motifs.sort((x, y) => y[2] - x[2]); // le motif le plus long d'abord (le plus précis)
    } catch (err) { console.warn("Traductions", err); return; }
    this.pret = true;
    this.traduire(document.body);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === "characterData") this._noeud(m.target);
        else if (m.type === "attributes") this._attributs(m.target);
        else m.addedNodes.forEach(n => this.traduire(n));
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label"] });
  },

  // Traduction d'un texte (sinon le texte lui-même)
  t(s) {
    if (this.code === "fr" || !s) return s;
    const net = this._net(String(s));
    const d = this.dico.get(net);
    if (d) return d;
    for (const [re, tr] of this.motifs) {
      const m = re.exec(net);
      // les parties variables sont traduites elles aussi (ex. le mois dans « Sorties de octobre 2026 : … »)
      if (m) return tr.replace(/\{(\d)\}/g, (_, i) => { const v = m[+i + 1]; return v.length < 60 ? this.t(v) : v; });
    }
    return s;
  },

  _noeud(n) {
    const v = n.nodeValue;
    if (!v || !/[A-Za-zÀ-ÿ]/.test(v)) return;
    const net = this._net(v), tr = this.t(net);
    if (tr !== net) { this.traduits.add(tr); n.nodeValue = (/^\s/.test(v) ? " " : "") + tr + (/\s$/.test(v) ? " " : ""); }
    else this._controler(net, n.parentElement);
  },

  // Contrôle de la langue : un texte affiché sans traduction qui ressemble à du français est noté (Outils, rapport de
  // problème) pour être traduit. Les noms (figurines, séries, pseudos) ne ressemblent pas à des phrases : ils passent.
  _controler(texte, el) {
    if (texte.length < 3 || this.traduits.has(texte) || (el && el.closest(".nom-libre, input, textarea, #langue-manquants"))) return;
    if (texte === texte.toUpperCase() || /^[A-Z0-9«»"“ –-]{6,}/.test(texte)) return; // nom de figurine (en capitales)
    if (!/[éèêàùçœ]|\b(le|la|les|des|du|une|et|vous|votre|vos|pour|avec|dans|sur|pas|est|sont|aux|cette|ces|qui|que|plus|aucun|aucune|ajouter|retirer|touchez|exemplaires?|figurines?)\b/i.test(texte)) return;
    this.manquants.set(texte, (this.manquants.get(texte) || 0) + 1);
    const b = document.getElementById("langue-controle");
    if (b) b.textContent = `🌐 ${this.manquants.size}`;
  },
  afficherManquants() {
    const z = document.getElementById("langue-manquants");
    if (!z) return;
    const l = [...this.manquants.keys()];
    z.innerHTML = l.length ? `<p class="aide">${l.length}</p><ul>${l.map(x => `<li>${x.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</li>`).join("")}</ul>
      <button class="bouton gris" data-action="langue-copier">📋</button>` : "✅";
  },
  _attributs(el) {
    if (!el.getAttribute) return;
    for (const a of ["placeholder", "title", "aria-label"]) {
      const v = el.getAttribute(a);
      if (v) { const tr = this.t(v); if (tr !== v) el.setAttribute(a, tr); }
    }
  },
  traduire(racine) {
    if (!this.pret || this.code === "fr" || !racine) return;
    if (racine.nodeType === 3) { this._noeud(racine); return; }
    if (racine.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(racine.tagName)) return;
    const it = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = it.currentNode; n; n = it.nextNode()) {
      if (n.nodeType === 3) { if (!n.parentElement || !/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName)) this._noeud(n); }
      else this._attributs(n);
    }
  },

  // Boutons de choix (écran de bienvenue, Outils)
  boutons() {
    return LANGUES.map(([c, nom]) => `<button class="puce-langue ${c === this.code ? "choisi" : ""}" data-langue="${c}">${nom}</button>`).join("");
  },
  choisir(c) {
    try { localStorage.setItem("langue", c); } catch (e) { /* pas de stockage */ }
    location.reload();
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-langue]");
  if (b) { Langue.choisir(b.dataset.langue); return; }
  const a = e.target.closest("[data-action]");
  if (a && a.dataset.action === "langue-controle") Langue.afficherManquants();
  else if (a && a.dataset.action === "langue-copier")
    navigator.clipboard.writeText([...Langue.manquants.keys()].join("\n")).then(() => toast("📋 ✔")).catch(() => {});
});
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".choix-langue").forEach(z => { z.innerHTML = Langue.boutons(); });
  Langue.charger();
});
