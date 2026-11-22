\set ON_ERROR_STOP 0
-- Bruno (Beta) não vê nada da Alfa
begin; set local role authenticated; select set_config('app.perfil_id','00000000-0000-4000-8000-000000000007',true);
select 'bruno participacoes', count(*), string_agg(distinct empresa_id,',') from participacoes;
select 'bruno contratos alfa', count(*) from contratos where empresa_id='A';
select 'bruno acervo alfa', count(*) from acervo_documentos where empresa_id='A';
select 'bruno ve certame so da alfa (TJPR)', count(*) from certames where id='CRT-PR-0103';
select 'bruno empresas', string_agg(id,',') from empresas;
rollback;
-- Rui (consulta da Alfa) lê, mas não altera
begin; set local role authenticated; select set_config('app.perfil_id','00000000-0000-4000-8000-000000000006',true);
select 'rui lotes', count(*) from participacao_lotes;
update participacao_lotes set etapa='x' where certame_id='CRT-PR-0101';
select 'rui alterou (deve ser 0)', count(*) from participacao_lotes where etapa='x';
rollback;
-- William consolida as duas e vê Gama no cadastro (admin), sem dados dela
begin; set local role authenticated; select set_config('app.perfil_id','00000000-0000-4000-8000-000000000001',true);
select 'william empresas', string_agg(id,','), 'participacoes', (select count(*) from participacoes) from empresas;
-- integridade: contrato não pode apontar para certame sem participação da empresa
insert into contratos(id,empresa_id,certame_id,lote,numero,instrumento,assinatura,fim,valor,quantidade,unidade,margem_prevista) values('X','B','CRT-PR-0103',1,'x','x','2026-01-01','2026-12-31',1,1,'un',1);
rollback;
-- nota fiscal é imutável para a aplicação
begin; set local role authenticated; select set_config('app.perfil_id','00000000-0000-4000-8000-000000000001',true);
update notas_fiscais set valor=1 where numero='NF 1.204';
rollback;
-- peças: timbrado, representante e peças-modelo ficam na empresa; configurações de IA só a administração altera
begin;
insert into empresa_identidade (empresa_id, representante, cidade) values ('A', '{"nome":"Rep Alfa"}', 'Curitiba/PR') on conflict do nothing;
insert into pecas_modelo (empresa_id, tipo, titulo, texto) values ('A', 'esc', 'modelo alfa', 'texto');
set local role authenticated; select set_config('app.perfil_id','00000000-0000-4000-8000-000000000007',true);
select 'bruno identidade alfa (deve ser 0)', count(*) from empresa_identidade where empresa_id='A';
select 'bruno modelos alfa (deve ser 0)', count(*) from pecas_modelo where empresa_id='A';
insert into pecas_modelo (empresa_id, tipo, titulo, texto) values ('A', 'esc', 'invasao', 'x');
rollback;
begin; set local role authenticated; select set_config('app.perfil_id','00000000-0000-4000-8000-000000000006',true);
insert into empresa_identidade (empresa_id, cidade) values ('A', 'x');
rollback;
begin; set local role authenticated; select set_config('app.perfil_id','00000000-0000-4000-8000-000000000002',true);
insert into configuracoes (chave, valor) values ('instr_peca_esc', 'x');
rollback;
