import type { ProposalItem } from "./proposal-item";
import { readPaymentPlanSnapshot } from "./payment-plan";

/**
 * FASE 4C — GUARDA DE PUBLICAÇÃO (item 64).
 *
 * Publicar uma proposta é irreversível do ponto de vista do cliente: ele recebe
 * um link, lê e aprova. Por isso o envio tem uma porta explícita, e esta porta é
 * uma FUNÇÃO PURA: recebe o estado da proposta e devolve o que falta.
 *
 * Ser pura tem duas consequências que importam:
 *
 *  · o servidor, o editor e o teste chamam a MESMA função, portanto não há
 *    "o editor achava que estava tudo certo" enquanto o servidor discorda;
 *  · é testável sem banco, sem sessão e sem rede.
 *
 * A regra de desenho é: `BLOCKER` impede o envio; `WARNING` não impede, mas diz
 * ao ADMIN o que ele deve saber antes de clicar. Nunca decidimos por ele o que é
 * opcional de saber.
 */

export type ReadinessLevel = "BLOCKER" | "WARNING";

export type ReadinessIssue = {
  level: ReadinessLevel;
  /** Código estável, para testes e para o ADMIN reportar o problema exacto. */
  code: string;
  message: string;
};

export type PublicationReadiness = {
  ready: boolean;
  issues: ReadinessIssue[];
};

export type ReadinessInput = {
  /** Cliente e projeto resolvidos no servidor. `null` = relação quebrada. */
  client: { id: string; name: string; fullName?: string | null } | null;
  project: { id: string; name: string } | null;
  title: string;
  items: ReadonlyArray<ProposalItem>;
  total: number;
  /** Validade configurada, em dias. `0`/ausente = sem validade. */
  validityDays: number | null;
  /** Instante de expiração já calculado, se existir. */
  expiresAt: Date | null;
  /** Plano de pagamento CONGELADO na versão (Json persistido). */
  frozenPaymentPlan: unknown;
  /** O template de envio existe e está activo? */
  messageTemplateReady: boolean;
  /** Já está expirada no momento da verificação? */
  now: Date;
};

/** Validade mínima útil: abaixo disto a proposta expira antes de ser lida. */
const MIN_VALIDITY_DAYS = 1;

export function evaluatePublicationReadiness(input: ReadinessInput): PublicationReadiness {
  const issues: ReadinessIssue[] = [];
  const add = (level: ReadinessLevel, code: string, message: string) => issues.push({ level, code, message });
/* Identidade — item 64: cliente e projeto têm de existir. */
  if (!input.client) add("BLOCKER", "CLIENTE_AUSENTE", "A proposta não tem cliente associado.");
  else if (!input.client.name.trim()) add("BLOCKER", "CLIENTE_SEM_NOME", "O cliente desta proposta não tem nome.");

  if (!input.project) add("BLOCKER", "PROJETO_AUSENTE", "A proposta não tem projeto associado.");

  if (!input.title.trim()) add("BLOCKER", "TITULO_AUSENTE", "A proposta precisa de um título para o cliente.");

  /* Escopo — item 64: nenhum serviço. */
  if (input.items.length === 0) {
    add("BLOCKER", "SEM_SERVICOS", "Seleccione ao menos um serviço antes de enviar a proposta.");
  } else {
    const obrigatorias = input.items.filter((item) => !item.optional);
    if (obrigatorias.length === 0) {
      add("BLOCKER", "SEM_SERVICO_CONTRATADO", "Há linhas, mas todas são opcionais. O cliente não teria nada a contratar.");
    }
    const invalidas = input.items.filter((item) => !Number.isFinite(item.subtotal) || item.subtotal < 0);
    if (invalidas.length > 0) {
      add("BLOCKER", "VALOR_INVALIDO", `Linha com valor inválido: ${invalidas.map((item) => item.name).join(", ")}.`);
    }
  }

  /* Valores — item 64. */
  if (input.items.length > 0 && input.total <= 0) {
    add("BLOCKER", "TOTAL_ZERO", "O valor total da proposta é zero. Defina os preços antes de enviar.");
  }

  /* Pagamento — item 31: soma das parcelas tem de ser igual ao total. */
  const plan = readPaymentPlanSnapshot(input.frozenPaymentPlan);
  if (!plan) {
    add("BLOCKER", "PLANO_INVALIDO", "A proposta não tem um plano de pagamento válido. Configure as parcelas antes de enviar.");
  } else if (plan.installments.length === 0) {
    add("BLOCKER", "PLANO_VAZIO", "Configure ao menos uma parcela de pagamento antes de enviar.");
  } else {
    const soma = plan.installments.reduce((sum, installment) => sum + installment.amount, 0);
    if (Math.abs(soma - input.total) > 0.01) {
      add(
        "BLOCKER",
        "PLANO_DIVERGENTE",
        `As parcelas somam ${soma.toFixed(2)} e o total é ${input.total.toFixed(2)}. Corrija antes de enviar.`,
      );
    }
    const percentSum = plan.installments.reduce((sum, installment) => sum + installment.percent, 0);
    if (Math.abs(percentSum - 100) > 0.01) {
      add("BLOCKER", "PLANO_PERCENTUAL", `Os percentuais somam ${percentSum.toFixed(2)}%. A soma tem de ser 100%.`);
    }
  }

  /* Validade — itens 34 e 64. */
  if (input.expiresAt && input.expiresAt.getTime() <= input.now.getTime()) {
    add("BLOCKER", "JA_EXPIRADA", "Esta proposta já expirou. Actualize a validade antes de enviar.");
  }
  if (!input.expiresAt) {
    add("BLOCKER", "VALIDIDADE_AUSENTE", "Defina a data de validade da proposta antes de enviar.");
  } else if (input.validityDays !== null && input.validityDays < MIN_VALIDITY_DAYS) {
    add("BLOCKER", "VALIDIDADE_INVALIDA", `A validade precisa ser de pelo menos ${MIN_VALIDITY_DAYS} dia.`);
  }

  /* Templates — item 64. */
  if (!input.messageTemplateReady) {
    add("BLOCKER", "TEMPLATE_AUSENTE", "O template de envio da proposta não está configurado. Crie-o em Mensagens.");
  }

  /* Avisos que não impedem, mas que o ADMIN deve saber. */
  const opcionais = input.items.filter((item) => item.optional);
  if (opcionais.length > 0) {
    add(
      "WARNING",
      "OPCIONAIS_PRESENTES",
      `${opcionais.length} serviço(s) opcional(ais) NÃO entram no valor total. Confirme que é isso que pretende.`,
    );
  }
  if (input.items.some((item) => item.priceOverridden)) {
    add("WARNING", "PRECO_AJUSTADO", "Há linhas com preço ajustado manualmente, diferente do catálogo.");
  }

  return { ready: !issues.some((issue) => issue.level === "BLOCKER"), issues };
}

/** Atalho: só os problemas que impedem o envio. */
export function blockingIssues(readiness: PublicationReadiness): ReadinessIssue[] {
  return readiness.issues.filter((issue) => issue.level === "BLOCKER");
}

/** Atalho: os avisos, para mostrar sem bloquear. */
export function readinessWarnings(readiness: PublicationReadiness): ReadinessIssue[] {
  return readiness.issues.filter((issue) => issue.level === "WARNING");
}