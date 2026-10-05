"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { StudioElement, StudioSlide } from "@/lib/studio-deck";
import type { Theme } from "@/lib/studio-theme";
import {
  boundOptions,
  boundSchedule,
  getBinding,
  resolveBinding,
  type BoundTable,
  type CommercialData,
} from "@/lib/studio-commercial";

/**
 * FASE 4C — O CANVAS (item 9).
 *
 * O item 9 é uma lista de proibições antes de ser uma lista de requisitos: a
 * página NÃO pode ser uma imagem estática, e texto, imagem, card e tabela têm
 * de continuar a ser EDITÁVEIS e SELECIONÁVEIS. Este componente é a prova
 * dessa parte — o que se vê no ecrã é o modelo de dados, não um desenho.
 *
 * Duas decisões que evitam os erros mais comuns de um editor visual:
 *
 *  1. **O texto edita-se num campo, não com `contentEditable`.**
 *     `contentEditable` parece mais simples e é a origem de quase todos os bugs
 *     de editor: o DOM passa a divergir do estado, o cursor salta quando o
 *     componente re-renderiza, e o "desfazer" deixa de ser fiável. Aqui o texto
 *     editável é um `<textarea>` controlado pelo estado do deck — a mesma fonte
 *     que o PDF e o preview leem, logo o que se vê nunca mente.
 *
 *  2. **Pré-visualização e editor são o MESMO componente.**
 *     Um preview escrito à parte acabaria por divergir do editor, e o ADMIN
 *     veria exactamente o que o cliente não veria. A diferença é um `mode`: em
 *     `preview` não há anéis de selecção nem campos.
 */

export type CanvasMode = "edit" | "preview";

/** Identidade visual da página, derivada do tema escolhido. */
export function themeStyle(theme: Theme): CSSProperties {
  return {
    backgroundColor: theme.tokens.background,
    color: theme.tokens.body,
    borderRadius: theme.radius,
    boxShadow: theme.shadow,
    fontSize: `${14 * theme.scale.body}px`,
  };
}

type CanvasProps = {
  slide: StudioSlide;
  theme: Theme;
  mode: CanvasMode;
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
  /** Grava o texto editado. Só é chamado em modo `edit`. */
  onEditText: (elementId: string, value: string) => void;
  pageNumber: number;
  totalPages: number;
  /**
   * Dados comerciais lidos da `ProposalVersion` pelo servidor.
   *
   * É o que permite a um elemento ligado mostrar o valor oficial. Fica aqui, e
   * não dentro do deck, por uma razão: o deck é o que o ADMIN edita e o que é
   * gravado — se os valores fossem para o deck, voltariam a ser uma segunda
   * fonte que pode divergir da proposta.
   */
  commercial?: CommercialData | null;
};

/** Rótulo curto de um elemento, para o painel e para o aviso acessível. */
export function elementLabel(element: StudioElement): string {
  switch (element.kind) {
    case "text":
      return `Texto (${element.role})`;
    case "image":
      return "Imagem";
    case "gallery":
      return `Galeria (${element.images.length})`;
    case "cards":
      return `Cards (${element.items.length})`;
    case "table":
      return element.binding ? getBinding(element.binding).label : "Tabela";
    case "timeline":
      return element.binding ? getBinding(element.binding).label : `Timeline (${element.steps.length})`;
    case "comparison":
      return element.binding ? getBinding(element.binding).label : "Comparativo";
    case "metric":
      return "Destaque";
    case "cta":
      return "Botão de acção";
  }
}

/**
 * Moldura de um elemento: o anel de selecção e o alvo de clique.
 *
 * Em `preview` não há anel nem alvo — o componente não muda de forma, muda de
 * comportamento, e é isso que garante que o preview é fiel ao editor.
 */
