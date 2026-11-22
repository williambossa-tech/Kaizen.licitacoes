import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

const BUCKET = 'privado';
const local = () => !process.env.SUPABASE_SERVICE_ROLE_KEY;
const dir = () => process.env.STORAGE_DIR || '.data/arquivos';
let pronto = false;
function admin() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }); }

/** Arquivos privados: bucket sem acesso público; o download passa sempre pelo servidor, que confere a empresa. */
export async function gravar(caminho: string, dados: ArrayBuffer, mime: string) {
  if (local()) { const p = path.join(dir(), caminho); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, Buffer.from(dados)); return; }
  const sb = admin();
  if (!pronto) { await sb.storage.createBucket(BUCKET, { public: false }).catch(() => null); pronto = true; }
  const { error } = await sb.storage.from(BUCKET).upload(caminho, dados, { contentType: mime || 'application/octet-stream', upsert: false });
  if (error) throw new Error(error.message);
}
export async function ler(caminho: string): Promise<ArrayBuffer> {
  if (local()) { const b = await fs.readFile(path.join(dir(), caminho)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }
  const { data, error } = await admin().storage.from(BUCKET).download(caminho);
  if (error || !data) throw new Error(error?.message || 'Arquivo indisponível');
  return data.arrayBuffer();
}
