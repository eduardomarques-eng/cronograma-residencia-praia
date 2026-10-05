import { describe, expect, it } from "vitest";
import {
  AUTOSAVE_DEBOUNCE_MS,
  beginSave,
  canSaveManually,
  finishSave,
  INITIAL_AUTOSAVE,
  markDirty,
  shouldSaveNow,
} from "./studio-autosave";

/**
 * FASE 4D — GRAVAÇÃO AUTOMÁTICA (item 49).
 *
 * O item 49 pede três coisas incompatíveis entre si: gravar sozinho, não
 * chamar o backend a cada tecla e não criar condições de corrida. A corrida é a
 * que estes testes tratam primeiro, porque é a ÚNICA das três que perde trabalho
 * em silêncio: uma gravação antiga a terminar depois de uma nova grava por cima
 * o texto que o utilizador acabou de escrever.
 */

describe("estados de gravação (item 49)", () => {
  it("começa parado, sem mensagem", () => {
    // Um editor novo não deve dizer "Gravado": ainda nada foi gravado.
    expect(INITIAL_AUTOSAVE.status).toBe("IDLE");
    expect(INITIAL_AUTOSAVE.message).toBeNull();
  });

  it("uma alteração marca como pendente", () => {
    expect(markDirty(INITIAL_AUTOSAVE).status).toBe("PENDENTE");
  });

  it("não volta um estado NOVO quando já há uma gravação em curso", () => {
    // Marcar sujo durante uma gravação não pode reiniciar o pedido: o texto
    // gravado é o do momento em que começou, e uma alteração nova espera pela
    // ronda seguinte.
    const aGravar = beginSave(INITIAL_AUTOSAVE);
    expect(markDirty(aGravar)).toBe(aGravar);
  });

  it("devolve sempre um estado novo, para o React comparar por identidade", () => {
    expect(markDirty(INITIAL_AUTOSAVE)).not.toBe(INITIAL_AUTOSAVE);
    expect(beginSave(INITIAL_AUTOSAVE)).not.toBe(INITIAL_AUTOSAVE);
  });
});

describe("o ciclo de gravação mostra o que o item pede", () => {
  it("mostra «A gravar…» enquanto pede e «Gravado» no fim", () => {
    const aGravar = beginSave(markDirty(INITIAL_AUTOSAVE));
    expect(aGravar.message).toBe("A gravar…");
    const gravado = finishSave(aGravar, aGravar.sequencia, { ok: true });
    expect(gravado.status).toBe("GRAVADO");
    expect(gravado.message).toBe("Gravado");
  });

  it("mostra «Erro ao gravar» e guarda a mensagem do servidor", () => {
    const aGravar = beginSave(markDirty(INITIAL_AUTOSAVE));
    const erro = finishSave(aGravar, aGravar.sequencia, { ok: false, error: "Ligação perdida" });
    expect(erro.status).toBe("ERRO");
    expect(erro.message).toBe("Erro ao gravar");
    // A mensagem do servidor é o que o ADMIN precisa para resolver.
    expect(erro.error).toBe("Ligação perdida");
  });

  it("incrementa a sequência a cada gravação", () => {
    expect(beginSave(beginSave(INITIAL_AUTOSAVE)).sequencia).toBe(2);
  });
});

describe("condições de corrida (o defeito silencioso)", () => {
  it("DESCARTA o resultado de uma gravação que já não é a última", () => {
    /*
     * Este é o teste que vale mais de todo o ficheiro. Duas gravações em curso; a
     * primeira termina depois da segunda. Aplicar o seu resultado diria
     * "Gravado" para um documento que já mudou — e o texto recente desapareceria
     * ao recarregar a página.
     */
    const primeira = beginSave(beginSave(INITIAL_AUTOSAVE));
    const segunda = beginSave(markDirty(primeira));

    const resultadoTardio = finishSave(segunda, primeira.sequencia, { ok: true });
    // Devolve o estado intacto: nem "Gravado", nem erro, nem sequência mexida.
    expect(resultadoTardio).toBe(segunda);
    expect(resultadoTardio.status).toBe("A_GRAVAR");
  });

  it("aplica o resultado da ÚLTIMA gravação", () => {
    const segunda = beginSave(beginSave(INITIAL_AUTOSAVE));
    expect(finishSave(segunda, segunda.sequencia, { ok: true }).status).toBe("GRAVADO");
  });

  it("um erro antigo não substitui um sucesso mais recente", () => {
    // O inverso também é uma corrida: um erro de uma gravação antiga esconderia
    // que a mais recente foi bem succeedida.
    const primeira = beginSave(beginSave(INITIAL_AUTOSAVE));
    const segunda = beginSave(primeira);
    expect(finishSave(segunda, primeira.sequencia, { ok: false, error: "velho" })).toBe(segunda);
  });
});

describe("debounce: não chamar o backend a cada tecla (item 49)", () => {
  it("espera pelo intervalo antes de gravar", () => {
    const pendente = markDirty(INITIAL_AUTOSAVE);
    const agora = 10_000;
    expect(shouldSaveNow(pendente, agora, agora)).toBe(false);
    expect(shouldSaveNow(pendente, agora + AUTOSAVE_DEBOUNCE_MS, agora)).toBe(true);
  });

  it("grava imediatamente quando nunca foi marcado", () => {
    // Sem timestamp não há espera a avaliar: gravar é melhor do que não gravar.
    expect(shouldSaveNow(markDirty(INITIAL_AUTOSAVE), 0, null)).toBe(true);
  });

  it("NÃO empilha pedidos enquanto uma gravação está em curso", () => {
    /*
     * Sem esta regra, cada tecla durante um pedido lento disparava outro pedido,
     * e o último a chegar seria o primeiro a escrever — o documento regridia
     * exactamente ao contrário do que o utilizador escreveu.
     */
    expect(shouldSaveNow(beginSave(markDirty(INITIAL_AUTOSAVE)), 99_999, 0)).toBe(false);
  });

  it("não grava quando nada mudou", () => {
    expect(shouldSaveNow(INITIAL_AUTOSAVE, 99_999, 0)).toBe(false);
    const gravado = finishSave(beginSave(markDirty(INITIAL_AUTOSAVE)), 1, { ok: true });
    expect(shouldSaveNow(gravado, 99_999, 0)).toBe(false);
  });
});

describe("gravação manual (item 49)", () => {
  it("é sempre possível, exceto durante uma gravação", () => {
    expect(canSaveManually(INITIAL_AUTOSAVE)).toBe(true);
    expect(canSaveManually(markDirty(INITIAL_AUTOSAVE))).toBe(true);
    // Durante uma gravação, um clique faria o backend receber o mesmo documento
    // duas vezes sem nada ter mudado.
    expect(canSaveManually(beginSave(INITIAL_AUTOSAVE))).toBe(false);
  });

  it("recupera a possibilidade depois de um erro", () => {
    // Um erro não pode deixar o ADMIN sem forma de tentar de novo.
    const erro = finishSave(beginSave(markDirty(INITIAL_AUTOSAVE)), 1, { ok: false, error: "offline" });
    expect(canSaveManually(erro)).toBe(true);
    expect(shouldSaveNow(markDirty(erro), 10_000, 10_000)).toBe(false);
  });
});