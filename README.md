# ArqVértice Flow

Aplicação Next.js para gestão de clientes, projetos, cronograma, pagamentos,
briefing guiado, relatórios e portal do cliente. O aplicativo legado continua
preservado na raiz para migração gradual.

## Desenvolvimento

```bash
npm install
copy .env.example .env
npm run dev
```

Defina `DATABASE_URL` e `AUTH_SECRET` com pelo menos 32 caracteres. A
autenticação usa sessões server-side, cookie `httpOnly` e os papéis `ADMIN` e
`CLIENT`. Toda autorização é verificada no servidor; o cliente só consulta
projetos vinculados ao próprio cliente ou a um acesso explícito.

## Banco e migrations

```bash
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

O seed exige `SEED_ADMIN_PASSWORD` e `SEED_CLIENT_PASSWORD`. Ele é idempotente
para os usuários e dados demonstrativos principais, mas deve ser executado
somente em ambientes apropriados. Nunca use senhas reais no repositório.

Antes de aplicar migrations em produção, faça backup e revise o SQL. A
migration de consolidação usa constraints `RESTRICT` para preservar projetos,
relatórios, documentos e acessos relacionados. Esta sessão não possui um
PostgreSQL de produção, portanto a aplicação real da migration e a restauração
de backup ainda precisam ser validadas no ambiente do operador.

## Variáveis de ambiente

- `DATABASE_URL`: conexão PostgreSQL do ambiente atual.
- `NEXT_PUBLIC_APP_URL`: URL pública usada por links e metadados.
- `AUTH_SECRET`: segredo local do hash de senhas; use valor aleatório de 32+
  caracteres e um valor diferente por ambiente.
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CLIENT_EMAIL`,
  `SEED_CLIENT_PASSWORD`: somente para seed.
- `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`,
  `STORAGE_SECRET_ACCESS_KEY`: storage S3-compatible privado obrigatório em
  produção. `STORAGE_ENDPOINT` e `STORAGE_FORCE_PATH_STYLE` são opcionais para
  provedores compatíveis.

Use arquivos `.env` fora do controle de versão. O arquivo `.env.example`
contém apenas valores de exemplo.

## Verificação

