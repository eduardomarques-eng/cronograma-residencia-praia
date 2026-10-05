"use client";

import { useMemo, useState } from "react";
import {
  applyTemplate,
  blankDeck,
  CATEGORY_LABELS,
  TEMPLATE_CATEGORIES,
  templatesByCategory,
  type TemplateCategory,
} from "@/lib/studio-templates";
import { applyImprovements, suggestImprovements } from "@/lib/studio-copilot";
import { applyImportMode, buildImportedDeck, IMPORT_MODES, importReviewSummary, type ImportMode } from "@/lib/studio-import";
import { generateFromProject, type ProjectFacts } from "@/lib/studio-generate";
import { PREVIEW_MODES, type PreviewMode } from "@/lib/studio-preview";
import type { CommercialSlots, StudioDeck } from "@/lib/studio-deck";

/**
 * FASE 4E — O PAINEL QUE LIGA OS MÓDULOS (fecha a lacuna de integração).
 *
 * Este componente existe por uma razão medida, não por estilo. Seis módulos de
 * domínio — templates, copilot, importação, geração, preview e marca — estavam
 * implementados e testados, e **nenhum tinha um caminho a partir do editor**.
 * Um teste verde provava a lógica; não provava que o ADMIN chegava lá. É
 * exactamente o que a regra de qualidade proíbe: "o componente renderiza" não
 * é integração.
 *
 * O painel é um único ponto de entrada sobre `onChange(deck)`. Todas as
 * operações passam pelo mesmo `history` do editor, o que significa que desfazer
 * funciona para uma importação e para um template exactamente como funciona
 * para um texto — sem uma segunda pilha de histórico para manter.
 *
 * NADA aqui escreve directamente. Todas as funções devolvem um deck novo e é o
 * editor que o commita. Um painel que gravasse por fora do `history` produziria
 * um desfazer que não desfaz.
 */
