/**
 * Funções comuns de IA (OpenAI Responses API): escolha do modelo, esforço de raciocínio e leitura do streaming.
 * Modelo: o da Administração, se fixado; senão o mais avançado que a chave enxerga (família gpt-N); senão OPENAI_MODEL.
 */
export const CHAVE_MODELO = 'modelo_ia';
export const ESFORCO = 'medium';

let cache: { modelo: string; em: number; lista: string[] } | null = null;

/** Versão numérica de "gpt-5", "gpt-5.2" etc. Só modelos-base: sem mini, nano, pro, chat, codex, audio, datas. */
function versao(id: string) {
  const m = /^gpt-(\d+)(?:\.(\d+))?$/.exec(id);
  return m ? Number(m[1]) * 1000 + Number(m[2] || 0) : -1;
}

/** Consulta os modelos liberados para a chave (guardado por 6 horas). */
export async function modeloAutomatico(chave: string, forcar = false): Promise<{ modelo: string | null; lista: string[] }> {
  if (!forcar && cache && Date.now() - cache.em < 6 * 3600e3) return { modelo: cache.modelo, lista: cache.lista };
  try {
    const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { modelo: null, lista: [] };
    const ids: string[] = ((await r.json())?.data || []).map((x: any) => String(x.id));
    const base = ids.filter((x) => versao(x) > 0).sort((a, b) => versao(b) - versao(a));
    if (!base.length) return { modelo: null, lista: [] };
    cache = { modelo: base[0], em: Date.now(), lista: base.slice(0, 12) };
    return { modelo: base[0], lista: cache.lista };
  } catch { return { modelo: null, lista: [] }; }
}

/** Modelo efetivo: valor fixado na Administração ("auto" ou vazio = automático). */
export async function escolherModelo(chave: string, configurado?: string | null) {
  const c = String(configurado || '').trim();
  if (c && c !== 'auto') return c;
  return (await modeloAutomatico(chave)).modelo || process.env.OPENAI_MODEL || 'gpt-5';
}

/** Parâmetro de raciocínio só para modelos que o aceitam (gpt-5 em diante e série o). */
export function raciocinio(modelo: string) {
  return /^(gpt-[5-9]|gpt-\d{2}|o\d)/.test(modelo) ? { effort: ESFORCO } : undefined;
}

/** Lê o streaming da Responses API, entregando os trechos de texto; devolve o texto completo ou a falha. */
export async function lerStream(r: Response, aoTexto?: (delta: string, total: string) => void) {
  const rd = r.body!.getReader(); const dec = new TextDecoder(); let buf = '', saida = '', falha = '';
  for (;;) {
    const { value, done } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); const ls = buf.split('\n'); buf = ls.pop() || '';
    for (const x of ls) {
      if (!x.startsWith('data:')) continue;
      try {
        const ev = JSON.parse(x.slice(5));
        if (ev.type === 'response.output_text.delta' && ev.delta) { saida += ev.delta; aoTexto?.(ev.delta, saida); }
        else if (ev.type === 'response.failed' || ev.type === 'error') falha = ev.response?.error?.message || ev.error?.message || ev.message || 'falha na geração';
        else if (ev.type === 'response.incomplete') falha = 'resposta incompleta (' + (ev.response?.incomplete_details?.reason || 'limite') + ')';
      } catch { /* linha incompleta */ }
    }
  }
  return { texto: saida, falha };
}
