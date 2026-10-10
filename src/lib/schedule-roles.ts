/**
 * REGRA DE QUEM OPERA O CRONOGRAMA — domínio puro, sem I/O.
 *
 * Fica aqui, e não dentro de `auth.ts`, para ser testável sem sessão, cookie ou
 * banco. `auth.ts` consome esta função; os testes provam a regra. Duas verdades
 * para "quem pode mexer no cronograma" seria uma regressão.
 *
 * `ADMIN` (dono) opera tudo. `OPERADOR` (funcionário da equipa) opera apenas os
 * projetos que lhe foram atribuídos — essa parte de projeto é filtrada no banco
 * (`ProjectAccess`), não aqui. Aqui responde-se só: este PAPEL pode operar?
 */

export type ScheduleRole = "ADMIN" | "OPERADOR" | "CLIENT";

const SCHEDULE_OPERATORS: readonly ScheduleRole[] = ["ADMIN", "OPERADOR"];

/** true se o papel pode operar o cronograma (mover/editar etapas). */
export function canOperateSchedule(role: string): role is "ADMIN" | "OPERADOR" {
  return (SCHEDULE_OPERATORS as readonly string[]).includes(role);
}

/** true se o papel é exclusivamente o funcionário da equipa (acesso restrito). */
export function isOperador(role: string): role is "OPERADOR" {
  return role === "OPERADOR";
}
