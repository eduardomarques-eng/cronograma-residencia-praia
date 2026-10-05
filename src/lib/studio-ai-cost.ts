/**
 * FASE 4E — CONTROLO DE CUSTO DA IA (item 54).
 *
 * Uma chamada a um modelo é dinheiro e tempo. O item 54 pede quatro coisas, e
 * este módulo trata cada uma como uma FUNÇÃO testável, não como um cuidado que
 * o componente deve ter:
 *
 *  1. **Mostrar a acção antes de a executar.** `planAiCall` decide se a operação
 *     é gratuita, barata ou cara, e devolve o que a interface tem de confirmar.
 *  2. **Enviar só o contexto necessário.** `buildScopedContext` monta o payload
 *     conforme o âmbito: alterar um elemento não leva a apresentação inteira.
 *     Isto não é optimização — é o item 54 a proibir explicitamente "reenviar a
 *     apresentação inteira quando somente um elemento foi alterado".
 *  3. **Reaproveitar resultados.** `aiCacheKey` dá uma chave estável para o
 *     mesmo pedido, e `AiResultCache` devolve o resultado anterior em vez de
 *     pagar duas vezes pelo mesmo texto.
 *  4. **Não regenerar imagens sozinho.** `shouldGenerateImage` só autoriza
 *     quando há pedido explícito e prompt escrito — nunca por omissão.
 *
 * Tudo aqui é PURO e determinístico: um teste pode fixar o custo.
 */

import type { AiScope } from "./studio-ai";

/* -------------------------------------------------------------------------- */
/* 1. MOSTRAR A ACÇÃO                                                          */
/* -------------------------------------------------------------------------- */

/** O que a operação custa, e o que a interface precisa de dizer. */
export type AiCostClass = "LOCAL" | "REMOTA" | "GERACAO_IMAGEM";

export type AiCallPlan = {
  cost: AiCostClass;
  /**
   * `true` quando o ADMIN tem de confirmar antes de a operação correr.
   *
   * Geração de imagem exige sempre confirmação: é a única acção que produz um
   * ficheiro, custa por unidade e não se desfaz. As transformações de texto
   * remotas não exigem confirmação porque já têm pré-visualização antes de
   * aplicar — o ADMIN vê o que vai mudar.
   */
  requiresConfirmation: boolean;
  /** Texto a mostrar ao ADMIN, em português. */
  notice: string;
  /** `true` quando a operação pode correr sem serviço configurado. */
  worksOffline: boolean;
};

/**
 * Decide o custo e a confirmação de uma operação.
 *
 * A distinção entre `LOCAL` e `REMOTA` não é estética: `LOCAL` significa que a
 * resposta é calculada aqui, sem custo e sem latência, e a interface pode
 * oferecer essas opções mesmo sem nenhum serviço configurado.
 */
export function planAiCall(input: {
  /** `true` quando a operação roda sem modelo. */
  local: boolean;
  /** `true` quando produz uma imagem nova. */
  generatesImage?: boolean;
  /** `true` quando o ADMIN pediu explicitamente. */
  explicit?: boolean;
}): AiCallPlan {
  if (input.generatesImage) {
    return {
      cost: "GERACAO_IMAGEM",
      requiresConfirmation: true,
      notice:
        "Vai ser gerada uma imagem nova, que fica guardada na proposta. Confirme para continuar.",
      worksOffline: false,
    };
  }

  if (input.local) {
    return {
      cost: "LOCAL",
      requiresConfirmation: false,
      notice: "Transformação local: sem custo e sem serviço necessário. Pode aplicar já.",
      worksOffline: true,
    };
  }

  return {
    cost: "REMOTA",
    // A pré-visualização JÁ é a confirmação: o ADMIN vê o comparativo antes de
    // aplicar. Pedir confirmação aqui seria um clique a mais sem informação nova.
    requiresConfirmation: false,
    notice:
      "A alteração usa um modelo de linguagem e é preparada para pré-visualização antes de ser aplicada.",
    worksOffline: false,
  };
}
/* -------------------------------------------------------------------------- */
/* 2. CONTEXTO MÍNIMO                                                         */
/* -------------------------------------------------------------------------- */

/** O contexto que viaja num comando, já reduzido ao âmbito. */
export type ScopedAiContext = {
  /** Âmbito do comando. */
  scope: AiScope;
  /** Identificação do alvo: a página, o elemento, ou nada. */
  targetSlideId: string | null;
  targetElementId: string | null;
  /** Títulos das páginas, para a IA saber o que existe. */
  outline: readonly string[];
  /** Texto a alterar. `null` quando o comando não reescreve nada. */
  targetText: string | null;
};

