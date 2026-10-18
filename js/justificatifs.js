// Coffre à justificatifs d'achat (Mathias, 18/10/2026, 2e idée reprise de l'appli Brick Broker : « tes achats,
// protégés ») : photos de tickets de caisse, factures, captures d'écran de commandes (Whatnot, JB, eBay…), avec la date,
// le vendeur, le montant et ce qui a été acheté. Gardés dans le téléphone (Memoire « justificatifs ») ; joints au dossier
// pour l'assureur (js/assurance.js) ; sauvegarde et reprise en .zip (la sauvegarde .json de la collection ne les
// contient pas). Le blister Hall of Bricks vide (11/10/2026) : sans capture de l'achat, impossible de savoir quelle
// figurine c'était.

const Justificatifs = {
  liste: [],   // [{ id, date (AAAA-MM-JJ), vendeur, montant, description, photo: Blob JPEG }]
  urls: new Map(),

  async charger() {
    this.liste = (await Memoire.lire("justificatifs").catch(() => null)) || [];
    return this.liste;
  },
  async enregistrer() { await Memoire.ecrire(this.liste, "justificatifs"); },

  url(j) {
    if (!this.urls.has(j.id)) this.urls.set(j.id, URL.createObjectURL(j.photo));
    return this.urls.get(j.id);
  },

  // photo réduite (1600 px au plus, JPEG) : lisible pour un ticket, légère pour le téléphone
  async reduire(fichier) {
    const image = await createImageBitmap(fichier, { imageOrientation: "from-image" }).catch(() => createImageBitmap(fichier));
    const k = Math.min(1, 1600 / Math.max(image.width, image.height));
    const c = document.createElement("canvas");
    c.width = Math.round(image.width * k); c.height = Math.round(image.height * k);
    c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.85));
  },

  euros(v) { return v ? Number(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : ""; },
  jour(d) { return d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR") : ""; },
  // « 03/04/2026 » ou « 2026-04-03 » -> 2026-04-03
  versIso(t) {
    const m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec((t || "").trim());
    if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test((t || "").trim()) ? t.trim() : "";
  },

  async ouvrir() {
    afficher("justificatifs");
    await this.charger();
    this.rendre();
  },

  rendre() {
    const l = [...this.liste].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const total = l.reduce((n, j) => n + (Number(j.montant) || 0), 0);
    $("justificatifs-info").textContent = l.length
      ? `${l.length} justificatif${l.length > 1 ? "s" : ""}${total ? ` · ${this.euros(total)} d'achats` : ""}. Ils sont joints au dossier pour l'assureur.`
      : "Aucun justificatif pour l'instant. Photographiez un ticket, une facture, ou choisissez la capture d'écran d'une commande.";
    $("justificatifs-liste").innerHTML = l.map(j => `<div class="fiche justificatif">
        <img class="photo" src="${this.url(j)}" alt="Justificatif" data-voir="${j.id}">
        <div class="infos"><span class="nom-court">${echapper(j.vendeur || "Vendeur ?")}${j.montant ? ` · ${this.euros(j.montant)}` : ""}</span>
          <span class="code">${echapper(this.jour(j.date) || "date ?")}</span>
          ${j.description ? `<span class="score">${echapper(j.description)}</span>` : ""}</div>
        <div class="actions-fiche"><button class="petit" data-modifier="${j.id}">✏️</button><button class="petit" data-supprimer="${j.id}">🗑️</button></div>
      </div>`).join("");
    $("justificatifs-sauver").hidden = !l.length;
  },

  async formulaire(j, titre) {
    const r = await demanderFormulaire(titre, [
      { cle: "date", titre: "Date d'achat (jj/mm/aaaa)", valeur: this.jour(j.date) },
      { cle: "vendeur", titre: "Vendeur (JB Spielwaren, Whatnot, eBay, LEGO…)", valeur: j.vendeur || "" },
      { cle: "montant", titre: "Montant payé (€)", type: "nombre", valeur: j.montant ? String(j.montant).replace(".", ",") : "" },
      { cle: "description", titre: "Ce qui a été acheté", valeur: j.description || "" },
    ]);
    if (!r) return false;
    j.date = this.versIso(r.date) || j.date || "";
    j.vendeur = r.vendeur;
    j.montant = parseFloat((r.montant || "").replace(/\s|€/g, "").replace(",", ".")) || 0;
    j.description = r.description;
    return true;
  },

  async ajouter(fichiers) {
    for (const f of fichiers) {
      const j = { id: `J${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: new Date().toISOString().slice(0, 10),
                  vendeur: "", montant: 0, description: "", photo: await this.reduire(f) };
      if (f.lastModified) j.date = new Date(f.lastModified).toISOString().slice(0, 10); // capture d'écran : date de la capture
      if (!(await this.formulaire(j, fichiers.length > 1 ? `Justificatif (${fichiers.indexOf(f) + 1}/${fichiers.length})` : "Nouveau justificatif"))) continue;
      this.liste.push(j);
      await this.enregistrer();
    }
    this.rendre();
  },

  voir(j) {
    $("menu-titre").textContent = `${j.vendeur || "Justificatif"} · ${this.jour(j.date)}${j.montant ? " · " + this.euros(j.montant) : ""}`;
    $("menu-boutons").innerHTML = `<img src="${this.url(j)}" alt="Justificatif" style="width:100%;border-radius:10px">`;
    $("menu-fermer").onclick = () => $("menu-actions").close();
    $("menu-actions").showModal();
  },

  // sauvegarde : justificatifs.tsv + photos/<id>.jpg
  async sauver() {
    const zip = new JSZip();
    const lignes = ["id\tdate\tvendeur\tmontant\tdescription\tphoto"];
    for (const j of this.liste) {
      zip.file(`photos/${j.id}.jpg`, j.photo);
      lignes.push([j.id, j.date, j.vendeur, j.montant || "", j.description, `photos/${j.id}.jpg`].map(v => String(v ?? "").replace(/[\t\n]/g, " ")).join("\t"));
    }
    zip.file("justificatifs.tsv", lignes.join("\n") + "\n");
    const fichier = new File([await zip.generateAsync({ type: "blob" })], `justificatifs_${horodatage()}.zip`, { type: "application/zip" });
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      try { await navigator.share({ files: [fichier], title: "Justificatifs d'achat" }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(fichier); a.download = fichier.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast("Sauvegarde enregistrée dans Téléchargements ✔ Mettez-la dans Google Drive.", 6000);
  },

  async reprendre(fichier) {
    let zip;
    try { zip = await JSZip.loadAsync(fichier); } catch (err) { await demander("Ce fichier n'est pas une sauvegarde de justificatifs (.zip).", "OK", "Fermer"); return; }
    const index = zip.file("justificatifs.tsv");
    if (!index) { await demander("Ce fichier n'est pas une sauvegarde de justificatifs (.zip).", "OK", "Fermer"); return; }
    const ids = new Set(this.liste.map(j => j.id));
    let n = 0;
    for (const l of (await index.async("string")).split("\n").slice(1)) {
      const [id, date, vendeur, montant, description, chemin] = l.split("\t");
      if (!id || ids.has(id) || !zip.file(chemin)) continue;
      this.liste.push({ id, date, vendeur, montant: parseFloat(montant) || 0, description,
                        photo: new Blob([await zip.file(chemin).async("arraybuffer")], { type: "image/jpeg" }) });
      n++;
    }
    await this.enregistrer();
    this.rendre();
    toast(`${n} justificatif${n > 1 ? "s repris" : " repris"} ✔`);
  },
};

$("justificatifs-liste").addEventListener("click", async e => {
  const id = (e.target.closest("[data-voir],[data-modifier],[data-supprimer]") || {}).dataset;
  if (!id) return;
  const j = Justificatifs.liste.find(x => x.id === (id.voir || id.modifier || id.supprimer));
  if (!j) return;
  if (id.voir) Justificatifs.voir(j);
  else if (id.modifier) { if (await Justificatifs.formulaire(j, "Modifier le justificatif")) { await Justificatifs.enregistrer(); Justificatifs.rendre(); } }
  else if (await demander(`Supprimer ce justificatif (${j.vendeur || "?"}, ${Justificatifs.jour(j.date)}) ?`, "Supprimer", "Garder")) {
    Justificatifs.liste = Justificatifs.liste.filter(x => x !== j);
    await Justificatifs.enregistrer();
    Justificatifs.rendre();
  }
});
for (const id of ["input-justificatif-photo", "input-justificatif-galerie"]) {
  $(id).addEventListener("change", () => { const f = [...$(id).files]; $(id).value = ""; if (f.length) Justificatifs.ajouter(f); });
}
$("input-justificatifs-zip").addEventListener("change", () => { const f = $("input-justificatifs-zip").files[0]; $("input-justificatifs-zip").value = ""; if (f) Justificatifs.reprendre(f); });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  if (b.dataset.action === "justificatifs") Justificatifs.ouvrir();
  else if (b.dataset.action === "justificatifs-sauver") Justificatifs.sauver();
});
