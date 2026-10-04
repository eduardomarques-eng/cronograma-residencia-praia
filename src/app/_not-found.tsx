import Link from "next/link";
import type { Metadata } from "next";

/**
 * 404 da aplicação. É a resposta a tokens de briefing inválidos, links antigos
 * e URLs inventadas — por isso é uma página real e não um ecrã em branco.
 */
export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">ArqVértice</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">Não encontrámos esta página</h1>
        <p className="mt-3 leading-7 text-slate-600">
          O link pode ter expirado ou sido revogado. Se não foi você a abrir, pode ignorar — nada foi alterado.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Voltar ao início
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}