```bash
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

O workflow em `.github/workflows/ci.yml` executa essas verificações em pushes
para `main` e pull requests. Na Vercel, configure as variáveis de produção e
aplique as migrations no PostgreSQL antes de liberar a aplicação.

### Deploy e smoke test remoto

O deploy produtivo é manual e auditável pelo workflow
`.github/workflows/deploy-production.yml`. Configure no environment
`production` do GitHub:

- secrets `DATABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` e
  `VERCEL_PROJECT_ID`;
- variable `PRODUCTION_URL`, com a URL HTTPS sem barra final.

O workflow valida o schema, aplica somente migrations pendentes, constrói e
publica o Next.js na Vercel e executa `npm run smoke:remote`. O smoke test
verifica `/login`, `/api/health` e garante que um token de briefing inválido não abre o
formulário. Ele não substitui testes autenticados com fixtures de staging.
Execute o workflow pela aba **Actions > Deploy production > Run workflow** e
confirme os logs, URL, banco e variáveis da Vercel antes de anunciar a versão.

### E2E de isolamento e briefing

A suíte Playwright cobre token inválido, acesso ao próprio projeto, tentativa
de acesso cruzado e retomada/autosave/revisão do briefing. Os testes que
precisam de dados persistidos são opt-in para não alterar bancos reais:

```powershell
$env:E2E_CLIENT_EMAIL = "cliente-e2e@example.com"
$env:E2E_CLIENT_PASSWORD = "senha-de-teste-com-12"
$env:E2E_OWN_PROJECT_ID = "<uuid-do-projeto-do-cliente>"
$env:E2E_FOREIGN_PROJECT_ID = "<uuid-de-projeto-de-outro-cliente>"
$env:E2E_BRIEFING_TOKEN = "<token-de-briefing-nao-finalizado>"
npx playwright install chromium
npm run test:e2e
```

Use uma base de dados descartável ou uma instância de staging. A suíte não
cria, altera ou remove fixtures automaticamente e nunca deve receber
credenciais de produção em CI local.

## Funcionalidades e segurança

- **ADMIN**: gerencia clientes, projetos, cronograma, pagamentos, briefing e
  publicação de relatórios.
- **CLIENT**: acessa somente o próprio projeto autorizado, cronograma,
  pagamentos e relatórios liberados.
- **Briefing**: links usam tokens aleatórios e o banco armazena somente hash
  SHA-256. Links revogados ou expirados não são aceitos.
- **Áudio**: a Web Speech API processa a transcrição no navegador em `pt-BR`.
  O áudio não é enviado nem armazenado pela aplicação; sem suporte, a edição
  manual continua disponível.
- **Relatórios**: estados `PREPARING`, `INTERNAL`, `RELEASED` e `ARCHIVED`;
  somente `RELEASED` aparece no portal.
- **Impressão/PDF**: o relatório usa impressão do navegador com estilos de
  impressão.

O modelo de documentos já possui entidade, status e visibilidade no Prisma,
upload e download autorizado usam uma chave opaca no storage S3-compatible.
Em desenvolvimento, arquivos são gravados em `.private-storage/`, que está no
`.gitignore`. Em produção, a aplicação recusa upload sem storage privado
configurado; o endpoint de download valida a sessão, o projeto e a
visibilidade antes de buscar o objeto. Não forneça URLs públicas do bucket.
Uploads aceitam PDF, PNG, JPG e TXT até 10 MB.

As APIs legadas em `api/projeto.js` e `api/tarefas.js` não fazem parte do
portal moderno e agora exigem `x-chave-admin` também para leitura. Sem essa
chave, elas respondem `401` e não consultam o banco. O cliente legado só entra
no modo remoto quando a chave foi informada; o portal moderno deve usar as
rotas autenticadas do Next.js. Para PostgreSQL remoto, a conexão legada exige
TLS com validação de certificado; se o provedor usar uma CA privada, configure
`DATABASE_SSL_CA` sem desativar `rejectUnauthorized`.

## Produção e recuperação

O alvo recomendado é Vercel + Neon PostgreSQL. No Neon, crie um projeto
separado para produção, mantenha a conexão com TLS e configure a
`DATABASE_URL` no ambiente **Production** da Vercel. Não copie a URL de
desenvolvimento para produção.

Sequência de release:

```bash
npm ci
npm run db:validate
npm run db:generate
npm run db:deploy
npm run build
```

Execute `db:deploy` somente contra a URL de produção após confirmar um backup
ou restore point no Neon. O comando é não destrutivo e aplica apenas migrations
pendentes; não use `prisma db push` em produção.

O Neon fornece restore points/branching conforme o plano contratado. Antes do
primeiro release, confirme no painel a retenção disponível, o horário do último
backup automático e quem pode restaurar. Para recuperação, crie uma branch ou
restore point do instante anterior ao incidente, valide a aplicação nessa
cópia e só então faça a troca controlada da `DATABASE_URL`. Registre data,
responsável, ponto restaurado e resultado da validação. O repositório não
executa backup, restauração ou troca de variáveis automaticamente.

Após o deploy, valide login ADMIN e CLIENT, isolamento entre projetos,
briefing por token, cronograma, pagamentos e relatórios liberados. Monitore
falhas de autenticação, banco, geração de relatório e runtime sem registrar
tokens ou senhas.

## Atualização controlada e observabilidade

As dependências de runtime permanecem nas linhas compatíveis com a aplicação:
Next.js `15.5.x` e Prisma `6.19.x`. A atualização desta etapa foi limitada aos
patches `15.5.27` e `6.19.3`; não foi feito upgrade major para Next 16 ou
Prisma 7/8, pois isso exigiria uma janela própria para migração e validação.
Playwright e PostCSS também receberam apenas atualizações não-major para manter
os testes e corrigir avisos de segurança conhecidos.

O endpoint `GET /api/health` verifica a conectividade com o PostgreSQL e retorna
`200` quando o serviço está saudável ou `503` quando o banco está indisponível.
Ele não expõe a URL do banco, credenciais ou dados do negócio. Cada resposta
possui `X-Request-Id`; o mesmo identificador é incluído nos logs JSON de falha
de login, download e health check. O identificador pode ser definido por um
proxy confiável via `x-request-id` e é limitado a 128 caracteres.

Em produção, encaminhe stdout/stderr da Vercel para o provedor de logs adotado
e alerte para respostas `503` de `/api/health`, falhas de login e erros de
download. Não envie tokens de briefing, cookies, senhas ou conteúdo de
documentos aos logs. `APP_VERSION` pode identificar releases fora da Vercel;
em deploy Vercel, `VERCEL_GIT_COMMIT_SHA` é usado automaticamente quando
disponível.

## Estrutura

- `src/app`: páginas, portal, briefing, relatório e actions.
- `src/server`: autenticação, autorização, serviços de domínio e Prisma.
- `src/lib`: validações, finanças, cronograma e definição do briefing.
- `prisma`: schema, migrations e seed.
- `api/`, `app.js`, `painel-cliente.js` e demais arquivos da raiz: legado
  preservado para compatibilidade; sua remoção deve ser uma decisão separada.
