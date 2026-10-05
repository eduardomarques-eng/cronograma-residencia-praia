# ARQVERTICE PROPOSAL STUDIO — 4C

Documento de **comportamento de produto**. Descreve o que o sistema faz e o que
garante, não o que o código faz linha a linha. Para o "como" mecânico, os
ficheiros `src/lib/studio-*.ts` têm o raciocínio no cabeçalho de cada função.

---

## 1. O QUE O STUDIO É

Transforma **projecto + briefing + escopo + serviços + dados comerciais +
texto/PDF + imagens** numa proposta comercial que o cliente aprova — sem que os
números possam divergir uns dos outros.

O fluxo pretendido pelo utilizador é:

> Escolho de onde vem o conteúdo → a IA cria uma primeira versão → controlo a
> estrutura → acrescento ou tiro páginas → escolho layouts → troco o tema →
> edito qualquer elemento → troco imagens → refino com IA → vejo como fica →
> publico → mando pelo WhatsApp → o cliente aprova.

O sistema tem de **parecer simples apesar de ser robusto por dentro**. A regra
que explica quase todas as decisões deste documento: *complexidade que não se vê
não entra na interface; complexidade que protege o dinheiro fica no servidor.*

---

## 2. ARQUITECTURA

Quatro camadas. A regra é que **nenhuma desce**: um componente não calcula
preços, um módulo de domínio não fala com a base de dados.

```
src/lib/studio-*.ts          DOMÍNIO — puro, sem React, sem I/O, testável
src/server/services/*        SERVIÇO — autorização, leitura do banco, escrita
src/app/actions/*            SERVER ACTIONS — validam e delegam
src/components/studio/*      INTERFACE — mostra e devolve alterações
```

Porque o domínio é puro: é a única forma de uma regra comercial ser testada
sem base de dados. `computeTotals` é a MESMA função que produz a proposta, o
PDF e o contrato — não duas implementações que concordam hoje.

---

## 3. INTEGRIDADE COMERCIAL — a regra que governa tudo

> **Um elemento da apresentação guarda a FONTE do número, nunca o número.**

Um elemento ligado tem `binding: "INVESTIMENTO"`. As linhas são resolvidas a
cada leitura, a partir da `ProposalVersion`. Três consequências:

1. Um valor comercial **não diverge** da proposta — não há cópia a sincronizar.
2. Reeditar o preço **obliga a passar pela proposta**, que recalcula subtotal,
   total e parcelas.
3. A vista pública e a apresentação mostram **o mesmo número**, porque as duas
   leem a mesma função.

### Onde esta regra é imposta

| Ponto | Mecanismo |
|---|---|
| Gravação | `assertNoCommercialInvented` recusa elemento ligado com linhas escritas |
| Geração por IA | `generateFromProject` corre a mesma verificação com os valores reais |
| Comando de IA | `guardCommercialCommand` transforma "reduza 20%" em acção oficial |
| Saída do modelo | `findCommercialDrift` apanha números inventados no texto |
| Importação | `applyImportMode` + `assertImportTouchedNothing` |

**O preço só muda por `ProposalVersion`.** Um desconto pedido em linguagem
natural vira `AJUSTE_PERCENTUAL` calculado por `computeTotals`, com
versionamento — nunca texto escrito num parágrafo.

---

## 4. VERSIONAMENTO E PUBLICAÇÃO

- `ProposalVersion` guarda o retrato: serviços, totais, plano de pagamento
  **congelado** e a apresentação.
- O link público **fixa uma versão**. O que o cliente aprova é reproduzível
  depois, mesmo que o ADMIN continue a editar.
- Aprovar **congela**. Uma proposta aprovada não volta a abrir para edição.
- `paymentPlan` é congelado por versão porque, antes disso, editar o texto de
  pagamento tornava uma proposta já enviada mutável.

O fluxo de publicação: `createProposalLink` → token com hash, expiração e
revogação → o cliente lê o DTO reduzido → decide → a decisão grava auditoria.

---

## 5. AUTORIZAÇÃO

`clientId`, `projectId` e `proposalId` **nunca** são prova de autorização. As
funções em `src/server/auth.ts` percorrem a cadeia no banco
(`Proposal → Project → Client`) e comparam com o utilizador autenticado.

Um recurso inacessível responde **igual** a um inexistente — caso contrário, um
atacante confirmaria a existência de dados de terceiros.

---

## 6. GUIA — COMO EXTENDER

### Criar um template
`src/lib/studio-templates.ts` → acrescentar em `TEMPLATES` com
`{ key, label, category, purpose, layouts, theme }`. Aparece sozinho no painel.

### Adicionar um layout
`src/lib/studio-layout.ts` → acrescentar a chave a `LayoutKey` **e** a
`LAYOUT_CATEGORY`. Depois criar o desenho em `slide-canvas.tsx`.

### Adicionar um provider de IA
`src/lib/studio-ai-registry.ts` — atribuição de ambiente, não código. Definir
`STUDIO_AI_ENDPOINT` / `_MODEL` / `_FALLBACK_ENDPOINT`. **Não há SDK para
importar**: o contrato é `{ system, prompt } → { text }` e qualquer serviço
compatível serve. Trocar de fornecedor é mudar configuração.

### Adicionar um provider de imagem
O mesmo registo, papel `IMAGEM` (`STUDIO_IMAGE_*`).

### Adicionar um componente
1. Tipo do elemento em `studio-deck.ts`
2. Desenho em `slide-canvas.tsx`
3. Regra comercial em `studio-smart-elements.ts` se ligado a dados
4. Teste em `studio-deck.test.ts`

---

## 7. AUDITORIA

`AuditLog` regista criação, importação, edição por IA e manual, layout, tema,
páginas criadas/removidas/duplicadas/reordenadas, imagens, publicação, envio,
visualização, aprovação, rejeição e nova versão.

O **diff entre o deck anterior e o novo** produz os eventos — não um registo
genérico de "guardou". A origem (IA / importação / template) é uma DECLARAÇÃO
do editor, e isso é seguro porque nada de segurança depende dela: quem pode
gravar, se está congelado e que valores são legíveis é decidido no servidor.

---

## 8. ESTADO ATUAL (2026)

**Funciona e está testado:** núcleo da proposta, modelo de apresentação, editor
(painel de páginas, adicionar/excluir/duplicar/reordenar, undo/redo, autosave,
IA com âmbito, tema, layouts), geração, importação, templates, sugestões,
pré-visualização, apresentação pública, WhatsApp, PDF, aprovação e contrato.

**Por fazer:** verificação manual no browser (nunca executada), Image Studio
completo, importação de PDF binário, e `imageProps` por aplicar aos
componentes de imagem do canvas.