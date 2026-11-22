import { supabaseServidor } from '@/lib/sessao';
export async function GET(req: Request) {
  const u = new URL(req.url); const code = u.searchParams.get('code');
  if (code) { const sb = await supabaseServidor(); await sb.auth.exchangeCodeForSession(code); }
  return Response.redirect(new URL('/plataforma', req.url), 303);
}
