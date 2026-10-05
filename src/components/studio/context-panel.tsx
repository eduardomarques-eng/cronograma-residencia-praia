"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ELEMENTS, elementGroups, elementsForLayout, canAddElement, type ElementKind } from "@/lib/studio-elements";
import { compatibleLayouts, evaluateLayoutChange, insertElement, removeElement, replaceLayout, updateElement, type LayoutChange } from "@/lib/studio-manipulate";
import { getLayout, LAYOUT_CATEGORY, type LayoutKey } from "@/lib/studio-layout";
import { analyzeSlide, type SmartLayoutReport } from "@/lib/studio-smart-layout";
import { auditTheme, getTheme, themePreview, THEME_ORDER, type ThemeKey } from "@/lib/studio-theme";
import { suggestMediaForSlide, type MediaAsset, type MediaSuggestion } from "@/lib/studio-media";
import { describeTarget, resolveTarget, targetText, type AiScope, type AiSelection } from "@/lib/studio-ai";
import { stableId, type StudioDeck, type StudioElement, type StudioSlide, type TextRole } from "@/lib/studio-deck";
import {
  COMMERCIAL_BINDINGS,
  getBinding,
  isCommercialBinding,
  type CommercialBinding,
} from "@/lib/studio-commercial";

/**
 * FASE 4C — O PAINEL CONTEXTUAL (item 9).
 *
 * O item 9 pede "evitar ferramentas excessivas na tela ao mesmo tempo" e
 * "mostrar primeiro as funções principais; funções avançadas aparecem somente
 * quando necessárias". Isso transforma-se numa regra concreta e verificável:
 *
 *  · **Um painel, sempre, com o contexto certo.** Nunca uma barra com vinte
 *    botões. O que aparece depende do que está seleccionado — um elemento, uma
 *    página, ou nada.
 *
 *  · **Um separador deesenvelope.** As funções avançadas (temas, media, auditoria)
 *    só são montadas quando pedidas. Não é umaOptimização: é o que impede a
 *    interface de Lotar-se antes de haver conteúdo para mostrar.
 *
 * A regra estrutural que este painel NÃO pode violar: o `metric` NÃO tem campo
 * de valor. O valor vem do servidor, e um campo editável aqui seria um convite a
 * escrever um preço que o cliente nunca contratou.
 */

type Tab = "elemento" | "pagina" | "tema" | "media" | "avancado";

export type ContextPanelProps = {
  deck: StudioDeck;
  index: number;
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
  onChangeDeck: (next: StudioDeck, label: string) => void;
  onRunAi: (scope: AiScope, selection: AiSelection, instruction: string) => void;
  assets: readonly MediaAsset[];
  aiMessage: string | null;
};

const TABS: Array<{ key: Tab; label: string; help: string }> = [
  { key: "elemento", label: "Elemento", help: "O que está seleccionado." },
  { key: "pagina", label: "Página", help: "Layout, ordem e notas." },
  { key: "tema", label: "Tema", help: "A identidade da apresentação." },
  { key: "media", label: "Imagens", help: "Banco ARQVERTICE e geração." },
  { key: "avancado", label: "Avançado", help: "Auditoria e ajuda." },
];

/** Grupo de campos. Uma secção só aparece quando tem conteúdo. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</h4>
      {children}
    </section>
  );
}

const fieldClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500";
/**
 * Escolha de layout, com a incompatibilidade explicada.
 *
 * Trocar de layout só é seguro quando o novo aceita tudo o que já está na
 * página. Quando não aceita, o painel DIZ O QUÊ vai ser perdido e exige uma
 * confirmação — nunca descarta conteúdo em silêncio, que era o comportamento
 * que o item 10 veio corrigir.
 */
