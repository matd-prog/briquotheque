// Compte en ligne (Mathias, 18/10/2026 : identifiant et mot de passe, pour échanger plus tard entre utilisateurs, et si
// l'appli est un jour commercialisée). Service : Supabase (projet « briquotheque », serveurs à Francfort), bibliothèque
// lib/supabase-2.117.2.js. Base et règles de sécurité : outils/supabase_schema.sql (à coller dans « SQL Editor »).
// - créer un compte (pseudo, e-mail, mot de passe ; e-mail de confirmation), se connecter, mot de passe oublié
//   (lien par e-mail -> retour dans l'appli -> nouveau mot de passe), se déconnecter, supprimer son compte (RGPD) ;
// - sauvegarde en ligne de la collection (même contenu que la sauvegarde .json), à la main et une fois par jour
//   toute seule quand on est connecté ; récupération sur un autre téléphone.
// La clé publique (« publishable ») est faite pour être dans l'appli : elle ne permet que ce que les règles de sécurité
// de la base autorisent (chacun ne voit que sa sauvegarde).

const SUPABASE_URL = "https://neadnkbroribjobpsqcu.supabase.co";
const SUPABASE_CLE = "sb_publishable_5EmR-GxELWvYIyN1NJH0pA_5q8vtetO";
const ADRESSE_APPLI = "https://matd-prog.github.io/briquotheque/";

