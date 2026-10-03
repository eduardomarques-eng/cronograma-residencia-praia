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
mas upload, storage externo, download autorizado e UI de documentos ainda não
estão implementados. Não trate `storageUrl` como mecanismo de segurança até
que um storage com URLs privadas e autorização server-side seja integrado.

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

## Estrutura

- `src/app`: páginas, portal, briefing, relatório e actions.
- `src/server`: autenticação, autorização, serviços de domínio e Prisma.
- `src/lib`: validações, finanças, cronograma e definição do briefing.
- `prisma`: schema, migrations e seed.
- `api/`, `app.js`, `painel-cliente.js` e demais arquivos da raiz: legado
  preservado para compatibilidade; sua remoção deve ser uma decisão separada.
