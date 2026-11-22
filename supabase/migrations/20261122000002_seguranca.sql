-- Kaizen B2G · integridade entre empresas e políticas por linha (RLS)

-- ---------------------------------------------------------------- identidade do usuário corrente
create or replace function app_uid() returns uuid
language sql stable security definer set search_path = public as $$
  -- o servidor da aplicação define app.perfil_id na transação (inclui o modo demonstração auditado);
  -- acessos diretos pela API do Supabase caem no vínculo auth_id → perfil
  select coalesce(nullif(current_setting('app.perfil_id', true), '')::uuid,
                  (select id from perfis where auth_id = auth.uid()))
$$;

create or replace function app_empresas() returns setof text
language sql stable security definer set search_path = public as $$
  select v.empresa_id from vinculos v join empresas e on e.id = v.empresa_id
  where v.usuario_id = app_uid() and e.autorizacao_operacional
$$;

create or replace function app_pode(p text, e text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vinculos v join empresas x on x.id = v.empresa_id
                 where v.usuario_id = app_uid() and v.empresa_id = e and x.autorizacao_operacional and p = any(v.permissoes))
$$;

create or replace function app_escreve(e text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vinculos v join empresas x on x.id = v.empresa_id
                 where v.usuario_id = app_uid() and v.empresa_id = e and x.autorizacao_operacional
                 and v.permissoes && array['preparar','aprovar','decidir','preco','juridico','financeiro']::text[])
$$;

create or replace function app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vinculos where usuario_id = app_uid() and 'admin' = any(permissoes))
$$;

create or replace function app_ve_certame(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from participacoes p where p.certame_id = c and p.empresa_id in (select app_empresas()))
$$;

-- ---------------------------------------------------------------- integridade: o vínculo pertence à empresa correta
create or replace function trg_lote_da_participacao() returns trigger language plpgsql as $$
declare p participacoes;
begin
  select * into p from participacoes where id = new.participacao_id;
  if p.id is null then raise exception 'Participação inexistente'; end if;
  new.empresa_id := p.empresa_id; new.certame_id := p.certame_id;
  return new;
end $$;
create trigger lote_da_participacao before insert or update on participacao_lotes
  for each row execute function trg_lote_da_participacao();

create or replace function trg_contrato_da_empresa() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from participacoes p where p.empresa_id = new.empresa_id and p.certame_id = new.certame_id) then
    raise exception 'Contrato % não corresponde a uma participação da empresa %', new.id, new.empresa_id;
  end if;
  return new;
end $$;
create trigger contrato_da_empresa before insert or update on contratos for each row execute function trg_contrato_da_empresa();
create trigger ata_da_empresa before insert or update on atas for each row execute function trg_contrato_da_empresa();
create trigger pacote_da_empresa before insert or update on pacotes for each row execute function trg_contrato_da_empresa();
create trigger minuta_da_empresa before insert or update on minutas for each row execute function trg_contrato_da_empresa();

create or replace function trg_empresa_do_contrato() returns trigger language plpgsql as $$
begin
  select empresa_id into new.empresa_id from contratos where id = new.contrato_id;
  if new.empresa_id is null then raise exception 'Contrato inexistente'; end if;
  return new;
end $$;
create trigger nf_empresa before insert or update on notas_fiscais for each row execute function trg_empresa_do_contrato();
create trigger rec_empresa before insert or update on recebimentos for each row execute function trg_empresa_do_contrato();
create trigger dre_empresa before insert or update on dre_competencias for each row execute function trg_empresa_do_contrato();
create trigger lanc_empresa before insert or update on lancamentos for each row execute function trg_empresa_do_contrato();
create trigger ant_empresa before insert or update on antecipacoes for each row execute function trg_empresa_do_contrato();
create trigger nfrec_empresa before insert or update on nf_recepcoes for each row execute function trg_empresa_do_contrato();

-- notas fiscais e recebimentos são registros contábeis: não se alteram nem se apagam pela aplicação
create or replace function trg_somente_inclusao() returns trigger language plpgsql as $$
begin raise exception 'Registro imutável: % (use um lançamento de estorno)', tg_table_name; end $$;
create trigger nf_imutavel before update or delete on notas_fiscais for each row when (current_user = 'authenticated') execute function trg_somente_inclusao();
create trigger rec_imutavel before update or delete on recebimentos for each row when (current_user = 'authenticated') execute function trg_somente_inclusao();

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['empresas','perfis','vinculos','designados','certames','certame_lotes','certame_documentos','resultados','resultado_linhas',
    'participacoes','participacao_lotes','analises','decisoes','arquivos','acervo_documentos','pacotes','minutas','importacoes',
    'contratos','notas_fiscais','recebimentos','dre_competencias','lancamentos','antecipacoes','atas','nf_recepcoes','visoes','auditoria']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- empresas: só as autorizadas; administradores veem o cadastro inteiro (inclusive vínculo societário sem autorização)
create policy empresas_ler on empresas for select using (id in (select app_empresas()) or app_admin());
create policy perfis_ler on perfis for select using (
  id = app_uid() or app_admin() or exists (select 1 from vinculos v where v.usuario_id = perfis.id and v.empresa_id in (select app_empresas())));
create policy vinculos_ler on vinculos for select using (usuario_id = app_uid() or empresa_id in (select app_empresas()) or app_admin());
create policy designados_ler on designados for select using (empresa_id in (select app_empresas()));

-- certame público: visível a quem tem participação autorizada nele
create policy certames_ler on certames for select using (app_ve_certame(id));
create policy certames_incluir on certames for insert with check (true);       -- a importação cria o certame e a participação na mesma transação
create policy lotes_ler on certame_lotes for select using (app_ve_certame(certame_id));
create policy lotes_incluir on certame_lotes for insert with check (true);
create policy cdocs_ler on certame_documentos for select using (app_ve_certame(certame_id));
create policy cdocs_incluir on certame_documentos for insert with check (enviado_por_empresa in (select app_empresas()) and app_escreve(enviado_por_empresa));
create policy res_ler on resultados for select using (app_ve_certame(certame_id));
create policy resl_ler on resultado_linhas for select using (app_ve_certame(certame_id));

-- entidades privadas: leitura no escopo da empresa; escrita só com permissão de escrita naquela empresa
do $$
declare t text;
begin
  foreach t in array array['participacoes','participacao_lotes','analises','decisoes','arquivos','acervo_documentos','pacotes','minutas','importacoes',
    'contratos','notas_fiscais','recebimentos','dre_competencias','lancamentos','antecipacoes','atas','nf_recepcoes']
  loop
    execute format('create policy %I on %I for select using (empresa_id in (select app_empresas()))', t||'_ler', t);
    execute format('create policy %I on %I for insert with check (empresa_id in (select app_empresas()) and app_escreve(empresa_id))', t||'_incluir', t);
    execute format('create policy %I on %I for update using (empresa_id in (select app_empresas()) and app_escreve(empresa_id)) with check (empresa_id in (select app_empresas()) and app_escreve(empresa_id))', t||'_alterar', t);
  end loop;
end $$;

create policy visoes_proprias on visoes for all using (usuario_id = app_uid()) with check (usuario_id = app_uid());
create policy auditoria_ler on auditoria for select using (empresa_id in (select app_empresas()) or app_admin());
create policy auditoria_incluir on auditoria for insert with check (usuario_id = app_uid() and (empresa_id is null or empresa_id in (select app_empresas())));

grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on all tables in schema public from anon;
