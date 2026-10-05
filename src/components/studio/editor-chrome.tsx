"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CanvasMode } from "@/components/studio/slide-canvas";
import type { ChangePreview, SlideChange } from "@/lib/studio-ai";
import type { SaveStatus } from "@/lib/studio-autosave";

/**
 * FASE 4C — A BARRA DE FERRAMENTAS (item 9).
 *
 * Só o essencial, à vista: modo, desfazer/refazer, comparar e guardar. As
 * escolhas de layout, tema e imagem vivem no painel contextual, porque são
 * decisões de CONTEÚDO e não de sessão. É o que o item 9 pede quando diz para
 * evitar ferramentas excessivas na tela.
 */
export type SaveState = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

/**
 * O indicador DISCRETO da gravação automática (item 49).
 *
 * Vive ao lado do botão e nunca o substitui. É deliberadamente silencioso: o
 * item 49 pede "mostrar discretamente", e um painel de estado a saltar seria mais
 * intrusivo do que não mostrar nada. Só o ERRO ganha destaque, porque um erro
 * silencioso é a forma de o utilizador descobrir, ao recarregar, que perdeu
 * meia hora de trabalho.
 *
 * `role="status"` com `aria-live` é o que faz um leitor de ecrã anunciar a
 * gravação — sem isso, o indicador é só visível.
 */
function AutosaveBadge({ status }: { status: SaveStatus }) {
  if (status === "IDLE") return null;

  const rotulos: Record<Exclude<SaveStatus, "IDLE">, { texto: string; cor: string }> = {
    PENDENTE: { texto: "Por gravar…", cor: "text-slate-400" },
    A_GRAVAR: { texto: "A gravar…", cor: "text-slate-500" },
    GRAVADO: { texto: "Gravado", cor: "text-emerald-600" },
    ERRO: { texto: "Erro ao gravar", cor: "text-rose-600" },
  };
  const actual = rotulos[status];

  return (
    <span role="status" aria-live="polite" className={`text-[11px] ${actual.cor}`}>
      {actual.texto}
    </span>
  );
}

export function Toolbar({
  mode,
  onToggleMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onRemix,
  onPreviewChanges,
  themeLabel,
  layoutLabel,
  saveState,
  autosaveStatus = "IDLE",
  readOnly = false,
}: {
  mode: CanvasMode;
  onToggleMode: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onRemix: () => void;
  onPreviewChanges: () => void;
  themeLabel: string;
  layoutLabel: string;
  saveState: SaveState;
  autosaveStatus?: SaveStatus;
  readOnly?: boolean;
}) {
  return (
    <div className="surface flex flex-wrap items-center gap-2 rounded-2xl p-3">
      <div className="flex gap-1">
        <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={onUndo} disabled={!canUndo}>
          Desfazer
        </Button>
        <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={onRedo} disabled={!canRedo}>
          Refazer
        </Button>
      </div>

      <div className="h-5 w-px bg-slate-200" aria-hidden="true" />

      <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={onPreviewChanges}>
        Comparar com a versão inicial
      </Button>
      <Button variant="ghost" className="min-h-9 px-3 text-xs" onClick={onRemix} disabled={readOnly}>
        Criar variação
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-[11px] text-slate-400 sm:inline">
          {layoutLabel} · {themeLabel}
        </span>
        {/*
          O botão de modo não é um extra: ver como o cliente vê é a verificação mais
          barata que existe, e tem de estar a um clique. O mesmo componente desenha
          os dois modos, portanto o preview não mente.
        */}
        <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={onToggleMode}>
          {mode === "edit" ? "Pré-visualizar" : "Voltar a editar"}
        </Button>
        <Button className="min-h-9 px-3 text-xs" onClick={onSave} disabled={saveState.kind === "saving" || readOnly}>
          {saveState.kind === "saving" ? "A gravar…" : "Guardar apresentação"}
        </Button>
        {/* A gravação automática é discreta e fica ao lado do botão manual: um
            painel de estado a saltar seria mais intrusivo do que não mostrar nada. */}
        <AutosaveBadge status={autosaveStatus} />
      </div>

      {/* O resultado do guardado é sempre visível: um botão que falha em silêncio
          deixa o ADMIN a crer que gravou. */}
      {saveState.kind === "saved" ? <p className="w-full text-[11px] text-emerald-700">{saveState.message}</p> : null}
      {saveState.kind === "error" ? <p className="w-full text-[11px] text-rose-700">{saveState.message}</p> : null}
      {readOnly ? (
        <p className="w-full text-[11px] text-slate-500">
          Esta proposta está aprovada ou congelada. A apresentação pode ser pré-visualizada, mas não editada.
        </p>
      ) : null}
    </div>
  );
}

const CHANGE_TONE: Record<SlideChange["kind"], "neutral" | "blue" | "green" | "amber" | "red"> = {
  INALTERADA: "neutral",
  TEXTO: "blue",
  LAYOUT: "amber",
  CONTEUDO: "amber",
  NOVA: "green",
  REMOVIDA: "red",
};

const CHANGE_LABEL: Record<SlideChange["kind"], string> = {
  INALTERADA: "sem alteração",
  TEXTO: "texto",
  LAYOUT: "layout",
  CONTEUDO: "conteúdo",
  NOVA: "nova",
  REMOVIDA: "removida",
};

/**
 * COMPARATIVO original vs alterado (item 17).
 *
 * O painel mostra três coisas, e a terceira é a que importa: quantas páginas
 * mudaram, QUAIS mudaram, e se alguma mudou FORA do âmbito do comando. Um
 * comando localizado que tocasse numa página distante é o defeito que o item 17
 * proíbe, e este é o sítio onde isso aparece à vista em vez de passar.
 */
export function ChangePanel({ preview, onClose }: { preview: ChangePreview; onClose: () => void }) {
  const altered = preview.changes.filter((change) => change.kind !== "INALTERADA");

  return (
    <section aria-label="Comparativo de alterações" className="surface space-y-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">O que mudou</h3>
          <p className="mt-0.5 text-xs text-slate-500">{preview.headline}</p>
        </div>
        <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={onClose}>
          Fechar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="blue">{preview.modified} alteradas</Badge>
        {preview.added > 0 ? <Badge tone="green">{preview.added} novas</Badge> : null}
        {preview.removed > 0 ? <Badge tone="red">{preview.removed} removidas</Badge> : null}
        {preview.scoped ? <Badge tone="green">só dentro do âmbito</Badge> : <Badge tone="red">tocou fora do âmbito</Badge>}
      </div>

      {altered.length === 0 ? (
        <p className="text-xs text-slate-500">Nada mudou.</p>
      ) : (
        <ul className="space-y-1">
          {altered.map((change) => (
            <li key={change.slideId} className="flex items-start gap-2 text-xs">
              <Badge tone={CHANGE_TONE[change.kind]}>{CHANGE_LABEL[change.kind]}</Badge>
              <span className="text-slate-700">
                <span className="font-semibold">{change.title || "(sem título)"}</span> — {change.summary}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}