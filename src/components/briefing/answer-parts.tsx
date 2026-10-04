"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChangeEvent } from "react";
import { ANSWER_KIND, type BriefingOption, type BriefingScale } from "@/lib/briefing-schema";
import { uploadBriefingMedia } from "@/app/actions/briefing-media-actions";

/**
 * Tópico 4A — os campos de resposta.
 *
 * Separados do `AnswerField` para cada um ficar legível: o despachante decide o
 * TIPO, estes decidem como se escreve. Todos partilham as mesmas regras de
 * acessibilidade — `label` associado, alvo com 44px de altura mínima e estado
 * `disabled` a sério, não só a cor.
 */

type FieldProps = { id: string; label: ReactNode; hint: ReactNode; disabled: boolean };

const INPUT =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500";

const SELECTED = "bg-slate-900 text-white";
const UNSELECTED = "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50";

export function TextInput({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
  type = "text",
  rows = 2,
  multiline = false,
  placeholder,
}: FieldProps & {
  value: string;
  onChange: (value: unknown) => void;
  type?: "text" | "date" | "email" | "tel";
  rows?: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {hint}
      {multiline ? (
        <textarea
          id={id}
          rows={rows}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${INPUT} mt-2 resize-y`}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${INPUT} mt-2 min-h-11`}
        />
      )}
    </div>
  );
}

/** Número com vírgula aceite: `1.200,5` não pode devolver `NaN` ao cliente. */
export function NumberInput({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
}: FieldProps & { value: number | null; onChange: (value: unknown) => void }) {
  const [texto, setTexto] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setTexto(value === null ? "" : String(value));
  }, [value]);

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {hint}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={texto}
        disabled={disabled}
        onChange={(event) => {
          setTexto(event.target.value);
          // Vazio é `null` (não respondido), não zero: distingue "não sei" de "zero".
          if (event.target.value.trim() === "") {
            onChange(null);
            return;
          }
          const normalizado = event.target.value
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(/[^\d.-]/g, "");
          const numero = Number(normalizado);
          onChange(Number.isFinite(numero) ? numero : null);
        }}
        className={`${INPUT} mt-2 min-h-11`}
      />
    </div>
  );
}

export function YesNo({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
}: FieldProps & { value: string | null; onChange: (value: unknown) => void }) {
  const opcoes = [
    { value: "true", label: "Sim" },
    { value: "false", label: "Não" },
    { value: "nao_sei", label: "Ainda não sei" },
  ];
  return (
    <fieldset id={id} disabled={disabled}>
      <span className="block text-base font-semibold leading-6 text-slate-900">{label}</span>
      {hint}
      <div className="mt-2 flex flex-wrap gap-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao.value}
            type="button"
            aria-pressed={value === opcao.value}
            onClick={() => onChange(opcao.value)}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              value === opcao.value ? SELECTED : UNSELECTED
            }`}
          >
            {opcao.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SingleSelect({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  disabled,
}: FieldProps & {
  options: BriefingOption[];
  value: string | null;
  onChange: (value: unknown) => void;
}) {
  return (
    <fieldset id={id} disabled={disabled}>
      <span className="block text-base font-semibold leading-6 text-slate-900">{label}</span>
      {hint}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
              value === option.value ? SELECTED : UNSELECTED
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function MultiSelect({
  id,
  label,
  hint,
  options,
  value,
  onChange,
  disabled,
}: FieldProps & {
  options: BriefingOption[];
  value: string[];
  onChange: (value: unknown) => void;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }
  return (
    <fieldset id={id} disabled={disabled}>
      <span className="block text-base font-semibold leading-6 text-slate-900">{label}</span>
      {hint}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const marcada = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={marcada}
              onClick={() => toggle(option.value)}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
                marcada ? SELECTED : UNSELECTED
              }`}
            >
              {marcada ? "✓ " : ""}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Escala de percepção: dois extremos rotulados.
 *
 * Guardamos o NÚMERO, não o rótulo escolhido. Uma preferência não vira decisão
 * de projeto sozinha — e quando o cliente volta a mexer na escala, o valor
 * anterior é substituído, não acumulado.
 */
