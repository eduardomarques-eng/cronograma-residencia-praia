# FASE 4A — AUDITORIA E DECISÕES

## 1. Mapa do que existia antes

| Entidade / peça | Origem | Responsabilidade | Usada por | Decisão |
| --- | --- | --- | --- | --- |
| `Briefing` | `schema.prisma` | Respostas em `Json`, estado `DRAFT`/`FINALIZED`, `version`, revisões | portal, link público, admin | **Preservada.** Formato do conteúdo evoluído sem migration destrutiva. |
| `BriefingRevision` | `schema.prisma` | Histórico de respostas por versão | `finishBriefing` | **Preservada** e passou a gravar o envelope novo. |
| `BriefingAccessLink` | `schema.prisma` | Token de acesso do cliente | briefing público | **Preservada.** É a autorização da experiência pública. |
| `BriefingVisualOption` | `schema.prisma` | Imagens que o ADMIN publica nas perguntas | admin, portal | **Preservada.** É catálogo do estúdio, não resposta do cliente. |
| `briefingSections` | `briefing-definition.ts` | 5 secções, 25 perguntas, 5 tipos | `GuidedBriefing`, admin | **Substituída** por 22 etapas. IDs antigos mantidos. |
| `GuidedBriefing` | componente | Ecrã único, autosave por tecla, progresso enganador | portal e link público | **Reescrito.** |
| `VoiceTextarea` | componente | Web Speech API: ditado para texto **no browser** | `GuidedBriefing` | **Não é transcrição.** Mantido como ditado; áudio real passou a `MediaField`. |
| `document-service` | serviço | Storage S3/local, `ProjectDocument` | portal, propostas, contratos | **Reutilizado.** Storage extraído para `src/server/storage.ts`. |
| `AuditLog` / `audit.ts` | infra | Auditoria central | todo o sistema | **Reutilizado.** Sem auditoria paralela. |
| `Client`, `Project` | schema | Dados do cliente e do projeto | todo o sistema | **Não duplicados.** O briefing não repete nome nem e-mail. |

### O que estava incompleto

- `responses` era um `Json` livre: nenhuma forma, nenhuma validação, e `guided-briefing.tsx` adivinhava o tipo de cada valor em tempo de execução (`answerText`).
- O progresso era `respondidas / total`. Contava perguntas condicionais como pendentes para sempre — um cliente sem cachorro via "detalhes sobre animais" em falta para sempre.
- Não existiam: obrigatoriedade, condicionais, escalas, upload, áudio, grupos repetíveis, programa de necessidades estruturado, relações entre ambientes, "gosta/não gosta", ambiente, consolidação, conflitos nem prontidão para projeto.
- O autosave gravava **a cada tecla**: uma resposta de três parágrafos gerava centenas de writes.
- `saveBriefingResponses` substituía o mapa inteiro de respostas: um autosave parcial apagava o resto.
- As exceções de "briefing já finalizado" eram `Error` cru, não `DomainError`.

## 2. Decisões de arquitectura

| Decisão | Porquê |
| --- | --- |
| Envelope versionado em `responses` (`{ v: 2, updatedAt, answers }`) | Evoluir o formato sem migration destrutiva **e** sem perder as respostas já gravadas. `readAnswers` lê o formato antigo sem perda. |
| IDs das perguntas antigos mantidos | Mudar um ID apagaria o histórico do cliente sem ninguém dar por isso. Há teste a fixá-los. |
| Condicionais como DADOS (`showIf`), não como `if` | Acrescentar "pergunte isto se tiver crianças" passa a ser uma linha na definição, não uma alteração em dois sítios. |
| `ANSWER_KIND` como união fechada | Um tipo novo exige desenho explícito; não abre um buraco tipo `any` que depois alguém preenche mal. |
| Storage extraído para `src/server/storage.ts` | O briefing precisa de guardar ficheiros. Recriar a configuração S3 seria um **segundo** sistema de armazenamento — o que o enunciante proíbe. |
| `BriefingReference` nova | `ProjectDocument` não tem "gosta/não gosta", nem a que pergunta pertence, nem se foi descartada. `BriefingVisualOption` é catálogo do ADMIN, não resposta do cliente. Não havia entidade equivalente. |
| `BriefingAudioNote` nova | O áudio precisa de estado de transcrição e de `transcript` vs `reviewedText`. Nada disso existe em `ProjectDocument`. |
| Estados `DRAFT`/`FINALIZED` mantidos | O enunciante diz para reutilizar estados existentes. "Pronto para projeto" é um **indicador calculado** (`readiness.ready`), não um estado novo na base. |
| Sem migration destrutiva | `Briefing.responses` continua `jsonb`. A migração só cria tabelas e um enum. |
| Consolidação pura e calculada | É o contrato com a Fase 4B: se dependesse de I/O, o ecrã e o serviço dariam números diferentes. |
| Conflitos apontados, nunca corrigidos | Um sistema que decide sozinho que o cliente se enganou apaga a única coisa que ele disse. |

## 3. O que NÃO foi feito, e porquê

- **Transcrição real**: não existe provider configurado no projecto. `src/server/services/transcription.ts` define a interface e duas implementações — `manual` (sem serviço externo; o áudio guarda-se e o cliente escreve) e `http` (serviço próprio, activada por `TRANSCRIPTION_ENDPOINT`). Sem endpoint configurado, o estado fica `UPLOADED` e **nunca** `TRANSCRIBED`. **Não é transcrição real hoje.**
- **Leitura/escuta do áudio pelo cliente**: as notas de áudio são gravadas e transcritas, mas não há ainda o ecrã de reprodução. O registo guarda o `storageKey` e o serviço `readAudioFile` já devolve os bytes com verificação de acesso — falta a rota e o elemento `<audio>`.
- **Ecrã de consola do briefing para o ADMIN**: o serviço `getConsolidatedBriefing` existe e está testado, mas não foi montada a página de leitura. Não há forma de o ver além de testes.
- **`docs/FASE-4A-AUDITORIA.md`** diz exactamente o mesmo que este ficheiro; este é o registo canónico.

## 4. Migration

`prisma/migrations/20261005000000_briefing_references_audio/` — cria `BriefingReference`, `BriefingAudioNote` e o enum `BriefingAudioStatus`. Nada é alterado ou apagado. **Não foi aplicada a nenhuma base** (ver secção de pendências do relatório).