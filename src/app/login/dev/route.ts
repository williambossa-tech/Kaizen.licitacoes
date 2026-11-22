import { cookies } from 'next/headers';
export async function POST(req: Request) {
  if (!(process.env.AUTH_MODE === 'dev' && process.env.NODE_ENV !== 'production')) return new Response('Indisponível', { status: 404 });
  const f = await req.formData(); const jar = await cookies();
  jar.set('kb_dev', String(f.get('slug') || ''), { httpOnly: true, sameSite: 'lax', path: '/' }); jar.delete('kb_atuar');
  return Response.redirect(new URL('/plataforma', req.url), 303);
}
