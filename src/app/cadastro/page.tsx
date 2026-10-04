"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

/**
 * Cadastro de cliente.
 *
 * Regra de segurança: um cliente novo NÃO nasce ligado a nenhum projeto. Fica
 * sem `clientId`, e o Admin é que faz a associação — assim ninguém acede a
 * dados de outro cliente por se registar (IDOR). A sessão é criada só depois
 * do utilizador existir.
 */
export default function CadastroPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 12) {
      setError("A senha deve ter pelo menos 12 caracteres.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim().toLowerCase(),
          phone: String(form.get("phone") ?? "").trim(),
          password,
        }),
      });
      if (!response.ok) {
        setError((await response.json().catch(() => ({}))).error ?? "Não foi possível criar a conta.");
      } else {
        setOk(true);
        setTimeout(() => router.push("/login"), 1800);
      }
    } catch {
      setError("Não foi possível criar a conta. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-6">
      <Brand decorative className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[5] opacity-[0.06] select-none mix-blend-multiply sm:scale-[7]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-7 shadow-sm backdrop-blur">
        <Brand />
        <h1 className="mt-7 text-2xl font-bold text-slate-950">Criar conta de cliente</h1>
        <p className="mt-2 text-sm text-slate-500">Acompanhe o seu projeto e receba propostas e contratos.</p>

        {ok ? (
          <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            Conta criada. A redireccionar para o início de sessão…
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Nome completo
              <input name="name" required minLength={3} autoComplete="name" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              E-mail
              <input name="email" type="email" required autoComplete="email" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              WhatsApp ou telefone
              <input name="phone" type="tel" autoComplete="tel" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Senha
              <input name="password" type="password" required minLength={12} autoComplete="new-password" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" />
              <span className="mt-1 block text-xs font-normal text-slate-400">Mínimo 12 caracteres.</span>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Confirmar senha
              <input name="confirm" type="password" required minLength={12} autoComplete="new-password" className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" />
            </label>

            {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}

            <Button type="submit" disabled={pending} className="w-full">{pending ? "A criar conta…" : "Criar conta"}</Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}