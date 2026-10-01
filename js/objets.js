// Objets dérivés LEGO du catalogue BrickLink « Gear » (porte-clés, porte-clés lumineux, magnets…) :
// onglet « Objets dérivés » du fichier Excel, valorisés comme les sets (js/valeur.js, type GEAR).

// Catalogue de tous les objets dérivés (data/objets.tsv, fait chaque jour depuis Rebrickable par
// outils/nouveautes_rebrickable.py) : numéro BrickLink probable, référence imprimée sur l'emballage (ex. KE48H)
const CatalogueObjets = {
  liste: [],
  _chargement: null,
  charger() {
    if (!this._chargement) {
      this._chargement = fetch("data/objets.tsv").then(r => r.ok ? r.text() : "").then(texte => {
        this.liste = [];
        for (const l of texte.split("\n")) {
          const [code, bricklink, reference, nom, theme, annee, image] = l.replace(/\r$/, "").split("\t");
          if (!code || code === "code" || code.startsWith("#") || !nom) continue;
          this.liste.push({ code, bricklink, reference: (reference || "").toUpperCase(), nom, theme, annee, image,
                            recherche: normaliser(`${bricklink} ${reference} ${nom} ${theme}`) });
        }
        return this.liste;
      }).catch(err => { this._chargement = null; console.warn(err); return []; });
    }
    return this._chargement;
  },
  chercher(texte, max = 8) {
    const mots = normaliser(texte).split(" ").filter(Boolean);
    return mots.length ? this.liste.filter(o => mots.every(m => o.recherche.includes(m))).slice(0, max) : [];
  },
  // Référence lue sur l'emballage (« KE48H ») : la même, sinon le même numéro avec une autre lettre de fin
  // Références confirmées une fois par l'utilisateur (« KE48H » -> 5005667-1) : gardées dans le téléphone
  confirmees: {},
  async chargerConfirmees() {
    try { this.confirmees = (await Memoire.lire("objets-references")) || {}; } catch (err) { this.confirmees = {}; }
  },
  async confirmer(ref, o) {
    this.confirmees[ref.toUpperCase()] = o.code;
    try { await Memoire.ecrire(this.confirmees, "objets-references"); } catch (err) { console.warn(err); }
  },
  parReference(ref) {
    const r = ref.toUpperCase(), sans = r.replace(/[A-Z]$/, "");
    const conf = this.confirmees[r] && this.liste.find(o => o.code === this.confirmees[r]);
    if (conf) return [conf];
    const exacts = this.liste.filter(o => o.reference === r);
    return exacts.length ? exacts : this.liste.filter(o => o.reference.replace(/[A-Z]$/, "") === sans);
  },
};

// Référence d'un porte-clés lumineux sur la photo de l'emballage (« KE48H », au-dessus du code-barres) :
// lecture du texte dans le téléphone (Tesseract, comme les blisters), par bandes agrandies, photo droite
// puis tournée d'un quart de tour (étiquette photographiée de côté).
async function lireReferenceObjet(fichier) {
  const bm = await createImageBitmap(fichier);
  const lecteur = await Blister._lecteur();
  const motif = /\b(?:LGL-?)?(KE|LGL|TO|LED|KC)\s?-?(\d{2,3}[A-Z]?)\b/i;
  for (const angle of [0, 90, 270]) {
    const [l, h] = angle % 180 ? [bm.height, bm.width] : [bm.width, bm.height];
    const k = Math.min(1, 2400 / Math.max(l, h));
    const cv = document.createElement("canvas");
    cv.width = Math.round(l * k); cv.height = Math.round(h * k);
    const x = cv.getContext("2d");
    x.translate(cv.width / 2, cv.height / 2); x.rotate(angle * Math.PI / 180);
    x.drawImage(bm, -bm.width * k / 2, -bm.height * k / 2, bm.width * k, bm.height * k);
    const n = 4, hb = cv.height / n;
    for (let i = 0; i < n; i++) {
      const y0 = Math.max(0, i * hb - hb * 0.25), hh = Math.min(cv.height - y0, hb * 1.5);
      const z = 1800 / cv.width, bande = document.createElement("canvas");
      bande.width = 1800; bande.height = Math.round(hh * z);
      bande.getContext("2d").drawImage(cv, 0, y0, cv.width, hh, 0, 0, bande.width, bande.height);
      const { data } = await lecteur.recognize(bande);
      const m = motif.exec(data.text || "");
      if (m) { bm.close && bm.close(); return (m[1] + m[2]).toUpperCase(); }
    }
  }
  bm.close && bm.close();
  return "";
}

