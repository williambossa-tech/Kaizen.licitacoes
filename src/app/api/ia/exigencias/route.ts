import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { perms, auditar } from '@/lib/regras';
import { ler } from '@/lib/armazenamento';
import { extrair, type Parte } from '@/lib/textos';
import { sincronizarPncp, listarDocs } from '@/lib/docsPncp';
import { interpretar, historico } from '@/lib/pncp';
import { CHAVE_MODELO, escolherModelo } from '@/lib/ia';
import { CHAVE_PROMPT, PROMPT_PADRAO, GRUPOS, SITUACOES, montarFontes, corpoRequisicao, erroOpenAI } from '@/lib/exigencias';

export const dynamic = 'force-dynamic';
const PASTA: Record<string, string> = { jur: 'Regularidade jurídica', fis: 'Regularidade fiscal', eco: 'Econômico-financeira', tec: 'Qualificação técnica', dec: 'Declarações e modelos', out: 'Outros' };

/**
 * Gera a análise de exigências do lote com IA. Resposta em linhas JSON (uma por evento):
 * {t:'etapa', msg} durante o trabalho; {t:'fim', itens, meta, rev, docs} ao concluir; {t:'erro', msg} em falha.
 */
export async function POST(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  const b = await req.json().catch(() => null);
  const emp = String(b?.emp || ''), crt = String(b?.crt || ''), n = Number(b?.n);
  if (!emp || !crt || !Number.isInteger(n)) return jsonErro(400, 'Requisição inválida.');

  const base = await comPerfil(s.efetivo.id, async (tx) => {
    const p = await perms(tx, s, emp);
    if (!p.some((x) => ['preparar', 'juridico'].includes(x))) return null;
    const c = (await tx`select c.* from certames c join participacoes p on p.certame_id = c.id where c.id = ${crt} and p.empresa_id = ${emp}`)[0];
    const l = (await tx`select * from certame_lotes where certame_id = ${crt} and n = ${n}`)[0];
    if (!c || !l) return null;
    const e = (await tx`select razao_social, cnpj from empresas where id = ${emp}`)[0];
    const cfg = Object.fromEntries((await tx`select chave, valor from configuracoes where chave in (${CHAVE_PROMPT}, ${CHAVE_MODELO})`).map((x) => [x.chave, x.valor as string]));
    return { prep: p.includes('preparar'), c, l, e, prompt: cfg[CHAVE_PROMPT] || PROMPT_PADRAO, modelo: cfg[CHAVE_MODELO] || '' };
  });
  if (!base) return jsonErro(403, 'Sem acesso a este processo para analisar exigências.');
  const key = process.env.OPENAI_API_KEY;
  if (!key) return jsonErro(503, 'IA não configurada: defina OPENAI_API_KEY no servidor.');
  const modelo = await escolherModelo(key, base.modelo);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const manda = (o: any) => ctrl.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      const etapa = (msg: string) => manda({ t: 'etapa', msg });
      try {
        const { c, l, e } = base;
        // 1. documentos do PNCP que ainda não estão no processo
        if (c.id_externo && base.prep) {
          etapa('Conferindo documentos publicados no PNCP…');
          const r = await sincronizarPncp(s, emp, crt).catch((x) => ({ erro: String(x.message) }));
          if ('erro' in r) etapa('PNCP: ' + r.erro + ' Seguindo com os documentos já guardados.');
          else if (r.novos) etapa(`${r.novos} documento(s) novo(s) trazido(s) do PNCP.`);
        }
        // 2. documentos do processo, acervo da empresa
        const dados = await comPerfil(s.efetivo.id, async (tx) => ({
          docs: await tx`select d.nome, d.versao, d.publicado, a.caminho, a.nome arquivo from certame_documentos d join arquivos a on a.id = d.arquivo_id where d.certame_id = ${crt} order by d.publicado nulls last, d.nome, d.versao`,
          acv: await tx`select d.*, a.caminho from acervo_documentos d left join arquivos a on a.id = d.arquivo_id where d.empresa_id = ${emp} and not d.arquivado order by d.pasta, d.tipo`,
          lista: await listarDocs(tx, crt)
        }));
        if (!dados.docs.length) { manda({ t: 'erro', msg: 'Nenhum documento do edital está guardado no processo. Carregue o edital e os anexos na aba Processo.' }); ctrl.close(); return; }
        // só a última versão de cada documento
        const ult = new Map<string, any>(); for (const d of dados.docs) ult.set(d.nome, d);
        const fontes: Parte[] = []; const lidos: any[] = [];
        for (const d of ult.values()) {
          etapa('Lendo ' + d.nome + '…');
          try {
            const partes = await extrair(d.arquivo, await ler(d.caminho));
            for (const p of partes) { fontes.push({ ...p, nome: `${d.nome} (v${d.versao}${d.publicado ? ', ' + d.publicado : ''})${p.nome !== d.arquivo ? ' › ' + p.nome.split(' › ').slice(1).join(' › ') : ''}` }); lidos.push({ nome: p.nome === d.arquivo ? d.nome : p.nome.replace(d.arquivo, d.nome), paginas: p.paginas || null, caracteres: p.texto.length, escaneado: !!p.escaneado, aviso: p.aviso || null }); }
          } catch (x) { lidos.push({ nome: d.nome, aviso: 'arquivo indisponível: ' + String((x as Error).message).slice(0, 60) }); }
        }
        // 3. histórico do PNCP (justificativas de retificações, esclarecimentos, impugnações)
        let hist = '';
        const id = c.id_externo ? interpretar(c.id_externo) : null;
        if (id) {
          etapa('Lendo o histórico de alterações no PNCP…');
          const h = await historico(id).catch(() => []);
          hist = h.filter((x: any) => x.justificativa || x.documento).slice(0, 60).map((x: any) => `- ${String(x.data).slice(0, 10)} · ${x.tipo || ''} ${x.categoria || ''}${x.documento ? ' · documento: ' + x.documento : ''}${x.justificativa ? ' · justificativa: ' + x.justificativa : ''}`).join('\n');
        }
        // 4. acervo: validade na data da sessão e texto dos atestados
        const dataSessao = c.sessao ? String(c.sessao).slice(0, 10) : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const situ = (d: any) => d.validade_tipo === 'sem' ? 'sem prazo de validade' : d.validade_tipo === 'desconhecida' ? 'validade desconhecida' : !d.validade ? 'validade não informada' : String(d.validade) < dataSessao ? `VENCIDO na data da sessão (validade ${d.validade})` : `válido até ${d.validade}`;
        const linhas = dados.acv.map((d: any) => `- id ${d.id} | ${PASTA[d.pasta] || d.pasta} | ${d.tipo} | emissor: ${d.emissor || '—'} | emissão: ${d.emissao || '—'} | ${situ(d)}${d.conferido ? '' : ' | pendente de conferência'}${d.modelo ? ' | modelo a ' + (d.modelo === 'assinar' ? 'assinar' : 'preencher') : ''}`);
        const atestados: string[] = [];
        for (const d of dados.acv.filter((x: any) => x.pasta === 'tec' && x.caminho).slice(0, 8)) {
          etapa('Lendo atestado ' + d.tipo + '…');
          try { const t = (await extrair(d.arquivo_nome || 'atestado.pdf', await ler(d.caminho))).map((p) => p.texto).join('\n').slice(0, 8000); if (t.trim()) atestados.push(`--- ${d.id} · ${d.tipo} ---\n${t}`); } catch { /* sem texto */ }
        }
        const f = montarFontes(fontes);
        if (!f.textos.length && !f.arquivos.length) { manda({ t: 'erro', msg: 'Não foi possível extrair texto dos documentos guardados (formatos lidos: PDF, DOCX e ZIP com esses arquivos).' }); ctrl.close(); return; }
        const contexto = `LICITAÇÃO: ${c.modalidade} nº ${c.numero} · ${c.orgao}${c.unidade ? ' · ' + c.unidade : ''}
Objeto: ${c.objeto}
Lote em análise: ${l.n} · ${l.descricao} · quantidade ${l.quantidade} ${l.unidade || ''}
Data da sessão pública: ${c.sessao ? String(c.sessao).replace('T', ' ') : 'não informada'} · data de hoje: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
Identificador PNCP: ${c.id_externo || 'não informado'}

EMPRESA LICITANTE: ${e.razao_social} · CNPJ ${e.cnpj}
ACERVO DE DOCUMENTOS DA EMPRESA (use somente estes ids como evidência):
${linhas.join('\n') || '(acervo vazio)'}
${atestados.length ? '\nTEXTO DOS ATESTADOS DE CAPACIDADE TÉCNICA:\n' + atestados.join('\n\n') : ''}
${hist ? '\nHISTÓRICO DE ALTERAÇÕES NO PNCP (retificações, esclarecimentos e impugnações):\n' + hist : ''}`;

        // 5. IA
        etapa(`Enviando ${f.textos.length + f.arquivos.length} documento(s) para a IA (${modelo})…`);
        const r = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(corpoRequisicao({ instrucoes: base.prompt, contexto, textos: f.textos, arquivos: f.arquivos, modelo }))
        });
        if (!r.ok || !r.body) { manda({ t: 'erro', msg: erroOpenAI(r.status, await r.text().catch(() => '')) }); ctrl.close(); return; }
        const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = '', saida = '', falha = '', ultimo = Date.now();
        for (;;) {
          const { value, done } = await rd.read(); if (done) break;
          buf += dec.decode(value, { stream: true }); const ls = buf.split('\n'); buf = ls.pop() || '';
          for (const x of ls) {
            if (!x.startsWith('data:')) continue;
            try {
              const ev = JSON.parse(x.slice(5));
              if (ev.type === 'response.output_text.delta') saida += ev.delta || '';
              else if (ev.type === 'response.failed' || ev.type === 'error') falha = ev.response?.error?.message || ev.message || 'falha na geração';
              else if (ev.type === 'response.incomplete') falha = 'resposta incompleta (' + (ev.response?.incomplete_details?.reason || 'limite') + ')';
            } catch { /* linha incompleta */ }
          }
          if (Date.now() - ultimo > 4000) { ultimo = Date.now(); etapa(saida ? `A IA está redigindo a análise… (${Math.round(saida.length / 100) / 10} mil caracteres)` : 'A IA está lendo os documentos…'); }
        }
        if (falha) { manda({ t: 'erro', msg: 'A IA não concluiu: ' + falha.slice(0, 200) }); ctrl.close(); return; }
        let res: any; try { res = JSON.parse(saida); } catch { manda({ t: 'erro', msg: 'A IA devolveu uma resposta fora do formato esperado. Tente de novo.' }); ctrl.close(); return; }

        // 6. conferência no servidor: ids do acervo, validade na sessão, aderência só na capacidade técnica
        const acv = new Map(dados.acv.map((d: any) => [d.id, d]));
        const itens = (Array.isArray(res.itens) ? res.itens : []).filter((x: any) => GRUPOS[x.grupo as keyof typeof GRUPOS] && x.req).map((x: any) => {
          const docs = (x.docs || []).filter((d: string) => acv.has(d));
          let st = SITUACOES.includes(x.st) ? x.st : 'pendente'; let dif = String(x.dif || '');
          const venc = docs.filter((d: string) => { const a: any = acv.get(d); return a.validade_tipo === 'data' && a.validade && String(a.validade) < dataSessao; });
          if (st === 'atendido' && docs.length && venc.length === docs.length) { st = 'vencido'; dif = (dif ? dif + ' ' : '') + 'O documento vence antes da sessão: providenciar nova emissão.'; }
          if (st === 'atendido' && !docs.length && x.grupo !== 'dec') { st = 'pendente'; dif = (dif ? dif + ' ' : '') + 'Nenhum documento do acervo foi vinculado: confirmar a evidência.'; }
          const grau = x.grupo === 'tec' && Number.isFinite(x.grau) ? Math.max(0, Math.min(100, Math.round(x.grau))) : null;
          return { grupo: x.grupo, cl: x.cl || '—', pg: x.pg || null, fonte: String(x.fonte || ''), v: 1, req: String(x.req), docs, ev: String(x.ev || ''), st, grau, dif, ia: true, rev: null };
        });
        const meta = { origem: 'ia', modelo, em: new Date().toISOString(), por: s.efetivo.nome, resumo: String(res.resumo || ''), atencao: (res.atencao || []).map(String).slice(0, 20), fontes: lidos, cortados: f.cortados, sessao: dataSessao };
        const rev = await comPerfil(s.efetivo.id, async (tx) => {
          const old = (await tx`select rev from analises where empresa_id = ${emp} and certame_id = ${crt} and n = ${n} for update`)[0];
          const r2 = old
            ? await tx`update analises set itens = ${tx.json(itens)}, meta = ${tx.json(meta)}, rev = rev + 1 where empresa_id = ${emp} and certame_id = ${crt} and n = ${n} returning rev`
            : await tx`insert into analises (empresa_id, certame_id, n, itens, meta) values (${emp}, ${crt}, ${n}, ${tx.json(itens)}, ${tx.json(meta)}) returning rev`;
          await auditar(tx, s, emp, 'analise', `${emp}|${crt}|${n}`, 'ia', r2[0].rev, { modelo, itens: itens.length, fontes: lidos.length });
          return r2[0].rev;
        });
        manda({ t: 'fim', itens, meta, rev, docs: dados.lista });
      } catch (x) {
        console.error('ia exigencias', x);
        manda({ t: 'erro', msg: 'Falha ao gerar a análise: ' + String((x as Error).message).slice(0, 160) });
      }
      ctrl.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
}
