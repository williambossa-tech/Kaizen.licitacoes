import { irPara } from '@/lib/config';
import { cookies } from 'next/headers';
import { supabaseServidor, devAuth } from '@/lib/sessao';
export async function GET(req: Request) {
  const jar = await cookies(); jar.delete('kb_atuar'); jar.delete('kb_dev');
  if (!devAuth()) { const sb = await supabaseServidor(); await sb.auth.signOut(); }
  return irPara('/login');
}
