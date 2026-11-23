/**
 * Dados cadastrais de empresa pelo CNPJ: consulta a bases públicas (BrasilAPI, Minha Receita e ReceitaWS, nessa ordem)
 * ou leitura de texto colado (comprovante de inscrição da Receita Federal ou ficha de outros sites).
 */
export interface Socio { nome: string; qual: string }
export interface Cadastro {
  cnpj: string; razao: string; fantasia: string; situacao: string; abertura: string; natureza: string; cnae: string; porte: string;
  logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string; cep: string;
  email: string; telefone: string; socios: Socio[]; fonte: string;
}

export const soDigitos = (s: string) => String(s || '').replace(/\D/g, '');
export function cnpjValido(c: string) {
  const d = soDigitos(c); if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += Number(d[i]) * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}
export const formatarCnpj = (c: string) => soDigitos(c).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const t = (v: unknown) => (v == null ? '' : String(v).trim());
const dataBr = (v: string) => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(8, 10) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) : v);
const tel = (v: string) => { const x = soDigitos(v); return x.length >= 10 ? `(${x.slice(0, 2)}) ${x.slice(2, -4)}-${x.slice(-4)}` : v; };

export function enderecoCompleto(c: Partial<Cadastro>) {
  const l1 = [c.logradouro, c.numero && c.numero !== 'SN' ? c.numero : c.numero === 'SN' ? 's/n' : ''].filter(Boolean).join(', ');
  return [l1, c.complemento, c.bairro, c.municipio && c.uf ? `${c.municipio}/${c.uf}` : c.municipio, c.cep ? 'CEP ' + soDigitos(c.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2') : ''].filter(Boolean).join(', ');
}
/** Primeira letra maiúscula em cada palavra (a Receita grava tudo em maiúsculas). */
export const capitalizar = (s: string) => s.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());

function deBrasilApi(d: any, fonte: string): Cadastro {
  return {
    cnpj: formatarCnpj(d.cnpj), razao: t(d.razao_social), fantasia: t(d.nome_fantasia), situacao: t(d.descricao_situacao_cadastral),
    abertura: dataBr(t(d.data_inicio_atividade)), natureza: t(d.natureza_juridica), cnae: [t(d.cnae_fiscal), t(d.cnae_fiscal_descricao)].filter(Boolean).join(' · '),
    porte: t(d.porte), logradouro: [t(d.descricao_tipo_de_logradouro) && !t(d.logradouro).startsWith(t(d.descricao_tipo_de_logradouro)) ? t(d.descricao_tipo_de_logradouro) : '', t(d.logradouro)].filter(Boolean).join(' '),
    numero: t(d.numero), complemento: t(d.complemento), bairro: t(d.bairro), municipio: t(d.municipio), uf: t(d.uf), cep: t(d.cep),
    email: t(d.email).toLowerCase(), telefone: tel(t(d.ddd_telefone_1)),
    socios: (d.qsa || []).map((s: any) => ({ nome: t(s.nome_socio), qual: t(s.qualificacao_socio) })).filter((s: Socio) => s.nome), fonte
  };
}
function deReceitaWs(d: any): Cadastro {
  return {
    cnpj: formatarCnpj(d.cnpj), razao: t(d.nome), fantasia: t(d.fantasia), situacao: t(d.situacao), abertura: t(d.abertura), natureza: t(d.natureza_juridica),
    cnae: d.atividade_principal?.[0] ? `${t(d.atividade_principal[0].code)} · ${t(d.atividade_principal[0].text)}` : '', porte: t(d.porte),
    logradouro: t(d.logradouro), numero: t(d.numero), complemento: t(d.complemento), bairro: t(d.bairro), municipio: t(d.municipio), uf: t(d.uf), cep: t(d.cep),
    email: t(d.email).toLowerCase(), telefone: t(d.telefone).split('/')[0].trim(),
    socios: (d.qsa || []).map((s: any) => ({ nome: t(s.nome), qual: t(s.qual).replace(/^\d+-/, '') })).filter((s: Socio) => s.nome), fonte: 'ReceitaWS'
  };
}

/** Consulta pública. Devolve o cadastro, "nao_encontrado" ou "indisponivel" (com o motivo de cada base). */
export async function consultarCnpj(cnpj: string): Promise<{ ok: true; dados: Cadastro } | { ok: false; situacao: 'nao_encontrado' | 'indisponivel'; detalhe: string }> {
  const d = soDigitos(cnpj); const motivos: string[] = []; let naoEncontrado = 0;
  const bases: [string, string, (x: any) => Cadastro | null][] = [
    ['BrasilAPI', `https://brasilapi.com.br/api/cnpj/v1/${d}`, (x) => (x?.cnpj ? deBrasilApi(x, 'BrasilAPI') : null)],
    ['Minha Receita', `https://minhareceita.org/${d}`, (x) => (x?.cnpj ? deBrasilApi(x, 'Minha Receita') : null)],
    ['ReceitaWS', `https://receitaws.com.br/v1/cnpj/${d}`, (x) => (x?.status === 'ERROR' ? null : x?.cnpj ? deReceitaWs(x) : null)]
  ];
  for (const [nome, url, conv] of bases) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'kaizen-b2g' }, signal: AbortSignal.timeout(12000) });
      if (r.status === 404 || r.status === 400) { naoEncontrado++; motivos.push(`${nome}: não encontrado`); continue; }
      if (!r.ok) { motivos.push(`${nome}: HTTP ${r.status}`); continue; }
      const c = conv(await r.json());
      if (c && c.razao) return { ok: true, dados: c };
      naoEncontrado++; motivos.push(`${nome}: não encontrado`);
    } catch (e) { motivos.push(`${nome}: ${(e as Error).name === 'TimeoutError' ? 'sem resposta' : 'falha de conexão'}`); }
  }
  return { ok: false, situacao: naoEncontrado === bases.length ? 'nao_encontrado' : 'indisponivel', detalhe: motivos.join(' · ') };
}

