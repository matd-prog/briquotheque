// Lecture et modification « chirurgicale » du fichier Excel (.xlsx) directement
// dans le téléphone. On ne réécrit que les parties nécessaires du fichier :
// tout le reste (commentaires, tailles, mise en page...) reste intact.

const NS = {
  main: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  r:    "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  pkg:  "http://schemas.openxmlformats.org/package/2006/relationships",
  xdr:  "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
  a:    "http://schemas.openxmlformats.org/drawingml/2006/main",
  ct:   "http://schemas.openxmlformats.org/package/2006/content-types",
};
const TYPE_REL = {
  drawing: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
  image:   "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
  worksheet: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
};
const ONGLETS_COLORES = ["Gentils (vert)", "Méchants (rouge)", "Zone grise"];
const ONGLET_TABLE = "Table camps";
// Sets LEGO : un tableau (une ligne par set), créé par l'appli au premier set ajouté
const ONGLET_SETS = "Sets";
const COLONNES_SETS = [
  ["A", "Numéro", 11], ["B", "Nom", 38], ["C", "Année", 7], ["D", "Thème", 28], ["E", "Pièces", 8],
  ["F", "État", 14], ["G", "Boîte", 7], ["H", "Notice", 7], ["I", "Figurines", 40], ["J", "Ajouté le", 11],
  ["K", "Quantité", 8], ["L", "Remarques", 36],
];
// Objets dérivés LEGO du catalogue BrickLink « Gear » (porte-clés, porte-clés lumineux, magnets…) : même principe
const ONGLET_OBJETS = "Objets dérivés";
const COLONNES_OBJETS = [
  ["A", "Numéro BrickLink", 16], ["B", "Nom", 40], ["C", "Type", 20], ["D", "État", 12], ["E", "Quantité", 9],
  ["F", "Remarques", 36], ["G", "Ajouté le", 11],
];
// Figurines customs achetées (reçus JB, historique Whatnot) : une ligne par exemplaire, avec son prix payé
const ONGLET_CUSTOMS_ACHETEES = "Customs achetées";
const COLONNES_CUSTOMS_ACHETEES = [
  ["A", "Nom", 44], ["B", "Vendeur", 22], ["C", "Date d'achat", 12], ["D", "Prix payé (€)", 12], ["E", "Justificatif", 30],
  ["F", "Code JB", 14], ["G", "Remarques", 30], ["H", "Ajouté le", 11],
];
// Valeurs déclarées à la main (pièce signée, exemplaire exceptionnel…) : remplacent la valeur estimée de l'article
const ONGLET_VALEURS_DECLAREES = "Valeurs déclarées";
const COLONNES_VALEURS_DECLAREES = [
  ["A", "Article (code ou nom)", 30], ["B", "Nom", 40], ["C", "Valeur déclarée (€)", 14], ["D", "Justification", 50], ["E", "Déclarée le", 11],
  ["F", "Exemplaires concernés", 12],
];
const ONGLETS_AUTORISES = [...ONGLETS_COLORES, ONGLET_TABLE, ONGLET_SETS, ONGLET_OBJETS, ONGLET_CUSTOMS_ACHETEES, ONGLET_VALEURS_DECLAREES];
// Onglets de thèmes (Simpsons, Harry Potter...) : créés par l'appli, même mise en page
const ONGLETS_THEMES = TOUS_THEMES.map(t => t.onglet);
const ONGLET_MODELE = "Gentils (vert)";
const EMU_PAR_PX = 9525;
const HAUTEUR_LIGNE = 42.6;

// ---------- petits utilitaires ----------

function lettreColonne(n) { // 1 -> A
  let s = "";
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function numeroColonne(lettres) { // A -> 1
  let n = 0;
  for (const ch of lettres) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}
function decouperRef(ref) { // "C12" -> {col: 3, row: 12}
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  return { col: numeroColonne(m[1]), row: +m[2] };
}
function enfants(el, nom) {
  return Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.localName === nom);
}
function enfant(el, nom) { return enfants(el, nom)[0] || null; }
function nouvelEl(doc, ns, nom) {
  const prefixe = doc.documentElement.namespaceURI === ns ? doc.documentElement.prefix : doc.lookupPrefix(ns);
  return doc.createElementNS(ns, prefixe ? prefixe + ":" + nom : nom);
}
function cheminAbsolu(partieSource, cible) {
  if (cible.startsWith("/")) return cible.slice(1);
  const base = partieSource.split("/").slice(0, -1);
  for (const morceau of cible.split("/")) {
    if (morceau === "..") base.pop(); else if (morceau !== ".") base.push(morceau);
  }
  return base.join("/");
}
function cheminRels(partie) {
  const p = partie.split("/");
  const fichier = p.pop();
  return [...p, "_rels", fichier + ".rels"].join("/");
}
function largeurEnPx(largeur) { return Math.floor(largeur * 7 + 5); }
function hauteurEnPx(pt) { return Math.floor(pt * 96 / 72); }

// ---------- le classeur ----------

class Classeur {
  static async ouvrir(octets) {
    const c = new Classeur();
    c.zip = await JSZip.loadAsync(octets);
    c.docs = {};
    c.modifies = new Set();
    await c._chargerStructure();
    return c;
  }

  async _doc(chemin) {
    if (!this.docs[chemin]) {
      const f = this.zip.file(chemin);
      if (!f) return null;
      const texte = await f.async("string");
      const doc = new DOMParser().parseFromString(texte, "application/xml");
      if (doc.getElementsByTagName("parsererror").length) throw new Error("Fichier illisible : " + chemin);
      this.docs[chemin] = doc;
    }
    return this.docs[chemin];
  }
  _modifie(chemin) { this.modifies.add(chemin); }

