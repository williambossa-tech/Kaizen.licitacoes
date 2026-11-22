-- Kaizen B2G · endurecimento para o Supabase
-- No Supabase, tabelas e funções novas recebem por padrão privilégios amplos para "anon" e "authenticated"
-- (inclusive DELETE e TRUNCATE, que não passam pela RLS). Toda a aplicação acessa o banco pelo servidor;
-- aqui ficam só os privilégios que as políticas pressupõem.

-- 1. nada para o papel anônimo; authenticated sem apagar/truncar
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
revoke delete, truncate, references, trigger on all tables in schema public from authenticated;
grant execute on function app_uid(), app_empresas(), app_pode(text, text), app_escreve(text), app_admin(), app_ve_certame(text) to authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- 2. controle de migrações: invisível para a aplicação
alter table _migracoes enable row level security;
revoke all on _migracoes from authenticated, anon;

-- 3. incluir certame/lote exige um perfil com ao menos uma empresa autorizada
--    (uma conta criada no Supabase sem vínculo não consegue gravar nada)
drop policy certames_incluir on certames;
create policy certames_incluir on certames for insert with check (exists (select 1 from app_empresas()));
drop policy lotes_incluir on certame_lotes;
create policy lotes_incluir on certame_lotes for insert with check (exists (select 1 from app_empresas()));

-- 4. caminho de busca fixo nas funções de gatilho
alter function trg_lote_da_participacao() set search_path = public;
alter function trg_contrato_da_empresa() set search_path = public;
alter function trg_empresa_do_contrato() set search_path = public;
alter function trg_somente_inclusao() set search_path = public;
