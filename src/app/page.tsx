import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { currentUser } from "@/server/auth";
import { checkDatabase } from "@/server/services/database-status";

export const dynamic = "force-dynamic";

/**
 * Entrada da aplicação. Só decide o destino — não tem painel.
 *
 * Antes esta rota tinha um segundo painel com métricas fixas ("—"), enquanto o
 * painel real vivia em /admin: dois dashboards, um deles mentindo. Agora quem
 * tem sessão é redireccionado para a sua área e esta página desaparece.
 */
export default async function HomePage() {
  const user = await currentUser();
  if (user?.role === "CLIENT") redirect("/portal");
  if (user?.role === "ADMIN") redirect("/admin");
  // Funcionário da equipa: vai direto para a operação do cronograma, sem passar
  // pelo painel comercial. O destino é só conveniência — a fronteira real está
  // em requirePageScheduleRole/requireScheduleRole no servidor.
  if (user?.role === "OPERADOR") redirect("/operacao");

  // Sem sessão: a base de dados está ligada? O diagnóstico técnico só aparece
  // aqui, nunca no painel do ADMIN.
  const database = await checkDatabase();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f5f7] p-6">
      <Brand decorative className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[5] opacity-[0.06] select-none mix-blend-multiply sm:scale-[7]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-sm backdrop-blur">
        <Brand />

        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Arquitetura e Engenharia</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Acompanhe o seu projeto, receba propostas e contratos, e fale directamente com o estúdio.
        </p>

        {!database.ok ? (
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <strong className="block text-sm">A aplicação está a correr, mas ainda não há dados</strong>
            <span className="mt-1 block">Isto não é um erro: falta aplicar as 14 migrations e o seed.</span>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-white/70 p-2 text-[11px]">{`npx prisma migrate deploy\nnpm run db:seed`}</pre>
            <span className="mt-2 block">{database.reason}</span>
          </div>
        ) : null}

        <div className="mt-8 space-y-3">
          <Link href="/login" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
            Entrar
          </Link>
          <Link href="/cadastro" className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50">
            Criar conta de cliente
          </Link>
          <Link href="/recuperar-senha" className="block pt-2 text-center text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700">
            Esqueci a senha
          </Link>
        </div>
      </div>
    </main>
  );
}