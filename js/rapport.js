// Signaler un problème ou proposer une amélioration (Mathias, 06/11/2026) : depuis n'importe quel écran (lien en bas de
// page), dans l'appli et dans la mini-appli. Le rapport arrive directement chez Mathias (table « rapports » de Supabase,
// outils/supabase_rapports.sql), sans passer par une messagerie ; il le lit dans l'appli (« 📬 Rapports reçus », compte
// administrateur). Hors connexion, ou si l'envoi échoue : partage du texte (Messages, Mail…) comme avant.
// Rien de la collection n'est envoyé : description, version, écran, appareil, dernières erreurs et actions, et une
// capture d'écran si la personne en choisit une.

const Rapport = {
  URL: "https://neadnkbroribjobpsqcu.supabase.co/rest/v1/rapports",
  CLE: "sb_publishable_5EmR-GxELWvYIyN1NJH0pA_5q8vtetO", // clé publique (comme js/compte.js)
  erreurs: [], // mini-appli : dernières erreurs (l'appli principale a les siennes, ERREURS dans js/app.js)
  type: "bug",
  capture: null,

  _mini() { return typeof VERSION_APPLI === "undefined"; },
  _version() {
    if (!this._mini()) return VERSION_APPLI;
    const v = /v\d+/.exec((document.getElementById("version-appli") || {}).textContent || "");
    return v ? v[0] : "?";
  },
  _diagnostic(description) {
    if (!this._mini() && typeof texteRapport === "function") return texteRapport(description, this.type === "idee");
    const n = typeof Base !== "undefined" && Base.entrees ? Base.entrees.length : "?";
    return [`Mini-appli Blisters JB · version ${this._version()}`, `Date : ${new Date().toLocaleString("fr-FR")}`,
      `Appareil : ${navigator.userAgent}`, `Écran : ${screen.width}×${screen.height}, en ligne : ${navigator.onLine ? "oui" : "non"}`,
      `Blisters dans le téléphone : ${n}`, "", "Ce qui se passe :", description, "", "Erreurs :", ...(this.erreurs.length ? this.erreurs : ["(aucune)"])].join("\n");
  },

  _fenetre() {
    let d = document.getElementById("dialogue-rapport");
    if (d) return d;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog id="dialogue-rapport" class="dialogue-rapport">
        <form method="dialog" id="rapport-form">
          <div class="rapport-types">
            <button type="button" class="bouton" data-rapport-type="bug">🐞 Signaler un problème</button>
            <button type="button" class="bouton" data-rapport-type="idee">💡 Proposer une amélioration</button>
          </div>
          <label for="rapport-texte" class="etiquette-champ" id="rapport-titre"></label>
          <textarea id="rapport-texte" class="champ" rows="5" maxlength="3000"></textarea>
          <label class="bouton gris">📎 Joindre une capture d'écran (facultatif)
            <input type="file" id="rapport-capture" accept="image/*" hidden></label>
          <img id="rapport-apercu" class="rapport-apercu" alt="" hidden>
          <p class="aide">Envoyé directement au créateur de l'appli, avec la version et l'état de l'appli (pour comprendre le problème). Rien de votre collection n'est envoyé.</p>
          <p class="aide" id="rapport-etat"></p>
          <div class="rapport-boutons">
            <button type="button" class="bouton gris" id="rapport-annuler">Annuler</button>
            <button type="submit" class="gros-bouton vert" id="rapport-envoyer">📨 Envoyer</button>
          </div>
        </form>
      </dialog>`);
    d = document.getElementById("dialogue-rapport");
    d.querySelectorAll("[data-rapport-type]").forEach(b => b.addEventListener("click", () => this._choisirType(b.dataset.rapportType)));
    document.getElementById("rapport-annuler").addEventListener("click", () => d.close());
    document.getElementById("rapport-capture").addEventListener("change", e => {
      const f = e.target.files[0]; e.target.value = "";
      if (f) this._joindre(f);
    });
    document.getElementById("rapport-form").addEventListener("submit", e => { e.preventDefault(); this._envoyer(); });
    return d;
  },
  _choisirType(t) {
    this.type = t;
    document.querySelectorAll("[data-rapport-type]").forEach(b => { const choisi = b.dataset.rapportType === t;
      b.classList.toggle("bleu", choisi); b.classList.toggle("gris", !choisi); b.classList.toggle("actif", choisi); });
    document.getElementById("rapport-titre").textContent = t === "idee"
      ? "Votre idée (ex. « pouvoir trier ma collection par année »)"
      : "Que se passe-t-il ? (ex. « l'écran se bloque quand j'ajoute un 2e exemplaire »)";
  },
  ouvrir(type = "bug") {
    const d = this._fenetre();
    this.capture = null;
    document.getElementById("rapport-texte").value = "";
    document.getElementById("rapport-apercu").hidden = true;
    document.getElementById("rapport-etat").textContent = "";
    document.getElementById("rapport-envoyer").disabled = false;
    this._choisirType(type);
    d.showModal();
  },

  // capture réduite (1000 px au plus, JPEG) : assez pour lire l'écran, sans alourdir l'envoi
  async _joindre(f) {
    try {
      const img = await createImageBitmap(f);
      const k = Math.min(1, 1000 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      this.capture = c.toDataURL("image/jpeg", 0.75);
      const a = document.getElementById("rapport-apercu"); a.src = this.capture; a.hidden = false;
    } catch (err) { console.warn(err); document.getElementById("rapport-etat").textContent = "Image illisible : choisissez-en une autre."; }
  },

  async _envoyer() {
    const description = document.getElementById("rapport-texte").value.trim();
    if (!description) { document.getElementById("rapport-etat").textContent = "Écrivez quelques mots d'abord."; return; }
    const etatEnvoi = document.getElementById("rapport-etat");
    document.getElementById("rapport-envoyer").disabled = true;
    etatEnvoi.textContent = "Envoi…";
    const pseudo = typeof Compte !== "undefined" && Compte.session
      ? ((Compte.profil && Compte.profil.pseudo) || (Compte.session.user.user_metadata || {}).pseudo || "") : "";
    const corps = { type: this.type, texte: description.slice(0, 3000), appli: this._mini() ? "mini-appli" : "appli",
                    version: this._version(), pseudo, diagnostic: this._diagnostic(description).slice(0, 19000), capture: this.capture };
    try {
      const rep = await fetch(this.URL, { method: "POST", body: JSON.stringify(corps),
        headers: { apikey: this.CLE, "Content-Type": "application/json", Prefer: "return=minimal" } });
      if (!rep.ok) throw new Error("réponse " + rep.status);
      document.getElementById("dialogue-rapport").close();
      toast(this.type === "idee" ? "💡 Idée envoyée ✔ Merci !" : "🐞 Problème signalé ✔ Merci, il sera regardé.", 5000);
    } catch (err) {
      console.warn("rapport", err);
      document.getElementById("rapport-envoyer").disabled = false;
      etatEnvoi.textContent = "";
      // à défaut : partage du texte (Messages, Mail…), comme avant
      const texte = this._diagnostic(description);
      document.getElementById("dialogue-rapport").close();
      try { if (navigator.share) { await navigator.share({ title: "Briquothèque", text: texte }); return; } } catch (e) { if (e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(texte); } catch (e) { /* presse-papiers indisponible */ }
      toast("L'envoi direct n'a pas marché (connexion ?) : le message est copié, collez-le dans un e-mail ou un SMS.", 7000);
    }
  },

  // Rapports reçus (compte administrateur seulement : les règles de la base refusent les autres)
  async voirRecus() {
    if (typeof Compte === "undefined" || !Compte.client || !Compte.session) { toast("Connectez-vous d'abord (compte administrateur)."); return; }
    const { data, error } = await Compte.client.from("rapports").select("*").order("cree", { ascending: false }).limit(100);
    if (error) { await demander("Lecture des rapports impossible : " + error.message, "OK", "Fermer"); return; }
    let d = document.getElementById("dialogue-rapports-recus");
    if (!d) {
      document.body.insertAdjacentHTML("beforeend", `<dialog id="dialogue-rapports-recus" class="dialogue-rapport">
        <p class="sous-titre">📬 Rapports reçus</p><div id="rapports-liste"></div>
        <button class="bouton gris" id="rapports-fermer">Fermer</button></dialog>`);
      d = document.getElementById("dialogue-rapports-recus");
      document.getElementById("rapports-fermer").addEventListener("click", () => { d.close(); this.majCompteur(); });
      document.getElementById("rapports-liste").addEventListener("click", async e => {
        const b = e.target.closest("[data-rapport-traite]");
        if (!b) return;
        const id = +b.dataset.rapportTraite, fait = b.dataset.fait !== "1";
        const { error: err } = await Compte.client.from("rapports").update({ traite: fait }).eq("id", id);
        if (err) { toast("⚠️ " + err.message); return; }
        b.closest(".rapport").classList.toggle("traite", fait);
        b.dataset.fait = fait ? "1" : "0"; b.textContent = fait ? "↩️ Pas encore traité" : "✔ Traité";
      });
    }
    document.getElementById("rapports-liste").innerHTML = !data.length ? `<p class="aide">Aucun rapport pour l'instant.</p>` : data.map(r => `
      <div class="carte rapport ${r.traite ? "traite" : ""}">
        <p><b>${r.type === "idee" ? "💡 Idée" : "🐞 Problème"}</b> · ${echapper(new Date(r.cree).toLocaleString("fr-FR"))} ·
          ${echapper(r.appli || "")} ${echapper(r.version || "")}${r.pseudo ? ` · ${echapper(r.pseudo)}` : ""}</p>
        <p>${echapper(r.texte)}</p>
        ${r.analyse ? `<div class="alerte info rapport-analyse"><b>🤖 Proposition de Claude</b>${r.analyse_le ? ` (${echapper(new Date(r.analyse_le).toLocaleDateString("fr-FR"))})` : ""}
          <div>${echapper(r.analyse)}</div></div>` : ""}
        ${r.capture ? `<img class="rapport-apercu" src="${echapper(r.capture)}" alt="capture">` : ""}
        <details><summary>Détails (appareil, erreurs, dernières actions)</summary><pre class="rapport-diag">${echapper(r.diagnostic || "")}</pre></details>
        <button class="petit" data-rapport-traite="${r.id}" data-fait="${r.traite ? "1" : "0"}">${r.traite ? "↩️ Pas encore traité" : "✔ Traité"}</button>
      </div>`).join("");
    d.showModal();
  },
  // bouton « 📬 Rapports reçus » des Outils : affiché pour le compte administrateur, avec le nombre de rapports à traiter
  async majCompteur() {
    const b = document.getElementById("btn-rapports-recus");
    if (!b || typeof Compte === "undefined" || !Compte.client) return;
    const admin = !!(Compte.session && Compte.profil && Compte.profil.role === "admin");
    b.hidden = !admin;
    const m = document.getElementById("btn-commune-migrer"); // recopie de l'ancienne base commune (js/base_commune.js)
    if (m) m.hidden = !admin;
    if (!admin) return;
    const { count } = await Compte.client.from("rapports").select("id", { count: "exact", head: true }).eq("traite", false);
    b.textContent = count ? `📬 Rapports reçus (${count} à traiter)` : "📬 Rapports reçus";
  },
};

window.addEventListener("error", e => { Rapport.erreurs.unshift(`${new Date().toLocaleTimeString("fr-FR")} ${e.message}`); Rapport.erreurs.length = Math.min(Rapport.erreurs.length, 8); });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  if (b.dataset.action === "signaler") Rapport.ouvrir("bug");
  else if (b.dataset.action === "rapports-recus") Rapport.voirRecus();
});
