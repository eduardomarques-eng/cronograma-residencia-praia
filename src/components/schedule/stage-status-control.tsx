"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveStageStatusAction } from "@/app/actions/domain-actions";
import type { ScheduleStatus } from "@/lib/schedule";

/**
 * Mudança de estado de uma etapa.
 *
 * A interface só oferece as transições que o SERVIDOR aceita (`allowedTransitions`
 * vem do serviço). Não reimplementa a regra: se o backend recusar — por exemplo
 * uma etapa bloqueada por dependência pendente — a mensagem do servidor é
 * mostrada tal como came, sem a interface inventar outra explicação.
 */
export function StageStatusControl({
  stageId,
  stageName,
  current,
  allowed,
}: {
  stageId: string;
  stageName: string;
  current: ScheduleStatus;
  allowed: readonly ScheduleStatus[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function move(status: ScheduleStatus) {
    setError(null);
    // "Não iniciada" é reversível sem confirmação; desfazer trabalho é mais caro
    // de recuperar do que confirmar.
    if (status === "NOT_STARTED" && !confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const result = await moveStageStatusAction(stageId, status);
      setConfirming(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (allowed.length === 0) {
    return <p className="text-xs text-slate-400">Sem transições disponíveis.</p>;
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap gap-1.5">
        {allowed.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() => move(status)}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "COMPLETED"
              ? "Concluir"
              : status === "IN_PROGRESS"
                ? "Em andamento"
                : "Reiniciar"}
          </button>
        ))}
      </div>
      {confirming ? (
        <p className="mt-2 text-xs text-amber-700">
          Reiniciar “{stageName}” volta a etapa a 0%. Clique de novo para confirmar.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
      {pending ? <p className="mt-2 text-xs text-slate-400">A guardar…</p> : null}
    </div>
  );
}