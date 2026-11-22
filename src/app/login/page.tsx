import FormLogin from './form';
import { sql } from '@/lib/db';
import { faltando } from '@/lib/config';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (faltando().length) redirect('/plataforma');
  const dev = process.env.AUTH_MODE === 'dev' && process.env.NODE_ENV !== 'production';
  const perfis = dev ? await sql()`select slug, nome, papel from perfis order by criado_em, slug` : [];
  const { erro } = await searchParams;
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f3f5f7' }}>
      <div style={{ width: 'min(420px,100%)', background: '#fff', border: '1px solid #d3d9e0', borderRadius: 14, padding: 28 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 18 }}><span style={{ width: 22, height: 22, borderRadius: 5, background: '#1559a8', display: 'inline-block' }} />Kaizen B2G</div>
        <h1 style={{ fontSize: 26, margin: '18px 0 4px' }}>Entrar</h1>
        <p style={{ color: '#5a6573', margin: '0 0 18px', fontSize: 14 }}>Licitações, contratos e rentabilidade por CNPJ.</p>
        {erro && <p style={{ background: '#fdecea', color: '#b42318', padding: '8px 10px', borderRadius: 8, fontSize: 14 }}>{erro}</p>}
        {dev ? (
          <form action="/login/dev" method="post" style={{ display: 'grid', gap: 10 }}>
            <label style={{ fontSize: 14, color: '#5a6573' }}>Ambiente local: entrar como
              <select name="slug" style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 44, fontSize: 16 }}>{perfis.map((p) => <option key={p.slug} value={p.slug}>{p.nome} · {p.papel}</option>)}</select>
            </label>
            <button style={{ minHeight: 44, background: '#1559a8', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, fontSize: 16 }}>Entrar</button>
          </form>
        ) : <FormLogin url={process.env.NEXT_PUBLIC_SUPABASE_URL!} chave={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!} />}
      </div>
    </main>
  );
}
