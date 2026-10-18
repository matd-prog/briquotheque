// Sur la fiche d'un set (écran « Ajouter un set », ouvert aussi par le scan d'une boîte en magasin, js/scan_boite.js) :
// 1. prix en ligne (Mathias, 18/10/2026) : prix public LEGO France et meilleur prix du moment chez un marchand français,
//    avec son nom (data/prix_fr.tsv, outils/prix_lego_fr.py, Avenue de la Brique, relevé chaque jour sur GitHub) ;
//    toujours un lien pour comparer tous les prix sur Avenue de la Brique ;
// 2. magasins autour de soi : position du téléphone (avec l'accord de l'utilisateur) -> magasins de jouets et boutiques
//    LEGO à moins de 10 km, d'après OpenStreetMap (API Overpass, libre et gratuite) ; distance et itinéraire.
// Les prix en magasin, eux, ne sont publiés nulle part : ils viendront des utilisateurs (prix vu, partagé), avec les
// comptes.

const PrixEnLigne = {
  prix: null, // Map code -> { prix, meilleur, url, date, marchand }
  _chargement: null,

  charger() {
    if (!this._chargement) {
      this._chargement = fetch("data/prix_fr.tsv").then(r => r.ok ? r.text() : "").catch(() => "").then(t => {
        this.prix = new Map();
        for (const l of t.split("\n")) {
          const [code, prix, meilleur, url, date, marchand] = l.split("\t");
          if (!code || code === "code" || code.startsWith("#")) continue;
          this.prix.set(code.toLowerCase(), { prix: +prix || 0, meilleur: +meilleur || 0, url, date, marchand });
        }
        return this.prix;
      });
    }
    return this._chargement;
  },

  euros(v) { return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }); },

  async afficher(code) {
    const zone = $("set-prix");
    if (!zone) return;
    await this.charger();
    if (!$("set-prix") || !EcranSet.set || EcranSet.set.code !== code) return; // autre set choisi entre-temps
    const p = this.prix.get(code.toLowerCase());
    const numero = code.split("-")[0];
    const lien = p && p.url ? p.url : `https://www.avenuedelabrique.com/recherche/${encodeURIComponent(numero)}`;
    let texte = "";
    if (p && (p.prix || p.meilleur)) {
      const remise = p.prix && p.meilleur && p.meilleur < p.prix ? Math.round((1 - p.meilleur / p.prix) * 100) : 0;
      texte = (p.prix ? `<div class="ligne-valeur"><span>Prix public LEGO France</span><b>${this.euros(p.prix)}</b></div>` : "") +
        (p.meilleur ? `<div class="ligne-valeur"><span>🛒 Meilleur prix en ligne${p.marchand ? ` <span class="score">chez ${echapper(p.marchand)}</span>` : ""}</span>` +
          `<b>${this.euros(p.meilleur)}${remise ? ` <span class="remise">−${remise} %</span>` : ""}</b></div>` : "") +
        `<p class="score">Prix relevés le ${new Date(p.date).toLocaleDateString("fr-FR")} sur Avenue de la Brique (comparateur français).</p>`;
    } else {
      texte = `<p class="score">Pas encore de prix relevé pour ce set (retiré de la vente, ou pas encore lu).</p>`;
    }
    zone.innerHTML = `<div class="prix-en-ligne">${texte}
      <div class="deux-boutons"><a class="bouton gris" href="${echapper(lien)}" target="_blank" rel="noopener">🔎 Comparer les prix</a>
      <button class="bouton gris" data-action="magasins-autour">📍 Magasins autour de moi</button></div></div>`;
  },
};

const Magasins = {
  RAYON: 10000, // mètres

  distance(a, b) { // en mètres
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  },

  position() {
    return new Promise((ok, ko) => {
      if (!navigator.geolocation) return ko(new Error("pas de localisation sur cet appareil"));
      navigator.geolocation.getCurrentPosition(p => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), ko,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 });
    });
  },

  async chercher(ici) {
    const zone = `(around:${this.RAYON},${ici.lat},${ici.lon})`;
    const requete = `[out:json][timeout:25];(nwr["shop"="toys"]${zone};nwr["brand"="LEGO"]${zone};nwr["name"~"LEGO",i]["shop"]${zone};);out center tags;`;
    const rep = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(requete),
      headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    if (!rep.ok) throw new Error(`OpenStreetMap a répondu ${rep.status}`);
    const vus = new Set();
    return ((await rep.json()).elements || []).map(e => {
      const t = e.tags || {}, lat = e.lat ?? (e.center || {}).lat, lon = e.lon ?? (e.center || {}).lon;
      const adresse = [[t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "), t["addr:city"]].filter(Boolean).join(", ");
      return { nom: t.name || t.brand || "Magasin de jouets", marque: t.brand || "", adresse, lat, lon, d: this.distance(ici, { lat, lon }) };
    }).filter(m => m.lat != null && !vus.has(`${m.nom}|${Math.round(m.lat * 1e4)}|${Math.round(m.lon * 1e4)}`) && vus.add(`${m.nom}|${Math.round(m.lat * 1e4)}|${Math.round(m.lon * 1e4)}`))
      .sort((a, b) => a.d - b.d).slice(0, 25);
  },

  montrer(titre, html) {
    $("menu-titre").textContent = titre;
    $("menu-boutons").innerHTML = html;
    $("menu-fermer").onclick = () => $("menu-actions").close();
    if (!$("menu-actions").open) $("menu-actions").showModal();
  },

  async ouvrir() {
    this.montrer("📍 Magasins autour de moi", `<p class="aide">Recherche de votre position…</p>`);
    let ici;
    try { ici = await this.position(); }
    catch (err) {
      this.montrer("📍 Magasins autour de moi", `<p class="aide">Position introuvable : autorisez la localisation pour ce site ` +
        `(icône à gauche de l'adresse, puis « Autorisations »), et activez la localisation du téléphone.</p>`);
      return;
    }
    this.montrer("📍 Magasins autour de moi", `<p class="aide">Recherche des magasins de jouets à moins de ${this.RAYON / 1000} km…</p>`);
    let liste;
    try { liste = await this.chercher(ici); }
    catch (err) {
      console.warn(err);
      this.montrer("📍 Magasins autour de moi", `<p class="aide">La carte OpenStreetMap ne répond pas pour l'instant (${echapper(err.message)}). Réessayez dans un moment.</p>`);
      return;
    }
    const km = d => d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
    this.montrer(`📍 Magasins à moins de ${this.RAYON / 1000} km`, liste.length ? `<div class="base-liste">${liste.map(m => `
        <div class="fiche magasin"><div class="infos"><span class="nom-court">${echapper(m.nom)}</span>
          <span class="score">${echapper([km(m.d), m.adresse].filter(Boolean).join(" · "))}</span></div>
          <a class="petit" href="https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}" target="_blank" rel="noopener">🧭 Y aller</a></div>`).join("")}</div>
        <p class="score">Magasins de jouets et boutiques LEGO d'après OpenStreetMap (carte libre, complétée par ses utilisateurs : un magasin peut manquer).
        Les prix en magasin ne sont publiés nulle part : bientôt, les prix vus par les utilisateurs de l'appli.</p>`
      : `<p class="aide">Aucun magasin de jouets connu d'OpenStreetMap à moins de ${this.RAYON / 1000} km.</p>`);
  },
};

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action]");
  if (b && b.dataset.action === "magasins-autour") Magasins.ouvrir();
});
