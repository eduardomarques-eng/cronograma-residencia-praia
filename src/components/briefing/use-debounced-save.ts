"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ANSWER_SOURCE, type StoredAnswers } from "@/lib/briefing-answers";

/**
 * Autosave com atraso.
 *
 * O `GuidedBriefing` anterior gravava a CADA TECLA: uma resposta de três
 * parágrafos gerava centenas de pedidos, e a base passou o dia a responder a
 * writes do mesmo texto. Aqui o conteúdo continua visível imediatamente e só o
 * GUARDO é atrasado.
 *
 * Dois cuidados que um simples `setTimeout` não resolve:
 *   · o que está a ser escrito não pode perder-se se o componente mudar de
 *     etapa ou a página fechar — daí o `useEffect` de limpeza gravar o que
 *     sobrou;
 *   · um erro de rede não pode apagar o que o cliente escreveu — o texto fica
 *     no estado e o aviso é de "não foi possível guardar", não de "perdido".
 */
/** Estado do autosave, tal como a interface o mostra ao cliente. */
export type SaveState = "inactivo" | "a_gravar" | "guardado" | "falhou";

export function useDebouncedSave(save: (answers: StoredAnswers) => Promise<boolean>) {
  const [estado, setEstado] = useState<SaveState>("inactivo");
  const pendente = useRef<StoredAnswers | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aGravar = useRef(false);

  const flush = useCallback(async () => {
    if (!pendente.current || aGravar.current) return;
    const paraGravar = pendente.current;
    pendente.current = null;
    aGravar.current = true;
    setEstado("a_gravar");
    const ok = await save(paraGravar);
    aGravar.current = false;
    setEstado(ok ? "guardado" : "falhou");
    // Se chegou nova escrita enquanto guardávamos, vai numa segunda volta.
    if (pendente.current) void flush();
  }, [save]);

  const agendar = useCallback(
    (answers: StoredAnswers) => {
      pendente.current = answers;
      setEstado("a_gravar");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 900);
    },
    [flush],
  );

  // Sair da página não pode deixar a última escrita por enviar.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (pendente.current) void flush();
    };
  }, [flush]);

  return { agendar, estado, gravarAgora: flush };
}

/** Envelope uma resposta para guardar. `CLIENT` é a origem por omissão. */
export function resposta(value: unknown): StoredAnswers[string] {
  return { value, source: ANSWER_SOURCE.CLIENT, updatedAt: new Date().toISOString() };
}