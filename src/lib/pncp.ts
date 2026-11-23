/** Acesso à API pública do PNCP (sem chave). Manual: pncp.gov.br/manual · serviços de consulta e de contratação. */
export const BASE = process.env.PNCP_BASE_URL || 'https://pncp.gov.br/api/pncp';
/** Desde 2026 o detalhe e a busca de contratações são servidos pela API de consulta; arquivos, itens e histórico seguem na API do PNCP. */
export const CONSULTA = process.env.PNCP_CONSULTA_URL || 'https://pncp.gov.br/api/consulta';

export type Id = { cnpj: string; ano: number; seq: number };
export type Resp = { status: 'ok'; dados: any } | { status: 'nao_localizado' } | { status: 'indisponivel'; http?: number };

/** Aceita o número de controle (CNPJ-1-SEQUENCIAL/ANO) ou o link do portal (…/editais/CNPJ/ANO/SEQUENCIAL). */
export function interpretar(ref: string): Id | null {
  const s = String(ref || '').trim();
  let m = s.match(/(\d{14})-\d-(\d{1,6})\/(\d{4})/); if (m) return { cnpj: m[1], seq: Number(m[2]), ano: Number(m[3]) };
  m = s.match(/editais\/(\d{14})\/(\d{4})\/(\d{1,6})/); if (m) return { cnpj: m[1], ano: Number(m[2]), seq: Number(m[3]) };
  return null;
}
export const controle = (id: Id) => `${id.cnpj}-1-${String(id.seq).padStart(6, '0')}/${id.ano}`;
export const linkPortal = (id: Id) => `https://pncp.gov.br/app/editais/${id.cnpj}/${id.ano}/${id.seq}`;
const caminho = (id: Id) => `/v1/orgaos/${id.cnpj}/compras/${id.ano}/${id.seq}`;

export async function obter(url: string, ms = 15000): Promise<Resp> {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  if (r.status === 404 || r.status === 204) return { status: 'nao_localizado' };
  if (!r.ok) return { status: 'indisponivel', http: r.status };
  if (!(r.headers.get('content-type') || '').includes('json')) return { status: 'indisponivel', http: r.status };
  return { status: 'ok', dados: await r.json() };
}

