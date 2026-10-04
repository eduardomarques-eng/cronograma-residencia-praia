---
name: arqvertice-code-review
description: Rever alterações do ARQVERTICE FLOW antes do commit. Usar após implementar um bloco, ou ao rever código existente.
---

# Revisão de código — ARQVERTICE FLOW

Sempre o mesmo ciclo, um bloco de cada vez:

```
diagnóstico → causa → correcção → teste → validação → commit
```

## Ordem de verificação

**1. Segurança (primeiro, sempre)**
- A rota nova exige sessão? Chama `requirePageRole` / `requirePageProjectAccess`?
- O middleware está a ser usado como se fosse autorização? **Não é.**
- IDOR: a consulta filtra por `clientId` / `ProjectAccess`, ou só por `id`?
- Segredo em código, log, `.env` versionado ou resposta de API?
- Resposta de endpoint que revela se um recurso existe?

**2. Regra de negócio**
- O `status` foi mexido à mão? É **derivado** de `completion`.
- Calculou-se percentagem por fora de `stageCompletion`? Cria uma segunda verdade.
- Valor comercial hardcoded? Tem de vir de `ServiceItem`/`CommercialPackage`.

**3. Correcção**
- Query sem `where` que devolve a tabela inteira?
- `Promise.all` onde um `reject` deixa a página a meio?
- Falta `await`? `Decimal` a chegar a `number` sem `Number()`?
- Props inventadas em componentes UI — a prop existe mesmo?

**4. Ux que o utilizador sente**
- Link sem destino (`href="#algo"` que não existe)?
- Estado vazio que promete dados que não são lidos?
- Acção sem feedback (loading / erro / sucesso)?
- Overflow em ecrã estreito?

**5. Testes**
- A regra nova tem teste? Regressão chumbada — corrigir o código, **nunca**
  apagar o teste para ficar verde.
- `npm run typecheck && npm run lint && npm test` passam?

## Como reportar

Não dizer "parece bem" a código não lido. Para cada achado: **ficheiro:linha**,
o que está errado, e a correcção. Se não houver achados, dizer isso — e dizer o que
foi lido para chegar à conclusão.