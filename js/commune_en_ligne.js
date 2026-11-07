// Base commune ouverte à tous les comptes (Mathias, 07/11/2026) : les blisters envoyés par chaque compte vont dans
// Supabase (table commune_blisters, photos dans l'espace « commune », outils/supabase_base_commune.sql). Chaque matin,
// la tâche « Base commune » du dépôt public les recopie dans data/jb_*.tsv (outils/consolider_base_commune.py) et note
// la date dans data/jb_commune_maj.txt. En attendant, l'appli (et la mini-appli) ajoutent d'elles-mêmes les nouveautés
// à ces listes (commune_export, lisible sans compte : noms et résumés de reconnaissance, pas de photo) : un blister
// envoyé par un utilisateur est reconnu tout de suite sur tous les téléphones.

const CommuneEnLigne = {
  URL: "https://neadnkbroribjobpsqcu.supabase.co",
  CLE: "sb_publishable_5EmR-GxELWvYIyN1NJH0pA_5q8vtetO", // clé publique (comme js/compte.js)
  _recents: null,

  // nouveautés depuis la dernière recopie dans data/ : [{ code, nom, rattache, empreinte, empreinte_fig, vision, verso_texte }]
  recents() {
    if (!this._recents) this._recents = (async () => {
      let depuis = "2000-01-01T00:00:00Z";
      try { const r = await fetch("data/jb_commune_maj.txt", { cache: "no-cache" }); if (r.ok) depuis = (await r.text()).trim() || depuis; } catch (err) { /* première fois */ }
      const rep = await fetch(`${this.URL}/rest/v1/rpc/commune_export`, { method: "POST", enFond: true,
        headers: { apikey: this.CLE, "Content-Type": "application/json" }, body: JSON.stringify({ depuis }) });
      return rep.ok ? await rep.json() : [];
    })().catch(() => []);
    return this._recents;
  },
  oublier() { this._recents = null; }, // après un envoi : relire

  // Photo de la base commune (compte connecté) : celle d'un code BC-…, ou d'un blister envoyé rattaché à cette figurine
  // du catalogue (JB-…, ALB-…). Adresse temporaire (1 h) de l'espace « commune » ; "" si aucune.
  _photos: new Map(),
  photo(code) {
    const k = String(code || "").trim().toUpperCase();
    if (!k || typeof Compte === "undefined" || !Compte.client || !Compte.session) return Promise.resolve("");
    if (!this._photos.has(k)) this._photos.set(k, (async () => {
      const { data } = await Compte.client.from("commune_blisters").select("photo")
        .eq(k.startsWith("BC-") ? "code" : "rattache", String(code).trim()).not("photo", "is", null).limit(1);
      if (!data || !data.length) return "";
      const { data: s } = await Compte.client.storage.from("commune").createSignedUrl(data[0].photo, 3600);
      return (s && s.signedUrl) || "";
    })().catch(() => ""));
    return this._photos.get(k);
  },

  // une liste de data/ complétée par les nouveautés (ligne du même code remplacée : photo refaite)
  async completer(fichier, texte) {
    const lignes = { "data/jb_commune.tsv": r => [r.code, r.nom, "Base commune", "", "", "", "", r.rattache || ""].join("\t"),
      "data/jb_empreintes_commune.tsv": r => r.empreinte && `${r.code}\t${r.empreinte}`,
      "data/jb_empreintes_figurine.tsv": r => r.empreinte_fig && `${r.code}\t${r.empreinte_fig}`,
      "data/jb_vision_commune.tsv": r => r.vision && `${r.code}\t${r.vision}`,
      "data/jb_versos.tsv": r => r.verso_texte && `${r.rattache || r.code}\t${r.verso_texte}` }[fichier];
    if (!lignes) return texte;
    let recents = [];
    try { recents = await this.recents(); } catch (err) { return texte; }
    const ajouts = recents.map(r => [fichier === "data/jb_versos.tsv" ? (r.rattache || r.code) : r.code, lignes(r)]).filter(([, l]) => l);
    if (!ajouts.length) return texte;
    const codes = new Set(ajouts.map(([c]) => c.toUpperCase()));
    const garde = String(texte || "").split("\n").filter(l => l && !codes.has(l.split("\t")[0].toUpperCase()));
    return [...garde, ...ajouts.map(([, l]) => l)].join("\n") + "\n";
  },
};
