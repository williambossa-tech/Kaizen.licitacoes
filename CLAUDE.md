# Kaizen B2G · contexto do projeto

> Arquivo de contexto para desenvolvimento no VS Code (Claude Code e outros assistentes). Leia antes de alterar qualquer coisa.
> Responsável: William Bossa (Kaizen Partners), não é desenvolvedor: explicações para ele devem ser em português simples, sem jargão.

## 1. O que é

Plataforma **multiempresa** de licitações públicas e rentabilidade contratual, em **pt-BR**, responsiva e instalável (PWA). Cada empresa cliente (CNPJ) vê só os próprios dados. Cobre:

| Template | Tela | Arquivo (front) |
|---|---|---|
| T1 | Mapa do Brasil / BI geográfico (painel de entrada) | `public/app/core.js`, `geo.js` |
| T2 | Ficha da licitação, importação (planilha e PNCP), análise de exigências, decisão de participação | `t2.js` |
| — | Busca no PNCP com filtros e seleção; aba Análise prévia (edital, anexos, esclarecimentos → participar ou arquivar) | `prev.js` |
| — | Tema escuro/claro, menu lateral, grade e tela cheia nas tabelas | `tema.css`, `tema.js` |
| T3 | Acervo de habilitação (certidões por empresa), pacote de documentos, peças jurídicas com IA no papel timbrado | `t3.js` |
| T4 | Orçamento de referência, deliberação com alçadas, reconfirmação após lances | `t4.js` |
| T5 | Disputa, resultados e inteligência competitiva | `t5.js` |
| T6 | Execução de bens: contrato, ata de registro de preços, empenhos, reservas | `t6.js` |
| T7 | Execução de serviços de TI (postos, UST, SLA, medições) | `t7.js` |
| T8 | Recepção de nota fiscal e kit de obrigações | `t8.js` |
| T9 | DRE por contrato, lançamentos, antecipações, visões salvas | `t9.js` |
| — | Fluxo BPMN do processo | `bpmn.js` |

A especificação original é o arquivo "Prompt_Claude_Licitacoes_Inteligencia_e_DRE.md" (mantido fora do repositório). Os 9 templates foram aprovados como protótipo e depois implementados como sistema real.

## 2. Onde está publicado

| Item | Valor |
|---|---|
| Produção | https://kaizen-b2g-web-production.up.railway.app |
| Repositório | github.com/williambossa-tech/Kaizen.licitacoes (branch `main`; cada push publica sozinho) |
| Railway | projeto `kaizen-b2g`, serviço `kaizen-b2g-web`, ambiente `production`; healthcheck `/api/saude` |
| Supabase | projeto "Kaizen Licitações", ref `isdxzqkijalfxgviafwr`, região us-east-1, Postgres 17 |
| Login do administrador | william.bossa@kaizenpartners.com.br (Supabase Auth, senha) |

## 3. Arquitetura

```
Navegador ──> Next.js 15 (App Router, TypeScript) no Railway ──> Postgres do Supabase (RLS)
   │                │                                        └─> Supabase Storage (bucket "privado")
   │                ├─> Supabase Auth (sessão por cookie, @supabase/ssr)
   │                ├─> API pública do PNCP
   │                └─> OpenAI Responses API (opcional, minutas)
   └─ telas em JavaScript puro (public/app), servidas por /plataforma com os dados embutidos
```

- **Telas**: as telas validadas nos templates, em JS sem framework, em `public/app/`. A rota `src/app/plataforma/route.ts` lê `shell.html` e embute `window.KB_DATA` (já filtrado pela RLS do usuário).
- **Gravação**: cada ação da tela altera o estado local; `K.flush()` (`util.js`) compara com a linha de base e envia as diferenças para `POST /api/sync`. O servidor (`src/lib/regras.ts`) valida permissões e regras de negócio antes de gravar. Em caso de erro, a tela avisa e recarrega.
- **Banco**: `postgres` (porsager) com `prepare: false` (pooler em modo transação). Cada requisição roda em `comPerfil(perfilId, fn)` (`src/lib/db.ts`): abre transação, `set local role authenticated` e `set_config('app.perfil_id', …)`. Assim **o próprio banco** aplica a RLS.

