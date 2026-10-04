"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";

export function RedefinirSenhaForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) setError((await response.json().catch(() => ({}))).error ?? "Não foi possível redefinir a senha.");
      else {
        setDone(true);
        setTimeout(() => router.push("/login"), 2500);
      }
    } catch {
      setError("Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-6">
      <Brand decorative className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[5] opacity-[0.06] select-none mix-blend-multiply sm:scale-[7]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-7 shadow-sm backdrop-blur">
        <Brand />

        <h1 className="mt-8 text-2xl font-bold text-slate-950">Criar nova senha</h1>

        {!token ? (
          <>
            <p role="alert" className="mt-3 text-sm text-rose-600">Este link de redefinição é inválido ou está incompleto.</p>
            <Link href="/recuperar-senha" className="mt-6 block text-center text-sm font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700">
              Pedir um novo link
            </Link>
          </>
        ) : done ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-emerald-700">
              Senha alterada com sucesso. Por segurança, as sessões abertas foram encerradas. A redireccionar para o início de sessão…
            </p>
            <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700">
              Entrar agora
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-500">A nova senha deve ter pelo menos 12 caracteres.</p>

            <form onSubmit={submit} className="mt-6">
              <label className="block text-sm font-semibold text-slate-700">
                Nova senha
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500"
                />
              </label>
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Confirmar nova senha
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500"
                />
              </label>

              {error ? <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p> : null}

              <Button type="submit" disabled={pending} className="mt-6 w-full">{pending ? "A guardar…" : "Guardar nova senha"}</Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
