import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Renova a sessão do Supabase a cada requisição (padrão recomendado pelo @supabase/ssr). */
export async function middleware(request: NextRequest) {
  if (process.env.AUTH_MODE === 'dev' && process.env.NODE_ENV !== 'production') return NextResponse.next();
  let resposta = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => { lista.forEach(({ name, value }) => request.cookies.set(name, value)); resposta = NextResponse.next({ request }); lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options)); }
    }
  });
  await sb.auth.getUser();
  return resposta;
}
export const config = { matcher: ['/((?!_next/static|_next/image|app/|favicon.ico).*)'] };
