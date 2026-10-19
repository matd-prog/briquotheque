// Vidéo de présentation (pour JB Spielwaren) : l'appli filmée sur un téléphone, sous-titres dans la langue choisie.
// Lancer : python3 -m http.server 8765 (racine du dépôt) puis NODE_PATH=$(npm root -g) node video.js fr (ou de) ;
// donne video_<langue>.webm (puis converti en .mp4 avec ffmpeg). Compte simulé (rien n'est envoyé), jamais de prix.
const { chromium } = require("playwright"); const fs = require("fs");
const L = process.argv[2] || "fr", D = __dirname, O = process.env.SORTIE || __dirname, A = "/home/user/collection-lego-prive/album_photos/";
const BASE = JSON.parse(fs.readFileSync("/home/user/collection-lego-prive/sauvegarde/collection.json", "utf8")).base;
// voix off (dépôt privé, presentation/voix/, faite par l'action GitHub « Voix off (vidéo) ») : durée de chaque phrase
const VOIX = "/home/user/collection-lego-prive/presentation/voix/";
const DUREES = fs.existsSync(VOIX + "durees.json") ? JSON.parse(fs.readFileSync(VOIX + "durees.json", "utf8"))[L] || {} : {};
const BL = JSON.parse(fs.readFileSync("/home/user/collection-lego-prive/presentation/blisters.json", "utf8"));

const T = {
  fr: {
    titre: "Briquothèque", sous: "Vos figurines custom JB, reconnues en photo",
    accueil: "L'accueil : tout part d'ici",
    recto: "1. Photographier le recto du blister",
    verso: "2. Puis le verso",
    lecture: "3. L'appli lit le nom, compare le décor et le texte du verso",
    reconnu: "Reconnu ! Avec le lien vers la fiche JB Spielwaren",
    numero: "4. Taper le numéro (« 57 of 250 »)",
    ajoute: "Ajouté à la collection ✔",
    collection: "Toute la collection, avec ses propres photos et les numéros",
    fiche: "Chaque figurine : recto, verso, numéros, et un lien direct vers JB Spielwaren",
    communaute: "Communauté : compte, échanges de doubles, amis",
    amis: "Ses amis, et qui est connecté en ce moment",
    langues: "En français, allemand, anglais et espagnol",
    fin1: "Briquothèque", fin2: "Sur Android et dans le navigateur", fin3: "matd-prog.github.io/briquotheque",
  },
  de: {
    titre: "Briquothèque", sous: "Ihre JB-Custom-Figuren, per Foto erkannt",
    accueil: "Der Startbildschirm: Hier beginnt alles",
    recto: "1. Vorderseite des Blisters fotografieren",
    verso: "2. Dann die Rückseite",
    lecture: "3. Die App liest den Namen, vergleicht Motiv und Rückseitentext",
    reconnu: "Erkannt! Mit Link zur Produktseite von JB Spielwaren",
    numero: "4. Nummer eingeben („57 of 250“)",
    ajoute: "Zur Sammlung hinzugefügt ✔",
    collection: "Die ganze Sammlung, mit eigenen Fotos und Nummern",
    fiche: "Jede Figur: Vorder-, Rückseite, Nummern und ein direkter Link zu JB Spielwaren",
    communaute: "Gemeinschaft: Konto, Tausch von Doppelten, Freunde",
    amis: "Freunde, und wer gerade online ist",
    langues: "Auf Deutsch, Französisch, Englisch und Spanisch",
    fin1: "Briquothèque", fin2: "Für Android und im Browser", fin3: "matd-prog.github.io/briquotheque",
  },
}[L];