const Compte = {
  client: null,
  session: null,
  profil: null,
  recuperation: false, // arrivé par le lien « mot de passe oublié »
  mode: "connexion",   // connexion | inscription | oubli
  email: "",           // adresse tapée, gardée d'un mode à l'autre
  envoi: null,         // dernier e-mail envoyé { type: "signup" | "recovery", email, quand } (pour « Renvoyer »)

  init() {
    if (typeof supabase === "undefined") return;
    // lien de l'e-mail de confirmation : noté avant que Supabase n'efface la fin de l'adresse
    const confirmation = /type=(signup|email)/.test(location.hash);
    this.client = supabase.createClient(SUPABASE_URL, SUPABASE_CLE, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    this.client.auth.onAuthStateChange((evenement, session) => {
      this.session = session;
      if (evenement === "PASSWORD_RECOVERY") { this.recuperation = true; this.ouvrir(); }
      if (evenement === "SIGNED_IN" && confirmation && !this._confirme) {
        this._confirme = true;
        toast("Adresse e-mail confirmée ✔ Vous êtes connecté.", 5000);
        setTimeout(() => this.ouvrir(), 0);
      }
      this.profil = null;
      if (ecranActuel === "compte") this.rendre();
      this._majTuile();
    });
    // sauvegarde en ligne automatique : une fois par jour, quand la collection est ouverte
    setTimeout(() => this.sauvegardeAuto().catch(err => console.warn("sauvegarde en ligne", err)), 20000);
  },

  // Tuile : le pseudo du compte (pas l'adresse e-mail, demande de Mathias), lu en ligne s'il n'est pas encore connu
  _majTuile() {
    const t = $("tuile-compte-info");
    if (!t) return;
    if (!this.session) { t.textContent = "Connexion, sauvegarde en ligne"; return; }
    const pseudo = (this.profil && this.profil.pseudo) || (this.session.user.user_metadata || {}).pseudo;
    t.textContent = pseudo ? `Connecté : ${pseudo}${this.profil && this.profil.role === "admin" ? " 👑" : ""}` : "Connecté";
    if (!this.profil && !this._lecture) {
      this._lecture = true;
      setTimeout(() => this.chargerProfil().catch(() => {}).finally(() => { this._lecture = false; }), 0);
    }
  },

  async chargerProfil() {
    if (!this.session || this.profil) return this.profil;
    const { data } = await this.client.from("profils").select("*").eq("id", this.session.user.id).maybeSingle();
    this.profil = data || null;
    this._majTuile();
    return this.profil;
  },

  async ouvrir() {
    afficher("compte");
    if (!this.client) { $("compte-contenu").innerHTML = `<p class="alerte">Le service des comptes n'a pas pu être chargé. Vérifiez la connexion Internet, puis rouvrez l'appli.</p>`; return; }
    const { data } = await this.client.auth.getSession();
    this.session = data.session;
    await this.rendre();
  },

  async rendre() {
    const z = $("compte-contenu");
    if (this.recuperation) {
      z.innerHTML = `<p class="intro">🔑 <b>Nouveau mot de passe</b> : choisissez-en un d'au moins 8 caractères.</p>
        <form id="compte-form-mdp" class="compte-form">
          <label for="compte-nouveau" class="etiquette-champ">Nouveau mot de passe</label>
          ${champMdp("compte-nouveau", "new-password", 8)}
          <button class="gros-bouton vert" type="submit">Enregistrer le mot de passe</button>
        </form><p class="aide" id="compte-message"></p>`;
      return;
    }
    if (!this.session) {
      const m = this.mode;
      z.innerHTML = `<p class="intro">👤 <b>Mon compte</b> : un compte garde votre collection en ligne (sur un autre téléphone, ou si
          celui-ci est perdu) et servira bientôt à partager votre collection et à échanger avec d'autres collectionneurs.</p>
        <div class="bascule"><button data-compte-mode="connexion" class="${m === "connexion" ? "choisi" : ""}">Se connecter</button>
          <button data-compte-mode="inscription" class="${m === "inscription" ? "choisi" : ""}">Créer un compte</button></div>
        <form id="compte-form" class="compte-form">
          ${m === "inscription" ? `<label for="compte-pseudo" class="etiquette-champ">Pseudo (visible des autres collectionneurs)</label>
            <input id="compte-pseudo" class="champ" autocomplete="nickname" minlength="3" maxlength="30" required>` : ""}
          <label for="compte-email" class="etiquette-champ">Adresse e-mail</label>
          <input id="compte-email" class="champ" type="email" autocomplete="email" value="${echapper(this.email)}" required>
          ${m !== "oubli" ? `<label for="compte-mdp" class="etiquette-champ">Mot de passe${m === "inscription" ? " (8 caractères au moins)" : ""}</label>
            ${champMdp("compte-mdp", m === "inscription" ? "new-password" : "current-password", m === "inscription" ? 8 : 1)}` : ""}
          <button class="gros-bouton vert" type="submit">${{ connexion: "Se connecter", inscription: "Créer mon compte", oubli: "Recevoir un lien par e-mail" }[m]}</button>
        </form>
        ${m === "oubli" ? `<p class="aide">🔒 Par sécurité, votre mot de passe n'est connu de personne (même pas de l'appli) : on ne peut
          pas vous le renvoyer. Vous recevez un e-mail avec un lien pour en choisir un nouveau.</p>` : ""}
        ${m !== "oubli" ? `<button class="bouton-lien" data-compte-mode="oubli">🔑 Mot de passe oublié ?</button>` : ""}
        ${m === "oubli" ? `<button class="bouton-lien" data-compte-mode="connexion">← Retour à la connexion</button>` : ""}
        <p class="aide" id="compte-message"></p>`;
      return;
    }
    const p = await this.chargerProfil();
    const { data: s } = await this.client.from("sauvegardes").select("maj, articles").eq("user_id", this.session.user.id).maybeSingle();
    z.innerHTML = `<div class="carte">
        <p class="sous-titre">👤 ${echapper((p && p.pseudo) || "Mon compte")}${p && p.role === "admin" ? ` <span class="badge-admin">👑 Administrateur</span>` : ""}</p>
        <p class="score">${echapper(this.session.user.email)}</p></div>
      <div class="carte">
        <p class="sous-titre">☁️ Sauvegarde en ligne</p>
        <p class="score" id="compte-sauvegarde-info">${s ? `Dernière sauvegarde : ${new Date(s.maj).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` +
          (s.articles ? ` · ${s.articles} articles` : "") : "Pas encore de sauvegarde en ligne."} Elle se refait toute seule une fois par jour.</p>
        ${etat.classeur ? `<button class="gros-bouton vert" data-action="compte-sauvegarder">☁️ Sauvegarder maintenant</button>` : ""}
        ${s ? `<button class="gros-bouton ${etat.classeur ? "gris" : "vert"}" data-action="compte-recuperer">📥 Récupérer la collection sauvegardée</button>` : ""}
        <p class="aide">Les photos (blisters, justificatifs) restent dans le téléphone pour l'instant : gardez aussi leurs sauvegardes .zip.</p>
      </div>
      <button class="gros-bouton gris" data-action="compte-deconnecter">Se déconnecter</button>
      <button class="bouton-lien" data-action="compte-supprimer">Supprimer mon compte et mes données en ligne</button>
      <p class="aide" id="compte-message"></p>`;
  },

  message(t) { const m = $("compte-message"); if (m) m.textContent = t; },
  // messages d'erreur de Supabase, en français
  erreur(e) {
    const t = (e && e.message) || String(e);
    if (/invalid login credentials/i.test(t)) return "E-mail ou mot de passe incorrect.";
    if (/email not confirmed/i.test(t)) return "Adresse e-mail pas encore confirmée : ouvrez l'e-mail de confirmation (pensez aux indésirables).";
    if (/already registered|already been registered/i.test(t)) return "Un compte existe déjà avec cette adresse : connectez-vous, ou « Mot de passe oublié ».";
    if (/password should be|weak/i.test(t)) return "Mot de passe trop simple : 8 caractères au moins, avec lettres et chiffres.";
    if (/longer than 72/i.test(t)) return "Mot de passe trop long : 72 caractères au plus (20 à 30 suffisent largement).";
    if (/for security purposes|after \d+ seconds/i.test(t)) return "Patientez une minute avant de redemander un e-mail.";
    if (/rate limit|too many/i.test(t)) return "Trop de tentatives : réessayez dans quelques minutes.";
    if (/failed to fetch|network/i.test(t)) return "Pas de connexion Internet.";
    return "Erreur : " + t;
  },

  async valider(e) {
    e.preventDefault();
    const email = ($("compte-email") || {}).value?.trim(), mdp = ($("compte-mdp") || {}).value;
    this.email = email || "";
    const bouton = e.target.querySelector("[type=submit]");
    bouton.disabled = true;
    try {
      if (this.mode === "connexion") {
        const { error } = await this.client.auth.signInWithPassword({ email, password: mdp });
        if (error) throw error;
        toast("Connecté ✔");
      } else if (this.mode === "inscription") {
        const pseudo = $("compte-pseudo").value.trim();
        const { data: libre, error: e1 } = await this.client.rpc("pseudo_libre", { p: pseudo });
        if (e1) throw e1;
        if (!libre) { this.message(`Le pseudo « ${pseudo} » est déjà pris : choisissez-en un autre.`); return; }
        const { data, error } = await this.client.auth.signUp({ email, password: mdp, options: { data: { pseudo }, emailRedirectTo: ADRESSE_APPLI } });
        if (error) throw error;
        if (!data.session) {
          this.envoi = { type: "signup", email, quand: Date.now() };
          this.afficherEnvoi(`📧 Compte créé. Ouvrez l'e-mail envoyé à <b>${echapper(email)}</b> et touchez le lien
            de confirmation : vous reviendrez dans l'appli, connecté.`);
          return;
        }
        toast("Compte créé ✔");
      } else {
        const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: ADRESSE_APPLI });
        if (error) throw error;
        this.envoi = { type: "recovery", email, quand: Date.now() };
        this.afficherEnvoi(`📧 E-mail envoyé à <b>${echapper(email)}</b> (s'il y a bien un compte à cette adresse) : touchez son lien
          « Choisir un nouveau mot de passe », vous reviendrez dans l'appli pour le taper.`);
        return;
      }
    } catch (err) {
      console.warn(err);
      this.message(this.erreur(err));
    } finally {
      bouton.disabled = false;
    }
  },

  // Écran « e-mail envoyé » avec « Renvoyer » (Supabase impose 60 s entre deux envois à la même adresse)
  afficherEnvoi(html) {
    $("compte-contenu").innerHTML = `<div class="succes">${html}</div>
      <p class="aide">Rien reçu ? Regardez dans les <b>indésirables</b> (spam) et l'onglet <b>Notifications</b> ou <b>Promotions</b> de Gmail.
        L'e-mail vient de « Briquothèque » (ou « Supabase Auth »).</p>
      <button class="gros-bouton gris" data-action="compte-renvoyer" id="compte-renvoyer">📨 Renvoyer l'e-mail</button>
      <button class="bouton-lien" data-compte-mode="connexion">← Retour à la connexion</button>
      <p class="aide" id="compte-message"></p>`;
    this._decompte();
  },

  _decompte() {
    clearInterval(this._minuteur);
    const maj = () => {
      const b = $("compte-renvoyer");
      if (!b || !this.envoi) { clearInterval(this._minuteur); return; }
      const reste = Math.ceil((this.envoi.quand + 60000 - Date.now()) / 1000);
      b.disabled = reste > 0;
      b.textContent = reste > 0 ? `📨 Renvoyer l'e-mail (dans ${reste} s)` : "📨 Renvoyer l'e-mail";
      if (reste <= 0) clearInterval(this._minuteur);
    };
    maj();
    this._minuteur = setInterval(maj, 1000);
  },

  async renvoyer() {
    const v = this.envoi;
    if (!v) return;
    const { error } = v.type === "signup"
      ? await this.client.auth.resend({ type: "signup", email: v.email, options: { emailRedirectTo: ADRESSE_APPLI } })
      : await this.client.auth.resetPasswordForEmail(v.email, { redirectTo: ADRESSE_APPLI });
    if (error) { this.message(this.erreur(error)); return; }
    v.quand = Date.now();
    this._decompte();
    this.message("📧 E-mail renvoyé.");
  },

  async nouveauMotDePasse(e) {
    e.preventDefault();
    const { error } = await this.client.auth.updateUser({ password: $("compte-nouveau").value });
    if (error) { this.message(this.erreur(error)); return; }
    this.recuperation = false;
    history.replaceState(null, "", location.pathname);
    toast("Mot de passe changé ✔");
    this.rendre();
  },

  async sauvegarder(silencieux = false) {
    if (!this.session || !etat.classeur) { if (!silencieux) await demander("Ouvrez d'abord votre collection.", "OK", "Fermer"); return false; }
    const contenu = await Exports.contenuSauvegarde();
    const articles = (contenu.feuilles || []).reduce((n, f) => n + (f.lignes || []).length, 0);
    // garde-fou : une collection plus petite que celle en ligne (nouvel appareil…) ne l'écrase pas sans accord
    const { data: enLigne } = await this.client.from("sauvegardes").select("articles").eq("user_id", this.session.user.id).maybeSingle();
    if (enLigne && enLigne.articles > articles) {
      if (silencieux) return false;
      if (!(await demander(`La sauvegarde en ligne contient ${enLigne.articles} articles, cette collection-ci seulement ${articles}. ` +
          "La remplacer quand même ? (Pour retrouver votre collection sur cet appareil, touchez plutôt « 📥 Récupérer ».)", "Remplacer", "Annuler"))) return false;
    }
    const { error } = await this.client.from("sauvegardes").upsert({ user_id: this.session.user.id, contenu, articles, maj: new Date().toISOString() });
    if (error) { if (!silencieux) this.message(this.erreur(error)); throw error; }
    try { localStorage.setItem("sauvegarde-en-ligne", String(Date.now())); } catch (e) { /* stockage refusé : refaite au prochain lancement */ }
    if (!silencieux) { toast("Collection sauvegardée en ligne ✔"); this.rendre(); }
    return true;
  },

  async sauvegardeAuto() {
    if (!this.client) return;
    const { data } = await this.client.auth.getSession();
    this.session = data.session;
    if (!this.session || !etat.classeur || !etat.classeur.estBase) return;
    let derniere = 0;
    try { derniere = +localStorage.getItem("sauvegarde-en-ligne") || 0; } catch (e) { /* pas de stockage */ }
    if (Date.now() - derniere < 864e5) return;
    await this.sauvegarder(true);
  },

  async recuperer() {
    const { data, error } = await this.client.from("sauvegardes").select("contenu, maj, articles").eq("user_id", this.session.user.id).maybeSingle();
    if (error || !data || !data.contenu || !data.contenu.base) { this.message(error ? this.erreur(error) : "Pas de sauvegarde en ligne utilisable."); return; }
    const quand = `du ${new Date(data.maj).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}${data.articles ? ` (${data.articles} articles)` : ""}`;
    if (!(await demander(etat.classeur ? `Remplacer la collection de cet appareil par la sauvegarde en ligne ${quand} ? Ce qui a été ajouté depuis sur cet appareil sera perdu.`
        : `Installer sur cet appareil votre collection sauvegardée en ligne ${quand} ?`, etat.classeur ? "Remplacer" : "Installer", "Annuler"))) return;
    // nouvel appareil (aucune collection) ou fichier Excel ouvert : la base de l'appli est ouverte avec la sauvegarde
    if (!etat.classeur || !etat.classeur.estBase) { await demarrerBase(true, data.contenu.base, !etat.classeur); return; }
    await etat.classeur.remplacerTout(data.contenu.base);
    await relireContenu();
    toast("Collection récupérée ✔");
    afficher("accueil");
  },

  async deconnecter() {
    await this.client.auth.signOut();
    this.session = null; this.profil = null;
    this._majTuile();
    this.rendre();
    toast("Déconnecté");
  },

  async supprimer() {
    if (!(await demander("Supprimer définitivement votre compte, votre pseudo et votre sauvegarde en ligne ? La collection de ce téléphone, elle, est gardée.", "Supprimer", "Annuler"))) return;
    const { error } = await this.client.rpc("supprimer_mon_compte");
    if (error) { this.message(this.erreur(error)); return; }
    await this.client.auth.signOut();
    this.session = null; this.profil = null;
    this._majTuile();
    this.rendre();
    toast("Compte supprimé");
  },
};

