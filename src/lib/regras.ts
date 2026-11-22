import type { Tx } from './db';
import type { Sessao } from './sessao';

export class Recusa extends Error { constructor(public status: number, msg: string, public extra: Record<string, unknown> = {}) { super(msg); } }
// comparação independente da ordem das chaves (o jsonb do Postgres reordena as chaves dos objetos)
const canon = (v: any): any => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o: any, k) => { if (v[k] !== undefined) o[k] = canon(v[k]); return o; }, {}) : v;
const eq = (a: unknown, b: unknown) => JSON.stringify(canon(a ?? null)) === JSON.stringify(canon(b ?? null));
const limpa = (o: any) => { if (o && typeof o === 'object') { const c = { ...o }; delete c._rev; return c; } return o; };

async function perms(tx: Tx, s: Sessao, emp: string): Promise<string[]> {
  const r = await tx`select permissoes from vinculos v join empresas e on e.id = v.empresa_id where v.usuario_id = ${s.efetivo.id} and v.empresa_id = ${emp} and e.autorizacao_operacional`;
  return (r[0]?.permissoes as string[]) || [];
}
const exige = (p: string[], quais: string[], acao: string) => { if (!quais.some((q) => p.includes(q))) throw new Recusa(403, `Seu perfil não tem permissão para ${acao}.`); };
async function designados(tx: Tx, emp: string) { return (await tx`select p.slug from designados d join perfis p on p.id = d.usuario_id where d.empresa_id = ${emp}`).map((r) => r.slug as string); }
async function auditar(tx: Tx, s: Sessao, emp: string | null, entidade: string, chave: string, acao: string, versao: number | null, resumo: unknown, justificativa?: string) {
  await tx`insert into auditoria (usuario_id, atuando_como, empresa_id, entidade, chave, acao, versao, justificativa, resumo)
           values (${s.real.id}, ${s.modoDemo ? s.efetivo.id : null}, ${emp}, ${entidade}, ${chave}, ${acao}, ${versao}, ${justificativa || null}, ${tx.json((resumo ?? null) as any)})`;
}
export { auditar, perms, exige };

/* ------------------------------------------------------------------ lote de participação */
const CAMPOS_OPERACAO = ['et', 'prazo', 'acao', 'comp', 'prep', 'lances', 'ofertado', 'compEnvio', 'refSessao', 'refPreco', 'res', 'pos', 'of', 'oficial', 'hist', 'mot', 'resp', 'vv'];
export async function syncLote(tx: Tx, s: Sessao, chave: string, rev: number, novo: any) {
  const [emp, crt, nTxt] = chave.split('|'); const n = Number(nTxt);
  const p = await perms(tx, s, emp); const eu = s.efetivo.slug;
  if (!p.length) throw new Recusa(404, 'Lote não encontrado no seu escopo.');
  if (!p.some((x) => x !== 'consultar')) throw new Recusa(403, 'Seu perfil permite apenas consultar esta empresa.');
  const row = (await tx`select l.* from participacao_lotes l join participacoes p on p.id = l.participacao_id where p.empresa_id = ${emp} and p.certame_id = ${crt} and l.n = ${n} for update of l`)[0];
  if (!row) throw new Recusa(404, 'Lote não encontrado no seu escopo.');
  novo = limpa(novo);
  if (row.rev !== rev) {
    const ua = (row.estado.orc?.vers || []).slice(-1)[0], ub = (novo.orc?.vers || []).slice(-1)[0];
    if (ua && ub && ua.v !== ub.v) throw new Recusa(409, `Os números mudaram: a versão em análise agora é a v${ua.v}. Revise a versão atual antes de votar.`);
    if (ua && ub && !eq(ua.m, ub.m)) throw new Recusa(409, `Os números mudaram: a versão v${ua.v} foi substituída enquanto você analisava. Revise antes de votar.`);
    throw new Recusa(409, 'Este lote foi alterado por outra pessoa. Os dados foram recarregados; revise antes de continuar.');
  }
  const antigo = row.estado;
  const mudou = Array.from(new Set([...Object.keys(antigo), ...Object.keys(novo)])).filter((k) => !eq(antigo[k], novo[k]));
  if (!mudou.length) return { rev: row.rev };
  let justificativa: string | undefined;
  for (const k of mudou) {
    if (k === 'dec' || k === 'decisao') { exige(p, ['decidir'], 'decidir a participação'); }
    else if (k === 'orc') await regrasOrcamento(tx, p, eu, emp, antigo.orc || {}, novo.orc || {});
    else if (k === 'recon') await regrasReconfirmacao(tx, p, eu, emp, antigo.recon, novo.recon, novo);
    else if (k === 'delib') { /* espelho da deliberação; validado em orc */ }
    else if (CAMPOS_OPERACAO.includes(k) || k === 'hv' || k === 'hd' || k === 'rd') exige(p, ['preparar', 'juridico', 'preco', 'decidir', 'aprovar'], 'atualizar a operação do lote');
    else exige(p, ['preparar'], 'alterar este lote');
  }
  if (mudou.includes('decisao') && novo.decisao && (!antigo.decisao || !eq(antigo.decisao, novo.decisao))) {
    if (!String(novo.decisao.just || '').trim()) throw new Recusa(422, 'A justificativa da decisão é obrigatória.');
    justificativa = novo.decisao.just;
    await tx`insert into decisoes (empresa_id, certame_id, n, decisao, justificativa, condicionantes, versao_analise, reaberta, por)
             values (${emp}, ${crt}, ${n}, ${novo.dec}, ${novo.decisao.just}, ${novo.decisao.cond || null}, ${novo.decisao.v || null}, ${!!antigo.decisao}, ${s.efetivo.id})`;
  }
  const num = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v));
  const r2 = await tx`update participacao_lotes set estado = ${tx.json(novo)}, decisao = ${novo.dec ?? null}, etapa = ${novo.et ?? null}, resultado = ${novo.res ?? null},
      responsavel = ${novo.resp ?? null}, prazo = ${novo.prazo || null}, oferta = ${num(novo.of)}, valor_homologado = ${num(novo.hv)}, data_homologacao = ${novo.hd || null},
      rev = rev + 1, atualizado_em = now(), atualizado_por = ${s.efetivo.id}
      where participacao_id = ${row.participacao_id} and n = ${n} returning rev`;
  if (!r2.length) throw new Recusa(403, 'Sem permissão de escrita nesta empresa.');
  await auditar(tx, s, emp, 'participacao_lote', chave, 'alterar', r2[0].rev, { campos: mudou }, justificativa);
  return { rev: r2[0].rev as number };
}

