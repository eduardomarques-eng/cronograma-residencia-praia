# Deploy manual na Vercel

Guia curto para publicar o **ARQVERTICE FLOW** na Vercel e validar a aplicação.

---

## 1. Antes de publicar — o que tem de existir

A aplicação **arranca sem base de dados**, mas fica inútil: páginas que leem
dados mostram estados vazios e o login falha. Para ter a aplicação completa é
obrigatório ter um PostgreSQL.

Variáveis de ambiente: copie `.env.example` e ajuste. As **obrigatórias** estão
marcadas abaixo.

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `DATABASE_URL` | **SIM** | Ligação ao PostgreSQL. Sem ela nada funciona. |
| `AUTH_SECRET` | **SIM** | Segredo de ≥32 caracteres. |
| `ADMIN_KEY` | **SIM** | Chave de escrita das serverless legadas em `/api`. |
| `NEXT_PUBLIC_APP_URL` | **SIM** | URL pública (ex.: `https://app.vercel.app`). Sem ela os links de proposta saem vazios. |
| `COMPANY_LEGAL_NAME` | Recomendada | Nome que aparece no contrato. |
| `COMPANY_LEGAL_DOCUMENT` | Recomendada | Documento do contratado. |
| `STORAGE_*` | Recomendada | S3 privado para documentos. Sem isto, documentos só funcionam em desenvolvimento. |
| `SIGNATURE_PROVIDER` | Opcional | `manual` (predefinido) ou `http`. |
| `WHATSAPP_PROVIDER` | Opcional | `wa.me` (predefinido) ou `api`. |
| `RESEND_API_KEY` | Recomendada | Sem ela o link de recuperação **não chega ao cliente** por e-mail. |
| `EMAIL_FROM` | Recomendada | Remetente validado no Resend. |

> ⚠️ `ADMIN_KEY` só foi adicionada ao `.env.example` nesta versão. Se o seu
> deploy anterior já existia, **tem de a definir agora** — as funções de escrita
> em `/api` ficam inacessíveis sem ela.

---

## 2. Publicar

Na Vercel: **Add New → Project → importar o repositório**. A Vercel detecta o
Next.js sozinha.

- **Build Command:** `npm run build`
- **Install Command:** deixe o default (`npm install`) — o `postinstall` corre
  `prisma generate`, que é obrigatório para o build.
- **Output Directory:** deixe o default (`.next`)

Depois, em **Settings → Environment Variables**, defina as variáveis acima para
**Production**, **Preview** e **Development**.

---

## 3. Aplicar as migrations — passo obrigatório

A aplicação **não tem tabelas** até isto ser feito. Sem este passo o deploy
publica uma app que falha em todas as leituras.

**Opção A — pela Vercel (recomendada, sem terminal):**
1. Settings → Environment Variables, confirme `DATABASE_URL`
2. Instale o Vercel CLI: `npm i -g vercel`
3. `vercel link`  (associe ao projecto)
4. `vercel env pull .env.local --environment=production`  (descarrega as variáveis
   em `.env.local`, que o `.gitignore` já exclui — **nunca** em `.env`)
5. `npx prisma migrate deploy`
6. `npm run db:seed`  (cria o ADMIN e os templates)

> No Windows, invoque `vercel.cmd`, `npx.cmd` e `npm.cmd`. A Execution Policy
> bloqueia os wrappers `.ps1` e o script falha antes de começar.

**Opção B — a partir da máquina:**
```bash
# com DATABASE_URL a apontar para a base da Vercel
npx prisma migrate deploy
npm run db:seed
```

São **14 migrations**. Todas são aditivas (nenhum `DROP`), por isso não
destroem dados.

### Supabase: usar o *session pooler*, nunca o *transaction pooler*

Ao copiar a connection string do Supabase, escolha a porta certa:

| Porta | Tipo | Usar para |
|---|---|---|
| **5432** | session pooler (`aws-0-<região>.pooler.supabase.com`) | **migrations e runtime — use esta** |
| 6543 | transaction pooler | não usar com Prisma |

O *transaction pooler* (6543) **não** suporta `prisma migrate deploy`: as
migrations correm dentro de transações implícitas e o Prisma precisa de
sessões persistentes. Ligar por 6543 faz `migrate deploy` falhar.

String usada nesta validação (a password é a do utilizador `postgres`):

```
postgresql://postgres.<project-ref>:<password>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?schema=public&sslmode=require
```

O `sslmode=require` é obrigatório no Supabase.

> 🔐 **Só precisa de `DATABASE_URL`.** Esta aplicação usa Prisma com
> autenticação própria — **não** configure `SUPABASE_SERVICE_ROLE_KEY` nem
> `SUPABASE_JWT_SECRET`. Menos segredos expostos, menos risco.

---

## 4. Credenciais criadas pelo seed

O `npm run db:seed` imprime as credenciais do ADMIN e do CLIENTE. Se não
imprimir, defina-as antes:

```
SEED_ADMIN_EMAIL
SEED_ADMIN_PASSWORD
SEED_CLIENT_EMAIL
SEED_CLIENT_PASSWORD
```

---

## 5. Validar depois do deploy

| Verificação | URL | Esperado |
|---|---|---|
| aplicação abre | `/` | 200 · "Banco não conectado" se BD faltar |
| login | `/login` | formulário renderiza e **os scripts funcionam** |
| saúde | `/api/health` | `{"status":"ok","database":"ok"}` |
| protecção | `/propostas` | 307 para `/login` |
| cabeçalhos | qualquer | `Content-Security-Policy` com `nonce-` |

```bash
npm run smoke:remote     # script existente no projecto
```

---

## 6. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Build falha com "PrismaClient did not initialize" | `postinstall` não correu | `vercel --prod --force` ou confirmar Install Command |
| `/api/health` devolve 503 `degraded` | `DATABASE_URL` errada ou migrations não aplicadas | passo 3 |
| Login falha com erro de credenciais | seed não correu | `npm run db:seed` |
| Links de proposta saem vazios | `NEXT_PUBLIC_APP_URL` por definir | definir e redeployar |
| Documentos não carregam | `STORAGE_*` por definir | definir (opcional em produção) |
| Toda a app devolve erro | migrations não aplicadas | passo 3 |

---

## 7. Estado actual conhecido

- **Aplicação:** compila, 225 testes passam, sem erros de tipo ou lint.
- **PDF oficial:** ainda não implementado. O que existe é impressão do browser.
- **Assinatura digital:** provider `manual` por omissão — **não** é assinatura
  jurídica digital.
- **Rate limit:** em memória. Com várias instâncias o limite real é N×.

Nenhum destes pontos impede o deploy — apenas limitam o que se pode validar.
