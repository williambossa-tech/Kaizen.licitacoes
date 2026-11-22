import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { perms } from '@/lib/regras';
import { ler } from '@/lib/armazenamento';
import { montarDocx } from '@/lib/docx';
import { TIPOS, fecho, separar, type Tipo } from '@/lib/pecas';

export const dynamic = 'force-dynamic';

/** Peça no papel timbrado da empresa (Word), com local, data e assinatura do representante legal. As notas internas não saem. */
export async function POST(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  const b = await req.json().catch(() => null);
  const emp = String(b?.emp || ''), crt = String(b?.crt || ''), tipo = String(b?.tipo || '') as Tipo, texto = String(b?.texto || '');
  if (!emp || !crt || !TIPOS[tipo] || !texto.trim()) return jsonErro(400, 'Requisição inválida.');
  const base = await comPerfil(s.efetivo.id, async (tx) => {
    if (!(await perms(tx, s, emp)).length) return null;
    const c = (await tx`select c.numero from certames c join participacoes p on p.certame_id = c.id where c.id = ${crt} and p.empresa_id = ${emp}`)[0];
    if (!c) return null;
    const e = (await tx`select razao_social, cnpj from empresas where id = ${emp}`)[0];
    const idt = (await tx`select i.*, a.caminho from empresa_identidade i left join arquivos a on a.id = i.timbrado_arquivo_id where i.empresa_id = ${emp}`)[0];
    return { c, e, idt };
  });
  if (!base) return jsonErro(403, 'Sem acesso a este processo.');
  try {
    const timbrado = base.idt?.caminho ? await ler(base.idt.caminho).catch(() => null) : null;
    const fc = fecho({ razao: base.e.razao_social, cnpj: base.e.cnpj, cidade: base.idt?.cidade, rep: base.idt?.representante || {} });
    const dados = await montarDocx(separar(texto).peca, fc, timbrado);
    const nome = `${TIPOS[tipo]} - ${String(base.c.numero).replace(/[^\w.-]+/g, '-')}.docx`;
    return new Response(Buffer.from(dados), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="peca.docx"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      'X-Timbrado': timbrado ? '1' : '0', 'Cache-Control': 'no-store'
    } });
  } catch (e) { console.error('docx', e); return jsonErro(500, 'Falha ao montar o documento: ' + String((e as Error).message).slice(0, 120)); }
}
