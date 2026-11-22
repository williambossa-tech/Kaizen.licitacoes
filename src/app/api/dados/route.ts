import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { carregar } from '@/lib/dados';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada. Entre novamente.');
  const d = await comPerfil(s.efetivo.id, (tx) => carregar(tx, s));
  return Response.json(d, { headers: { 'Cache-Control': 'no-store' } });
}
