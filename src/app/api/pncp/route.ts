import crypto from 'node:crypto';
import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { perms, auditar } from '@/lib/regras';
import { gravar } from '@/lib/armazenamento';
import { interpretar, detalhe, documentos, historico, resumo, pesquisar, buscar, urlArquivo, tipoArquivo, MODALIDADES, STATUS } from '@/lib/pncp';

export const dynamic = 'force-dynamic';
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET ?busca=1  … procura editais (palavra-chave, status, UFs, modalidade, período de publicação)
 * GET ?arquivo=CNPJ/ANO/SEQ/DOC … mostra um documento publicado (PDF abre no navegador)
 * GET ?ref=…    … detalhe da contratação, documentos e (com hist=1) histórico de alterações
 */
export async function GET(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  const u = new URL(req.url).searchParams;
  if (u.get('busca')) return busca(s, u);
  if (u.get('arquivo')) return arquivo(u.get('arquivo')!);
  const id = interpretar(u.get('ref') || ''); if (!id) return jsonErro(422, 'Informe o número de controle PNCP (ex.: 00394460000141-1-000045/2026) ou o link do edital no portal.');
  try {
    const c = await detalhe(id);
    if (c.status !== 'ok') return Response.json({ ok: true, situacao: c.status, ref: id, mensagem: c.status === 'nao_localizado' ? 'Nenhuma publicação localizada no PNCP para este identificador.' : 'Fonte indisponível no momento' + ('http' in c && c.http ? ' (HTTP ' + c.http + ')' : '') + '; siga pelo fluxo manual.' });
    const [a, h] = await Promise.all([documentos(id), u.get('hist') ? historico(id).catch(() => []) : Promise.resolve(null)]);
    return Response.json({ ok: true, situacao: 'ok', ref: id, consultadoEm: new Date().toISOString(), contratacao: resumo(c.dados), documentos: a.docs, documentosSituacao: a.situacao, historico: h });
  } catch (e) {
    return Response.json({ ok: true, situacao: 'indisponivel', ref: id, mensagem: 'Fonte indisponível (' + String((e as Error).message).slice(0, 80) + '); siga pelo fluxo manual.' });
  }
}

async function busca(s: any, u: URLSearchParams) {
  const q = (u.get('q') || '').trim().slice(0, 120);
  const ufs = (u.get('ufs') || '').split(',').map((x) => x.trim().toUpperCase()).filter((x) => UFS.includes(x));
  const mod = u.get('mod') || ''; if (mod && !MODALIDADES[mod]) return jsonErro(422, 'Modalidade inválida.');
  const status = STATUS[u.get('status') || ''] ? u.get('status')! : 'recebendo_proposta';
  const de = u.get('de') || '', ate = u.get('ate') || '';
  if ((de && !DATA.test(de)) || (ate && !DATA.test(ate))) return jsonErro(422, 'Datas de publicação inválidas.');
  if (de && ate && de > ate) return jsonErro(422, 'A data inicial de publicação é posterior à final.');
  if (!q && !ufs.length && !de) return jsonErro(422, 'Informe ao menos uma palavra-chave, uma UF ou a data de publicação inicial.');
  const abertas = status === 'recebendo_proposta';
  try {
    let r: any = await pesquisar({ q, status, ufs, mod, de, ate, abertas });
    if (!r) {
      // reserva: API de consulta (exige período, modalidade e no máximo 3 UFs)
      if (!de || !ate || ufs.length > 3) return Response.json({ ok: true, situacao: 'indisponivel', mensagem: 'A busca do portal do PNCP não respondeu. Tente de novo em instantes ou informe o período de publicação e até 3 UFs.' });
      const partes = await Promise.all((ufs.length ? ufs : ['']).map((uf) => buscar({ de, ate, uf, mod: mod || '6', q, abertas })));
      if (partes.some((p) => p.situacao !== 'ok')) return Response.json({ ok: true, situacao: 'indisponivel', mensagem: 'O PNCP não respondeu. Tente de novo em instantes.' });
      r = { situacao: 'ok', fonte: 'consulta', total: partes.reduce((a, p: any) => a + p.total, 0), lidos: partes.reduce((a, p: any) => a + p.lidos, 0), truncado: partes.some((p: any) => p.truncado), itens: partes.flatMap((p: any) => p.itens) };
    }
    // marca o que já está no sistema para a empresa ativa
    const emp = u.get('emp') || '';
    const ctrls = r.itens.map((x: any) => x.controle).filter(Boolean);
    const ja = ctrls.length ? await comPerfil(s.efetivo.id, (tx) => tx`select c.id_externo, c.id, bool_or(p.empresa_id = ${emp}) minha from certames c join participacoes p on p.certame_id = c.id where c.id_externo = any(${ctrls}) group by c.id_externo, c.id`) : [];
    const mapa = Object.fromEntries(ja.map((x: any) => [x.id_externo, { crt: x.id, minha: x.minha }]));
    r.itens = r.itens.slice(0, 300).map((x: any) => ({ ...x, noSistema: mapa[x.controle] || null }));
    return Response.json({ ok: true, ...r, consultadoEm: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: true, situacao: 'indisponivel', mensagem: 'O PNCP não respondeu (' + String((e as Error).message).slice(0, 80) + '). Tente de novo em instantes.' });
  }
}

/** Repassa o documento do PNCP ao navegador. PDF abre na tela; outros formatos são baixados. */
async function arquivo(ref: string) {
  const m = ref.match(/^(\d{14})\/(\d{4})\/(\d{1,6})\/(\d{1,4})$/); if (!m) return jsonErro(422, 'Documento inválido.');
  try {
    const r = await fetch(urlArquivo({ cnpj: m[1], ano: Number(m[2]), seq: Number(m[3]) }, Number(m[4])), { signal: AbortSignal.timeout(60000) });
    if (!r.ok) return jsonErro(r.status === 404 ? 404 : 502, r.status === 404 ? 'Documento não localizado no PNCP.' : 'O PNCP não entregou o documento (HTTP ' + r.status + ').');
    const dados = await r.arrayBuffer(); const t = tipoArquivo(dados, r.headers.get('content-disposition'));
    const nome = `pncp-${m[1]}-${m[2]}-${m[3]}-doc${m[4]}${t.ext}`;
    return new Response(dados, { headers: { 'Content-Type': t.mime, 'Content-Disposition': `${t.mime === 'application/pdf' ? 'inline' : 'attachment'}; filename="${nome}"`, 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { return jsonErro(502, 'O PNCP não respondeu ao pedir o documento: ' + String((e as Error).message).slice(0, 80)); }
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
        const url = urlArquivo(id, Number(d.sequencial));
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