export function SliderField({
  id,
  label,
  hint,
  scale,
  value,
  onChange,
  disabled,
}: FieldProps & {
  scale: BriefingScale;
  value: number | null;
  onChange: (value: unknown) => void;
}) {
  const [interno, setInterno] = useState<number | null>(value);
  useEffect(() => setInterno(value), [value]);
  const actual = interno ?? 0;
  const direcao =
    interno === null || interno === 0
      ? "no meio"
      : interno > 0
        ? `mais para ${scale.rightLabel.toLowerCase()}`
        : `mais para ${scale.leftLabel.toLowerCase()}`;

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {hint}
      <div className="mt-3 flex items-center gap-3">
        <span className="w-28 shrink-0 text-xs font-semibold text-slate-600">{scale.leftLabel}</span>
        <input
          id={id}
          type="range"
          min={scale.min}
          max={scale.max}
          step={1}
          value={actual}
          disabled={disabled}
          onChange={(event) => {
            const proximo = Number(event.target.value);
            setInterno(proximo);
            onChange(proximo);
          }}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
        />
        <span className="w-28 shrink-0 text-right text-xs font-semibold text-slate-600">
          {scale.rightLabel}
        </span>
      </div>
      <output htmlFor={id} className="mt-2 block text-xs text-slate-500">
        {value === null ? "Ainda não respondeu." : `${actual}: ${direcao}.`}
      </output>
    </div>
  );
}

/**
 * Escolha visual: as imagens que o ADMIN publicou na pergunta.
 *
 * Cada imagem tem `altText`. Uma opção de imagem sem descrição é um botão sem
 * nome para quem navega por leitor de ecrã — por isso o texto NUNCA vem só da
 * imagem.
 */
