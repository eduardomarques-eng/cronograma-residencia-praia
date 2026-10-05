/**
 * FASE 4C — ADAPTADOR DE MODELO (itens 15, 16 e 18).
 *
 * O projecto já tem o padrão certo em `transcription.ts`: declarar a
 * INTERFACE, implementar o provider HTTP quando está configurado, e — quando
 * não está — dizer que não faz, com uma razão. Nunca devolver texto
 * inventado, nunca devolver string vazia a fingir que reescreveu.
 *
 * A consequência é deliberada: o Studio funciona NA TOTALIDADE sem qualquer
 * chave de API. As transformações estruturais (resumir, em lista, em cards,
 * melhorar layout, reordenar, duplicar, trocar layout) são locais e
 * determinísticas; só a REESCRITA DE LINGUAGEM precisa de um modelo, e é a
 * única parte que se degrada.
 *
 * O prompt é construído AQUI, e não no componente. É o que garante que as
 * regras comerciais viajam sempre: um componente novo não pode escrever um
 * prompt que peça ao modelo "sugira um preço".
 */

import { describeTarget, targetText, type AiContext, type AiScope, type AiTarget } from "@/lib/studio-ai";
import { hasProvider, providerChain, resolveAiConfig } from "@/lib/studio-ai-registry";
import type { TextIntent } from "@/lib/studio-text";

export type AiResult = { ok: true; text: string } | { ok: false; reason: string };

export interface AiProvider {
  readonly name: string;
  available(): boolean;
  complete(input: { system: string; prompt: string }): Promise<AiResult>;
}

/**
 * Regras que viajam em TODOS os prompts.
 *
 * Escritas uma vez, e não em cada chamada: um prompt escrito à mão num
 * componente é um prompt que um dia fica sem a regra do preço.
 */
const COMMERCIAL_RULES = [
  "Nunca inventes valores comerciais: preços, totais, descontos, prazos, áreas ou condições.",
  "Se um dado não existe, escreve um marcador explicito como [preencher] em vez de o estimar.",
  "Nao inventes normas tecnicas, dados legais nem informacoes do cliente.",
  "Usa portugues europeu.",
].join(" ");

/** Descrição da acção, por intenção. */
const ACTION_PT: Partial<Record<TextIntent, string>> = {
  PRESERVE: "devolve o texto exactamente como esta",
  IMPROVE: "melhora a redacao mantendo o sentido",
  REWRITE: "reescreve com a mesma informacao",
  SHORTEN: "resume para as ideias essenciais",
  EXPAND: "expande com detalhe que ja esteja implicito no texto",
  COMMERCIAL: "torna mais orientado a decisao",
  TECHNICAL: "torna mais rigoroso tecnicamente",
  SOPHISTICATED: "torna mais sofisticado",
  SIMPLIFY: "simplifica a frase",
  FIX_PT: "corrige ortografia, concordancia e pontuacao",
  TRANSLATE: "traduz mantendo o sentido",
};

