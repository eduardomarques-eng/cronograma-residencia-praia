/**
 * FASE 4D — GUARDA DE GRAVAÇÃO AUTOMÁTICA (item 49).
 *
 * O item 49 pede três coisas que entram em conflito entre si: gravar sozinho,
 * não chamar o backend a cada tecla, e não criar condições de corrida. A
 * solução é uma MÁQUINA DE ESTADOS pura, e não um `setTimeout` espalhado pelo
 * componente.
 *
 * A máquina é testável sem React e sem temporizadores, e é isso que permite
 * fixar o caso que de facto causa perda de trabalho: duas gravações que
 * terminam fora de ordem. Quando uma acaba depois de outra, gravar a antiga
 * por cima da nova faria o documento REGREDIR — o utilizador escreveria, veria
 * "Salvo", e ao recarregar a página encontraria texto anterior. Por isso cada
 * gravação leva um número de sequência e o resultado é descartado se não for o
 * último pedido.
 *
 * Todo o resto segue da mesma regra: o texto que se grava é sempre o do ÚLTIMO
 * estado conhecido, nunca uma cópia capturada no momento de agendar o temporizador.
 */

export type SaveStatus = "IDLE" | "PENDENTE" | "A_GRAVAR" | "GRAVADO" | "ERRO";

/**
 * A máquina de autosave.
 *
 * `grava` recebe o deck em tempo de execução, não um instantâneo captured
 * quando o temporizador foi armado. É a diferença entre "grava o que o utilizador
 * escreveu" e "grava o que ele escrevia há dois segundos" — e a segunda é uma
 * fonte silenciosa de texto perdido.
 */
export type AutosaveState = {
  status: SaveStatus;
  /** Texto a mostrar ao utilizador. `null` quando não há nada a dizer. */
  message: string | null;
  /** Número da última gravação iniciada. Incrementa a cada pedido. */
  sequencia: number;
  /** Erro da última tentativa, para o editor o mostrar e permitir retentativa. */
  error: string | null;
};

export const INITIAL_AUTOSAVE: AutosaveState = {
  status: "IDLE",
  message: null,
  sequencia: 0,
  error: null,
};

/** Intervalo entre a última alteração e o pedido ao servidor. */
export const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * Regista uma alteração: marca como pendente.
 *
 * Devolve sempre um estado NOVO — é o que permite ao React comparar por
 * identidade e evita um ciclo de re-render quando o conteúdo não mudou.
 */
export function markDirty(state: AutosaveState): AutosaveState {
  if (state.status === "A_GRAVAR") return state; // Já há uma em curso.
  return { ...state, status: "PENDENTE", message: null };
}

/**
 * Começa uma gravação.
 *
 * A sequência é incrementada AQUI, e não no sucesso. É isso que identifica qual
 * pedido é o mais recente mesmo quando os dois estão em curso ao mesmo tempo.
 */
export function beginSave(state: AutosaveState): AutosaveState {
  return {
    ...state,
    status: "A_GRAVAR",
    message: "A gravar…",
    sequencia: state.sequencia + 1,
    error: null,
  };
}

/**
 * O resultado desta gravação chegou — e é o último pedido?
 *
 * `false` significa que outra gravação começou depois desta. É aqui que a corrida
 * é cortada: um resultado antigo é DESCARTADO, não aplicado. Sem isto, o editor
 * mostraria "Gravado" para um documento que já tinha mudado duas vezes.
 */
export function finishSave(state: AutosaveState, sequencia: number, resultado: { ok: true } | { ok: false; error: string }): AutosaveState {
  if (sequencia !== state.sequencia) return state; // Resultado obsoleto.
  return resultado.ok
    ? { ...state, status: "GRAVADO", message: "Gravado", error: null }
    : { ...state, status: "ERRO", message: "Erro ao gravar", error: resultado.error };
}

/**
 * Deve gravar agora?
 *
 * `true` quando há alterações por gravar e nada em curso. O `false` durante uma
 * gravação é o que impede chamadas empilhadas: sem ele, cada tecla durante um
 * pedido lento dispararia outro pedido, e o último a chegar seria o primeiro a
 * escrever.
 */
export function shouldSaveNow(state: AutosaveState, agora: number, ultimaMarcacao: number | null): boolean {
  if (state.status === "A_GRAVAR") return false;
  if (state.status !== "PENDENTE") return false;
  if (ultimaMarcacao === null) return true;
  return agora - ultimaMarcacao >= AUTOSAVE_DEBOUNCE_MS;
}

/** Deve pedir ao utilizador para gravar manualmente? */
export function canSaveManually(state: AutosaveState): boolean {
  // Nunca durante uma gravação: o clique faria o backend receber o mesmo
  // documento duas vezes sem que nada tenha mudado.
  return state.status !== "A_GRAVAR";
}