"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) setError((await response.json().catch(() => ({}))).error ?? "Não foi possível processar o pedido.");
      else setSent(true);
    } catch {
      setError("Não foi possível processar o pedido. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-6">
      <Brand decorative className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[7] opacity-[0.045] select-none sm:scale-[9]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-7 shadow-sm backdrop-blur">
        <Brand />

        <h1 className="mt-8 text-2xl font-bold text-slate-950">Recuperar senha</h1>

        {sent ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Se existir uma conta com este e-mail, enviámos as instruções para redefinir a senha. Verifique também a pasta de spam.
            </p>
            <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700">
              Voltar ao início de sessão
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-500">Indique o e-mail da sua conta e enviamos um link para criar uma nova senha.</p>

            <form onSubmit={submit} className="mt-6">
              <label className="block text-sm font-semibold text-slate-700">
                E-mail
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500"
                />
              </label>

              {error ? <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p> : null}

              <Button type="submit" disabled={pending} className="mt-6 w-full">{pending ? "Enviando…" : "Enviar link"}</Button>
            </form>

            <Link href="/login" className="mt-5 block text-center text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700">
              Voltar ao início de sessão
            </Link>
          </>
        )}
      </div>
    </main>
  );
}