async function regrasOrcamento(tx: Tx, p: string[], eu: string, emp: string, a: any, b: any) {
  const va: any[] = a.vers || [], vb: any[] = b.vers || [];
  if (vb.length < va.length) throw new Recusa(422, 'Versões de orçamento não podem ser apagadas.');
  const des = await designados(tx, emp);
  for (let i = 0; i < va.length; i++) {
    const x = va[i], y = vb[i];
    const { votos: vx, st: sx, ...rx } = x; const { votos: vy, st: sy, ...ry } = y;
    if (!eq(rx, ry)) throw new Recusa(422, `A versão ${x.v} do orçamento é imutável; crie uma nova versão.`);
    const novos = Object.keys(vy || {}).filter((u) => !eq((vx || {})[u], (vy || {})[u]));
    for (const u of novos) {
      if (u !== eu) throw new Recusa(403, 'Cada parte registra apenas a própria manifestação.');
      if (!des.includes(eu)) throw new Recusa(403, 'Você não é parte designada para deliberar este orçamento.');
      const ultima = va[va.length - 1];
      if (!ultima || ultima.v !== x.v || ultima.st !== 'submetida') throw new Recusa(409, `Os números mudaram: a versão em análise agora é a v${ultima ? ultima.v : '?'}. Revise a versão atual antes de votar.`, { atual: ultima?.v });
    }
    if (sx !== sy) {
      if (sy === 'aprovada' && !des.every((d) => vy && vy[d] && vy[d].ok)) throw new Recusa(422, 'A aprovação exige a confirmação expressa de todos os designados sobre a mesma versão.');
      if (sy === 'aprovada' && x.mg != null && x.mg < 12 && !des.every((d) => String(vy[d].fund || '').trim())) throw new Recusa(422, 'Margem abaixo da mínima: cada designado precisa registrar o fundamento da exceção.');
    }
  }
  for (const y of vb.slice(va.length)) {
    if (y.st === 'cliente') exige(p, ['preparar', 'aprovar'], 'registrar o orçamento do cliente');
    else { exige(p, ['preparar'], 'submeter orçamento'); if (y.st !== 'submetida') throw new Recusa(422, 'Nova versão entra como submetida.'); if (Object.keys(y.votos || {}).length) throw new Recusa(422, 'Nova versão não pode nascer com votos.'); }
  }
  if (!eq(a.final, b.final)) exige(p, ['preco'], 'definir o preço final');
  if (!eq(a.finais, b.finais)) exige(p, ['preco'], 'definir o preço final');
  if (!eq(a.pisoLance, b.pisoLance) || !eq(a.pisoBy, b.pisoBy)) exige(p, ['decidir', 'preco'], 'definir o piso de lance');
  if (!eq(a.pos, b.pos)) exige(p, ['preparar', 'preco'], 'registrar o orçamento pós-disputa');
  if (!eq(a.m, b.m) || !eq(a.scen, b.scen)) exige(p, ['preparar'], 'editar a composição');
}

