import crypto from 'node:crypto';
import { sql } from './db';
import type { Sessao } from './sessao';
import { Recusa, auditar } from './regras';
import { cnpjValido, formatarCnpj, soDigitos, enderecoCompleto, capitalizar, type Cadastro } from './cnpj';

/**
 * Cadastro de empresas e usuários pela Administração. Só o administrador do sistema; as gravações usam a conexão
 * da aplicação (sem RLS) porque a primeira empresa é criada antes de existir qualquer vínculo, e por isso a checagem
 * de administrador é feita aqui, antes de qualquer escrita.
 */
const txt = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
export const PERMISSOES = ['consultar', 'preparar', 'aprovar', 'decidir', 'preco', 'juridico', 'financeiro', 'admin'];
const exigeAdmin = (s: Sessao) => { if (!s.real.admin) throw new Recusa(403, 'Somente o administrador do sistema cadastra empresas e usuários.'); };

export async function salvarEmpresa(s: Sessao, b: any) {
  exigeAdmin(s);
  const d = soDigitos(b.cnpj); if (!cnpjValido(d)) throw new Recusa(422, 'CNPJ inválido: confira os 14 dígitos.');
  const razao = txt(b.razao, 200); if (!razao) throw new Recusa(422, 'Informe a razão social.');
  const curto = txt(b.curto, 60) || capitalizar(razao.split(/\s+/).slice(0, 2).join(' '));
  const comercial = txt(b.comercial, 60) || 'Cliente externo';
  const societaria = txt(b.societaria, 60) || null;
  const autorizada = b.autorizada !== false;
  const cad: Partial<Cadastro> | null = b.cadastro && typeof b.cadastro === 'object' ? b.cadastro : null;
  return sql().begin(async (tx) => {
    const dup = (await tx`select id from empresas where regexp_replace(cnpj, '\\D', '', 'g') = ${d}`)[0];
    let id: string = b.id ? String(b.id) : '';
    if (id) {
      const old = (await tx`select id from empresas where id = ${id}`)[0]; if (!old) throw new Recusa(404, 'Empresa não encontrada.');
      if (dup && dup.id !== id) throw new Recusa(409, 'Já existe outra empresa com este CNPJ.');
      await tx`update empresas set razao_social = ${razao}, nome_curto = ${curto}, cnpj = ${formatarCnpj(d)}, vinculo_comercial = ${comercial}, participacao_societaria = ${societaria}, autorizacao_operacional = ${autorizada}${cad ? tx`, dados_cadastrais = ${tx.json(cad as any)}` : tx``} where id = ${id}`;
    } else {
      if (dup) throw new Recusa(409, 'Esta empresa já está cadastrada.');
      id = 'E' + d;
      await tx`insert into empresas (id, razao_social, nome_curto, cnpj, vinculo_comercial, participacao_societaria, autorizacao_operacional, dados_cadastrais)
               values (${id}, ${razao}, ${curto}, ${formatarCnpj(d)}, ${comercial}, ${societaria}, ${autorizada}, ${cad ? tx.json(cad as any) : null})`;
      // quem cadastra passa a ter acesso completo à nova empresa
      await tx`insert into vinculos (usuario_id, empresa_id, permissoes) values (${s.real.id}, ${id}, ${PERMISSOES}) on conflict (usuario_id, empresa_id) do update set permissoes = excluded.permissoes`;
    }
    // endereço e representante legal para as peças (só preenche o que ainda não foi cadastrado)
    const endereco = txt(b.endereco, 300) || (cad ? enderecoCompleto(cad) : '');
    const cidade = txt(b.cidade, 80) || (cad?.municipio ? `${capitalizar(cad.municipio)}/${cad.uf || ''}` : '');
    const rep = b.rep && txt(b.rep.nome, 160) ? { nome: txt(b.rep.nome, 160), cargo: txt(b.rep.cargo, 120), cpf: txt(b.rep.cpf, 20) } : null;
    if (endereco || cidade || rep) {
      const idt = (await tx`select representante, endereco, cidade from empresa_identidade where empresa_id = ${id}`)[0];
      if (!idt) await tx`insert into empresa_identidade (empresa_id, representante, endereco, cidade, atualizado_por) values (${id}, ${tx.json(rep || {})}, ${endereco || null}, ${cidade || null}, ${s.real.id})`;
      else await tx`update empresa_identidade set endereco = coalesce(endereco, ${endereco || null}), cidade = coalesce(cidade, ${cidade || null}),
                    representante = case when coalesce(representante->>'nome', '') = '' and ${!!rep} then ${tx.json(rep || {})} else representante end, rev = rev + 1 where empresa_id = ${id}`;
    }
    await auditar(tx, s, id, 'empresa', id, b.id ? 'alterar' : 'incluir', null, { razao, cnpj: formatarCnpj(d), autorizada, fonte: cad?.fonte || 'manual' });
    return { id };
  });
}

/* ---------- usuários ---------- */
async function contaLogin(email: string, senha: string, authId: string | null) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY, base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !base) return authId; // ambiente local: login pelo seletor de perfil
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  if (authId) {
    const r = await fetch(`${base}/auth/v1/admin/users/${authId}`, { method: 'PUT', headers: h, body: JSON.stringify({ email, password: senha, email_confirm: true }) });
    if (!r.ok) throw new Recusa(502, 'Não foi possível atualizar a senha no Supabase: ' + (await r.text()).slice(0, 120));
    return authId;
  }
  const r = await fetch(`${base}/auth/v1/admin/users`, { method: 'POST', headers: h, body: JSON.stringify({ email, password: senha, email_confirm: true }) });
  const u = await r.json().catch(() => ({}));
  if (r.ok && u.id) return u.id as string;
  // a conta já existe no Supabase: localiza pelo e-mail e redefine a senha
  const l = await (await fetch(`${base}/auth/v1/admin/users?per_page=1000`, { headers: h })).json().catch(() => ({}));
  const ex = (l.users || []).find((x: any) => String(x.email || '').toLowerCase() === email.toLowerCase());
  if (!ex) throw new Recusa(502, 'Não foi possível criar o login no Supabase: ' + String(u.msg || u.message || u.error_description || r.status).slice(0, 120));
  return contaLogin(email, senha, ex.id);
}