const EcranObjet = {
  async ouvrir() {
    for (const id of ["objet-nom", "objet-code", "objet-remarques"]) $(id).value = "";
    $("objet-quantite").value = 1;
    $("objet-nouveautes").innerHTML = "";
    afficher("objet");
    this.lister();
  },

  // Objets dérivés (catalogue complet) dont le nom ou la référence correspond à ce qui est tapé : un toucher remplit le numéro
  async suggerer() {
    const q = $("objet-nom").value.trim();
    if (q.length < 2) { if (!this._refLue) $("objet-nouveautes").innerHTML = ""; return; }
    await CatalogueObjets.charger();
    // d'abord les porte-clés lumineux si la référence lue en est un (KE…)
    let res = CatalogueObjets.chercher(q, 30);
    if (/^KE/.test(this._refLue || "")) res = res.filter(o => /light/i.test(o.nom)).concat(res.filter(o => !/light/i.test(o.nom)));
    this.proposer(res.slice(0, 8), this._refLue ? `Référence lue : <b>${echapper(this._refLue)}</b>. Touchez le bon :` : "");
  },

  proposer(res, info = "") {
    const zone = $("objet-nouveautes"), an = String(new Date().getFullYear());
    zone.innerHTML = (info ? `<p class="aide" style="grid-column: 1 / -1">${info}</p>` : "") + res.map((o, i) => `<button class="proposition" data-objet-choix="${i}">
        ${o.image ? `<img src="${echapper(o.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<div class="sans-photo">Pas de photo</div>`}
        <span class="nom-court">${echapper(o.nom)}</span>
        <span class="code">${echapper(o.reference || o.bricklink)}</span><span class="score">${o.annee >= an ? "🆕 " : ""}${echapper(o.annee)}</span></button>`).join("");
    zone.querySelectorAll("[data-objet-choix]").forEach(b => b.addEventListener("click", () => this.choisir(res[+b.dataset.objetChoix])));
  },

  choisir(o) {
    // référence lue sur l'étiquette mais rangée sous un autre numéro : retenue pour la prochaine fois
    if (this._refLue && o.reference !== this._refLue) {
      CatalogueObjets.confirmer(this._refLue, o);
      toast(`Retenu : la référence ${this._refLue} = « ${o.nom} » (reconnue directement la prochaine fois)`, 5000);
    }
    this._refLue = "";
    $("objet-nom").value = o.nom;
    $("objet-code").value = o.bricklink;
    if (/light|lampe|torch/i.test(o.nom)) $("objet-type").value = "Porte-clés lumineux";
    else if (/key ?chain|porte|key ?ring/i.test(o.nom)) $("objet-type").value = "Porte-clés";
    else if (/magnet/i.test(o.nom)) $("objet-type").value = "Magnet";
    else if (/clock|watch/i.test(o.nom)) $("objet-type").value = "Montre / réveil";
    $("objet-nouveautes").innerHTML = `<div class="carte" style="grid-column: 1 / -1">${o.image ? `<img src="${echapper(o.image)}" alt="" style="max-width:120px;float:right">` : ""}
      <b>${echapper(o.nom)}</b><br><span class="score">${echapper(o.reference)} · ${echapper(o.annee)} · numéro BrickLink : ${echapper(o.bricklink)}</span>
      <br><a href="https://www.bricklink.com/v2/search.page?q=${encodeURIComponent(o.reference || o.bricklink)}#T=G" target="_blank" rel="noopener">Vérifier sur BrickLink</a>
      ${typeof Souhaits !== "undefined" ? Souhaits.bouton("Objet", o.bricklink, o.nom, o.theme || "") : ""}</div>`;
  },

  // Photo de l'étiquette : lecture de la référence (ex. KE48H) puis recherche dans le catalogue
  async photo(fichier) {
    $("objet-nouveautes").innerHTML = `<p class="aide" style="grid-column: 1 / -1">⏳ Lecture de l'étiquette… (jusqu'à une demi-minute)</p>`;
    let ref = "";
    this._refLue = "";
    try { [ref] = await Promise.all([lireReferenceObjet(fichier), CatalogueObjets.charger(), CatalogueObjets.chargerConfirmees()]); }
    catch (err) { console.error(err); }
    const res = ref ? CatalogueObjets.parReference(ref) : [];
    if (res.length === 1) { this.choisir(res[0]); toast(`Référence ${ref} reconnue ✔`); return; }
    if (res.length) { this.proposer(res, `Référence lue : <b>${echapper(ref)}</b>. Touchez le bon :`); return; }
    if (!ref) {
      $("objet-nouveautes").innerHTML = "";
      await demander("Référence pas trouvée sur la photo. Photographiez la face avant, de près, bien à plat : la référence (ex. « KE48H ») est écrite au-dessus du code-barres.\n\nVous pouvez aussi taper le nom ou la référence.", "OK", "Fermer");
      return;
    }
    // référence absente du catalogue (souvent rangé sous un numéro LEGO, ex. fantôme KE48H = 5005667) : l'utilisateur
    // tape le nom et touche le bon ; la correspondance est retenue
    this._refLue = ref;
    $("objet-nom").value = "";
    $("objet-nouveautes").innerHTML = `<p class="aide" style="grid-column: 1 / -1">Référence lue : <b>${echapper(ref)}</b>. Le catalogue range
      cet objet sous un autre numéro : tapez son nom en anglais ci-dessus (ex. « ghost », « vader ») et touchez le bon.
      L'appli retiendra que ${echapper(ref)} = cet objet.
      <a href="https://www.bricklink.com/v2/search.page?q=${encodeURIComponent(ref)}#T=G" target="_blank" rel="noopener">Chercher ${echapper(ref)} sur BrickLink</a></p>`;
    $("objet-nom").focus();
  },

  chercher() {
    const q = $("objet-nom").value.trim();
    if (!q) { toast("Écrivez d'abord ce que c'est (en anglais de préférence : key chain, key light, magnet…)."); return; }
    window.open(`https://www.bricklink.com/v2/search.page?q=${encodeURIComponent(q)}#T=G`, "_blank", "noopener");
  },

  async ajouter() {
    const code = $("objet-code").value.trim().replace(/\s+/g, "");
    if (!code) { await demander("Indiquez le numéro BrickLink de l'objet (touchez « Trouver son numéro sur BrickLink »).", "OK", "Fermer"); return; }
    const objet = { code, nom: $("objet-nom").value.trim(), type: $("objet-type").value, etat: $("objet-etat").value,
                    quantite: Math.max(1, +$("objet-quantite").value || 1), remarques: $("objet-remarques").value.trim() };
    try {
      await ajouterObjet(etat.classeur, objet);
      etat.nonEnregistres++;
      await memoriser();
      await relireContenu();
      toast(`${objet.nom || code} ajouté à l'onglet « ${ONGLET_OBJETS} » ✔ (pensez à enregistrer)`);
      this.ouvrir();
    } catch (err) {
      console.error(err);
      await demander("L'ajout a échoué : " + err.message, "OK", "Fermer");
    }
  },

  async lister() {
    const objets = etat.classeur ? await lireObjets(etat.classeur) : [];
    $("objet-liste").innerHTML = objets.length ? `<div class="carte"><p class="sous-titre">Vos objets dérivés (${objets.length})</p>
      ${objets.map(o => `<div class="ligne-valeur"><span>${echapper(o.nom || o.type || "")} <span class="score">${echapper(o.code)}` +
        `${o.quantite > 1 ? ` ×${o.quantite}` : ""} · ${echapper(o.etat)}</span></span>` +
        `<a href="https://www.bricklink.com/v2/catalog/catalogitem.page?G=${encodeURIComponent(o.code)}" target="_blank" rel="noopener">BrickLink</a></div>`).join("")}</div>` : "";
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "objet") EcranObjet.ouvrir();
  else if (a === "objet-chercher") EcranObjet.chercher();
  else if (a === "objet-ajouter") EcranObjet.ajouter();
});

{
  let minuteur;
  $("objet-nom").addEventListener("input", () => { clearTimeout(minuteur); minuteur = setTimeout(() => EcranObjet.suggerer(), 250); });
  $("input-objet-photo").addEventListener("change", e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) EcranObjet.photo(f);
  });
}
