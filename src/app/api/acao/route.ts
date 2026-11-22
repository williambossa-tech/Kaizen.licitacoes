import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { Recusa, perms, exige, auditar } from '@/lib/regras';
import type { Tx } from '@/lib/db';
import type { Sessao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* importação de edital: idempotente por órgão + número; um certame já existente só ganha a participação da empresa */
async function importar(tx: Tx, s: Sessao, b: any) {
  const emp = String(b.emp); exige(await perms(tx, s, emp), ['preparar'], 'importar editais');
  const grupos: any[] = b.grupos || []; const criados: string[] = []; const ignorados: string[] = []; let erros = 0;
  for (const g of grupos) {
    const o = g.linhas[0];
    const ok = UFS.includes(o.uf) && /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?$/.test(o.ses) && !isNaN(Date.parse(o.ses.slice(0, 10))) && g.linhas.every((x: any) => Number(x.q) > 0 && x.desc);
    if (!ok) { erros++; continue; }
    const ex = (await tx`select id from certames where lower(orgao) = lower(${o.org}) and numero = ${o.num}`)[0]
      ?? (await tx`select c.id from certames c where lower(c.orgao) = lower(${o.org}) and c.numero = ${o.num}`)[0];
    let id: string;
    if (ex) id = ex.id;
    else {
      const dup = await tx`select 1 from participacoes p join certames c on c.id = p.certame_id where p.empresa_id = ${emp} and lower(c.orgao) = lower(${o.org}) and c.numero = ${o.num}`;
      if (dup.length) { ignorados.push(o.num); continue; }
      id = `CRT-${o.uf}-${Date.now().toString().slice(-6)}${criados.length}`;
      const ses = o.ses.length > 10 ? o.ses.replace(' ', 'T') : o.ses + 'T10:00';
      await tx`insert into certames (id, orgao, unidade, sede_uf, exec_ufs, numero, modalidade, objeto, publicacao, sessao, situacao_oficial, portal, fonte)
               values (${id}, ${o.org}, ${o.unid || null}, ${o.uf}, ${[o.uf]}, ${o.num}, ${o.mod || 'Pregão eletrônico'}, ${o.obj}, ${b.hoje}, ${ses}, 'Publicado, aguardando sessão pública', ${o.link || null}, ${'Importação CSV por ' + s.efetivo.nome})`;
      for (const x of g.linhas) await tx`insert into certame_lotes (certame_id, n, descricao, quantidade, unidade, ufs, valor_referencia) values (${id}, ${Number(x.lote)}, ${x.desc}, ${Number(x.q)}, ${x.un || 'un'}, ${[o.uf]}, ${Number(x.ref) || 0})`;
    }
    const temPart = await tx`select id from participacoes where empresa_id = ${emp} and certame_id = ${id}`;
    if (temPart.length) { ignorados.push(o.num); continue; }
    const pid = (await tx`insert into participacoes (empresa_id, certame_id, projeto) values (${emp}, ${id}, ${b.proj || null}) returning id`)[0].id;
    const lotes = await tx`select n from certame_lotes where certame_id = ${id}`;
    for (const l of lotes) {
      const estado = { dec: 'pendente', et: 'Em análise preliminar', resp: 'ana', prazo: b.prazo, acao: 'Concluir análise preliminar', hist: [{ et: 'Prospectada', d: b.hoje, by: 'Importação CSV' }, { et: 'Em análise preliminar', d: b.hoje, by: s.efetivo.nome }] };
      await tx`insert into participacao_lotes (participacao_id, empresa_id, certame_id, n, estado, decisao, etapa, responsavel, prazo) values (${pid}, ${emp}, ${id}, ${l.n}, ${tx.json(estado)}, 'pendente', 'Em análise preliminar', 'ana', ${b.prazo})`;
    }
    criados.push(id);
  }
  await tx`insert into importacoes (empresa_id, por, licitacoes, erros, linhas) values (${emp}, ${s.efetivo.id}, ${criados.length}, ${erros + (b.errosPrevia || 0)}, ${tx.json(grupos)})`;
  await auditar(tx, s, emp, 'importacao', criados.join(',') || '-', 'importar', null, { criados, ignorados, erros });
  return { criados, ignorados, erros };
}

/* pacote da participação: o servidor copia as versões vigentes no acervo naquele momento */
async function pacote(tx: Tx, s: Sessao, b: any) {
  const emp = String(b.emp); exige(await perms(tx, s, emp), ['preparar'], 'montar pacotes de habilitação');
  if (!(await tx`select 1 from participacoes where empresa_id = ${emp} and certame_id = ${b.crt}`).length) throw new Recusa(404, 'Participação não encontrada.');
  const ids: string[] = b.ids || [];
  const docs = await tx`select * from acervo_documentos where empresa_id = ${emp} and id = any(${ids}) and not arquivado`;
  if (docs.length !== ids.length) throw new Recusa(422, 'Há documentos que não pertencem a esta empresa ou foram arquivados.');
  const itens = docs.map((d) => ({ id: d.id, pasta: d.pasta, tipo: d.tipo, v: d.versao, val: d.validade_tipo === 'sem' ? null : d.validade_tipo === 'desconhecida' ? 'desconhecida' : d.validade, emi: d.emissao, arq: d.arquivo_nome, arqId: d.arquivo_id, modelo: d.modelo }));
  const v = ((await tx`select max(versao) m from pacotes where empresa_id = ${emp} and certame_id = ${b.crt}`)[0].m || 0) + 1;
  await tx`insert into pacotes (empresa_id, certame_id, versao, gerado_em, gerado_por, itens, irregularidade) values (${emp}, ${b.crt}, ${v}, ${b.hoje}, ${s.efetivo.nome}, ${tx.json(itens)}, ${b.irr || null})`;
  await auditar(tx, s, emp, 'pacote', `${emp}|${b.crt}|${v}`, 'gerar', v, { arquivos: itens.length });
  return { v, items: itens, d: b.hoje, by: s.efetivo.nome };
}

/* recepção da nota fiscal: idempotente por contrato + número; nenhum recibo se a gravação falhar */
async function recepcionar(tx: Tx, s: Sessao, b: any) {
  const k = (await tx`select * from contratos where id = ${b.ctr}`)[0]; if (!k) throw new Recusa(404, 'Contrato não encontrado no seu escopo.');
  exige(await perms(tx, s, k.empresa_id), ['preparar', 'financeiro'], 'recepcionar notas fiscais');
  const ex = (await tx`select * from nf_recepcoes where contrato_id = ${b.ctr} and numero = ${b.num}`)[0];
  if (ex) return { recuperado: true, id: ex.id };
  if (b.simularFalha) throw new Recusa(500, `Falha ao gravar a nota ${b.num}: nenhum recibo foi emitido. Corrija e envie de novo.`);
  const n = ((await tx`select count(*)::int c from nf_recepcoes`)[0].c || 0) + 1;
  const id = 'REC-' + String(n).padStart(4, '0') + '-' + Date.now().toString(36).slice(-4).toUpperCase();
  const r = (await tx`insert into nf_recepcoes (id, empresa_id, contrato_id, numero, valor, apresentacao, arquivo_id) values (${id}, ${k.empresa_id}, ${b.ctr}, ${b.num}, ${Number(b.v) || null}, ${b.apres || null}, ${b.arqId || null}) returning *`)[0];
  await auditar(tx, s, k.empresa_id, 'nf_recepcao', id, 'recepcionar', 1, { numero: b.num });
  return { recuperado: false, id, dh: String(r.recebido_em).slice(0, 16).replace('T', ' ') };
}

export async function POST(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada. Entre novamente.');
  const b = await req.json().catch(() => null); if (!b) return jsonErro(400, 'Requisição inválida.');
  try {
    const r = await comPerfil(s.efetivo.id, async (tx) => {
      if (b.acao === 'importar') return importar(tx, s, b);
      if (b.acao === 'pacote') return pacote(tx, s, b);
      if (b.acao === 'nf_recepcionar') return recepcionar(tx, s, b);
      if (b.acao === 'abrir_recepcao') { const r = (await tx`select id, empresa_id from nf_recepcoes where id = ${String(b.id).toUpperCase()}`)[0]; if (!r) throw new Recusa(403, `Acesso negado ou registro inexistente: ${s.efetivo.nome} não pode abrir este registro.`); return { id: r.id }; }
      if (b.acao === 'visao') { await tx`insert into visoes (usuario_id, nome, config) values (${s.efetivo.id}, ${String(b.nome).slice(0, 120)}, ${tx.json(b.config || {})})`; return {}; }
      throw new Recusa(400, 'Ação desconhecida.');
    });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof Recusa) return jsonErro(e.status, e.message, e.extra);
    console.error('acao', b.acao, e); return jsonErro(500, 'Falha ao executar a ação: ' + String((e as Error).message).slice(0, 160));
  }
}
