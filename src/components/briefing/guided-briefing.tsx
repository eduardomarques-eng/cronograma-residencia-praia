"use client";

import { useMemo, useState, useTransition } from "react";
import { finishBriefingAction, finishBriefingTokenAction, saveBriefingAction, saveBriefingTokenAction } from "@/app/actions/domain-actions";
import { allBriefingQuestions, briefingSections, type BriefingQuestion } from "@/lib/briefing-definition";
import { VoiceTextarea } from "./voice-textarea";

type Props = { projectId: string; accessToken?: string; initialResponses: Record<string, unknown>; initialStatus: "DRAFT" | "FINALIZED"; initialVersion: number; persistedVisualOptions: { questionId: string; value: string; title: string; description: string | null; imageUrl: string | null; altText: string | null }[] };

function answerIsPresent(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

/**
 * Uma resposta guardada pode ser texto, lista (escolha múltipla) ou objeto.
 * A revisão tem de mostrar o que a pessoa escolheu, não um contador: um ecrã
 * chamado "Revise antes de enviar" que não mostra as respostas não deixa
 * confirmar nada.
 */
function answerText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((item) => answerText(item)).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    const registo = value as Record<string, unknown>;
    return String(registo.text ?? registo.value ?? registo.label ?? JSON.stringify(value));
  }
  return String(value);
}

