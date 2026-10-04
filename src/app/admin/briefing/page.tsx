import { requirePageRole } from "@/server/auth";
import { listVisualOptions } from "@/server/services/briefing-service";
import { briefingSections } from "@/lib/briefing-definition";
import { ANSWER_KIND } from "@/lib/briefing-schema";
import { VisualOptionForm } from "@/components/briefing/visual-option-form";

export default async function BriefingAdminPage() {
  await requirePageRole("ADMIN");
  const options = await listVisualOptions();
  return <main className="min-h-screen bg-[#f5f5f7] px-5 py-10"><div className="mx-auto max-w-5xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Administração</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Opções visuais do briefing</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">As imagens persistidas ficam vinculadas ao ID da pergunta. Você pode substituir, ordenar ou desativar opções sem alterar respostas existentes.</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{briefingSections.flatMap((section) => section.questions.filter((question) => question.type === ANSWER_KIND.IMAGE_CHOICE).map((question) => <section key={question.id} className="rounded-3xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold text-blue-600">{question.id}</p><h2 className="mt-2 font-semibold text-slate-900">{question.text}</h2>{options.filter((option) => option.questionId === question.id).map((option) => <VisualOptionForm key={option.id} questionId={question.id} option={option} />)}<VisualOptionForm questionId={question.id} /></section>))}</div></div></main>;
}
