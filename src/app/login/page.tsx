"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
  return <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] p-6"><form action={submit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-lg font-bold text-slate-900">ArqVértice<span className="text-blue-600">.</span></p><h1 className="mt-10 text-2xl font-bold text-slate-950">Entrar</h1><p className="mt-2 text-sm text-slate-500">Acesse o estúdio ou o portal do cliente.</p><label className="mt-7 block text-sm font-semibold text-slate-700">E-mail<input name="email" type="email" required className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" /></label><label className="mt-4 block text-sm font-semibold text-slate-700">Senha<input name="password" type="password" required className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-500" /></label>{error ? <p role="alert" className="mt-4 text-sm text-rose-600">{error}</p> : null}<Button type="submit" disabled={pending} className="mt-6 w-full">{pending ? "Entrando…" : "Entrar"}</Button></form></main>;
}