### Pastas
```
src/app/api/acao        importar planilha, gerar pacote, recepcionar NF, abrir recepção, salvar visão
src/app/api/arquivos    upload (25 MB, confere permissão) e download por id (sob RLS)
src/app/api/dados       recarga dos dados do usuário
src/app/api/demo        "atuar como" perfil de demonstração (cookie assinado kb_atuar)
src/app/api/ia          IA em streaming: /ia/peca (peças jurídicas), /ia/exigencias (análise de habilitação), /ia (genérica); 503 sem chave → rascunho por modelo
src/app/api/pecas/docx  peça em Word no papel timbrado da empresa, com fecho e assinatura do representante
src/app/api/pncp        consulta (GET) e download/versionamento de documentos (POST)
src/app/api/saude       healthcheck (banco ok, empresas, variáveis faltando)
src/app/api/sync        gravação genérica das entidades
src/app/login, auth/callback, sair, middleware.ts   autenticação
src/lib/db.ts           conexão e comPerfil
src/lib/sessao.ts       sessão real/efetiva, modo demonstração, assinatura HMAC
src/lib/dados.ts        carga de todos os dados do usuário (KB_DATA)
src/lib/regras.ts       validadores do /api/sync (o coração das regras de negócio)
src/lib/armazenamento.ts Supabase Storage ou pasta local
src/lib/pncp.ts         busca, detalhe, itens, documentos e histórico do PNCP
src/lib/ia.ts           escolha do modelo (Administração › automático › OPENAI_MODEL), esforço médio, leitura do streaming
src/lib/pecas.ts        regras fixas e instruções padrão das peças, fecho e qualificação
src/lib/docx.ts         monta o Word a partir do modelo timbrado (.docx) da empresa
src/lib/acoesPecas.ts   timbrado/representante, peças-modelo e configurações de IA (via /api/acao)
src/lib/textos.ts       extração de texto de PDF, DOCX, TXT e ZIP
supabase/migrations     esquema, segurança (RLS) e endurecimento
supabase/seed           dados fictícios (demo.json → demo.sql via scripts/build-seed.mjs)
supabase/local          stub do Supabase para Postgres local e teste de RLS
scripts/migrate.mjs     aplica migrações, carrega demo em banco vazio, cria login do administrador
tests/e2e_local.py      17 cenários ponta a ponta (Playwright)
```

## 4. Modelo de segurança (não quebrar)

1. **Toda tabela privada tem `empresa_id` e RLS.** Leitura: `empresa_id in (select app_empresas())`. Escrita: além disso, `app_escreve(empresa_id)` (permissão diferente de só "consultar").
2. Funções auxiliares (`security definer`): `app_uid()`, `app_empresas()`, `app_pode(p, e)`, `app_escreve(e)`, `app_admin()`, `app_ve_certame(c)`.
3. **Vínculo societário não dá acesso**: só `empresas.autorizacao_operacional = true` com vínculo em `vinculos`.
4. **Gatilhos de integridade**:
   - O lote herda empresa e certame da participação.
   - Contrato, ata, pacote e minuta exigem participação da mesma empresa.
   - NF, recebimento, DRE, lançamento, antecipação e recepção herdam a empresa do contrato.
5. **Notas fiscais e recebimentos são imutáveis** para o papel `authenticated`. Correção é feita por lançamento de estorno.
6. **Concorrência otimista** pela coluna `rev`:
   - Uma gravação sobre uma versão antiga recebe 409.
   - Se o orçamento mudou de versão, a mensagem específica é "Os números mudaram: a versão em análise agora é a vN…".
7. **Regras de negócio no servidor** (`regras.ts`):
   - A decisão de participação exige a permissão `decidir` e uma justificativa, e grava em `decisoes`.
   - Versões de orçamento e de minuta são imutáveis, exceto votos, status e protocolo.
   - Cada pessoa vota só por si, só se for designada e só na última versão submetida.
   - A aprovação exige todos os designados. Com margem abaixo de 12%, cada voto exige fundamento.
   - A reconfirmação só abre se o último lance ficou abaixo do preço de referência, e só conclui com todas as partes.
8. **Arquivos**: o bucket é privado e os caminhos seguem `<empresa>/<uuid>/<nome>`. O download sempre passa pelo servidor, com checagem de RLS.
9. **Modo demonstração** (`DEMO_MODE=1`): o administrador atua como perfis fictícios. A auditoria grava o usuário real (`usuario_id`) e o perfil assumido (`atuando_como`).
10. **Endurecimento para o Supabase** (migração 3):
    - O papel `anon` não tem acesso a nada.
    - O papel `authenticated` não tem DELETE nem TRUNCATE.
    - Criar certame ou lote exige ter pelo menos uma empresa autorizada.
    - Contas criadas direto no Supabase, sem perfil vinculado, não veem nada.

