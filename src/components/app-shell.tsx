import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  ["Visão geral", "/"],
  ["Clientes", "/clientes"],
  ["Projetos", "/projetos"],
];

export function AppShell({ children, eyebrow = "Estúdio" }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-7 lg:block">
        <Link href="/" className="block px-3 text-lg font-bold tracking-tight text-slate-900">ArqVértice<span className="text-blue-600">.</span></Link>
        <p className="px-3 pt-1 text-xs text-slate-400">Flow · gestão de projetos</p>
        <nav className="mt-10 space-y-1" aria-label="Navegação principal">
          {links.map(([label, href]) => <Link key={href} href={href} className="block rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">{label}</Link>)}
        </nav>
        <div className="absolute bottom-7 left-5 right-5 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
          <strong className="block text-slate-700">Migração incremental</strong>
          O painel legado continua preservado.
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-[#f5f5f7]/95 px-5 py-4 backdrop-blur md:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{eyebrow}</p><p className="mt-1 text-sm text-slate-600">ArqVértice Flow</p></div>
            <Link href="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Entrar →</Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}
