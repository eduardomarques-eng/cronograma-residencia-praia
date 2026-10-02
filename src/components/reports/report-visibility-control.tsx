"use client";

import { useTransition } from "react";
import { updateReportVisibilityAction } from "@/app/actions/domain-actions";

const labels = { PREPARING: "Em preparação", INTERNAL: "Interno", RELEASED: "Liberado ao cliente", ARCHIVED: "Arquivado" } as const;
type Report = { id: string; title: string; status: keyof typeof labels };

export function ReportVisibilityControl({ projectId, reports }: { projectId: string; reports: Report[] }) {
  const [pending, startTransition] = useTransition();
  return <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Relatórios e publicação</h2><p className="mt-1 text-sm text-slate-500">Somente relatórios liberados aparecem para o cliente.</p></div><span className="text-xs text-slate-400">{reports.length} relatório(s)</span></div>{reports.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum relatório cadastrado.</p> : <div className="mt-4 divide-y divide-slate-100">{reports.map((report) => <div key={report.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-900">{report.title}</p><p className="text-xs text-slate-500">{labels[report.status]}</p></div><select aria-label={`Status de ${report.title}`} disabled={pending} value={report.status} onChange={(event) => startTransition(() => { void updateReportVisibilityAction(projectId, report.id, event.target.value as Report["status"]); })} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="PREPARING">Em preparação</option><option value="INTERNAL">Interno</option><option value="RELEASED">Liberado ao cliente</option><option value="ARCHIVED">Arquivado</option></select></div>)}</div>}</div>;
}
