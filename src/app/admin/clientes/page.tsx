import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { requirePageRole } from "@/server/auth";
import { listClients } from "@/server/services/client-service";

export const metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requirePageRole("ADMIN");
  const clients = await listClients();

  return (
    <AppShell eyebrow="Relacionamento">
      <SectionHeading
        title="Clientes"
        description="Centralize contatos, projetos e histórico de relacionamento."
        action={<Button>Novo cliente</Button>}
      />

      {clients.length === 0 ? (
        <EmptyState
          title="Nenhum cliente cadastrado"
          description="Os clientes criados pelos serviços aparecem aqui."
          action={<Button>Novo cliente</Button>}
        />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/clientes/${client.id}`} className="font-semibold text-slate-900 hover:text-blue-700">
                    {client.name}
                  </Link>
                  {client.email ? (
                    <p className="mt-1 break-all text-sm text-slate-500">{client.email}</p>
                  ) : null}
                </div>
                <Badge tone={client.status === "ACTIVE" ? "green" : "neutral"}>{client.status}</Badge>
              </div>
              <Link href={`/clientes/${client.id}`} className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
                Abrir ficha →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
