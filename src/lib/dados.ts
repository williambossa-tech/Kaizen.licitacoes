import type { Tx } from './db';
import type { Sessao } from './sessao';

/** Monta, sob RLS, o conjunto de dados que as telas usam, no mesmo formato validado nos templates. */
export async function carregar(tx: Tx, s: Sessao) {
  const emps = await tx`select * from empresas order by id`;
  const EMP: Record<string, unknown> = {};
  const autorizadas = emps.filter((e) => e.autorizacao_operacional);
  const meus = await tx`select empresa_id, permissoes from vinculos where usuario_id = ${s.efetivo.id}`;
  const minhas = new Set(meus.map((v) => v.empresa_id as string));
  for (const e of autorizadas) if (minhas.has(e.id)) EMP[e.id] = { nome: e.razao_social, curto: e.nome_curto, cnpj: e.cnpj, semCob: e.ufs_sem_cobertura, proj: e.projetos };

  const perfis = await tx`select p.slug, p.nome, p.papel, p.demo, p.consolida, v.empresa_id, v.permissoes from perfis p join vinculos v on v.usuario_id = p.id order by p.criado_em, p.slug`;
  const USERS: Record<string, any> = {};
  for (const r of perfis) {
    const u = USERS[r.slug] ||= { nome: r.nome, papel: r.papel, emp: [], perm: [], pe: {}, cons: r.consolida, demo: r.demo };
    if (!EMP[r.empresa_id] && r.slug !== s.efetivo.slug) continue;
    u.emp.push(r.empresa_id); u.pe[r.empresa_id] = r.permissoes;
    for (const p of r.permissoes) if (!u.perm.includes(p)) u.perm.push(p);
  }
  USERS[s.efetivo.slug].emp = USERS[s.efetivo.slug].emp.filter((e: string) => EMP[e]);
  for (const k of Object.keys(USERS)) if (!USERS[k].emp.length && k !== s.efetivo.slug) delete USERS[k];
  const DESIG: Record<string, string[]> = {};
  for (const r of await tx`select d.empresa_id, p.slug from designados d join perfis p on p.id = d.usuario_id`) (DESIG[r.empresa_id] ||= []).push(r.slug);

  const certs = await tx`select * from certames order by id`;
  const lotes = await tx`select * from certame_lotes order by certame_id, n`;
  const CRT = certs.map((c) => ({
    id: c.id, org: c.orgao, un: c.unidade, sede: c.sede_uf, exec: c.exec_ufs, num: c.numero, obj: c.objeto, pub: c.publicacao, ses: c.sessao,
    enc: c.encerramento_tipo ? { t: c.encerramento_tipo, d: c.encerramento_data } : null, sit: c.situacao_oficial, mod: c.modalidade, crit: c.criterio,
    portal: c.portal, pncp: c.id_externo || undefined, cancel: c.cancelado || undefined, src: c.fonte === 'Adaptador de demonstração' ? undefined : c.fonte,
    lotes: lotes.filter((l) => l.certame_id === c.id).map((l) => ({ n: l.n, d: l.descricao, q: l.quantidade, u: l.unidade, uf: l.ufs == null ? null : l.ufs.length === 1 ? l.ufs[0] : l.ufs, ref: l.valor_referencia }))
  }));
  const DOCS: Record<string, any[]> = {};
  for (const d of await tx`select * from certame_documentos order by certame_id, nome, versao`) (DOCS[d.certame_id] ||= []).push({ nome: d.nome, v: d.versao, d: d.publicado, pg: d.paginas, ret: d.retificacao || undefined, arqId: d.arquivo_id || undefined });
  const RES: Record<string, any> = {};
  const linhas = await tx`select * from resultado_linhas order by certame_id, n, ordem`;
  for (const r of await tx`select * from resultados`) RES[`${r.certame_id}-L${r.n}`] = { cob: r.cobertura, prov: r.provisorio, fonte: r.fonte, rows: linhas.filter((x) => x.certame_id === r.certame_id && x.n === r.n).map((x) => [x.posicao, x.fornecedor, x.situacao, x.oferta_inicial, x.melhor_oferta, x.valor_aceito, x.motivo || '']) };

  const parts = await tx`select * from participacoes order by criado_em, certame_id`;
  const plotes = await tx`select * from participacao_lotes`;
  const PART = parts.map((p) => {
    const L: Record<string, any> = {};
    for (const l of plotes.filter((x) => x.participacao_id === p.id)) L[l.n] = { ...l.estado, _rev: l.rev };
    return { emp: p.empresa_id, crt: p.certame_id, proj: p.projeto, L };
  });
  const REQ: Record<string, any> = {}; const REQMETA: Record<string, any> = {};
  for (const a of await tx`select * from analises`) { const k = `${a.certame_id}|${a.n}`; if (!REQ[k] || a.empresa_id === Object.keys(EMP)[0]) { REQ[k] = a.itens; REQMETA[k] = { emp: a.empresa_id, rev: a.rev }; } }
  const DECS = (await tx`select d.*, p.slug from decisoes d left join perfis p on p.id = d.por order by em`).map((d) => ({ crt: d.certame_id, n: d.n, dec: d.decisao, by: d.slug, d: String(d.em).slice(0, 10), reab: d.reaberta }));

  const ACV = (await tx`select * from acervo_documentos order by id`).map((d) => ({
    id: d.id, emp: d.empresa_id, pasta: d.pasta, tipo: d.tipo, emissor: d.emissor, emi: d.emissao,
    val: d.validade_tipo === 'sem' ? null : d.validade_tipo === 'desconhecida' ? 'desconhecida' : d.validade,
    v: d.versao, arq: d.arquivo_nome, arqId: d.arquivo_id || undefined, conf: d.conferido, arqd: d.arquivado, modelo: d.modelo || undefined, tag: d.tag || undefined, hist: d.historico, _rev: d.rev
  }));
  const PKG: Record<string, any[]> = {};
  for (const p of await tx`select * from pacotes order by versao`) (PKG[`${p.empresa_id}|${p.certame_id}`] ||= []).push({ v: p.versao, d: p.gerado_em, by: p.gerado_por, items: p.itens, irr: p.irregularidade || '', apres: p.apresentado_em, comp: p.comprovante });
  const MIN: Record<string, any> = {}; const MINMETA: Record<string, number> = {};
  for (const m of await tx`select * from minutas`) { const k = `${m.empresa_id}|${m.certame_id}|${m.tipo}`; MIN[k] = m.versoes; MINMETA[k] = m.rev; }
  const IMPLOG = (await tx`select i.*, p.nome from importacoes i left join perfis p on p.id = i.por order by em`).map((i) => ({ d: String(i.em).slice(0, 10), n: i.licitacoes, e: i.erros, u: i.nome, emp: i.empresa_id }));

  const ctrs = await tx`select * from contratos order by id`;
  const nfs = await tx`select * from notas_fiscais order by emissao, numero`;
  const recs = await tx`select * from recebimentos order by data`;
  const dres = await tx`select * from dre_competencias order by competencia`;
  const CTR = ctrs.map((k) => ({
    id: k.id, emp: k.empresa_id, crt: k.certame_id, lote: k.lote, num: k.numero, inst: k.instrumento, ass: k.assinatura, fim: k.fim, v: k.valor, q: k.quantidade, u: k.unidade, mprev: k.margem_prevista,
    nfs: nfs.filter((f) => f.contrato_id === k.id).map((f) => [f.numero, f.emissao, f.valor, f.quantidade_texto]),
    rec: recs.filter((r) => r.contrato_id === k.id).map((r) => [r.data, r.valor, r.titulo || '']),
    dre: dres.filter((r) => r.contrato_id === k.id).map((r) => [r.competencia, r.receita_bruta, r.receita_liquida, r.resultado]),
    exec: k.execucao, _rev: k.rev
  }));
  const LANC: Record<string, any[]> = {};
  for (const l of await tx`select * from lancamentos order by id`) (LANC[l.contrato_id] ||= []).push({ id: l.id, c: l.competencia, g: l.grupo, v: l.valor, desc: l.descricao, doc: l.documento });
  const ANT: Record<string, any> = {};
  for (const a of await tx`select * from antecipacoes`) ANT[`${a.contrato_id}|${a.nf_numero}`] = { d: a.data, principal: a.principal, liquido: a.liquido, custo: a.custo, fundo: a.fundo, liq: a.liquidacao };
  const ATAS = (await tx`select * from atas order by id`).map((a) => ({ id: a.id, emp: a.empresa_id, crt: a.certame_id, num: a.numero, ini: a.inicio, fim: a.fim, item: a.item, un: a.unidade, reg: a.registrado, preco: a.preco, ...a.dados, _rev: a.rev }));
  const REC = (await tx`select * from nf_recepcoes order by recebido_em`).map((r) => ({ id: r.id, num: r.numero, ctr: r.contrato_id, emp: r.empresa_id, v: r.valor, apres: r.apresentacao, dh: String(r.recebido_em).slice(0, 16).replace('T', ' '), arqId: r.arquivo_id || undefined, kit: r.kit, _rev: r.rev }));
  const VIEWS = (await tx`select nome, config from visoes where usuario_id = ${s.efetivo.id} order by criado_em`).map((v) => ({ nome: v.nome, ...v.config }));
  const empresasAdm = s.efetivo.admin ? emps.map((e) => ({ nome: e.razao_social, cnpj: e.cnpj, comercial: e.vinculo_comercial, societaria: e.participacao_societaria, autorizada: e.autorizacao_operacional })) : [];
  const perfisDemo = s.real.admin && process.env.DEMO_MODE === '1' ? (await tx`select slug, nome, papel from perfis where demo or id = ${s.real.id} order by criado_em, slug`) : [];

  return {
    eu: { slug: s.efetivo.slug, nome: s.efetivo.nome, papel: s.efetivo.papel, real: s.modoDemo ? { slug: s.real.slug, nome: s.real.nome } : null },
    demo: perfisDemo.map((p) => ({ slug: p.slug, nome: p.nome, papel: p.papel })),
    hoje: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
    EMP, USERS, DESIG, CRT, DOCS, RES, PART, REQ, REQMETA, MINMETA, DECS, ACV, PKG, MIN, IMPLOG, CTR, LANC, ANT, ATAS, REC, VIEWS, empresasAdm
  };
}