/** Agora em horário de Brasília, no mesmo formato das datas do PNCP (YYYY-MM-DDTHH:MM:SS, sem fuso). */
export function agoraBrasilia() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}`;
}

/** Resumo de uma contratação (mesmo formato na busca e no detalhe). */
export function resumo(d: any) {
  const id = { cnpj: d.orgaoEntidade?.cnpj, ano: d.anoCompra, seq: d.sequencialCompra };
  return {
    controle: d.numeroControlePNCP || (id.cnpj ? controle(id) : null), cnpj: id.cnpj, ano: id.ano, seq: id.seq,
    orgao: d.orgaoEntidade?.razaoSocial, unidade: d.unidadeOrgao?.nomeUnidade, uf: d.unidadeOrgao?.ufSigla, municipio: d.unidadeOrgao?.municipioNome,
    objeto: d.objetoCompra, modalidade: d.modalidadeNome, numero: d.numeroCompra, processo: d.processo, situacao: d.situacaoCompraNome, situacaoId: d.situacaoCompraId,
    publicacao: d.dataPublicacaoPncp, abertura: d.dataAberturaProposta, encerramento: d.dataEncerramentoProposta, disputa: d.modoDisputaNome,
    valorEstimado: d.valorTotalEstimado ?? null, srp: !!d.srp, link: d.linkSistemaOrigem || null, portal: id.cnpj ? linkPortal(id) : null
  };
}

/** Modalidades aceitas na busca (código do PNCP). */
export const MODALIDADES: Record<string, string> = { '6': 'Pregão eletrônico', '4': 'Concorrência eletrônica', '8': 'Dispensa', '7': 'Pregão presencial', '5': 'Concorrência presencial', '12': 'Credenciamento', '9': 'Inexigibilidade', '1': 'Leilão eletrônico' };

const ymd = (d: string) => d.replace(/-/g, '');
const POR_PAGINA = 50, MAX_PAGINAS = 80;

/**
 * Busca contratações publicadas no período, por UF e modalidade.
 * "abertas": só as divulgadas cujo prazo de propostas ainda não terminou (a disputa ainda não começou).
 */
export async function buscar(f: { de: string; ate: string; uf?: string; mod: string; q?: string; abertas: boolean; limite?: number }) {
  const qs = (p: number) => `dataInicial=${ymd(f.de)}&dataFinal=${ymd(f.ate)}&codigoModalidadeContratacao=${f.mod}${f.uf ? '&uf=' + f.uf : ''}&pagina=${p}&tamanhoPagina=${POR_PAGINA}`;
  const url = (p: number) => `${CONSULTA}/v1/contratacoes/publicacao?${qs(p)}`;
  const primeira = await comRetentativa(url(1));
  if (primeira.status === 'nao_localizado') return { situacao: 'ok' as const, total: 0, lidos: 0, truncado: false, itens: [] };
  if (primeira.status !== 'ok') return { situacao: 'indisponivel' as const, http: 'http' in primeira ? primeira.http : undefined };
  const total = Number(primeira.dados.totalRegistros) || 0;
  const paginas = Math.min(Number(primeira.dados.totalPaginas) || 1, MAX_PAGINAS);
  let brutos: any[] = [...(primeira.dados.data || [])];
  // o PNCP limita pedidos seguidos (429): páginas uma a uma, com pausa quando ele pede, até 60 s no total
  const limite = f.limite ?? Date.now() + 60000;
  for (let p = 2; p <= paginas && Date.now() < limite; p++) {
    let r = await obterGuardado(url(p), 30000).catch(() => null);
    for (let i = 0; i < 3 && r && r.status === 'indisponivel' && r.http === 429 && Date.now() + 12000 < limite; i++) { await espera(12000); r = await obterGuardado(url(p), 30000).catch(() => null); }
    if (!r || r.status !== 'ok') break;
    brutos = brutos.concat(r.dados.data || []);
  }
  const agora = agoraBrasilia();
  const termos = palavras(f.q || '');
  const itens = brutos.map(resumo).filter((x) => {
    if (f.abertas && (x.situacaoId !== 1 || !x.encerramento || x.encerramento <= agora)) return false;
    if (termos.length) { const alvo = norm(`${x.objeto} ${x.orgao} ${x.municipio}`); if (!termos.every((t) => alvo.includes(t))) return false; }
    return true;
  }).sort((a, b) => String(a.encerramento || '9').localeCompare(String(b.encerramento || '9')));
  return { situacao: 'ok' as const, total, lidos: brutos.length, truncado: total > brutos.length, itens };
}
/** Status da busca, como na tela de editais do portal do PNCP. */
export const STATUS: Record<string, string> = { recebendo_proposta: 'A receber / recebendo proposta', propostas_encerradas: 'Em julgamento / propostas encerradas', encerradas: 'Encerradas', todos: 'Todos' };

/** Converte um resultado do serviço de busca do portal para o mesmo formato do resumo. */
function doPortal(x: any) {
  const id = { cnpj: x.orgao_cnpj, ano: Number(x.ano), seq: Number(x.numero_sequencial) };
  return {
    controle: x.numero_controle_pncp || controle(id), cnpj: id.cnpj, ano: id.ano, seq: id.seq,
    orgao: x.orgao_nome, unidade: x.unidade_nome, uf: x.uf, municipio: x.municipio_nome, objeto: x.description, modalidade: x.modalidade_licitacao_nome,
    numero: x.numero || x.title, processo: null, situacao: x.situacao_nome, situacaoId: Number(x.situacao_id),
    publicacao: x.data_publicacao_pncp ? String(x.data_publicacao_pncp).slice(0, 19) : null,
    abertura: x.data_inicio_recebimento_propostas || x.data_inicio_vigencia || null, encerramento: x.data_fim_recebimento_propostas || x.data_fim_vigencia || null, disputa: x.modo_disputa_nome || null,
    valorEstimado: x.valor_global ?? x.valor_total_estimado ?? null, srp: !!x.srp, link: x.link_sistema_origem || null, portal: linkPortal(id)
  };
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Respostas de busca guardadas por 5 minutos: repetir a mesma pesquisa não gera novos pedidos ao PNCP. */
const guardadas = new Map<string, { em: number; r: Resp }>();
async function obterGuardado(url: string, ms = 30000): Promise<Resp> {
  const g = guardadas.get(url); if (g && Date.now() - g.em < 5 * 60e3) return g.r;
  const r = await obter(url, ms);
  if (r.status === 'ok') { guardadas.set(url, { em: Date.now(), r }); if (guardadas.size > 300) guardadas.delete(guardadas.keys().next().value!); }
  return r;
}
/** O PNCP recusa pedidos seguidos por cerca de 10 a 15 segundos: até 4 tentativas, esperando 2, 6 e 12 segundos. */
async function comRetentativa(url: string, ms = 30000): Promise<Resp> {
  let ult: Resp = { status: 'indisponivel' };
  for (const pausa of [2000, 6000, 12000, 0]) {
    try { ult = await obterGuardado(url, ms); if (ult.status !== 'indisponivel') return ult; } catch { ult = { status: 'indisponivel' }; }
    if (pausa) await espera(pausa);
  }
  return ult;
}

/**
 * Busca de editais como na tela do portal do PNCP: palavra-chave, status, UFs e modalidade,
 * com o período de publicação aplicado aqui (o portal ordena da publicação mais recente para a mais antiga).
 * "abertas": além do status do portal, confere que a contratação está divulgada e que o prazo de propostas não terminou.
 */
export async function pesquisar(f: { q?: string; status: string; ufs: string[]; mod?: string; de?: string; ate?: string; abertas: boolean }) {
  const base = `https://pncp.gov.br/api/search/?tipos_documento=edital&ordenacao=-data&tam_pagina=100`
    + (f.q ? '&q=' + encodeURIComponent(f.q) : '') + (f.status && f.status !== 'todos' ? '&status=' + f.status : '&status=todos')
    + (f.ufs.length ? '&ufs=' + f.ufs.join('|') : '') + (f.mod ? '&modalidades=' + f.mod : '');
  const brutos: any[] = []; let total = 0; let fimPeriodo = false;
  for (let p = 1; p <= 5 && !fimPeriodo; p++) {
    const r = await comRetentativa(`${base}&pagina=${p}`);
    if (r.status !== 'ok') { if (p === 1) { console.warn('[pncp] busca do portal indisponível', 'http' in r ? r.http : r.status); return null; } break; }
    total = Number(r.dados.total) || 0; const ls = (r.dados.items || []).map(doPortal); brutos.push(...ls);
    if (ls.length < 100) break;
    if (f.de && ls.some((x: any) => x.publicacao && x.publicacao.slice(0, 10) < f.de!)) fimPeriodo = true;
  }
  const agora = agoraBrasilia();
  const itens = brutos.filter((x) => {
    const pub = (x.publicacao || '').slice(0, 10);
    if (f.de && pub && pub < f.de) return false;
    if (f.ate && pub && pub > f.ate) return false;
    if (f.abertas && (x.situacaoId !== 1 || !x.encerramento || String(x.encerramento) <= agora.slice(0, 16))) return false;
    return true;
  }).sort((a, b) => String(a.encerramento || '9').localeCompare(String(b.encerramento || '9')));
  return { situacao: 'ok' as const, fonte: 'portal', total, lidos: brutos.length, truncado: !fimPeriodo && total > brutos.length, itens };
}
/** Palavras da busca sem aspas e sem sinais: todas precisam aparecer no objeto, no órgão ou no município. */
export const palavras = (q: string) => norm(q).replace(/["'“”‘’]/g, ' ').split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1);
export const norm = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Detalhe da contratação (consulta, com retorno ao endereço anterior). */
export async function detalhe(id: Id) {
  let c = await obter(`${CONSULTA}${caminho(id)}`);
  if (c.status === 'indisponivel') c = await obter(`${BASE}${caminho(id)}`);
  return c;
}
export async function documentos(id: Id) {
  const a = await obter(`${BASE}${caminho(id)}/arquivos`);
  const docs = a.status === 'ok' ? (Array.isArray(a.dados) ? a.dados : a.dados.documentos || []) : [];
  return { situacao: a.status, docs: docs.map((x: any) => ({ sequencial: x.sequencialDocumento, titulo: x.titulo, tipo: x.tipoDocumentoNome || x.tipoDocumentoDescricao, data: x.dataPublicacaoPncp, ativo: x.statusAtivo !== false })) };
}
/** Histórico de alterações publicado no PNCP (inclusões, retificações, exclusões de documentos e itens). */
export async function historico(id: Id) {
  const h = await obter(`${BASE}${caminho(id)}/historico`);
  const ls = h.status === 'ok' && Array.isArray(h.dados) ? h.dados : [];
  return ls.map((x: any) => ({ data: x.logManutencaoDataInclusao, tipo: x.tipoLogManutencaoNome, categoria: x.categoriaLogManutencaoNome, documento: x.documentoTitulo || null, documentoTipo: x.documentoTipo || null, item: x.itemNumero ?? null, justificativa: x.justificativa || null, por: x.usuarioNome || null }))
    .sort((a: any, b: any) => String(b.data).localeCompare(String(a.data)));
}
/** Itens da contratação, em páginas de 50 (até 500 itens). */
export async function itens(id: Id) {
  const out: any[] = [];
  for (let p = 1; p <= 10; p++) {
    const r = await obter(`${BASE}${caminho(id)}/itens?pagina=${p}&tamanhoPagina=50`, 20000);
    if (r.status !== 'ok' || !Array.isArray(r.dados) || !r.dados.length) break;
    out.push(...r.dados); if (r.dados.length < 50) break;
  }
  return out;
}
export const urlArquivo = (id: Id, doc: number) => `${BASE}${caminho(id)}/arquivos/${doc}`;

/** O PNCP entrega o documento como PDF, ZIP ou outro formato: o tipo vem do conteúdo (assinatura do arquivo), não do título. */
export function tipoArquivo(dados: ArrayBuffer, disp: string | null) {
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
