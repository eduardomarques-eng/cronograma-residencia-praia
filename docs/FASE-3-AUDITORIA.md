# Fase 3 — Auditoria do cronograma

Data: 2026-10-04 · Projecto: `cronograma-residencia-praia` (ArqVértice Flow)

## 1. O que existe no modelo

Procurou-se um modelo `Schedule`. **Não existe.** O cronograma de um projecto
são as etapas de `Project`:

| Conceito | Onde está | Colunas |
|---|---|---|
| Cronograma | `Project` | `startDate`, `expectedEndDate`, `status`, `address`, `budget` |
| Etapa | `ScheduleStage` | `name`, `discipline`, `designer`, `description`, `startDate`, `endDate`, `dueDate`, `durationDays`, `status`, `completion`, `completedAt`, `order`, `notes`, `dependencyId` |
| Dependência | `ScheduleStage.dependency` | auto-relação `StageDependency`; uma etapa depende de no máximo uma outra |
| Responsável | `ScheduleStage.designer` | texto livre, **não** é `User` |
| Pagamento | `Payment.scheduleStageId` | liga a parcela à etapa |

### Estados reais

`enum ScheduleStageStatus { NOT_STARTED, IN_PROGRESS, COMPLETED }` — três estados,
nenhum outro.

A referência conceptual da fase fala em **NOT STARTED / IN PROGRESS / REVIEW /
DONE / OVERDUE**. Decisão:

* **REVIEW** — não existe no enum e não foi acrescentado. Seria um estado que
  nada no sistema sabe distinguir de `IN_PROGRESS`: não há coluna, não há
  transição, não há quem o defina. Acrescentá-lo só para coincidir com o nome
  criaria uma segunda verdade.
* **OVERDUE** — **é derivado** (prazo vencido e etapa não concluída). Aparece
  como coluna do quadro e como alerta, nunca como `status` gravado.
* **DONE** corresponde a `COMPLETED`.

### Prioridade

`ScheduleStage` **não tem coluna de prioridade**. Não foi criada. O cartão e o
relatório mostram a **prioridade derivada da regra única de alertas**
(`ALTA` / `MEDIA` / `NORMAL`), rotulada como tal. Uma coluna nova mudaria o
schema e criaria um segundo critério de urgência a competir com o prazo real.

### Responsáveis

`designer` é texto livre. Nenhuma pessoa foi inventada:

* quem assina o relatório é quem tem etapa atribuída neste projecto, mais o
  cliente do projecto;
* a lista de responsáveis que a interface oferece vem de `listAssignees()` —
  `designer` já gravados nas etapas **+** utilizadores com `role = ADMIN`. Se a
  equipa ainda não existir na base, a lista vem vazia.

## 2. Regra única de progresso

`src/lib/progress.ts` é o **único** lugar onde a regra existe:

