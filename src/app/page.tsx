import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { checkDatabase } from "@/server/services/database-status";

export const dynamic = "force-dynamic";

const metricsSemDados = [
  ["Projetos ativos", "—", "Sem dados"],
  ["Próximas etapas", "—", "Sem dados"],
  ["Pagamentos pendentes", "—", "Sem dados"],
  ["Total recebido", "R$ —", "Sem dados"],
];

/** Comandos para sair do estado "sem dados". Fora do JSX: um template literal
 *  multilinha dentro de `<pre>` parte o parser do JSX. */
const COMANDOS_INICIO = [
  'DATABASE_URL="postgresql://UTILIZADOR:SENHA@HOST:5432/BASE"',
  "",
  "npx prisma migrate deploy",
  "npm run db:seed",
].join("\n");

export default async function HomePage() {
  // A página deixa de ser estática para poder dizer COMO ESTÁ a base de dados.
  // Sem isto, uma app sem BD parece uma app quebrada — e era exactamente o que
  // se vê no deploy: cartões vazios sem explicação.
  const database = await checkDatabase();

  const metrics = [
    ["Projetos ativos", database.ok ? "—" : "—", database.ok ? "Aguarde carregamento" : "Banco não conectado"],
    ["Próximas etapas", "—", database.ok ? "Aguardando dados" : "Banco não conectado"],
    ["Pagamentos pendentes", "—", database.ok ? "Aguardando dados" : "Banco não conectado"],
    ["Total recebido", "R$ —", database.ok ? "Aguardando dados" : "Banco não conectado"],
  ];

  return (
    <AppShell>
      <SectionHeading
        title="Visão geral"
        description="Uma leitura objetiva do estúdio: projetos, cronograma e financeiro em um só lugar."
        action={<Badge tone={database.ok ? "green" : "amber"}>{database.ok ? "Banco conectado" : "Banco não conectado"}</Badge>}
      />

      {!database.ok ? (
        <Card className="mt-6 border-amber-300 bg-amber-50">
          <h2 className="font-semibold text-amber-900">A aplicação está a correr, mas ainda não há dados</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Isto <strong>não é um erro</strong>: o interface e as rotas responderam. Faltam apenas as
            {` `}
            <strong>13 migrations</strong> e o seed, para que a base de dados exista.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-white/70 p-3 text-xs leading-6 text-amber-900">
            {COMANDOS_INICIO}
          </pre>
          <p className="mt-3 text-xs text-amber-800">
            Detalhe técnico: {database.reason}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/api/health" className="text-amber-900 underline">
              Ver estado da API
            </Link>
            <Link href="/login" className="text-amber-900 underline">
              Ir para o login
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(database.ok ? metrics : metricsSemDados).map(([label, value, note]) => (
          <Card key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
            <p className="mt-2 text-xs text-slate-400">{note}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Projetos recentes</h2>
              <p className="mt-1 text-sm text-slate-500">Acompanhe o que precisa de atenção.</p>
            </div>
            <Link href="/projetos" className="text-sm font-semibold text-blue-600">
              Ver todos
            </Link>
          </div>
          <div className="mt-6">
            <EmptyState
              title={database.ok ? "Nenhum projeto carregado" : "Projetos indisponíveis sem base de dados"}
              description={
                database.ok
                  ? "Assim que existirem projetos, aparecem aqui."
                  : "Assim que as migrations e o seed forem aplicados, os projetos do estúdio aparecem aqui."
              }
              action={
                <Link href="/projetos" className="text-sm font-semibold text-blue-600">
                  Abrir projetos
                </Link>
              }
            />
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold text-slate-900">Atalhos</h2>
          <div className="mt-5 grid gap-3">
            <Link href="/clientes" className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cadastrar cliente <span className="float-right text-slate-400">→</span>
            </Link>
            <Link href="/projetos" className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Criar projeto <span className="float-right text-slate-400">→</span>
            </Link>
            <Link href="/login" className="rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Entrar no portal do cliente <span className="float-right text-slate-400">→</span>
            </Link>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

