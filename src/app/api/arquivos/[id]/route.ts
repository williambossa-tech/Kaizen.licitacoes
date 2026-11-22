import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { ler } from '@/lib/armazenamento';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return jsonErro(404, 'Arquivo não encontrado.');
  const a = await comPerfil(s.efetivo.id, async (tx) => (await tx`select * from arquivos where id = ${id}`)[0]);
  if (!a) return jsonErro(404, 'Arquivo não encontrado ou sem permissão.');   // RLS: outra empresa não enxerga o registro
  const dados = await ler(a.caminho);
  return new Response(dados, { headers: { 'Content-Type': a.mime || 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.nome)}`, 'Cache-Control': 'private, no-store' } });
}
