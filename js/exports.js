// Exports de la collection, quel que soit le rangement (fichier Excel ou base de données de l'appli) :
//  - Excel (.xlsx) : un tableau propre par catégorie (figurines, customs, sets, objets dérivés, souhaits), à retravailler ;
//  - PDF : la liste imprimable (menu Imprimer → « Enregistrer au format PDF ») ;
//  - CSV : un seul tableau, toutes catégories, séparateur point-virgule (Excel français) ;
//  - BrickLink (XML) : liste à importer comme « Wanted List » ou inventaire sur BrickLink ;
//  - sauvegarde complète (.json) : tout le contenu, pour la reprendre dans l'appli (version base de données).

const Exports = {
  async ouvrir() {
    afficher("exports");
    $("exp-liste").innerHTML = "";
    const d = await this.donnees();
    $("exp-resume").textContent = d.feuilles.map(f => `${f.lignes.length} ${f.titre.toLowerCase()}`).join(" · ") || "Collection vide.";
  },

  // Toutes les données, catégorie par catégorie : [{ nom (onglet Excel), titre, colonnes: [[titre, largeur]], lignes: [[…]] }]
  async donnees() {
    const cl = etat.classeur, feuilles = [];
    const numero = nom => (/(\d+\s*\/\s*\d+)\s*$/.exec(nom || "") || [, ""])[1].replace(/\s/g, "");
    const figs = [], customs = [];
    for (const [onglet, o] of Object.entries(etat.collection || {}))
      for (const c of o.cases.filter(c => c.code)) {
        if (onglet === THEME_CUSTOMS.onglet) customs.push([c.code, c.nom || "", numero(c.nom), c.lien || "", c.ref]);
        else figs.push([onglet, c.code, c.nom || "", ONGLETS_COLORES.includes(onglet) ? "Star Wars" : onglet, codeInvalide(c.code) ? "" : urlBricklink(c.code), c.ref]);
      }
    feuilles.push({ nom: "Figurines", titre: "Figurines", lignes: figs,
      colonnes: [["Onglet / camp", 18], ["Code", 12], ["Nom", 48], ["Thème", 18], ["Page BrickLink", 40], ["Case", 8]] });
    feuilles.push({ nom: "Customs", titre: "Customs", lignes: customs,
      colonnes: [["Code", 16], ["Nom", 48], ["N° d'exemplaire", 14], ["Lien (fabricant ou eBay)", 50], ["Case", 8]] });
    const lire = async f => { try { return cl ? await f(cl) : []; } catch (err) { console.warn(err); return []; } };
    feuilles.push({ nom: "Sets", titre: "Sets", lignes: (await lire(lireSets)).map(s => [s.code, s.nom, s.annee, s.theme, s.etat, s.boite, s.notice, s.figurines, s.quantite || 1, s.remarques]),
      colonnes: [["Numéro", 11], ["Nom", 40], ["Année", 7], ["Thème", 20], ["État", 14], ["Boîte", 7], ["Notice", 7], ["Figurines", 30], ["Quantité", 9], ["Remarques", 30]] });
    feuilles.push({ nom: "Objets dérivés", titre: "Objets dérivés", lignes: (await lire(lireObjets)).map(o => [o.code, o.nom, o.type, o.etat, o.quantite || 1, o.remarques]),
      colonnes: [["Code", 14], ["Nom", 40], ["Type", 18], ["État", 14], ["Quantité", 9], ["Remarques", 30]] });
    feuilles.push({ nom: "Souhaits", titre: "Souhaits", lignes: (await lire(lireSouhaits)).map(s => [s.type, s.code, s.nom, s.theme, s.sortie, s.remarques, s.ajoute]),
      colonnes: COLONNES_SOUHAITS.map(([, t, l]) => [t, l]) });
    for (const f of feuilles) f.lignes = f.lignes.map(l => l.map(v => v == null ? "" : v));
    return { feuilles: feuilles.filter(f => f.lignes.length), date: new Date() };
  },

  _telecharger(blob, nom) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast(`${nom} enregistré dans Téléchargements ✔`, 4000);
  },

  async excel() {
    const d = await this.donnees();
    if (!d.feuilles.length) return toast("Rien à exporter : la collection est vide.");
    this._telecharger(await creerXlsx(d.feuilles), `collection_LEGO_${horodatage()}.xlsx`);
  },

  async csv() {
    const d = await this.donnees();
    const c = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lignes = [["Catégorie", "Code", "Nom", "Détail 1", "Détail 2", "Détail 3", "Détail 4"].map(c).join(";")];
    for (const f of d.feuilles)
      for (const l of f.lignes) {
        const iCode = f.nom === "Figurines" ? 1 : f.nom === "Souhaits" ? 1 : 0, iNom = iCode + 1;
        const reste = l.filter((_, i) => i !== iCode && i !== iNom).slice(0, 4);
        lignes.push([f.titre, l[iCode], l[iNom], ...reste].map(c).join(";"));
      }
    this._telecharger(new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv" }), `collection_LEGO_${horodatage()}.csv`);
  },

  // Format XML de BrickLink (Wanted List) : M = figurine, S = set, G = objet. Les customs (sans code BrickLink) n'y sont pas.
  async bricklink() {
    const i = await choisirAction("Exporter vers BrickLink (liste « Wanted List »)", ["⭐ Ma liste de souhaits", "📖 Toute ma collection"]);
    if (i < 0) return;
    const d = await this.donnees();
    const x = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const items = new Map();
    const ajouter = (type, code, qte = 1) => {
      if (!code || (type === "M" && (codeInvalide(code) || /^fig-/i.test(code)))) return;
      const k = type + "|" + code.toLowerCase(); items.set(k, { type, code: code.toLowerCase(), qte: (items.get(k)?.qte || 0) + qte });
    };
    const set = c => /-\d+$/.test(c) ? c : c + "-1";
    for (const f of d.feuilles) {
      if (i === 0 && f.nom === "Souhaits") f.lignes.forEach(l => ajouter({ Figurine: "M", Set: "S", Objet: "G" }[l[0]], l[0] === "Set" ? set(l[1]) : l[1]));
      if (i === 1 && f.nom === "Figurines") f.lignes.forEach(l => ajouter("M", l[1]));
      if (i === 1 && f.nom === "Sets") f.lignes.forEach(l => ajouter("S", set(l[0]), +l[8] || 1));
      if (i === 1 && f.nom === "Objets dérivés") f.lignes.forEach(l => /^[\w-]+$/.test(l[0]) && ajouter("G", l[0], +l[4] || 1));
    }
    if (!items.size) return toast("Rien à exporter vers BrickLink.");
    const corps = [...items.values()].map(i => `<ITEM><ITEMTYPE>${i.type}</ITEMTYPE><ITEMID>${x(i.code)}</ITEMID><MINQTY>${i.qte}</MINQTY></ITEM>`).join("\n");
    this._telecharger(new Blob([`<INVENTORY>\n${corps}\n</INVENTORY>\n`], { type: "application/xml" }), `bricklink_${i === 0 ? "souhaits" : "collection"}_${horodatage()}.xml`);
    if (await demander(`${items.size} article(s) au format BrickLink. Ouvrir la page d'import de BrickLink (Wanted List → Upload) ? Collez-y le contenu du fichier.`, "Ouvrir BrickLink", "Plus tard"))
      window.open("https://www.bricklink.com/v2/wanted/upload.page", "_blank", "noopener");
  },

  async sauvegarde() {
    const d = await this.donnees();
    const contenu = { application: "Briquothèque", version: 1, date: d.date.toISOString(),
      feuilles: d.feuilles.map(f => ({ nom: f.nom, colonnes: f.colonnes.map(c => c[0]), lignes: f.lignes })) };
    if (etat.classeur && etat.classeur.estBase) contenu.base = await etat.classeur.exporter();
    this._telecharger(new Blob([JSON.stringify(contenu, null, 1)], { type: "application/json" }), `sauvegarde_collection_${horodatage()}.json`);
  },

  // Liste imprimable, puis menu Imprimer (« Enregistrer au format PDF »)
  async pdf() {
    const d = await this.donnees();
    if (!d.feuilles.length) return toast("Rien à exporter : la collection est vide.");
    const nb = d.feuilles.reduce((s, f) => s + f.lignes.length, 0);
    $("exp-liste").innerHTML = `<div class="dossier"><h2>Ma collection LEGO</h2>
      <p>Au ${d.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} : ${nb} article(s).</p>` +
      d.feuilles.map(f => {
        const garder = f.colonnes.map(([t], i) => i).filter(i => !/^(Page BrickLink|Lien|Case)/.test(f.colonnes[i][0]));
        return `<h2>${echapper(f.titre)} (${f.lignes.length})</h2><table><thead><tr>${garder.map(i => `<th>${echapper(f.colonnes[i][0])}</th>`).join("")}</tr></thead>
          <tbody>${f.lignes.map(l => `<tr>${garder.map(i => `<td>${echapper(l[i])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      }).join("") + `</div>`;
    const titre = document.title;
    document.title = `Collection LEGO ${horodatage()}`;
    document.body.classList.add("impression-liste");
    window.print();
    setTimeout(() => { document.title = titre; document.body.classList.remove("impression-liste"); }, 1500);
  },
};

// ---------- écriture d'un fichier .xlsx neuf (sans modèle) ----------

function nomFeuilleXlsx(nom) { return String(nom).replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31); }

async function creerXlsx(feuilles) {
  const x = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${
    feuilles.map((f, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${
    feuilles.map((f, i) => `<sheet name="${x(nomFeuilleXlsx(f.nom))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${
    feuilles.map((f, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${x(nomFeuilleXlsx(f.nom)).replace(/'/g, "''")}'!$A$1:$${lettreColonne(f.colonnes.length)}$${f.lignes.length + 1}</definedName>`).join("")}</definedNames></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
    feuilles.map((f, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD01012"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  feuilles.forEach((f, i) => {
    const cellule = (v, ref, style) => typeof v === "number" && isFinite(v) ? `<c r="${ref}"${style}><v>${v}</v></c>`
      : v === "" ? "" : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${x(v)}</t></is></c>`;
    const ligne = (vals, r, style = "") => `<row r="${r}">${vals.map((v, c) => cellule(v, lettreColonne(c + 1) + r, style)).join("")}</row>`;
    const fin = `${lettreColonne(f.colonnes.length)}${f.lignes.length + 1}`;
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${fin}"/><sheetViews><sheetView workbookViewId="0"${i === 0 ? ' tabSelected="1"' : ""}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="13"/><cols>${
      f.colonnes.map(([, l], c) => `<col min="${c + 1}" max="${c + 1}" width="${l}" customWidth="1"/>`).join("")}</cols><sheetData>${
      ligne(f.colonnes.map(c => c[0]), 1, ' s="1"')}${f.lignes.map((l, r) => ligne(l, r + 2)).join("")}</sheetData><autoFilter ref="A1:${fin}"/></worksheet>`);
  });
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// Reprise d'une sauvegarde .json dans la base de l'appli (changement de téléphone, retour en arrière)
$("input-sauvegarde").addEventListener("change", async e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const contenu = JSON.parse(await f.text());
    if (!["Briquothèque", "Figothèque"].includes(contenu.application) || !Array.isArray(contenu.base))
      throw new Error("ce n'est pas une sauvegarde de la collection rangée dans l'appli (une sauvegarde faite avec un fichier Excel se reprend avec le fichier Excel lui-même)");
    await demarrerBase(true, contenu.base);
  } catch (err) {
    console.error(err);
    await demander("Impossible de restaurer cette sauvegarde : " + err.message, "OK", "Fermer");
  }
});

document.addEventListener("click", e => {
  const b = e.target.closest("[data-action^='export']");
  if (!b) return;
  const a = b.dataset.action;
  if (a === "exports") Exports.ouvrir();
  else if (a === "export-excel") Exports.excel();
  else if (a === "export-pdf") Exports.pdf();
  else if (a === "export-csv") Exports.csv();
  else if (a === "export-bricklink") Exports.bricklink();
  else if (a === "export-sauvegarde") Exports.sauvegarde();
});