export function ImageChoice({
  id,
  label,
  hint,
  options,
  persisted,
  value,
  onChange,
  disabled,
}: FieldProps & {
  options: BriefingOption[];
  persisted: { questionId: string; value: string; title: string; description: string | null; imageUrl: string | null; altText: string | null }[];
  value: string[];
  onChange: (value: unknown) => void;
}) {
  /** As imagens persistidas substituem as do código quando existem. */
  const catalogo = persisted.length
    ? persisted.map((option) => ({
        value: option.value,
        label: option.title,
        description: option.description ?? undefined,
        imageUrl: option.imageUrl,
        altText: option.altText,
      }))
    : options;

  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter((selected) => selected !== item) : [...value, item]);
  }

  return (
    <fieldset id={id} disabled={disabled}>
      <span className="block text-base font-semibold leading-6 text-slate-900">{label}</span>
      {hint}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {catalogo.map((option) => {
          const escolhida = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={escolhida}
              onClick={() => toggle(option.value)}
              className={`overflow-hidden rounded-2xl text-left ring-2 transition ${
                escolhida ? "ring-slate-900" : "ring-transparent hover:ring-slate-300"
              }`}
            >
              {option.imageUrl ? (
                // `loading="lazy"`: a página de referências não deve puxar todas
                // as imagens em resolução total de uma vez. O `next/image` exigiria
                // configurar os domínios no `next.config` para URLs externos.
                <img
                  src={option.imageUrl}
                  alt={option.altText ?? option.label}
                  loading="lazy"
                  decoding="async"
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
                  Sem imagem
                </div>
              )}
              <span className="block bg-white p-3">
                <span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                  {escolhida ? "✓ " : ""}
                  {option.label}
                </span>
                {option.description ? (
                  <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      {catalogo.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">O estúdio ainda não publicou imagens para esta pergunta.</p>
      ) : null}
    </fieldset>
  );
}

/**
 * Grupo repetível genérico: quem usa o espaço, itens a manter, instalações,
 * restrições.
 *
 * O campo de rótulo e os extras são livres; não codificamos uma lista fixa de
 * atributos por tipo de ambiente — o enunciante é explícito sobre não prender o
 * módulo a ambientes residenciais.
 */
export function RepeatGroup({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
}: FieldProps & {
  value: Record<string, unknown>[];
  onChange: (value: unknown) => void;
}) {
  const campos = ["label", "detail", "note"];

  function actualizar(indice: number, campo: string, novo: string) {
    onChange(
      value.map((item, position) =>
        position === indice ? { ...item, [campo]: novo } : item,
      ),
    );
  }

  function adicionar() {
    onChange([...value, { id: `${id}-${Date.now()}`, label: "", detail: "", note: "" }]);
  }

  function remover(indice: number) {
    onChange(value.filter((_, position) => position !== indice));
  }

  return (
    <fieldset id={id} disabled={disabled}>
      <span className="block text-base font-semibold leading-6 text-slate-900">{label}</span>
      {hint}
      <div className="mt-3 space-y-3">
        {value.map((item, indice) => (
          <div key={String(item.id ?? indice)} className="rounded-2xl bg-slate-50 p-3">
            {campos.map((campo) => (
              <input
                key={campo}
                type="text"
                value={String(item[campo] ?? "")}
                placeholder={
                  campo === "label" ? "Nome" : campo === "detail" ? "Detalhe" : "Observação"
                }
                aria-label={`${typeof label === "string" ? label : "Item"} ${indice + 1}: ${campo}`}
                disabled={disabled}
                onChange={(event) => actualizar(indice, campo, event.target.value)}
                className={`${INPUT} mb-2 min-h-11 last:mb-0`}
              />
            ))}
            <button
              type="button"
              disabled={disabled}
              onClick={() => remover(indice)}
              className="mt-2 min-h-10 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              Remover
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={adicionar}
        className="mt-3 min-h-11 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      >
        + Adicionar
      </button>
    </fieldset>
  );
}

/**
 * Programa de necessidades: um cartão por ambiente.
 *
 * Este é o bloco que a Fase 4B mais vai usar. Guarda o que o enunciante pede —
 * nome, quantidade, prioridade, área, usuários, função, privacidade,
 * armazenamento, luz natural, ventilação — e deixa as exigências específicas
 * para o campo livre, para o modelo não prender o módulo a ambientes
 * residenciais.
 */
export function EnvironmentGroup({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
}: FieldProps & {
  value: Record<string, unknown>[];
  onChange: (value: unknown) => void;
}) {
  const texto = (indice: number, campo: string, actual: string) => {
    onChange(
      value.map((item, position) =>
        position === indice ? { ...item, [campo]: actual } : item,
      ),
    );
  };

  function adicionar() {
    onChange([
      ...value,
      {
        id: `amb-${Date.now()}-${value.length}`,
        name: "",
        quantity: 1,
        priority: "importante",
        mandatory: false,
        purpose: "",
        users: "",
        privacyNeeded: false,
        storageNeeded: "",
        naturalLightNeeded: false,
        ventilationNeeded: false,
        specialRequirements: "",
      },
    ]);
  }

  const areaDe = (ambiente: Record<string, unknown>) =>
    ambiente.desiredArea === null || ambiente.desiredArea === undefined
      ? ""
      : String(ambiente.desiredArea);

  return (
    <fieldset id={id} disabled={disabled}>
      <span className="block text-base font-semibold leading-6 text-slate-900">{label}</span>
      {hint}
      <div className="mt-3 space-y-3">
        {value.map((ambiente, indice) => (
          <div key={String(ambiente.id ?? indice)} className="rounded-2xl bg-slate-50 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <Campo etiqueta="Nome do ambiente" valor={String(ambiente.name ?? "")} desativado={disabled} onChange={(novo) => texto(indice, "name", novo)} />
              <Campo etiqueta="Quantidade" valor={String(ambiente.quantity ?? 1)} desativado={disabled} onChange={(novo) => texto(indice, "quantity", novo)} />
              <Campo etiqueta="Área aproximada (m²)" valor={areaDe(ambiente)} desativado={disabled} onChange={(novo) => texto(indice, "desiredArea", novo)} />
              <label className="block text-xs font-semibold text-slate-600">
                Prioridade
                <select
                  value={String(ambiente.priority ?? "importante")}
                  disabled={disabled}
                  onChange={(event) => texto(indice, "priority", event.target.value)}
                  className={`${INPUT} mt-1 min-h-11 text-sm`}
                >
                  <option value="essencial">Essencial</option>
                  <option value="importante">Importante</option>
                  <option value="desejavel">Desejável</option>
                  <option value="adiavel">Adiável</option>
                </select>
              </label>
              <Campo etiqueta="Quem usa" valor={String(ambiente.users ?? "")} desativado={disabled} onChange={(novo) => texto(indice, "users", novo)} />
              <Campo etiqueta="Função" valor={String(ambiente.purpose ?? "")} desativado={disabled} onChange={(novo) => texto(indice, "purpose", novo)} />
              <Campo etiqueta="Armazenamento" valor={String(ambiente.storageNeeded ?? "")} desativado={disabled} onChange={(novo) => texto(indice, "storageNeeded", novo)} />
              <Campo etiqueta="Requisitos especiais" valor={String(ambiente.specialRequirements ?? "")} desativado={disabled} onChange={(novo) => texto(indice, "specialRequirements", novo)} />
            </div>
            <Marcas
              ambiente={ambiente}
              desativado={disabled}
              onChange={(campo, marcado) => texto(indice, campo, marcado ? "sim" : "")}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, position) => position !== indice))}
              className="mt-2 min-h-10 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              Remover ambiente
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={adicionar}
        className="mt-3 min-h-11 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      >
        + Adicionar ambiente
      </button>
    </fieldset>
  );
}

const MARCAS = [
  { campo: "mandatory", texto: "Indispensável" },
  { campo: "privacyNeeded", texto: "Precisa de privacidade" },
  { campo: "naturalLightNeeded", texto: "Precisa de luz natural" },
  { campo: "ventilationNeeded", texto: "Precisa de ventilação" },
] as const;

function Marcas({
  ambiente,
  desativado,
  onChange,
}: {
  ambiente: Record<string, unknown>;
  desativado: boolean;
  onChange: (campo: string, marcado: boolean) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-4">
      {MARCAS.map((marca) => (
        <label
          key={marca.campo}
          className="flex min-h-11 items-center gap-2 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            disabled={desativado}
            checked={ambiente[marca.campo] === true || ambiente[marca.campo] === "sim"}
            onChange={(event) => onChange(marca.campo, event.target.checked)}
          />
          {marca.texto}
        </label>
      ))}
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  desativado,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  desativado: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {etiqueta}
      <input
        type="text"
        value={valor}
        disabled={desativado}
        aria-label={etiqueta}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT} mt-1 min-h-11 text-sm`}
      />
    </label>
  );
}

/**
 * Multimédia: upload de imagem/documento e gravação de áudio real.
 *
 * O áudio é gravado com `MediaRecorder` — o que o `VoiceTextarea` antigo não
 * fazia: aquele ditava para texto no browser e perdia o áudio. Aqui o ficheiro
 * vai para o servidor, e a transcrição (quando há provider) é apresentada para
 * o cliente CORRIGIR antes de ser a resposta final.
 */
export function MediaField({
  id,
  label,
  hint,
  kind,
  category,
  disabled,
  projectId,
  token,
}: FieldProps & {
  kind: typeof ANSWER_KIND.IMAGE_UPLOAD | typeof ANSWER_KIND.FILE | typeof ANSWER_KIND.AUDIO;
  category: string;
  projectId?: string;
  token?: string;
}) {
  const [estado, setEstado] = useState<
    "parado" | "a_gravar" | "a_enviar" | "transcrito" | "falhado"
  >("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function enviar(ficheiroEnviado: File) {
    setEstado("a_enviar");
    setErro(null);
    try {
      const resposta = await uploadBriefingMedia({
        projectId,
        token,
        questionId: id,
        category,
        kind,
        file: ficheiroEnviado,
      });
      if (!resposta.ok) {
        setErro(resposta.message);
        setEstado("falhado");
        return;
      }
      setAviso(resposta.message ?? null);
      if (resposta.transcript) {
        setTexto(resposta.transcript);
        setEstado("transcrito");
      } else {
        setEstado("parado");
      }
    } catch {
      setErro("Não foi possível enviar o ficheiro. Tente de novo.");
      setEstado("falhado");
    }
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const escolhido = event.target.files?.[0];
    if (!escolhido) return;
    setFicheiro(escolhido);
    void enviar(escolhido);
  }

  async function gravar() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const gravador = new MediaRecorder(stream);
      const pedacos: Blob[] = [];
      gravador.ondataavailable = (evento) => {
        if (evento.data.size > 0) pedacos.push(evento.data);
      };
      gravador.onstop = () => {
        // Sem isto, o microfone continua ligado depois de gravar.
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(pedacos, { type: gravador.mimeType || "audio/webm" });
        const ficheiroAudio = new File([blob], `resposta-${id}.webm`, { type: blob.type });
        setFicheiro(ficheiroAudio);
        void enviar(ficheiroAudio);
      };
      recorderRef.current = gravador;
      gravador.start();
      setEstado("a_gravar");
    } catch {
      setErro("Não foi possível aceder ao microfone. Pode escrever a resposta.");
      setEstado("falhado");
    }
  }

  // Sair com a gravação aberta deixaria o microfone ligado.
  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const aGravar = estado === "a_gravar";
  const ocupado = estado === "a_enviar" || aGravar;

  return (
    <fieldset id={id} disabled={disabled} className="rounded-2xl bg-slate-50 p-4">
      <span className="block text-base font-semibold leading-6 text-slate-900">{label}</span>
      {hint}

      {kind === ANSWER_KIND.AUDIO ? (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {aGravar ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  recorderRef.current?.stop();
                  recorderRef.current = null;
                }}
                className="min-h-11 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Parar de gravar
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled || ocupado}
                onClick={() => void gravar()}
                className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Gravar resposta
              </button>
            )}
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              Enviar ficheiro de áudio
              <input type="file" accept="audio/*" className="sr-only" disabled={disabled || ocupado} onChange={onPick} />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500" role="status">
            {estado === "a_gravar" && "A gravar. Toque em parar quando terminar."}
            {estado === "a_enviar" && "A enviar o áudio…"}
            {estado === "transcrito" && "Transcrição automática. Corrija o texto: é o que fica como resposta."}
            {estado === "falhado" && "Falhou. Tente de novo ou escreva a resposta."}
          </p>
          <textarea
            rows={4}
            value={texto}
            disabled={disabled}
            aria-label="Texto final da resposta por áudio"
            placeholder="Escreva aqui o que disse, ou corrija a transcrição."
            onChange={(event) => setTexto(event.target.value)}
            className={`${INPUT} mt-3 resize-y`}
          />
        </div>
      ) : (
        <div className="mt-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            Escolher {kind === ANSWER_KIND.FILE ? "documento" : "imagem"}
            <input
              type="file"
              accept={kind === ANSWER_KIND.FILE ? "application/pdf" : "image/*"}
              className="sr-only"
              disabled={disabled || ocupado}
              onChange={onPick}
            />
          </label>
          {estado === "a_enviar" ? (
            <p className="mt-2 text-xs text-slate-500" role="status">A enviar…</p>
          ) : null}
        </div>
      )}

      {aviso ? <p className="mt-2 text-xs text-emerald-700">{aviso}</p> : null}
      {erro ? <p className="mt-2 text-xs font-semibold text-rose-700">{erro}</p> : null}
      {ficheiro ? <p className="mt-2 truncate text-xs text-slate-400">{ficheiro.name}</p> : null}
    </fieldset>
  );
}
