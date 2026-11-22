import crypto from 'node:crypto';
import { comPerfil } from './db';
import type { Sessao } from './sessao';
import { perms, auditar } from './regras';
import { gravar } from './armazenamento';
import { interpretar, documentos, urlArquivo, tipoArquivo, type Id } from './pncp';

const nomeSeguro = (t: string) => String(t || 'documento').replace(/\.(pdf|zip|docx?|xlsx?|odt|rar|7z)$/i, '').replace(/[^\w.\-() ]+/g, '_').slice(0, 100);
export const origemPncp = (id: Id, seq: number) => `${id.cnpj}/${id.ano}/${id.seq}/${seq}`;

/**
 * Traz para o processo os documentos publicados no PNCP que ainda não estão guardados (edital, anexos,
 * esclarecimentos, respostas a impugnações). Os downloads acontecem fora da transação; só o registro é transacional.
 * Devolve os documentos novos e a lista completa do certame.
 */
export async function sincronizarPncp(s: Sessao, emp: string, crt: string, escolhidos?: number[], refManual?: string) {
  const base = await comPerfil(s.efetivo.id, async (tx) => {
    const p = await perms(tx, s, emp);
    if (!p.includes('preparar')) return { erro: 'Seu perfil não registra documentos do edital.' };
    const c = (await tx`select c.id_externo from certames c join participacoes p on p.certame_id = c.id where c.id = ${crt} and p.empresa_id = ${emp}`)[0];
    if (!c) return { erro: 'Processo fora do seu escopo.' };
    const ja = await tx`select origem from certame_documentos where certame_id = ${crt} and origem is not null`;
    return { ref: c.id_externo as string | null, ja: new Set(ja.map((x) => x.origem as string)) };
  });
  if ('erro' in base) return { erro: base.erro as string };
  const id = interpretar(base.ref || refManual || '');
  if (!id) return { erro: 'Este processo não veio do PNCP: carregue os arquivos manualmente.' };
  const lista = await documentos(id);
  if (lista.situacao !== 'ok') return { erro: lista.situacao === 'nao_localizado' ? 'Nenhum documento publicado no PNCP para este processo.' : 'O PNCP não respondeu agora. Tente de novo em instantes.' };
  const faltam = lista.docs.filter((d: any) => d.ativo && !base.ja.has(origemPncp(id, d.sequencial)) && (!escolhidos || escolhidos.includes(Number(d.sequencial)))).slice(0, 25);

  const baixados: { d: any; dados: ArrayBuffer; arqId: string; nome: string; mime: string; caminho: string }[] = [];
  const falhas: { titulo: string; erro: string }[] = [];
  for (const d of faltam) {
    try {
      const r = await fetch(urlArquivo(id, Number(d.sequencial)), { signal: AbortSignal.timeout(90000) });
      if (!r.ok) { falhas.push({ titulo: d.titulo, erro: 'HTTP ' + r.status }); continue; }
      const dados = await r.arrayBuffer(); const t = tipoArquivo(dados, r.headers.get('content-disposition'));
      const arqId = crypto.randomUUID(); const nome = nomeSeguro(d.titulo) + t.ext; const caminho = `${emp}/${arqId}/${nome}`;
      await gravar(caminho, dados, t.mime);
      baixados.push({ d, dados, arqId, nome, mime: t.mime, caminho });
    } catch (e) { falhas.push({ titulo: d.titulo, erro: String((e as Error).message).slice(0, 60) }); }
  }
  const docs = await comPerfil(s.efetivo.id, async (tx) => {
    for (const b of baixados) {
      const origem = origemPncp(id, b.d.sequencial);
      if ((await tx`select 1 from certame_documentos where certame_id = ${crt} and origem = ${origem}`).length) continue;
      const titulo = String(b.d.titulo || 'Documento').slice(0, 200);
      await tx`insert into arquivos (id, empresa_id, caminho, nome, mime, tamanho, criado_por) values (${b.arqId}, ${emp}, ${b.caminho}, ${b.nome}, ${b.mime}, ${b.dados.byteLength}, ${s.efetivo.id})`;
      const v = ((await tx`select max(versao) m from certame_documentos where certame_id = ${crt} and nome = ${titulo}`)[0].m || 0) + 1;
      await tx`insert into certame_documentos (certame_id, nome, versao, publicado, arquivo_id, enviado_por_empresa, origem) values (${crt}, ${titulo}, ${v}, ${b.d.data ? String(b.d.data).slice(0, 10) : null}, ${b.arqId}, ${emp}, ${origem})`;
      await auditar(tx, s, emp, 'documento_edital', crt, 'pncp', v, { titulo, origem });
    }
    return listarDocs(tx, crt);
  });
  return { novos: baixados.length, falhas, publicados: lista.docs.length, docs };
}

export async function listarDocs(tx: any, crt: string) {
  return (await tx`select * from certame_documentos where certame_id = ${crt} order by nome, versao`).map((d: any) => ({ nome: d.nome, v: d.versao, d: d.publicado, pg: d.paginas, ret: d.retificacao || undefined, arqId: d.arquivo_id || undefined, pncp: d.origem || undefined }));
}