### Acesso ao banco em produção
- A aplicação conecta com o papel **`kb_app`** pelo *Transaction pooler* (usuário `kb_app.isdxzqkijalfxgviafwr`, porta 6543).
- Esse papel foi criado manualmente, com a senha guardada apenas na `DATABASE_URL` do Railway: `login`, `bypassrls`, membro de `authenticated`, **dono das tabelas** de `public`.
- As funções continuam com dono `postgres`.
- **Migrações novas** são aplicadas pelo `migrate.mjs` como `kb_app`. Por isso:
  - Tabela nova criada por `kb_app` não recebe os privilégios padrão do Supabase: inclua `grant select, insert, update on <tabela> to authenticated;`, `enable row level security` e as políticas na própria migração.
  - Alterar ou criar uma função `security definer` exige o dono `postgres`. Aplique pelo SQL Editor do Supabase (ou pelo MCP do Supabase) e registre o nome do arquivo em `_migracoes`.
- Nunca ponha senhas, chaves ou a `DATABASE_URL` no código. O repositório é **público**.

## 5. Convenções

- **Idioma**: interface, mensagens, commits e nomes de domínio em português (empresa, certame, participacao, lote, contrato…).
- **Valores**: dinheiro em `numeric(18,2)`, quantidades em `numeric(18,4)`. Nunca use zero para "não informado": use `null`.
- **Datas**: fuso `America/Sao_Paulo` (`TZ` no Railway). `certames.sessao` é `timestamp` sem fuso, em horário de Brasília. O driver devolve datas como texto (`YYYY-MM-DD` e `YYYY-MM-DDTHH:MM`).
- **jsonb reordena chaves**: para comparar objetos use `canon`/`eq` de `regras.ts`, nunca `JSON.stringify` direto.
- **Migrações**: arquivos `supabase/migrations/AAAAMMDDNNNNNN_nome.sql`, aplicados em ordem e registrados em `_migracoes`. Não edite uma migração já aplicada: crie outra.
- **Dados fictícios**: altere `supabase/seed/demo.json` e rode `node scripts/build-seed.mjs`. Os UUIDs dos perfis seguem `00000000-0000-4000-8000-00000000000N`, na ordem william, ana, marina, carlos, paula, rui, bruno. As empresas são A (Alfa), B (Beta) e G (Gama, sem autorização).
- **Commits**: mensagem em português, curta e descritiva.

## 6. Integrações

### PNCP (API pública, sem chave)
- **Detalhe da contratação**: `https://pncp.gov.br/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}`. O endereço antigo `/api/pncp/v1/...` responde "301 movido" e fica só como alternativa.
- **Lista de arquivos**: `https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos`.
- **Download**: `.../arquivos/{sequencialDocumento}`. O conteúdo pode vir em PDF ou ZIP, e o tipo é detectado pela assinatura do arquivo.
- **Entrada aceita**: número de controle (`33665647000191-1-000058/2026`) ou link do portal (`pncp.gov.br/app/editais/33665647000191/2026/58`).
- **Situações de resposta**: `ok`, `nao_localizado` (404/204) e `indisponivel` (outros códigos ou erro de rede). Nesses dois últimos casos o usuário segue pelo fluxo manual.
- **Testado em produção em 22/11/2026** com o pregão 90006/2026 do Confea: consulta, documento não localizado e download do edital (ZIP de 4,3 MB) para o Storage.

- **Busca de editais** (aba "Buscar no PNCP" em Importar edital): usa o mesmo serviço da tela do portal, `https://pncp.gov.br/api/search/?tipos_documento=edital&q=…&status=recebendo_proposta&ufs=PR|SC&modalidades=6&ordenacao=-data&tam_pagina=100`. O fim do prazo de propostas vem em `data_fim_vigencia`. O serviço recusa pedidos em sequência; o servidor tenta 3 vezes e, se falhar, usa `/api/consulta/v1/contratacoes/publicacao` (exige período e modalidade).
- **Inserção** (`acao: importar_pncp`): o servidor relê detalhe e itens no PNCP; lote = grupo do edital ou item (até 300); `certames.id_externo` guarda o número de controle. As licitações entram em "Em análise preliminar" e aparecem na aba Análise prévia.
- **Esclarecimentos e impugnações**: o PNCP não tem campo próprio; a tela mostra documentos com esses termos no título e o histórico (`/historico`) com justificativas, e aponta o sistema de origem.
- **Visualização**: `GET /api/pncp?arquivo=CNPJ/ANO/SEQ/DOC` repassa o documento (PDF abre na tela).

