// Amis et présence (18/10/2026, demande de Mathias ; base en ligne : outils/supabase_amis.sql).
// En-tête : « 👥 n » (amis en ligne, pastille verte) et « 👤 pseudo » quand on est connecté. Écran « 👥 Mes amis » :
// amis avec pastille 🟢 (actif dans l'appli il y a moins de 3 minutes) ou 🔴 (« vu il y a… »), demandes reçues
// (Accepter / Refuser), envoyées (Annuler), recherche d'un collectionneur par pseudo pour l'ajouter.
// Présence : je_suis_la() chaque minute tant que l'appli est ouverte et visible ; seuls les amis la voient.

const Amis = {
  liste: [],

  get client() { return typeof Compte !== "undefined" ? Compte.client : null; },
  get moi() { return typeof Compte !== "undefined" && Compte.session ? Compte.session.user.id : null; },

  async charger() {
    if (!this.client || !this.moi) { this.liste = []; return this.liste; }
    const { data, error } = await this.client.rpc("mes_amis");
    if (!error) this.liste = data || [];
    this.majEntete();
    return this.liste;
  },

  // En-tête : pseudo et nombre d'amis en ligne
  majEntete() {
    const z = $("entete-compte");
    if (!z) return;
    const session = typeof Compte !== "undefined" && Compte.session;
    z.hidden = !session;
    if (!session) return;
    const p = Compte.profil, pseudo = (p && p.pseudo) || (session.user.user_metadata || {}).pseudo || "Mon compte";
    $("entete-pseudo").textContent = `👤 ${pseudo}${p && p.role === "admin" ? " 👑" : ""}`;
    const amis = this.liste.filter(a => a.sens === "ami"), enLigne = amis.filter(a => a.en_ligne).length;
    const recues = this.liste.filter(a => a.sens === "recue").length;
    $("entete-amis").innerHTML = `👥 <span class="pastille ${enLigne ? "verte" : "rouge"}"></span>${enLigne}${recues ? ` <span class="badge-nouveau">+${recues}</span>` : ""}`;
    $("entete-amis").title = `${enLigne} ami(s) en ligne sur ${amis.length}${recues ? `, ${recues} demande(s) reçue(s)` : ""}`;
  },

  // Présence : chaque minute, appli ouverte et visible
  async signaler() {
    if (!this.client || !this.moi || document.visibilityState !== "visible") return;
    await this.client.rpc("je_suis_la");
  },

  _depuis(d) {
    if (!d) return "jamais vu";
    const min = Math.round((Date.now() - new Date(d)) / 60000);
    return min < 60 ? `vu il y a ${min} min` : min < 1440 ? `vu il y a ${Math.round(min / 60)} h` : `vu le ${new Date(d).toLocaleDateString("fr-FR")}`;
  },

  async ouvrir() {
    afficher("amis");
    await this.rendre();
  },

  async rendre() {
    const z = $("amis-contenu");
    if (!this.client || !this.moi) {
      z.innerHTML = `<p class="alerte info">Connectez-vous pour retrouver vos amis.</p>
        <button class="gros-bouton vert" data-action="compte">👤 Se connecter ou créer un compte</button>`;
      return;
    }
    await this.charger();
    // partages reçus et envoyés (js/partages.js) : collection ou doubles, sans valeur
    const pseudoDe = id => (this.liste.find(a => a.ami === id) || {}).pseudo || "?";
    const parts = typeof Partages !== "undefined" ? await Partages.lister() : { recus: [], envoyes: [] };
    const date = d => new Date(d).toLocaleDateString("fr-FR");
    const cartesPartages = typeof Partages === "undefined" ? "" : `
      ${parts.recus.length ? `<div class="carte"><p class="sous-titre">📥 Partagé avec moi</p>${parts.recus.map(p => `<div class="ami-ligne">
        <span>${Partages.TITRES[p.sorte]} de <b>${echapper(pseudoDe(p.de))}</b> <span class="score">${p.nb} · ${date(p.cree_le)}</span></span>
        <span><button class="bouton" data-partage-voir="${p.id}" data-partage-pseudo="${echapper(pseudoDe(p.de))}">👁️ Voir</button>
        <button class="bouton-lien" data-partage-retirer="${p.id}" aria-label="Retirer">✖</button></span></div>`).join("")}</div>` : ""}
      <div class="carte"><p class="sous-titre">📤 Partager, sans aucune valeur</p>
        <p class="aide">Ni prix, ni valeur, ni photo : seulement les noms, codes, n° et quantités. L'ami ne peut rien modifier.</p>
        ${parts.envoyes.map(p => `<div class="ami-ligne"><span>${Partages.TITRES[p.sorte]} → <b>${echapper(pseudoDe(p.a))}</b> <span class="score">${p.nb} · ${date(p.cree_le)}</span></span>
          <span><button class="bouton gris" data-partage-avec="${p.a}" data-partage-pseudo="${echapper(pseudoDe(p.a))}">🔄 Mettre à jour</button>
          <button class="bouton-lien" data-partage-retirer="${p.id}" aria-label="Retirer">✖</button></span></div>`).join("")}
        <div class="tuiles">
          <button class="tuile" data-partage-partager="collection"><span class="icone">📚</span><b>Ma collection</b><small>La partager avec un ami</small></button>
          <button class="tuile" data-partage-partager="doubles"><span class="icone">🔁</span><b>Mes doubles</b><small>Les partager avec un ami</small></button>
          <button class="tuile" data-partage-fichier="collection"><span class="icone">📄</span><b>Fichier de ma collection</b><small>À envoyer à qui vous voulez</small></button>
          <button class="tuile" data-partage-fichier="doubles"><span class="icone">📄</span><b>Fichier de mes doubles</b><small>À envoyer à qui vous voulez</small></button>
        </div></div>`;
    const amis = this.liste.filter(a => a.sens === "ami"), recues = this.liste.filter(a => a.sens === "recue"), envoyees = this.liste.filter(a => a.sens === "envoyee");
    z.innerHTML = `<p class="intro">👥 <b>Mes amis</b> : ${amis.filter(a => a.en_ligne).length} en ligne sur ${amis.length}.
        🟢 dans l'appli en ce moment, 🔴 hors ligne.</p>
      ${recues.length ? `<div class="carte"><p class="sous-titre">📥 Demandes reçues</p>${recues.map(a => `<div class="ami-ligne">
        <span>👤 <b>${echapper(a.pseudo)}</b></span>
        <span><button class="bouton" data-ami-accepter="${a.id}">✔ Accepter</button> <button class="bouton gris" data-ami-retirer="${a.id}" data-ami-quoi="refuser">✖</button></span></div>`).join("")}</div>` : ""}
      <div class="carte"><p class="sous-titre">👥 Amis</p>
        ${amis.map(a => `<div class="ami-ligne"><span><span class="pastille ${a.en_ligne ? "verte" : "rouge"}"></span> <b>${echapper(a.pseudo)}</b>
          <span class="score">${a.en_ligne ? "en ligne" : this._depuis(a.vu_le)}</span></span>
          <span><button class="bouton" data-partage-avec="${a.ami}" data-partage-pseudo="${echapper(a.pseudo)}">📤 Partager</button>
          <button class="bouton" data-echanges-membre="${a.ami}" data-echanges-pseudo="${echapper(a.pseudo)}">🔄 Échanger</button>
          <button class="bouton-lien" data-ami-retirer="${a.id}" data-ami-quoi="retirer" aria-label="Retirer">✖</button></span></div>`).join("")
          || `<p class="aide">Pas encore d'ami : cherchez un collectionneur par son pseudo ci-dessous.</p>`}
      </div>
      ${cartesPartages}
      ${envoyees.length ? `<div class="carte"><p class="sous-titre">📤 Demandes envoyées</p>${envoyees.map(a => `<div class="ami-ligne">
        <span>👤 ${echapper(a.pseudo)} <span class="score">en attente</span></span>
        <button class="bouton-lien" data-ami-retirer="${a.id}" data-ami-quoi="annuler">Annuler</button></div>`).join("")}</div>` : ""}
      <div class="carte"><p class="sous-titre">➕ Ajouter un ami</p>
        <form id="amis-form-chercher" class="compte-form">
          <label for="amis-pseudo" class="etiquette-champ">Pseudo du collectionneur</label>
          <input id="amis-pseudo" class="champ" minlength="2" maxlength="30" autocomplete="off" required>
          <button class="gros-bouton" type="submit">🔎 Chercher</button>
        </form>
        <div id="amis-resultats"></div></div>
      <button class="bouton gris" data-action="amis-actualiser">🔄 Actualiser</button>`;
  },

  async chercher(e) {
    e.preventDefault();
    const q = $("amis-pseudo").value.trim().replace(/[%_\\]/g, "");
    if (q.length < 2) return;
    const { data, error } = await this.client.from("profils").select("id, pseudo").ilike("pseudo", `%${q}%`).neq("id", this.moi).order("pseudo").limit(10);
    const deja = new Map(this.liste.map(a => [a.ami, a.sens]));
    $("amis-resultats").innerHTML = error ? `<p class="alerte">${echapper(Compte.erreur(error))}</p>`
      : (data || []).map(p => `<div class="ami-ligne"><span>👤 <b>${echapper(p.pseudo)}</b></span>
          ${deja.has(p.id) ? `<span class="score">${{ ami: "déjà ami", envoyee: "demande envoyée", recue: "vous a demandé" }[deja.get(p.id)]}</span>`
            : `<button class="bouton" data-ami-ajouter="${p.id}" data-ami-pseudo="${echapper(p.pseudo)}">➕ Ajouter</button>`}</div>`).join("")
        || `<p class="aide">Aucun collectionneur avec ce pseudo.</p>`;
  },

  async ajouter(id, pseudo) {
    const { error } = await this.client.from("amities").insert({ de: this.moi, a: id });
    if (error) { await demander(/duplicate|unique/i.test(error.message) ? "Une demande existe déjà avec ce collectionneur." : "Demande impossible : " + Compte.erreur(error), "OK", "Fermer"); return; }
    toast(`Demande d'ami envoyée à ${pseudo} ✔`);
    this.rendre();
  },

  async accepter(id) {
    const { error } = await this.client.rpc("accepter_ami", { p_id: id });
    if (error) { await demander("Impossible : " + Compte.erreur(error), "OK", "Fermer"); return; }
    toast("Ami ajouté ✔");
    this.rendre();
  },

  async retirer(id, quoi) {
    const a = this.liste.find(x => x.id === id), nom = a ? a.pseudo : "";
    const q = { retirer: `Retirer ${nom} de vos amis ?`, refuser: `Refuser la demande de ${nom} ?`, annuler: `Annuler votre demande à ${nom} ?` }[quoi];
    if (!(await demander(q, "Oui", "Non"))) return;
    const { error } = await this.client.from("amities").delete().eq("id", id);
    if (error) { await demander("Impossible : " + Compte.erreur(error), "OK", "Fermer"); return; }
    this.rendre();
  },
};

document.addEventListener("submit", e => { if (e.target.id === "amis-form-chercher") Amis.chercher(e); });
document.addEventListener("click", e => {
  const x = e.target.closest("[data-ami-ajouter],[data-ami-accepter],[data-ami-retirer]");
  if (x) {
    if (x.dataset.amiAjouter) Amis.ajouter(x.dataset.amiAjouter, x.dataset.amiPseudo);
    else if (x.dataset.amiAccepter) Amis.accepter(+x.dataset.amiAccepter);
    else Amis.retirer(+x.dataset.amiRetirer, x.dataset.amiQuoi);
    return;
  }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  if (b.dataset.action === "amis") Amis.ouvrir();
  else if (b.dataset.action === "amis-actualiser") Amis.rendre();
});
// présence et liste d'amis : chaque minute (et dès que l'appli revient au premier plan)
setInterval(() => { Amis.signaler().catch(() => {}); Amis.charger().catch(() => {}); }, 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { Amis.signaler().catch(() => {}); Amis.charger().catch(() => {}); } });
setTimeout(() => { Amis.signaler().catch(() => {}); Amis.charger().catch(() => {}); }, 3000);
