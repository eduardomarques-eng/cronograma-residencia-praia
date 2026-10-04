---
name: arqvertice-production
description: Deploy e validação do ARQVERTICE FLOW na Vercel. Usar ao publicar, verificar produção ou diagnosticar um deploy.
---

# Produção — ARQVERTICE FLOW

## Regra de ouro

**Nunca imprimir segredos.** Nenhum valor de `DATABASE_URL`, `AUTH_SECRET`,
`ADMIN_KEY` ou chave de API vai para o terminal, log, commit ou relatório.
Ao mostrar uma connection string: `postgresql://user:***@host/db`.

## Ordem obrigatória — não saltar etapas

```bash
npm run typecheck
npm run lint
npm test
npm run build
git push origin main
vercel.cmd deploy --prod --yes
```

No Windows usar sempre `vercel.cmd`, `npx.cmd`, `npm.cmd` — a Execution Policy
bloqueia os wrappers `.ps1`.

## Antes de fazer deploy

- `DATABASE_URL` presente em **Production** (e Preview), com a **senha actual**.
- `AUTH_SECRET` igual ao usado no `db:seed`. **Se divergirem, o login devolve
  401** — o hash da senha é `scrypt(senha, salt + AUTH_SECRET)`.
- 14 migrations aplicadas:
  ```bash
  npx.cmd prisma migrate deploy
  npx.cmd prisma migrate status   # tem de dizer "Database schema is up to date!"
  ```
- Nunca `prisma migrate resolve` para disfarçar falha. Nunca editar migrations.

## Depois do deploy

O alias só troca quando o build termina — **esperar por "Ready" e "Aliased"**, não
assumir que o comando voltou.

Validar:
```text
/               entrada pública (sem sessão)
/login
/api/health     200, database: "ok", com `reason`
```

O `version` do `/api/health` tem de corresponder ao `git log -1`. Se não
corresponder, o deploy é de outro commit.

Com sessão ADMIN: login real e uma operação que **consulte o PostgreSQL**.

## Diagnóstico quando o login devolve 401

Não assumir senha errada. A rota de login converte **qualquer** erro em 401 —
inclusive tabela inexistente. Isolar com um endpoint que consulte a tabela
(ex.: `/api/auth/forgot-password`): 500 aponta para schema em falta; 202 com
resposta neutra confirma que a tabela existe.

## Rollback

`vercel.cmd rollback` é reversão de deploy. **Reverter migrations aplicadas em
produção exige confirmação explícita** — pode conter dados.

## Bloqueios conhecidos

Sem `RESEND_API_KEY` o link de recuperação **não chega ao cliente** (o fluxo não
quebra: fica registado). Sem `STORAGE_*` os documentos só funcionam em
desenvolvimento. Não descrever nenhum dos dois como "a funcionar".