/**
 * Reduz o contexto ao que o comando precisa.
 *
 * A regra do item 54 é literal: "não reenviar a apresentação inteira quando
 * somente um elemento foi alterado". Por isso o payload consoante o âmbito é:
 *
 *  · `ELEMENTO` → o texto do elemento e o título da página. As outras páginas
 *    não são enviadas.
 *  · `SLIDE`     → o texto da página. Não o corpo das outras páginas.
 *  · `PRESENTACAO` → os títulos todos, porque é a única situação em que a
 *    estrutura inteira é o objecto da conversa.
 *
 * O `outline` acompanha sempre porque é barato (uma frase por página) e é o que
 * impede a IA de propor uma página que já existe.
 */
export function buildScopedContext(input: {
  scope: AiScope;
  outline: readonly string[];
  selection?: { slideId?: string | null; elementId?: string | null };
  targetText?: string | null;
}): ScopedAiContext {
  const { scope } = input;
  const slideId = input.selection?.slideId ?? null;
  const elementId = input.selection?.elementId ?? null;

  // A apresentação inteira é o único caso em que o outline completo é
  // necessário, e é também o único em que vale o custo de o enviar.
  const outline = scope === "PRESENTACAO" ? input.outline : input.outline.slice(0, 1);

  return {
    scope,
    targetSlideId: scope === "PRESENTACAO" ? null : slideId,
    targetElementId: scope === "ELEMENTO" ? elementId : null,
    outline,
    targetText: input.targetText ?? null,
  };
}

/**
 * Quantos caracteres SAEM num comando.
 *
 * Existe para a interface poder mostrar o custo antes de enviar, e para o teste
 * fixar que `ELEMENTO` envia menos do que `PRESENTACAO`. Sem esta função a
 * economia seria invisível e ninguém a manteria.
 */
export function contextSize(context: ScopedAiContext): number {
  return (
    context.outline.reduce((sum, title) => sum + title.length, 0) +
    (context.targetText?.length ?? 0) +
    (context.targetSlideId?.length ?? 0) +
    (context.targetElementId?.length ?? 0)
  );
}
/* -------------------------------------------------------------------------- */
/* 3. REAPROVEITAR RESULTADOS                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Chave estável para o mesmo pedido.
 *
 * Determinística por CONTEÚDO e não por tempo: o mesmo comando sobre o mesmo
 * texto dá a mesma chave, e é isso que permite reutilizar. Se a chave levasse
 * um `Date.now()`, nunca haveria acerto e a cache seria apenas memória
 * consumida.
 *
 * O modelo entra na chave: trocar de modelo invalida o que foi guardado, porque
 * o texto devolvido pelo modelo novo não é o mesmo resultado.
 */
export function aiCacheKey(input: {
  scope: AiScope;
  instruction: string;
  targetText: string;
  model?: string | null;
}): string {
  return [input.model ?? "", input.scope, input.instruction.trim().toLowerCase(), input.targetText.trim()].join("::");
}

/**
 * Cache de resultados, com limite.
 *
 * O limite não é um detalhe: sem ele, uma sessão longa de escrita enche a
 * memória e uma cache que cresce sem limite acaba por custar mais do que a
 * chamada que evita.
 */
export class AiResultCache {
  private readonly entries = new Map<string, string>();

  constructor(private readonly limit = 50) {}

  /** `true` quando há resultado para esta chave. */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** O resultado guardado, ou `null`. */
  get(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  /** Guarda um resultado. A chave mais antiga sai primeiro (FIFO). */
  set(key: string, text: string): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, text);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

/* -------------------------------------------------------------------------- */
/* 4. IMAGENS SÓ A PEDIDO                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Autoriza ou recusa uma geração de imagem (item 54: "evitar regeneração
 * automática de imagens sem comando").
 *
 * Duas condições, ambas necessárias:
 *
 *  · **pedido explícito** — sem um comando do ADMIN não há geração, seja a
 *    imagem necessária ou não;
 *  · **prompt escrito** — uma imagem gerada sem instrução não pode ser
 *    reproduzida nem defendida numa reunião (mesma regra do `studio-media`).
 */
export function shouldGenerateImage(input: {
  explicitRequest: boolean;
  prompt: string;
  /** Substituir uma imagem que já está na página. */
  replacing?: boolean;
}): { allowed: boolean; reason: string } {
  if (!input.explicitRequest) {
    return {
      allowed: false,
      reason:
        "Nenhuma imagem foi gerada: a geração só acontece quando o ADMIN a pede. As imagens existentes continuam a ser usadas.",
    };
  }
  if (!input.prompt.trim()) {
    return {
      allowed: false,
      reason:
        "Escreva o que pretende na imagem antes de a gerar. Uma imagem gerada sem instrução não pode ser reproduzida depois.",
    };
  }
  if (input.replacing) {
    return {
      allowed: true,
      reason: "Confirme a substituição: a imagem anterior mantém-se na biblioteca, mas sai desta página.",
    };
  }
  return { allowed: true, reason: "Vai ser gerada uma imagem nova a partir da sua descrição." };
}