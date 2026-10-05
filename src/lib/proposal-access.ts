/**
 * Tópico 35 — regras de acesso ao link público da proposta.
 *
 * Funções puras: determinísticas e testáveis sem banco. O serviço de propostas
 * consulta estas regras; elas nunca aceitam um identificador vindo do frontend
 * como prova de autorização.
 */

import { checkRateLimit } from "./rate-limit";

/**
 * Token emitido por `createProposalToken`: 32 bytes em base64url → 43
 * caracteres.
 *
 * O limite superior não é decorativo. Sem ele, um pedido com um token de
 * vários megabytes seria aceite pelo formato e depois seria hasheado — trabalho
 * de CPU atacante, gratuito para ele. Aceitar apenas o formato emitido mantém o
 * custo constante.
 */
export const PROPOSAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,128}$/;

export function isWellFormedProposalToken(token: unknown): token is string {
  return typeof token === "string" && PROPOSAL_TOKEN_PATTERN.test(token);
}

/**
 * Origem do visitante. Usa `x-forwarded-for` (o proxy confiável sobrescreve) e
 * cai para "local" apenas em desenvolvimento, onde não existe proxy.
 */
export function resolveClientKey(
  headers: Pick<Headers, "get">,
  fallback = "local",
): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const key = forwarded || realIp;
  if (!key) return fallback;
  // Chave usada em memória como chave de bucket: limitamos o tamanho para não
  // permitir inflam artificialmente o mapa de rate limit.
  return key.slice(0, 64);
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/** Taxas aplicadas ao link público, separadas por operação. */
export const PROPOSAL_RATE_LIMITS = {
  /** Abrir a proposta: navegação normal de um consumidor em muitos equipamentos. */
  view: { limit: 30, windowMs: 60_000 },
  /** Aprovar/recusar: ação rara e crítica, por isso bem mais apertada. */
  decide: { limit: 8, windowMs: 10 * 60_000 },
} as const;

export type ProposalRateLimitOperation = keyof typeof PROPOSAL_RATE_LIMITS;

/**
 * Aplica o limite e falha com `RateLimitError` quando excedido.
 *
 * Tópico 35: o limite nunca é opcional. Anteriormente `clientKey` podia ser
 * omitido e a aprovação passava sem nenhuma restrição; agora a origem é
 * obrigatória para todas as operações públicas.
 */
export function enforceProposalRateLimit(
  operation: ProposalRateLimitOperation,
  clientKey: string,
): void {
  const options = PROPOSAL_RATE_LIMITS[operation];
  const result = checkRateLimit(`proposal:${operation}:${clientKey}`, options);
  if (!result.ok) {
    throw new RateLimitError(
      "Muitas tentativas. Aguarde um instante e tente novamente.",
      result.retryAfterSeconds,
    );
  }
}

/**
 * Tópico 34 — a aprovação aponta para a versão exata apresentada ao cliente.
 * Uma proposta aprovada não pode voltar a ser alterada sem nova versão.
 *
 * FASE 4C: `EXPIRED` NÃO entra na lista de congelados. Expiração é uma condição
 * do TEMPO, não uma decisão do ADMIN: o que decide é `expiresAt`, e essa data é
 * reavaliável. Uma proposta expirada pode ser reemitida com nova validade, e
 * tratá-la como congelada impediria o ADMIN de corrigir o que é apenas um prazo
 * vencido. O bloqueio de edição continua em `canEditProposal`, e a
 * impossibilidade de DECIDIR sobre uma proposta expirada está em
 * `canDecideProposalNow`.
 */
export function canEditProposal(status: string): boolean {
  return status !== "APPROVED" && status !== "CONVERTED" && status !== "CANCELLED";
}

/**
 * Um link só pode ser emitido para uma proposta em ciclo comercial ativo.
 *
 * `EXPIRED` continua aqui. Há uma distinção que vale a pena manter explícita,
 * porque misturá-la é um erro fácil:
 *
 *  · **`EXPIRED` (o estado)** é uma DECISÃO do ADMIN. Quando alguém marca a
 *    proposta como expirada, está a dizer "esta não volta". Emitir link
 *    apesar disso ignoraria essa decisão.
 *  · **`expiresAt` (a data)** é uma condição do TEMPO e é tratada separada, em
 *    `isProposalExpired`. Uma proposta cuja data passou pode ser reemitida com
 *    nova validade — é uma operação normal e não reabre nada que tenha sido
 *    encerrado por decisão.
 *
 * A data é verificada pelo servidor no momento de emitir e de decidir; o estado,
 * por esta função.
 */
export function canIssueProposalLink(status: string): boolean {
  return !["CANCELLED", "EXPIRED", "APPROVED", "CONVERTED"].includes(status);
}

/**
 * Uma decisão do cliente só faz sentido sobre uma proposta efetivamente
 * enviada. Aprovar um rascunho nunca foi uma operação válida.
 *
 * FASE 4C: `NEGOTIATING` entrou na lista. O cliente pediu alteração, o link
 * continua válido e ele ainda pode aprovar ou recusar — é o que distingue
 * negociação de encerramento.
 */
export function canDecideProposal(status: string): boolean {
  return ["SENT", "VIEWED", "GENERATED", "READY", "NEGOTIATING"].includes(status);
}

/**
 * FASE 4C, item 34 — a validade é IMPEDITIVA, não informativa.
 *
 * Uma proposta expirada NÃO pode ser aprovada. Publicá-la continua a ser
 * possível (reemitir com nova validade é uma operação normal), mas decidir sobre
 * ela significaria o cliente aceitar um documento que já não vale.
 *
 * A função é pura e recebe `now` para que o teste simule o dia da expiração sem
 * esperar por ele.
 */
export function isProposalExpired(input: { expiresAt: Date | null; now: Date }): boolean {
  if (!input.expiresAt) return false;
  return input.expiresAt.getTime() <= input.now.getTime();
}

/** Decisão do cliente permitida: estado válido E dentro da validade. */
export function canDecideProposalNow(input: { status: string; expiresAt: Date | null; now: Date }): boolean {
  return canDecideProposal(input.status) && !isProposalExpired(input);
}

/**
 * FASE 4C, item 49 — a negociação NUNCA edita a versão enviada.
 *
 * Se a proposta já foi enviada e o cliente pediu alteração, a resposta é uma NOVA
 * versão. Estas funções dizem ao serviço o que fazer quando isso acontece: o
 * estado passa a `NEGOTIATING` e os links anteriores são revogados, porque o
 * link antigo apontaria para um documento que o cliente já não vai aprovar.
 */
export function nextStatusAfterNewVersion(current: string): "DRAFT" | "NEGOTIATING" {
  return ["SENT", "VIEWED", "GENERATED", "READY", "NEGOTIATING"].includes(current) ? "NEGOTIATING" : "DRAFT";
}

/** Uma proposta já publicada precisa de link novo para a nova versão chegar. */
export function needsRepublishAfterNewVersion(current: string): boolean {
  return ["SENT", "VIEWED", "GENERATED", "READY", "NEGOTIATING"].includes(current);
}