// Supabase refuse plus de 72 caractères : maxlength le dit aussi au générateur de mots de passe du téléphone.
// Champ mot de passe avec 📋 (le copier en clair) et 👁️ (l'afficher) : pour noter celui proposé par le téléphone
function champMdp(id, autocomplete, min) {
  return `<div class="champ-mdp"><input id="${id}" class="champ" type="password" autocomplete="${autocomplete}" minlength="${min}" maxlength="72" required>
    <span class="boutons-mdp"><button type="button" data-copier-mdp="${id}" aria-label="Copier le mot de passe">📋</button>
    <button type="button" data-voir-mdp="${id}" aria-label="Afficher le mot de passe">👁️</button></span></div>`;
}

document.addEventListener("submit", e => {
  if (e.target.id === "compte-form") Compte.valider(e);
  else if (e.target.id === "compte-form-mdp") Compte.nouveauMotDePasse(e);
});
document.addEventListener("click", e => {
  const copie = e.target.closest("[data-copier-mdp]");
  if (copie) {
    const v = $(copie.dataset.copierMdp).value;
    if (!v) { toast("Le mot de passe est vide"); return; }
    navigator.clipboard.writeText(v).then(() => toast("Mot de passe copié : collez-le là où vous le gardez"),
      () => toast("Copie impossible : affichez-le avec 👁️ et recopiez-le"));
    return;
  }
  const oeil = e.target.closest("[data-voir-mdp]");
  if (oeil) {
    const c = $(oeil.dataset.voirMdp), cache = c.type === "password";
    c.type = cache ? "text" : "password";
    oeil.textContent = cache ? "🙈" : "👁️";
    oeil.setAttribute("aria-label", cache ? "Masquer le mot de passe" : "Afficher le mot de passe");
    return;
  }
  const m = e.target.closest("[data-compte-mode]");
  if (m) {
    const champ = $("compte-email");
    if (champ) Compte.email = champ.value.trim();
    Compte.mode = m.dataset.compteMode; Compte.rendre(); return;
  }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "compte") Compte.ouvrir();
  else if (a === "compte-sauvegarder") Compte.sauvegarder().catch(err => console.warn(err));
  else if (a === "compte-recuperer") Compte.recuperer();
  else if (a === "compte-renvoyer") Compte.renvoyer();
  else if (a === "compte-deconnecter") Compte.deconnecter();
  else if (a === "compte-supprimer") Compte.supprimer();
});
Compte.init();
