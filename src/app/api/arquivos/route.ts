import crypto from 'node:crypto';
import { comPerfil } from '@/lib/db';
import { obterSessao, jsonErro } from '@/lib/sessao';
import { gravar } from '@/lib/armazenamento';
import { perms, auditar } from '@/lib/regras';

export const dynamic = 'force-dynamic';
const LIMITE = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const s = await obterSessao(); if (!s) return jsonErro(401, 'Sessão expirada.');
  const f = await req.formData(); const arq = f.get('arquivo'); const emp = String(f.get('empresa') || '');
  if (!(arq instanceof File)) return jsonErro(400, 'Arquivo ausente.');
  if (arq.size > LIMITE) return jsonErro(413, 'Arquivo acima de 25 MB.');
  try {
    const id = crypto.randomUUID(); const nome = arq.name.replace(/[^\w.\-() ]+/g, '_').slice(0, 120) || 'arquivo';
    const caminho = `${emp}/${id}/${nome}`;
    const r = await comPerfil(s.efetivo.id, async (tx) => {
      const p = await perms(tx, s, emp);
      if (!p.some((x) => ['preparar', 'aprovar', 'juridico', 'financeiro', 'decidir', 'preco'].includes(x))) return null;
      await gravar(caminho, await arq.arrayBuffer(), arq.type);
      await tx`insert into arquivos (id, empresa_id, caminho, nome, mime, tamanho, criado_por) values (${id}, ${emp}, ${caminho}, ${nome}, ${arq.type || null}, ${arq.size}, ${s.efetivo.id})`;
      await auditar(tx, s, emp, 'arquivo', id, 'upload', null, { nome, tamanho: arq.size });
      return { id, nome };
    });
    if (!r) return jsonErro(403, 'Seu perfil não pode enviar arquivos desta empresa.');
    return Response.json({ ok: true, ...r });
  } catch (e) { console.error('upload', e); return jsonErro(500, 'Falha ao gravar o arquivo. Nada foi registrado; tente de novo.'); }
}
