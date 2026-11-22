// Aplica as migrações em ordem, carrega os dados de demonstração (banco vazio + SEED_DEMO=1)
// e vincula a conta de login do administrador. Roda no início de cada implantação; é idempotente.
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('[migracao] DATABASE_URL ausente: nada a fazer.'); process.exit(0); }
const local = /localhost|127\.0\.0\.1/.test(url);
const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : 'require', onnotice: () => {} });
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  await sql`create table if not exists _migracoes (nome text primary key, aplicada_em timestamptz not null default now())`;
  if (local) await sql.unsafe(fs.readFileSync(path.join(raiz, 'supabase/local/stub_supabase.sql'), 'utf8'));
  const dir = path.join(raiz, 'supabase/migrations');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if ((await sql`select 1 from _migracoes where nome = ${f}`).length) continue;
    await sql.begin(async (tx) => { await tx.unsafe(fs.readFileSync(path.join(dir, f), 'utf8')); await tx`insert into _migracoes (nome) values (${f})`; });
    console.log('[migracao] aplicada', f);
  }
  const vazio = (await sql`select count(*)::int c from empresas`)[0].c === 0;
  if (vazio && (process.env.SEED_DEMO === '1' || process.argv.includes('--seed'))) {
    await sql.unsafe(fs.readFileSync(path.join(raiz, 'supabase/seed/demo.sql'), 'utf8'));
    console.log('[migracao] dados de demonstração carregados');
  }
  // conta de login do administrador (Supabase Auth), criada uma única vez com a senha inicial definida no Railway
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY, base = process.env.NEXT_PUBLIC_SUPABASE_URL, senha = process.env.ADMIN_INITIAL_PASSWORD;
  const adm = (await sql`select id, email, auth_id from perfis where slug = 'william'`)[0];
  if (adm && !adm.auth_id && key && base && senha) {
    const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    let r = await fetch(`${base}/auth/v1/admin/users`, { method: 'POST', headers: h, body: JSON.stringify({ email: adm.email, password: senha, email_confirm: true }) });
    let u = await r.json();
    if (!r.ok) { // já existe: localiza pelo e-mail
      const l = await (await fetch(`${base}/auth/v1/admin/users?per_page=1000`, { headers: h })).json();
      u = (l.users || []).find((x) => (x.email || '').toLowerCase() === adm.email.toLowerCase());
    }
    if (u && u.id) { await sql`update perfis set auth_id = ${u.id} where id = ${adm.id}`; console.log('[migracao] conta do administrador vinculada'); }
    else console.log('[migracao] não foi possível criar a conta do administrador:', JSON.stringify(u).slice(0, 200));
  }
} catch (e) { console.error('[migracao] falhou:', e.message); process.exitCode = 1; }
finally { await sql.end(); }
