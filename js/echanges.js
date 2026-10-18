// Échanges entre collectionneurs (18/10/2026, demande de Mathias ; base en ligne : outils/supabase_echanges.sql).
// Chacun PUBLIE volontairement ses doubles (au-delà des exemplaires gardés, les plus petits n° gardés) et sa liste de
// souhaits (figurines et customs pas encore dans la collection). L'appli trouve les collectionneurs qui ont ce que vous
// cherchez et cherchent ce que vous avez en double (fonction correspondances), propose un échange, puis une discussion
// suit (messages) ; le destinataire accepte ou refuse, l'expéditeur peut annuler, l'échange fini est marqué « terminé ».
// Clé commune entre collections : F|<code LEGO> (figurine officielle), C|<code catalogue JB> ou C|<nom> (custom).
// Valeur (demande de Mathias, 18/10) : chaque figurine porte sa valeur estimée (Valeur de l'appli, mémorisée à chaque
// calcul ; sinon prix JB du catalogue ; sinon la valeur publiée par l'autre collectionneur) et la proposition compare le
// total donné et reçu (« équilibré » à 15 % près). « ✉️ Proposer un échange à un membre » : un ami ou un pseudo cherché,
// toutes ses figurines publiées et tous vos doubles, au choix.

const STATUTS_ECHANGE = { envoyee: "⏳ En attente de réponse", acceptee: "🤝 Acceptée", refusee: "❌ Refusée", annulee: "🚫 Annulée", terminee: "✅ Terminée" };

