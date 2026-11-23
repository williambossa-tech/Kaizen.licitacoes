import fs from 'node:fs/promises';
import path from 'node:path';
import { comPerfil } from '@/lib/db';
import { obterSessao } from '@/lib/sessao';
import { carregar } from '@/lib/dados';
import { faltando, paginaPendente, irPara } from '@/lib/config';

export const dynamic = 'force-dynamic';
let shell: string | null = null; let inicio: string | null = null;
const VERSAO = process.env.RAILWAY_DEPLOYMENT_ID?.slice(0, 8) || String(Date.now());

/** Entrega as telas validadas nos templates com os dados do usuário (já filtrados pelo RLS) embutidos. */
export async function GET(req: Request) {
  const f = faltando(); if (f.length) return paginaPendente(f);
  const s = await obterSessao();
  if (!s) return irPara('/login');
  if (!shell) shell = await fs.readFile(path.join(process.cwd(), 'public/app/shell.html'), 'utf8');
  const dados = await comPerfil(s.efetivo.id, (tx) => carregar(tx, s));
  const json = JSON.stringify(dados).replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');
  if (!Object.keys(dados.EMP).length) { // sem empresa autorizada: primeiros passos (administrador) ou acesso pendente
    if (!inicio) inicio = await fs.readFile(path.join(process.cwd(), 'public/app/inicio.html'), 'utf8');
    return new Response(inicio.replace(/__V__/g, VERSAO).replace('__DADOS__', () => json), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  const html = shell.replace(/__V__/g, VERSAO).replace('__DADOS__', () => json);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
