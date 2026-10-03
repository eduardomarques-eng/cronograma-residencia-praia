"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { advanceSignatureAction, requestContractSignatureAction } from "@/app/actions/domain-actions";
import { Button } from "@/components/ui/button";
import { SIGNATURE_STATUS, SIGNATURE_STATUS_LABELS, type SignatureStatusName } from "@/lib/signature";

export function SignatureActions({
  contractId,
  status,
  provider,
}: {
  contractId: string;
  status: SignatureStatusName | null;
  provider?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  }

  const requested = Boolean(status);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => run(() => requestContractSignatureAction(contractId))}
          disabled={busy || requested}
        >
          ENVIAR PARA ASSINATURA
        </Button>
        <Button
          variant="secondary"
          onClick={() => run(() => advanceSignatureAction(contractId, SIGNATURE_STATUS.VIEWED))}
          disabled={busy || status !== SIGNATURE_STATUS.SENT}
        >
          MARCAR VISUALIZADO
        </Button>
        <Button
          variant="secondary"
          onClick={() => run(() => advanceSignatureAction(contractId, SIGNATURE_STATUS.SIGNED))}
          disabled={busy || (status !== SIGNATURE_STATUS.SENT && status !== SIGNATURE_STATUS.VIEWED)}
        >
          MARCAR ASSINADO
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Assinatura: {status ? SIGNATURE_STATUS_LABELS[status] : "não solicitada"}
        {provider ? ` · provedor ${provider}` : ""}
      </p>
      {requested ? (
        <p className="text-xs leading-5 text-slate-400">
          O status só avança com o retorno do provedor configurado. O sistema não declara assinatura jurídica sem
          comprovação do fornecedor.
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}