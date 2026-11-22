import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { perms } from '@/lib/regras';

export const dynamic = 'force-dynamic';

/**
 * Minutas com IA pela Responses API da OpenAI. A chave fica só no servidor.
 * O texto devolvido é transmitido em partes; o cliente mostra o progresso e salva a versão ao final.
 */
export async function POST(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  const b = await req.json().catch(() => null); if (!b?.prompt || !b?.emp || !b?.crt) return jsonErro(400, 'Requisição inválida.');
  const ok = await comPerfil(s.efetivo.id, async (tx) => {
    const p = await perms(tx, s, b.emp);
    const part = await tx`select 1 from participacoes where empresa_id = ${b.emp} and certame_id = ${b.crt}`;
    return part.length > 0 && p.some((x) => ['preparar', 'juridico'].includes(x));
  });
  if (!ok) return jsonErro(403, 'Sem acesso a este processo para gerar minutas.');
  const key = process.env.OPENAI_API_KEY;
  if (!key) return jsonErro(503, 'IA não configurada: defina OPENAI_API_KEY no servidor.');
  const r = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-5', input: String(b.prompt).slice(0, 200000), stream: true })
  });
  if (!r.ok || !r.body) return jsonErro(502, 'Falha na API de IA (' + r.status + '). O prompt e os anexos foram preservados.');
  const dec = new TextDecoder(); const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const rd = r.body!.getReader(); let buf = '';
      for (;;) {
        const { value, done } = await rd.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); const partes = buf.split('\n'); buf = partes.pop() || '';
        for (const l of partes) {
          if (!l.startsWith('data:')) continue;
          try { const ev = JSON.parse(l.slice(5)); if (ev.type === 'response.output_text.delta' && ev.delta) ctrl.enqueue(enc.encode(ev.delta)); } catch { /* linha incompleta */ }
        }
      }
      ctrl.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
