"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveProposalVersionAction, getProposalReadinessAction } from "@/app/actions/domain-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DISCIPLINES } from "@/lib/commercial-scope";
import { computeTotals, type ProposalItem } from "@/lib/proposal-item";
import { formatCurrencyBRL } from "@/lib/contract-template";
import type { ReadinessIssue } from "@/lib/proposal-readiness";

/**
 * FASE 4C — O EDITOR DA PROPOSTA.
 *
 * A mudança estrutural face ao editor anterior é esta: **o editor não calcula
 * valores, apresenta-os.**
 *
 * Antes, o componente fazia `services.reduce(...)` e `subtotal + adjustment` no
 * React e enviava o resultado. O item 19 proíbe isso, e com razão: um total
 * calculado no cliente é um total que o cliente controla. Além disso, o editor
 * antigo aceitava texto livre no lugar do serviço do catálogo — não havia
 * `serviceId`, não havia `unitPrice`, e portanto não havia forma de congelar o
 * preço (item 24).
 *
 * Agora `computeTotals` (do módulo partilhado) é usado APENAS para pré-visualizar
 * enquanto o ADMIN escreve, e o servidor recalcula tudo no `saveProposalVersion`.
 * Se as duas contas divergissem, o número mostrado mentiria; por isso ambas usam
 * a MESMA função, e o valor gravado é o do servidor.
 */

type Slide = { title: string; body: string };

type EditorLine = {
  serviceId: string;
  name: string;
  discipline: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  optional: boolean;
  notes: string;
};

/** Serviço do catálogo tal como o editor precisa de o mostrar. */
export type CatalogOption = {
  id: string;
  name: string;
  discipline: string;
  unit: string;
  baseMedium: number;
  scope?: string | null;
  exclusions?: string | null;
};

/** Sugestão vinda do `PROJECT_COMMERCIAL_INPUT` (item 5). */
export type SuggestionOption = {
  serviceId: string;
  name: string;
  discipline: string;
  unit: string;
  basePrice: number;
  suggestedQuantity: number | null;
  reason: string;
};

export type ProposalEditorData = {
  proposalId: string;
  status: string;
  code: string | null;
  version: number;
  /** A versão aprovada, se já houver. Uma proposta aprovada não aceita edição. */
  approvedVersion: number | null;
  title: string;
  slides: Slide[];
  object: string;
  conditions: string;
  included: string;
  excluded: string;
  /** Premissas e dependências que sustentam o preço (item 27). */
  premisses: string;
  observations: string;
  validityDays: number;
  expiresAt: string;
  paymentTerms: string;
  lines: EditorLine[];
  adjustment: number;
  adjustmentReason: string;
  catalog: CatalogOption[];
  suggestions: SuggestionOption[];
  /** Evidência do prefill: o que veio do projeto e de onde. */
  provenance: Array<{ label: string; value: string }>;
  portfolioOverrides: Record<string, string>;
};

const emptySlide: Slide = { title: "", body: "" };

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** Aceita "1.234,56" e "1234.56". O valor canónico é o número. */
function parseNumber(value: string): number {
  const cleaned = value.trim().replace(/\s/g, "").replace(/R\$/i, "");
  if (!cleaned) return 0;
  // Vírgula é o separador decimal em pt-BR; ponto é separador de milhar.
  const normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number): string {
  return String(value).replace(".", ",");
}

/**
 * Converte as linhas do editor no objecto que o item do proposta valida.
 *
 * `subtotal` NÃO é enviado. É recalculado pelo servidor — ver `normalizeProposalItem`.
 */
function toServerLines(lines: EditorLine[]) {
  return lines
    // Linhas sem nome não são serviços: são uma linha vazia que o ADMIN deixou.
    .filter((line) => line.name.trim().length > 0)
    .map((line, index) => ({
      serviceId: line.serviceId || null,
      name: line.name.trim(),
      discipline: line.discipline || null,
      unit: line.unit || null,
      quantity: parseNumber(line.quantity),
      unitPrice: parseNumber(line.unitPrice),
      optional: line.optional,
      order: index,
      notes: line.notes.trim() || null,
    }));
}

