import { sql } from '@/lib/db';
import { faltando } from '@/lib/config';
export const dynamic = 'force-dynamic';
export async function GET() {
  const f = faltando();
  if (f.includes('DATABASE_URL')) return Response.json({ ok: true, banco: 'nao_configurado', faltando: f });
  try { const r = await sql()`select count(*)::int c from empresas`; return Response.json({ ok: true, banco: 'ok', empresas: r[0].c, faltando: f }); }
  catch (e) { return Response.json({ ok: false, banco: 'erro', mensagem: String((e as Error).message).slice(0, 120), faltando: f }, { status: 503 }); }
}
