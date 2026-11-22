import JSZip from 'jszip';

/** Texto extraído de um arquivo. "escaneado" indica PDF sem camada de texto (imagem), que vai à IA como arquivo. */
export interface Parte { nome: string; texto: string; paginas?: number; escaneado?: boolean; pdf?: Uint8Array; aviso?: string }

const ext = (n: string) => (n.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const limpa = (t: string) => t.replace(/[ \t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

async function pdf(nome: string, dados: Uint8Array): Promise<Parte> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  const copia = new Uint8Array(dados); // o pdf.js consome o buffer
  const doc = await getDocumentProxy(copia);
  const { totalPages, text } = await extractText(doc, { mergePages: false });
  const paginas = (text as string[]).map((t, i) => `[página ${i + 1}]\n${limpa(t)}`);
  const util = (text as string[]).join('').replace(/\s/g, '').length;
  const escaneado = util < Math.max(200, totalPages * 80);
  return { nome, texto: escaneado ? '' : paginas.join('\n\n'), paginas: totalPages, escaneado, pdf: escaneado ? dados : undefined };
}

async function docx(nome: string, dados: Uint8Array): Promise<Parte> {
  const z = await JSZip.loadAsync(dados);
  const xml = await z.file('word/document.xml')?.async('string');
  if (!xml) return { nome, texto: '', aviso: 'DOCX sem conteúdo legível' };
  const t = xml.replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<w:br\/>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  return { nome, texto: limpa(t) };
}

/** Lê PDF, DOCX, TXT e ZIP (inclusive ZIP dentro de ZIP, um nível). Outros formatos voltam com aviso. */
export async function extrair(nome: string, dados: ArrayBuffer | Uint8Array, nivel = 0): Promise<Parte[]> {
  const u8 = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
  const cab = String.fromCharCode(...u8.slice(0, 4));
  try {
    if (cab.startsWith('%PDF')) return [await pdf(nome, u8)];
    if (u8[0] === 0x50 && u8[1] === 0x4b) {
      if (ext(nome) === 'docx') return [await docx(nome, u8)];
      const z = await JSZip.loadAsync(u8);
      if (z.file('word/document.xml')) return [await docx(nome, u8)];
      if (nivel > 1) return [{ nome, texto: '', aviso: 'ZIP aninhado demais' }];
      const out: Parte[] = [];
      for (const f of Object.values(z.files)) {
        if (f.dir || /(^|\/)(__MACOSX|\.)/.test(f.name)) continue;
        const e = ext(f.name);
        if (!['pdf', 'docx', 'txt', 'zip'].includes(e)) { out.push({ nome: `${nome} › ${f.name}`, texto: '', aviso: `formato .${e || '?'} não lido` }); continue; }
        out.push(...await extrair(`${nome} › ${f.name}`, await f.async('uint8array'), nivel + 1));
      }
      return out;
    }
    if (ext(nome) === 'txt') return [{ nome, texto: limpa(new TextDecoder().decode(u8)) }];
    return [{ nome, texto: '', aviso: 'formato não lido (use PDF, DOCX ou ZIP)' }];
  } catch (e) {
    return [{ nome, texto: '', aviso: 'não foi possível ler: ' + String((e as Error).message).slice(0, 80) }];
  }
}
