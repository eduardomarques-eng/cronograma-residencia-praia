"use client";

import { useState } from "react";
import {
  addBlankSlide,
  duplicateSlide,
  moveSlide,
  removeSlide,
  reorderSlides,
  setSlideHidden,
} from "@/lib/studio-manipulate";
import { getLayout } from "@/lib/studio-layout";
import type { StudioDeck } from "@/lib/studio-deck";

/**
 * FASE 4C — O PAINEL DE PÁGINAS (item 9).
 *
 * O item 8 lista o que este painel tem de suportar: inserir, duplicar, remover,
 * mover, ocultar e restaurar. Aqui está a lista completa — e cada botão é
 * pequeno de propósito, porque o painel de páginas é navegação, não edição de
 * conteúdo.
 *
 * A miniatura NÃO é uma imagem da página. Desenhar a página duas vezes (uma
 * como imagem e outra como canvas) faria as duas versões divergirem. A miniatura
 * mostra o TÍTULO e o layout — que é o que distingue uma página da outra numa
 * lista.
 *
 * FASE 4D — ARRASTAR PARA REORDENAR (item 47).
 *
 * O item 47 pede arrastar e largar só onde MELHORA A EXPERIÊNCIA, e proíbe um
 * editor de posicionamento ao píxel. Aqui o arrasto serve para uma coisa: pôr as
 * páginas na ordem em que se quer apresentá-las — que é a operação mais frequente
 * de quem monta uma proposta, e a mais tediosa com botões "subir"/"descer".
 *
 * Os botões continuam lá, de propósito. Arrastar é um atalho para quem sabe,
 * e os botões são o caminho para quem não sabe — e para quem usa teclado. Um
 * painel que só funciona com rato não é um painel completo.
 */
export function SlideRail({
  deck,
  index,
  onSelect,
  onChange,
}: {
  deck: StudioDeck;
  index: number;
  onSelect: (index: number) => void;
  onChange: (next: StudioDeck) => void;
}) {
  /*
   * A página a arrastar e o destino. Vêm em `useState` e não em `useRef` porque
   * precisam de re-render para o contorno de inserção aparecer — sem isso, o
   * utilizador arrasta sem qualquer feedback e não sabe onde larga.
   */
  const [arrastada, setArrastada] = useState<string | null>(null);
  const [destino, setDestino] = useState<number | null>(null);

  /** Move a página arrastada para a posição de destino. */
  const largarEm = (posicao: number) => {
    if (!arrastada || destino === null) return;
    // A ordem final vem por identificador, nunca por índice: com índices, largar
    // uma página acima da sua posição actual erraria a ordem.
    const ids = deck.slides.map((slide) => slide.id);
    const de = ids.indexOf(arrastada);
    if (de < 0) return;
    ids.splice(de, 1);
    ids.splice(destino, 0, arrastada);
    onChange(reorderSlides(deck, ids));
    setArrastada(null);
    setDestino(null);
  };

  return (
    <nav aria-label="Páginas da apresentação" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Páginas</h2>
        <span className="text-[11px] text-slate-400">
          {index + 1}/{deck.slides.length}
        </span>
      </div>

      <ol className="space-y-1">
        {deck.slides.map((slide, position) => (
          <li key={slide.id}>
            <div
              className={`rounded-xl border p-2 transition-colors ${
                position === index ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
              }`}
              /*
                Arrastar a PÁGINA. O contorno de inserção é a única pista de
                destino: sem ele, o utilizador larga a página e só depois descobre
                onde ela ficou.
              */
              draggable
              aria-grabbed={arrastada === slide.id}
              onDragStart={(evento) => {
                setArrastada(slide.id);
                evento.dataTransfer.effectAllowed = "move";
                // `setData` é obrigatório no Firefox para o arrasto arrancar.
                evento.dataTransfer.setData("text/plain", slide.id);
              }}
              onDragOver={(evento) => {
                evento.preventDefault();
                evento.dataTransfer.dropEffect = "move";
                if (destino !== position) setDestino(position);
              }}
              onDrop={(evento) => {
                evento.preventDefault();
                largarEm(position);
              }}
              onDragEnd={() => {
                setArrastada(null);
                setDestino(null);
              }}
              style={destino === position && arrastada !== null ? { outline: "2px dashed #2563eb" } : undefined}
            >
              <button
                type="button"
                onClick={() => onSelect(position)}
                aria-current={position === index ? "page" : undefined}
                className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold text-slate-400">{String(position + 1).padStart(2, "0")}</span>
                  {slide.hidden ? <span className="text-[10px] font-semibold text-amber-600">oculta</span> : null}
                </div>
                <p className={`mt-0.5 truncate text-xs font-semibold ${slide.title ? "text-slate-800" : "text-slate-400"}`}>
                  {slide.title || "(sem título)"}
                </p>
                <p className="truncate text-[10px] text-slate-400">{getLayout(slide.layout).label}</p>
              </button>

              <div className="mt-1.5 flex flex-wrap gap-1">
                <MiniButton label="Subir" disabled={position === 0} onClick={() => onChange(moveSlide(deck, position, position - 1))} />
                <MiniButton
                  label="Descer"
                  disabled={position === deck.slides.length - 1}
                  onClick={() => onChange(moveSlide(deck, position, position + 1))}
                />
                <MiniButton label="Duplicar" onClick={() => onChange(duplicateSlide(deck, position))} />
                <MiniButton label={slide.hidden ? "Mostrar" : "Ocultar"} onClick={() => onChange(setSlideHidden(deck, position, !slide.hidden))} />
                <MiniButton
                  label="Remover"
                  tone="danger"
                  // A última página não é removível: o módulo já lança, e um botão
                  // que funciona às vezes é pior do que um botão desligado.
                  disabled={deck.slides.length === 1}
                  onClick={() => onChange(removeSlide(deck, position))}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => {
          onChange(addBlankSlide(deck, deck.slides.length));
          onSelect(deck.slides.length);
        }}
        className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        + Adicionar página
      </button>
    </nav>
  );
}

function MiniButton({
  label,
  onClick,
  disabled = false,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-30 ${
        tone === "danger" ? "text-rose-600 hover:bg-rose-50" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}