async function regrasReconfirmacao(tx: Tx, p: string[], eu: string, emp: string, a: any, b: any, lote: any) {
  if (b && (!a || a.v !== b.v)) { // abertura (ou nova versão após retificação): só quando o preço alcançado é estritamente menor que a referência
    exige(p, ['preparar', 'preco'], 'registrar o resultado da disputa');
    const pos = (lote.orc?.pos || []).slice(-1)[0];
    if (!pos || !(pos.preco < pos.refPreco)) throw new Recusa(422, 'A reconfirmação só abre quando o preço alcançado fica abaixo da referência aprovada.');
    if (Object.keys(b.votos || {}).length) throw new Recusa(422, 'Reconfirmação nova não pode nascer com votos.');
    return;
  }
  if (a && !b) { exige(p, ['preparar', 'preco'], 'atualizar a reconfirmação'); return; }
  if (!a || !b) return;
  const novos = Object.keys(b.votos || {}).filter((u) => !eq((a.votos || {})[u], (b.votos || {})[u]));
  for (const u of novos) {
    if (u !== eu) throw new Recusa(403, 'Cada parte registra apenas a própria manifestação.');
    if (!(a.parts || []).includes(eu)) throw new Recusa(403, 'Você não é parte designada para esta reconfirmação.');
    if (a.st !== 'pendente') throw new Recusa(409, 'Esta reconfirmação já foi concluída.');
  }
  if (b.st === 'ok' && !(b.parts || []).every((x: string) => b.votos?.[x]?.ok)) throw new Recusa(422, 'O preço só é reconfirmado com a confirmação de todas as partes.');
}

/* ------------------------------------------------------------------ demais entidades */
export async function syncDoc(tx: Tx, s: Sessao, id: string, rev: number, d: any) {
  d = limpa(d); const p = await perms(tx, s, d.emp); exige(p, ['preparar'], 'alterar o acervo de documentos');
  const old = (await tx`select * from acervo_documentos where id = ${id} for update`)[0];
  const vt = d.val === null ? 'sem' : d.val === 'desconhecida' ? 'desconhecida' : 'data';
  const val = vt === 'data' ? d.val : null;
  if (!old) {
    const r = await tx`insert into acervo_documentos (id, empresa_id, pasta, tipo, emissor, emissao, validade, validade_tipo, versao, arquivo_nome, arquivo_id, conferido, arquivado, modelo, tag, historico)
      values (${id}, ${d.emp}, ${d.pasta}, ${d.tipo}, ${d.emissor || null}, ${d.emi || null}, ${val}, ${vt}, ${d.v || 1}, ${d.arq || null}, ${d.arqId || null}, ${!!d.conf}, ${!!d.arqd}, ${d.modelo || null}, ${d.tag || null}, ${tx.json(d.hist || [])}) returning rev`;
    await auditar(tx, s, d.emp, 'acervo', id, 'incluir', 1, { tipo: d.tipo });
    return { rev: r[0].rev };
  }
  if (old.rev !== rev) throw new Recusa(409, 'O documento foi alterado por outra pessoa. Recarregamos a versão atual.');
  if (old.empresa_id !== d.emp) throw new Recusa(403, 'O titular do documento não pode ser trocado.');
  if ((d.hist || []).length < (old.historico || []).length) throw new Recusa(422, 'O histórico de versões é preservado e não pode ser apagado.');
  const r = await tx`update acervo_documentos set tipo = ${d.tipo}, emissor = ${d.emissor || null}, emissao = ${d.emi || null}, validade = ${val}, validade_tipo = ${vt}, versao = ${d.v},
     arquivo_nome = ${d.arq || null}, arquivo_id = ${d.arqId || null}, conferido = ${!!d.conf}, arquivado = ${!!d.arqd}, historico = ${tx.json(d.hist || [])}, rev = rev + 1 where id = ${id} returning rev`;
  await auditar(tx, s, d.emp, 'acervo', id, d.v !== old.versao ? 'renovar' : d.arqd && !old.arquivado ? 'arquivar' : 'alterar', d.v, null);
  return { rev: r[0].rev };
}

