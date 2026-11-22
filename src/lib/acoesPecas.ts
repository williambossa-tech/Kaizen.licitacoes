import type { Tx } from './db';
import type { Sessao } from './sessao';
import { Recusa, perms, exige, auditar } from './regras';
import { ler } from './armazenamento';
import { extrair } from './textos';
import { validarTimbrado } from './docx';
import { TIPOS, chaveInstr } from './pecas';
import { CHAVE_PROMPT } from './exigencias';
import { CHAVE_MODELO } from './ia';

const txt = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const PODE = ['preparar', 'juridico'];

/** Papel timbrado e representante legal da empresa. */
export async function salvarIdentidade(tx: Tx, s: Sessao, b: any) {
  const emp = txt(b.emp, 20); exige(await perms(tx, s, emp), PODE, 'alterar o papel timbrado e o representante legal');
  const r = b.rep || {};
  const rep = { nome: txt(r.nome, 160), cargo: txt(r.cargo, 120), cpf: txt(r.cpf, 20), rg: txt(r.rg, 30), email: txt(r.email, 160), telefone: txt(r.telefone, 40) };
  const old = (await tx`select * from empresa_identidade where empresa_id = ${emp} for update`)[0];
  if (old && Number(b.rev) !== old.rev) throw new Recusa(409, 'Os dados da empresa foram alterados por outra pessoa. Recarregue a tela.');
  let timbrado: string | null = old?.timbrado_arquivo_id || null; let nomeTimbrado: string | null = null;
  if (b.timbradoId !== undefined) {
    if (b.timbradoId) {
      const a = (await tx`select id, caminho, nome from arquivos where id = ${String(b.timbradoId)} and empresa_id = ${emp}`)[0];
      if (!a) throw new Recusa(403, 'Arquivo do timbrado fora do escopo da empresa.');
      if (!(await validarTimbrado(await ler(a.caminho)))) throw new Recusa(422, 'O papel timbrado precisa ser um arquivo Word (.docx). Abra o modelo no Word e use "Salvar como" › Documento do Word.');
      timbrado = a.id; nomeTimbrado = a.nome;
    } else timbrado = null;
  }
  const dados = { endereco: txt(b.endereco, 300) || null, cidade: txt(b.cidade, 80) || null };
  const row = old
    ? (await tx`update empresa_identidade set timbrado_arquivo_id = ${timbrado}, representante = ${tx.json(rep)}, endereco = ${dados.endereco}, cidade = ${dados.cidade}, rev = rev + 1, atualizado_por = ${s.efetivo.id}, atualizado_em = now() where empresa_id = ${emp} returning rev`)[0]
    : (await tx`insert into empresa_identidade (empresa_id, timbrado_arquivo_id, representante, endereco, cidade, atualizado_por) values (${emp}, ${timbrado}, ${tx.json(rep)}, ${dados.endereco}, ${dados.cidade}, ${s.efetivo.id}) returning rev`)[0];
  await auditar(tx, s, emp, 'identidade', emp, old ? 'alterar' : 'incluir', row.rev, { timbrado: !!timbrado, representante: rep.nome });
  const a = timbrado ? (await tx`select nome from arquivos where id = ${timbrado}`)[0] : null;
  return { ident: { timbrado: timbrado ? { id: timbrado, nome: nomeTimbrado || a?.nome } : null, rep, end: dados.endereco, cid: dados.cidade, rev: row.rev } };
}

/** Peça-modelo enviada pela empresa: o texto extraído vira referência de estilo para a IA. */
export async function incluirModelo(tx: Tx, s: Sessao, b: any) {
  const emp = txt(b.emp, 20); exige(await perms(tx, s, emp), PODE, 'cadastrar peças-modelo');
  const tipo = txt(b.tipo, 3); if (!(tipo in TIPOS)) throw new Recusa(400, 'Tipo de peça inválido.');
  const a = (await tx`select id, caminho, nome from arquivos where id = ${String(b.arqId)} and empresa_id = ${emp}`)[0];
  if (!a) throw new Recusa(403, 'Arquivo fora do escopo da empresa.');
  const partes = await extrair(a.nome, await ler(a.caminho));
  const texto = partes.map((p) => p.texto).join('\n\n').replace(/\[página \d+\]\n?/g, '').trim();
  if (texto.length < 300) throw new Recusa(422, partes.some((p) => p.escaneado) ? 'O arquivo é uma imagem digitalizada, sem texto. Envie a peça em Word ou em PDF com texto selecionável.' : 'Não foi possível ler o texto do arquivo. Envie em Word (.docx), PDF com texto ou .txt.');
  const titulo = txt(b.titulo, 160) || a.nome;
  const r = (await tx`insert into pecas_modelo (empresa_id, tipo, titulo, arquivo_id, texto, criado_por) values (${emp}, ${tipo}, ${titulo}, ${a.id}, ${texto.slice(0, 60000)}, ${s.efetivo.id}) returning id, criado_em`)[0];
  await auditar(tx, s, emp, 'peca_modelo', r.id, 'incluir', null, { tipo, titulo });
  return { modelo: { id: r.id, tipo, titulo, arqId: a.id, chars: Math.min(texto.length, 60000), by: s.efetivo.nome, d: String(r.criado_em).slice(0, 10) } };
}

export async function desativarModelo(tx: Tx, s: Sessao, b: any) {
  const m = (await tx`select id, empresa_id, titulo from pecas_modelo where id = ${String(b.id)}`)[0];
  if (!m) throw new Recusa(403, 'Peça-modelo inexistente ou fora do seu escopo.');
  exige(await perms(tx, s, m.empresa_id), PODE, 'remover peças-modelo');
  await tx`update pecas_modelo set ativo = false where id = ${m.id}`;
  await auditar(tx, s, m.empresa_id, 'peca_modelo', m.id, 'desativar', null, { titulo: m.titulo });
  return {};
}

/** Configurações da administração (prompts e modelo de IA). Valor vazio volta ao padrão do sistema. */
export const CHAVES_CONFIG = [CHAVE_PROMPT, CHAVE_MODELO, ...Object.keys(TIPOS).map(chaveInstr)];
export async function salvarConfig(tx: Tx, s: Sessao, b: any) {
  if (!s.efetivo.admin) throw new Recusa(403, 'Somente a administração altera as configurações de IA.');
  const chave = String(b.chave); if (!CHAVES_CONFIG.includes(chave)) throw new Recusa(400, 'Configuração desconhecida.');
  const valor = String(b.valor ?? '').slice(0, 20000).trim();
  await tx`insert into configuracoes (chave, valor, atualizado_por, atualizado_em) values (${chave}, ${valor}, ${s.efetivo.id}, now())
           on conflict (chave) do update set valor = excluded.valor, atualizado_por = excluded.atualizado_por, atualizado_em = now()`;
  await auditar(tx, s, null, 'configuracao', chave, valor ? 'alterar' : 'padrao', null, { tamanho: valor.length });
  return {};
}
