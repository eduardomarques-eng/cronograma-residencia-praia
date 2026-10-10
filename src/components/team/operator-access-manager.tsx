"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setOperatorProjectAccessAction } from "@/app/actions/domain-actions";

type ProjectOption = { id: string; name: string; clientName: string };

/**
 * Gestão dos projetos de UM operador. O estado vive no cliente só enquanto o
 * ADMIN edita; a verdade é gravada pela server action, que volta a provar a
 * sessão de ADMIN no serviço. A lista enviada é a fonte da verdade: projeto não
 * marcado perde o acesso. Nenhum projeto é criado aqui — só associação.
 */
export function OperatorAccessManager({
  operatorId,
  operatorName,
  operatorEmail,
  assignedProjectIds,
  projects,
}: {
  operatorId: string;
  operatorName: string;
  operatorEmail: string;
  assignedProjectIds: string[];
  projects: ProjectOption[];
}) {
  const [selected, setSelected] = useState<string[]>(assignedProjectIds);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(projectId: string) {
    setSaved(false);
    setError(null);
    setSelected((current) =>
      current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId],
    );
  }

  function save() {
    startTransition(async () => {
      // A action lança `DomainError` (sessão expirada, operador removido, etc).
      // Sem este catch o React registaria a exceção e o ADMIN ficaria sem
      // resposta — o mesmo padrão de `moveStageStatusAction`, que devolve
      // { ok: false, message } em vez de deixar a promessa rejeitar.
      try {
        setError(null);
        await setOperatorProjectAccessAction(operatorId, selected);
        setSaved(true);
      } catch (cause) {
        setSaved(false);
        setError(cause instanceof Error ? cause.message : "Não foi possível guardar o acesso.");
      }
    });
  }

  const dirty = selected.length !== assignedProjectIds.length || selected.some((id) => !assignedProjectIds.includes(id));

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{operatorName}</p>
          <p className="text-sm text-slate-500">{operatorEmail}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {selected.length} projeto(s)
        </span>
      </div>

      {projects.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Não há projetos cadastrados para atribuir.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {projects.map((project) => (
            <li key={project.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selected.includes(project.id)}
                  onChange={() => toggle(project.id)}
                />
                <span className="font-medium text-slate-800">{project.name}</span>
                <span className="text-xs text-slate-400">· {project.clientName}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending || !dirty}>
          {pending ? "Salvando…" : "Salvar acesso"}
        </Button>
        {saved && !dirty ? <span className="text-sm font-medium text-emerald-700">Acesso atualizado.</span> : null}
        {error ? <span className="text-sm font-medium text-rose-700">{error}</span> : null}
      </div>
    </Card>
  );
}
