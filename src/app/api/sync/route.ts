import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { Recusa, syncLote, syncDoc, syncContrato, syncAta, syncMinuta, syncNfRec, syncPacote, syncAnalise, syncCertDocs } from '@/lib/regras';

export const dynamic = 'force-dynamic';

/** Persiste uma entidade alterada na tela, com conferência de permissão, versão e regras de negócio no servidor. */
export async function POST(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada. Entre novamente.');
  let b: { tipo: string; chave: string; rev?: number; dados: any };
  try { b = await req.json(); } catch { return jsonErro(400, 'Requisição inválida.'); }
  try {
    const r = await comPerfil(s.efetivo.id, async (tx) => {
      const rev = Number(b.rev || 0);
      switch (b.tipo) {
        case 'lote': return syncLote(tx, s, b.chave, rev, b.dados);
        case 'doc': return syncDoc(tx, s, b.chave, rev, b.dados);
        case 'contrato': return syncContrato(tx, s, b.chave, rev, b.dados);
        case 'ata': return syncAta(tx, s, b.chave, rev, b.dados);
        case 'minuta': return syncMinuta(tx, s, b.chave, rev, b.dados);
        case 'nfrec': return syncNfRec(tx, s, b.chave, rev, b.dados);
        case 'pacote': return syncPacote(tx, s, b.chave, b.dados);
        case 'analise': return syncAnalise(tx, s, b.chave, rev, b.dados);
        case 'certdocs': return syncCertDocs(tx, s, b.chave, b.dados);
        default: throw new Recusa(400, 'Tipo de registro desconhecido.');
      }
    });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof Recusa) return jsonErro(e.status, e.message, e.extra);
    const m = String((e as Error).message || e);
    if (/row-level security|permission denied/i.test(m)) return jsonErro(403, 'Sem permissão para esta empresa.');
    console.error('sync', b.tipo, b.chave, m);
    return jsonErro(500, 'Não foi possível salvar: ' + m.slice(0, 160));
  }
}