/** Pré-visualização dos totais enquanto o ADMIN escreve. */
function previewTotals(lines: EditorLine[], adjustment: number) {
  const items = toServerLines(lines).map((line, index) =>
    ({
      ...line,
      subtotal: Math.round(line.quantity * line.unitPrice * 100) / 100,
      optional: line.optional ?? false,
      order: index,
      priceOverridden: true,
    }) as ProposalItem,
  );
  return computeTotals(items, adjustment);
}
/* -------------------------------------------------------------------------- */
/* Passos (item 63)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * O editor é organizado em passos, não num formulário único.
 *
 * O item 63 pede exactamente isso, e a razão é operacional: uma proposta tem
 * identidade, escopo, valores, pagamento, prazo, condições e envio. Num único
 * formulário, o ADMIN não sabe se esqueceu o pagamento ou se ele não existe.
 *
 * Os passos são navegáveis livremente (não é um wizard que prende): quem está
 * a corrigir um valor não deve ser obrigado a percorrer tudo para chegar lá.
 */
const STEPS = [
  { key: "IDENTIDADE", label: "Identificação" },
  { key: "SERVICOS", label: "Serviços" },
  { key: "VALORES", label: "Valores" },
  { key: "PAGAMENTO", label: "Pagamento" },
  { key: "PRAZO", label: "Prazo e validade" },
  { key: "CONDICOES", label: "Condições" },
  { key: "APRESENTACAO", label: "Apresentação" },
  { key: "REVISÃO", label: "Revisão" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

function Section({ children }: { children: ReactNode }) {
  return <section className="space-y-4">{children}</section>;
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function ProposalEditor({ initial }: { initial: ProposalEditorData }) {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>("IDENTIDADE");

  const [title, setTitle] = useState(initial.title);
  const [object, setObject] = useState(initial.object);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines);
  const [adjustmentText, setAdjustmentText] = useState(formatNumber(initial.adjustment));
  const [adjustmentReason, setAdjustmentReason] = useState(initial.adjustmentReason);
  const [paymentTerms, setPaymentTerms] = useState(initial.paymentTerms);
  const [validityDays, setValidityDays] = useState(String(initial.validityDays || 30));
  const [expiresAt, setExpiresAt] = useState(initial.expiresAt);
  const [conditions, setConditions] = useState(initial.conditions);
  const [included, setIncluded] = useState(initial.included);
  const [excluded, setExcluded] = useState(initial.excluded);
  const [premises, setPremises] = useState(initial.premisses);
  const [observations, setObservations] = useState(initial.observations);
  const [slides, setSlides] = useState<Slide[]>(initial.slides.length ? initial.slides : [emptySlide]);

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [readiness, setReadiness] = useState<ReadinessIssue[]>([]);

  const adjustment = parseNumber(adjustmentText);
  const totals = useMemo(() => previewTotals(lines, adjustment), [lines, adjustment]);
  const frozen = initial.status === "APPROVED" || initial.status === "CONVERTED" || initial.status === "CANCELLED";

  function updateLine(index: number, patch: Partial<EditorLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  /**
   * Escolher um serviço do catálogo preenche nome, disciplina, unidade e preço.
   *
   * O preço vem do catálogo — nunca é escrito à mão por omissão. O ADMIN pode
   * alterá-lo, e a linha fica marcada como ajuste; mas o caminho normal é o do
   * catálogo, que é o que garante o item 24 (o preço fica congelado e
   * rastreável na versão).
   */
  function pickService(index: number, serviceId: string) {
    const service = initial.catalog.find((item) => item.id === serviceId);
    if (!service) {
      updateLine(index, { serviceId: "" });
      return;
    }
    updateLine(index, {
      serviceId: service.id,
      name: service.name,
      discipline: service.discipline,
      unit: service.unit,
      unitPrice: formatNumber(service.baseMedium),
    });
  }

  /** Adiciona uma linha a partir de uma sugestão vinda do projeto. */
  function addSuggestion(suggestion: SuggestionOption) {
    setLines((current) => [
      ...current,
      {
        serviceId: suggestion.serviceId,
        name: suggestion.name,
        discipline: suggestion.discipline,
        unit: suggestion.unit,
        quantity: formatNumber(suggestion.suggestedQuantity ?? 1),
        unitPrice: formatNumber(suggestion.basePrice),
        optional: false,
        notes: "",
      },
    ]);
}

  /** Linha em branco para serviço fora do catálogo. */
  function addFreeLine() {
    setLines((current) => [
      ...current,
      { serviceId: "", name: "", discipline: "", unit: "un.", quantity: "1", unitPrice: "0", optional: false, notes: "" },
    ]);
  }

  async function save() {
    setStatus("saving");
    setErrorMessage("");
    try {
      const result = await saveProposalVersionAction(initial.proposalId, {
        title: title.trim() || "Proposta comercial",
        presentation: {
          slides: slides.map((slide) => ({ title: slide.title.trim(), body: slide.body.trim() })),
          portfolioOverrides: initial.portfolioOverrides,
        },
        formalText: {
          object: object.trim(),
          conditions: conditions.trim() || null,
          included: included.trim() || null,
          excluded: excluded.trim() || null,
          premisses: premises.trim() || null,
          observations: observations.trim() || null,
          validityDays: Number(validityDays) || 30,
        },
        lines: toServerLines(lines),
        adjustment,
        adjustmentReason: adjustmentReason.trim() || null,
        validityDays: Number(validityDays) || 30,
        // Fim do dia: uma proposta que expira às 00:00 de uma segunda-feira
        // seria praticamente inválida durante o fim de semana inteiro.
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`) : null,
        paymentTerms: paymentTerms.trim() || null,
      });
      setReadiness(result.readiness.issues);
      setStatus("saved");
      router.refresh();
    } catch (error) {
      setStatus("error");
      // A mensagem do servidor é a acçãoável: diz o que corrigir, não "algo
      // correu mal". O item 64 exige mensagens claras.
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível guardar a nova versão.");
    }
  }

  async function refreshReadiness() {
    try {
      const result = await getProposalReadinessAction(initial.proposalId);
      setReadiness(result.issues);
    } catch {
      // A leitura da guarda é um conforto, não uma barreira: se falhar, o
      // servidor continua a ser a autoridade e recusa no envio.
    }
  }

  const blockers = readiness.filter((issue) => issue.level === "BLOCKER");
  const warnings = readiness.filter((issue) => issue.level === "WARNING");

  return (
    <div className="space-y-6">
      {/* Identificação permanente: o ADMIN precisa sempre de saber o que edita. */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <strong className="text-sm text-slate-900">{initial.code ?? "Proposta sem código"}</strong>
          <Badge tone={initial.status === "APPROVED" ? "green" : initial.status === "NEGOTIATING" ? "amber" : "blue"}>
            {initial.status} · v{initial.version}
          </Badge>
          {initial.approvedVersion !== null ? (
            <span className="text-xs font-semibold text-emerald-700">versão aprovada: {initial.approvedVersion}</span>
          ) : null}
        </div>
        {frozen ? (
          <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            Proposta aprovada e versão congelada. Qualquer alteração exige uma nova proposta — o que o cliente assinou
            não pode mudar.
          </p>
        ) : null}
      </div>

      <nav aria-label="Passos da proposta" className="flex gap-2 overflow-x-auto pb-1">
        {STEPS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setStep(entry.key)}
            aria-current={step === entry.key ? "page" : undefined}
            className={`min-w-max rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
              step === entry.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      {step === "IDENTIDADE" ? (
        <Section>
          <h3 className="font-semibold text-slate-900">1 · Identificação</h3>
          {initial.provenance.length ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h4 className="text-sm font-semibold text-blue-900">Preenchido a partir do projeto</h4>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                Estes dados vieram do projeto e do briefing. Nenhum serviço foi incluído sozinho: a seleção é
                comercial.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-blue-900">
                {initial.provenance.map((entry) => (
                  <li key={`${entry.label}-${entry.value}`}>
                    <span className="font-semibold">{entry.label}:</span> {entry.value}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Field label="Título da proposta" htmlFor="proposal-title">
            <input id="proposal-title" className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field
            label="Objeto da proposta"
            hint="Aparece no documento formal e na mensagem ao cliente."
            htmlFor="proposal-object"
          >
            <input
              id="proposal-object"
              className={inputClass}
              value={object}
              onChange={(event) => setObject(event.target.value)}
            />
          </Field>
        </Section>
      ) : null}
      {step === "SERVICOS" ? (
        <Section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">2 · Serviços</h3>
            <Button variant="secondary" onClick={addFreeLine}>
              Adicionar serviço fora do catálogo
            </Button>
          </div>

          {initial.suggestions.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Sugestões para este projeto</h4>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Sugestões, não inclusões. Clique para adicionar — nada entra no total sem a sua decisão.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {initial.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.serviceId}
                    type="button"
                    title={suggestion.reason}
                    onClick={() => addSuggestion(suggestion)}
                    className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    + {suggestion.name}
                    <span className="ml-1 font-normal text-slate-500">
                      ({suggestion.suggestedQuantity !== null ? `${suggestion.suggestedQuantity} × ` : ""}
                      {formatCurrencyBRL(suggestion.basePrice)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            {lines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Nenhum serviço na proposta. Escolha uma sugestão acima ou adicione um serviço.
              </p>
            ) : null}
            {lines.map((line, index) => {
              const subtotal = parseNumber(line.quantity) * parseNumber(line.unitPrice);
              return (
                <div key={`line-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
                    <div>
                      <label htmlFor={`line-service-${index}`} className="text-xs font-semibold text-slate-600">
                        Serviço
                      </label>
                      <select
                        id={`line-service-${index}`}
                        className={`${inputClass} mt-1`}
                        value={line.serviceId}
                        onChange={(event) => pickService(index, event.target.value)}
                      >
                        <option value="">— fora do catálogo —</option>
                        {initial.catalog.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name} · {service.discipline}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`line-qty-${index}`} className="text-xs font-semibold text-slate-600">
                        Quantidade
                      </label>
                      <input
                        id={`line-qty-${index}`}
                        className={`${inputClass} mt-1`}
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">{line.unit}</p>
                    </div>
                    <div>
                      <label htmlFor={`line-price-${index}`} className="text-xs font-semibold text-slate-600">
                        Preço unitário
                      </label>
                      <input
                        id={`line-price-${index}`}
                        className={`${inputClass} mt-1`}
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="pb-3 text-sm font-bold text-slate-950">{formatCurrencyBRL(subtotal)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={line.optional}
                        onChange={(event) => updateLine(index, { optional: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Serviço opcional (não entra no total)
                    </label>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-700"
                      onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    >
                      Remover
                    </button>
                  </div>
                  {line.optional ? (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      Opcional: aparece como opção, mas não entra no valor total nem nas parcelas.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}
      {step === "VALORES" ? (
        <Section>
          <h3 className="font-semibold text-slate-900">3 · Valores</h3>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Subtotal dos serviços contratados</span>
              <strong>{formatCurrencyBRL(totals.contractedSubtotal)}</strong>
            </div>
            {totals.optionalSubtotal > 0 ? (
              <div className="mt-2 flex items-center justify-between text-sm text-amber-700">
                <span>Serviços opcionais (fora do total)</span>
                <strong>{formatCurrencyBRL(totals.optionalSubtotal)}</strong>
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Desconto (−) ou acréscimo (+)" hint="Valor absoluto. Negativo é desconto." htmlFor="proposal-adjustment">
                <input
                  id="proposal-adjustment"
                  className={inputClass}
                  inputMode="decimal"
                  value={adjustmentText}
                  onChange={(event) => setAdjustmentText(event.target.value)}
                />
              </Field>
              {adjustment < 0 ? (
                <Field
                  label="Motivo do desconto"
                  hint="Obrigatório: fica registrado na auditoria."
                  htmlFor="proposal-adjustment-reason"
                >
                  <input
                    id="proposal-adjustment-reason"
                    className={inputClass}
                    value={adjustmentReason}
                    onChange={(event) => setAdjustmentReason(event.target.value)}
                  />
                </Field>
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-950">
              <span>Total da proposta</span>
              <span>{formatCurrencyBRL(totals.total)}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Pré-visualização. O valor gravado é recalculado pelo servidor a partir das linhas — é esse que aparece no
              preview, no PDF e no contrato.
            </p>
          </div>
        </Section>
      ) : null}

      {step === "PAGAMENTO" ? (
        <Section>
          <h3 className="font-semibold text-slate-900">4 · Condição de pagamento</h3>
          <Field
            label="Parcelas"
            hint='Ex.: "40% assinatura, 30% anteprojeto, 30% entrega". Os percentuais têm de somar 100%.'
            htmlFor="proposal-payment"
          >
            <input
              id="proposal-payment"
              className={inputClass}
              value={paymentTerms}
              onChange={(event) => setPaymentTerms(event.target.value)}
            />
          </Field>
          <p className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            O plano é calculado e <strong>congelado</strong> no momento em que guarda a versão. A partir daí, o valor
            das parcelas que o cliente vê é exactamente o que o contrato vai assumir — mesmo que este texto seja
            reescrito depois.
          </p>
        </Section>
      ) : null}

      {step === "PRAZO" ? (
        <Section>
          <h3 className="font-semibold text-slate-900">5 · Prazo e validade</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Validade (dias)" htmlFor="proposal-validity">
              <input
                id="proposal-validity"
                className={inputClass}
                inputMode="numeric"
                value={validityDays}
                onChange={(event) => setValidityDays(event.target.value)}
              />
            </Field>
            <Field
              label="Expira em"
              hint="Depois desta data, o cliente não consegue aprovar."
              htmlFor="proposal-expires"
            >
              <input
                id="proposal-expires"
                type="date"
                className={inputClass}
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </Field>
          </div>
        </Section>
      ) : null}
      {step === "CONDICOES" ? (
        <Section>
          <h3 className="font-semibold text-slate-900">6 · Escopo e condições</h3>
          <Field label="Incluído" hint="O que está dentro do valor contratado." htmlFor="proposal-included">
            <textarea
              id="proposal-included"
              className={`${inputClass} min-h-24 py-2`}
              value={included}
              onChange={(event) => setIncluded(event.target.value)}
            />
          </Field>
          <Field
            label="Não incluído"
            hint="O que fica fora: taxas, projectos complementares, obras."
            htmlFor="proposal-excluded"
          >
            <textarea
              id="proposal-excluded"
              className={`${inputClass} min-h-24 py-2`}
              value={excluded}
              onChange={(event) => setExcluded(event.target.value)}
            />
          </Field>
          <Field
            label="Premissas"
            hint="Dependências e informações consideradas para o preço valer."
            htmlFor="proposal-premises"
          >
            <textarea
              id="proposal-premises"
              className={`${inputClass} min-h-24 py-2`}
              value={premises}
              onChange={(event) => setPremises(event.target.value)}
            />
          </Field>
          <Field label="Condições" htmlFor="proposal-conditions">
            <textarea
              id="proposal-conditions"
              className={`${inputClass} min-h-20 py-2`}
              value={conditions}
              onChange={(event) => setConditions(event.target.value)}
            />
          </Field>
          <Field label="Observações" htmlFor="proposal-observations">
            <textarea
              id="proposal-observations"
              className={`${inputClass} min-h-20 py-2`}
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
            />
          </Field>
        </Section>
      ) : null}

      {step === "APRESENTACAO" ? (
        <Section>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">7 · Apresentação</h3>
            <Button variant="secondary" onClick={() => setSlides((current) => [...current, emptySlide])}>
              Adicionar slide
            </Button>
          </div>
          <div className="space-y-3">
            {slides.map((slide, index) => (
              <div key={`slide-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label htmlFor={`slide-title-${index}`} className="text-xs font-semibold text-slate-600">
                  Título do slide {index + 1}
                </label>
                <input
                  id={`slide-title-${index}`}
                  className={`${inputClass} mt-1`}
                  value={slide.title}
                  onChange={(event) =>
                    setSlides((current) => current.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)))
                  }
                />
                <label htmlFor={`slide-body-${index}`} className="mt-3 block text-xs font-semibold text-slate-600">
                  Texto
                </label>
                <textarea
                  id={`slide-body-${index}`}
                  className={`${inputClass} mt-1 min-h-20 py-2`}
                  value={slide.body}
                  onChange={(event) =>
                    setSlides((current) => current.map((item, i) => (i === index ? { ...item, body: event.target.value } : item)))
                  }
                />
                {slides.length > 1 ? (
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-rose-700"
                    onClick={() => setSlides((current) => current.filter((_, i) => i !== index))}
                  >
                    Remover slide
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}
      {step === "REVISÃO" ? (
        <Section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">8 · Revisão e gravação</h3>
            <Button variant="secondary" onClick={refreshReadiness}>
              Verificar o que falta para enviar
            </Button>
          </div>

          {blockers.length ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <h4 className="text-sm font-semibold text-rose-900">Impedem o envio</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-800">
                {blockers.map((issue) => (
                  <li key={issue.code}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {warnings.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="text-sm font-semibold text-amber-900">Avisos</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
                {warnings.map((issue) => (
                  <li key={issue.code}>{issue.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Subtotal contratado</span>
              <strong>{formatCurrencyBRL(totals.contractedSubtotal)}</strong>
            </div>
            {totals.adjustment !== 0 ? (
              <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                <span>{totals.adjustment < 0 ? "Desconto" : "Acréscimo"}</span>
                <strong>{formatCurrencyBRL(totals.adjustment)}</strong>
              </div>
            ) : null}
            {totals.optionalSubtotal > 0 ? (
              <div className="mt-2 flex items-center justify-between text-sm text-amber-700">
                <span>Opcionais (não contratados)</span>
                <strong>{formatCurrencyBRL(totals.optionalSubtotal)}</strong>
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-950">
              <span>Total</span>
              <span>{formatCurrencyBRL(totals.total)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={status === "saving" || frozen}>
              {status === "saving" ? "Gravando…" : "Guardar nova versão"}
            </Button>
            {status === "saved" ? (
              <span className="text-sm font-semibold text-emerald-700">Nova versão criada.</span>
            ) : null}
          </div>
          {status === "error" ? (
            <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">
              {errorMessage}
            </p>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}