export async function salvarUsuario(s: Sessao, b: any) {
  exigeAdmin(s);
  const nome = txt(b.nome, 120), email = txt(b.email, 160).toLowerCase(), papel = txt(b.papel, 120) || 'Usuário';
  if (!nome) throw new Recusa(422, 'Informe o nome.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Recusa(422, 'Informe um e-mail válido.');
  const senha = String(b.senha || '');
  if (senha && senha.length < 8) throw new Recusa(422, 'A senha precisa ter pelo menos 8 caracteres.');
  const vinc: { emp: string; perms: string[]; designado: boolean }[] = (Array.isArray(b.vinculos) ? b.vinculos : [])
    .map((v: any) => ({ emp: String(v.emp), perms: (Array.isArray(v.perms) ? v.perms : []).map(String).filter((p: string) => PERMISSOES.includes(p)), designado: !!v.designado }))
    .filter((v: any) => v.perms.length);
  const db = sql();
  const old = b.id ? (await db`select * from perfis where id = ${String(b.id)}`)[0] : null;
  if (b.id && !old) throw new Recusa(404, 'Usuário não encontrado.');
  const outro = (await db`select id from perfis where lower(email) = ${email}`)[0];
  if (outro && (!old || outro.id !== old.id)) throw new Recusa(409, 'Já existe um usuário com este e-mail.');
  const eu = old && old.id === s.real.id;
  if (eu && (b.administrador === false || b.ativo === false)) throw new Recusa(422, 'Você não pode retirar o próprio acesso de administrador nem se desativar.');
  const prod = !!(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!old && prod && !senha) throw new Recusa(422, 'Defina uma senha inicial para o novo usuário.');
  // o login no Supabase é criado antes da gravação; se a gravação falhar, a conta fica sem perfil e não enxerga nada
  const authId = senha ? await contaLogin(email, senha, old?.auth_id || null) : old?.auth_id || null;
  return db.begin(async (tx) => {
    let id: string = old?.id;
    if (old) {
      await tx`update perfis set nome = ${nome}, email = ${email}, papel = ${papel}, consolida = ${!!b.consolida}, administrador = ${!!b.administrador}, ativo = ${b.ativo !== false}, auth_id = ${authId} where id = ${id}`;
    } else {
      id = crypto.randomUUID();
      let slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 40) || 'usuario';
      if ((await tx`select 1 from perfis where slug = ${slug}`).length) slug += '.' + id.slice(0, 4);
      await tx`insert into perfis (id, auth_id, slug, nome, papel, email, consolida, administrador, ativo) values (${id}, ${authId}, ${slug}, ${nome}, ${papel}, ${email}, ${!!b.consolida}, ${!!b.administrador}, true)`;
    }
    const emps = new Set((await tx`select id from empresas`).map((e) => e.id as string));
    await tx`delete from vinculos where usuario_id = ${id}`;
    await tx`delete from designados where usuario_id = ${id}`;
    for (const v of vinc) {
      if (!emps.has(v.emp)) continue;
      await tx`insert into vinculos (usuario_id, empresa_id, permissoes) values (${id}, ${v.emp}, ${v.perms})`;
      if (v.designado) await tx`insert into designados (empresa_id, usuario_id) values (${v.emp}, ${id})`;
    }
    await auditar(tx, s, null, 'usuario', id, old ? 'alterar' : 'incluir', null, { nome, email, empresas: vinc.map((v) => v.emp), senha: !!senha, administrador: !!b.administrador, ativo: b.ativo !== false });
    return { id };
  });
}

/** Listas completas para a tela de Administração (fora da RLS, só para o administrador). */
export async function listasAdmin(s: Sessao) {
  if (!s.real.admin) return { empresasAdm: [], perfisAdm: [] };
  const db = sql();
  const emps = await db`select e.*, i.endereco, i.cidade, i.representante from empresas e left join empresa_identidade i on i.empresa_id = e.id order by e.razao_social`;
  const perfis = await db`select * from perfis order by nome`;
  const vins = await db`select * from vinculos`; const des = await db`select * from designados`;
  return {
    empresasAdm: emps.map((e) => ({ id: e.id, nome: e.razao_social, curto: e.nome_curto, cnpj: e.cnpj, comercial: e.vinculo_comercial, societaria: e.participacao_societaria, autorizada: e.autorizacao_operacional, cad: e.dados_cadastrais || null, end: e.endereco, cid: e.cidade, rep: e.representante || {} })),
    perfisAdm: perfis.map((p) => ({
      id: p.id, nome: p.nome, email: p.email, papel: p.papel, admin: p.administrador, ativo: p.ativo, consolida: p.consolida, login: !!p.auth_id, eu: p.id === s.real.id,
      vinc: vins.filter((v) => v.usuario_id === p.id).map((v) => ({ emp: v.empresa_id, perms: v.permissoes, designado: des.some((d) => d.usuario_id === p.id && d.empresa_id === v.empresa_id) }))
    }))
  };
}
