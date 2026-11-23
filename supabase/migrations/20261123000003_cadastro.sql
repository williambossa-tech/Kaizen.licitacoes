-- Kaizen B2G · cadastro de empresas e usuários pela Administração
-- Aplicada pelo migrate.mjs como kb_app (dono das tabelas); não altera funções.

-- administrador do sistema independe de vínculo com empresa (permite cadastrar a primeira empresa num banco vazio)
alter table perfis add column if not exists administrador boolean not null default false;
update perfis set administrador = true where slug = 'william';
-- usuário desativado não entra no sistema (o histórico e a auditoria ficam preservados)
alter table perfis add column if not exists ativo boolean not null default true;

-- dados da Receita Federal no momento do cadastro (situação, CNAE, sócios, endereço)
alter table empresas add column if not exists dados_cadastrais jsonb;
