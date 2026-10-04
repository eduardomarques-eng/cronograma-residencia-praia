"use client";

import { ANSWER_KIND, type BriefingQuestion } from "@/lib/briefing-schema";
import type { StoredAnswers } from "@/lib/briefing-answers";
import {
  ImageChoice,
  MediaField,
  NumberInput,
  RepeatGroup,
  SingleSelect,
  SliderField,
  TextInput,
  MultiSelect,
  YesNo,
  EnvironmentGroup,
} from "./answer-parts";

/**
 * Renderiza UMA pergunta, conforme o tipo declarado.
 *
 * Um `switch` por tipo é o que permite acrescentar um tipo novo sem reescrever
 * o briefing: entra aqui um `case` e a pergunta passa a poder usá-lo. Nenhuma
 * pergunta carrega lógica de renderização própria.
 */
export function AnswerField({
  question,
  answers,
  disabled,
  visualOptions,
  projectId,
  token,
  onChange,
}: {
  question: BriefingQuestion;
  answers: StoredAnswers;
  disabled: boolean;
  /** Imagens persistidas pelo ADMIN para as perguntas visuais. */
  visualOptions?: {
    questionId: string;
    value: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    altText: string | null;
  }[];
  /** Só para o upload multimídia decidir entre sessão e link público. */
  projectId?: string;
  token?: string;
  onChange: (questionId: string, value: unknown) => void;
}) {
  const entry = answers[question.id];
  const value = entry?.value;
  const set = (next: unknown) => onChange(question.id, next);

  const label = (
    <span className="block text-base font-semibold leading-6 text-slate-900">
      {question.text}
      {question.required ? <span className="ml-1 text-rose-600">*</span> : null}
    </span>
  );
  const hint = question.hint ? <p className="mt-1 text-xs text-slate-500">{question.hint}</p> : null;

  const text = (type: "text" | "date" | "email" | "tel") => (
    <TextInput
      id={question.id}
      label={label}
      hint={hint}
      type={type}
      value={typeof value === "string" ? value : ""}
      placeholder={question.placeholder}
      disabled={disabled}
      rows={question.type === ANSWER_KIND.LONG_TEXT ? 4 : 2}
      multiline={question.type === ANSWER_KIND.LONG_TEXT}
      onChange={set}
    />
  );

  switch (question.type) {
    case ANSWER_KIND.LONG_TEXT:
    case ANSWER_KIND.SHORT_TEXT:
      return text("text");
    case ANSWER_KIND.DATE:
      return text("date");
    case ANSWER_KIND.EMAIL:
      return text("email");
    case ANSWER_KIND.PHONE:
      return text("tel");
    case ANSWER_KIND.NUMBER:
    case ANSWER_KIND.MONEY:
      return (
        <NumberInput
          id={question.id}
          label={label}
          hint={hint}
          value={typeof value === "number" ? value : null}
          disabled={disabled}
          onChange={set}
        />
      );
    case ANSWER_KIND.BOOLEAN:
      return (
        <YesNo
          id={question.id}
          label={label}
          hint={hint}
          value={typeof value === "string" ? value : null}
          disabled={disabled}
          onChange={set}
        />
      );
    case ANSWER_KIND.SINGLE_SELECT:
      return (
        <SingleSelect
          id={question.id}
          label={label}
          hint={hint}
          options={question.options ?? []}
          value={typeof value === "string" ? value : null}
          disabled={disabled}
          onChange={set}
        />
      );
    case ANSWER_KIND.MULTI_SELECT:
      return (
        <MultiSelect
          id={question.id}
          label={label}
          hint={hint}
          options={question.options ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          disabled={disabled}
          onChange={set}
        />
      );
    case ANSWER_KIND.SLIDER:
    case ANSWER_KIND.SCALE:
      return (
        <SliderField
          id={question.id}
          label={label}
          hint={hint}
          scale={question.scale ?? { min: -5, max: 5, leftLabel: "Menos", rightLabel: "Mais" }}
          value={typeof value === "number" ? value : null}
          disabled={disabled}
          onChange={set}
        />
      );
    case ANSWER_KIND.IMAGE_CHOICE:
      return (
        <ImageChoice
          id={question.id}
          label={label}
          hint={hint}
          options={question.visualOptions ?? question.options ?? []}
          persisted={visualOptions?.filter((option) => option.questionId === question.id) ?? []}
          value={Array.isArray(value) ? (value as string[]) : []}
          disabled={disabled}
          onChange={set}
        />
      );
    case ANSWER_KIND.IMAGE_UPLOAD:
    case ANSWER_KIND.FILE:
    case ANSWER_KIND.AUDIO:
      return (
        <MediaField
          id={question.id}
          label={label}
          hint={hint}
          kind={question.type}
          category={question.referenceCategory ?? "REFERENCIA"}
          disabled={disabled}
          projectId={projectId}
          token={token}
        />
      );
    case ANSWER_KIND.REPEAT_GROUP:
      return (
        <RepeatGroup
          id={question.id}
          label={label}
          hint={hint}
          value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
          disabled={disabled}
          onChange={set}
        />
      );
    case ANSWER_KIND.ENVIRONMENT_GROUP:
      return (
        <EnvironmentGroup
          id={question.id}
          label={label}
          hint={hint}
          value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
          disabled={disabled}
          onChange={set}
        />
      );
    default:
      // Um tipo novo a cair aqui é erro de configuração, não um campo vazio que
      // o cliente ache que preencheu.
      return (
        <p className="mt-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tipo de resposta não suportado: {question.type}.
        </p>
      );
  }
}