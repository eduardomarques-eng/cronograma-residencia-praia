"use client";

import { useMemo } from "react";
import { whatsappContactUrl, whatsappShareUrl } from "@/lib/whatsapp-links";

/**
 * FASE 4E — PARTILHA E CANAL PRINCIPAL (item 51).
 *
 * O item 51 diz que o WhatsApp deve funcionar "naturalmente" como principal
 * canal. Isto é o que "naturalmente" significa numa proposta partilhada por
 * link: o cliente não precisa de voltar ao e-mail, copiar o endereço e colá-lo
 * numa conversa. Um botão resolve isso em dois toques, e o texto já vai
 * preenchido.
 *
 * Duas acções distintas, porque são duas intenções diferentes:
 *
 *  · **Partilhar** — o cliente envia a proposta a outra pessoa (o parceiro, o
 *    arquitecto, o familiar que decide). O texto vai com o link.
 *  · **Falar com a equipa** — o cliente tem uma dúvida e quer perguntar. Não leva
 *    link nenhum: só a mensagem. Pôr o link aqui seria supor que a dúvida é
 *    sobre o documento.
 *
 * O botão de "falar" só aparece quando o estúdio deixou um número de contacto.
 * Inventar um número de telefone seria pior que não ter botão nenhum.
 */

export function ProposalShareActions({
  title,
  /** O token já está na barra de endereço do cliente — é o que ele tem. */
  token,
  studioPhone,
}: {
  title: string;
  token: string;
  /** Telefone da equipa, se existir. Sem ele, não há botão de contacto. */
  studioPhone?: string | null;
}) {
  // O link só pode ser montado no browser: no servidor não há barra de
  // endereços, e um link relativo seria inútil num telemóvel.
  const url = useMemo(() => (typeof window === "undefined" ? "" : window.location.href), [token]);
  const shareText = `${title}\n${url}`;

  const partilhar = () => {
    window.open(whatsappShareUrl(shareText), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={partilhar}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1EBE5A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
        >
          Partilhar no WhatsApp
        </button>

        {studioPhone ? (
          <a
            href={whatsappContactUrl(studioPhone, `Olá, tenho uma dúvida sobre a proposta «${title}».`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Falar com a equipa
          </a>
        ) : null}
      </div>
      <p className="text-xs leading-5 text-slate-500">
        {studioPhone
          ? "O WhatsApp abre com a mensagem preparada — nada é enviado sem que o confirme."
          : "O WhatsApp abre com a mensagem e o link já preenchidos."}
      </p>
    </div>
  );
}