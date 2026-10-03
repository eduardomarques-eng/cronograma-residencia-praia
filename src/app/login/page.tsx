"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(formData)) });
    if (!response.ok) setError((await response.json()).error ?? "Não foi possível entrar.");
    else router.push("/");
    setPending(false);
  }
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-6">
      {/* Marca de água: mesma marca, gigante e discreta, atrás do cartão.
          `pointer-events-none` impede que tape os cliques do formulário e
          `select-none` evita que o utilizador copie o SVG ao selectionar. */}
      <Brand
        decorative
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[7] opacity-[0.045] select-none sm:scale-[9]"
      />

      <form action={submit} className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-7 shadow-sm backdrop-blur">
        <Brand />

        {/* "Esqueci a senha" fica logo abaixo da marca, antes do formulário. */}
        <p className="mt-5 text-sm text-slate-500">
          Acesse o estúdio ou o portal do cliente.{" "}
          <Link href="/recuperar-senha" className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700">
            Esqueci a senha
          </Link>
        </p>

        <h1 className="mt-8 text-2xl font-bold text-slate-950">Entrar</h1>

        <label className="mt-6 block text-sm font-semibold text-slate-700">
          E-mail
          <input name="email" type="email" required autoComplete="email" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" />
        </label>
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Senha
          <input name="password" type="password" required autoComplete="current-password" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" />
        </label>

        {error ? <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p> : null}

        <Button type="submit" disabled={pending} className="mt-6 w-full">{pending ? "Entrando…" : "Entrar"}</Button>
      </form>
    </main>
  );
}
