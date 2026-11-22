import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import crypto from 'node:crypto';
import { sql } from './db';

export type Perfil = { id: string; slug: string; nome: string; papel: string; email: string | null; demo: boolean; consolida: boolean; admin: boolean };
export type Sessao = { real: Perfil; efetivo: Perfil; modoDemo: boolean };

export const devAuth = () => process.env.AUTH_MODE === 'dev' && process.env.NODE_ENV !== 'production';
export const demoAtivo = () => process.env.DEMO_MODE === '1';

const segredo = () => process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-local';
export const assinar = (v: string) => v + '.' + crypto.createHmac('sha256', segredo()).update(v).digest('base64url');
export const verificar = (s?: string) => {
  if (!s) return null; const i = s.lastIndexOf('.'); if (i < 0) return null;
  const v = s.slice(0, i); return assinar(v) === s ? v : null;
};

export async function supabaseServidor() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => { try { lista.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* chamado em componente de servidor */ } }
    }
  });
}

async function perfilPor(where: { slug?: string; auth?: string; email?: string }): Promise<Perfil | null> {
  const db = sql();
  const rows = where.slug ? await db`select * from perfis where slug = ${where.slug}`
    : where.auth ? await db`select * from perfis where auth_id = ${where.auth}`
    : await db`select * from perfis where lower(email) = lower(${where.email!}) and auth_id is null`;
  const p = rows[0]; if (!p) return null;
  const adm = await db`select 1 from vinculos where usuario_id = ${p.id} and 'admin' = any(permissoes) limit 1`;
  return { id: p.id, slug: p.slug, nome: p.nome, papel: p.papel, email: p.email, demo: p.demo, consolida: p.consolida, admin: adm.length > 0 };
}

/** Identifica o usuário: Supabase Auth em produção; seletor local em desenvolvimento. */
export async function obterSessao(): Promise<Sessao | null> {
  const jar = await cookies();
  let real: Perfil | null = null;
  if (devAuth()) {
    const slug = jar.get('kb_dev')?.value; if (slug) real = await perfilPor({ slug });
  } else {
    const sb = await supabaseServidor();
    const { data } = await sb.auth.getUser();
    const u = data.user; if (!u) return null;
    real = await perfilPor({ auth: u.id });
    if (!real && u.email) { // primeiro acesso: vincula a conta de login ao perfil cadastrado com o mesmo e-mail
      const p = await perfilPor({ email: u.email });
      if (p) { await sql()`update perfis set auth_id = ${u.id} where id = ${p.id}`; real = p; }
    }
  }
  if (!real) return null;
  let efetivo = real;
  const atuar = verificar(jar.get('kb_atuar')?.value);
  if (atuar && demoAtivo() && real.admin) {
    const p = await perfilPor({ slug: atuar });
    if (p && (p.demo || p.id === real.id)) efetivo = p;
  }
  return { real, efetivo, modoDemo: efetivo.id !== real.id };
}

export function jsonErro(status: number, mensagem: string, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: false, erro: mensagem, ...extra }, { status });
}
