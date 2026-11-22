# Kaizen B2G

Plataforma multiempresa de licitações públicas e rentabilidade contratual: carteira por CNPJ, decisão de participação, acervo de habilitação, precificação com alçadas, disputa e resultados, execução de contratos de bens e de TI, nota fiscal com kit de obrigações, DRE por contrato e BI geográfico.

## Arquitetura

| Camada | Tecnologia | Onde está |
|---|---|---|
| Telas | As telas validadas nos Templates 1 a 9 (JavaScript sem framework), servidas pelo Next.js | `public/app/` |
| Servidor | Next.js 15 (App Router) em TypeScript: login, carga de dados, gravação com regras de negócio, arquivos, IA e PNCP | `src/` |
| Banco | PostgreSQL do Supabase, com RLS por empresa, gatilhos de integridade e trilha de auditoria | `supabase/migrations/` |
| Login | Supabase Auth (senha ou link por e-mail) | `src/lib/sessao.ts` |
| Arquivos | Supabase Storage, bucket privado `privado/<empresa>/…`; download sempre passa pelo servidor | `src/lib/armazenamento.ts` |
| Publicação | Railway, a partir deste repositório | `package.json` (`start` aplica as migrações) |

### Segurança por CNPJ
- Toda tabela privada tem `empresa_id` e política de RLS. O servidor grava e lê no papel `authenticated`, com o perfil do usuário na transação. Por isso o próprio banco recusa leitura ou escrita fora das empresas autorizadas, inclusive por URL direta, exportação ou IA.
- Gatilhos garantem que lote, contrato, ata, pacote, minuta, nota e lançamento pertençam à mesma empresa da participação de origem.
- Notas fiscais e recebimentos são imutáveis para a aplicação.
- Concorrência otimista (`rev`): um clique sobre números que mudaram é recusado ("Os números mudaram…") e a tela recarrega.
- Regras no servidor: decisão exige alçada `decidir` e justificativa; versões de orçamento e de minuta são imutáveis; cada parte vota só por si e só na versão vigente; aprovação exige todos os designados; reconfirmação só abre se o preço alcançado for menor que a referência; preço final exige `preco`.
- O vínculo societário sozinho não dá acesso: é preciso autorização operacional (`empresas.autorizacao_operacional`).
- Modo demonstração (`DEMO_MODE=1`): o administrador pode atuar como os perfis fictícios. Cada gravação registra o usuário real e o perfil assumido.

## Variáveis de ambiente
Veja `.env.example`. No Railway, configure no serviço `kaizen-b2g-web`:

| Variável | Obrigatória | Observação |
|---|---|---|
| `DATABASE_URL` | sim | Supabase › Connect › Transaction pooler (URI com a senha) |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | sim | já configuradas |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | chave anon/publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | usada só no servidor (arquivos e criação do usuário administrador) |
| `ADMIN_INITIAL_PASSWORD` | no primeiro deploy | senha inicial de william.bossa@outlook.com; troque depois |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | não | minutas com IA (Responses API). Sem a chave, o sistema gera rascunho por modelo |
| `DEMO_MODE`, `SEED_DEMO` | não | `1` habilita troca de perfil de demonstração e carga dos dados fictícios em banco vazio |

## Rodar localmente
```bash
npm install
# Postgres local; o stub emula o schema auth do Supabase
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kb2g SEED_DEMO=1 node scripts/migrate.mjs
cp .env.example .env.local   # e defina AUTH_MODE=dev, DATABASE_URL local, STORAGE_DIR=.data/arquivos
npm run dev                  # http://localhost:3000 (login local por seletor de perfil)
python3 tests/e2e_local.py   # 17 cenários ponta a ponta (Playwright)
```
Teste de isolamento direto no banco: `psql -d kb2g -f supabase/local/teste_rls.sql`.

## Dados de demonstração
`supabase/seed/demo.json` reúne os dados fictícios validados nos templates (empresas Alfa e Beta, 33 licitações, 8 contratos, 2 atas, acervo). `node scripts/build-seed.mjs` gera `supabase/seed/demo.sql`.

## Pendências conhecidas
- Precificação de serviços de TI (UST, HST, PF, postos): regras dependem da planilha original. Até lá, a calculadora aceita custo informado e mostra o resultado como ilustrativo.
- Leitura automática de PDF (empenho, aditivo, edital) e OCR: nesta versão a leitura é assistida, com conferência manual.
- Integração técnica com o PDI: o protocolo é registrado manualmente.
- Conector PNCP: implementado sobre a API pública (`/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}` e `/arquivos`). O teste com contratação real ainda precisa ser feito no ambiente publicado.
- Autenticação multifator para perfis privilegiados: ativar no Supabase Auth (MFA TOTP) antes de cadastrar clientes reais.
