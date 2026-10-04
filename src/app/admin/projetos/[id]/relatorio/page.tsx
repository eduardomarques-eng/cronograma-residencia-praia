import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requirePageProjectAccess, currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { getScheduleReport } from "@/server/services/schedule-report-service";
import { REPORT_SUBTITLE } from "@/lib/schedule-report";
import { DUE_SOON_DAYS } from "@/lib/schedule-alerts";

export const dynamic = "force-dynamic";

/**
 * Relatório Executivo de Cronograma & Obras.
 *
 * A tela e o PDF consomem o MESMO `ScheduleReport`: o número que o cliente lê
 * aqui é o número que vai impresso. Nenhum valor é recalculado no componente.
 */
export default async function ProjectReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageProjectAccess(id);

  const user = await currentUser();
  if (user?.role === "CLIENT") {
    // O relatório só chega ao cliente quando o ADMIN o liberta, como já
    // acontecia com `ProjectReport`. A regra não mudou nesta fase.
    const released = await prisma.projectReport.findFirst({
      where: { projectId: id, status: "RELEASED" },
      select: { id: true },
    });
    if (!released) notFound();
  }

  const bundle = await getScheduleReport(id);
  if (!bundle) notFound();
  const report = bundle.report;
  const pdfUrl = `/api/projects/${id}/cronograma/relatorio/pdf`;

  return (
    <AppShell eyebrow="Relatório">
      <div className="print-report mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-bold text-blue-600">ArqVértice</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{report.title}</h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {REPORT_SUBTITLE}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {bundle.projectName} · emissão {report.emittedAtLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PrintButton />
            <a
              href={pdfUrl}
              className="print-hidden rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Baixar PDF
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Badge tone={report.statusGeralTone}>{report.statusGeral}</Badge>
          <Badge tone="blue">Progresso {report.overall.progress}%</Badge>
          {report.alerts.overdue > 0 ? <Badge tone="red">{report.alerts.overdue} atrasada(s)</Badge> : null}
          {report.alerts.blocked > 0 ? <Badge tone="amber">{report.alerts.blocked} bloqueada(s)</Badge> : null}
          {report.alerts.dueSoon > 0 ? (
            <Badge tone="amber">{report.alerts.dueSoon} com prazo ≤ {DUE_SOON_DAYS} dias</Badge>
          ) : null}
          {report.alerts.noDueDate > 0 ? (
            <Badge tone="neutral">{report.alerts.noDueDate} sem prazo</Badge>
          ) : null}
        </div>

        <ReportSection title="1. Dados de entrada e ficha técnica do projeto">
          <dl className="grid gap-4 sm:grid-cols-2">
            {report.ficha.map((row) => (
              <div key={row.label}>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{row.label}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </ReportSection>

        <ReportSection title="2. Quadro técnico de engenharia & arquitetura">
          {report.equipe.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum responsável atribuído às etapas deste projeto.</p>
          ) : (
            <ul className="space-y-3">
              {report.equipe.map((person) => (
                <li key={person.name} className="border-l-4 border-slate-300 pl-4">
                  <p className="text-sm font-semibold text-slate-900">{person.name}</p>
                  <p className="text-xs text-slate-500">
                    {person.disciplines} · {person.stages} etapa(s) · {person.progress}% concluído
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ReportSection>

        <ReportSection title="3. Fase atual do empreendimento">
          {report.phases.length === 0 ? (
            <p className="text-sm text-slate-500">Sem etapas cadastradas: não há fase a assinalar.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {report.phases.map((phase) => (
                <li
                  key={phase.discipline}
                  className={`rounded-xl border p-4 ${phase.current ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}
                >
                  <p className="text-sm font-semibold text-slate-900">{phase.discipline}</p>
                  <p className="text-xs text-slate-500">
                    {phase.state} · {phase.completed}/{phase.total} concluídas
                  </p>
                  <div className="mt-2">
                    <Progress value={phase.progress} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ReportSection>

        <ReportSection title="4. Parecer técnico executivo do cronograma">
          {report.parecer.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-6 text-slate-700">
              {paragraph}
            </p>
          ))}
        </ReportSection>

        <ReportSection title="5. Resumo de avanço físico por disciplina">
          <p className="text-sm font-semibold text-slate-900">
            Progresso geral: {report.overall.progress}% · {report.overall.completed} de {report.overall.total}{" "}
            etapas concluídas
          </p>
          <ul className="mt-3 space-y-2">
            {report.disciplines.map((discipline) => (
              <li key={discipline.discipline} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-700">{discipline.discipline}</span>
                <span className="text-xs text-slate-500">
                  {discipline.progress}% · {discipline.completed}/{discipline.total}
                </span>
              </li>
            ))}
          </ul>
        </ReportSection>

        <ReportSection title="6. Resumo financeiro do projeto">
          <dl className="grid gap-4 sm:grid-cols-4">
            {report.financial.rows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{row.label}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-blue-700">{report.financial.nextPayment}</p>
        </ReportSection>

        <ReportSection title="7. Quadro consolidado de etapas & entregas">
          {report.stages.length === 0 ? (
            <p className="text-sm text-slate-500">Sem etapas cadastradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">Descrição / Etapa</th>
                    <th className="py-2 pr-3">Disciplina</th>
                    <th className="py-2 pr-3">Responsável Técnico</th>
                    <th className="py-2 pr-3">Data Limite</th>
                    <th className="py-2 pr-3">Avanço Físico</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.stages.map((stage) => (
                    <tr key={stage.order} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 font-semibold text-slate-900">{stage.name}</td>
                      <td className="py-2 pr-3 text-slate-600">{stage.discipline}</td>
                      <td className="py-2 pr-3 text-slate-600">{stage.designer}</td>
                      <td className="py-2 pr-3 text-slate-600">{stage.dueDate}</td>
                      <td className="py-2 pr-3 font-semibold text-slate-900">{stage.completion}%</td>
                      <td className="py-2 text-slate-600">
                        {stage.statusLabel} · {stage.alertDetail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportSection>

        <ReportSection title="8. Critérios oficiais de acompanhamento">
          <ul className="space-y-1 text-sm text-slate-600">
            {report.criteria.map((criterion) => (
              <li key={criterion.label}>
                <span className="font-semibold text-slate-900">{criterion.label}</span> — {criterion.description}
              </li>
            ))}
          </ul>

          <h3 className="mt-5 text-sm font-semibold text-slate-900">Alertas do cronograma</h3>
          {report.alertRows.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-700">
              Nenhuma etapa em atraso, bloqueada ou com prazo próximo.
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {report.alertRows.map((row) => (
                <li key={row.stage}>
                  <span className="font-semibold text-slate-900">{row.stage}</span> — {row.detail} · {row.priority}
                </li>
              ))}
            </ul>
          )}
        </ReportSection>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {report.signatures.map((person) => (
              <div key={`${person.name}-${person.role}`}>
                <div className="h-8 border-b border-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-900">{person.name}</p>
                <p className="text-xs text-slate-500">{person.role}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Documento de acompanhamento físico · ArqVértice
          </p>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          <Link href={`/admin/projetos/${id}/cronograma`} className="font-semibold text-blue-600">
            ← Voltar ao cronograma
          </Link>
        </p>
      </div>
    </AppShell>
  );
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mt-6">
      <h2 className="border-l-4 border-slate-900 pl-3 text-sm font-bold uppercase tracking-wide text-slate-900">
        {title}
      </h2>
      <div className="mt-4 space-y-3">{children}</div>
    </Card>
  );
}
