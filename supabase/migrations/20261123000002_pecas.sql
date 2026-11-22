-- Kaizen B2G · peças jurídicas: papel timbrado, representante legal e peças-modelo (aprendizado de estilo)
-- Aplicada pelo migrate.mjs como kb_app (dono das tabelas); não altera funções.

-- 1. identidade da empresa nas peças: modelo Word do papel timbrado e dados do representante legal
create table if not exists empresa_identidade (
  empresa_id text primary key references empresas(id),
  timbrado_arquivo_id uuid references arquivos(id),
  representante jsonb not null default '{}'::jsonb,   -- {nome, cargo, cpf, rg, email, telefone}
  endereco text,
  cidade text,                                         -- local que vai no fecho ("Curitiba/PR")
  rev int not null default 1,
  atualizado_por uuid references perfis(id),
  atualizado_em timestamptz not null default now()
);

-- 2. peças-modelo enviadas pela empresa, por tipo; o texto extraído é a referência de estilo para a IA
create table if not exists pecas_modelo (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references empresas(id),
  tipo text not null check (tipo in ('esc','imp','rec','ctr')),
  titulo text not null,
  arquivo_id uuid references arquivos(id),
  texto text not null,
  ativo boolean not null default true,
  criado_por uuid references perfis(id),
  criado_em timestamptz not null default now()
);
create index if not exists pecas_modelo_emp on pecas_modelo (empresa_id, tipo) where ativo;

do $$
declare t text;
begin
  foreach t in array array['empresa_identidade','pecas_modelo'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update on %I to authenticated', t);
    execute format('drop policy if exists %I on %I', t||'_ler', t);
    execute format('create policy %I on %I for select using (empresa_id in (select app_empresas()))', t||'_ler', t);
    execute format('drop policy if exists %I on %I', t||'_incluir', t);
    execute format('create policy %I on %I for insert with check (empresa_id in (select app_empresas()) and app_escreve(empresa_id))', t||'_incluir', t);
    execute format('drop policy if exists %I on %I', t||'_alterar', t);
    execute format('create policy %I on %I for update using (empresa_id in (select app_empresas()) and app_escreve(empresa_id)) with check (empresa_id in (select app_empresas()) and app_escreve(empresa_id))', t||'_alterar', t);
  end loop;
end $$;
