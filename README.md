# Cronograma ArqVértice

Acompanhamento de projetos e obra por fase, com painel para o cliente e
relatório executivo em PDF.

Aplicação estática — HTML, CSS e JavaScript sem build — mais funções
serverless em `api/` para a persistência em PostgreSQL.

## O que ela faz

- **Ficha da obra** com cliente, localização, zoneamento, áreas e prazos.
- **Equipe técnica** calculada a partir das tarefas: cada profissional
  aparece com as disciplinas sob sua responsabilidade e o avanço real.
- **Fase atual do empreendimento** com o marcador "Estamos aqui", etapas em
  execução, próximas entregas e um resumo executivo em uma frase.
- **Kanban** em Não Iniciado / Em Andamento / Finalizado, com as etapas
  agrupadas por disciplina dentro de cada coluna e resumo por coluna.
- **Tabela de controle** com ordenação e edição em linha.
- **Relatório em PDF** para o cliente, com fase atual e parecer técnico
  calculado a partir das etapas reais.

Disciplinas: Arquitetura, 3D, Estrutural, Complementares e Execução da Obra.
A lista é definida em `PHASE_MODEL`, no início de `painel-cliente.js`, e é a
fonte única — faixa de fases, Kanban, KPIs e relatório leem todos dali.

## Banco de dados

Sem banco configurado o app funciona igual, guardando tudo no `localStorage`
do navegador. Com banco, o servidor passa a ser a fonte da verdade.

Para ligar:

1. Provisionar um PostgreSQL e definir `DATABASE_URL` no ambiente.
2. Definir `ADMIN_KEY` — uma senha longa, que libera as escritas.
3. Aplicar o esquema: `psql "$DATABASE_URL" -f database/schema.sql`

Conferir em `/api/status`, que devolve o diagnóstico sem expor credencial.

**Leitura é pública** (o cliente acompanha a obra pelo link) e **escrita exige
a chave**, enviada no cabeçalho `x-chave-admin`. O selo no cabeçalho da página
mostra a origem dos dados e é onde a chave é informada.

## Rodar localmente

Não é preciso Node nem Python:

```
iniciar_local.bat
```

O `.bat` chama `scripts/servidor-local.ps1`, um servidor estático em
PowerShell puro. As funções de `api/` não rodam nesse modo — o app cai para
`localStorage`, que é o comportamento esperado sem banco.

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura da página |
| `app.js` | Estado, filtros, Kanban, tabela, modais e relatório |
| `painel-cliente.js` | Fases, equipe técnica e resumos do Kanban |
| `api-cliente.js` | Ponte com a API e decisão entre modo local e nuvem |
| `api/` | Funções serverless: `tarefas`, `projeto` e `status` |
| `database/schema.sql` | Esquema PostgreSQL, idempotente, com carga inicial |

---

O briefing de entrevista com o cliente é uma aplicação separada, no
repositório `briefing-arqvertice`.

ArqVértice • Arquitetura, Estrutura & Engenharia