/* ---------- leitura de texto colado ---------- */
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
/** Rótulos do comprovante da Receita e de fichas comuns (Casa dos Dados, CNPJ.biz, Econodata etc.). */
const ROTULOS: [keyof Cadastro, RegExp][] = [
  ['razao', /^(NOME EMPRESARIAL|RAZAO SOCIAL)\b/],
  ['fantasia', /^(TITULO DO ESTABELECIMENTO|NOME DE FANTASIA|NOME FANTASIA)\b/],
  ['abertura', /^(DATA DE ABERTURA|DATA DA ABERTURA|ABERTURA|DATA DE INICIO DE ATIVIDADE)\b/],
  ['natureza', /^(CODIGO E DESCRICAO DA NATUREZA JURIDICA|NATUREZA JURIDICA)\b/],
  ['cnae', /^(CODIGO E DESCRICAO DA ATIVIDADE ECONOMICA PRINCIPAL|ATIVIDADE ECONOMICA PRINCIPAL|ATIVIDADE PRINCIPAL|CNAE PRINCIPAL)\b/],
  ['logradouro', /^(LOGRADOURO|ENDERECO(?! ELETRONICO))\b/],
  ['numero', /^(NUMERO)$/],
  ['complemento', /^(COMPLEMENTO)\b/],
  ['cep', /^(CEP)\b/],
  ['bairro', /^(BAIRRO\/DISTRITO|BAIRRO)\b/],
  ['municipio', /^(MUNICIPIO|CIDADE)\b/],
  ['uf', /^(UF|ESTADO)$/],
  ['email', /^(ENDERECO ELETRONICO|E-MAIL|EMAIL)\b/],
  ['telefone', /^(TELEFONE)\b/],
  ['situacao', /^(SITUACAO CADASTRAL)$/],
  ['porte', /^(PORTE)$/]
];
const rotuloDe = (linha: string) => { const s = sem(linha.split(':')[0]); return ROTULOS.find(([, re]) => re.test(s)); };

export function interpretarTexto(texto: string): Partial<Cadastro> & { cnpj?: string; lidos: string[] } {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out: any = { socios: [] as Socio[], lidos: [] as string[] };
  const m = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/.exec(texto); if (m && cnpjValido(m[1])) { out.cnpj = formatarCnpj(m[1]); out.lidos.push('CNPJ'); }
  for (let i = 0; i < linhas.length; i++) {
    const r = rotuloDe(linhas[i]); if (!r) continue;
    const [campo] = r; if (out[campo]) continue;
    const dois = linhas[i].indexOf(':');
    let v = dois >= 0 ? linhas[i].slice(dois + 1).trim() : '';
    if (!v) { const prox = linhas[i + 1]; if (prox && !rotuloDe(prox)) v = prox; }
    v = v.replace(/^\*+$/, '').trim(); if (!v || /^\*{3,}/.test(v)) continue;
    out[campo] = campo === 'email' ? v.toLowerCase() : v; out.lidos.push(campo);
  }
  // quadro de sócios e administradores (QSA): "Nome/Nome Empresarial: X" seguido de "Qualificação: Y"
  for (let i = 0; i < linhas.length; i++) {
    const s = sem(linhas[i]);
    if (/^NOME\/NOME EMPRESARIAL/.test(s) || /^(SOCIO|ADMINISTRADOR|NOME DO SOCIO)\b/.test(s)) {
      const nome = linhas[i].includes(':') ? linhas[i].slice(linhas[i].indexOf(':') + 1).trim() : linhas[i + 1] || '';
      const q = linhas.slice(i + 1, i + 4).find((l) => /^QUALIFICA/.test(sem(l)));
      if (nome && !rotuloDe(nome)) out.socios.push({ nome, qual: q ? q.slice(q.indexOf(':') + 1).trim().replace(/^\d+-/, '') : '' });
    }
  }
  if (out.socios.length) out.lidos.push('sócios');
  if (out.uf) out.uf = out.uf.slice(0, 2).toUpperCase();
  if (out.cep) out.cep = out.cep.replace(/[^\d.-]/g, '');
  return out;
}
