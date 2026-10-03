"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideProposalTokenAction } from "@/app/actions/domain-actions";
import { Button } from "@/components/ui/button";

export function ProposalDecision({ token, disabled }: { token: string; disabled?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [decided, setDecided] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setState("saving");
    try {
      await decideProposalTokenAction(token, decision);
      setDecided(decision);
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  function confirmAndDecide(decision: "APPROVED" | "REJECTED") {
    const question =
      decision === "APPROVED"
        ? "Confirmar a aprovação desta proposta?\n\nAo aprovar, a versão apresentada fica congelada e passa a orientar o contrato."
        : "Confirmar a recusa desta proposta?\n\nO estúdio será notificado e poderá revisar o escopo.";
    if (!window.confirm(question)) return;
    void decide(decision);
  }

  if (state === "done") {
    return (
      <div className="rounded-xl bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-800">Sua decisão foi registrada.</p>
        <p className="mt-1 text-xs leading-5 text-emerald-700">
          {decided === "APPROVED"
            ? "A versão aprovada foi congelada e passa a orientar o contrato."
            : "O estúdio foi notificado e poderá revisar o escopo proposto."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => confirmAndDecide("APPROVED")} disabled={disabled || state === "saving"}>
          APROVAR PROPOSTA
        </Button>
        <Button variant="secondary" onClick={() => confirmAndDecide("REJECTED")} disabled={disabled || state === "saving"}>
          RECUSAR PROPOSTA
        </Button>
      </div>
      {state === "saving" ? <p className="text-sm text-slate-500">Registrando sua decisão…</p> : null}
      {disabled ? (
        <p className="text-sm text-slate-500">Esta proposta já teve uma decisão registrada e não aceita novas alterações.</p>
      ) : null}
      {state === "error" ? <p className="text-sm text-rose-700">Não foi possível registrar a decisão. Tente novamente.</p> : null}
    </div>
  );
}
