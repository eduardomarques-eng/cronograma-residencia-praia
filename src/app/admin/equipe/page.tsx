import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import { requirePageRole } from "@/server/auth";
import { listAssignableProjects, listOperadores } from "@/server/services/operation-service";
import { OperatorAccessManager } from "@/components/team/operator-access-manager";

export const dynamic = "force-dynamic";

/**
 * Equipa — gestão dos funcionários (OPERADOR) e dos projetos que cada um pode
 * operar. Só o ADMIN entra aqui (`requirePageRole("ADMIN")`). A lista de
 * operadores e de projetos vem do banco; nenhum nome é inventado. A atribuição
 * em si é feita pelo cliente em `OperatorAccessManager`, que chama a server
 * action — a autorização volta a ser provada no serviço.
 */
export default async function EquipePage() {
  await requirePageRole("ADMIN");
  const [operadores, projects] = await Promise.all([listOperadores(), listAssignableProjects()]);

  return (
    <AppShell eyebrow="Equipa">
      <SectionHeading
        title="Equipe e acesso ao cronograma"
        description="Funcionários com acesso restrito. Cada um opera apenas os projetos atribuídos aqui."
      />

      {operadores.length === 0 ? (
        <Card className="mt-6 border-dashed text-center">
          <p className="py-8 text-sm text-slate-500">
            Ainda não há funcionários (OPERADOR). Crie a conta no seed definindo{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">SEED_OPERADOR_EMAIL</code> e{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">SEED_OPERADOR_PASSWORD</code> e executando{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">npm run db:seed</code>.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {operadores.map((operador) => (
            <OperatorAccessManager
              key={operador.id}
              operatorId={operador.id}
              operatorName={operador.name}
              operatorEmail={operador.email}
              assignedProjectIds={operador.projectAccess.map((access) => access.projectId)}
              projects={projects.map((project) => ({
                id: project.id,
                name: project.name,
                clientName: project.client.name,
              }))}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