export async function syncContrato(tx: Tx, s: Sessao, id: string, rev: number, k: any) {
  const old = (await tx`select * from contratos where id = ${id} for update`)[0];
  if (!old) throw new Recusa(404, 'Contrato não encontrado no seu escopo.');
  if (old.rev !== rev) throw new Recusa(409, 'O contrato foi alterado por outra pessoa. Recarregamos os dados.');
  const p = await perms(tx, s, old.empresa_id); exige(p, ['preparar', 'financeiro', 'aprovar'], 'movimentar a execução do contrato');
  const atuais = new Set((await tx`select numero from notas_fiscais where contrato_id = ${id}`).map((r) => r.numero));
  for (const f of (k.nfs || []) as any[]) if (!atuais.has(f[0])) await tx`insert into notas_fiscais (contrato_id, empresa_id, numero, emissao, valor, quantidade_texto) values (${id}, ${old.empresa_id}, ${f[0]}, ${f[1]}, ${f[2]}, ${f[3] || null}) on conflict (contrato_id, numero) do nothing`;
  const r = await tx`update contratos set execucao = ${tx.json(k.exec || {})}, rev = rev + 1 where id = ${id} returning rev`;
  await auditar(tx, s, old.empresa_id, 'contrato', id, 'execucao', r[0].rev, null);
  return { rev: r[0].rev };
}

export async function syncAta(tx: Tx, s: Sessao, id: string, rev: number, a: any) {
  const old = (await tx`select * from atas where id = ${id} for update`)[0];
  if (!old) throw new Recusa(404, 'Ata não encontrada.'); if (old.rev !== rev) throw new Recusa(409, 'A ata foi alterada por outra pessoa.');
  const p = await perms(tx, s, old.empresa_id); exige(p, ['preparar'], 'alterar a ata');
  const { id: _i, emp: _e, crt: _c, num: _n, ini: _ini, fim: _f, item: _it, un: _u, reg: _r, preco: _p, _rev, ...dados } = a;
  const r = await tx`update atas set dados = ${tx.json(dados)}, rev = rev + 1 where id = ${id} returning rev`;
  await auditar(tx, s, old.empresa_id, 'ata', id, 'alterar', r[0].rev, null);
  return { rev: r[0].rev };
}

export async function syncMinuta(tx: Tx, s: Sessao, chave: string, rev: number, vs: any[]) {
  const [emp, crt, tipo] = chave.split('|'); const p = await perms(tx, s, emp); exige(p, ['preparar', 'juridico'], 'editar minutas');
  const old = (await tx`select * from minutas where empresa_id = ${emp} and certame_id = ${crt} and tipo = ${tipo} for update`)[0];
  vs = Array.from(vs);
  if (!old) { const r = await tx`insert into minutas (empresa_id, certame_id, tipo, versoes) values (${emp}, ${crt}, ${tipo}, ${tx.json(vs)}) returning rev`; await auditar(tx, s, emp, 'minuta', chave, 'incluir', vs.length, null); return { rev: r[0].rev }; }
  if (old.rev !== rev) throw new Recusa(409, 'A minuta foi alterada por outra pessoa.');
  const ant: any[] = old.versoes;
  if (vs.length < ant.length) throw new Recusa(422, 'Versões de minuta são preservadas.');
  ant.forEach((v, i) => { const { prot: a1, ...x } = v; const { prot: b1, ...y } = vs[i]; if (!eq(x, y)) throw new Recusa(422, `A versão ${v.v} da minuta é imutável; salve uma nova versão.`); });
  const r = await tx`update minutas set versoes = ${tx.json(vs)}, rev = rev + 1 where empresa_id = ${emp} and certame_id = ${crt} and tipo = ${tipo} returning rev`;
  await auditar(tx, s, emp, 'minuta', chave, vs.some((v, i) => v.prot && !(ant[i] || {}).prot) ? 'protocolar' : 'nova_versao', vs.length, null);
  return { rev: r[0].rev };
}

