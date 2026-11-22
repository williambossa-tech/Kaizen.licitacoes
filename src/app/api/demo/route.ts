import { cookies } from 'next/headers';
import { obterSessao, jsonErro, assinar, demoAtivo } from '@/lib/sessao';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Modo demonstração: o administrador atua como um perfil fictício; toda gravação registra o usuário real e o perfil assumido. */
export async function POST(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  if (!demoAtivo() || !s.real.admin) return jsonErro(403, 'Troca de perfil disponível só para administradores em modo demonstração.');
  const { slug } = await req.json().catch(() => ({ slug: '' }));
  const jar = await cookies();
  if (!slug || slug === s.real.slug) { jar.delete('kb_atuar'); return Response.json({ ok: true }); }
  const p = (await sql()`select slug from perfis where slug = ${slug} and demo`)[0];
  if (!p) return jsonErro(404, 'Perfil de demonstração inexistente.');
  jar.set('kb_atuar', assinar(p.slug), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8 });
  await sql()`insert into auditoria (usuario_id, atuando_como, entidade, chave, acao) select ${s.real.id}, id, 'sessao', ${p.slug}, 'atuar_como' from perfis where slug = ${p.slug}`;
  return Response.json({ ok: true });
}