function systemPrompt(context: AiContext, scope: AiScope): string {
  return [
    "Es o redactor da ARQVERTICE, um estudio de arquitectura e design em Portugal.",
    `Projecto: ${context.projectName}. Cliente: ${context.clientName}.`,
    context.objective ? `Objectivo da proposta: ${context.objective}.` : "",
    `Idioma: ${context.language}. Estilo da apresentacao: ${context.style}.`,
    context.restrictions.length ? `Restricoes respeitadas: ${context.restrictions.join(" | ")}` : "",
    `Ambito da alteracao: ${scope}. Altera APENAS o indicado; o resto fica intacto.`,
    COMMERCIAL_RULES,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Constrói o pedido de texto.
 *
 * O original é sempre incluído. Sem ele, "preserve o que eu escrevi" e
 * "reescreva isto" seriam indistinguíveis para o modelo — e a validação a
 * jusante não teria com que comparar.
 */
export function textPrompt(input: {
  context: AiContext;
  target: AiTarget;
  scope: AiScope;
  intent: TextIntent;
  instruction: string;
}): { system: string; prompt: string } {
  const original = targetText(input.target);
  return {
    system: systemPrompt(input.context, input.scope),
    prompt: [
      `O que deve ser alterado: ${describeTarget(input.target)}.`,
      original ? `Texto original (nao o percas):\n"""${original}"""` : "",
      `Accao pedida: ${ACTION_PT[input.intent] ?? "melhorar o texto"}.`,
      input.instruction ? `Instrucao do utilizador: ${input.instruction}` : "",
      "Devolve apenas o texto final, sem comentarios e sem aspas.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/** Provider manual: sem serviço configurado, diz que não reescreve. */
class ManualAiProvider implements AiProvider {
  readonly name = "manual";

  available(): boolean {
    return false;
  }

  async complete(): Promise<AiResult> {
    return {
      ok: false,
      reason:
        "Nao ha modelo de linguagem configurado. O texto nao foi alterado — pode edita-lo a mao, ou usar as opcoes que funcionam sem modelo (resumir, em lista, em cards).",
    };
  }
}

/**
 * Serviço HTTP de um fornecedor de texto.
 *
 * Não há SDK de ninguém aqui — e é essa a promessa do item 53. O contrato é
 * `{ system, prompt } → { text }`, que qualquer serviço compatível cumpre, e o
 * `fetch` já existia no projecto. Adicionar um SDK para "ter um SDK" seria
 * trocar uma dependência mínima por três.
 */
class HttpAiProvider implements AiProvider {
  readonly name: string;

  constructor(
    private readonly endpoint: string,
    private readonly apiKey?: string,
    /** Modelo a pedir. `null` deixa a decisão ao serviço. */
    private readonly model?: string | null,
  ) {
    this.name = endpoint ? "http" : "manual";
  }

  available(): boolean {
    return Boolean(this.endpoint);
  }

  async complete(input: { system: string; prompt: string }): Promise<AiResult> {
    const controller = new AbortController();
    // Sem limite, um serviço que não responde bloqueia o editor indefinidamente.
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        // O modelo viaja no corpo, e não no código: trocar de modelo é
        // configuração, não uma alteração ao código (item 53).
        body: JSON.stringify({ ...input, model: this.model ?? undefined }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          ok: false,
          reason: `O serviço de texto respondeu ${response.status}. O texto original foi mantido.`,
        };
      }
      const payload = (await response.json()) as { text?: unknown };
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      // Vazio é falha, nunca resultado. Aplicar um vazio apagaria o trabalho
      // do ADMIN sem que ele o pedisse.
      if (!text) {
        return { ok: false, reason: "O serviço de texto devolveu vazio. O texto original foi mantido." };
      }
      return { ok: true, text };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "Falha ao pedir texto ao serviço.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Os fornecedores a tentar, pela ordem, com o fallback incluído (item 53).
 *
 * A ordem vem do registo, não deste ficheiro: um componente nunca decide quem
 * chamar.
 */
export function aiProviders(): AiProvider[] {
  const config = resolveAiConfig(process.env).TEXTO;
  return providerChain(config).map(
    (entry) => new HttpAiProvider(entry.endpoint, entry.apiKey ?? undefined, entry.model),
  );
}

/** O serviço principal, ou o manual quando não há nenhum. */
export function aiProvider(): AiProvider {
  return aiProviders()[0] ?? new ManualAiProvider();
}

/** `true` quando há um serviço configurado. O editor usa para explicar. */
export function aiAvailable(): boolean {
  return hasProvider(resolveAiConfig(process.env).TEXTO);
}

/**
 * Executa um comando de texto, recorrendo ao fallback se o principal falhar.
 *
 * O fallback só é tentado quando o primeiro devolveu FALHA — nunca depois de um
 * sucesso, e nunca quando o comando foi bloqueado pelas regras comerciais. Um
 * fallback que reescreve o texto depois de o principal ter escrito algo válido
 * seria uma segunda tentativa que ninguém pediu.
 */
export async function completeWithFallback(input: {
  system: string;
  prompt: string;
}): Promise<AiResult> {
  const providers = aiProviders();
  let last: AiResult = {
    ok: false,
    reason:
      "Não há modelo de linguagem configurado. O texto não foi alterado — pode editá-lo à mão, ou usar as opções que funcionam sem modelo (resumir, em lista, em cards).",
  };

  for (const provider of providers) {
    const result = await provider.complete(input);
    if (result.ok) return result;
    last = result;
  }

  return last;
}