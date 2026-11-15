// Fichier Excel « À vendre » complet, avec la photo du recto de chaque blister (Mathias, 15/11/2026 : « un maximum
// d'informations, les mêmes que je remplis quand j'intègre un blister : série limitée, nombre produit, numéro, mention
// particulière (Halloween…), et la photo avant »). Une ligne par exemplaire à vendre. Fichier .xlsx écrit à la main
// (JSZip) : feuille, styles, dessin avec les photos réduites ; formules de total recalculées par Excel à l'ouverture.

const ExportVente = {
  _x: s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),

  // photo du recto réduite (JPEG, 260 px au plus) : { octets, l, h } ou null
  async _miniature(blob) {
    if (!blob) return null;
    try {
      const bm = await createImageBitmap(blob);
      const r = Math.min(1, 260 / Math.max(bm.width, bm.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bm.width * r); c.height = Math.round(bm.height * r);
      c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
      bm.close && bm.close();
      const b = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.85));
      return { octets: new Uint8Array(await b.arrayBuffer()), l: c.width, h: c.height };
    } catch (err) { console.warn(err); return null; }
  },

  // lignes : [{ photo (Blob), valeurs: [...] }] ; colonnes : [{ titre, largeur, type: "texte" | "nombre" | "euro" }]
  async fichier(colonnes, lignes, legende) {
    const x = this._x, zip = new JSZip(), L = lettreColonne;
    const cellule = (ref, v, col, style) => {
      if (v == null || v === "") return `<c r="${ref}" s="${style}"/>`;
      if (col.type !== "texte" && typeof v === "number") return `<c r="${ref}" s="${col.type === "euro" ? 3 : style}"><v>${v}</v></c>`;
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`;
    };
    const rows = [`<row r="1" ht="34" customHeight="1">${colonnes.map((c, i) => cellule(L(i + 1) + 1, c.titre, { type: "texte" }, 1)).join("")}</row>`];
    const ancres = [], medias = [];
    for (let i = 0; i < lignes.length; i++) {
      const r = i + 2, l = lignes[i];
      rows.push(`<row r="${r}" ht="${l.photo ? 96 : 30}" customHeight="1">${colonnes.map((c, j) => cellule(L(j + 1) + r, l.valeurs[j], c, 2)).join("")}</row>`);
      const m = l.photo && await this._miniature(l.photo);
      if (m) {
        const n = medias.length + 1;
        medias.push(m);
        zip.file(`xl/media/image${n}.jpeg`, m.octets);
        const k = Math.min(120 / m.h, 140 / m.l), emu = v => Math.round(v * k * 9525);
        ancres.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>${r - 1}</xdr:row><xdr:rowOff>19050</xdr:rowOff></xdr:from>
          <xdr:ext cx="${emu(m.l)}" cy="${emu(m.h)}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${n + 1}" name="Photo ${n}"/><xdr:cNvPicPr/></xdr:nvPicPr>
          <xdr:blipFill><a:blip r:embed="rId${n}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
          <xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`);
      }
    }
    // ligne de total : nombre d'exemplaires et somme des prix proposés
    const t = lignes.length + 2, colPrix = colonnes.findIndex(c => c.total) + 1;
    rows.push(`<row r="${t}" ht="24" customHeight="1">${cellule("B" + t, "TOTAL", { type: "texte" }, 4)}` +
      `<c r="C${t}" s="4"><f>COUNTA(B2:B${t - 1})&amp;" exemplaires"</f></c>` +
      (colPrix ? `<c r="${L(colPrix)}${t}" s="5"><f>SUM(${L(colPrix)}2:${L(colPrix)}${t - 1})</f></c>` : "") + `</row>`);
    const derniere = L(colonnes.length);
    zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
<cols>${colonnes.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largeur}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows.join("")}</sheetData><autoFilter ref="A1:${derniere}${t - 1}"/>
<pageSetup orientation="landscape" paperSize="9" fitToHeight="0"/>${medias.length ? `<drawing r:id="rId1"/>` : ""}</worksheet>`);
    if (medias.length) {
      zip.file("xl/worksheets/_rels/sheet1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
      zip.file("xl/drawings/drawing1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${ancres.join("")}</xdr:wsDr>`);
      zip.file("xl/drawings/_rels/drawing1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${medias.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.jpeg"/>`).join("")}</Relationships>`);
    }
    // 2e feuille : comment lire
    zip.file("xl/worksheets/sheet2.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="140" customWidth="1"/></cols>
<sheetData>${legende.map((s, i) => `<row r="${i + 1}">${cellule("A" + (i + 1), s, { type: "texte" }, i ? 6 : 4)}</row>`).join("")}</sheetData></worksheet>`);
    zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
<font><sz val="10"/><color rgb="FF0000FF"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2B2733"/></patternFill></fill></fills>
<borders count="2"><border/><border><bottom style="thin"><color rgb="FFDDDDDD"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="164" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`);
    zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="À vendre" sheetId="1" r:id="rId1"/><sheet name="Comment lire" sheetId="2" r:id="rId2"/></sheets>
<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'À vendre'!$A$1:$${derniere}$${t - 1}</definedName></definedNames>
<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`);
    zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${medias.length ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : ""}</Types>`);
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  },
};