function LayoutPicker({
  slide,
  onPick,
}: {
  slide: StudioSlide;
  onPick: (next: LayoutKey, change: LayoutChange) => void;
}) {
  const options = compatibleLayouts(slide);
  const [pending, setPending] = useState<{ key: LayoutKey; change: LayoutChange } | null>(null);

  if (pending) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs font-semibold text-amber-900">
          Este layout não aceita: {pending.change.incompatible.map((slot) => ELEMENTS[slot as ElementKind]?.label ?? slot).join(", ")}.
        </p>
        <p className="text-xs text-amber-800">{pending.change.warning}</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="min-h-9 px-3 text-xs"
            onClick={() => onPick(pending.key, pending.change)}
          >
            Trocar mesmo assim
          </Button>
          <Button variant="ghost" className="min-h-9 px-3 text-xs" onClick={() => setPending(null)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {options.map((key) => {
        const layout = getLayout(key);
        const change = evaluateLayoutChange(slide, key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => (change.safe ? onPick(key, change) : setPending({ key, change }))}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-slate-50 ${
              slide.layout === key ? "bg-slate-100 font-semibold" : ""
            }`}
          >
            <span>{layout.label}</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{LAYOUT_CATEGORY[key]}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Comandos de IA com âmbito explícito (itens 16 e 17).
 *
 * O âmbito é escolhido pelo ADMIN e mostrado em texto. É o que garante que
 * "mude isto" não altere a apresentação inteira quando o cursor está num
 * parágrafo.
 */
function AiBox({ deck, slide, selectedElementId, onRunAi, message }: {
  deck: StudioDeck;
  slide: StudioSlide;
  selectedElementId: string | null;
  onRunAi: (scope: AiScope, selection: AiSelection, instruction: string) => void;
  message: string | null;
}) {
  const [scope, setScope] = useState<AiScope>(selectedElementId ? "ELEMENTO" : "SLIDE");
  const [instruction, setInstruction] = useState("");

  const selection: AiSelection = selectedElementId
    ? { kind: "ELEMENTO", slideId: slide.id, elementId: selectedElementId }
    : scope === "PRESENTACAO"
      ? { kind: "PRESENTACAO" }
      : { kind: "SLIDE", slideId: slide.id };

  // O âmbito não pode ficar incoerente com a selecção: se não há elemento, o
  // comando de elemento é recusado. É melhor corrigir aqui do que no servidor.
  const effectiveScope: AiScope = scope === "ELEMENTO" && !selectedElementId ? "SLIDE" : scope;
  const target = resolveTarget(deck, selection);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(["ELEMENTO", "SLIDE", "PRESENTACAO"] as AiScope[]).map((key) => {
          const disabled = key === "ELEMENTO" && !selectedElementId;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => setScope(key)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold outline-none disabled:opacity-40 ${
                effectiveScope === key ? "bg-white shadow-sm" : ""
              }`}
            >
              {key === "ELEMENTO" ? "Elemento" : key === "SLIDE" ? "Página" : "Tudo"}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-4 text-slate-500">{describeTarget(target)}</p>

      <textarea
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="Ex.: deixe este texto mais directo e curto."
        aria-label="Instrução para a IA"
        className={`${fieldClass} min-h-20 resize-y`}
      />

      <Button
        className="w-full"
        disabled={instruction.trim().length === 0}
        onClick={() => onRunAi(effectiveScope, selection, instruction.trim())}
      >
        Pedir alteração
      </Button>

      {message ? (
        <p className="rounded-lg bg-slate-50 p-2 text-[11px] leading-4 text-slate-600">{message}</p>
      ) : null}
    </div>
  );
}
/**
 * A fonte escolhida envolve dinheiro?
 *
 * `false` para uma fonte sem ligação: um elemento desligado nunca tem valores
 * financeiros a proteger, e dizer ao ADMIN que tem de editar a proposta para
 * mudar o texto de uma tabela de materiais seria enganador.
 */
function isFinancial(binding: CommercialBinding | null): boolean {
  return binding !== null && getBinding(binding).financial;
}

/**
 * Selector da FONTE COMERCIAL de um elemento (itens 26 a 30).
 *
 * É a peça que transforma a regra comercial numa acção do ADMIN: em vez de
 * escrever "R$ 45.000" numa célula, escolhe-se "Investimento" e o elemento passa
 * a mostrar o que a proposta diz. A diferença não é cosmética — é que a segunda
 * via é um valor que diverge, e a primeira actualiza-se sozinha.
 *
 * "Sem ligação" aparece sempre em primeiro e é a opção por omissão: um
 * comparativo de materiais não tem nada de comercial, e obrigar a escolher uma
 * fonte seria inventar trabalho.
 *
 * Quando o elemento já está ligado, avisa que os valores deixam de ser editáveis.
 * É um aviso, não um bloqueio escondido: o ADMIN tem de saber porque é que as
 * células desapareceram.
 */
function BindingPicker({
  binding,
  financial,
  onChange,
}: {
  binding: CommercialBinding | null;
  /** `true` quando a fonte escolhida envolve dinheiro. */
  financial: boolean;
  onChange: (next: CommercialBinding | null) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">
        Fonte dos dados
        <select
          className={`${fieldClass} mt-1`}
          value={binding ?? ""}
          aria-label="Fonte de dados do elemento"
          onChange={(event) => {
            const next = event.target.value;
            onChange(isCommercialBinding(next) ? next : null);
          }}
        >
          <option value="">Sem ligação — conteúdo do autor</option>
          {COMMERCIAL_BINDINGS.map((entry) => (
            <option key={entry.binding} value={entry.binding}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      {binding ? (
        <p className="rounded-lg bg-blue-50 p-2 text-[11px] leading-4 text-blue-900">
          Os valores vêm da proposta ({COMMERCIAL_BINDINGS.find((entry) => entry.binding === binding)?.purpose.toLowerCase()}).
          {financial
            ? " Para alterar um valor, edite a proposta — é aí que o total e as parcelas são recalculados."
            : ""}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Editor do elemento seleccionado.
 *
 * Cada tipo de elemento tem os SEUS campos — é isto que significa "os cards
 * continuam editáveis" e "as tabelas continuam estruturadas". Não há um
 * textarea genérico que transforme tudo em texto.
 *
 * O `metric` é o caso especial: não tem campo de valor. Ver o cabeçalho.
 */
function ElementEditor({
  element,
  slideIndex,
  deck,
  onChangeDeck,
}: {
  element: StudioElement;
  slideIndex: number;
  deck: StudioDeck;
  onChangeDeck: (next: StudioDeck, label: string) => void;
}) {
  const patch = (value: Partial<StudioElement>, label: string) =>
    onChangeDeck(updateElement(deck, slideIndex, element.id, value), label);

  switch (element.kind) {
    case "text":
      return (
        <Section title="Texto">
          <label className="block text-xs font-medium text-slate-500">
            Papel na hierarquia
            <select
              className={`${fieldClass} mt-1`}
              value={element.role}
              onChange={(event) => patch({ role: event.target.value as TextRole } as Partial<StudioElement>, "Papel do texto")}
            >
              <option value="kicker">Rótulo curto</option>
              <option value="title">Título</option>
              <option value="lead">Introdução</option>
              <option value="body">Corpo</option>
              <option value="caption">Legenda</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Conteúdo
            <textarea
              className={`${fieldClass} mt-1 min-h-24`}
              value={element.text}
              onChange={(event) => patch({ text: event.target.value } as Partial<StudioElement>, "Texto do elemento")}
            />
          </label>
          <RemoveButton onClick={() => onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover texto")} />
        </Section>
      );

    case "image":
      return (
        <Section title="Imagem">
          <label className="block text-xs font-medium text-slate-500">
            Descrição (acessibilidade)
            <input
              className={`${fieldClass} mt-1`}
              value={element.alt}
              onChange={(event) => patch({ alt: event.target.value } as Partial<StudioElement>, "Descrição da imagem")}
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Preenchimento
            <select
              className={`${fieldClass} mt-1`}
              value={element.fit}
              onChange={(event) => patch({ fit: event.target.value as "cover" | "contain" } as Partial<StudioElement>, "Ajuste da imagem")}
            >
              <option value="cover">Preencher (corta o excesso)</option>
              <option value="contain">Mostrar tudo (mantém proporção)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={element.background}
              onChange={(event) => patch({ background: event.target.checked } as Partial<StudioElement>, "Imagem de fundo")}
            />
            Usar como fundo da página
          </label>
          {element.source === "ai" ? (
            <p className="rounded-lg bg-amber-50 p-2 text-[11px] leading-4 text-amber-800">
              Esta é uma imagem GERADA. Continua identificada como tal, porque é materialmente diferente de uma fotografia
              do projecto.
            </p>
          ) : null}
          <RemoveButton onClick={() => onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover imagem")} />
        </Section>
      );

    case "table":
      return (
        <Section title="Tabela">
          <BindingPicker
            binding={element.binding}
            financial={isFinancial(element.binding)}
            onChange={(binding) =>
              // Ao LIGAR, as linhas manuais são descartadas de uma vez: deixá-las
              // seria guardar duas fontes para o mesmo número, que é exactamente
              // o que o item 26 proíbe.
              patch(
                { binding, ...(binding ? { columns: [], rows: [] } : {}) } as Partial<StudioElement>,
                binding ? "Ligar tabela à proposta" : "Desligar tabela da proposta",
              )
            }
          />
          {element.binding ? (
            <p className="text-[11px] leading-4 text-slate-500">
              As linhas são lidas da proposta. Para as mudar, edite a proposta.
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-4 text-slate-500">
                Edite as células abaixo. A estrutura de colunas mantém-se — uma tabela é sempre uma tabela.
              </p>
              {element.rows.map((row, rowIndex) => (
                <div
                  key={`row-${rowIndex}`}
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${element.columns.length}, minmax(0, 1fr))` }}
                >
                  {row.map((cell, cellIndex) => (
                    <input
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className={fieldClass}
                      value={cell}
                      aria-label={`${element.columns[cellIndex] ?? "coluna"} linha ${rowIndex + 1}`}
                      onChange={(event) => {
                        const rows = element.rows.map((current, ri) =>
                          ri === rowIndex ? current.map((value, ci) => (ci === cellIndex ? event.target.value : value)) : current,
                        );
                        patch({ rows } as Partial<StudioElement>, "Célula da tabela");
                      }}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
          <RemoveButton onClick={() => onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover tabela")} />
        </Section>
      );

    case "cards":
      return (
        <Section title={`Cards (${element.items.length})`}>
          {element.items.map((item, index) => (
            <div key={`card-${index}`} className="space-y-1 rounded-lg border border-slate-200 p-2">
              <input
                className={fieldClass}
                value={item.title}
                aria-label={`Título do card ${index + 1}`}
                onChange={(event) => {
                  const items = element.items.map((current, ci) => (ci === index ? { ...current, title: event.target.value } : current));
                  patch({ items } as Partial<StudioElement>, "Título do card");
                }}
              />
              <textarea
                className={`${fieldClass} min-h-16`}
                value={item.body}
                aria-label={`Texto do card ${index + 1}`}
                onChange={(event) => {
                  const items = element.items.map((current, ci) => (ci === index ? { ...current, body: event.target.value } : current));
                  patch({ items } as Partial<StudioElement>, "Texto do card");
                }}
              />
            </div>
          ))}
          <label className="block text-xs font-medium text-slate-500">
            Distribuição
            <select
              className={`${fieldClass} mt-1`}
              value={element.variant}
              onChange={(event) => patch({ variant: event.target.value } as Partial<StudioElement>, "Distribuição dos cards")}
            >
              <option value="grid">Grelha igual</option>
              <option value="asymmetric">Assimétrico</option>
              <option value="stacked">Empilhado</option>
            </select>
          </label>
          <RemoveButton onClick={() => onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover cards")} />
        </Section>
      );

    case "gallery":
      return (
        <Section title={`Galeria (${element.images.length})`}>
          <ul className="space-y-1">
            {element.images.map((image, index) => (
              <li key={`${image.url}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
                <input
                  className={fieldClass}
                  value={image.alt}
                  aria-label={`Descrição da imagem ${index + 1}`}
                  placeholder="Descrição"
                  onChange={(event) => {
                    const images = element.images.map((current, ci) => (ci === index ? { ...current, alt: event.target.value } : current));
                    patch({ images } as Partial<StudioElement>, "Descrição da imagem");
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 text-xs font-semibold text-rose-600 hover:underline"
                  onClick={() => {
                    const images = element.images.filter((_, ci) => ci !== index);
                    // Uma galeria sem imagens não se corrige sozinha no ecrã.
                    if (images.length === 0) {
                      onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover galeria vazia");
                      return;
                    }
                    patch({ images } as Partial<StudioElement>, "Remover imagem da galeria");
                  }}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <RemoveButton onClick={() => onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover galeria")} />
        </Section>
      );

    case "timeline":
      return (
        <Section title={element.binding ? getBinding(element.binding).label : `Timeline (${element.steps.length})`}>
          <BindingPicker
            binding={element.binding}
            financial={isFinancial(element.binding)}
            onChange={(binding) =>
              patch(
                { binding, ...(binding ? { steps: [] } : {}) } as Partial<StudioElement>,
                binding ? "Ligar cronograma à proposta" : "Desligar cronograma da proposta",
              )
            }
          />
          {element.binding ? (
            // Ligado, as etapas vêm dos prazos dos serviços e a sequência é
            // acumulada. Escrever etapas aqui seria um cronograma que não bate
            // com o contrato.
            <p className="text-[11px] leading-4 text-slate-500">
              As etapas e a duração vêm da proposta. Para alterar prazos, edite os serviços.
            </p>
          ) : (
            element.steps.map((step, index) => (
              <div key={`step-${index}`} className="grid grid-cols-3 gap-1">
                {(["label", "title", "body"] as const).map((key) => (
                  <input
                    key={key}
                    className={fieldClass}
                    value={step[key]}
                    aria-label={`${key} da fase ${index + 1}`}
                    onChange={(event) => {
                      const steps = element.steps.map((current, ci) => (ci === index ? { ...current, [key]: event.target.value } : current));
                      patch({ steps } as Partial<StudioElement>, "Fase da timeline");
                    }}
                  />
                ))}
              </div>
            ))
          )}
          <RemoveButton onClick={() => onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover timeline")} />
        </Section>
      );

    case "comparison":
      return (
        <Section title={element.binding ? getBinding(element.binding).label : "Comparativo"}>
          <BindingPicker
            binding={element.binding}
            financial={isFinancial(element.binding)}
            onChange={(binding) =>
              patch(
                { binding, ...(binding ? { sides: [] } : {}) } as Partial<StudioElement>,
                binding ? "Ligar comparativo à proposta" : "Desligar comparativo da proposta",
              )
            }
          />
          {element.binding ? (
            // Os TÍTULOS, os SERVIÇOS e o VALOR de cada opção vêm da proposta.
            // O que o ADMIN escreve é a comparação entre elas — o texto é dele.
            <p className="text-[11px] leading-4 text-slate-500">
              Os valores e os serviços de cada opção vêm da proposta. Para os alterar, edite os serviços.
            </p>
          ) : (
            element.sides.map((side, index) => (
            <div key={`side-${index}`} className="space-y-1 rounded-lg border border-slate-200 p-2">
              <input
                className={fieldClass}
                value={side.title}
                aria-label={`Título do lado ${index + 1}`}
                onChange={(event) => {
                  const sides = element.sides.map((current, ci) => (ci === index ? { ...current, title: event.target.value } : current));
                  patch({ sides } as Partial<StudioElement>, "Título do comparativo");
                }}
              />
              <textarea
                className={`${fieldClass} min-h-16`}
                value={side.items.join("\n")}
                aria-label={`Itens do lado ${index + 1}`}
                onChange={(event) => {
                  const items = event.target.value.split("\n");
                  const sides = element.sides.map((current, ci) => (ci === index ? { ...current, items } : current));
                  patch({ sides } as Partial<StudioElement>, "Itens do comparativo");
                }}
              />
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={side.highlight}
                  onChange={(event) => {
                    const sides = element.sides.map((current, ci) => (ci === index ? { ...current, highlight: event.target.checked } : current));
                    patch({ sides } as Partial<StudioElement>, "Destaque do comparativo");
                  }}
                />
                Destacar este lado
              </label>
            </div>
          ))
          )}
          <RemoveButton onClick={() => onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover comparativo")} />
        </Section>
      );

    case "metric":
      /*
       * ATENÇÃO — o `metric` não tem campo de valor, e isso é deliberado.
       *
       * O valor vem da `ProposalVersion`, que é a única fonte de verdade
       * financeira. Um campo editável aqui permitiria escrever um preço que o
       * cliente nunca contratou — exactamente o que `assertNoCommercialInvented`
       * existe para impedir. Aqui só se edita o rótulo e a nota.
       */
      return (
        <Section title="Destaque">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Valor (da proposta)</p>
            <p className="text-lg font-bold text-slate-900">{element.value}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Este valor vem da versão da proposta e não se edita aqui.
            </p>
          </div>
          <label className="block text-xs font-medium text-slate-500">
            Rótulo
            <input
              className={`${fieldClass} mt-1`}
              value={element.label}
              onChange={(event) => patch({ label: event.target.value } as Partial<StudioElement>, "Rótulo do destaque")}
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Nota
            <input
              className={`${fieldClass} mt-1`}
              value={element.hint ?? ""}
              onChange={(event) => patch({ hint: event.target.value || null } as Partial<StudioElement>, "Nota do destaque")}
            />
          </label>
          <RemoveButton onClick={() => onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover destaque")} />
        </Section>
      );

    case "cta":
      return (
        <Section title="Botão de acção">
          <label className="block text-xs font-medium text-slate-500">
            Título
            <input className={`${fieldClass} mt-1`} value={element.title} onChange={(event) => patch({ title: event.target.value } as Partial<StudioElement>, "Título do CTA")} />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Texto
            <input className={`${fieldClass} mt-1`} value={element.body} onChange={(event) => patch({ body: event.target.value } as Partial<StudioElement>, "Texto do CTA")} />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Acção
            <input className={`${fieldClass} mt-1`} value={element.action} onChange={(event) => patch({ action: event.target.value } as Partial<StudioElement>, "Acção do CTA")} />
          </label>
          <RemoveButton onClick={() => onChangeDeck(removeElement(deck, slideIndex, element.id), "Remover CTA")} />
        </Section>
      );
  }
}

/** Botão de remoção, com o rótulo explícito do que vai ser removido. */
function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs font-semibold text-rose-600 hover:underline">
      Remover este elemento
    </button>
  );
}

/** Aba da PÁGINA: layout, campos simples e ocultar. */
function PageTab({
  deck,
  index,
  onChangeDeck,
  onSelectElement,
}: {
  deck: StudioDeck;
  index: number;
  onChangeDeck: (next: StudioDeck, label: string) => void;
  onSelectElement: (elementId: string | null) => void;
}) {
  const slide = deck.slides[index];
  const report: SmartLayoutReport = analyzeSlide(slide);

  const patch = (value: Partial<Pick<StudioSlide, "eyebrow" | "notes" | "hidden">>, label: string) =>
    onChangeDeck({ ...deck, slides: deck.slides.map((item, i) => (i === index ? { ...item, ...value } : item)) }, label);

  return (
    <div className="space-y-4">
      <Section title="Layout da página">
        <LayoutPicker
          slide={slide}
          onPick={(key) => {
            // A troca usa o módulo de manipulação, que já sabe preservar o
            // conteúdo compatível e reportar o que não cabe.
            onChangeDeck(replaceLayout(deck, index, key), "Trocar layout");
            // A selecção pode ter desaparecido com a troca.
            onSelectElement(null);
          }}
        />
      </Section>

      <Section title="Rótulo e notas">
        <label className="block text-xs font-medium text-slate-500">
          Rótulo acima do título
          <input className={`${fieldClass} mt-1`} value={slide.eyebrow} onChange={(event) => patch({ eyebrow: event.target.value }, "Rótulo da página")} />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Notas (não publicadas)
          <textarea className={`${fieldClass} mt-1 min-h-20`} value={slide.notes} onChange={(event) => patch({ notes: event.target.value }, "Notas da página")} />
        </label>
      </Section>

      <Section title="Visibilidade">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={slide.hidden} onChange={(event) => patch({ hidden: event.target.checked }, "Visibilidade da página")} />
          Ocultar na apresentação do cliente
        </label>
        <p className="text-[11px] leading-4 text-slate-500">
          A página continua no editor. Só deixa de aparecer na proposta publicada.
        </p>
      </Section>

      {report.issues.length > 0 ? (
        <Section title="Diagnóstico">
          <ul className="space-y-1">
            {report.issues.map((issue) => (
              <li key={issue.code} className="flex items-start gap-2 text-[11px] leading-4">
                <Badge tone={issue.severity === "high" ? "red" : "amber"}>{issue.severity === "high" ? "importante" : "sugestão"}</Badge>
                <span className="text-slate-600">{issue.message}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

/** Aba do TEMA: escolha, com o contraste medido e mostrado. */
function ThemeTab({ deck, onChangeDeck }: { deck: StudioDeck; onChangeDeck: (next: StudioDeck, label: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-4 text-slate-500">
        O tema muda a dosagem da identidade ARQVERTICE, não a marca. A tipografia e a paleta continuam as do Design System.
      </p>
      {THEME_ORDER.map((key: ThemeKey) => {
        const theme = getTheme(key);
        const audit = auditTheme(theme);
        const preview = themePreview(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChangeDeck({ ...deck, theme: key }, `Tema ${theme.label}`)}
            className={`w-full rounded-xl border p-3 text-left outline-none transition-colors ${
              deck.theme === key ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{theme.label}</span>
              {audit.readable ? <Badge tone="green">contraste ok</Badge> : <Badge tone="red">contraste baixo</Badge>}
            </div>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{theme.intent}</p>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {[preview.background, preview.surface, preview.title, preview.accent].map((color, i) => (
                <span key={i} className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Aba das IMAGENS (itens 19 a 24).
 *
 * A ordem de preferência não é uma sugestão de interface: as imagens aparecem
 * já ordenadas por `suggestMediaForSlide`, do projecto para a biblioteca e só
 * depois a geração por IA. E a geração por IA só aparece com pedido explícito —
 * porque substituir uma fotografia real do projecto por uma imagem inventada é
 * apresentar ao cliente algo que não existe.
 */
function MediaTab({
  deck,
  index,
  assets,
  onInsertImage,
}: {
  deck: StudioDeck;
  index: number;
  assets: readonly MediaAsset[];
  onInsertImage: (element: StudioElement) => void;
}) {
  const slide = deck.slides[index];
  const [allowGeneration, setAllowGeneration] = useState(false);

  const suggestions: MediaSuggestion[] = suggestMediaForSlide({
    assets,
    slide: { title: slide.title, body: slide.body, elements: slide.elements },
    context: {},
    allowGeneration,
    limit: 12,
  });

  if (assets.length === 0) {
    return (
      <p className="text-[11px] leading-4 text-slate-500">
        Ainda não há imagens neste projecto. Carregue uma imagem ou use uma da biblioteca ARQVERTICE.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <input type="checkbox" checked={allowGeneration} onChange={(event) => setAllowGeneration(event.target.checked)} />
        Incluir imagens geradas por IA
      </label>

      {suggestions.length === 0 ? (
        <p className="text-[11px] leading-4 text-slate-500">Nenhuma imagem do banco combina com esta página.</p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion.asset.id} className="rounded-lg border border-slate-200 p-2">
              <div className="flex items-start gap-2">
                <img src={suggestion.asset.url} alt={suggestion.asset.alt} className="h-12 w-16 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold">{suggestion.asset.description || suggestion.asset.category}</span>
                    {suggestion.asset.origin === "project" ? <Badge tone="green">do projecto</Badge> : null}
                    {suggestion.asset.origin === "ai" || suggestion.asset.origin === "variacao" ? <Badge tone="amber">gerada</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{suggestion.reasons[0]}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="secondary"
                  className="min-h-8 px-2 text-[11px]"
                  onClick={() =>
                    onInsertImage({
                      kind: "image",
                      id: `el-img-${suggestion.asset.id}`,
                      url: suggestion.asset.url,
                      alt: suggestion.asset.alt,
                      fit: "cover",
                      background: false,
                      source: suggestion.asset.origin === "variacao" ? "ai" : suggestion.asset.origin,
                    })
                  }
                >
                  Inserir
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-8 px-2 text-[11px]"
                  onClick={() =>
                    onInsertImage({
                      kind: "image",
                      id: `el-bg-${suggestion.asset.id}`,
                      url: suggestion.asset.url,
                      alt: suggestion.asset.alt,
                      fit: "cover",
                      background: true,
                      source: suggestion.asset.origin === "variacao" ? "ai" : suggestion.asset.origin,
                    })
                  }
                >
                  Usar como fundo
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Inserção de elementos, com progressive disclosure (item 9).
 *
 * Os elementos estão agrupados e só aparecem os que o layout da página aceita.
 * Uma capa não oferece tabela — e um grupo vazio não ocupa espaço. É isto que
 * evita a barra com vinte botões que o item 9 proíbe.
 */
export function InsertSection({
  slide,
  onInsert,
}: {
  slide: StudioSlide;
  onInsert: (element: StudioElement) => void;
}) {
  const available = elementsForLayout(slide.layout ? getLayout(slide.layout).slots : []);
  const groups = elementGroups(available);

  if (groups.length === 0) {
    return <p className="text-[11px] leading-4 text-slate-500">Este layout não aceita mais elementos.</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.group} className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{group.group}</p>
          <div className="flex flex-wrap gap-1">
            {group.items.map((definition) => {
              const blocked = !canAddElement(definition.kind, slide.elements);
              return (
                <button
                  key={definition.kind}
                  type="button"
                  disabled={blocked}
                  title={definition.purpose}
                  onClick={() => onInsert(blankElement(definition.kind, slide))}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold outline-none hover:bg-slate-50 disabled:opacity-40"
                >
                  {definition.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Cria um elemento vazio do tipo pedido.
 *
 * O id é derivado do CONTEÚDO e do número de elementos existentes, nunca
 * sorteado: dois `blankSlide` seguidos têm de produzir ids diferentes mas
 * estáveis, senão o desfazer e o React perdem o rasto.
 */
function blankElement(kind: ElementKind, slide: StudioSlide): StudioElement {
  const seq = slide.elements.length;
  switch (kind) {
    case "text":
      return { kind: "text", id: stableId("el", "text", slide.id, seq), role: "body", text: "" };
    case "image":
      return { kind: "image", id: stableId("el", "image", slide.id, seq), url: "", alt: "", fit: "cover", background: false, source: "library" };
    case "gallery":
      return { kind: "gallery", id: stableId("el", "gallery", slide.id, seq), images: [] };
    case "cards":
      return {
        kind: "cards",
        id: stableId("el", "cards", slide.id, seq),
        items: [{ title: "Novo item", body: "", image: null }],
        variant: "grid",
      };
    case "table":
      return { kind: "table", id: stableId("el", "table", slide.id, seq), columns: ["Item", "Valor"], rows: [[""]], binding: null };
    case "timeline":
      return { kind: "timeline", id: stableId("el", "timeline", slide.id, seq), steps: [{ label: "01", title: "", body: "" }], binding: null };
    case "comparison":
      return {
        kind: "comparison",
        id: stableId("el", "comparison", slide.id, seq),
        sides: [
          { title: "Opção A", items: [""], highlight: false },
          { title: "Opção B", items: [""], highlight: false },
        ],
        binding: null,
      };
    case "metric":
      // Um destaque nasce SEM valor: o valor vem da proposta, não do editor.
      return { kind: "metric", id: stableId("el", "metric", slide.id, seq), label: "Rótulo", value: "—", hint: null };
    case "cta":
      return { kind: "cta", id: stableId("el", "cta", slide.id, seq), title: "", body: "", action: "Continuar" };
  }
}

/**
 * O PAINEL CONTEXTUAL.
 *
 * Uma barra de separadores — nunca vinte botões ao mesmo tempo. O separador de
 * ELEMENTO só aparece quando há um elemento seleccionado, e a aba AVANÇADO
 * contém o que só é útil ocasionalmente (auditoria da apresentação inteira).
 */
export function ContextPanel({
  deck,
  index,
  selectedElementId,
  onSelectElement,
  onChangeDeck,
  onRunAi,
  assets,
  aiMessage,
}: ContextPanelProps) {
  const slide = deck.slides[index];
  const selected = slide.elements.find((element) => element.id === selectedElementId) ?? null;
  const [tab, setTab] = useState<Tab>("elemento");

  // Se o elemento desaparece (remoção, troca de layout), o separador volta ao
  // início em vez de mostrar um painel vazio de um elemento que já não existe.
  const effectiveTab: Tab = tab === "elemento" && !selected ? "pagina" : tab;

  return (
    <aside aria-label="Painel de edição" className="flex h-full flex-col gap-3">
      <div role="tablist" aria-label="Secções de edição" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((entry) => {
          const disabled = entry.key === "elemento" && !selected;
          return (
            <button
              key={entry.key}
              role="tab"
              type="button"
              aria-selected={effectiveTab === entry.key}
              disabled={disabled}
              title={entry.help}
              onClick={() => setTab(entry.key)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 ${
                effectiveTab === entry.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {effectiveTab === "elemento" && selected ? (
          <ElementEditor element={selected} slideIndex={index} deck={deck} onChangeDeck={onChangeDeck} />
        ) : null}

        {effectiveTab === "pagina" ? (
          <PageTab deck={deck} index={index} onChangeDeck={onChangeDeck} onSelectElement={onSelectElement} />
        ) : null}

        {effectiveTab === "tema" ? <ThemeTab deck={deck} onChangeDeck={onChangeDeck} /> : null}

        {effectiveTab === "media" ? (
          <MediaTab deck={deck} index={index} assets={assets} onInsertImage={(element) => onChangeDeck(insertElement(deck, index, element), "Inserir imagem")} />
        ) : null}

        {effectiveTab === "avancado" ? (
          <div className="space-y-4">
            <Section title="Comandos de IA">
              <AiBox deck={deck} slide={slide} selectedElementId={selectedElementId} onRunAi={onRunAi} message={aiMessage} />
            </Section>
          </div>
        ) : null}

        {/*
          Inserção disponível nas abas de trabalho, não na de tema: acrescentar
          um elemento não tem nada a ver com a identidade visual. É o
          progressive disclosure em prática.
        */}
        {effectiveTab === "elemento" || effectiveTab === "pagina" ? (
          <Section title="Adicionar elemento">
            <InsertSection
              slide={slide}
              onInsert={(element) => {
                onChangeDeck(insertElement(deck, index, element), "Inserir elemento");
                // Selecciona o que acabou de ser inserido: o passo seguinte é
                // sempre editá-lo, e obrigar a clicar de novo seria um passo extra.
                onSelectElement(element.id);
              }}
            />
          </Section>
        ) : null}
      </div>
    </aside>
  );
}