import { obterSessao, jsonErro } from '@/lib/sessao';
import { consultarCnpj, interpretarTexto, cnpjValido } from '@/lib/cnpj';

export const dynamic = 'force-dynamic';

/** Dados da empresa pelo CNPJ (bases públicas) ou pelo texto colado do comprovante. Só para o administrador. */
export async function POST(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  if (!s.real.admin) return jsonErro(403, 'Somente o administrador do sistema cadastra empresas.');
  const b = await req.json().catch(() => null);
  if (b?.texto) {
    const r = interpretarTexto(String(b.texto).slice(0, 50000));
    if (!r.cnpj && !r.razao) return jsonErro(422, 'Não reconheci CNPJ nem razão social no texto colado. Copie o comprovante inteiro (Ctrl+A, Ctrl+C) e cole de novo.');
    return Response.json({ ok: true, dados: { ...r, fonte: 'Texto colado' } });
  }
  if (!cnpjValido(String(b?.cnpj || ''))) return jsonErro(422, 'CNPJ inválido: confira os 14 dígitos.');
  const r = await consultarCnpj(String(b.cnpj));
  if (r.ok) return Response.json({ ok: true, dados: r.dados });
  return jsonErro(r.situacao === 'nao_encontrado' ? 404 : 503, (r.situacao === 'nao_encontrado' ? 'CNPJ não encontrado nas bases públicas.' : 'As bases públicas de CNPJ não responderam agora.') + ' Abra o comprovante no site da Receita Federal, copie o texto e cole no campo abaixo.', { detalhe: r.detalhe });
}