### OpenAI (opcional)
- Responses API em streaming (`response.output_text.delta`). A chave fica só no servidor (`OPENAI_API_KEY`).
- **Modelo**: o fixado na Administração (`configuracoes.modelo_ia`); em branco, o mais avançado da família `gpt-N` que a chave lista em `/v1/models` (guardado por 6 h); por último, `OPENAI_MODEL`. Esforço de raciocínio **médio** (decisão do responsável).
- **Peças jurídicas** (`/api/ia/peca`): o servidor lê os documentos do processo, a qualificação da empresa (`empresa_identidade`), as instruções do tipo (`configuracoes.instr_peca_<tipo>`, editáveis na Administração) e, como referência de estilo, até 3 `pecas_modelo` do tipo e as 2 últimas peças protocoladas da empresa. Regras de formato fixas em `pecas.ts`: a IA não escreve local, data nem assinatura (o sistema acrescenta) e põe as notas internas depois da linha `---- NOTAS INTERNAS`, que não sai no Word.
- **Papel timbrado**: um .docx por empresa; o Word final mantém cabeçalho, rodapé e estilos do modelo e substitui o corpo (ou só o parágrafo com `{{CORPO}}`). PDF: o usuário salva pelo Word.
- O PNCP não recebe pedidos de fornecedores: o protocolo é feito no sistema de origem da licitação e registrado manualmente.

## 7. Variáveis de ambiente (Railway › kaizen-b2g-web › Variables)

| Variável | Uso |
|---|---|
| `DATABASE_URL` | pooler em modo transação, usuário `kb_app` |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publishable (é embutida no build) |
| `SUPABASE_SERVICE_ROLE_KEY` | só no servidor: Storage e criação do login do administrador |
| `ADMIN_INITIAL_PASSWORD` | senha inicial do administrador (usada só na primeira criação) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | opcionais |
| `DEMO_MODE`, `SEED_DEMO` | `1`: troca de perfil de demonstração e dados fictícios em banco vazio |
| `TZ` | `America/Sao_Paulo` |
| `AUTH_MODE=dev`, `STORAGE_DIR` | **somente local** (login por seletor de perfil e arquivos em disco) |

Mudanças em variáveis no painel do Railway ficam "pendentes" até clicar em **Deploy**.

## 8. Rodar e testar localmente

```bash
npm install
# Postgres local (o stub emula o schema auth e os papéis do Supabase)
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kb2g node scripts/migrate.mjs --seed
cp .env.example .env.local   # AUTH_MODE=dev, DATABASE_URL local, STORAGE_DIR=.data/arquivos
npm run dev                  # http://localhost:3000
python3 tests/e2e_local.py   # 17 cenários; o banco precisa estar recém-carregado (no Windows: CHROME=<caminho do chrome.exe do Playwright>)
psql -d kb2g -f supabase/local/teste_rls.sql   # isolamento entre empresas direto no banco
npx tsc --noEmit -p .        # checagem de tipos
```

Antes de publicar qualquer mudança: checagem de tipos sem erros e os 17 cenários aprovados. Se a mudança mexer em permissões, rode também o teste de RLS.

## 9. Decisões do responsável

- Implementar todos os templates de uma vez, com Supabase e Railway.
- O fluxo BPMN foi aprovado.
- O login do administrador é william.bossa@kaizenpartners.com.br.
- O sistema acessa o banco com um usuário exclusivo (`kb_app`), criado para não depender da senha principal do banco.

## 10. Pendências

- Precificação de serviços de TI (UST, HST, PF, postos) depende da planilha original. Até lá, o custo é informado e o resultado aparece como ilustrativo.
- Leitura automática de PDF e OCR (empenho, aditivo, edital): hoje a leitura é assistida, com conferência manual.
- Integração com o PDI: o protocolo é registrado manualmente.
- Análise de exigências por IA: servidor pronto (`/api/ia/exigencias`, prompt na Administração); falta a tela na aba Exigências e o carregamento automático dos documentos do PNCP na aba Processo.
- PNCP fora do ar (503): mensagem clara, novas tentativas no download e link do sistema de origem na busca.
- Segurança no Supabase:
  - Ativar a autenticação multifator (MFA TOTP) antes de clientes reais.
  - Desligar "Allow new users to sign up".
  - Configurar a URL de redirecionamento, se o login por link for usado.
- Tornar o repositório privado, ou confirmar que ele pode continuar público.
- O teste de download do PNCP gravou o edital do Confea como documento do certame `CRT-AM-0116` (Alfa, dados fictícios). Pode ser removido.