function Frame({
  element,
  selected,
  mode,
  onSelect,
  children,
}: {
  element: StudioElement;
  selected: boolean;
  mode: CanvasMode;
  onSelect: () => void;
  children: ReactNode;
}) {
  if (mode === "preview") {
    return <div className="min-h-0">{children}</div>;
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${elementLabel(element)}${selected ? " (seleccionado)" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`min-h-0 cursor-pointer rounded-lg outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-blue-500 ${
        selected ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-slate-400"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Texto editável.
 *
 * O rascunho local existe para não reescrever o deck a cada tecla: só se grava ao
 * perder o foco. Sem isto, cada caractere criaria uma entrada no histórico e o
 * botão de desfazer ficaria inútil.
 */
function EditableText({
  elementId,
  initial,
  onCommit,
  className,
  placeholder,
}: {
  elementId: string;
  initial: string;
  onCommit: (value: string) => void;
  className: string;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(initial);

  // Sincroniza quando o elemento muda por fora (IA, desfazer, preview).
  useEffect(() => setDraft(initial), [elementId, initial]);

  return (
    <textarea
      value={draft}
      placeholder={placeholder}
      aria-label="Texto do elemento"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== initial) onCommit(draft);
      }}
      onKeyDown={(event) => {
        // Escape larga o campo sem gravar: a forma de sair sem alterar nada.
        if (event.key === "Escape") {
          event.stopPropagation();
          setDraft(initial);
          event.currentTarget.blur();
        }
      }}
      className={`w-full resize-none overflow-hidden bg-transparent ${className}`}
      style={{ minHeight: "2.5rem" }}
    />
  );
}

const TEXT_STYLE: Record<string, string> = {
  kicker: "text-[11px] font-semibold uppercase tracking-[0.24em]",
  title: "text-3xl font-bold leading-tight",
  lead: "text-lg leading-relaxed",
  body: "text-sm leading-7",
  caption: "text-xs leading-5",
};
/**
 * Tabela LIGADA: as linhas vêm da `ProposalVersion`.
 *
 * Este é o ponto onde a regra comercial dos itens 26 a 30 se torna VISÍVEL. O
 * componente não recebe valores: recebe a tabela já resolvida pelo servidor e
 * limita-se a desenhá-la. Não existe caminho neste ficheiro para um preço ser
 * escrito — o que é o que garante que o que se vê é o que o cliente aprova.
 *
 * As colunas numéricas alinham à direita porque os tokens de formatação não são
 * texto do autor: são a consequência de a coluna ter sido marcada como dinheiro
 * no servidor.
 */
function BoundTableView({ table, theme }: { table: BoundTable; theme: Theme }) {
  // Sem dados, uma moldura vazia com a legenda é mais honesta do que uma tabela
  // de cabeçalhos sem linhas: o cliente percebe que ainda falta o quê.
  if (table.empty) {
    return (
      <p className="text-xs" style={{ color: theme.tokens.muted }}>
        Sem dados comerciais nesta proposta.
      </p>
    );
  }

  // Os valores por linha são buscados pela ordem das colunas, e não pelo nome:
  // o registo da coluna é a chave estável, e assim a ordem visual não depende de
  // o servidor voltar a dar as chaves por outra ordem.
  const cell = (row: Record<string, string>, columnIndex: number): string => {
    const title = table.columns[columnIndex]?.title ?? "";
    return row[title] ?? "";
  };

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {table.columns.map((column) => (
            <th
              key={column.title}
              className={`border-b px-2 py-1 font-semibold ${column.numeric ? "text-right" : "text-left"}`}
              style={{ borderColor: theme.tokens.border }}
            >
              {column.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={`row-${rowIndex}`}>
            {table.columns.map((column, columnIndex) => (
              <td
                key={`${column.title}-${columnIndex}`}
                className={`border-b px-2 py-1 ${column.numeric ? "text-right tabular-nums" : "text-left"}`}
                style={{ borderColor: theme.tokens.border }}
              >
                {cell(row, columnIndex)}
              </td>
            ))}
          </tr>
        ))}
        {table.totals.map((line) => (
          <tr key={`total-${line.label}`}>
            <td
              colSpan={Math.max(1, table.columns.length - 1)}
              className="px-2 py-1 text-right font-semibold"
              style={{ color: theme.tokens.title }}
            >
              {line.label}
            </td>
            <td
              className="px-2 py-1 text-right tabular-nums font-bold"
              style={{ color: line.emphasis ? theme.tokens.accent : theme.tokens.title }}
            >
              {line.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Cronograma LIGADO: etapas com duração e sequência, da proposta (item 28). */
function BoundScheduleView({ data, theme }: { data: CommercialData; theme: Theme }) {
  const steps = boundSchedule(data);
  if (steps.length === 0) {
    return (
      <p className="text-xs" style={{ color: theme.tokens.muted }}>
        O cronograma é definido quando a proposta tiver serviços.
      </p>
    );
  }
  return (
    <ol className="flex flex-wrap gap-4">
      {steps.map((step) => (
        <li key={`${step.sequence}-${step.title}`} className="min-w-40 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.tokens.accent }}>
            {step.label} · {step.days} dias
          </p>
          <p className="mt-1 text-sm font-semibold">{step.title}</p>
          {step.body ? (
            <p className="mt-1 text-xs leading-5" style={{ color: theme.tokens.muted }}>
              {step.body}
            </p>
          ) : null}
          <p className="mt-1 text-[11px]" style={{ color: theme.tokens.muted }}>
            {step.note}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Comparativo LIGADO: opções com valor derivado e recomendação (item 27). */
function BoundOptionsView({ data, theme }: { data: CommercialData; theme: Theme }) {
  const sides = boundOptions(data);
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${sides.length}, minmax(0, 1fr))` }}>
      {sides.map((side) => (
        <div
          key={side.title}
          className="p-3"
          style={{
            borderRadius: theme.radius,
            border: `1px solid ${side.highlight ? theme.tokens.accent : theme.tokens.border}`,
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">{side.title}</p>
            {/* O VALOR vem do servidor: nunca escrito, nunca recalculado aqui. */}
            <p className="text-sm font-bold tabular-nums" style={{ color: theme.tokens.accent }}>
              {side.value}
            </p>
          </div>
          <ul className="mt-2 space-y-1 text-xs leading-5" style={{ color: theme.tokens.muted }}>
            {side.services.map((service) => (
              <li key={service}>· {service}</li>
            ))}
          </ul>
          {side.recommendation ? (
            <p className="mt-2 text-[11px] font-semibold" style={{ color: theme.tokens.title }}>
              {side.recommendation}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Desenha o conteúdo de um elemento, conforme o modo. */
function renderElementBody(
  element: StudioElement,
  mode: CanvasMode,
  theme: Theme,
  onEditText: (elementId: string, value: string) => void,
  /**
   * Dados comerciais da proposta, quando o editor os tem.
   *
   * `null` significa "sem proposta": o Studio ainda funciona para montar uma
   * apresentação de raiz, e nesse caso um elemento ligado mostra o aviso de
   * dados em falta em vez de falhar. É o que impede um ecrã vazio sem
   * explicação.
   */
  commercial: CommercialData | null,
): ReactNode {
  switch (element.kind) {
    case "text":
      return mode === "edit" ? (
        <EditableText
          elementId={element.id}
          initial={element.text}
          onCommit={(value) => onEditText(element.id, value)}
          className={TEXT_STYLE[element.role] ?? TEXT_STYLE.body}
          placeholder="Escreva aqui"
        />
      ) : (
        <p className={`whitespace-pre-line ${TEXT_STYLE[element.role] ?? TEXT_STYLE.body}`}>{element.text}</p>
      );

    case "image":
      return (
        <figure className="m-0">
          {/*
            `alt` não é decoração: uma galeria de arquitectura sem descrição é
            inutilizável para quem usa leitor de ecrã. A ausência é assinalada
            em vez de passar em silêncio.
          */}
          <img
            src={element.url}
            alt={element.alt}
            className="w-full object-cover"
            style={{ aspectRatio: "4 / 3", objectFit: element.fit, backgroundColor: theme.tokens.surface }}
          />
          {element.alt ? null : (
            <figcaption className="mt-1 text-[11px] font-semibold text-amber-700">
              Falta a descrição desta imagem.
            </figcaption>
          )}
        </figure>
      );

    case "gallery":
      return (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(3, element.images.length)}, minmax(0, 1fr))` }}
        >
          {element.images.map((image, index) => (
            <img
              key={`${image.url}-${index}`}
              src={image.url}
              alt={image.alt}
              className="aspect-[4/3] w-full rounded object-cover"
              style={{ backgroundColor: theme.tokens.surface }}
            />
          ))}
        </div>
      );

    case "cards":
      return (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(3, element.items.length)}, minmax(0, 1fr))` }}>
          {element.items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className="p-3"
              style={{
                backgroundColor: theme.card === "filled" ? theme.tokens.surface : "transparent",
                borderRadius: theme.radius,
                border: theme.card === "outlined" ? `1px solid ${theme.tokens.border}` : undefined,
                boxShadow: theme.card === "raised" ? theme.shadow : undefined,
              }}
            >
              {item.image ? (
                <img src={item.image.url} alt={item.image.alt ?? ""} className="mb-2 aspect-video w-full rounded object-cover" />
              ) : null}
              {/*
                O título do card é texto simples AQUI de propósito: edita-se no
                painel contextual. Um campo editável que não grava seria pior do
                que texto — perdia o que o utilizador escrevesse.
              */}
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 whitespace-pre-line text-xs leading-5" style={{ color: theme.tokens.muted }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      );

    case "table":
      // Elemento LIGADO: as linhas vêm da proposta, e o que está gravado é
      // ignorado. Sem dados comerciais, diz isso — nunca mostra vazio.
      if (element.binding) {
        if (!commercial) {
          return (
            <p className="text-xs" style={{ color: theme.tokens.muted }}>
              {getBinding(element.binding).label}: abra a proposta para ver os valores.
            </p>
          );
        }
        return <BoundTableView table={resolveBinding(element.binding, commercial)} theme={theme} />;
      }
      // Uma tabela é uma TABELA, não texto alinhado com espaços: é isso que a
      // mantém editável célula a célula e legível por leitor de ecrã.
      return (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {element.columns.map((column, index) => (
                <th key={`${column}-${index}`} className="border-b px-2 py-1 text-left font-semibold" style={{ borderColor: theme.tokens.border }}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {element.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`} className="border-b px-2 py-1" style={{ borderColor: theme.tokens.border }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
case "timeline":
      // LIGADO: as etapas vêm dos prazos dos serviços (item 28). A apresentação
      // actualiza sozinha quando o cronograma comercial muda, porque nada aqui
      // foi escrito à mão.
      if (element.binding) {
        return commercial ? (
          <BoundScheduleView data={commercial} theme={theme} />
        ) : (
          <p className="text-xs" style={{ color: theme.tokens.muted }}>
            Cronograma: abra a proposta para ver as etapas.
          </p>
        );
      }
      return (
        <ol className="flex gap-4">
          {element.steps.map((step, index) => (
            <li key={`${step.title}-${index}`} className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.tokens.accent }}>
                {step.label}
              </p>
              <p className="mt-1 text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-xs leading-5" style={{ color: theme.tokens.muted }}>
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      );

    case "comparison":
      // LIGADO: os valores de cada opção vêm da proposta (item 27). Só os
      // benefícios e a recomendação são texto — e a recomendação pertence ao
      // ADMIN, não ao cálculo.
      if (element.binding) {
        return commercial ? (
          <BoundOptionsView data={commercial} theme={theme} />
        ) : (
          <p className="text-xs" style={{ color: theme.tokens.muted }}>
            Opções: abra a proposta para ver os valores.
          </p>
        );
      }
      return (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${element.sides.length}, minmax(0, 1fr))` }}>
          {element.sides.map((side, index) => (
            <div
              key={`${side.title}-${index}`}
              className="p-3"
              style={{
                borderRadius: theme.radius,
                border: `1px solid ${side.highlight ? theme.tokens.accent : theme.tokens.border}`,
              }}
            >
              <p className="text-sm font-semibold">{side.title}</p>
              <ul className="mt-2 space-y-1 text-xs leading-5" style={{ color: theme.tokens.muted }}>
                {side.items.map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`}>· {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );

    case "metric": {
      /*
       * O VALOR vem do servidor (`ProposalVersion`). Este componente nunca o
       * calcula — só o apresenta com a dosagem do tema. É aqui que um preço
       * errado entraria se o editor calculasse em vez de mostrar.
       */
      const size = theme.highlight.size === "hero" ? "text-5xl" : theme.highlight.size === "large" ? "text-3xl" : "text-2xl";
      return (
        <div
          className="p-3"
          style={{
            borderRadius: theme.radius,
            border: theme.highlight.style === "rule" ? `2px solid ${theme.tokens.accent}` : undefined,
            backgroundColor: theme.highlight.style === "card" ? theme.tokens.surface : "transparent",
          }}
        >
          <p className={`${size} font-bold`} style={{ color: theme.tokens.title }}>
            {element.value}
          </p>
          <p className="mt-1 text-xs font-semibold" style={{ color: theme.tokens.muted }}>
            {element.label}
          </p>
          {element.hint ? (
            <p className="mt-1 text-[11px]" style={{ color: theme.tokens.muted }}>
              {element.hint}
            </p>
          ) : null}
        </div>
      );
    }

    case "cta":
      return (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold" style={{ color: theme.tokens.title }}>
              {element.title}
            </p>
            {element.body ? (
              <p className="mt-1 text-xs" style={{ color: theme.tokens.muted }}>
                {element.body}
              </p>
            ) : null}
          </div>
          <span
            className="rounded-full px-4 py-2 text-xs font-semibold"
            style={{
              backgroundColor: theme.button === "solid" ? theme.tokens.accent : "transparent",
              color: theme.button === "solid" ? "#ffffff" : theme.tokens.accent,
              border: theme.button === "solid" ? undefined : `1px solid ${theme.tokens.accent}`,
            }}
          >
            {element.action}
          </span>
        </div>
      );
  }
}
/**
 * A página completa, com o seu título, os seus elementos e a numeração.
 *
 * É este componente que o editor e o preview partilham: o `mode` decide se há
 * campos editáveis e anéis de selecção, nunca o que é mostrado.
 */
export function SlideCanvas({
  slide,
  theme,
  mode,
  selectedElementId,
  onSelectElement,
  onEditText,
  pageNumber,
  totalPages,
  commercial = null,
}: CanvasProps) {
  // A imagem de fundo é o único elemento que fica por baixo do conteúdo.
  const background = slide.elements.find((element) => element.kind === "image" && element.background);
  const foreground = slide.elements.filter((element) => !(element.kind === "image" && element.background));

  return (
    <article
      aria-label={`Página ${pageNumber} de ${totalPages}: ${slide.title || "sem título"}`}
      className="relative flex flex-col justify-between gap-8 overflow-hidden p-8"
      style={{ ...themeStyle(theme), minHeight: "420px" }}
      onClick={() => onSelectElement(null)}
    >
      {/*
        Imagem de fundo (item 19). Sem o `scrim`, texto sobre fotografia clara
        ficaria ilegível — e é o TEMA que decide se quer esse véu, não o editor.
      */}
      {background && background.kind === "image" ? (
        <>
          <img
            src={background.url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectFit: background.fit }}
          />
          {theme.scrim !== "none" ? (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: theme.tokens.overlay, opacity: theme.scrim === "strong" ? 0.62 : 0.34 }}
              aria-hidden="true"
            />
          ) : null}
        </>
      ) : null}

      <div className="relative flex flex-col gap-6">
        {slide.eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.tokens.accent }}>
            {slide.eyebrow}
          </p>
        ) : null}

        {/*
          O título e o corpo editáveis são os mesmos campos que o PDF e o DTO
          leem. Editá-los aqui muda a proposta que o cliente recebe, não uma cópia
          de ecrã.
        */}
        {mode === "edit" ? (
          <div className="flex flex-col gap-3">
            <EditableText
              elementId={`${slide.id}-title`}
              initial={slide.title}
              onCommit={(value) => onEditText(`${slide.id}-title`, value)}
              className="text-2xl font-bold leading-tight"
              placeholder="Título da página"
            />
            <EditableText
              elementId={`${slide.id}-body`}
              initial={slide.body}
              onCommit={(value) => onEditText(`${slide.id}-body`, value)}
              className="text-sm leading-7"
              placeholder="Texto da página"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {slide.title ? (
              <h2
                className="leading-tight"
                style={{ color: theme.tokens.title, fontSize: `${28 * theme.scale.title}px`, fontWeight: theme.titleWeight }}
              >
                {slide.title}
              </h2>
            ) : null}
            {slide.body ? <p className="whitespace-pre-line text-sm leading-7">{slide.body}</p> : null}
          </div>
        )}

        {foreground.map((element) => (
          <Frame
            key={element.id}
            element={element}
            selected={element.id === selectedElementId}
            mode={mode}
            onSelect={() => onSelectElement(element.id)}
          >
            {renderElementBody(element, mode, theme, onEditText, commercial)}
          </Frame>
        ))}

        {background && mode === "edit" ? (
          <p className="text-[11px]" style={{ color: theme.tokens.muted }}>
            Há uma imagem de fundo nesta página. Use o painel para a trocar ou remover.
          </p>
        ) : null}
      </div>

      {/* Numeração: o tema decide se aparece e onde. */}
      {theme.recurring.pageNumber !== "none" ? (
        <p
          className={`relative text-[11px] ${theme.recurring.pageNumber === "corner" ? "text-right" : "text-center"}`}
          style={{ color: theme.tokens.muted }}
        >
          {String(pageNumber).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}
        </p>
      ) : null}
    </article>
  );
}