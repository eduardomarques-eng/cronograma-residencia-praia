"use client";

import { useState, useTransition } from "react";
import { saveClientAction } from "@/app/actions/domain-actions";

const FIELD = "min-h-10 w-full rounded-xl border border-slate-200 px-3 text-sm";

/**
 * Criação de cliente pelo estúdio.
 *
 * A acção `saveClientAction` já existia mas nunca foi ligada a nenhuma
 * interface — o botão "Novo cliente" estava lá sem nada atrás. A autorização é
 * feita dentro da acção (`requireRole("ADMIN")`), não neste ficheiro: o
 * formulário nunca é a prova de que quem clica é administrador.
 */
export function ClientForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [erro, setErro] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMessage("");
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Novo cliente
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        setErro(false);
        startTransition(async () => {
          try {
            await saveClientAction({
              name: String(formData.get("name") ?? "").trim(),
              fullName: String(formData.get("fullName") ?? "").trim() || null,
              email: String(formData.get("email") ?? "").trim() || null,
              phone: String(formData.get("phone") ?? "").trim() || null,
              document: String(formData.get("document") ?? "").trim() || null,
              notes: String(formData.get("notes") ?? "").trim() || null,
            });
            setMessage("Cliente criado.");
            setOpen(false);
          } catch (error) {
            setErro(true);
            setMessage(error instanceof Error ? error.message : "Não foi possível criar o cliente.");
          }
        });
      }}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Novo cliente</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-slate-500">
          Cancelar
        </button>
      </div>

      <div>
        <label htmlFor="cliente-nome" className="mb-1 block text-xs font-medium text-slate-600">
          Nome
        </label>
        <input id="cliente-nome" name="name" required placeholder="Como o cliente é identificado" className={FIELD} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cliente-nome-completo" className="mb-1 block text-xs font-medium text-slate-600">
            Nome completo
          </label>
          <input id="cliente-nome-completo" name="fullName" placeholder="Opcional" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-documento" className="mb-1 block text-xs font-medium text-slate-600">
            Documento
          </label>
          <input id="cliente-documento" name="document" placeholder="Opcional" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-email" className="mb-1 block text-xs font-medium text-slate-600">
            E-mail
          </label>
          <input id="cliente-email" name="email" type="email" placeholder="Opcional" className={FIELD} />
        </div>
        <div>
          <label htmlFor="cliente-telefone" className="mb-1 block text-xs font-medium text-slate-600">
            Telefone
          </label>
          <input id="cliente-telefone" name="phone" placeholder="Opcional" className={FIELD} />
        </div>
      </div>

      <div>
        <label htmlFor="cliente-notas" className="mb-1 block text-xs font-medium text-slate-600">
          Notas
        </label>
        <textarea id="cliente-notas" name="notes" placeholder="Opcional" className={`${FIELD} py-2`} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Criando…" : "Criar cliente"}
        </button>
        {message ? <span className={`text-xs ${erro ? "text-rose-600" : "text-emerald-700"}`}>{message}</span> : null}
      </div>
    </form>
  );
}