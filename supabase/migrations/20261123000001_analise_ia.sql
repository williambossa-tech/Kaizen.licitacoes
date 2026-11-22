-- Kaizen B2G · análise de exigências por IA e documentos do edital vindos do PNCP
-- Aplicada pelo migrate.mjs como kb_app (dono das tabelas); não altera funções.

-- 1. documento do edital: origem no PNCP (CNPJ/ANO/SEQ/DOC), para não baixar duas vezes
alter table certame_documentos add column if not exists origem text;
create unique index if not exists certame_documentos_origem on certame_documentos (certame_id, origem) where origem is not null;

-- 2. análise de exigências: metadados da geração (modelo, fontes lidas, resumo, data e autor)
alter table analises add column if not exists meta jsonb;

-- 3. configurações gerais ajustáveis pela administração (ex.: prompt da análise de exigências)
create table if not exists configuracoes (
  chave text primary key,
  valor text not null,
  atualizado_por uuid references perfis(id),
  atualizado_em timestamptz not null default now()
);
alter table configuracoes enable row level security;
revoke all on configuracoes from anon;
grant select, insert, update on configuracoes to authenticated;
drop policy if exists config_ler on configuracoes;
create policy config_ler on configuracoes for select using (exists (select 1 from app_empresas()));
drop policy if exists config_incluir on configuracoes;
create policy config_incluir on configuracoes for insert with check (app_admin());
drop policy if exists config_alterar on configuracoes;
create policy config_alterar on configuracoes for update using (app_admin()) with check (app_admin());
