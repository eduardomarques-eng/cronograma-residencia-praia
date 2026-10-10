import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import type { AuthRole } from "@/server/auth";

// Navegação administrativa completa (dono/ADMIN).
const ADMIN_LINKS = [
  ["Painel", "/admin"],
  ["Clientes", "/admin/clientes"],
  ["Projetos", "/admin/projetos"],
  ["Propostas", "/admin/propostas"],
  ["Briefings", "/admin/briefing"],
  ["Mensagens", "/admin/mensagens"],
  ["Serviços", "/admin/servicos"],
  ["Equipe", "/admin/equipe"],
  ["Configurações", "/admin/configuracoes"],
] as const;

// Navegação do funcionário da equipa (OPERADOR): apenas a operação do
// cronograma. O menu é só cosmético — a autorização de cada página é provada
// no servidor (requirePageScheduleRole / requireProjectAccess).
const OPERADOR_LINKS = [
  ["Operação", "/operacao"],
] as const;

/**
 * `role` decide a navegação. Sem role (padrão) assume o ambiente administrativo
 * completo, para não quebrar as páginas que ainda não passam o papel. O cliente
 * continua a usar `environment="client"`.
 */
export function AppShell({
  children,
  eyebrow = "Estúdio",
  environment = "admin",
  role,
}: {
  children: ReactNode;
  eyebrow?: string;
  environment?: "admin" | "client";
  role?: AuthRole;
}) {
  const isOperador = role === "OPERADOR";
  const links = environment === "client"
    ? ([["Meu projeto", "/portal"]] as const)
    : isOperador
      ? OPERADOR_LINKS
      : ADMIN_LINKS;
  const areaLabel = environment === "client"
    ? "Flow · portal do cliente"
    : isOperador
      ? "Flow · operação de cronograma"
      : "Flow · gestão de projetos";
  const groupLabel = isOperador ? "Operação" : "Administração";

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <aside className={`fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-7 lg:block ${environment === "client" ? "bg-slate-950 text-white" : ""}`}>
        {/* Identidade oficial em toda a aplicação. Antes era o texto "ArqVértice.",
            que não existe como marca: o logo é a imagem entregue. */}
        <Link href="/" className="block px-3">
          <Brand compact showTagline={false} />
        </Link>
        <p className="px-3 pt-2 text-xs text-slate-400">{areaLabel}</p>
        <p className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{groupLabel}</p>
        <nav className="mt-2 space-y-1" aria-label="Navegação principal">
          {links.map(([label, href]) => <Link key={href} href={href} className={`block rounded-xl px-3 py-3 text-sm font-medium ${environment === "client" ? "text-slate-300 hover:bg-slate-800 hover:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>{label}</Link>)}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-[#f5f5f7]/95 px-5 py-4 backdrop-blur md:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p><p className="mt-1 text-sm text-slate-600">ArqVértice Flow · {environment === "client" ? "Portal do Cliente" : isOperador ? "operação de cronograma" : "ambiente administrativo"}</p></div>
            <Link href="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Entrar →</Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}