export async function syncNfRec(tx: Tx, s: Sessao, id: string, rev: number, r: any) {
  const old = (await tx`select * from nf_recepcoes where id = ${id} for update`)[0];
  if (!old) throw new Recusa(404, 'Recepção não encontrada.'); if (old.rev !== rev) throw new Recusa(409, 'A nota foi alterada por outra pessoa.');
  const p = await perms(tx, s, old.empresa_id); exige(p, ['preparar', 'financeiro'], 'montar o kit de obrigações');
  const rr = await tx`update nf_recepcoes set kit = ${tx.json(r.kit ?? null)}, rev = rev + 1 where id = ${id} returning rev`;
  await auditar(tx, s, old.empresa_id, 'nf_recepcao', id, 'kit', rr[0].rev, null);
  return { rev: rr[0].rev };
}

export async function syncPacote(tx: Tx, s: Sessao, chave: string, p: any) {
  const [emp, crt, v] = chave.split('|'); const pm = await perms(tx, s, emp); exige(pm, ['preparar'], 'registrar a apresentação do pacote');
  const old = (await tx`select * from pacotes where empresa_id = ${emp} and certame_id = ${crt} and versao = ${Number(v)}`)[0];
  if (!old) throw new Recusa(404, 'Pacote não encontrado.');
  if (!eq(old.itens, p.items)) throw new Recusa(422, 'O conteúdo de um pacote gerado é imutável; gere nova versão.');
  await tx`update pacotes set apresentado_em = ${p.apres || null}, comprovante = ${p.comp || null}, irregularidade = ${p.irr || null} where id = ${old.id}`;
  await auditar(tx, s, emp, 'pacote', chave, 'apresentacao', Number(v), null);
  return { rev: 1 };
}

export async function syncAnalise(tx: Tx, s: Sessao, chave: string, rev: number, itens: any[]) {
  const [emp, crt, n] = chave.split('|'); const p = await perms(tx, s, emp); exige(p, ['preparar'], 'revisar a análise de exigências');
  const old = (await tx`select * from analises where empresa_id = ${emp} and certame_id = ${crt} and n = ${Number(n)} for update`)[0];
  itens = Array.from(itens);
  if (!old && !(await tx`select 1 from participacoes where empresa_id = ${emp} and certame_id = ${crt}`).length) throw new Recusa(404, 'Processo fora do escopo desta empresa.');
  if (!old) { const r = await tx`insert into analises (empresa_id, certame_id, n, itens) values (${emp}, ${crt}, ${Number(n)}, ${tx.json(itens)}) returning rev`; return { rev: r[0].rev }; }
  if (old.rev !== rev) throw new Recusa(409, 'A análise foi alterada por outra pessoa.');
  const r = await tx`update analises set itens = ${tx.json(itens)}, rev = rev + 1 where empresa_id = ${emp} and certame_id = ${crt} and n = ${Number(n)} returning rev`;
  await auditar(tx, s, emp, 'analise', chave, 'alterar', r[0].rev, null);
  return { rev: r[0].rev };
}

export async function syncCertDocs(tx: Tx, s: Sessao, crt: string, docs: any[]) {
  const emp = (await tx`select empresa_id from participacoes where certame_id = ${crt} limit 1`)[0]?.empresa_id;
  if (!emp) throw new Recusa(404, 'Certame fora do seu escopo.');
  const p = await perms(tx, s, emp); exige(p, ['preparar'], 'registrar documentos do edital');
  const atuais = await tx`select nome, versao from certame_documentos where certame_id = ${crt}`;
  const tem = new Set(atuais.map((d) => d.nome + '|' + d.versao));
  for (const d of Array.from(docs)) if (!tem.has(d.nome + '|' + d.v)) {
    await tx`insert into certame_documentos (certame_id, nome, versao, publicado, paginas, retificacao, arquivo_id, enviado_por_empresa) values (${crt}, ${d.nome}, ${d.v}, ${d.d || null}, ${d.pg || null}, ${!!d.ret}, ${d.arqId || null}, ${emp})`;
    await auditar(tx, s, emp, 'documento_edital', crt, d.ret ? 'retificacao' : 'versao', d.v, { nome: d.nome });
  }
  return { rev: 1 };
}