```
stageCompletion(etapa)   → 100 se status = COMPLETED, senão clamp(completion, 0..100)
averageCompletion([])    → média arredondada; lista vazia = 0
completionOf([])         → média das etapas
progressByDiscipline([]) → média por disciplina; disciplina vazia = "Geral"
phasesByDiscipline([])   → o mesmo, com totais por fase
## 3. Regra única de atrasos e alertas

`src/lib/schedule-alerts.ts` — `stageAlert(etapa, agora)`. Uma função, uma
resposta. Ordem de decisão:

| Ordem | Condição | `kind` | Prioridade |
|---|---|---|---|
| 1 | `status = COMPLETED` | `COMPLETED` | NORMAL |
| 2 | sem `dueDate` | `NO_DUE_DATE` | NORMAL |
| 3 | tem `dependencyId` e a dependência não está concluída | `BLOCKED` | ALTA |
| 4 | prazo vencido | `OVERDUE` | ALTA |
| 5 | vence dentro de `DUE_SOON_DAYS = 7` | `DUE_SOON` | MEDIA |
| 6 | resto | `ON_TRACK` | NORMAL |

* **bloqueado** e **dependência pendente** são o mesmo fato pedido com dois
  nomes: no modelo não existe estado "bloqueado", existe dependência por
  concluir.
* `daysUntil()` conta dias **corridos em UTC** — o mesmo conjunto de etapas dá o
  mesmo resultado em qualquer fuso (a Vercel corre em UTC).
* A janela de 7 dias vem da legenda do relatório de referência.

**Antes da fase** o mesmo conceito vivia em `columnFor` (quadro),
`delayedStages` (painel) e `getDaysRemaining` (painel legado). Três
implementações. Agora as três consomem `stageAlert`.

## 4. Relatório

### Fonte da estrutura

O **PDF de referência não está no workspace**. Procurou-se
recursivamente em `C:\Users\eduar` por `*.pdf`, `*.docx`, `*.doc`, `*.odt` e
`*.rtf`: **zero resultados**. Não há PDF montado nem documentação que o
transcreva.

A estrutura usada veio da implementação que o reproduzia e que o próprio código
identifica como extraída do PDF:

* `index.html` linhas 752–1056 — a folha "RELATÓRIO EXECUTIVO DE CRONOGRAMA &
  OBRAS" com as 8 secções numeradas;
* `app.js` secção 17 — `populateReportData()` e a exportação;
* `painel-cliente.js` — `renderReportPhaseStrip()` e `renderReportParecer()`;
* `app.js:90` — "Carga Inicial extraída fielmente do PDF";
* `app.js:303` e `styles.css:69` — "Legenda do PDF Original" (cores da barra de
  avanço).

Mantidos: numeração, títulos e nomenclatura das 8 secções.

### O que o relatório mostra

`src/lib/schedule-report.ts` monta o modelo a partir de dados já lidos; é pura
(sem banco, sem React). Serve a tela e o PDF, portanto **o número impresso é o
mesmo que está no ecrã**.

Secções: 1 ficha técnica · 2 quadro técnico · 3 fase atual · 4 parecer ·
5 avanço por disciplina · 6 financeiro · 7 quadro consolidado de etapas ·
8 critérios de acompanhamento + alertas.

## 5. PDF — decisão

**Opção A, server-side, sem dependências novas.**

Auditoria da estratégia actual:

* `node_modules` **não tem** `pdf-lib`, `pdfkit`, `jspdf`, `html2pdf` nem
  `@react-pdf`. O único pacote de browser é `playwright`, e é `devDependency`
  dos testes E2E — usá-lo em produção seria transformar um browser numa
  dependência de runtime.
* O gerador legado (`app.js:1974`) usava `html2pdf` no cliente: dependência de
  CDN, sem garantia de ambiente, impossível de testar.

Escolhido: escritor de PDF próprio em `src/lib/pdf/pdf-writer.ts` (~500 linhas,
zero dependências). PDF 1.4, A4 retrato, fontes standard Helvetica com
`WinAnsiEncoding` — que cobre toda a acentuação portuguesa sem embeber ficheiro
de fonte. Texto em strings hexadecimais, o que dispensa escapes e torna a saída
byte-a-byte reproduzível.

Limite declarado: glifos fora de WinAnsi (emoji, "≥") saem como `?` em vez de
gerar um ficheiro corrompido. Para português não há perda; para CJK não serve.

Testado em `src/lib/pdf/pdf-writer.test.ts` (18 casos): estrutura do ficheiro,
`startxref`, offsets do xref, `/Length` de cada stream, codificação, quebra de
linha, paginação, tabela sem linhas, transbordo de margem, determinismo.
Mais `schedule-report.test.ts`: secções, dados reais, 60 etapas com paginação,
projecto sem dados e determinismo.

## 6. Regressões corrigidas nesta fase

| Ficheiro | Problema | Correcção |
|---|---|---|
| `schedule-service.ts` | `stageCompletionValue` duplicava a regra de progresso | removida; usa `@/lib/progress` |
| `schedule-service.ts` | média do quadro recalculada à mão | passa por `stageAlert` + contagem partilhada |
| `dashboard-service.ts` | `delayedStages` contava atrasadas com regra própria | usa `summarizeAlerts` |
| `schedule-service.ts` | `updateScheduleStageStatus` escrevia `status` à mão, produzindo etapa a 100% que o sistema contava como em andamento | grava `completion` e deixa o status ser derivado; valida transição e dependência |
| `validation.ts` | `discipline`, `designer` e `dueDate` fora do schema — impossível atribuir responsável ou corrigir prazo pela aplicação | schema passa a descrever a entidade real |
| `pdf-writer.ts` | `stampFooters` não paginava a folha em construção | corrigido |
| `cronograma/page.tsx` | classe Tailwind montada em runtime (`text-${tone}-700`), que não existe no CSS final | mapa explícito `ALERT_TEXT` |
| `schedule-service.ts` | `updateScheduleStageStatus` não autorizava: a guarda só vivia na server action, e uma chamada directa ao serviço mudava o estado de uma etapa sem sessão | `requireRole("ADMIN")` dentro do serviço |

A última foi encontrada pela verificação ao vivo (`scripts/verificar-fase3.mjs`),
não pelos testes unitários — é o motivo de o script existir.

## 7. O que NÃO foi feito

* Nenhuma migration. O schema não precisou de mudar.
* Nenhuma pessoa fictícia em nenhum ecrã, relatório ou PDF.
* Nenhuma cláusula contratual gerada.
* Nenhum texto do PDF de referência adivinhado: a estrutura vem da
  implementação que o reproduzia, e o que ela não suporta não foi escrito.

## 8. Validação

```
npm run typecheck   OK
npm run lint        OK
npm test            280 testes, 34 ficheiros, 0 falhas (242 antes da fase)
npm run build       OK — 18 rotas, inclui /api/projects/[id]/cronograma/relatorio/pdf
```

E, contra um PostgreSQL real (embebido, temporário, sem tocar em produção):

```
npx tsx scripts/verificar-fase3.mjs

