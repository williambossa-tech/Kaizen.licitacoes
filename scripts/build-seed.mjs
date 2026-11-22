// Gera supabase/seed/demo.sql a partir de supabase/seed/demo.json (os dados fictícios validados nos templates).
import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync(new URL('../supabase/seed/demo.json', import.meta.url)));
const q = v => v === null || v === undefined || v === '' && false ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const j = v => `${q(JSON.stringify(v ?? null))}::jsonb`;
const arr = a => a == null ? 'null' : `array[${a.map(q).join(',')}]::text[]`;
const out = ['-- Dados fictícios de demonstração (gerado por scripts/build-seed.mjs)', 'begin;'];
const ins = (t, cols, rows) => { if (rows.length) out.push(`insert into ${t} (${cols.join(',')}) values\n${rows.map(r => '(' + r.join(',') + ')').join(',\n')};`); };
const UID = {}; const slugs = Object.keys(D.USERS); slugs.forEach((s, i) => UID[s] = `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const EMAIL = { william: 'william.bossa@kaizenpartners.com.br' };
// empresas (inclui uma com participação societária sem autorização, para demonstrar que o vínculo societário não concede acesso)
ins('empresas', ['id', 'razao_social', 'nome_curto', 'cnpj', 'vinculo_comercial', 'participacao_societaria', 'autorizacao_operacional', 'ufs_sem_cobertura', 'projetos'], [
  ...Object.entries(D.EMP).map(([k, e]) => [q(k), q(e.nome), q(e.curto), q(e.cnpj), q(k === 'A' ? 'Cliente externo' : 'Ecossistema Kaizen'), q(k === 'B' ? '30%' : null), 'true', arr(e.semCob), j(e.proj)]),
  [q('G'), q('Gama Participações S.A.'), q('Gama Participações'), q('77.888.999/0001-10'), q('Nenhum'), q('15%'), 'false', arr([]), j({})]]);
ins('perfis', ['id', 'slug', 'nome', 'papel', 'email', 'demo', 'consolida'], slugs.map(s => { const u = D.USERS[s]; return [q(UID[s]), q(s), q(u.nome), q(u.papel), q(EMAIL[s] || `${s}@demo.kaizen-b2g.invalid`), String(s !== 'william'), String(!!u.cons)]; }));
ins('vinculos', ['usuario_id', 'empresa_id', 'permissoes'], slugs.flatMap(s => D.USERS[s].emp.map(e => [q(UID[s]), q(e), arr(D.USERS[s].perm)])));
ins('designados', ['empresa_id', 'usuario_id'], Object.entries(D.DESIG).flatMap(([e, us]) => us.map(u => [q(e), q(UID[u])])));
// certames e lotes
const ses = s => s ? q(s.replace('T', ' ') + ':00') : 'null';
ins('certames', ['id', 'orgao', 'unidade', 'sede_uf', 'exec_ufs', 'numero', 'modalidade', 'criterio', 'portal', 'objeto', 'publicacao', 'sessao', 'encerramento_tipo', 'encerramento_data', 'situacao_oficial', 'cancelado'],
  D.CRT.map(c => [q(c.id), q(c.org), q(c.un), q(c.sede), arr(c.exec), q(c.num), q(c.mod), q(c.crit), q(c.portal), q(c.obj), q(c.pub), ses(c.ses), q(c.enc ? c.enc.t : null), q(c.enc ? c.enc.d : null), q(c.sit), String(!!c.cancel)]));
ins('certame_lotes', ['certame_id', 'n', 'descricao', 'quantidade', 'unidade', 'ufs', 'valor_referencia'],
  D.CRT.flatMap(c => c.lotes.map(l => [q(c.id), l.n, q(l.d), l.q, q(l.u), l.uf == null ? 'null' : arr(Array.isArray(l.uf) ? l.uf : [l.uf]), l.ref])));
ins('certame_documentos', ['certame_id', 'nome', 'versao', 'publicado', 'paginas', 'retificacao'],
  Object.entries(D.DOCS).flatMap(([c, ds]) => ds.map(d => [q(c), q(d.nome), d.v, q(d.d), d.pg ?? 'null', String(!!d.ret)])));
const lid = k => { const i = k.lastIndexOf('-L'); return [k.slice(0, i), +k.slice(i + 2)]; };
ins('resultados', ['certame_id', 'n', 'fonte', 'cobertura', 'provisorio'], Object.entries(D.RES).map(([k, r]) => { const [c, n] = lid(k); return [q(c), n, q(r.fonte), q(r.cob), String(!!r.prov)]; }));
ins('resultado_linhas', ['certame_id', 'n', 'ordem', 'posicao', 'fornecedor', 'situacao', 'oferta_inicial', 'melhor_oferta', 'valor_aceito', 'motivo'],
  Object.entries(D.RES).flatMap(([k, r]) => { const [c, n] = lid(k); return r.rows.map((x, i) => [q(c), n, i + 1, x[0] ?? 'null', q(x[1]), q(x[2]), x[3] ?? 'null', x[4] ?? 'null', x[5] ?? 'null', q(x[6] || null)]); }));
// participações e lotes
ins('participacoes', ['empresa_id', 'certame_id', 'projeto'], D.PART.map(p => [q(p.emp), q(p.crt), q(p.proj)]));
const rows = [];
for (const p of D.PART) for (const [n, lp] of Object.entries(p.L)) rows.push([`(select id from participacoes where empresa_id=${q(p.emp)} and certame_id=${q(p.crt)})`, q(p.emp), q(p.crt), n, j(lp), q(lp.dec), q(lp.et), q(lp.res || null), q(lp.resp || null), q(lp.prazo || null), lp.of ?? 'null', lp.hv ?? 'null', q(lp.hd || null)]);
ins('participacao_lotes', ['participacao_id', 'empresa_id', 'certame_id', 'n', 'estado', 'decisao', 'etapa', 'resultado', 'responsavel', 'prazo', 'oferta', 'valor_homologado', 'data_homologacao'], rows);
const empOf = c => (D.PART.find(p => p.crt === c) || {}).emp;
ins('analises', ['empresa_id', 'certame_id', 'n', 'itens'], Object.entries(D.REQ).map(([k, v]) => { const [c, n] = k.split('|'); return [q(empOf(c)), q(c), +n, j(v)]; }));
// acervo e pacote histórico
ins('acervo_documentos', ['id', 'empresa_id', 'pasta', 'tipo', 'emissor', 'emissao', 'validade', 'validade_tipo', 'versao', 'arquivo_nome', 'conferido', 'arquivado', 'modelo', 'tag', 'historico'],
  D.ACV.map(d => [q(d.id), q(d.emp), q(d.pasta), q(d.tipo), q(d.emissor), q(d.emi), q(d.val && d.val !== 'desconhecida' ? d.val : null), q(d.val === null ? 'sem' : d.val === 'desconhecida' ? 'desconhecida' : 'data'), d.v, q(d.arq), String(d.conf), String(!!d.arqd), q(d.modelo || null), q(d.tag || null), j(d.hist)]));
ins('pacotes', ['empresa_id', 'certame_id', 'versao', 'gerado_em', 'gerado_por', 'itens', 'irregularidade', 'apresentado_em', 'comprovante'],
  Object.entries(D.PKG).flatMap(([k, ps]) => { const [e, c] = k.split('|'); return ps.map(p => [q(e), q(c), p.v, q(p.d), q(p.by), j(p.items), q(p.irr || null), q(p.apres || null), q(p.comp || null)]); }));
// contratos e financeiro
const execOf = k => D.GD[k.id] ? { goods: D.GD[k.id] } : { postos: D.PST[k.id] || null, ust: D.UST[k.id] || null, pf: D.PFD[k.id] || null, equipe: D.TEAM[k.id] || null, sla: D.SLA[k.id] || null };
ins('contratos', ['id', 'empresa_id', 'certame_id', 'lote', 'numero', 'instrumento', 'assinatura', 'fim', 'valor', 'quantidade', 'unidade', 'margem_prevista', 'execucao'],
  D.CTR.map(k => [q(k.id), q(k.emp), q(k.crt), k.lote, q(k.num), q(k.inst), q(k.ass), q(k.fim), k.v, k.q, q(k.u), k.mprev, j(execOf(k))]));
ins('notas_fiscais', ['contrato_id', 'empresa_id', 'numero', 'emissao', 'valor', 'quantidade_texto'], D.CTR.flatMap(k => k.nfs.map(f => [q(k.id), q(k.emp), q(f[0]), q(f[1]), f[2], q(f[3])])));
ins('recebimentos', ['contrato_id', 'empresa_id', 'data', 'valor', 'titulo'], D.CTR.flatMap(k => k.rec.map(r => [q(k.id), q(k.emp), q(r[0]), r[1], q(r[2] || null)])));
ins('dre_competencias', ['contrato_id', 'empresa_id', 'competencia', 'receita_bruta', 'receita_liquida', 'resultado'], D.CTR.flatMap(k => k.dre.map(r => [q(k.id), q(k.emp), q(r[0]), r[1], r[2], r[3]])));
ins('lancamentos', ['id', 'contrato_id', 'empresa_id', 'competencia', 'grupo', 'valor', 'descricao', 'documento'],
  Object.entries(D.LANC).flatMap(([cid, ls]) => ls.map(x => [q(x.id), q(cid), q(D.CTR.find(k => k.id === cid).emp), q(x.c), q(x.g), x.v, q(x.desc), q(x.doc)])));
ins('antecipacoes', ['contrato_id', 'empresa_id', 'nf_numero', 'data', 'principal', 'liquido', 'custo', 'fundo', 'liquidacao'], [[q('CTR-0105'), q('A'), q('NF 1.402'), q('2026-10-15'), 158400, 154000, 4400, q('FIDC Recebíveis Públicos (fictício)'), q('2026-11-09')]]);
ins('atas', ['id', 'empresa_id', 'certame_id', 'numero', 'inicio', 'fim', 'item', 'unidade', 'registrado', 'preco', 'dados'],
  D.ATAS.map(a => { const { id, emp, crt, num, ini, fim, item, un, reg, preco, ...rest } = a; return [q(id), q(emp), q(crt), q(num), q(ini), q(fim), q(item), q(un), reg, preco, j(rest)]; }));
out.push('commit;');
fs.writeFileSync(new URL('../supabase/seed/demo.sql', import.meta.url), out.join('\n\n') + '\n');
console.log('seed gerado:', out.length, 'blocos');