// compte simulé « Barjo » (rien ne part sur Internet)
const user = { id: "11111111-2222-3333-4444-555555555555", email: "demo@example.com", aud: "authenticated", role: "authenticated", user_metadata: { pseudo: "Barjo" } };
const bob = "99999999-2222-3333-4444-555555555555";
const session = () => ({ access_token: "j", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r", user });
async function supabase(p) {
  await p.route("https://neadnkbroribjobpsqcu.supabase.co/**", async r => {
    const u = new URL(r.request().url()), m = r.request().method(), un = (r.request().headers()["accept"] || "").includes("pgrst.object");
    const json = (o, s = 200, h = {}) => r.fulfill({ status: s, contentType: "application/json", headers: h, body: JSON.stringify(o) });
    const P = u.pathname;
    if (P === "/auth/v1/token") return json(session());
    if (P === "/auth/v1/user") return json(user);
    if (P === "/rest/v1/profils") return json(un ? { pseudo: "Barjo", role: "utilisateur" } : [{ pseudo: "Barjo", role: "utilisateur" }]);
    if (P === "/rest/v1/sauvegardes") return m === "GET" ? json(un ? { maj: new Date().toISOString(), articles: 1742 } : [{ maj: new Date().toISOString(), articles: 1742 }]) : r.fulfill({ status: 201, body: "" });
    if (P === "/rest/v1/rpc/mes_amis") return json([
      { id: 1, ami: bob, pseudo: "BrickMax", statut: "acceptee", sens: "ami", vu_le: new Date().toISOString(), en_ligne: true },
      { id: 2, ami: "a", pseudo: "Julien", statut: "acceptee", sens: "ami", vu_le: new Date(Date.now() - 86400000).toISOString(), en_ligne: false },
      { id: 3, ami: "b", pseudo: "Sophie", statut: "acceptee", sens: "ami", vu_le: new Date().toISOString(), en_ligne: true }]);
    if (P === "/rest/v1/propositions") return m === "HEAD" ? r.fulfill({ status: 200, headers: { "content-range": "*/0" }, body: "" }) : json([], 200, { "content-range": "*/0" });
    if (P.startsWith("/rest/v1/rpc/")) return r.fulfill({ status: 204 });
    return json([]);
  });
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR",
    recordVideo: { dir: O + "/video_tmp", size: { width: 412, height: 915 } } });
  const t0 = Date.now();
  const p = await ctx.newPage();
  await supabase(p);
  await p.route(/^https:\/\/(?!neadnkbro)/, r => /jb-spielwaren|cdn|unpkg|jsdelivr/.test(r.request().url()) ? r.continue() : r.fulfill({ status: 200, contentType: "text/plain", body: "" }));
  await p.addInitScript(l => localStorage.setItem("langue", l), L);
  await p.goto("http://localhost:8765/index.html");
  // connexion au compte simulé, collection et blisters chargés avant de filmer
  await p.waitForFunction(() => typeof ecranActuel !== "undefined" && ecranActuel === "compte", null, { timeout: 15000 });
  await p.fill("#compte-email", user.email); await p.fill("#compte-mdp", "x12345678"); await p.click("#compte-form [type=submit]");
  await p.waitForFunction(() => ecranActuel === "fichier", null, { timeout: 10000 });
  await p.evaluate(() => demarrerBase(false)); await p.waitForTimeout(1200);
  if (await p.evaluate(() => document.getElementById("dialogue").open)) await p.click("#dialogue-oui");
  const bl = BL.map(x => ({ ...x, r: fs.readFileSync(A + x.recto).toString("base64"), v: fs.readFileSync(A + x.verso).toString("base64") }));
  await p.evaluate(async ([base, bl]) => {
    await etat.classeur.remplacerTout(base); await relireContenu();
    const blob = async x => (await fetch("data:image/jpeg;base64," + x)).blob();
    const e = [];
    for (const x of bl) e.push({ id: x.id, nom: x.nom, precision: x.precision, numerote: !!x.numero, numero: x.numero, serie: x.serie, code: x.code, photo: await blob(x.r), verso: await blob(x.v), possede: true, recadre: true, commune: true });
    await Memoire.ecrire(e, "base");
    window.toast = (t, d) => { const z = document.getElementById("toast"); z.textContent = t; z.hidden = false; clearTimeout(window._tt); window._tt = setTimeout(() => z.hidden = true, d || 3500); };
    afficher("accueil"); window.scrollTo(0, 0);
  }, [BASE, bl]);
  // préchargement des outils de lecture (pour ne pas filmer l'attente du premier téléchargement)
  await p.evaluate(async () => { try { await CatalogueJB.charger(); await CatalogueJB.chargerEmpreintes(); await CatalogueJB.chargerVersos(); } catch (e) {} });
  await p.waitForTimeout(1500);

  // calques : sous-titre, doigt, cartes de début et de fin
  await p.addStyleTag({ content: `
    #film-legende{position:fixed;left:12px;right:12px;bottom:22px;z-index:99999;background:rgba(20,18,40,.88);color:#fff;font:600 19px/1.35 system-ui,sans-serif;
      padding:14px 16px;border-radius:16px;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35);transition:opacity .35s}
    #film-legende.cache{opacity:0}
    .film-doigt{position:fixed;z-index:99999;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(217,71,107,.45);
      border:3px solid #fff;pointer-events:none;animation:filmTap .7s ease-out forwards}
    @keyframes filmTap{0%{transform:scale(.4);opacity:1}100%{transform:scale(1.5);opacity:0}}
    #film-carte{position:fixed;inset:0;z-index:100000;background:#1E1B2E;color:#F7F3EF;display:flex;flex-direction:column;justify-content:center;
      align-items:center;gap:18px;text-align:center;padding:30px;font-family:system-ui,sans-serif;transition:opacity .6s}
    #film-carte b{font-size:44px;letter-spacing:.5px} #film-carte span{font-size:22px;color:#E9E2EC;max-width:330px}
    #film-carte i{font-style:normal;font-size:17px;color:#F28AA5} #film-carte .barre{width:70px;height:6px;border-radius:3px;background:#D9476B}` });
  // sons du film (voix, clics), placés au montage ; chaque phrase attend la fin de la précédente
  const ici = () => (Date.now() - t0) / 1000, sons = [];
  let finVoix = 0;
  const parler = async cle => {
    if (!DUREES[cle]) return 0;
    if (finVoix > ici()) await p.waitForTimeout((finVoix - ici()) * 1000);
    sons.push({ voix: cle, t: ici() }); finVoix = ici() + DUREES[cle] + .35;
    return DUREES[cle];
  };
  const legende = async (cle, ms = 2600) => {
    const t = cle ? T[cle] : "";
    if (cle) await parler(cle);
    await p.evaluate(t => { let z = document.getElementById("film-legende"); if (!z) { z = document.createElement("div"); z.id = "film-legende"; z.className = "nom-libre"; document.body.appendChild(z); }
      z.classList.toggle("cache", !t); if (t) z.textContent = t; }, t);
    await p.waitForTimeout(ms);
  };
  const carte = async (lignes, ms, cle) => {
    const du = await parler(cle);
    ms = Math.max(ms, du * 1000 + 700);
    await p.evaluate(l => { const c = document.createElement("div"); c.id = "film-carte"; c.className = "nom-libre";
      c.innerHTML = `<div class="barre"></div><b>${l[0]}</b>${l[1] ? `<span>${l[1]}</span>` : ""}${l[2] ? `<i>${l[2]}</i>` : ""}`; document.body.appendChild(c); }, lignes);
    await p.waitForTimeout(ms);
    await p.evaluate(() => { const c = document.getElementById("film-carte"); c.style.opacity = 0; setTimeout(() => c.remove(), 650); });
    await p.waitForTimeout(700);
  };
  const doigt = async sel => {
    const el = typeof sel === "string" ? p.locator(sel).first() : sel;
    await el.scrollIntoViewIfNeeded(); const r = await el.boundingBox();
    await p.evaluate(([x, y]) => { const d = document.createElement("div"); d.className = "film-doigt"; d.style.left = x + "px"; d.style.top = y + "px";
      document.body.appendChild(d); setTimeout(() => d.remove(), 800); }, [r.x + r.width / 2, r.y + r.height / 2]);
    sons.push({ clic: 1, t: ici() });
    await p.waitForTimeout(650);
    return el;
  };
  const defiler = async (dy, ms) => p.evaluate(([dy, ms]) => new Promise(ok => { const y0 = scrollY, t0 = performance.now();
    const pas = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, y0 + dy * e); k < 1 ? requestAnimationFrame(pas) : ok(); };
    requestAnimationFrame(pas); }), [dy, ms]);
  const versHaut = async sel => p.evaluate(s => { const e = document.querySelector(s); if (e) scrollTo({ top: e.getBoundingClientRect().top + scrollY - 70, behavior: "smooth" }); }, sel);

  // ---- le film ----
  const debut = (Date.now() - t0) / 1000, coupes = [];
  // attente coupée au montage : on garde le début (avant) et la fin (apres), en secondes
  const couper = (a, b, avant = 2, apres = 1.2) => { avant = Math.max(avant, finVoix - a + .2); if (b - a > avant + apres + .5) coupes.push([a + avant, b - apres]); };
  await carte([T.titre, T.sous, "JB Spielwaren · Custom Minifigures"], 3200, "titre");
  await legende("accueil", 2800);

  // blister reconnu
  const x = BL.find(y => /CHROME BLACK TROOPER/.test(y.nom)) || BL[0];
  await doigt(".action-blister");
  await legende("recto", 300);
  let c0 = ici();
  await p.setInputFiles("#input-blister", A + x.recto);
  await p.waitForSelector("#input-base-verso", { state: "attached", timeout: 60000 });
  couper(c0, ici());
  await p.waitForTimeout(1800);
  await legende("verso", 600);
  await p.setInputFiles("#input-base-verso", A + x.verso);
  await legende("lecture", 300);
  c0 = ici();
  await p.waitForFunction(() => !document.getElementById("base-fiche").hidden, null, { timeout: 120000 });
  await p.waitForFunction(() => Base.versoTexte, null, { timeout: 90000 }).catch(() => {});
  couper(c0, ici(), 2.5, .8);
  await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelectorAll("#base-identite .alerte, #base-suggestions").forEach(a => a.style.display = "none"); });
  await versHaut(".recto-verso"); await p.waitForTimeout(900);
  await legende("reconnu", 1200);
  await defiler(380, 1600); await p.waitForTimeout(1600);
  await legende("numero", 400);
  await versHaut("#base-numero"); await p.waitForTimeout(700);
  await doigt("#base-numero");
  await p.click("#base-numero"); await p.fill("#base-numero", ""); await p.type("#base-numero", "57", { delay: 260 });
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.waitForTimeout(1200);
  const ajouter = p.locator('[data-action="base-ajouter"]');
  await doigt(ajouter); await ajouter.click();
  if (await p.evaluate(() => document.getElementById("dialogue").open)) { await p.waitForTimeout(600); await p.click("#dialogue-oui"); }
  await legende("ajoute", 2400);

  // Ma collection, customs en vignettes
  await p.evaluate(() => { Collection.onglet = "Customs"; Collection.vue = "vignettes"; Collection.ouvrir(); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll("#collection-contenu .vignette").forEach(v => { const i = v.querySelector("img.photo"); if (!i || !i.src.startsWith("blob:")) v.remove(); }));
  await versHaut("#collection-bascule"); await p.waitForTimeout(800);
  await legende("collection", 900);
  await defiler(700, 3500); await p.waitForTimeout(600); await defiler(-500, 1800); await p.waitForTimeout(500);
  const vig = p.locator("#collection-contenu .vignette").filter({ has: p.locator(".code", { hasText: /\d/ }) }).first();
  const nom = vig.locator(".nom-court");
  await doigt(nom); await nom.click();
  await p.waitForTimeout(1200);
  await legende("fiche", 4200);
  await p.keyboard.press("Escape"); await p.waitForTimeout(600);

  // communauté : accueil, puis amis
  await p.evaluate(() => { afficher("accueil"); scrollTo(0, 0); }); await p.waitForTimeout(900);
  await versHaut('[data-action="echanges"]'); await p.waitForTimeout(1000);
  await legende("communaute", 2400);
  const amis = p.locator('.tuile[data-action="amis"]');
  await doigt(amis); await amis.click(); await p.waitForTimeout(1500);
  await legende("amis", 3200);

  // langues : écran de connexion avec ses boutons de langue
  await p.evaluate(() => { afficher("accueil"); scrollTo(0, 0); });
  await p.evaluate(() => { const z = document.createElement("div"); z.id = "film-langues"; z.className = "nom-libre";
    z.style.cssText = "position:fixed;left:16px;right:16px;top:42%;z-index:99998;background:#fff;border-radius:18px;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.3);display:flex;flex-wrap:wrap;gap:10px;justify-content:center";
    z.innerHTML = Langue.boutons(); z.querySelectorAll("button").forEach(b => b.removeAttribute("data-langue")); document.body.appendChild(z); });
  await legende("langues", 3200);
  await p.evaluate(() => document.getElementById("film-langues").remove());
  await legende("", 200);
  await carte([T.fin1, T.fin2, T.fin3], 3800, "fin");
  const fin = (Date.now() - t0) / 1000;

  const chemin = await p.video().path();
  await ctx.close(); await b.close();
  fs.renameSync(chemin, `${O}/video_${L}.webm`);
  fs.writeFileSync(`${O}/video_${L}.json`, JSON.stringify({ debut, fin, coupes, sons }));
  console.log(L, "début", debut.toFixed(1), "s, fin", fin.toFixed(1), "s");
})();
