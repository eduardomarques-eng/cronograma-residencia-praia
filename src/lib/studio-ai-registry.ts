/**
 * FASE 4E — CAMADA DE ABSTRACÇÃO DA IA (item 53).
 *
 * O Proposal Studio não pode estar acopulado a um fornecedor. Este módulo é o
 * registo que torna isso verdade, e é deliberadamente um módulo PURO: recebe o
 * ambiente como argumento e devolve configuração. Nada de `process.env` aqui
 * dentro — assim a política de escolha de fornecedor é testável sem servidor,
 * e o mesmo código serve o editor, o PDF e uma futura migração de fornecedor.
 *
 * O que este módulo NÃO faz: importar o SDK de ninguém. O item 53 proíbe
 * duplicar SDKs sem necessidade. O que existe é um `fetch` para o endpoint
 * configurado, que é o mesmo contrato de qualquer fornecedor compatível. Trocar
 * de fornecedor é mudar configuração; é por isso que não há dependência nova.
 *
 * Quatro decisões que a abstração tem de suportar, e que a lista de campos
 * abaixo transforma em coisas verificáveis:
 *
 *  1. **Fornecedor** — `TEXTO` e `IMAGEM` podem apontar para serviços
 *     diferentes. Um estúdio que gere texto num sítio e imagens noutro é normal.
 *  2. **Modelo** — o nome do modelo é configuração, não código. Mudar de modelo
 *     não deve ser um commit que toca em componentes.
 *  3. **Fallback** — quando o fornecedor principal falha, o próximo entra. Um
 *     editor que deixa de funcionar quando um serviço cai não é um editor.
 *  4. **Configuração** — tudo por ambiente, tudo com um valor por omissão
 *     honesto: sem serviço configurado, o Studio continua a funcionar.
 */

/** Para que serve o serviço. Texto e imagem são serviços distintos. */
export type AiRole = "TEXTO" | "IMAGEM";

/** Um serviço configurado, tal como o ambiente o descreve. */
export type AiProviderConfig = {
  /** Identificador do serviço. É o que aparece nos registos de proveniência. */
  name: string;
  /** Endpoint HTTP. Vazio significa "sem serviço". */
  endpoint: string;
  /** Chave, quando o serviço exige uma. */
  apiKey: string | null;
  /** Modelo usado para este papel. */
  model: string | null;
};

/** A cadeia completa para um papel. */
export type AiRoleConfig = {
  role: AiRole;
  /** O que se tenta primeiro. */
  primary: AiProviderConfig;
  /** O que se tenta a seguir, se o primeiro falhar. Pode estar vazio. */
  fallback: AiProviderConfig | null;
};

/** Ambiente lido, em forma de mapa. Não é `NodeJS.ProcessEnv` para permitir testes. */
export type AiEnv = Readonly<Record<string, string | undefined>>;

/** Configuração de um papel, derivada de uma chave de ambiente. */
const roleConfig = (env: AiEnv, role: AiRole): AiRoleConfig => {
  const prefix = role === "TEXTO" ? "STUDIO_AI" : "STUDIO_IMAGE";
  const model = env[`${prefix}_MODEL`]?.trim() || null;

  const primary: AiProviderConfig = {
    name: env[`${prefix}_PROVIDER`]?.trim() || (role === "TEXTO" ? "http" : "http"),
    endpoint: env[`${prefix}_ENDPOINT`]?.trim() || env.STUDIO_AI_ENDPOINT?.trim() || "",
    apiKey: env[`${prefix}_API_KEY`]?.trim() || env.STUDIO_AI_API_KEY?.trim() || null,
    model,
  };

  // O fallback é explícito: sem endpoint, é `null`. Um fallback inventado a
  // partir do primário seria o mesmo serviço duas vezes, e dar a impressão de
  // resiliência que não existe é pior que admitir que não há.
  const fallbackEndpoint = env[`${prefix}_FALLBACK_ENDPOINT`]?.trim() || "";
  const fallback: AiProviderConfig | null = fallbackEndpoint
    ? {
        name: env[`${prefix}_FALLBACK_PROVIDER`]?.trim() || "fallback",
        endpoint: fallbackEndpoint,
        apiKey: env[`${prefix}_FALLBACK_API_KEY`]?.trim() || null,
        model: env[`${prefix}_FALLBACK_MODEL`]?.trim() || null,
      }
    : null;

  return { role, primary, fallback };
};

/** A configuração dos dois papéis. */
export function resolveAiConfig(env: AiEnv): { TEXTO: AiRoleConfig; IMAGEM: AiRoleConfig } {
  return { TEXTO: roleConfig(env, "TEXTO"), IMAGEM: roleConfig(env, "IMAGEM") };
}

/**
 * A cadeia a tentar, pela ordem.
 *
 * Devolve só os serviços com endpoint. Uma cadeia com um serviço sem endpoint
 * no meio faria a tentativa falhar por reasons que não são do fornecedor.
 */
export function providerChain(config: AiRoleConfig): AiProviderConfig[] {
  return [config.primary, config.fallback]
    .filter((entry): entry is AiProviderConfig => Boolean(entry && entry.endpoint))
    .map((entry) => ({ ...entry, endpoint: entry.endpoint.trim() }));
}

/** `true` quando há pelo menos um serviço para este papel. */
export function hasProvider(config: AiRoleConfig): boolean {
  return providerChain(config).length > 0;
}

/**
 * Explica, em português, o que está configurado.
 *
 * Existe para a interface poder dizer a verdade ao ADMIN. Uma tela que diz
 * "sem serviço" quando há um, ou que não diz nada quando há, faz com que ele
 * conclua que a funcionalidade está avariada.
 */
export function describeAiConfig(config: AiRoleConfig): string {
  const chain = providerChain(config);
  if (!chain.length) {
    return config.role === "TEXTO"
      ? "Sem modelo de linguagem configurado. As transformações estruturais funcionam na mesma; só a reescrita de texto fica indisponível."
      : "Sem serviço de imagem configurado. As imagens existentes são usadas tal como estão.";
  }
  const names = chain.map((entry) => `${entry.name}${entry.model ? ` (${entry.model})` : ""}`);
  return `${config.role === "TEXTO" ? "Texto" : "Imagem"}: ${names.join(" → ")}.`;
}