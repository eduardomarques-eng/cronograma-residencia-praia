"use client";

import { useMemo, useState } from "react";
import { finishBriefingAction, finishBriefingTokenAction, saveBriefingAction, saveBriefingTokenAction } from "@/app/actions/domain-actions";
import { allBriefingQuestions, briefingSections } from "@/lib/briefing-definition";
import { meetsAll } from "@/lib/briefing-conditions";
import { computeBriefingProgress } from "@/lib/briefing-progress";
import { formatAnswer, type StoredAnswers } from "@/lib/briefing-answers";
import { AnswerField } from "./answer-field";
import { resposta, useDebouncedSave, type SaveState } from "./use-debounced-save";

type PersistedVisualOption = {
  questionId: string;
  value: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  altText: string | null;
};

type Props = {
  projectId: string;
  accessToken?: string;
  initialResponses: StoredAnswers;
  initialStatus: "DRAFT" | "FINALIZED";
  initialVersion: number;
  persistedVisualOptions: PersistedVisualOption[];
  /** Caminho de retorno do portal, para a revisão poder voltar. */
  backHref?: string;
};

/**
 * FASE 4A — o briefing guiado.
 *
 * O que mudou face à versão anterior, e porquê:
 *
 *  · o progresso passou a contar só perguntas APLICÁVEIS e diz o que falta de
 *    verdade, em vez de "N de 25 respondidas" com perguntas condicionais
 *    contando para sempre;
 *  · o autosave deixou de gravar a cada tecla;
 *  · existem os tipos que faltavam (escala, upload, áudio, grupos, ambientes);
 *  · a revisão mostra o que ficou por responder, com ligação directa à etapa.
 *
 * O componente NÃO calcula progresso: pede a `computeBriefingProgress`, o mesmo
 * que o servidor usa. Dois cálculos dariam dois números.
 */
