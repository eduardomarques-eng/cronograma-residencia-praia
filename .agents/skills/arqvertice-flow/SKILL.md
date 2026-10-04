---
name: arqvertice-flow
description: Convenção e regras do ARQVERTICE FLOW (Next.js 15 + Prisma + PostgreSQL/Supabase). Usar ao criar páginas, serviços, acções ou rotas desta aplicação.
---

# ARQVERTICE FLOW

Estúdio de arquitetura. Next.js 15 (App Router) + Prisma + PostgreSQL (Supabase),
autenticação própria com scrypt, RBAC por `UserRole`, Design System em Tailwind.

Não duplique o que já existe: **leia o ficheiro antes de criar**. Os pontos de
entrada estão listados abaixo.

## Estrutura

| Camada | Onde | Regra |
|---|---|---|
| Rotas | `src/app/**/page.tsx` | Server Components por omissão. Cliente só com `"use client"`. |
| API | `src/app/api/**/route.ts` | Valida entrada, rate limit, `requestId`. |
| Regras | `src/server/services/*.ts` | **Toda a escrita passa por um serviço.** A página não escreve na base. |
| Autorização | `src/server/auth.ts` | `requireRole`, `requirePageRole`, `requireProjectAccess`, `requirePageProjectAccess`. |
| Domínio puro | `src/lib/*.ts` | Sem I/O. É onde vivem as regras testáveis. |
| UI | `src/components/ui/*.tsx` | Design System. Não criar outro. |
| Dados | `prisma/schema.prisma` | Fonte da verdade. Migrations são aditivas. |

## RBAC — a fronteira real

O middleware só verifica a *presença* do cookie; **não é autorização**. A prova de
acesso é sempre no servidor, nos serviços. Uma rota nova que leia dados tem de
chamar `requirePageRole` / `requirePageProjectAccess` — nunca confiar na navegação.

`ADMIN` vê tudo. `CLIENT` vê apenas o que está ligado ao seu `clientId` ou a um
`ProjectAccess` explícito.

## Regra única de progresso

`ScheduleStage.completion` (0–100) é a **única** fonte. Disciplina = média das
etapas; projecto = média das disciplinas. Implementado em
`dashboard-service.stageCompletion` e coberto por testes — não calcule outro
percentagem noutro ecrã, ou criam-se duas verdades para o mesmo número.

O `status` é **derivado** do `completion` (`scheduleStatusFromPercentage`):
0 → `NOT_STARTED`, 100 → `COMPLETED`, resto → `IN_PROGRESS`. `ATRASADO` no
quadro é derivado (prazo vencido e não concluída), não um estado novo.

## Fluxo comercial

```
Cliente → Briefing → Projeto → Proposta → Contrato → Cronograma → Execução → Entrega
```

Não quebrar a sequência. Valores comerciais vêm sempre de configuração
(`ServiceItem`, `CommercialPackage`), nunca hardcoded.

## Ambiente público vs. interno

`/` sem sessão é a **entrada pública** (Entrar / Criar conta / Recuperar senha).
Com sessão, `ADMIN` fica no painel e `CLIENT` vai para `/portal`. Nunca expor a
navegação administrativa a quem não tem sessão.

Um `User` registado pelo formulário `/cadastro` nasce **sem `clientId`**: o Admin
é que o associa. Associar projectos no registo permitiria a um recém-chegado ver
dados de outro cliente (IDOR).

## Convenções

- Português no código e na interface. Comentários explicam **porquê**, não o quê.
- Sem `any`, sem `@ts-ignore`, sem `console.log`. `npm run lint` tem de passar.
- Componentes UI não aceitam `className` — leia a props real antes de usar.
- `Decimal` do Prisma converta com `Number(...)` ao chegar à interface.
- Passwords nunca em texto puro; `hashPassword` aplica a política (≥12 chars).
- Tokens de uso único guardam-se **apenas** como SHA-256; o valor em claro só
  viaja no link do e-mail.

## Regras de segurança

- `.env` e `.env.local` nunca são versionados.
- Respostas de recuperação de senha são **neutras** — não revelar se o e-mail
  existe, ou permitia enumerar utilizadores.
- Alterar a senha **encerra todas as sessões** do utilizador.
- Diagnóstico técnico (comandos de migration) só aparece **sem sessão**.

## Comandos

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src
npm test            # vitest run
npm run build       # next build
npx prisma migrate deploy
npm run db:seed     # idempotente
```

Antes de um bloco: validar. Depois: commitSmall. Nunca commitar segredos.

## Documentação

Não replicar o conteúdo destes ficheiros — consultar:

- `DEPLOY.md` — deploy, variáveis, Supabase (session pooler 5432, nunca 6543)
- `README.md` — comandos e visão geral
- `prisma/schema.prisma` — entidades e relações
- `src/lib/security-headers.ts` — CSP, HSTS e rota pública por token