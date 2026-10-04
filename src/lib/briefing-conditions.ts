/**
 * Condições declaradas: avaliadas por DADOS, nunca por `if` espalhado.
 *
 * A auditoria encontrou a alternativa — o `guided-briefing` antigo simplesmente
 * mostrava todas as perguntas. Com condicionais hardcoded por id, acrescentar
 * uma pergunta "mostra se o cliente tem crianças" obrigaria a editar código em
 * dois sítios e a lembrar-se de atualizar as condições. Aqui a pergunta declara
 * o que precisa; esta função é o único sítio que sabe avaliá-lo.
 */
import type { BriefingCondition } from "./briefing-schema";
import { hasAnswer } from "./briefing-answers";

type ConditionContext = (questionId: string) => unknown;

/** `equals` de um booleano: o valor guardado é `true`/`false`, não a string. */
function asText(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function includesValue(value: unknown, expected: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => asText(item) === expected);
  }
  if (typeof value === "object" && value) {
    // Um grupo repetível responde com uma lista de registos; comparamos pelo
    // rótulo de cada item, que é o que o cliente reconhece.
    const items = Object.values(value as Record<string, unknown>);
    if (items.length) return items.some((item) => asText((item as Record<string, unknown>)?.label) === expected);
  }
  return false;
}

/** Uma única condição. */
export function meetsCondition(condition: BriefingCondition, context: ConditionContext): boolean {
  const value = context(condition.questionId);
  switch (condition.kind) {
    case "answered":
      return hasAnswer(value);
    case "notAnswered":
      return !hasAnswer(value);
    case "equals":
      return asText(value) === condition.value;
    case "includes":
      return includesValue(value, condition.value);
    case "hasEnvironmentNamed": {
      if (!Array.isArray(value)) return false;
      return value.some((item) => {
        const name = (item as { name?: unknown })?.name;
        return asText(name).toLocaleLowerCase("pt-BR").includes(condition.value.toLocaleLowerCase("pt-BR"));
      });
    }
    default:
      // Uma condição desconhecida NÃO esconde a pergunta. Falhar para o lado
      // que mostra é o comportamento seguro: o cliente vê mais, nunca menos.
      return true;
  }
}

/** Todas as condições têm de ser verdadeiras (lógica E). */
export function meetsAll(conditions: readonly BriefingCondition[] | undefined, context: ConditionContext): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) => meetsCondition(condition, context));
}