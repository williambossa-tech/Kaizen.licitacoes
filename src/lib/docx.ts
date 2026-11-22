import JSZip from 'jszip';

/**
 * Monta a peça em Word. Com papel timbrado (.docx da empresa), mantém cabeçalho, rodapé, logotipo, margens e estilos
 * do modelo e substitui o corpo: o parágrafo com {{CORPO}}, se existir; senão, todo o conteúdo do corpo.
 */
const xe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ESP = '<w:spacing w:before="0" w:after="120" w:line="360" w:lineRule="auto"/>';

/** Trechos entre **asteriscos** viram negrito; o resto do markdown é descartado. */
function runs(t: string, negrito = false) {
  return t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => {
    const b = negrito || /^\*\*[^*]+\*\*$/.test(p); const tx = p.replace(/^\*\*|\*\*$/g, '').replace(/(^|\s)\*([^*]+)\*/g, '$1$2');
    return `<w:r>${b ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xe(tx)}</w:t></w:r>`;
  }).join('');
}
const par = (conteudo: string, ppr = '') => `<w:p><w:pPr>${ppr}</w:pPr>${conteudo}</w:p>`;

export function paragrafos(texto: string, fecho?: { local: string; assinatura: string[] }) {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const out: string[] = []; let titulo = true;
  for (const l0 of linhas) {
    const l = l0.trimEnd();
    if (!l.trim()) { continue; }
    if (titulo) { out.push(par(runs(l.replace(/^#+\s*/, ''), true), `<w:spacing w:before="0" w:after="240" w:line="360" w:lineRule="auto"/><w:jc w:val="center"/>`)); titulo = false; continue; }
    if (/^#{1,3}\s/.test(l)) { out.push(par(runs(l.replace(/^#+\s*/, ''), true), `<w:keepNext/><w:spacing w:before="240" w:after="120" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/>`)); continue; }
    if (/^\s*[-•*]\s+/.test(l)) { out.push(par(runs('–  ' + l.replace(/^\s*[-•*]\s+/, '')), `${ESP}<w:ind w:left="567" w:hanging="283"/><w:jc w:val="both"/>`)); continue; }
    if (/^\s*(\d+|[a-z])[.)]\s+/.test(l)) { out.push(par(runs(l.trim()), `${ESP}<w:ind w:left="567" w:hanging="425"/><w:jc w:val="both"/>`)); continue; }
    out.push(par(runs(l.trim()), `${ESP}<w:ind w:firstLine="709"/><w:jc w:val="both"/>`));
  }
  if (fecho) {
    out.push(par(runs(fecho.local), `<w:spacing w:before="360" w:after="720"/><w:jc w:val="right"/>`));
    out.push(par(runs('_______________________________________'), `<w:keepNext/><w:spacing w:after="0"/><w:jc w:val="center"/>`));
    fecho.assinatura.forEach((a, i) => out.push(par(runs(a, i === 0), `${i < fecho.assinatura.length - 1 ? '<w:keepNext/>' : ''}<w:spacing w:after="0"/><w:jc w:val="center"/>`)));
  }
  return out.join('');
}

/** Confere se o arquivo é um Word (.docx) utilizável como papel timbrado. */
export async function validarTimbrado(dados: ArrayBuffer | Uint8Array) {
  try { const z = await JSZip.loadAsync(dados); return !!z.file('word/document.xml'); } catch { return false; }
}

export async function montarDocx(texto: string, fecho?: { local: string; assinatura: string[] }, timbrado?: ArrayBuffer | null): Promise<Uint8Array> {
  const corpo = paragrafos(texto, fecho);
  if (timbrado) {
    const z = await JSZip.loadAsync(timbrado); const f = z.file('word/document.xml');
    if (f) {
      const xml = await f.async('string');
      const ab = /<w:body[^>]*>/.exec(xml); const fim = xml.lastIndexOf('</w:body>');
      if (ab && fim > 0) {
        const ini = ab.index + ab[0].length; const dentro = xml.slice(ini, fim);
        let novo: string;
        const ph = dentro.indexOf('{{CORPO}}');
        if (ph >= 0) {
          const pi = Math.max(dentro.lastIndexOf('<w:p>', ph), dentro.lastIndexOf('<w:p ', ph)); const pf = dentro.indexOf('</w:p>', ph);
          novo = pi >= 0 && pf > 0 ? dentro.slice(0, pi) + corpo + dentro.slice(pf + 6) : corpo + dentro;
        } else {
          const si = dentro.lastIndexOf('<w:sectPr'); const sect = si >= 0 && !dentro.slice(si).includes('</w:p>') ? dentro.slice(si) : '';
          novo = corpo + sect;
        }
        z.file('word/document.xml', xml.slice(0, ini) + novo + xml.slice(fim));
        return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      }
    }
  }
  // sem timbrado: documento A4 simples, Arial 12
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  z.file('word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>');
  z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1701" w:right="1134" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
