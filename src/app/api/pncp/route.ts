import crypto from 'node:crypto';
import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { perms, auditar } from '@/lib/regras';
import { gravar } from '@/lib/armazenamento';

export const dynamic = 'force-dynamic';
/** API pública de integração do PNCP (manual: pncp.gov.br/manual · serviços 11.x de contratação). */
const BASE = process.env.PNCP_BASE_URL || 'https://pncp.gov.br/api/pncp';
/** Desde 2026 o detalhe da contratação é servido pela API de consulta; arquivos seguem na API do PNCP. */
const CONSULTA = process.env.PNCP_CONSULTA_URL || 'https://pncp.gov.br/api/consulta';

/** Aceita o número de controle (CNPJ-1-SEQUENCIAL/ANO) ou o link do portal (…/editais/CNPJ/ANO/SEQUENCIAL). */
function interpretar(ref: string) {
  const s = ref.trim();
  let m = s.match(/(\d{14})-\d-(\d{1,6})\/(\d{4})/); if (m) return { cnpj: m[1], seq: Number(m[2]), ano: Number(m[3]) };
  m = s.match(/editais\/(\d{14})\/(\d{4})\/(\d{1,6})/); if (m) return { cnpj: m[1], ano: Number(m[2]), seq: Number(m[3]) };
  return null;
}
/** O PNCP entrega o documento como PDF, ZIP ou outro formato: o tipo vem do conteúdo (assinatura do arquivo), não do título. */
function tipoArquivo(dados: ArrayBuffer, disp: string | null) {
  const h = new Uint8Array(dados.slice(0, 8));
  const asc = String.fromCharCode(...h);
  if (asc.startsWith('%PDF')) return { ext: '.pdf', mime: 'application/pdf' };
  if (h[0] === 0x50 && h[1] === 0x4b) {
    const n = (disp || '').toLowerCase();
    if (n.includes('.docx')) return { ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    if (n.includes('.xlsx')) return { ext: '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    return { ext: '.zip', mime: 'application/zip' };
  }
  if (asc.startsWith('Rar!')) return { ext: '.rar', mime: 'application/vnd.rar' };
  if (h[0] === 0x37 && h[1] === 0x7a) return { ext: '.7z', mime: 'application/x-7z-compressed' };
  if (h[0] === 0xd0 && h[1] === 0xcf) return { ext: '.doc', mime: 'application/msword' };
  const m = (disp || '').match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);
  const ext = m ? (m[1].match(/\.[a-z0-9]{1,5}$/i) || [''])[0].toLowerCase() : '';
  return { ext: ext || '.bin', mime: 'application/octet-stream' };
}

async function obter(url: string) {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (r.status === 404 || r.status === 204) return { status: 'nao_localizado' as const };
  if (!r.ok) return { status: 'indisponivel' as const, http: r.status };
  const tipo = r.headers.get('content-type') || '';
  if (!tipo.includes('json')) return { status: 'indisponivel' as const, http: r.status };
  return { status: 'ok' as const, dados: await r.json() };
}

export async function GET(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  const ref = new URL(req.url).searchParams.get('ref') || '';
  const id = interpretar(ref); if (!id) return jsonErro(422, 'Informe o número de controle PNCP (ex.: 00394460000141-1-000045/2026) ou o link do edital no portal.');
  try {
    const caminho = `/v1/orgaos/${id.cnpj}/compras/${id.ano}/${id.seq}`;
    const base = `${BASE}${caminho}`;
    let c = await obter(`${CONSULTA}${caminho}`);
    if (c.status === 'indisponivel') c = await obter(base);   // compatibilidade com o endereço anterior
    if (c.status !== 'ok') return Response.json({ ok: true, situacao: c.status, ref: id, mensagem: c.status === 'nao_localizado' ? 'Nenhuma publicação localizada no PNCP para este identificador.' : 'Fonte indisponível no momento' + ('http' in c && c.http ? ' (HTTP ' + c.http + ')' : '') + '; siga pelo fluxo manual.' });
    const a = await obter(`${base}/arquivos`);
    const docs = a.status === 'ok' ? (Array.isArray(a.dados) ? a.dados : a.dados.documentos || []) : [];
    const d = c.dados;
    return Response.json({ ok: true, situacao: 'ok', ref: id, consultadoEm: new Date().toISOString(),
      contratacao: { orgao: d.orgaoEntidade?.razaoSocial, unidade: d.unidadeOrgao?.nomeUnidade, uf: d.unidadeOrgao?.ufSigla, municipio: d.unidadeOrgao?.municipioNome, objeto: d.objetoCompra, modalidade: d.modalidadeNome, numero: d.numeroCompra, processo: d.processo, situacao: d.situacaoCompraNome, abertura: d.dataAberturaProposta, encerramento: d.dataEncerramentoProposta, valorEstimado: d.valorTotalEstimado, link: d.linkSistemaOrigem },
      documentos: docs.map((x: any) => ({ sequencial: x.sequencialDocumento, titulo: x.titulo, tipo: x.tipoDocumentoNome || x.tipoDocumentoDescricao, data: x.dataPublicacaoPncp, url: x.url || x.uri, ativo: x.statusAtivo !== false })),
      documentosSituacao: a.status });
  } catch (e) {
    return Response.json({ ok: true, situacao: 'indisponivel', ref: id, mensagem: 'Fonte indisponível (' + String((e as Error).message).slice(0, 80) + '); siga pelo fluxo manual.' });
  }
}

/** Baixa e versiona no processo os documentos escolhidos. */
export async function POST(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  const b = await req.json().catch(() => null); const id = b && interpretar(String(b.ref || ''));
  if (!id || !b.crt || !b.emp || !Array.isArray(b.docs)) return jsonErro(400, 'Requisição inválida.');
  try {
    const r = await comPerfil(s.efetivo.id, async (tx) => {
      const p = await perms(tx, s, b.emp); if (!p.includes('preparar')) return { erro: 'Seu perfil não registra documentos do edital.' };
      if (!(await tx`select 1 from participacoes where empresa_id = ${b.emp} and certame_id = ${b.crt}`).length) return { erro: 'Processo fora do seu escopo.' };
      const salvos = [];
      for (const d of b.docs.slice(0, 20)) {
        const url = `${BASE}/v1/orgaos/${id.cnpj}/compras/${id.ano}/${id.seq}/arquivos/${Number(d.sequencial)}`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(60000) }); if (!resp.ok) { salvos.push({ titulo: d.titulo, erro: 'HTTP ' + resp.status }); continue; }
        const dados = await resp.arrayBuffer(); const arqId = crypto.randomUUID();
        const t = tipoArquivo(dados, resp.headers.get('content-disposition'));
        const base = String(d.titulo || 'documento').replace(/\.(pdf|zip|docx?|xlsx?|odt|rar|7z)$/i, '').replace(/[^\w.\-() ]+/g, '_').slice(0, 100);
        const nome = base + t.ext;
        const caminho = `${b.emp}/${arqId}/${nome}`;
        await gravar(caminho, dados, t.mime);
        await tx`insert into arquivos (id, empresa_id, caminho, nome, mime, tamanho, criado_por) values (${arqId}, ${b.emp}, ${caminho}, ${nome}, ${t.mime}, ${dados.byteLength}, ${s.efetivo.id})`;
        const v = ((await tx`select max(versao) m from certame_documentos where certame_id = ${b.crt} and nome = ${d.titulo}`)[0].m || 0) + 1;
        await tx`insert into certame_documentos (certame_id, nome, versao, publicado, arquivo_id, enviado_por_empresa) values (${b.crt}, ${d.titulo}, ${v}, ${d.data ? String(d.data).slice(0, 10) : null}, ${arqId}, ${b.emp})`;
        await auditar(tx, s, b.emp, 'documento_edital', b.crt, 'pncp', v, { titulo: d.titulo, origem: url });
        salvos.push({ titulo: d.titulo, versao: v, arqId });
      }
      return { salvos };
    });
    if ('erro' in r) return jsonErro(403, r.erro as string);
    return Response.json({ ok: true, ...r });
  } catch (e) { return jsonErro(502, 'Fonte indisponível ao baixar os documentos: ' + String((e as Error).message).slice(0, 120)); }
}