const Echanges = {
  vue: "accueil",       // accueil | proposer | proposition
  partenaire: null,     // { user_id, pseudo, il_a, il_cherche } pour « proposer »
  propositionId: null,

  valeurs: null,        // Map clé -> valeur estimée d'un exemplaire (€), mémorisée au dernier calcul de la Valeur

  get client() { return typeof Compte !== "undefined" ? Compte.client : null; },

  // Appelée par la Valeur (js/valeur.js) à chaque calcul : valeur d'un exemplaire de chaque figurine, par clé d'échange
  async memoriserValeurs(details) {
    await CatalogueJB.charger().catch(() => {});
    const m = {};
    for (const d of details) {
      if (!(d.unitaire > 0)) continue;
      if (d.type === "MINIFIG") m["F|" + String(d.code).toUpperCase()] = Math.round(d.unitaire * 100) / 100;
      else if (d.type === "CUSTOM") {
        const f = CatalogueJB.trouver(d.code) || Collection._jbDe({ code: d.code, nom: d.nom });
        const cle = "C|" + (f ? f.code : normaliser(Collection._sansNumero(d.nom))).toUpperCase();
        if (!m[cle]) m[cle] = Math.round(d.unitaire * 100) / 100;
      }
    }
    this.valeurs = new Map(Object.entries(m));
    await Memoire.ecrire({ date: new Date().toISOString(), valeurs: m }, "valeurs_echange");
  },
  async _chargerValeurs() {
    if (this.valeurs) return;
    const v = await Memoire.lire("valeurs_echange").catch(() => null);
    this.valeurs = new Map(Object.entries((v && v.valeurs) || {}));
  },
  // Valeur d'un exemplaire : la mienne (Valeur), sinon le prix JB, sinon celle publiée
  valeurDe(x) {
    const v = this.valeurs && this.valeurs.get(x.cle);
    if (v > 0) return v;
    if (x.cle && x.cle.startsWith("C|")) { const f = CatalogueJB.trouver(x.cle.slice(2)); if (f && f.prix > 0) return f.prix; }
    return x.valeur > 0 ? +x.valeur : 0;
  },
  _euros(v) { return v > 0 ? v.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: v < 100 ? 2 : 0 }) : "?"; },
  // Balance d'un échange : total donné, total reçu, verdict
  balance(donne, recois) {
    const t = l => l.reduce((s, x) => s + this.valeurDe(x) * (x.n || 1), 0), d = t(donne), r = t(recois);
    const inconnues = [...donne, ...recois].filter(x => !(this.valeurDe(x) > 0)).length;
    const ecart = r - d, ref = Math.max(d, r);
    const verdict = !ref ? "Valeurs inconnues" : Math.abs(ecart) <= 0.15 * ref ? "⚖️ Échange équilibré"
      : ecart > 0 ? `📈 Vous recevez ${this._euros(ecart)} de plus` : `📉 Vous donnez ${this._euros(-ecart)} de plus`;
    return { d, r, verdict, inconnues, html: `<div class="balance-echange ${!ref ? "" : Math.abs(ecart) <= 0.15 * ref ? "ok" : "ecart"}">
      <span>Vous donnez <b>${this._euros(d)}</b></span><span>Vous recevez <b>${this._euros(r)}</b></span>
      <b>${verdict}</b>${inconnues ? `<span class="score">${inconnues} figurine(s) sans valeur connue</span>` : ""}</div>` };
  },
  get moi() { return typeof Compte !== "undefined" && Compte.session ? Compte.session.user.id : null; },

  _garder() { try { return Math.max(1, +localStorage.getItem("echanges-garder") || 1); } catch (e) { return 1; } },
  _exclus() { try { return new Set(JSON.parse(localStorage.getItem("echanges-exclus") || "[]")); } catch (e) { return new Set(); } },
  _ecrire(cle, v) { try { localStorage.setItem(cle, typeof v === "string" ? v : JSON.stringify(v)); } catch (e) { /* stockage refusé */ } },

  // Clé commune d'une figurine de la collection
  _cleCase(c) {
    if (c.onglet === THEME_CUSTOMS.onglet) {
      const f = Collection._jbDe(c);
      return "C|" + (f ? f.code : normaliser(Collection._sansNumero(c.nom))).toUpperCase();
    }
    return "F|" + String(c.code).toUpperCase();
  },
  _cleSouhait(s) {
    if (s.type === "Custom") { const f = CatalogueJB.trouver(s.code); return "C|" + String(f ? f.code : s.code || normaliser(s.nom)).toUpperCase(); }
    return "F|" + String(s.code).toUpperCase();
  },

  // Doubles : par clé, les exemplaires au-delà de ceux gardés (les plus petits n° sont gardés)
  async doubles() {
    await CatalogueJB.charger().catch(() => {});
    await this._chargerValeurs();
    const garder = this._garder(), parCle = new Map();
    for (const [onglet, o] of Object.entries(etat.collection || {}))
      for (const c of o.cases.filter(c => c.code)) {
        const x = { ...c, onglet }, k = this._cleCase(x);
        if (!parCle.has(k)) parCle.set(k, []);
        parCle.get(k).push(x);
      }
    const res = [];
    for (const [cle, cases] of parCle) {
      if (cases.length <= garder) continue;
      const tries = Collection._parNumero(cases), donnes = tries.slice(garder), c = tries[0], custom = c.onglet === THEME_CUSTOMS.onglet;
      const x = { cle, type: custom ? "Custom" : "Figurine", code: c.code, nom: custom ? Collection._sansNumero(c.nom) : c.nom || c.code,
        quantite: donnes.length, numeros: donnes.map(d => Collection._numero(d)).filter(Boolean).join(", "), total: cases.length };
      x.valeur = this.valeurDe(x) || null;
      res.push(x);
    }
    return res.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  },

  async souhaits() {
    if (typeof Souhaits === "undefined") return [];
    await CatalogueJB.charger().catch(() => {});
    await this._chargerValeurs();
    const liste = (await Souhaits.charger()).filter(s => s.type === "Figurine" || s.type === "Custom");
    const possede = await Souhaits._possedes();
    const vus = new Set(), res = [];
    for (const s of liste.filter(s => !possede(s))) {
      const cle = this._cleSouhait(s);
      if (vus.has(cle)) continue;
      vus.add(cle);
      const x = { cle, type: s.type, code: s.code, nom: s.nom || s.code };
      x.valeur = this.valeurDe(x) || null;
      res.push(x);
    }
    return res;
  },

  async ouvrir() {
    afficher("echanges");
    this.vue = "accueil";
    await this.rendre();
  },

  async _connecte() {
    if (!this.client) return false;
    const { data } = await this.client.auth.getSession();
    Compte.session = data.session;
    return !!data.session;
  },

  async rendre() {
    const z = $("echanges-contenu");
    if (!(await this._connecte())) {
      z.innerHTML = `<p class="intro">🔄 <b>Échanges</b> : publiez vos doubles et votre liste de souhaits, l'appli trouve les collectionneurs
          qui ont ce que vous cherchez et cherchent ce que vous avez en double.</p>
        <p class="alerte info">Il faut un compte pour échanger.</p>
        <button class="gros-bouton vert" data-action="compte">👤 Se connecter ou créer un compte</button>`;
      return;
    }
    if (!etat.classeur) { z.innerHTML = `<p class="alerte">Ouvrez d'abord votre collection.</p>`; return; }
    await this._chargerValeurs();
    if (this.vue === "proposer") return this._rendreProposer(z);
    if (this.vue === "membre") return this._rendreMembre(z);
    if (this.vue === "proposition") return this._rendreProposition(z);
    z.innerHTML = `<p class="aide">Chargement…</p>`;
    const [doubles, souhaits, publiees, corresp, props] = await Promise.all([
      this.doubles(), this.souhaits(),
      this.client.from("annonces_echange").select("sens, maj").eq("user_id", this.moi),
      this.client.rpc("correspondances"),
      this.client.from("propositions").select("*").order("maj", { ascending: false }),
    ]);
    if (corresp.error || props.error) { z.innerHTML = `<p class="alerte">Échanges indisponibles : ${echapper(Compte.erreur(corresp.error || props.error))}</p>`; return; }
    const exclus = this._exclus(), garder = this._garder();
    const offertes = doubles.filter(d => !exclus.has(d.cle));
    const pub = publiees.data || [], derniere = pub.reduce((m, a) => a.maj > m ? a.maj : m, "");
    const nOffres = pub.filter(a => a.sens === "offre").length, nSouhaits = pub.filter(a => a.sens === "souhait").length;
    const pseudos = await this._pseudos((props.data || []).map(p => p.de === this.moi ? p.a : p.de));
    const liste = l => l.map(x => echapper(x.nom) + (x.numeros ? ` <span class="score">(n° ${echapper(x.numeros)})</span>` : x.quantite > 1 ? ` ×${x.quantite}` : "")
      + (this.valeurDe(x) > 0 ? ` <span class="prix-echange">${this._euros(this.valeurDe(x))}</span>` : "")).join(", ");

    z.innerHTML = `<p class="intro">🔄 <b>Échanges</b> : vos doubles contre les figurines de votre liste de souhaits, avec d'autres collectionneurs.</p>

      <div class="carte">
        <p class="sous-titre">📢 Mes annonces</p>
        <p>Je garde <span class="bascule-mini">${[1, 2, 3].map(n => `<button data-echanges-garder="${n}" class="${n === garder ? "choisi" : ""}">${n}</button>`).join("")}</span>
          exemplaire(s) de chaque figurine (les plus petits n°) : <b>${offertes.length}</b> figurine(s) en double à proposer.</p>
        <details><summary>Choisir les doubles à proposer (${offertes.length}/${doubles.length})</summary>
          <div class="liste-cases">${doubles.map(d => `<label><input type="checkbox" data-echanges-exclure="${echapper(d.cle)}" ${exclus.has(d.cle) ? "" : "checked"}>
            ${echapper(d.nom)} <span class="score">×${d.quantite}${d.numeros ? ` · n° ${echapper(d.numeros)}` : ""}${d.valeur ? ` · ${this._euros(d.valeur)}` : ""}</span></label>`).join("") || "<p class=\"aide\">Aucun double.</p>"}</div></details>
        <p><b>${souhaits.length}</b> figurine(s) de votre <a href="#" data-action="souhaits">liste de souhaits</a> à chercher.</p>
        <p class="score">${derniere ? `Publié le ${new Date(derniere).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} : ${nOffres} double(s), ${nSouhaits} souhait(s). Republiez après vos changements.` : "Rien de publié pour l'instant : les autres collectionneurs ne voient rien de votre collection."}</p>
        <button class="gros-bouton vert" data-action="echanges-publier">📢 ${derniere ? "Mettre à jour" : "Publier"} mes annonces</button>
        ${derniere ? `<button class="bouton-lien" data-action="echanges-retirer">🗑️ Retirer mes annonces</button>` : ""}
        <p class="aide">Seuls sont publiés votre pseudo, les doubles cochés et votre liste de souhaits (noms, codes, n°) : ni prix, ni photos, ni le reste de la collection.</p>
      </div>

      <button class="gros-bouton" data-action="echanges-membre">✉️ Proposer un échange à un membre</button>

      <div class="carte">
        <p class="sous-titre">🤝 Collectionneurs avec qui échanger</p>
        ${!derniere ? `<p class="aide">Publiez d'abord vos annonces pour voir qui a ce que vous cherchez.</p>`
          : (corresp.data || []).length ? (corresp.data || []).sort((a, b) => (Math.min(b.il_a.length, b.il_cherche.length) - Math.min(a.il_a.length, a.il_cherche.length)) || (b.il_a.length - a.il_a.length))
            .map((c, i) => `<div class="echange-partenaire">
              <p><b>👤 ${echapper(c.pseudo)}</b>${c.il_a.length && c.il_cherche.length ? ` <span class="badge-admin">échange possible</span>` : ""}</p>
              ${c.il_a.length ? `<p>⭐ A ${c.il_a.length} figurine(s) de votre liste : ${liste(c.il_a)}</p>` : ""}
              ${c.il_cherche.length ? `<p>🔁 Cherche ${c.il_cherche.length} de vos doubles : ${liste(c.il_cherche)}</p>` : ""}
              <button class="bouton" data-echanges-proposer="${i}">✉️ Proposer un échange</button></div>`).join("")
          : `<p class="aide">Personne pour l'instant. Plus il y aura de collectionneurs inscrits, plus il y aura d'échanges possibles.</p>`}
      </div>

      <div class="carte">
        <p class="sous-titre">📬 Mes propositions</p>
        ${(props.data || []).length ? props.data.map(p => {
          const recue = p.a === this.moi, qui = echapper(pseudos.get(recue ? p.de : p.a) || "?");
          return `<button class="echange-ligne ${recue && p.statut === "envoyee" ? "a-traiter" : ""}" data-echanges-ouvrir="${p.id}">
            <b>${recue ? `📥 De ${qui}` : `📤 À ${qui}`}</b> · ${STATUTS_ECHANGE[p.statut]}<br>
            <span class="score">Vous donnez ${(recue ? p.je_recois : p.je_donne).length} · vous recevez ${(recue ? p.je_donne : p.je_recois).length}
            · ${new Date(p.maj).toLocaleDateString("fr-FR")}</span></button>`;
        }).join("") : `<p class="aide">Aucune proposition.</p>`}
        <button class="bouton gris" data-action="echanges-actualiser">🔄 Actualiser</button>
      </div>
      <p class="aide">⚠️ Les échanges se font entre collectionneurs, à leurs risques : mettez-vous d'accord sur l'envoi (lettre ou
        colis suivi) avant d'expédier. Ne communiquez jamais de mot de passe ni de coordonnées bancaires dans les messages.</p>`;
    this._corresp = corresp.data || [];
  },

  async _pseudos(ids) {
    const m = new Map(), uniques = [...new Set(ids)].filter(Boolean);
    if (!uniques.length) return m;
    const { data } = await this.client.from("profils").select("id, pseudo").in("id", uniques);
    (data || []).forEach(p => m.set(p.id, p.pseudo));
    return m;
  },

  async publier(retirer = false) {
    if (!(await this._connecte())) return;
    let offres = [], souhaits = [];
    if (!retirer) {
      const exclus = this._exclus();
      offres = (await this.doubles()).filter(d => !exclus.has(d.cle)).map(({ total, ...d }) => d);
      souhaits = await this.souhaits();
      if (!offres.length && !souhaits.length) { await demander("Rien à publier : pas de double ni de figurine dans votre liste de souhaits.", "OK", "Fermer"); return; }
    } else if (!(await demander("Retirer toutes vos annonces ? Les autres collectionneurs ne verront plus vos doubles ni vos souhaits (les propositions en cours restent).", "Retirer", "Annuler"))) return;
    const { error } = await this.client.rpc("publier_annonces", { offres, souhaits });
    if (error) { await demander("Publication impossible : " + Compte.erreur(error), "OK", "Fermer"); return; }
    toast(retirer ? "Annonces retirées ✔" : `Annonces publiées ✔ (${offres.length} double(s), ${souhaits.length} souhait(s))`, 4000);
    this.rendre();
  },

  // Choix d'un membre : amis, ou pseudo cherché
  async _rendreMembre(z) {
    const amis = typeof Amis !== "undefined" ? (await Amis.charger()).filter(a => a.sens === "ami") : [];
    z.innerHTML = `<p class="intro">✉️ <b>Proposer un échange à un membre</b> : choisissez un ami ou cherchez un collectionneur.
        Vous verrez toutes les figurines qu'il a publiées et tous vos doubles, avec leur valeur.</p>
      <div class="carte"><p class="sous-titre">👥 Mes amis</p>
        ${amis.map(a => `<div class="ami-ligne"><span><span class="pastille ${a.en_ligne ? "verte" : "rouge"}"></span> <b>${echapper(a.pseudo)}</b></span>
          <button class="bouton" data-echanges-membre="${a.ami}" data-echanges-pseudo="${echapper(a.pseudo)}">🔄 Échanger</button></div>`).join("")
          || `<p class="aide">Pas encore d'ami (menu « 👥 Mes amis »).</p>`}</div>
      <div class="carte"><p class="sous-titre">🔎 Un autre collectionneur</p>
        <form id="echanges-form-membre" class="compte-form">
          <input id="echanges-pseudo" class="champ" minlength="2" maxlength="30" placeholder="Pseudo" autocomplete="off" required>
          <button class="gros-bouton" type="submit">🔎 Chercher</button>
        </form><div id="echanges-membres"></div></div>
      <button class="bouton-lien" data-action="echanges-retour">← Retour aux échanges</button>`;
  },

  async chercherMembre(e) {
    e.preventDefault();
    const q = $("echanges-pseudo").value.trim().replace(/[%_\\]/g, "");
    const { data } = await this.client.from("profils").select("id, pseudo").ilike("pseudo", `%${q}%`).neq("id", this.moi).order("pseudo").limit(10);
    $("echanges-membres").innerHTML = (data || []).map(p => `<div class="ami-ligne"><span>👤 <b>${echapper(p.pseudo)}</b></span>
      <button class="bouton" data-echanges-membre="${p.id}" data-echanges-pseudo="${echapper(p.pseudo)}">🔄 Échanger</button></div>`).join("")
      || `<p class="aide">Aucun collectionneur avec ce pseudo.</p>`;
  },

  // Membre choisi : toutes ses figurines publiées (⭐ celles de ma liste) et tous mes doubles (🔁 ceux qu'il cherche)
  async choisirMembre(id, pseudo) {
    const [{ data, error }, doubles, souhaits] = await Promise.all([
      this.client.from("annonces_echange").select("*").eq("user_id", id), this.doubles(), this.souhaits()]);
    if (error) { await demander("Lecture impossible : " + Compte.erreur(error), "OK", "Fermer"); return; }
    const sesOffres = (data || []).filter(a => a.sens === "offre"), sesSouhaits = new Set((data || []).filter(a => a.sens === "souhait").map(a => a.cle));
    const mesSouhaits = new Set(souhaits.map(s => s.cle)), exclus = this._exclus();
    this.partenaire = this._preparer({ user_id: id, pseudo, libre: true,
      il_a: sesOffres.map(o => ({ ...o, voulu: mesSouhaits.has(o.cle) })).sort((a, b) => b.voulu - a.voulu || a.nom.localeCompare(b.nom, "fr")),
      il_cherche: doubles.filter(d => !exclus.has(d.cle)).map(d => ({ ...d, voulu: sesSouhaits.has(d.cle) })).sort((a, b) => b.voulu - a.voulu || a.nom.localeCompare(b.nom, "fr")) });
    if (!sesOffres.length && !sesSouhaits.size)
      toast(`${pseudo} n'a encore rien publié : proposez-lui vos doubles, il pourra répondre par message.`, 5000);
    this.vue = "proposer"; this.rendre();
  },

  // Une ligne par exemplaire (son n° s'il en a un) : chaque case cochée = un exemplaire donné ou reçu
  _unites(l) {
    return l.flatMap(x => {
      const nums = String(x.numeros || "").split(",").map(n => n.trim()).filter(Boolean);
      const n = Math.max(nums.length, x.quantite || 1);
      return Array.from({ length: n }, (_, i) => ({ ...x, numeros: nums[i] || "", quantite: 1, premier: i === 0 }));
    });
  },
  _preparer(c) { return { ...c, il_a: this._unites(c.il_a), il_cherche: this._unites(c.il_cherche) }; },

  _rendreProposer(z) {
    const c = this.partenaire;
    const ligne = (x, groupe, i) => `<label><input type="checkbox" name="${groupe}" value="${i}" ${x.premier && (c.libre ? x.voulu : true) ? "checked" : ""}>
      <span>${x.voulu && c.libre ? (groupe === "recois" ? "⭐ " : "🔁 ") : ""}${echapper(x.nom)}${x.numeros ? ` <span class="score">(n° ${echapper(x.numeros)})</span>` : ""}
</span>
      <span class="prix-echange">${this._euros(this.valeurDe(x))}</span></label>`;
    z.innerHTML = `<p class="intro">✉️ <b>Proposer un échange à ${echapper(c.pseudo)}</b>${c.libre ? " : ⭐ = dans votre liste de souhaits, 🔁 = il la cherche." : ""}</p>
      <form id="echanges-form-proposer" class="compte-form">
        <p class="sous-titre">Je donne${c.libre ? " (mes doubles)" : " (il les cherche)"}</p>
        <div class="liste-cases">${c.il_cherche.map((x, i) => ligne(x, "donne", i)).join("") || `<p class="aide">${c.libre ? "Pas de double à proposer." : "Rien de ce qu'il cherche : proposez-lui autre chose dans le message."}</p>`}</div>
        <p class="sous-titre">Je reçois${c.libre ? " (ses figurines publiées)" : " (dans ma liste de souhaits)"}</p>
        <div class="liste-cases">${c.il_a.map((x, i) => ligne(x, "recois", i)).join("") || `<p class="aide">${c.libre ? "Il n'a rien publié" : "Il n'a rien de votre liste"} : demandez-lui dans le message.</p>`}</div>
        <div id="echanges-balance"></div>
        <label for="echanges-message" class="etiquette-champ">Message</label>
        <textarea id="echanges-message" class="champ" rows="4" maxlength="2000" placeholder="Bonjour ! Je vous propose cet échange. Envoi en lettre suivie de mon côté, et du vôtre ?"></textarea>
        <button class="gros-bouton vert" type="submit">✉️ Envoyer la proposition</button>
      </form>
      <button class="bouton-lien" data-action="echanges-retour">← Retour aux échanges</button>
      <p class="aide">Valeurs estimées d'un exemplaire : votre « Valeur » (ventes BrickLink, prix d'achat), le prix JB, ou la valeur annoncée par l'autre collectionneur.</p>`;
    this.majBalance();
  },

  _choix() {
    const f = $("echanges-form-proposer"), c = this.partenaire;
    if (!f) return { donne: [], recois: [] };
    const pris = (n, l) => [...f.querySelectorAll(`[name=${n}]:checked`)].map(x => l[+x.value]);
    return { donne: pris("donne", c.il_cherche), recois: pris("recois", c.il_a) };
  },
  majBalance() {
    const z = $("echanges-balance");
    if (!z) return;
    const { donne, recois } = this._choix();
    z.innerHTML = donne.length || recois.length ? this.balance(donne, recois).html : "";
  },

  async envoyerProposition(e) {
    e.preventDefault();
    const c = this.partenaire, f = e.target, { donne, recois } = this._choix();
    const texte = $("echanges-message").value.trim();
    if (!donne.length && !recois.length && !texte) { toast("Cochez au moins une figurine, ou écrivez un message."); return; }
    const garder = x => ({ cle: x.cle, type: x.type, code: x.code, nom: x.nom, numeros: x.numeros || "", valeur: this.valeurDe(x) || null });
    const bouton = f.querySelector("[type=submit]"); bouton.disabled = true;
    const { data, error } = await this.client.from("propositions").insert({ de: this.moi, a: c.user_id, je_donne: donne.map(garder), je_recois: recois.map(garder) }).select("id").single();
    if (!error && texte) await this.client.from("messages").insert({ proposition_id: data.id, auteur: this.moi, texte });
    bouton.disabled = false;
    if (error) { await demander("Envoi impossible : " + Compte.erreur(error), "OK", "Fermer"); return; }
    toast(`Proposition envoyée à ${c.pseudo} ✔`, 4000);
    this.propositionId = data.id; this.vue = "proposition"; this.rendre();
  },

  async _rendreProposition(z) {
    z.innerHTML = `<p class="aide">Chargement…</p>`;
    const [{ data: p, error }, { data: msgs }] = await Promise.all([
      this.client.from("propositions").select("*").eq("id", this.propositionId).maybeSingle(),
      this.client.from("messages").select("*").eq("proposition_id", this.propositionId).order("cree_le"),
    ]);
    if (error || !p) { z.innerHTML = `<p class="alerte">Proposition introuvable.</p><button class="bouton-lien" data-action="echanges-retour">← Retour</button>`; return; }
    const recue = p.a === this.moi, pseudos = await this._pseudos([p.de, p.a]), autre = echapper(pseudos.get(recue ? p.de : p.a) || "?");
    const donne = recue ? p.je_recois : p.je_donne, recois = recue ? p.je_donne : p.je_recois;
    const l = x => `<li>${echapper(x.nom)}${x.numeros ? ` <span class="score">(n° ${echapper(x.numeros)})</span>` : ""} <span class="prix-echange">${this._euros(this.valeurDe(x))}</span></li>`;
    const actions = [
      recue && p.statut === "envoyee" ? `<button class="gros-bouton vert" data-echanges-statut="acceptee">🤝 Accepter</button><button class="gros-bouton gris" data-echanges-statut="refusee">❌ Refuser</button>` : "",
      !recue && ["envoyee", "acceptee"].includes(p.statut) ? `<button class="bouton gris" data-echanges-statut="annulee">🚫 Annuler la proposition</button>` : "",
      p.statut === "acceptee" ? `<button class="gros-bouton vert" data-echanges-statut="terminee">✅ Échange fait (figurines reçues)</button>` : "",
    ].join("");
    z.innerHTML = `<p class="intro">${recue ? `📥 Proposition de <b>${autre}</b>` : `📤 Proposition à <b>${autre}</b>`} · ${STATUTS_ECHANGE[p.statut]}</p>
      <div class="carte"><p class="sous-titre">Vous donnez</p><ul>${donne.map(l).join("") || "<li>—</li>"}</ul>
        <p class="sous-titre">Vous recevez</p><ul>${recois.map(l).join("") || "<li>—</li>"}</ul>${this.balance(donne, recois).html}${actions}</div>
      <div class="carte"><p class="sous-titre">💬 Messages</p>
        <div class="echange-messages">${(msgs || []).map(m => `<div class="echange-message ${m.auteur === this.moi ? "moi" : ""}">
          <span class="score">${m.auteur === this.moi ? "Vous" : autre} · ${new Date(m.cree_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
          <div>${echapper(m.texte).replace(/\n/g, "<br>")}</div></div>`).join("") || `<p class="aide">Aucun message.</p>`}</div>
        <form id="echanges-form-message" class="compte-form">
          <textarea id="echanges-texte" class="champ" rows="3" maxlength="2000" placeholder="Votre message (adresse d'envoi, suivi…)" required></textarea>
          <button class="gros-bouton" type="submit">Envoyer</button>
        </form>
        <button class="bouton gris" data-action="echanges-actualiser">🔄 Actualiser</button></div>
      <button class="bouton-lien" data-action="echanges-retour">← Retour aux échanges</button>`;
  },

  async envoyerMessage(e) {
    e.preventDefault();
    const texte = $("echanges-texte").value.trim();
    if (!texte) return;
    const { error } = await this.client.from("messages").insert({ proposition_id: this.propositionId, auteur: this.moi, texte });
    if (error) { await demander("Message non envoyé : " + Compte.erreur(error), "OK", "Fermer"); return; }
    this.rendre();
  },

  async changerStatut(statut) {
    const q = { acceptee: "Accepter cet échange ? Mettez-vous ensuite d'accord par message sur l'envoi.", refusee: "Refuser cette proposition ?",
      annulee: "Annuler votre proposition ?", terminee: "Marquer l'échange comme fait (figurines bien reçues) ?" }[statut];
    if (!(await demander(q, "Oui", "Non"))) return;
    const { error } = await this.client.rpc("changer_statut", { p_id: this.propositionId, p_statut: statut });
    if (error) { await demander("Impossible : " + Compte.erreur(error), "OK", "Fermer"); return; }
    toast(STATUTS_ECHANGE[statut]);
    this.rendre(); this.majTuile();
  },

  // Tuile : propositions reçues qui attendent une réponse
  async majTuile() {
    const t = $("tuile-echanges-info");
    if (!t || !this.client || !this.moi) return;
    const { count } = await this.client.from("propositions").select("id", { count: "exact", head: true }).eq("a", this.moi).eq("statut", "envoyee");
    t.textContent = count ? `📬 ${count} proposition(s) à traiter` : "Doubles contre souhaits";
  },
};

document.addEventListener("submit", e => {
  if (e.target.id === "echanges-form-proposer") Echanges.envoyerProposition(e);
  else if (e.target.id === "echanges-form-membre") Echanges.chercherMembre(e);
  else if (e.target.id === "echanges-form-message") Echanges.envoyerMessage(e);
});
document.addEventListener("change", e => {
  if (e.target.closest("#echanges-form-proposer")) { Echanges.majBalance(); return; }
  const x = e.target.closest("[data-echanges-exclure]");
  if (!x) return;
  const exclus = Echanges._exclus();
  if (x.checked) exclus.delete(x.dataset.echangesExclure); else exclus.add(x.dataset.echangesExclure);
  Echanges._ecrire("echanges-exclus", [...exclus]);
});
document.addEventListener("click", e => {
  const g = e.target.closest("[data-echanges-garder]");
  if (g) { Echanges._ecrire("echanges-garder", g.dataset.echangesGarder); Echanges.rendre(); return; }
  const p = e.target.closest("[data-echanges-proposer]");
  if (p) { Echanges.partenaire = Echanges._preparer(Echanges._corresp[+p.dataset.echangesProposer]); Echanges.vue = "proposer"; Echanges.rendre(); return; }
  const mb = e.target.closest("[data-echanges-membre]");
  if (mb) { if (ecranActuel !== "echanges") afficher("echanges"); Echanges.choisirMembre(mb.dataset.echangesMembre, mb.dataset.echangesPseudo); return; }
  const o = e.target.closest("[data-echanges-ouvrir]");
  if (o) { Echanges.propositionId = +o.dataset.echangesOuvrir; Echanges.vue = "proposition"; Echanges.rendre(); return; }
  const s = e.target.closest("[data-echanges-statut]");
  if (s) { Echanges.changerStatut(s.dataset.echangesStatut); return; }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "echanges") Echanges.ouvrir();
  else if (a === "echanges-publier") Echanges.publier();
  else if (a === "echanges-retirer") Echanges.publier(true);
  else if (a === "echanges-actualiser") Echanges.rendre();
  else if (a === "echanges-membre") { Echanges.vue = "membre"; Echanges.rendre(); }
  else if (a === "echanges-retour") { Echanges.vue = "accueil"; Echanges.rendre(); }
});
setTimeout(() => Echanges.majTuile().catch(() => {}), 8000);
