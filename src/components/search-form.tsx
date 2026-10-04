import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Busca por GET. Devolve o termo no endereço em vez de filtrar em memória,
 * por isso funciona sem JavaScript, a página recarrega no servidor e o
 * resultado é partilhável por link.
 */
export function SearchForm({ action, query, placeholder }: { action: string; query: string; placeholder: string }) {
  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
      <form action={action} method="get" className="flex flex-1 flex-col gap-2 sm:flex-row">
        <label htmlFor="busca" className="sr-only">
          Buscar
        </label>
        <input
          id="busca"
          type="search"
          name="q"
          defaultValue={query}
          placeholder={placeholder}
          className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        />
        <Button type="submit">Buscar</Button>
      </form>
      {query ? (
        <Link
          href={action}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Limpar
        </Link>
      ) : null}
    </div>
  );
}