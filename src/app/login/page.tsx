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
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'radial-gradient(1000px 520px at 80% -10%, rgba(139,92,246,.28), transparent 60%), radial-gradient(800px 480px at 0% 110%, rgba(34,211,238,.12), transparent 60%), #130a26' }}>
      <div style={{ width: 'min(420px,100%)', background: '#1c1036', border: '1px solid #36255f', borderRadius: 16, padding: 28, boxShadow: '0 0 0 1px rgba(139,92,246,.12), 0 18px 50px rgba(0,0,0,.45)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, fontSize: 20, fontFamily: 'Poppins, Public Sans, sans-serif', color: '#fff' }}><span style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)', display: 'inline-block' }} />Kaizen B2G</div>
        <h1 style={{ fontSize: 26, margin: '18px 0 4px', color: '#fff', fontFamily: 'Poppins, Public Sans, sans-serif' }}>Entrar</h1>
        <p style={{ color: '#a99cc9', margin: '0 0 18px', fontSize: 14 }}>Licitações, contratos e rentabilidade por CNPJ.</p>
        {erro && <p style={{ background: 'rgba(255,92,122,.12)', color: '#ff8aa0', padding: '8px 10px', borderRadius: 8, fontSize: 14 }}>{erro}</p>}
        {dev ? (
          <form action="/login/dev" method="post" style={{ display: 'grid', gap: 10 }}>
            <label style={{ fontSize: 14, color: '#a99cc9' }}>Ambiente local: entrar como
              <select name="slug" style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 44, fontSize: 16, background: '#130a26', color: '#efeaff', border: '1px solid #36255f', borderRadius: 10, padding: '8px 10px' }}>{perfis.map((p) => <option key={p.slug} value={p.slug}>{p.nome} · {p.papel}</option>)}</select>
            </label>
            <button style={{ minHeight: 44, background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)', color: '#fff', border: 0, borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>Entrar</button>
          </form>
        ) : <FormLogin url={process.env.NEXT_PUBLIC_SUPABASE_URL!} chave={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!} />}
      </div>
    </main>
  );
}