export function GuidedBriefing({ projectId, accessToken, initialResponses, initialStatus, initialVersion, persistedVisualOptions }: Props) {
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
        if (accessToken) await saveBriefingTokenAction(accessToken, { responses: next });
        else await saveBriefingAction(projectId, { responses: next });
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
      return <VoiceTextarea label={question.text} value={typeof value === "string" ? value : ""} onChange={(nextValue) => update(question, nextValue)} rows={question.type === "long" ? 4 : 2} />;
    }
    if (question.type === "single") {
      return <div className="grid gap-3">{question.options?.map((option) => <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-medium transition-colors ${value === option ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}><input type="radio" name={question.id} checked={value === option} onChange={() => update(question, option)} className="size-4 accent-blue-600" />{option}</label>)}</div>;
    }
    if (question.type === "multiple") {
      return <div className="grid gap-3">{question.options?.map((option) => <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-medium transition-colors ${Array.isArray(value) && value.includes(option) ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}><input type="checkbox" checked={Array.isArray(value) && value.includes(option)} onChange={() => toggle(question, option)} className="size-4 accent-blue-600" />{option}</label>)}</div>;
    }
    const persisted = persistedVisualOptions.filter((option) => option.questionId === question.id);
    const options = persisted.length > 0 ? persisted : question.visualOptions ?? [];
    return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{options.map((option) => { const selected = Array.isArray(value) ? value.includes(option.value) : value === option.value; return <button type="button" key={option.value} onClick={() => question.id === "p7_estilos" || question.id === "p8_ambientes" ? toggle(question, option.value) : update(question, option.value)} className={`group overflow-hidden rounded-2xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`} aria-pressed={selected}>{option.imageUrl ? <img src={option.imageUrl} alt={option.altText ?? option.title} className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <div className="flex h-28 items-center justify-center bg-slate-100 text-3xl text-slate-400" aria-hidden="true">⌂</div>}<div className="p-4"><div className="flex items-start justify-between gap-3"><strong className="block text-sm font-semibold text-slate-900">{option.title}</strong>{selected ? <span className="text-xs font-semibold text-blue-700">Selecionado</span> : null}</div><span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span></div></button>; })}</div>;
  }

  if (status === "FINALIZED") return <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8"><p className="text-sm font-semibold text-emerald-700">Briefing enviado</p><h1 className="mt-2 text-2xl font-bold text-emerald-950">Obrigado por compartilhar suas escolhas</h1><p className="mt-3 text-sm leading-6 text-emerald-900">Suas respostas foram registradas. Para acompanhar o projeto, entre no Portal do Cliente.</p><a href="/login" className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-emerald-700 px-5 text-sm font-semibold text-white">Acessar Portal do Cliente →</a></div>;
  if (reviewing) return <Review projectId={projectId} responses={responses} answered={answered} pending={pending} onBack={() => setReviewing(false)} onFinish={() => startTransition(async () => { if (accessToken) await finishBriefingTokenAction(accessToken); else await finishBriefingAction(projectId); setStatus("FINALIZED"); })} />;
  return <div className="mx-auto max-w-3xl"><header className="surface rounded-3xl p-5 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Briefing guiado · versão {initialVersion}</p><h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Vamos construir esse projeto juntos</h1><p className="mt-2 text-sm leading-6 text-slate-500">Responda no seu ritmo. Suas respostas são salvas automaticamente.</p></div><span className="text-right text-xs text-slate-400" role="status">{saveState}</span></div><div className="mt-7"><div className="flex justify-between text-xs font-semibold text-slate-500"><span>{answered} de {allBriefingQuestions.length} respondidas</span><span>{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>  </div></header><nav className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Seções do briefing">{briefingSections.map((item, index) => <button type="button" key={item.id} onClick={() => setSectionIndex(index)} className={`min-h-10 min-w-max rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${index === sectionIndex ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{index + 1}. {item.title}</button>)}</nav><section className="surface mt-4 rounded-3xl p-5 sm:p-8"><p className="text-sm font-semibold text-blue-600">Seção {sectionIndex + 1} de {briefingSections.length}</p><h2 className="mt-2 text-xl font-bold text-slate-950">{section.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{section.summary}</p><div className="mt-8 space-y-8">{section.questions.map((question) => <div key={question.id}><label className="block text-base font-semibold leading-6 text-slate-900">{question.text}</label>{question.hint ? <p className="mt-1 text-xs leading-5 text-slate-400">{question.hint}</p> : null}<div className="mt-3">{renderQuestion(question)}</div></div>)}</div></section><div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" disabled={sectionIndex === 0} onClick={() => setSectionIndex((value) => value - 1)} className="min-h-12 rounded-2xl px-5 text-sm font-semibold text-slate-600 disabled:opacity-40">← Anterior</button>{sectionIndex < briefingSections.length - 1 ? <button type="button" onClick={() => setSectionIndex((value) => value + 1)} className="min-h-12 rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white">Próxima seção →</button> : <button type="button" onClick={() => setReviewing(true)} className="min-h-12 rounded-2xl bg-blue-600 px-6 text-sm font-semibold text-white">Revisar respostas →</button>}</div></div>;
}

function Review({ projectId, responses, answered, pending, onBack, onFinish }: { projectId: string; responses: Record<string, unknown>; answered: number; pending: boolean; onBack: () => void; onFinish: () => void }) {
  const incomplete = allBriefingQuestions.length - answered;
  return <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 sm:p-8"><p className="text-sm font-semibold text-blue-600">Última etapa</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Revise antes de enviar</h1><p className="mt-2 text-sm leading-6 text-slate-500">Confira suas escolhas. Você pode voltar a qualquer seção para corrigir.</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-emerald-50 p-4"><strong className="block text-xl text-emerald-800">{answered}</strong><span className="text-xs text-emerald-700">respondidas</span></div><div className="rounded-2xl bg-amber-50 p-4"><strong className="block text-xl text-amber-800">{incomplete}</strong><span className="text-xs text-amber-700">pendentes</span></div><div className="rounded-2xl bg-slate-50 p-4"><strong className="block text-xl text-slate-800">Rascunho</strong><span className="text-xs text-slate-500">salvo no projeto</span></div></div><div className="mt-8 space-y-3">{briefingSections.map((section) => { const sectionAnswered = section.questions.filter((question) => answerIsPresent(responses[question.id])).length; return <div key={section.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-800">{section.title}</span><span className="text-xs text-slate-500">{sectionAnswered}/{section.questions.length}</span></div>{sectionAnswered ? <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3">{section.questions.filter((question) => answerIsPresent(responses[question.id])).map((question) => <div key={question.id}><dt className="text-xs text-slate-400">{question.text}</dt><dd className="text-sm leading-6 text-slate-700">{answerText(responses[question.id])}</dd></div>)}</dl> : null}</div>; })}</div><div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><button type="button" onClick={onBack} className="min-h-12 rounded-2xl px-5 text-sm font-semibold text-slate-600">← Voltar e corrigir</button><button type="button" disabled={pending} onClick={onFinish} className="min-h-12 rounded-2xl bg-blue-600 px-6 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Enviando…" : `Confirmar envio (${answered} respostas)`}</button></div><p className="mt-4 text-center text-xs text-slate-400">Ao confirmar, o briefing será finalizado e uma versão ficará registrada.</p></div>;
}