export function GuidedBriefing({
  projectId,
  accessToken,
  initialResponses,
  initialStatus,
  initialVersion,
  persistedVisualOptions,
  backHref,
}: Props) {
  const [answers, setAnswers] = useState<StoredAnswers>(initialResponses);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [status, setStatus] = useState(initialStatus);
  const [revisando, setRevisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const gravar = async (proximo: StoredAnswers) => {
    try {
      if (accessToken) await saveBriefingTokenAction(accessToken, { responses: proximo });
      else await saveBriefingAction(projectId, { responses: proximo });
      return true;
    } catch {
      // O texto continua no estado do browser: falhou o GUARDO, não o
      // preenchimento. Dizer "perdido" seria mentira.
      return false;
    }
  };

  const { agendar, estado, gravarAgora } = useDebouncedSave(gravar);

  const progress = useMemo(
    () => computeBriefingProgress(answers, allBriefingQuestions, briefingSections),
    [answers],
  );

  const contexto = (questionId: string) => answers[questionId]?.value;

  function update(questionId: string, value: unknown) {
    if (status === "FINALIZED") return;
    const proximo = { ...answers, [questionId]: resposta(value) };
    setAnswers(proximo);
    agendar(proximo);
  }

  const secao = briefingSections[sectionIndex];
  const visiveis = secao.questions.filter((pergunta) => meetsAll(pergunta.showIf, contexto));

  async function confirmar() {
    setEnviando(true);
    setErroEnvio(null);
    // Garante que a última escrita chega antes de finalizar: finalizar com a
    // última resposta por enviar produzia um briefing confirmado incompleto.
    await gravarAgora();
    try {
      if (accessToken) await finishBriefingTokenAction(accessToken);
      else await finishBriefingAction(projectId);
      setStatus("FINALIZED");
    } catch (falha) {
      setErroEnvio(falha instanceof Error ? falha.message : "Não foi possível confirmar.");
    } finally {
      setEnviando(false);
    }
  }

  if (revisando) {
    return (
      <Review
        answers={answers}
        progresso={progress}
        onVoltar={() => setRevisando(false)}
        onConfirmar={() => void confirmar()}
        enviando={enviando}
        erro={erroEnvio}
        backHref={backHref}
      />
    );
}
const finalizado = status === "FINALIZED";

  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">ArqVértice</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            {finalizado ? "Briefing enviado" : "Vamos construir esse projeto juntos"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {finalizado
              ? "O estúdio já recebeu as suas respostas. Se algo estiver errado, peça para reabrir."
              : "Responda no seu ritmo. As respostas são guardadas sozinhas."}
          </p>
        </div>
        <EstadoSave estado={estado} />
      </header>

      {!finalizado ? (
        <div className="mt-6">
          <div className="flex items-baseline justify-between text-xs font-semibold text-slate-600">
            <span>
              {progress.requiredPending > 0
                ? `Faltam ${progress.requiredPending} pergunta(s) obrigatória(s)`
                : "Obrigatórias completas"}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
            aria-label="Progresso do briefing"
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width]"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {progress.applicable} pergunta(s) aplicáveis a si
            {progress.notApplicable > 0 ? ` · ${progress.notApplicable} não se aplicam` : ""}
            {progress.optionalPending > 0 ? ` · ${progress.optionalPending} opcionais por responder` : ""}
          </p>
        </div>
      ) : null}

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Etapas do briefing">
        {briefingSections.map((item, index) => {
          const etapa = progress.sections.find((row) => row.id === item.id);
          const percent = etapa?.percent ?? 100;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSectionIndex(index)}
              aria-current={index === sectionIndex ? "step" : undefined}
              className={`min-h-11 min-w-max rounded-full px-4 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-500 ${
                index === sectionIndex
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {item.step}. {item.title}
              {percent < 100 ? <span className="ml-1 opacity-70">{percent}%</span> : null}
            </button>
          );
        })}
      </nav>

      <section className="surface mt-4 rounded-3xl p-5 sm:p-8">
        <p className="text-sm font-semibold text-blue-600">
          Etapa {secao.step} de {briefingSections.length}
        </p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">{secao.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{secao.summary}</p>

        <div className="mt-8 space-y-8">
          {visiveis.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nada a perguntar nesta etapa, com o que respondeu até aqui.
            </p>
          ) : (
            visiveis.map((pergunta) => (
              <AnswerField
                key={pergunta.id}
                question={pergunta}
                answers={answers}
                disabled={finalizado}
                visualOptions={persistedVisualOptions}
                projectId={projectId}
                token={accessToken}
                onChange={update}
              />
            ))
          )}
        </div>

        {!finalizado ? (
          <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              disabled={sectionIndex === 0}
              onClick={() => setSectionIndex((index) => Math.max(0, index - 1))}
              className="min-h-12 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 disabled:opacity-40"
            >
              Etapa anterior
            </button>
            {sectionIndex < briefingSections.length - 1 ? (
              <button
                type="button"
                onClick={() => setSectionIndex((index) => index + 1)}
                className="min-h-12 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Próxima etapa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRevisando(true)}
                className="min-h-12 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
              >
                Revisar respostas
              </button>
            )}
          </div>
        ) : null}
      </section>

      {backHref ? (
        <p className="mt-6 text-xs text-slate-400">
          <a href={backHref} className="font-semibold text-blue-600">
            ← Voltar
          </a>
        </p>
      ) : null}
    </div>
  );
}

function EstadoSave({ estado }: { estado: SaveState }) {
  const mensagens: Record<SaveState, string> = {
    inactivo: "Tudo guardado",
    a_gravar: "A guardar…",
    guardado: "Guardado",
    falhou: "Não foi possível guardar. As respostas continuam aqui; tente novamente.",
  };
  return (
    <p
      role="status"
      className={`max-w-xs text-right text-xs ${
        estado === "falhou" ? "font-semibold text-rose-700" : "text-slate-400"
      }`}
    >
      {mensagens[estado]}
    </p>
  );
}

/**
 * Revisão final.
 *
 * Mostra o que ficou por responder com ligação directa à etapa, porque é inútil
 * dizer "faltam 3" sem dizer quais. O botão de enviar avisa das obrigatórias em
 * falta — mas NÃO impede: o enunciante é claro que uma opcional vazia não pode
 * travar o cliente.
 */
function Review({
  answers,
  progresso,
  onVoltar,
  onConfirmar,
  enviando,
  erro,
  backHref,
}: {
  answers: StoredAnswers;
  progresso: ReturnType<typeof computeBriefingProgress>;
  onVoltar: () => void;
  onConfirmar: () => void;
  enviando: boolean;
  erro: string | null;
  backHref?: string;
}) {
  const contexto = (questionId: string) => answers[questionId]?.value;
  const respondidas = (questionId: string) => formatAnswer(contexto(questionId));

  const pendentes = briefingSections.flatMap((secao) =>
    secao.questions
      .filter((pergunta) => meetsAll(pergunta.showIf, contexto))
      .filter((pergunta) => pergunta.required && !respondidas(pergunta.id))
      .map((pergunta) => ({ secao, pergunta })),
  );

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 sm:p-8">
      <p className="text-sm font-semibold text-blue-600">Última etapa</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">Reveja antes de enviar</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Confira o que respondeu. Pode voltar a qualquer etapa para corrigir.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-emerald-50 p-4">
          <strong className="block text-xl text-emerald-800">{progresso.percent}%</strong>
          <span className="text-xs text-emerald-700">preenchido</span>
        </div>
        <div className="rounded-2xl bg-amber-50 p-4">
          <strong className="block text-xl text-amber-800">{progresso.requiredPending}</strong>
          <span className="text-xs text-amber-700">obrigatórias em falta</span>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <strong className="block text-xl text-slate-800">{progresso.optionalPending}</strong>
          <span className="text-xs text-slate-500">opcionais em falta</span>
        </div>
      </div>

      {pendentes.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Falta responder</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {pendentes.map(({ secao, pergunta }) => (
              <li key={pergunta.id}>
                <span className="font-semibold">{secao.title}:</span> {pergunta.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {briefingSections.map((secao) => {
          const respondidasNaSecao = secao.questions
            .filter((pergunta) => meetsAll(pergunta.showIf, contexto))
            .filter((pergunta) => respondidas(pergunta.id));
          return (
            <div key={secao.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">
                  {secao.step}. {secao.title}
                </span>
                <span className="text-xs text-slate-500">{respondidasNaSecao.length}</span>
              </div>
              {respondidasNaSecao.length > 0 ? (
                <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {respondidasNaSecao.map((pergunta) => (
                    <div key={pergunta.id}>
                      <dt className="text-xs text-slate-400">{pergunta.text}</dt>
                      <dd className="text-sm leading-6 text-slate-700">
                        {respondidas(pergunta.id)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Nada respondido nesta etapa.</p>
              )}
            </div>
          );
        })}
      </div>

      {erro ? <p className="mt-4 text-sm font-semibold text-rose-700">{erro}</p> : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onVoltar}
          className="min-h-12 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
        >
          Voltar às respostas
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={onConfirmar}
          className="min-h-12 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {enviando ? "A enviar…" : "Enviar briefing"}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Pode enviar mesmo com opcionais em falta — só as obrigatórias em falta
        ficam assinaladas acima.
      </p>

      {backHref ? (
        <p className="mt-6 text-xs text-slate-400">
          <a href={backHref} className="font-semibold text-blue-600">
            ← Voltar
          </a>
        </p>
      ) : null}
    </div>
  );
}