  async _chargerStructure() {
    this.wb = await this._doc("xl/workbook.xml");
    if (!this.wb) throw new Error("Ce fichier n'est pas un classeur Excel (.xlsx).");
    const rels = await this._doc("xl/_rels/workbook.xml.rels");
    const cibles = {};
    for (const r of rels.getElementsByTagNameNS(NS.pkg, "Relationship"))
      cibles[r.getAttribute("Id")] = cheminAbsolu("xl/workbook.xml", r.getAttribute("Target"));
    this.feuilles = Array.from(this.wb.getElementsByTagNameNS(NS.main, "sheet")).map((s, i) => ({
      nom: s.getAttribute("name"), index: i, chemin: cibles[s.getAttributeNS(NS.r, "id")],
    }));
    this.partages = [];
    const sst = await this._doc("xl/sharedStrings.xml");
    if (sst) {
      for (const si of sst.getElementsByTagNameNS(NS.main, "si"))
        this.partages.push(Array.from(si.getElementsByTagNameNS(NS.main, "t")).map(t => t.textContent).join(""));
    }
  }

  aOnglet(nom) { return this.feuilles.some(f => f.nom === nom); }

  feuille(nom) {
    const f = this.feuilles.find(f => f.nom === nom);
    if (!f) throw new Error(`L'onglet « ${nom} » est introuvable dans le fichier.`);
    return f;
  }
  _verifierAutorise(nom) {
    if (!ONGLETS_AUTORISES.includes(nom) && !ONGLETS_THEMES.includes(nom)) throw new Error(`Modification interdite de l'onglet « ${nom} ».`);
  }

  // ----- cellules -----

  async _sheetDoc(nom) { return this._doc(this.feuille(nom).chemin); }

  _sheetData(doc) { return doc.getElementsByTagNameNS(NS.main, "sheetData")[0]; }

  _ligneEl(doc, row, creer, modele) {
    const sd = this._sheetData(doc);
    let avant = null;
    for (const r of enfants(sd, "row")) {
      const n = +r.getAttribute("r");
      if (n === row) return r;
      if (n > row) { avant = r; break; }
    }
    if (!creer) return null;
    const r = nouvelEl(doc, NS.main, "row");
    r.setAttribute("r", row);
    if (modele) for (const at of ["ht", "customHeight", "s", "customFormat"])
      if (modele.hasAttribute(at)) r.setAttribute(at, modele.getAttribute(at));
    sd.insertBefore(r, avant);
    return r;
  }

  _celluleEl(doc, ref, creer) {
    const { col, row } = decouperRef(ref);
    const ligne = this._ligneEl(doc, row, creer);
    if (!ligne) return null;
    let avant = null;
    for (const c of enfants(ligne, "c")) {
      const cr = c.getAttribute("r");
      const n = cr ? decouperRef(cr).col : 0;
      if (cr === ref) return c;
      if (n > col) { avant = c; break; }
    }
    if (!creer) return null;
    const c = nouvelEl(doc, NS.main, "c");
    c.setAttribute("r", ref);
    ligne.insertBefore(c, avant);
    return c;
  }

  _valeurEl(c) {
    if (!c) return "";
    const t = c.getAttribute("t");
    if (t === "inlineStr") {
      const is = enfant(c, "is");
      return is ? Array.from(is.getElementsByTagNameNS(NS.main, "t")).map(x => x.textContent).join("") : "";
    }
    const v = enfant(c, "v");
    if (!v) return "";
    if (t === "s") return this.partages[+v.textContent] ?? "";
    return v.textContent;
  }

  async valeur(nom, ref) {
    const doc = await this._sheetDoc(nom);
    return this._valeurEl(this._celluleEl(doc, ref, false)).trim();
  }

