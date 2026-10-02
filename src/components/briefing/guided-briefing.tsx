"use client";

import { useMemo, useState, useTransition } from "react";
import { finishBriefingAction, saveBriefingAction } from "@/app/actions/domain-actions";
import { allBriefingQuestions, briefingSections, type BriefingQuestion } from "@/lib/briefing-definition";

type Props = { projectId: string; initialResponses: Record<string, unknown>; initialStatus: "DRAFT" | "FINALIZED"; initialVersion: number; persistedVisualOptions: { questionId: string; value: string; title: string; description: string | null; imageUrl: string | null; altText: string | null }[] };

function answerIsPresent(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

export function GuidedBriefing({ projectId, initialResponses, initialStatus, initialVersion, persistedVisualOptions }: Props) {
  const [responses, setResponses] = useState(initialResponses);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState("Salvo automaticamente");
  const [reviewing, setReviewing] = useState(false);
  const [pending, startTransition] = useTransition();
  const section = briefingSections[sectionIndex];
  const answered = useMemo(() => allBriefingQuestions.filter((question) => answerIsPresent(responses[question.id])).length, [responses]);
  const progress = Math.round((answered / allBriefingQuestions.length) * 100);

  function update(question: BriefingQuestion, value: unknown) {
    if (status === "FINALIZED") return;
    const next = { ...responses, [question.id]: value };
    setResponses(next);
    setSaveState("Salvando…");
    startTransition(async () => {
      try {
        await saveBriefingAction(projectId, { responses: next });
        setSaveState("Salvo agora");
      } catch {
        setSaveState("Não foi possível salvar");
      }
    });
  }

  function toggle(question: BriefingQuestion, option: string) {
    const current = Array.isArray(responses[question.id]) ? responses[question.id] as string[] : [];
    update(question, current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }

  function renderQuestion(question: BriefingQuestion) {
    const value = responses[question.id];
    if (question.type === "long" || question.type === "short") {
      return <textarea aria-label={question.text} value={typeof value === "string" ? value : ""} onChange={(event) => update(question, event.target.value)} rows={question.type === "long" ? 4 : 2} className="min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-base outline-none transition focus:border-blue-500" />;
    }
    if (question.type === "single") {
      return <div className="grid gap-3">{question.options?.map((option) => <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm transition ${value === option ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-white hover:border-slate-300"}`}><input type="radio" name={question.id} checked={value === option} onChange={() => update(question, option)} className="size-4 accent-blue-600" />{option}</label>)}</div>;
    }
    if (question.type === "multiple") {
      return <div className="grid gap-3">{question.options?.map((option) => <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm transition ${Array.isArray(value) && value.includes(option) ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 bg-white hover:border-slate-300"}`}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={() => toggle(question, option)} className="size-4 accent-blue-600" />{option}</label>)}</div>;
    }
    const persisted = persistedVisualOptions.filter((option) => option.questionId === question.id);
    const options = persisted.length > 0 ? persisted : question.visualOptions ?? [];
    return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{options.map((option) => { const selected = Array.isArray(value) ? value.includes(option.value) : value === option.value; return <button type="button" key={option.value} onClick={() => question.id === "p7_estilos" || question.id === "p8_ambientes" ? toggle(question, option.value) : update(question, option.value)} className={`overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${selected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`} aria-pressed={selected}>{option.imageUrl ? <img src={option.imageUrl} alt={option.altText ?? option.title} className="h-36 w-full object-cover" /> : <div className="flex h-24 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-3xl text-slate-400" aria-hidden="true">⌂</div>}<div className="p-4"><strong className="block text-sm text-slate-900">{option.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span></div></button>; })}</div>;
  }

  if (reviewing) return <Review projectId={projectId} responses={responses} answered={answered} pending={pending} onBack={() => setReviewing(false)} onFinish={() => startTransition(async () => { await finishBriefingAction(projectId); setStatus("FINALIZED"); })} />;
  return <div className="mx-auto max-w-3xl"><header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Briefing guiado · versão {initialVersion}</p><h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Vamos construir esse projeto juntos</h1><p className="mt-2 text-sm leading-6 text-slate-500">Responda no seu ritmo. Suas respostas são salvas automaticamente.</p></div><span className="text-right text-xs text-slate-400" role="status">{saveState}</span></div><div className="mt-7"><div className="flex justify-between text-xs font-semibold text-slate-500"><span>{answered} de {allBriefingQuestions.length} respondidas</span><span>{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div></div></header><nav className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Seções do briefing">{briefingSections.map((item, index) => <button type="button" key={item.id} onClick={() => setSectionIndex(index)} className={`min-w-max rounded-full px-4 py-2 text-xs font-semibold ${index === sectionIndex ? "bg-slate-900 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{index + 1}. {item.title}</button>)}</nav><section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8"><p className="text-sm font-semibold text-blue-600">Seção {sectionIndex + 1} de {briefingSections.length}</p><h2 className="mt-2 text-xl font-bold text-slate-950">{section.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{section.summary}</p><div className="mt-8 space-y-8">{section.questions.map((question) => <div key={question.id}><label className="block text-base font-semibold leading-6 text-slate-900">{question.text}</label>{question.hint ? <p className="mt-1 text-xs leading-5 text-slate-400">{question.hint}</p> : null}<div className="mt-3">{renderQuestion(question)}</div></div>)}</div></section><div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" disabled={sectionIndex === 0} onClick={() => setSectionIndex((value) => value - 1)} className="min-h-12 rounded-2xl px-5 text-sm font-semibold text-slate-600 disabled:opacity-40">← Anterior</button>{sectionIndex < briefingSections.length - 1 ? <button type="button" onClick={() => setSectionIndex((value) => value + 1)} className="min-h-12 rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white">Próxima seção →</button> : <button type="button" onClick={() => setReviewing(true)} className="min-h-12 rounded-2xl bg-blue-600 px-6 text-sm font-semibold text-white">Revisar respostas →</button>}</div></div>;
}

function Review({ projectId, responses, answered, pending, onBack, onFinish }: { projectId: string; responses: Record<string, unknown>; answered: number; pending: boolean; onBack: () => void; onFinish: () => void }) {
  const incomplete = allBriefingQuestions.length - answered;
  return <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 sm:p-8"><p className="text-sm font-semibold text-blue-600">Última etapa</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Revise antes de enviar</h1><p className="mt-2 text-sm leading-6 text-slate-500">Confira suas escolhas. Você pode voltar a qualquer seção para corrigir.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-emerald-50 p-4"><strong className="block text-xl text-emerald-800">{answered}</strong><span className="text-xs text-emerald-700">respondidas</span></div><div className="rounded-2xl bg-amber-50 p-4"><strong className="block text-xl text-amber-800">{incomplete}</strong><span className="text-xs text-amber-700">pendentes</span></div><div className="rounded-2xl bg-slate-50 p-4"><strong className="block text-xl text-slate-800">Rascunho</strong><span className="text-xs text-slate-500">salvo no projeto</span></div></div><div className="mt-8 space-y-3">{briefingSections.map((section) => { const sectionAnswered = section.questions.filter((question) => answerIsPresent(responses[question.id])).length; return <div key={section.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"><span className="text-sm font-semibold text-slate-800">{section.title}</span><span className="text-xs text-slate-500">{sectionAnswered}/{section.questions.length}</span></div>; })}</div><div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={onBack} className="min-h-12 rounded-2xl px-5 text-sm font-semibold text-slate-600">← Voltar e corrigir</button><button type="button" disabled={pending} onClick={onFinish} className="min-h-12 rounded-2xl bg-blue-600 px-6 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Enviando…" : `Confirmar envio (${answered} respostas)`}</button></div><p className="mt-4 text-center text-xs text-slate-400">Ao confirmar, o briefing será finalizado e uma versão ficará registrada.</p></div>;
}
