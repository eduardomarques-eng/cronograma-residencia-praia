"use client";

import { useState } from "react";
import { sendProposalEmailAction, sendProposalWhatsAppAction } from "@/app/actions/domain-actions";
import { Button } from "@/components/ui/button";

/**
 * FASE 4D — ENVIAR A PROPOSTA (itens 41 e 42).
 *
 * Os dois itens Pedem a mesma coisa com canais diferentes, e por isso vivem no
 * mesmo componente: a diferença entre eles é o serviço que chamam, não a
 * interface. Separá-los duplicaria o tratamento de erro e o indicador de
 * "a enviar", que são a parte difícil.
 *
 * A parte importante do WhatsApp é o que este componente NÃO faz: **não envia
 * nada.** Sem provedor configurado, o serviço devolve um `deepLink` e o
 * componente abre-o. O item 41 é explícito — "implementar somente abertura do
 * WhatsApp com mensagem preparada" e "NÃO criar falsa API de envio". Um botão que
 * dissesse "enviado" sem ter enviado seria a pior coisa possível numa proposta
 * comercial: o ADMIN acreditaria que o cliente recebeu o link.
 *
 * Por isso o texto do botão diz o que acontece: "Preparar para WhatsApp" e
 * "Abrir no WhatsApp", e nunca "Enviar".
 */
export function ProposalSendActions({
  proposalId,
  /** `true` quando a proposta já está aprovada — nada de reabrir o ciclo. */
  encerrada = false,
}: {
  proposalId: string;
  encerrada?: boolean;
}) {
  const [ocupado, setOcupado] = useState<"whatsapp" | "email" | null>(null);
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);

  /**
   * Preparar a mensagem e abrir o WhatsApp.
   *
   * `window.open` com `noopener`: sem isso, a página aberta pelo WhatsApp
   * apontaria para o `window.opener` da aplicação e poderia navegar o editor do
   * ADMIN — uma referência cruzada que nenhuma app quer.
   */
  const prepararWhatsApp = async () => {
    setOcupado("whatsapp");
    try {
      const resultado = await sendProposalWhatsAppAction(proposalId);
      if (!resultado.url) {
        setMensagem({
          tom: "erro",
          texto: "O serviço de WhatsApp está configurado como API, mas não devolvou um link. Verifique o servidor.",
        });
        return;
      }
      window.open(resultado.url, "_blank", "noopener,noreferrer");
      setMensagem({
        tom: "ok",
        // Diz o que aconteceu, e o que falta fazer. Um "enviado" aqui seria uma
        // mentira: o que foi enviado foi o deep link para o telemóvel do ADMIN.
        texto:
          resultado.provider === "wa.me"
            ? "Mensagem preparada. O WhatsApp abre com o texto e o link já preenchidos — envie a partir dele."
            : "Mensagem enviada pelo serviço configurado.",
      });
    } catch (error) {
      setMensagem({ tom: "erro", texto: error instanceof Error ? error.message : "Não foi possível preparar a mensagem." });
    } finally {
      setOcupado(null);
    }
  };

  /**
   * Enviar por e-mail.
   *
   * Este vai mesmo por email: usa o Communication Engine e o template do banco.
   * Se o provider não estiver configurado, o serviço diz-o e a interface mostra
   * — não há "simular envio".
   */
  const enviarEmail = async () => {
    setOcupado("email");
    try {
      const resultado = await sendProposalEmailAction(proposalId);
      setMensagem(
        resultado.sent
          ? { tom: "ok", texto: `Proposta enviada para ${resultado.recipient}.` }
          : {
              tom: "erro",
              // A pendência é dita, não escondida: o item 42 manda registá-la se
              // for necessária, e dizer qual é.
              texto: resultado.configured
                ? `O envio para ${resultado.recipient} falhou: ${resultado.error ?? "erro desconhecido"}`
                : "Não há serviço de e-mail configurado no servidor. A mensagem ficou por enviar.",
            },
      );
    } catch (error) {
      setMensagem({ tom: "erro", texto: error instanceof Error ? error.message : "Não foi possível enviar." });
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="min-h-9 px-3 text-xs"
          onClick={prepararWhatsApp}
          disabled={ocupado !== null || encerrada}
        >
          {ocupado === "whatsapp" ? "A preparar…" : "Preparar para WhatsApp"}
        </Button>
        <Button
          variant="secondary"
          className="min-h-9 px-3 text-xs"
          onClick={enviarEmail}
          disabled={ocupado !== null || encerrada}
        >
          {ocupado === "email" ? "A enviar…" : "Enviar por e-mail"}
        </Button>
      </div>

      {/* O resultado é sempre visível: um botão que falha em silêncio deixa o
          ADMIN a crer que o cliente recebeu a proposta. */}
      {mensagem ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-[11px] leading-4 ${mensagem.tom === "ok" ? "text-emerald-700" : "text-rose-700"}`}
        >
          {mensagem.texto}
        </p>
      ) : null}
    </div>
  );
}