export function StudioAssist({
  deck,
  readOnly,
  onChange,
  /** O que o projecto sabe, para a geração. Vem do servidor. */
  facts,
  /** Os valores reais da proposta. A geração não corre sem eles. */
  slots,
  onPreviewModeChange,
}: {
  deck: StudioDeck;
  readOnly: boolean;
  onChange: (deck: StudioDeck) => void;
  facts?: ProjectFacts | null;
  slots?: CommercialSlots | null;
  onPreviewModeChange?: (mode: PreviewMode) => void;
}) {
  const [categoria, setCategoria] = useState<TemplateCategory>(TEMPLATE_CATEGORIES[0]);
  const [colado, setColado] = useState("");
  const [modo, setModo] = useState<ImportMode>(IMPORT_MODES[0].mode);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const sugestoes = useMemo(() => suggestImprovements(deck), [deck]);
  const revisao = useMemo(
    () => (colado.trim() ? importReviewSummary(applyImportMode(buildImportedDeck([{ page: 1, text: colado }]), modo)) : null),
    [colado, modo],
  );

  /** Aplica e avisa — um botão que não diz o que fez obriga o ADMIN a adivinhar. */
  const aplicar = (proximo: StudioDeck, texto: string) => {
    if (readOnly) return;
    onChange(proximo);
    setMensagem(texto);
  };

  return (
    <aside className="surface space-y-5 rounded-2xl p-4" aria-label="Ferramentas da apresentação">
      <h2 className="text-sm font-semibold text-slate-900">Criar e estruturar</h2>


      {/* --- GERAR (Project-to-Proposta) ------------------------------------- */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gerar a partir do projecto</h3>
        {facts && slots ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              try {
                const resultado = generateFromProject({ facts, source: slots, title: deck.slides[0]?.title || "Proposta" });
                aplicar(resultado.deck, `Apresentação gerada com ${resultado.pages.length} página(s).`);
              } catch (erro) {
                // A verificação comercial falha aqui, e a razão é mostrada.
                setMensagem(erro instanceof Error ? erro.message : "Não foi possível gerar a apresentação.");
              }
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Gerar estrutura
          </button>
        ) : (
          <p className="text-[11px] leading-4 text-slate-500">
            A geração precisa dos dados do projecto e dos valores da proposta, resolvidos no servidor.
          </p>
        )}
      </section>

      {/* --- TEMPLATES ------------------------------------------------------- */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Templates</h3>
        <label className="sr-only" htmlFor="studio-categoria">Categoria de template</label>
        <select
          id="studio-categoria"
          value={categoria}
          onChange={(evento) => setCategoria(evento.target.value as TemplateCategory)}
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        >
          {TEMPLATE_CATEGORIES.map((chave) => (
            <option key={chave} value={chave}>
              {CATEGORY_LABELS[chave]}
            </option>
          ))}
        </select>
        <div className="space-y-1">
          {templatesByCategory(categoria).map((template) => (
            <div key={template.key} className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] text-slate-600">{template.label}</span>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => aplicar(applyTemplate(template, deck), `Template aplicado: ${template.label}.`)}
                className="shrink-0 rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50 disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            // Confirmação porque a acção é destrutiva.
            if (window.confirm("Isto substitui a apresentação actual por uma vazia. Continuar?")) {
              aplicar(blankDeck(deck.theme), "Apresentação esvaziada.");
            }
          }}
          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] hover:bg-slate-50 disabled:opacity-50"
        >
          Começar de novo (deck vazio)
        </button>
      </section>

      {/* --- COLAR / IMPORTAR ------------------------------------------------ */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colar ou importar texto</h3>
        <label className="sr-only" htmlFor="studio-colado">Texto a importar</label>
        <textarea
          id="studio-colado"
          value={colado}
          onChange={(evento) => setColado(evento.target.value)}
          rows={5}
          placeholder="Cole aqui o texto de uma proposta existente..."
          className="w-full rounded-lg border border-slate-200 p-2 text-[11px]"
        />
        <label className="sr-only" htmlFor="studio-modo">Modo de importação</label>
        <select
          id="studio-modo"
          value={modo}
          onChange={(evento) => setModo(evento.target.value as ImportMode)}
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]"
        >
          {IMPORT_MODES.map((definicao) => (
            <option key={definicao.mode} value={definicao.mode}>
              {definicao.label}
            </option>
          ))}
        </select>
        {revisao ? <p className="rounded-lg bg-slate-50 p-2 text-[11px] leading-4 text-slate-600">{revisao.note}</p> : null}
        <button
          type="button"
          disabled={readOnly || !colado.trim()}
          onClick={() => {
            const resultado = applyImportMode(buildImportedDeck([{ page: 1, text: colado }]), modo);
            aplicar(resultado.deck, importReviewSummary(resultado).note);
            setColado("");
          }}
          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] hover:bg-slate-50 disabled:opacity-50"
        >
          Importar como páginas
        </button>
      </section>

      {/* --- SUGESTÕES ------------------------------------------------------- */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sugestões</h3>
        {sugestoes.length ? (
          <>
            <ul className="space-y-1 text-[11px] text-slate-600">
              {sugestoes.map((sugestao, indice) => (
                <li key={indice}>{sugestao.summary}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => aplicar(applyImprovements(deck, sugestoes), `${sugestoes.length} melhoria(s) aplicada(s).`)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] hover:bg-slate-50 disabled:opacity-50"
            >
              Aplicar todas
            </button>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">Nada a sugerir nesta apresentação.</p>
        )}
      </section>

      {/* --- PREVIEW --------------------------------------------------------- */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pré-visualizar</h3>
        <div className="flex flex-wrap gap-1">
          {PREVIEW_MODES.map((device) => (
            <button
              key={device.mode}
              type="button"
              onClick={() => onPreviewModeChange?.(device.mode)}
              className="rounded border border-slate-200 px-2 py-1 text-[11px] hover:bg-slate-50"
            >
              {device.label}
            </button>
          ))}
        </div>
      </section>

      {/* O resultado é sempre visível: um botão que falha em silêncio faz o ADMIN
          acreditar que a apresentação mudou quando não mudou. */}
      <p role="status" aria-live="polite" className="min-h-4 text-[11px] text-slate-600">
        {mensagem ?? ""}
      </p>
    </aside>
  );
}
