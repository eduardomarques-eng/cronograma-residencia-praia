import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { currentUser } from "@/server/auth";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Portal" };
export const dynamic = "force-dynamic";

/**
 * Índice do portal do cliente.
 *
 * Existe porque `/` redirecciona o CLIENT para `/portal`, e antes não havia
 * nenhuma página nesse caminho — o redireccionamento levava a um 404. Aqui
 * resolve-se o cliente para os projectos a que tem direito e vai ao primeiro
 * quando só tem um; quando tem vários, lista-os para escolher.
 *
 * A lista usa EXACTAMENTE o mesmo critério de autorização do resto da
 * aplicação (`requireProjectAccess`): pelo `clientId` do utilizador ou por uma
 * permissão explícita em `ProjectAccess`. Um cliente nunca vê o projeto de
 * outro.
 */
export default async function PortalIndexPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=%2Fportal");

  const projects = await prisma.project.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { clientId: user.clientId ?? "__none__" },
              { access: { some: { userId: user.id } } },
            ],
          },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, client: { select: { name: true } } },
  });

  // Um só projecto: vai directamente para ele, sem ecrã intermediário.
  if (projects.length === 1) redirect(`/portal/${projects[0].id}`);

  return (
    <AppShell eyebrow="Portal do cliente" environment="client">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          title="Os meus projetos"
          description="Acompanhe o andamento, o cronograma e os documentos liberados para você."
        />

        {projects.length === 0 ? (
          <EmptyState
            title="Nenhum projeto disponível"
            description="Assim que o escritório associar você a um projeto, ele aparece aqui."
          />
        ) : (
          <div className="mt-6 grid gap-4">
            {projects.map((project) => (
              <Card key={project.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/portal/${project.id}`} className="text-lg font-semibold text-slate-900 hover:text-blue-700">
                      {project.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">{project.client?.name ?? "Sem cliente"}</p>
                  </div>
                  <Badge tone={project.status === "IN_PROGRESS" ? "blue" : "neutral"}>{project.status}</Badge>
                </div>
                <Link href={`/portal/${project.id}`} className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Abrir projeto →
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}