  async ecrireTexte(nom, ref, texte, style) {
    this._verifierAutorise(nom);
    const f = this.feuille(nom), doc = await this._doc(f.chemin);
    const c = this._celluleEl(doc, ref, true);
    while (c.firstChild) c.removeChild(c.firstChild);
    c.setAttribute("t", "inlineStr");
    if (style != null) c.setAttribute("s", style);
    const is = nouvelEl(doc, NS.main, "is"), t = nouvelEl(doc, NS.main, "t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = texte;
    is.appendChild(t); c.appendChild(is);
    this._modifie(f.chemin);
  }

  // Style (numéro) le plus utilisé dans une colonne pour les cellules remplies
  async styleColonne(nom, lettre, filtre) {
    const doc = await this._sheetDoc(nom), compte = {};
    for (const c of doc.getElementsByTagNameNS(NS.main, "c")) {
      const r = c.getAttribute("r");
      if (!r || r.replace(/\d+/g, "") !== lettre || !c.hasAttribute("s")) continue;
      const v = this._valeurEl(c).trim();
      if (filtre ? !filtre(v) : !v) continue;
      compte[c.getAttribute("s")] = (compte[c.getAttribute("s")] || 0) + 1;
    }
    const tri = Object.entries(compte).sort((a, b) => b[1] - a[1]);
    return tri.length ? tri[0][0] : null;
  }

  // Toutes les cellules remplies d'un onglet, ligne par ligne : [{ row, cellules: { A: "…", B: "…" } }] (lecture seule)
  async lignes(nom) {
    const doc = await this._sheetDoc(nom), res = [];
    for (const r of enfants(this._sheetData(doc), "row")) {
      const cellules = {};
      for (const c of enfants(r, "c")) {
        const v = this._valeurEl(c).trim();
        if (v) cellules[(c.getAttribute("r") || "").replace(/\d+/g, "")] = v;
      }
      if (Object.keys(cellules).length) res.push({ row: +r.getAttribute("r"), cellules });
    }
    return res;
  }

  async derniereLigne(nom) {
    const doc = await this._sheetDoc(nom);
    const lignes = enfants(this._sheetData(doc), "row");
    return lignes.length ? +lignes[lignes.length - 1].getAttribute("r") : 0;
  }

  // Dernière ligne de cases d'étiquettes : fin de la zone d'impression A1:E<n>,
  // sinon dernière ligne qui a des cellules dans les colonnes A à E
  async derniereLigneEtiquettes(nom) {
    const f = this.feuille(nom);
    const dn = Array.from(this.wb.getElementsByTagNameNS(NS.main, "definedName"))
      .find(d => d.getAttribute("name") === "_xlnm.Print_Area" && d.getAttribute("localSheetId") === String(f.index));
    const m = dn && /\$?E\$?(\d+)\s*$/.exec(dn.textContent);
    if (m) return +m[1];
    const doc = await this._sheetDoc(nom);
    let derniere = 0;
    for (const r of enfants(this._sheetData(doc), "row"))
      if (enfants(r, "c").some(c => /^[A-E]\d+$/.test(c.getAttribute("r") || ""))) derniere = +r.getAttribute("r");
    return derniere;
  }

  async largeurColonnePx(nom, col) {
    const doc = await this._sheetDoc(nom);
    let largeur = null;
    for (const c of doc.getElementsByTagNameNS(NS.main, "col")) // la dernière définition gagne
      if (+c.getAttribute("min") <= col && col <= +c.getAttribute("max")) largeur = +c.getAttribute("width");
    if (largeur == null) {
      const fmt = doc.getElementsByTagNameNS(NS.main, "sheetFormatPr")[0];
      largeur = fmt && fmt.getAttribute("defaultColWidth") ? +fmt.getAttribute("defaultColWidth") : 8.43;
    }
    return largeurEnPx(largeur);
  }

  async hauteurLignePx(nom, row) {
    const doc = await this._sheetDoc(nom);
    const l = this._ligneEl(doc, row, false);
    return hauteurEnPx(l && l.getAttribute("ht") ? +l.getAttribute("ht") : HAUTEUR_LIGNE);
  }

  async _majDimension(nom, derniere, derniereCol) {
    const doc = await this._sheetDoc(nom);
    const dim = doc.getElementsByTagNameNS(NS.main, "dimension")[0];
    if (dim) dim.setAttribute("ref", `A1:${derniereCol}${derniere}`);
  }

  // ----- dessins (images) -----

  async _relsDoc(partie, creer) {
    const chemin = cheminRels(partie);
    let doc = await this._doc(chemin);
    if (!doc && creer) {
      doc = new DOMParser().parseFromString(`<Relationships xmlns="${NS.pkg}"/>`, "application/xml");
      this.docs[chemin] = doc;
      this._modifie(chemin);
    }
    return doc;
  }

  _nouvelId(relsDoc) {
    const ids = new Set(Array.from(relsDoc.getElementsByTagNameNS(NS.pkg, "Relationship")).map(r => r.getAttribute("Id")));
    let i = ids.size + 1;
    while (ids.has("rId" + i)) i++;
    return "rId" + i;
  }

  _ajouterContentType(partie, type, extension) {
    return this._doc("[Content_Types].xml").then(ct => {
      const racine = ct.documentElement;
      if (extension) {
        const existe = Array.from(racine.getElementsByTagNameNS(NS.ct, "Default"))
          .some(d => d.getAttribute("Extension").toLowerCase() === extension);
        if (existe) return;
        const d = nouvelEl(ct, NS.ct, "Default");
        d.setAttribute("Extension", extension); d.setAttribute("ContentType", type);
        racine.insertBefore(d, racine.firstChild);
      } else {
        const o = nouvelEl(ct, NS.ct, "Override");
        o.setAttribute("PartName", "/" + partie); o.setAttribute("ContentType", type);
        racine.appendChild(o);
      }
      this._modifie("[Content_Types].xml");
    });
  }

  async _dessin(nom, creer) {
    const f = this.feuille(nom), sheet = await this._doc(f.chemin);
    const rels = await this._relsDoc(f.chemin, creer);
    const el = sheet.getElementsByTagNameNS(NS.main, "drawing")[0];
    if (el && rels) {
      const id = el.getAttributeNS(NS.r, "id");
      const rel = Array.from(rels.getElementsByTagNameNS(NS.pkg, "Relationship")).find(r => r.getAttribute("Id") === id);
      if (rel) {
        const chemin = cheminAbsolu(f.chemin, rel.getAttribute("Target"));
        return { chemin, doc: await this._doc(chemin) };
      }
    }
    if (!creer) return null;
    // Pas encore de dessin dans cet onglet : on en crée un
    let n = 1;
    while (this.zip.file(`xl/drawings/drawing${n}.xml`) || this.docs[`xl/drawings/drawing${n}.xml`]) n++;
    const chemin = `xl/drawings/drawing${n}.xml`;
    const doc = new DOMParser().parseFromString(`<xdr:wsDr xmlns:xdr="${NS.xdr}" xmlns:a="${NS.a}"/>`, "application/xml");
    this.docs[chemin] = doc; this._modifie(chemin);
    const id = this._nouvelId(rels);
    const rel = nouvelEl(rels, NS.pkg, "Relationship");
    rel.setAttribute("Id", id); rel.setAttribute("Type", TYPE_REL.drawing); rel.setAttribute("Target", "/" + chemin);
    rels.documentElement.appendChild(rel); this._modifie(cheminRels(f.chemin));
    const d = nouvelEl(sheet, NS.main, "drawing");
    d.setAttributeNS(NS.r, "r:id", id);
    const apres = ["legacyDrawing", "legacyDrawingHF", "drawingHF", "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"];
    const suivant = Array.from(sheet.documentElement.childNodes).find(x => x.nodeType === 1 && apres.includes(x.localName));
    sheet.documentElement.insertBefore(d, suivant || null);
    this._modifie(f.chemin);
    await this._ajouterContentType(chemin, "application/vnd.openxmlformats-officedocument.drawing+xml");
    return { chemin, doc };
  }

  _ancres(dessinDoc) {
    return Array.from(dessinDoc.documentElement.childNodes).filter(n =>
      n.nodeType === 1 && /^(oneCellAnchor|twoCellAnchor|absoluteAnchor)$/.test(n.localName) &&
      n.getElementsByTagNameNS(NS.xdr, "pic").length).map(a => {
        const from = enfant(a, "from");
        return {
          el: a,
          col: from ? +enfant(from, "col").textContent : -1,
          row: from ? +enfant(from, "row").textContent : -1,
          embed: (a.getElementsByTagNameNS(NS.a, "blip")[0] || { getAttributeNS: () => null }).getAttributeNS(NS.r, "embed"),
        };
      });
  }

  // Images des étiquettes (colonnes A à E) : "ligne:colonne" -> image PNG (Blob), pour la consultation
  async imagesEtiquettes(nom) {
    const res = new Map();
    const d = await this._dessin(nom, false);
    if (!d) return res;
    const rels = await this._relsDoc(d.chemin, false);
    if (!rels) return res;
    const cibles = {};
    for (const r of rels.getElementsByTagNameNS(NS.pkg, "Relationship"))
      cibles[r.getAttribute("Id")] = cheminAbsolu(d.chemin, r.getAttribute("Target"));
    for (const a of this._ancres(d.doc)) {
      if (a.col < 0 || a.col > 4 || !cibles[a.embed]) continue;
      const f = this.zip.file(cibles[a.embed]);
      if (f) res.set(`${a.row + 1}:${a.col + 1}`, new Blob([await f.async("uint8array")], { type: "image/png" }));
    }
    return res;
  }

  // Positions (ligne, colonne 1..5) qui contiennent une image dans les colonnes A à E
  async positionsImages(nom) {
    const d = await this._dessin(nom, false);
    const set = new Set();
    if (d) for (const a of this._ancres(d.doc)) if (a.col >= 0 && a.col <= 4) set.add(`${a.row + 1}:${a.col + 1}`);
    return set;
  }

  async ajouterImage(nom, row, col, png, wpx, hpx, marge) {
    this._verifierAutorise(nom);
    const { chemin, doc } = await this._dessin(nom, true);
    const rels = await this._relsDoc(chemin, true);
    let n = 1;
    const medias = Object.keys(this.zip.files).filter(p => p.startsWith("xl/media/"));
    for (const p of medias) { const m = /image(\d+)\./.exec(p); if (m) n = Math.max(n, +m[1] + 1); }
    const media = `xl/media/image${n}.png`;
    this.zip.file(media, png);
    await this._ajouterContentType(null, "image/png", "png");

    const id = this._nouvelId(rels);
    const rel = nouvelEl(rels, NS.pkg, "Relationship");
    rel.setAttribute("Id", id); rel.setAttribute("Type", TYPE_REL.image); rel.setAttribute("Target", "/" + media);
    rels.documentElement.appendChild(rel);
    this._modifie(cheminRels(chemin));

    let idMax = 0;
    for (const c of doc.getElementsByTagNameNS(NS.xdr, "cNvPr")) idMax = Math.max(idMax, +c.getAttribute("id") || 0);
    const x = (nomEl, ns = NS.xdr) => nouvelEl(doc, ns, nomEl);
    const avec = (parent, ...fils) => { fils.forEach(f => parent.appendChild(f)); return parent; };
    const texte = (el, t) => { el.textContent = t; return el; };

    const ancre = x("oneCellAnchor");
    avec(ancre,
      avec(x("from"), texte(x("col"), col - 1), texte(x("colOff"), marge * EMU_PAR_PX),
                      texte(x("row"), row - 1), texte(x("rowOff"), marge * EMU_PAR_PX)),
      (() => { const e = x("ext"); e.setAttribute("cx", wpx * EMU_PAR_PX); e.setAttribute("cy", hpx * EMU_PAR_PX); return e; })(),
      avec(x("pic"),
        avec(x("nvPicPr"),
          (() => { const e = x("cNvPr"); e.setAttribute("id", idMax + 1); e.setAttribute("name", "Etiquette " + (idMax + 1)); return e; })(),
          x("cNvPicPr")),
        avec(x("blipFill"),
          (() => { const b = doc.createElementNS(NS.a, "a:blip"); b.setAttributeNS(NS.r, "r:embed", id); b.setAttribute("cstate", "print"); return b; })(),
          avec(doc.createElementNS(NS.a, "a:stretch"), doc.createElementNS(NS.a, "a:fillRect"))),
        avec(x("spPr"),
          (() => { const g = doc.createElementNS(NS.a, "a:prstGeom"); g.setAttribute("prst", "rect"); return g; })())),
      x("clientData"));
    doc.documentElement.appendChild(ancre);
    this._modifie(chemin);
  }

  // Supprime les images posées dans les colonnes A à E (ou seulement la case indiquée)
  async supprimerImages(nom, seulement) {
    this._verifierAutorise(nom);
    const d = await this._dessin(nom, false);
    if (!d) return 0;
    const rels = await this._relsDoc(d.chemin, false);
    let n = 0;
    for (const a of this._ancres(d.doc)) {
      if (a.col < 0 || a.col > 4) continue;
      if (seulement && (a.row + 1 !== seulement.row || a.col + 1 !== seulement.col)) continue;
      a.el.parentNode.removeChild(a.el); n++;
      if (rels && a.embed) {
        const rel = Array.from(rels.getElementsByTagNameNS(NS.pkg, "Relationship")).find(r => r.getAttribute("Id") === a.embed);
        if (rel) {
          const media = cheminAbsolu(d.chemin, rel.getAttribute("Target"));
          rel.parentNode.removeChild(rel);
          if (!(await this._mediaUtilise(media))) this.zip.remove(media);
        }
      }
    }
    this._modifie(d.chemin); if (rels) this._modifie(cheminRels(d.chemin));
    return n;
  }

  async _mediaUtilise(media) {
    for (const p of new Set([...Object.keys(this.zip.files), ...Object.keys(this.docs)])) {
      if (!p.endsWith(".rels")) continue;
      const doc = await this._doc(p);
      if (!doc) continue;
      const source = p.replace(/_rels\/([^/]+)\.rels$/, "$1");
      for (const r of doc.getElementsByTagNameNS(NS.pkg, "Relationship"))
        if (r.getAttribute("TargetMode") !== "External" && cheminAbsolu(source, r.getAttribute("Target")) === media) return true;
    }
    return false;
  }

  // ----- zone d'impression et filtres -----

  async _nomDefini(nom, localId, valeur) {
    let dn = this.wb.getElementsByTagNameNS(NS.main, "definedNames")[0];
    if (!dn) {
      dn = nouvelEl(this.wb, NS.main, "definedNames");
      const sheets = this.wb.getElementsByTagNameNS(NS.main, "sheets")[0];
      sheets.parentNode.insertBefore(dn, sheets.nextSibling);
    }
    let el = enfants(dn, "definedName").find(d => d.getAttribute("name") === nom && d.getAttribute("localSheetId") === String(localId));
    if (!el) { el = nouvelEl(this.wb, NS.main, "definedName"); el.setAttribute("name", nom); el.setAttribute("localSheetId", localId); dn.appendChild(el); }
    el.textContent = valeur;
    this._modifie("xl/workbook.xml");
  }

  async majZoneImpression(nom, derniere) {
    const f = this.feuille(nom);
    await this._nomDefini("_xlnm.Print_Area", f.index, `'${nom.replace(/'/g, "''")}'!$A$1:$E$${derniere}`);
  }

  // ----- création d'un onglet de thème -----

  // Ajoute un style de cellule identique à « base » mais avec un fond plein de la couleur donnée
  async _styleAvecFond(base, couleur) {
    const st = await this._doc("xl/styles.xml");
    const fills = st.getElementsByTagNameNS(NS.main, "fills")[0];
    const fill = nouvelEl(st, NS.main, "fill"), pf = nouvelEl(st, NS.main, "patternFill");
    const fg = nouvelEl(st, NS.main, "fgColor"), bg = nouvelEl(st, NS.main, "bgColor");
    pf.setAttribute("patternType", "solid");
    fg.setAttribute("rgb", "FF" + couleur.replace("#", "").toUpperCase());
    bg.setAttribute("indexed", "64");
    pf.appendChild(fg); pf.appendChild(bg); fill.appendChild(pf); fills.appendChild(fill);
    const fillId = enfants(fills, "fill").length - 1;
    fills.setAttribute("count", fillId + 1);

    const xfs = st.getElementsByTagNameNS(NS.main, "cellXfs")[0];
    const liste = enfants(xfs, "xf");
    const xf = base != null && liste[+base] ? liste[+base].cloneNode(true) : nouvelEl(st, NS.main, "xf");
    for (const [a, v] of [["numFmtId", "0"], ["fontId", "0"], ["borderId", "0"], ["xfId", "0"]])
      if (!xf.hasAttribute(a)) xf.setAttribute(a, v);
    xf.setAttribute("fillId", fillId);
    xf.setAttribute("applyFill", "1");
    xfs.appendChild(xf);
    xfs.setAttribute("count", liste.length + 1);
    this._modifie("xl/styles.xml");
    return String(liste.length);
  }

  // Crée l'onglet « nom » en recopiant la mise en page de l'onglet modèle
  // (largeurs de colonnes, hauteur de ligne, marges, impression), sans son contenu.
  // Il est ajouté après tous les autres onglets, pour ne décaler aucun onglet existant.
  async creerOnglet(nom, modeleNom, couleur) {
    if (!ONGLETS_THEMES.includes(nom)) throw new Error(`Création interdite de l'onglet « ${nom} ».`);
    if (this.aOnglet(nom)) return;
    // Excel ignore les majuscules dans les noms d'onglets : « City » et « CITY » seraient en conflit
    const conflit = this.feuilles.find(f => f.nom.toLowerCase() === nom.toLowerCase());
    if (conflit) throw new Error(`un onglet « ${conflit.nom} » existe déjà : impossible de créer « ${nom} »`);
    const src = await this._doc(this.feuille(modeleNom).chemin);
    const doc = new DOMParser().parseFromString(new XMLSerializer().serializeToString(src), "application/xml");
    const racine = doc.documentElement;

    const aRetirer = ["drawing", "legacyDrawing", "legacyDrawingHF", "drawingHF", "rowBreaks", "colBreaks", "mergeCells",
      "conditionalFormatting", "dataValidations", "hyperlinks", "autoFilter", "sortState", "tableParts", "picture",
      "oleObjects", "controls", "webPublishItems", "extLst", "sheetProtection", "protectedRanges", "scenarios"];
    for (const el of Array.from(racine.childNodes))
      if (el.nodeType === 1 && aRetirer.includes(el.localName)) racine.removeChild(el);
    for (const at of Array.from(racine.attributes)) if (at.localName === "uid") racine.removeAttributeNode(at);
    const sheetPr = enfant(racine, "sheetPr");
    if (sheetPr) sheetPr.removeAttribute("codeName");
    for (const v of doc.getElementsByTagNameNS(NS.main, "sheetView")) v.removeAttribute("tabSelected");

    // une première ligne de 5 cases colorées, même hauteur et même style que le modèle
    const sd = this._sheetData(doc);
    const ligneModele = enfants(sd, "row").find(r => enfants(r, "c").some(c => /^A\d+$/.test(c.getAttribute("r") || "")));
    const celA = ligneModele && enfants(ligneModele, "c").find(c => /^A\d+$/.test(c.getAttribute("r") || ""));
    const style = await this._styleAvecFond(celA && celA.hasAttribute("s") ? celA.getAttribute("s") : null, couleur);
    while (sd.firstChild) sd.removeChild(sd.firstChild);
    const ligne = nouvelEl(doc, NS.main, "row");
    ligne.setAttribute("r", "1");
    ligne.setAttribute("ht", ligneModele && ligneModele.getAttribute("ht") || HAUTEUR_LIGNE);
    ligne.setAttribute("customHeight", "1");
    for (let i = 1; i <= 5; i++) {
      const c = nouvelEl(doc, NS.main, "c");
      c.setAttribute("r", lettreColonne(i) + "1");
      c.setAttribute("s", style);
      ligne.appendChild(c);
    }
    sd.appendChild(ligne);
    const dim = enfant(racine, "dimension");
    if (dim) dim.setAttribute("ref", "A1:Q1");
    await this._inscrireFeuille(nom, doc);
    await this.majZoneImpression(nom, 1);
  }

  // Onglet « Sets » : tableau neuf (ligne de titres figée, largeurs de colonnes), sans modèle
  async creerOngletSets(nomOnglet = ONGLET_SETS, colonnes = COLONNES_SETS) {
    if (this.aOnglet(nomOnglet)) return;
    const conflit = this.feuilles.find(f => f.nom.toLowerCase() === nomOnglet.toLowerCase());
    if (conflit) throw new Error(`un onglet « ${conflit.nom} » existe déjà : impossible de créer « ${nomOnglet} »`);
    const echap = t => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS.main}" xmlns:r="${NS.r}"><dimension ref="A1:${colonnes[colonnes.length - 1][0]}1"/>` +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/><cols>` +
      colonnes.map(([, , l], i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`).join("") +
      `</cols><sheetData><row r="1">` +
      colonnes.map(([c, titre]) => `<c r="${c}1" t="inlineStr"><is><t>${echap(titre)}</t></is></c>`).join("") +
      `</row></sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
    await this._inscrireFeuille(nomOnglet, new DOMParser().parseFromString(xml, "application/xml"));
  }

  // Ajoute une feuille (document XML) au classeur : fichier, type, lien et nom d'onglet
  async _inscrireFeuille(nom, doc) {
    let n = 1;
    while (this.zip.file(`xl/worksheets/sheet${n}.xml`) || this.docs[`xl/worksheets/sheet${n}.xml`]) n++;
    const chemin = `xl/worksheets/sheet${n}.xml`;
    this.docs[chemin] = doc;
    this._modifie(chemin);
    await this._ajouterContentType(chemin, "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml");

    const rels = await this._doc("xl/_rels/workbook.xml.rels");
    const id = this._nouvelId(rels);
    const rel = nouvelEl(rels, NS.pkg, "Relationship");
    rel.setAttribute("Id", id); rel.setAttribute("Type", TYPE_REL.worksheet); rel.setAttribute("Target", "/" + chemin);
    rels.documentElement.appendChild(rel);
    this._modifie("xl/_rels/workbook.xml.rels");

    const sheets = this.wb.getElementsByTagNameNS(NS.main, "sheets")[0];
    const ids = Array.from(sheets.getElementsByTagNameNS(NS.main, "sheet")).map(x => +x.getAttribute("sheetId") || 0);
    const sheet = nouvelEl(this.wb, NS.main, "sheet");
    sheet.setAttribute("name", nom);
    sheet.setAttribute("sheetId", Math.max(0, ...ids) + 1);
    sheet.setAttributeNS(NS.r, "r:id", id);
    sheets.appendChild(sheet);
    this._modifie("xl/workbook.xml");
    this.feuilles.push({ nom, index: this.feuilles.length, chemin });
  }

  // ----- enregistrement -----

  async enregistrer() {
    const serialiseur = new XMLSerializer();
    for (const chemin of this.modifies) {
      let xml = serialiseur.serializeToString(this.docs[chemin]);
      if (!xml.startsWith("<?xml")) xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xml;
      this.zip.file(chemin, xml);
    }
    this.modifies.clear();
    return this.zip.generateAsync({ type: "uint8array", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
}

// ---------- logique « figurines » au-dessus du classeur ----------

// Onglets d'étiquettes présents dans le fichier : les 3 Star Wars + les thèmes déjà créés
function ongletsEtiquettes(cl) {
  return [...ONGLETS_COLORES, ...ONGLETS_THEMES.filter(o => cl.aOnglet(o))];
}

// Lit les onglets d'étiquettes : pour chaque case, le code, le nom et la présence d'une image
async function lireCollection(cl) {
  const res = {};
  for (const nom of ongletsEtiquettes(cl)) {
    const derniere = await cl.derniereLigneEtiquettes(nom);
    const images = await cl.positionsImages(nom);
    const cases = [];
    for (let row = 1; row <= derniere; row++) {
      for (let i = 1; i <= 5; i++) {
        const code = await cl.valeur(nom, lettreColonne(12 + i) + row);
        const nomFig = await cl.valeur(nom, lettreColonne(6 + i) + row);
        const lien = await cl.valeur(nom, lettreColonne(18 + i) + row); // colonnes S à W (customs)
        cases.push({ row, col: i, ref: lettreColonne(i) + row, code, nom: nomFig, lien, image: images.has(`${row}:${i}`) });
      }
    }
    res[nom] = { derniere, cases };
  }
  return res;
}

async function lireTableCamps(cl) {
  const derniere = await cl.derniereLigne(ONGLET_TABLE);
  const lignes = [];
  for (let row = 2; row <= derniere; row++) {
    const v = async l => cl.valeur(ONGLET_TABLE, l + row);
    const code = await v("A");
    if (!code) continue;
    lignes.push({ row, code, personnage: await v("B"), camp: await v("C"), statut: await v("D"), origine: await v("E") });
  }
  return lignes;
}

async function dimensionsCase(cl, onglet, row, col, marge = 3) {
  return {
    w: (await cl.largeurColonnePx(onglet, col)) - 2 * marge,
    h: (await cl.hauteurLignePx(onglet, row)) - 2 * marge,
  };
}

// Adresse du QR code : page BrickLink (undefined), ou pour une custom son lien (null = pas de QR code)
function lienEtiquette(onglet, lien) {
  return onglet === THEME_CUSTOMS.onglet ? (lien || null) : undefined;
}

async function poserEtiquette(cl, onglet, row, col, code, lien) {
  const couleur = couleurOnglet(onglet);
  const { w, h } = await dimensionsCase(cl, onglet, row, col);
  const png = await canvasEnPng(dessinerEtiquette(code, couleur, w, h, lienEtiquette(onglet, lien)));
  await cl.supprimerImages(onglet, { row, col });
  await cl.ajouterImage(onglet, row, col, png, w, h, 3);
}

// Première case libre (ligne par ligne, de A à E) ; ajoute une ligne si l'onglet est plein
// Sets de l'onglet « Sets » : [{ row, code, nom, etat, boite, notice, figurines }]
async function lireSets(cl) {
  if (!cl.aOnglet(ONGLET_SETS)) return [];
  const res = [], derniere = await cl.derniereLigne(ONGLET_SETS);
  for (let row = 2; row <= derniere; row++) {
    const v = async l => cl.valeur(ONGLET_SETS, l + row);
    const code = await v("A");
    if (code) res.push({ row, code, nom: await v("B"), annee: await v("C"), theme: await v("D"), etat: await v("F"),
                         boite: await v("G"), notice: await v("H"), figurines: await v("I"),
                         quantite: +(await v("K")) || 1, remarques: await v("L") });
  }
  return res;
}

// Ajoute un set à l'onglet « Sets » (créé s'il n'existe pas) : une ligne à la fin du tableau
// boite, notice : true / false, ou null si on ne sait pas
async function ajouterSet(cl, { code, nom, annee, theme, pieces, etat, boite, notice, figurines, quantite, remarques }) {
  await cl.creerOngletSets();
  for (const [c, titre] of COLONNES_SETS) // onglet créé avant l'ajout de nouvelles colonnes : titres manquants
    if (!(await cl.valeur(ONGLET_SETS, c + "1"))) await cl.ecrireTexte(ONGLET_SETS, c + "1", titre);
  const row = (await cl.derniereLigne(ONGLET_SETS)) + 1;
  const ouiNon = x => x == null ? "" : x ? "oui" : "non";
  const valeurs = [code, nom, annee, theme, pieces, etat, ouiNon(boite), ouiNon(notice),
                   figurines || "", new Date().toLocaleDateString("fr-FR"), quantite > 1 ? quantite : "", remarques || ""];
  for (let i = 0; i < valeurs.length; i++)
    if (valeurs[i] !== "" && valeurs[i] != null) await cl.ecrireTexte(ONGLET_SETS, COLONNES_SETS[i][0] + row, String(valeurs[i]));
  return row;
}

// Objets dérivés : [{ row, code, nom, type, etat, quantite, remarques }]
async function lireObjets(cl) {
  if (!cl.aOnglet(ONGLET_OBJETS)) return [];
  const res = [], derniere = await cl.derniereLigne(ONGLET_OBJETS);
  for (let row = 2; row <= derniere; row++) {
    const v = async l => cl.valeur(ONGLET_OBJETS, l + row);
    const code = await v("A");
    if (code) res.push({ row, code, nom: await v("B"), type: await v("C"), etat: await v("D"),
                         quantite: +(await v("E")) || 1, remarques: await v("F") });
  }
  return res;
}

// Customs achetées : [{ row, nom, vendeur, date, prix, justificatif, code, remarques }]
async function lireCustomsAchetees(cl) {
  if (!cl.aOnglet(ONGLET_CUSTOMS_ACHETEES)) return [];
  const res = [];
  for (const { row, cellules: c } of await cl.lignes(ONGLET_CUSTOMS_ACHETEES))
    if (row > 1 && (c.A || c.F)) res.push({ row, nom: c.A || "", vendeur: c.B || "", date: c.C || "", prix: parseFloat((c.D || "").replace(",", ".")) || 0,
                                            justificatif: c.E || "", code: c.F || "", remarques: c.G || "" });
  return res;
}

// Ajoute des lignes à la fin de l'onglet « Customs achetées » (créé s'il n'existe pas)
async function ajouterCustomsAchetees(cl, lignes, progression) {
  await cl.creerOngletSets(ONGLET_CUSTOMS_ACHETEES, COLONNES_CUSTOMS_ACHETEES);
  let row = await cl.derniereLigne(ONGLET_CUSTOMS_ACHETEES);
  const jour = new Date().toLocaleDateString("fr-FR");
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i]; row++;
    const valeurs = [l.nom, l.vendeur, l.date, l.prix.toFixed(2).replace(".", ","), l.justificatif, l.code || "", l.remarques || "", jour];
    for (let j = 0; j < valeurs.length; j++)
      if (valeurs[j]) await cl.ecrireTexte(ONGLET_CUSTOMS_ACHETEES, COLONNES_CUSTOMS_ACHETEES[j][0] + row, String(valeurs[j]));
    if (progression && i % 25 === 0) progression(i + 1, lignes.length);
  }
}

// Valeurs déclarées : [{ row, cle, nom, valeur, justification, date }]
async function lireValeursDeclarees(cl) {
  if (!cl.aOnglet(ONGLET_VALEURS_DECLAREES)) return [];
  const res = [];
  for (const { row, cellules: c } of await cl.lignes(ONGLET_VALEURS_DECLAREES)) {
    const valeur = parseFloat(String(c.C || "").replace(/\s/g, "").replace(",", "."));
    if (row > 1 && c.A && valeur > 0) res.push({ row, cle: c.A, nom: c.B || "", valeur, justification: c.D || "", date: c.E || "",
                                                exemplaires: parseInt(c.F, 10) || 1 });
  }
  return res;
}

// Déclare (ou remplace) la valeur d'un article ; valeur vide ou 0 : retire la déclaration
async function declarerValeur(cl, { cle, nom, valeur, justification, exemplaires }) {
  await cl.creerOngletSets(ONGLET_VALEURS_DECLAREES, COLONNES_VALEURS_DECLAREES);
  if (!(await cl.valeur(ONGLET_VALEURS_DECLAREES, "F1"))) await cl.ecrireTexte(ONGLET_VALEURS_DECLAREES, "F1", COLONNES_VALEURS_DECLAREES[5][1]);
  const existante = (await lireValeursDeclarees(cl)).find(v => v.cle.toLowerCase() === cle.toLowerCase());
  const row = existante ? existante.row : (await cl.derniereLigne(ONGLET_VALEURS_DECLAREES)) + 1;
  const valeurs = valeur > 0 ? [cle, nom || "", valeur.toFixed(2).replace(".", ","), justification || "", new Date().toLocaleDateString("fr-FR"),
                                String(Math.max(1, exemplaires || 1))] : ["", "", "", "", "", ""];
  for (let i = 0; i < valeurs.length; i++) await cl.ecrireTexte(ONGLET_VALEURS_DECLAREES, COLONNES_VALEURS_DECLAREES[i][0] + row, String(valeurs[i]));
}

async function ajouterObjet(cl, { code, nom, type, etat, quantite, remarques }) {
  await cl.creerOngletSets(ONGLET_OBJETS, COLONNES_OBJETS);
  const row = (await cl.derniereLigne(ONGLET_OBJETS)) + 1;
  const valeurs = [code, nom, type, etat, quantite > 1 ? quantite : "", remarques, new Date().toLocaleDateString("fr-FR")];
  for (let i = 0; i < valeurs.length; i++)
    if (valeurs[i] !== "" && valeurs[i] != null) await cl.ecrireTexte(ONGLET_OBJETS, COLONNES_OBJETS[i][0] + row, String(valeurs[i]));
  return row;
}

async function premiereCaseLibre(cl, onglet) {
  const coll = (await lireCollection(cl))[onglet];
  const libre = coll.cases.find(c => !c.code && !c.image);
  if (libre) return { row: libre.row, col: libre.col, nouvelleLigne: false };
  const doc = await cl._sheetDoc(onglet);
  const derniere = coll.derniere, row = derniere + 1;
  const modele = cl._ligneEl(doc, derniere, false);
  const ligne = cl._ligneEl(doc, row, true, modele);
  // même hauteur que les autres lignes (la ligne peut déjà exister, vide, sans hauteur)
  ligne.setAttribute("ht", modele && modele.getAttribute("ht") || HAUTEUR_LIGNE);
  ligne.setAttribute("customHeight", "1");
  for (let i = 1; i <= 5; i++) { // cases colorées : même style que la dernière ligne
    const src = cl._celluleEl(doc, lettreColonne(i) + derniere, false);
    const c = cl._celluleEl(doc, lettreColonne(i) + row, true);
    if (src && src.hasAttribute("s")) c.setAttribute("s", src.getAttribute("s"));
  }
  cl._modifie(cl.feuille(onglet).chemin);
  await cl._majDimension(onglet, Math.max(row, await cl.derniereLigne(onglet)), "Q");
  await cl.majZoneImpression(onglet, row);
  return { row, col: 1, nouvelleLigne: true };
}

// camp : Gentil / Méchant / Zone grise pour Star Wars ; theme : onglet de thème pour les autres
async function ajouterFigurine(cl, { code, nom, camp, theme, lien }) {
  const onglet = camp ? CAMPS[camp].onglet : theme;
  if (!cl.aOnglet(onglet)) await cl.creerOnglet(onglet, ONGLET_MODELE, couleurOnglet(onglet));
  const pos = await premiereCaseLibre(cl, onglet);
  // un onglet tout neuf n'a pas encore de nom ni de code : on prend le style de l'onglet modèle
  const styleNom = (await cl.styleColonne(onglet, "G")) ?? (await cl.styleColonne(ONGLET_MODELE, "G"));
  const styleCode = (await cl.styleColonne(onglet, "M")) ?? (await cl.styleColonne(ONGLET_MODELE, "M"));
  await cl.ecrireTexte(onglet, lettreColonne(6 + pos.col) + pos.row, nom, styleNom);
  await cl.ecrireTexte(onglet, lettreColonne(12 + pos.col) + pos.row, code, styleCode);
  if (lien) await cl.ecrireTexte(onglet, lettreColonne(18 + pos.col) + pos.row, lien); // colonnes S à W
  await poserEtiquette(cl, onglet, pos.row, pos.col, code, lien);

  // Table camps
  const row = (await cl.derniereLigne(ONGLET_TABLE)) + 1;
  const styleCamp = camp ? await cl.styleColonne(ONGLET_TABLE, "C", v => v === camp) : null;
  const ref = lettreColonne(pos.col) + pos.row;
  const valeurs = { A: code, B: nom, C: camp || onglet, D: "Confirmé", E: `${onglet}!${ref} (appli ${new Date().toLocaleDateString("fr-FR")})` };
  for (const [l, v] of Object.entries(valeurs)) await cl.ecrireTexte(ONGLET_TABLE, l + row, v, l === "C" ? styleCamp : null);
  await majFiltreTable(cl, row);
  return { onglet, ref, row: pos.row, col: pos.col, nouvelleLigne: pos.nouvelleLigne };
}

async function majFiltreTable(cl, derniere) {
  const f = cl.feuille(ONGLET_TABLE), doc = await cl._doc(f.chemin);
  const af = doc.getElementsByTagNameNS(NS.main, "autoFilter")[0];
  if (af) {
    af.setAttribute("ref", `A1:E${derniere}`);
    await cl._nomDefini("_xlnm._FilterDatabase", f.index, `'${ONGLET_TABLE}'!$A$1:$E$${derniere}`);
    const fd = enfants(cl.wb.getElementsByTagNameNS(NS.main, "definedNames")[0], "definedName")
      .find(d => d.getAttribute("name") === "_xlnm._FilterDatabase" && d.getAttribute("localSheetId") === String(f.index));
    if (fd) fd.setAttribute("hidden", "1");
  }
  await cl._majDimension(ONGLET_TABLE, derniere, "E");
  cl._modifie(f.chemin);
}

// Régénère toutes les étiquettes des onglets d'étiquettes (Star Wars + thèmes)
async function regenererTout(cl, progression) {
  const coll = await lireCollection(cl);
  const onglets = Object.keys(coll);
  const rapport = { faites: 0, ignorees: [] };
  const total = onglets.reduce((s, o) => s + coll[o].cases.filter(c => c.code).length, 0);
  let i = 0;
  for (const onglet of onglets) {
    await cl.supprimerImages(onglet);
    for (const c of coll[onglet].cases) {
      if (!c.code) continue;
      i++;
      if (codeInvalide(c.code)) { rapport.ignorees.push({ onglet, ref: c.ref, code: c.code, nom: c.nom }); continue; }
      await poserEtiquette(cl, onglet, c.row, c.col, c.code, c.lien);
      rapport.faites++;
      if (progression && i % 5 === 0) { progression(i, total); await new Promise(r => setTimeout(r, 0)); }
    }
  }
  if (progression) progression(total, total);
  return rapport;
}

// Relit le fichier enregistré pour vérifier que l'étiquette est bien à sa place
async function verifierAjout(octets, { onglet, row, col, code }) {
  const cl = await Classeur.ouvrir(octets);
  const codeLu = await cl.valeur(onglet, lettreColonne(12 + col) + row);
  const images = await cl.positionsImages(onglet);
  return codeLu === code && images.has(`${row}:${col}`);
}