OK    responsáveis vêm da base, sem nomes inventados — Eduardo Marques, Luan Almeida
OK    mudança de estado sem sessão é recusada
OK    etapa recusada não foi alterada
OK    progresso pela regra única — 39% — (100+35+60+0+0)/5 = 39
OK    alertas pela regra única — dueSoon=1 blocked=1 overdue=0
OK    equipe só com responsáveis reais — Eduardo Marques, Luan Almeida
OK    cliente é o último signatário
OK    PDF válido
OK    PDF com conteúdo real — 19931 bytes
OK    PDF leva a obra e a equipa da base
OK    PDF sem etapas é gerado na mesma — 11278 bytes
OK    relatório vazio diz que não há dados, em vez de mostrar 0%

FASE 3: tudo verificado.
```
Campos da referência que **o modelo não tem** (área construída, lote/quadra,
zoneamento) são lidos de `Project.address` quando o ADMIN os guardou e
impressos como **"Não informado"** quando não. Nada é preenchido por omissão.

### Modelos oficiais — BLOQUEADO

Procurados no projecto e no workspace: proposta, contrato, modelos DOCX/PDF,
referências documentais. **Não existem como ficheiros.**

O que existe é o `ContractTemplate` na base (`prisma/seed.ts` +
`src/lib/contract-template.ts`): um esqueleto com variáveis `{{...}}` e cláusulas
que o ADMIN escreve em `/admin/mensagens`. **Não é um documento oficial** — é
uma estrutura editável, propositadamente sem texto jurídico.

Consequência: **nenhuma cláusula, fórmula ou termo contratual foi inventado.**
O relatório de cronograma é um dossiê técnico de acompanhamento físico; não
contém texto contratual e não precisa dele.

Ficheiros necessários para desbloquear esta parte:

1. modelo DOCX ou PDF da proposta comercial oficial;
2. modelo DOCX ou PDF do contrato oficial (assinatura manuscrita/electrónica);
3. modelo do relatório de cronograma em PDF (a fonte directa das 8 secções);
4. tabela de honorários / condições de pagamento oficial, se diferente do
   `ServiceItem` / `CommercialPackage` já cadastrados.
```

**Antes da fase** a regra estava em `dashboard-service.stageCompletion` e era
**copiada** em `schedule-service.stageCompletionValue`, que ainda recalculava a
média do quadro à mão. Duas implementações para o mesmo número. A cópia foi
removida; `dashboard-service` reexporta de `@/lib/progress` para não partir os
consumidores existentes.

Cobertura: `dashboard-service.test.ts` (7) + `schedule-report.test.ts` (20).