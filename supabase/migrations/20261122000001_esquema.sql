-- Kaizen B2G · esquema inicial
-- Convenções: valores monetários em numeric(18,2); quantidades em numeric(18,4);
-- toda entidade privada carrega empresa_id e é protegida por RLS; "rev" controla concorrência otimista.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- organização e acesso
create table empresas (
  id text primary key,
  razao_social text not null,
  nome_curto text not null,
  cnpj text not null unique,
  vinculo_comercial text not null default 'Cliente externo',
  participacao_societaria text,            -- participação societária da Kaizen (não concede acesso)
  autorizacao_operacional boolean not null default false,
  ufs_sem_cobertura text[] not null default '{}',
  projetos jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create table perfis (
  id uuid primary key,
  auth_id uuid unique,                     -- usuário do Supabase Auth vinculado
  slug text not null unique,
  nome text not null,
  papel text not null,
  email text,
  demo boolean not null default false,     -- conta de demonstração (pode ser assumida por administrador em modo demo)
  consolida boolean not null default false,
  criado_em timestamptz not null default now()
);

create table vinculos (
  usuario_id uuid not null references perfis(id) on delete cascade,
  empresa_id text not null references empresas(id),
  permissoes text[] not null,
  primary key (usuario_id, empresa_id),
  constraint permissoes_validas check (permissoes <@ array['consultar','preparar','aprovar','decidir','preco','juridico','financeiro','admin']::text[])
);

create table designados (                  -- partes que deliberam orçamento e reconfirmam preço
  empresa_id text not null references empresas(id),
  usuario_id uuid not null references perfis(id),
  primary key (empresa_id, usuario_id)
);

-- ---------------------------------------------------------------- certame público
create table certames (
  id text primary key,
  orgao text not null,
  unidade text,
  sede_uf char(2),
  exec_ufs text[] not null default '{}',
  numero text not null,
  modalidade text not null default 'Pregão eletrônico',
  criterio text not null default 'Menor preço por lote',
  portal text,
  objeto text not null,
  publicacao date not null,
  sessao timestamp,                        -- horário de Brasília (America/Sao_Paulo)
  encerramento_tipo text,
  encerramento_data date,
  situacao_oficial text,
  cancelado boolean not null default false,
  fonte text not null default 'Adaptador de demonstração',
  id_externo text,
  criado_em timestamptz not null default now()
);
create unique index certames_orgao_numero on certames (lower(orgao), numero);

create table certame_lotes (
  certame_id text not null references certames(id) on delete cascade,
  n int not null,
  descricao text not null,
  quantidade numeric(18,4) not null,
  unidade text not null,
  ufs text[],                              -- null: herda do certame; mais de uma UF sem rateio = multiestadual
  valor_referencia numeric(18,2) not null default 0,
  primary key (certame_id, n)
);

create table certame_documentos (
  id uuid primary key default gen_random_uuid(),
  certame_id text not null references certames(id) on delete cascade,
  nome text not null,
  versao int not null default 1,
  publicado date,
  paginas int,
  retificacao boolean not null default false,
  arquivo_id uuid,
  enviado_por_empresa text references empresas(id),
  unique (certame_id, nome, versao)
);

create table resultados (
  certame_id text not null,
  n int not null,
  fonte text,
  cobertura text not null default 'completa' check (cobertura in ('completa','parcial')),
  provisorio boolean not null default false,
  primary key (certame_id, n),
  foreign key (certame_id, n) references certame_lotes on delete cascade
);
create table resultado_linhas (
  certame_id text not null,
  n int not null,
  ordem int not null,
  posicao int,                             -- posição oficial; nula para desclassificado/inabilitado
  fornecedor text not null,
  situacao text not null,
  oferta_inicial numeric(18,2),            -- nula = não informada pela fonte (nunca zero)
  melhor_oferta numeric(18,2),
  valor_aceito numeric(18,2),
  motivo text,
  primary key (certame_id, n, ordem),
  foreign key (certame_id, n) references resultados on delete cascade
);

-- ---------------------------------------------------------------- participação privada
create table participacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references empresas(id),
  certame_id text not null references certames(id),
  projeto text,
  criado_em timestamptz not null default now(),
  unique (empresa_id, certame_id)
);

create table participacao_lotes (
  participacao_id uuid not null references participacoes(id) on delete cascade,
  empresa_id text not null,
  certame_id text not null,
  n int not null,
  estado jsonb not null,                   -- decisão, etapa, frentes, orçamento versionado, deliberação, lances, reconfirmação, histórico
  decisao text,
  etapa text,
  resultado text,
  responsavel text,
  prazo date,
  oferta numeric(18,2),
  valor_homologado numeric(18,2),
  data_homologacao date,
  rev int not null default 1,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references perfis(id),
  primary key (participacao_id, n),
  foreign key (certame_id, n) references certame_lotes
);
create index participacao_lotes_empresa on participacao_lotes (empresa_id);

create table analises (                    -- análise de exigências por CNPJ, lote e versão do edital
  empresa_id text not null references empresas(id),
  certame_id text not null,
  n int not null,
  itens jsonb not null,
  rev int not null default 1,
  primary key (empresa_id, certame_id, n),
  foreign key (certame_id, n) references certame_lotes
);

