/** Variáveis que o servidor precisa; a tela de configuração pendente lista as que faltam (só os nomes). */
export function faltando(): string[] {
  const req = ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  if (process.env.AUTH_MODE === 'dev' && process.env.NODE_ENV !== 'production') return process.env.DATABASE_URL ? [] : ['DATABASE_URL'];
  return req.filter((k) => !process.env[k]);
}
export function paginaPendente(f: string[]) {
  return new Response(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kaizen B2G · configuração pendente</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#16202b"><h1 style="font-size:26px">Configuração pendente</h1>
<p>O servidor está no ar, mas faltam variáveis no Railway (serviço <b>kaizen-b2g-web</b> › Variables):</p><ul>${f.map((x) => `<li><code>${x}</code></li>`).join('')}</ul>
<p>Depois de cadastrá-las, o Railway publica de novo automaticamente.</p></body></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