create table decisoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references empresas(id),
  certame_id text not null,
  n int not null,
  decisao text not null,
  justificativa text not null,
  condicionantes text,
  versao_analise int,
  reaberta boolean not null default false,
  por uuid references perfis(id),
  em timestamptz not null default now()
);

-- ---------------------------------------------------------------- acervo, pacotes e peças
create table arquivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references empresas(id),
  caminho text not null unique,
  nome text not null,
  mime text,
  tamanho bigint,
  criado_por uuid references perfis(id),
  criado_em timestamptz not null default now()
);

create table acervo_documentos (
  id text primary key,
  empresa_id text not null references empresas(id),
  pasta text not null check (pasta in ('jur','fis','eco','tec','dec','out')),
  tipo text not null,
  emissor text,
  emissao date,
  validade date,
  validade_tipo text not null default 'data' check (validade_tipo in ('data','sem','desconhecida')),
  versao int not null default 1,
  arquivo_nome text,
  arquivo_id uuid references arquivos(id),
  conferido boolean not null default true,
  arquivado boolean not null default false,
  modelo text,
  tag text,
  historico jsonb not null default '[]'::jsonb,   -- versões anteriores, preservadas
  rev int not null default 1
);

create table pacotes (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references empresas(id),
  certame_id text not null references certames(id),
  versao int not null,
  gerado_em date not null,
  gerado_por text not null,
  itens jsonb not null,                    -- cópia exata (versão, validade, arquivo) de cada documento
  irregularidade text,
  apresentado_em date,
  comprovante text,
  unique (empresa_id, certame_id, versao)
);

create table minutas (
  empresa_id text not null references empresas(id),
  certame_id text not null references certames(id),
  tipo text not null check (tipo in ('esc','imp','rec','ctr')),
  versoes jsonb not null default '[]'::jsonb,
  rev int not null default 1,
  primary key (empresa_id, certame_id, tipo)
);

create table importacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references empresas(id),
  por uuid references perfis(id),
  em timestamptz not null default now(),
  licitacoes int not null,
  erros int not null,
  linhas jsonb not null
);

-- ---------------------------------------------------------------- contratos, execução e financeiro
create table contratos (
  id text primary key,
  empresa_id text not null references empresas(id),
  certame_id text not null,
  lote int not null,
  numero text not null,
  instrumento text not null,
  assinatura date not null,
  fim date not null,
  valor numeric(18,2) not null,
  quantidade numeric(18,4) not null,
  unidade text not null,
  margem_prevista numeric(9,4) not null,
  execucao jsonb not null default '{}'::jsonb,   -- empenhos, reservas, aditivos, postos, alocações, medições
  rev int not null default 1,
  foreign key (certame_id, lote) references certame_lotes
);

create table notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  contrato_id text not null references contratos(id),
  empresa_id text not null,
  numero text not null,
  emissao date not null,
  valor numeric(18,2) not null,
  quantidade_texto text,
  unique (contrato_id, numero)               -- reimportar a mesma nota não duplica
);

create table recebimentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id text not null references contratos(id),
  empresa_id text not null,
  data date not null,
  valor numeric(18,2) not null,
  titulo text
);

create table dre_competencias (
  contrato_id text not null references contratos(id),
  empresa_id text not null,
  competencia char(7) not null,
  receita_bruta numeric(18,2) not null,
  receita_liquida numeric(18,2) not null,
  resultado numeric(18,2) not null,
  primary key (contrato_id, competencia)
);

create table lancamentos (
  id text primary key,
  contrato_id text not null references contratos(id),
  empresa_id text not null,
  competencia char(7) not null,
  grupo text not null check (grupo in ('rb','ded','var','fix','rat','fin')),
  valor numeric(18,2) not null,
  descricao text not null,
  documento text
);

create table antecipacoes (
  contrato_id text not null references contratos(id),
  empresa_id text not null,
  nf_numero text not null,
  data date not null,
  principal numeric(18,2) not null,
  liquido numeric(18,2) not null,
  custo numeric(18,2) not null,
  fundo text,
  liquidacao date,
  primary key (contrato_id, nf_numero)
);

create table atas (
  id text primary key,
  empresa_id text not null references empresas(id),
  certame_id text not null references certames(id),
  numero text not null,
  inicio date not null,
  fim date not null,
  item text not null,
  unidade text not null,
  registrado numeric(18,4) not null,
  preco numeric(18,2) not null,
  dados jsonb not null default '{}'::jsonb,   -- pedidos, períodos, parâmetros de alerta e economia
  rev int not null default 1
);

create table nf_recepcoes (
  id text primary key,
  empresa_id text not null references empresas(id),
  contrato_id text not null references contratos(id),
  numero text not null,
  valor numeric(18,2),
  apresentacao date,
  recebido_em timestamptz not null default now(),
  arquivo_id uuid references arquivos(id),
  kit jsonb,
  rev int not null default 1,
  unique (contrato_id, numero)
);

create table visoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references perfis(id) on delete cascade,
  nome text not null,
  config jsonb not null,
  criado_em timestamptz not null default now()
);

create table auditoria (
  id bigserial primary key,
  em timestamptz not null default now(),
  usuario_id uuid references perfis(id),
  atuando_como uuid references perfis(id),
  empresa_id text,
  entidade text not null,
  chave text not null,
  acao text not null,
  versao int,
  justificativa text,
  resumo jsonb
);
create index auditoria_entidade on auditoria (entidade, chave);
