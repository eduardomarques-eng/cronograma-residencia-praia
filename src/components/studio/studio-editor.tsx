"use client";

import { useEffect, useRef, useState } from "react";
import { SlideCanvas, type CanvasMode } from "@/components/studio/slide-canvas";
import { ContextPanel } from "@/components/studio/context-panel";
import {
  addBlankSlide,
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  undo,
  updateElement,
  updateSlide,
  type History,
} from "@/lib/studio-manipulate";
import {
  affectedSlides,
  assertScopeMatchesSelection,
  previewChanges,
  remixDeck,
  resolveTarget,
  targetText,
  type AiScope,
  type AiSelection,
  type AiTarget,
  type ChangePreview,
} from "@/lib/studio-ai";
import { applyLocalText, canRunLocally, planText, type TextIntent } from "@/lib/studio-text";
import {
  authoritativeValues,
  findCommercialDrift,
  guardCommercialCommand,
} from "@/lib/studio-ai-commercial";
import type { CommercialData } from "@/lib/studio-commercial";
import {
  AUTOSAVE_DEBOUNCE_MS,
  beginSave,
  canSaveManually,
  finishSave,
  INITIAL_AUTOSAVE,
  markDirty,
  shouldSaveNow,
  type AutosaveState,
} from "@/lib/studio-autosave";
import { getTheme } from "@/lib/studio-theme";
import { getLayout } from "@/lib/studio-layout";
import type { MediaAsset } from "@/lib/studio-media";
import { saveProposalPresentationAction } from "@/app/actions/domain-actions";
import { StudioContentError, toPersistedDeck, type StudioDeck, type StudioElement, type StudioSlide } from "@/lib/studio-deck";
import { SlideRail } from "@/components/studio/slide-rail";
import { Toolbar, ChangePanel } from "@/components/studio/editor-chrome";
import { StudioAssist } from "@/components/studio/studio-assist";

/**
 * FASE 4C — O EDITOR VISUAL (item 9).
 *
 * Este componente é a MONTAGEM: junta o painel de páginas, o canvas, o painel
 * contextual e os comandos, e mantém o histórico de desfazer/refazer.
 *
 * A decisão que o mantém sustentável: **o editor não guarda o deck, guarda o
 * HISTÓRICO do deck.** `history.present` é a página que se vê, e cada operação
 * chama `commit`. Isso torna o "desfazer" uma operação do MODELO em vez de uma
 * pilha paralela de interface — e é por isso que desfazer continua a funcionar
 * depois de uma operação da IA, que passa pelo mesmo caminho.
 *
 * O que o editor NÃO faz, de propósito: calcular valores comerciais. Os
 * `metric` são apresentados com o valor que o servidor forneceu. Editar um preço
 * aqui seria criar uma segunda fonte de verdade para o dinheiro.
 */

export type StudioEditorProps = {
  /** Deck de partida, já normalizado no servidor. */
  initialDeck: StudioDeck;
  /** Imagens disponíveis para sugestão e inserção (itens 19 a 24). */
  assets?: readonly MediaAsset[];
  /**
   * Proposta que esta apresentação pertence.
   *
   * É o que liga o editor à `ProposalVersion`. Sem ele o editor funcionaria para
   * pré-visualizar, mas "Guardar" não teria para onde ir — e um botão de gravar
   * que não grava é pior do que não o ter.
   */
  proposalId?: string;
  /** Uma proposta aprovada ou congelada não aceita edição. */
  readOnly?: boolean;
  /**
   * Dados comerciais da proposta, já lidos e validados pelo servidor.
   *
   * Chegam como dados e não como uma leitura feita dentro do componente: a
   * apresentação tem de mostrar o valor da proposta que o servidor leu, e ir
   * buscá-lo do lado do cliente seria outra leitura — possivelmente de outra
   * versão. `null` significa que ainda não há proposta associada.
   */
  commercial?: CommercialData | null;
};

export function StudioEditor({
  initialDeck,
  assets = [],
  proposalId,
  readOnly = false,
  commercial = null,
}: StudioEditorProps) {
  // Uma proposta nova não tem páginas. Sem esta guarda, `deck.slides[0]` seria
  // `undefined` e o editor abriria sem nenhuma página para editar — que é o
  // mesmo que estar quebrado.
  const start = initialDeck.slides.length > 0 ? initialDeck : withFirstBlankSlide(initialDeck);
  const [history, setHistory] = useState<History>(() => createHistory(start));
  const [index, setIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [mode, setMode] = useState<CanvasMode>("edit");
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ChangePreview | null>(null);

  const deck = history.present;
  // `index` pode apontar para uma página que acabou de ser removida: o clamp é
  // o que impede a interface de abrir uma página inexistente.
  const safeIndex = Math.max(0, Math.min(index, deck.slides.length - 1));
  const slide: StudioSlide = deck.slides[safeIndex];
  const theme = getTheme(deck.theme);

  /** Aplica uma alteração e regista-a no histórico. */
  const change = (next: StudioDeck) => {
    setHistory((current) => commit(current, next));
    // `change` é o ÚNICO caminho de alteração do editor. Marcar a gravação aqui
    // garante que nenhum caminho o contorna — que era como o autosave
    // ganhava furos por onde o texto se perdia.
    marcarSujo();
    // Uma alteração real invalida o comparativo aberto: mostrá-lo depois de
    // mexer seria comparar o presente com um passado já enterrado.
    setPreview(null);
  };

  const handleUndo = () => {
    setHistory((current) => undo(current));
    setSelectedElementId(null);
    setPreview(null);
  };

  const handleRedo = () => {
    setHistory((current) => redo(current));
    setSelectedElementId(null);
    setPreview(null);
  };

  /*
   * FASE 4D — ATALHOS DE TECLADO (item 48).
   *
   * `Ctrl+Z` e `Ctrl+Shift+Z` funcionam SEM foco no editor, e o listener está
   * ligado à Janela e não ao canvas: um utilizador que esteve a escrever num
   * campo do painel e carrega Ctrl+Z espera que o texto voltasse atrás, e um
   * atalho preso ao canvas não o faria.
   *
   * O item 48 é explícito: "nunca depender exclusivamente de chamadas à IA para
   * restaurar estado". Estes atelos entram na mesma máquina de estados que os
   * botões — desfazer não é uma função da IA, é uma operação do histórico.
   */
  useEffect(() => {
    /*
     * Os tipos dos eventos são INFERIDOS, não escritos. O `eslint` deste projecto
     * não declara `KeyboardEvent` nem `HTMLElement` como globais, e acrescentá-los
     * por causa de dois parâmetros seria afrouxar a regra do projecto por uma
     * assinatura. A inferência do React dá exactamente o tipo certo.
     */
    const aoTeclar = (evento: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; target: unknown; preventDefault: () => void }) => {
      if (!evento.ctrlKey && !evento.metaKey) return;
      const tecla = evento.key.toLowerCase();
      if (tecla !== "z" && tecla !== "y") return;

      // Num campo de texto, o navegador desfaz melhor do que nós: lidamos com a
      // palavra, não com a página. Intervir aqui seria pior do que não agir.
      const alvo = evento.target as { tagName?: string; isContentEditable?: boolean } | null;
      const emCampo = alvo?.tagName === "INPUT" || alvo?.tagName === "TEXTAREA" || alvo?.isContentEditable === true;
      if (emCampo && tecla === "z") return;

      evento.preventDefault();
      if (tecla === "y" || evento.shiftKey) {
        setHistory((atual) => redo(atual));
      } else {
        setHistory((atual) => undo(atual));
      }
      setSelectedElementId(null);
      setPreview(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const handleEditText = (elementId: string, value: string) => {
    // O título e o corpo da página vivem FORA de `elements`: são os campos que
    // o DTO e o PDF leem. Os restantes são elementos normais da página.
    if (elementId === `${slide.id}-title`) {
      change(updateSlide(deck, safeIndex, { title: value }));
      return;
    }
    if (elementId === `${slide.id}-body`) {
      change(updateSlide(deck, safeIndex, { body: value }));
      return;
    }
    editElementText(change, deck, safeIndex, elementId, value);
  };

  /**
   * Executa um comando de IA.
   *
   * O âmbito é resolvido AQUI com as mesmas funções que o servidor usaria
   * (`assertScopeMatchesSelection` e `resolveTarget`). Se o comando fosse tocar
   * em mais páginas do que devia, o erro aparece ANTES de a apresentação mudar.
   */
  const handleRunAi = (scope: AiScope, selection: AiSelection, instruction: string) => {
    setAiMessage(null);
    try {
      const command = { scope, selection, instruction };
      assertScopeMatchesSelection(command);

      /*
        FASE 4E — GUARDA COMERCIAL (item 55).

        Fica ANTES de qualquer escrita, e não depois. Um comando como "reduza o
        preço em 20%" chega aqui como texto; se a IA fosse chamada, ela
        reescreveria um parágrafo com um número plausível e o cliente aprovaria
        um valor que o servidor nunca emitiu.

        Por isso o comando é classificado primeiro: quando é comercial, a
        apresentação NÃO é tocada e o que se devolve é a acção oficial. O preço
        é recalculado por `computeTotals` sobre uma NOVA VERSÃO, com as
        consequências de versionamento — nunca escrito num elemento de texto.
      */
      const guard = commercial
        ? guardCommercialCommand({
            instruction,
            items: commercial.items,
            adjustment: commercial.adjustment,
          })
        : null;
      if (guard) {
        setAiMessage(
          guard.action.kind === "AJUSTE_PERCENTUAL"
            ? `Alteração comercial — a apresentação não foi alterada. Aplicação oficial: ${guard.action.label}. Confirme na secção de preços, onde subtotal, total e parcelas são recalculados numa nova versão.`
            : guard.action.reason,
        );
        return;
      }

      const target = resolveTarget(deck, selection);
      const current = targetText(target);
      const applied = applyInstruction(deck, command, current, instruction);

      /*
        Verificação da SAÍDA (item 55, terceira camada).

        A guarda acima apanha o pedido explícito. Esta apanha o caso que ela não
        vê: um comando puramente editorial cuja resposta traz um número
        inventado. Comparar o texto anterior com o novo e confrontar com a
        fonte comercial é o que torna a regra uma garantia e não uma intenção.
      */
      const drifts = findCommercialDrift({
        before: current,
        after: applied === deck ? current : targetText(resolveTarget(applied, selection)),
        authoritative: commercial ? authoritativeValues(commercial) : [],
      });
      if (drifts.length) {
        setAiMessage(
          `A alteração foi recusada: ${drifts[0].reason}`,
        );
        return;
      }

      // O comparativo é calculado antes de aplicar: é o item 16 a pedir uma
      // pré-visualização do que muda, e não um relatório depois do facto.
      // A selecção entra para que o âmbito saiba QUAL página era o alvo.
      setPreview(previewChanges(deck, applied, scope, selection));
      change(applied);

      const count = affectedSlides(deck, command).length;
      setAiMessage(`Alteração aplicada em ${count === 1 ? "1 página" : `${count} páginas`}. Reveja no comparativo.`);
    } catch (error) {
      setAiMessage(
        error instanceof StudioContentError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Não foi possível executar o comando.",
      );
    }
  };

  /**
   * Grava a apresentação na `ProposalVersion`.
   *
   * Chama `saveProposalPresentationAction` e NÃO `saveProposalVersionAction`: a
   * segunda recalcula os totais e cria uma versão nova, o que diria ao cliente
   * que o orçamento mudou quando só se mexeu numa legenda. O servidor volta a
   * normalizar e a validar tudo — o editor nunca é a última palavra.
   */
  const [saveState, setSaveState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  /*
   * FASE 4D — GRAVAÇÃO AUTOMÁTICA (item 49).
   *
   * O estado da gravação automática é um `AutosaveState`, e a decisão de gravar
   * vem de `shouldSaveNow`. Nenhuma lógica de temporizador vive aqui: o
   * componente só marca "sujo" e deixa a MÁQUINA decidir. É o que torna a regra
   * de corrida testável sem temporizadores — e foi essa regra que apanhou o caso
   * de uma gravação antiga terminar depois de uma nova.
   */
  const [autosave, setAutosave] = useState<AutosaveState>(INITIAL_AUTOSAVE);
  const [ultimaMarcacao, setUltimaMarcacao] = useState<number | null>(null);

  /*
   * Espelhos em ref do estado que o temporizador precisa de ler.
   *
   * O temporizador dispara fora do ciclo de render: uma closure que lesse
   * `autosave` ou `deck` ficaria com os valores do momento em que foi armado.
   * Gravar esse snapshot significaria gravar o texto de há dois segundos. As
   * refs dão sempre o valor mais recente sem provocar um re-render — que é
   * precisamente o que se pede de um espelho.
   */
  const autosaveRef = useRef(autosave);
  const deckRef = useRef(deck);
  autosaveRef.current = autosave;
  deckRef.current = deck;

  /** Marca o deck como alterado. Chamada por `change`, que é o único caminho. */
  const marcarSujo = () => {
    /*
      `markDirty` é uma FUNÇÃO DE ESTADO e não faz nada quando já há uma
      gravação em curso. Sem isto, escrever durante um pedido lento marcava-se
      sujo, o `markDirty` recusava, e a alteração ficava por gravar para
      sempre. `pendenteDuranteGravacao` guarda essa intenção; ao terminar a
      gravação, o que estava em curso já não é o documento actual, e a
      gravação seguinte apanha-o.
    */
    if (autosaveRef.current.status === "A_GRAVAR") {
      alteracaoDuranteGravacao.current = true;
      return;
    }
    setAutosave(markDirty);
    setUltimaMarcacao(Date.now());
  };
  const alteracaoDuranteGravacao = useRef(false);

  /*
   * O ciclo automático (item 49).
   *
   * O defeito que este código tinha: o efeito terminava em
   *
   *     if (!shouldSaveNow(autosave, Date.now(), ultimaMarcacao)) return;
   *
   *imediatamente antes de armar o temporizador. Como o efeito corre no instante
   * a seguir à tecla, o `debounce` ainda NÃO tinha passado, `shouldSaveNow`
   * devolvia `false`, e o temporizador nunca era criado. Como nada voltava a
   * disparar o efeito 1,5 s depois, **a gravação automática nunca acontecia**.
   * A máquina de estados estava correcta; o agendamento é que nunca a consultava.
   *
   * A correcção é inverter a ordem de perguntas:
   *
   *  1. há algo por gravar? (`PENDENTE`) — se não, não há nada a agendar;
   *  2. falta quanto tempo? — arma-se um temporizador com o TEMPO RESTANTE, ou
   *     grava-se já se o `debounce` já passou;
   *  3. dentro do temporizador, re-checa-se e grava-se.
   *
   * `deckRef` existe porque o temporizador dispara FORA do ciclo de render: a
   * Closure ficaria com o deck de quando foi armado e gravaria texto antigo.
   * Guardar o deck numa ref é ler sempre o valor mais recente, sem provocar
   * um re-render.
   */
  useEffect(() => {
    if (!proposalId) return;
    if (autosave.status !== "PENDENTE") return;

    // Quanto falta do `debounce`. `0` significa "já pode gravar".
    const restante =
      ultimaMarcacao === null ? 0 : Math.max(0, AUTOSAVE_DEBOUNCE_MS - (Date.now() - ultimaMarcacao));

    const gravar = () => {
      const pedido = beginSave(autosaveRef.current);
      // O pedido é actualizado ANTES da chamada de rede: o `beginSave` tem de
      // acontecer no momento do disparo, não dentro de um actualizador de
      // estado. Chamar rede dentro de um updater dispara a escrita duas vezes em
      // StrictMode e é, por si só, um efeito colateral escondido no render.
      autosaveRef.current = pedido;
      setAutosave(pedido);

      void saveProposalPresentationAction(proposalId, toPersistedDeck(deckRef.current))
        .then(() =>
          setAutosave((estado) => {
            const seguinte = finishSave(estado, pedido.sequencia, { ok: true });
            /*
              Houve alterações enquanto este pedido estava em curso? Então o que
              acabou de ser gravado JÁ NÃO é o documento actual, e a gravação
              seguinte apanha-o. Sem esta linha, escrever durante um pedido lento
              perdia a alteração: o editor mostraria "Gravado" para um documento
              que não era o que estava no ecrã.
            */
            if (alteracaoDuranteGravacao.current) {
              alteracaoDuranteGravacao.current = false;
              return { ...markDirty(seguinte), message: null };
            }
            return seguinte;
          }),
        )
        .catch((error: unknown) =>
          setAutosave((estado) =>
            finishSave(estado, pedido.sequencia, {
              ok: false,
              error: error instanceof Error ? error.message : "Não foi possível gravar.",
            }),
          ),
        );
    };

    // Já passou o `debounce`: grava-se sem temporizador.
    if (restante === 0) {
      gravar();
      return;
    }

    const temporizador = setTimeout(() => {
      // Re-checado: entre armar e disparar, o utilizador pode ter carregado em
      // "Gravar", desfeito, ou a gravação anterior ainda estar em curso.
      if (!shouldSaveNow(autosaveRef.current, Date.now(), ultimaMarcacao)) return;
      gravar();
    }, restante);

    return () => clearTimeout(temporizador);
    // `ultimaMarcacao` é a dependência que importa: cada tecla muda-a, o que
    // cancela o temporizador anterior e arma o novo. É o `debounce`.
  }, [autosave.status, ultimaMarcacao, proposalId]);

  const handleSave = async () => {
    if (!proposalId) {
      setSaveState({ kind: "error", message: "Esta apresentação ainda não está ligada a uma proposta." });
      return;
    }
    // Durante uma gravação não se volta a pedir: o backend receberia o mesmo
    // documento duas vezes sem que nada tivesse mudado.
    if (!canSaveManually(autosave)) return;

    setSaveState({ kind: "saving" });
    // A gravação manual passa pelo MESMO caminho da automática, para que a
    // guarda de corrida não tenha de ser mantida em dois sítios — e para que o
    // resultado apareça no mesmo indicador.
    const pedido = beginSave(autosave);
    setAutosave(pedido);
    try {
      const result = await saveProposalPresentationAction(proposalId, toPersistedDeck(deck));
      setAutosave((estado) => finishSave(estado, pedido.sequencia, { ok: true }));
      setSaveState({ kind: "saved", message: `Gravado na versão ${result.version} (${result.slides} páginas).` });
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Não foi possível gravar.";
      setAutosave((estado) => finishSave(estado, pedido.sequencia, { ok: false, error: mensagem }));
      setSaveState({ kind: "error", message: mensagem });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
      <SlideRail
        deck={deck}
        index={safeIndex}
        onSelect={(next) => {
          setIndex(next);
          setSelectedElementId(null);
        }}
        onChange={change}
      />

      <div className="space-y-3">
        <Toolbar
          mode={mode}
          onToggleMode={() => setMode(mode === "edit" ? "preview" : "edit")}
          canUndo={canUndo(history)}
          canRedo={canRedo(history)}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleSave}
          saveState={saveState}
        autosaveStatus={autosave.status}
          readOnly={readOnly}
          onRemix={() => change(remixDeck({ source: deck, origin: { proposalId: "atual", version: deck.slides.length, label: "Variação" }, variantKey: `v${deck.slides.length}` }))}
          onPreviewChanges={() => setPreview(previewChanges(initialDeck, deck))}
          themeLabel={theme.label}
          layoutLabel={getLayout(slide.layout).label}
        />

        <div className="surface overflow-hidden rounded-2xl">
          <SlideCanvas
            slide={slide}
            theme={theme}
            mode={mode}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onEditText={handleEditText}
            pageNumber={safeIndex + 1}
            totalPages={deck.slides.length}
            commercial={commercial}
          />
        </div>

        {preview ? <ChangePanel preview={preview} onClose={() => setPreview(null)} /> : null}
      </div>

      {/*
        FASE 4E — INTEGRAÇÃO (fecha a lacuna medida na auditoria da 4C-1).

        Este painel é o caminho para os módulos de templates, importação, geração,
        sugestões e pré-visualização. Passa por `onChange`, que é o mesmo caminho
        do histórico: desfazer uma importação funciona como desfazer um texto.
      */}
      <StudioAssist deck={deck} readOnly={readOnly} onChange={change} />

      <ContextPanel
        deck={deck}
        index={safeIndex}
        selectedElementId={selectedElementId}
        onSelectElement={setSelectedElementId}
        onChangeDeck={change}
        onRunAi={handleRunAi}
        assets={assets}
        aiMessage={aiMessage}
      />
    </div>
  );
}

/**
 * Aplica uma instrução de IA ao deck, resolvendo o texto pelo alvo.
 *
 * Quando a operação é LOCAL (preservar, resumir, listar), o texto é resolvido
 * sem rede. Quando exige um modelo, o plano é sempre `MODELO` e o editor não
 * finge: devolve o deck inalterado e diz porquê. Um botão que parece ter feito
 * algo e não fez é pior do que um botão que explica que precisa de um serviço.
 */
function applyInstruction(
  deck: StudioDeck,
  command: { scope: AiScope; selection: AiSelection; instruction: string },
  current: string,
  instruction: string,
): StudioDeck {
  const intent = resolveIntent(instruction);
  const plan = planText(intent);

  if (!canRunLocally(intent) || plan.strategy !== "LOCAL") {
    throw new StudioContentError(
      "Esta alteração precisa de um serviço de linguagem, que ainda não está ligado. Escreva a alteração à mão por agora.",
    );
  }

  const next = applyLocalText(intent, current);
  if (next === null) {
    throw new StudioContentError("Não foi possível aplicar esta alteração a este texto.");
  }

  const target = resolveTarget(deck, command.selection);
  return writeTarget(deck, target, next);
}

/** Lê a intenção a partir das palavras do pedido, sem inventar. */
function resolveIntent(instruction: string): TextIntent {
  const value = instruction.toLowerCase();
  if (value.includes("resum") || value.includes("curt") || value.includes("short")) return "SHORTEN";
  if (value.includes("lista") || value.includes("tópicos") || value.includes("topicos")) return "TO_LIST";
  if (value.includes("manter") || value.includes("preservar") || value.includes("igual")) return "PRESERVE";
  if (value.includes("melhor") || value.includes("rev")) return "IMPROVE";
  return "REWRITE";
}

/**
 * Escreve o texto resolvido no alvo.
 *
 * `PRESENTACAO` escreve o corpo de TODAS as páginas — é o que o âmbito "Tudo"
 * significa, e é por isso que a interface o mostra antes de executar. Um alvo
 * `ELEMENTO` não-texto não é tocado: não há texto para escrever numa imagem.
 */
function writeTarget(deck: StudioDeck, target: AiTarget, value: string): StudioDeck {
  if (target.kind === "PRESENTACAO") {
    let next = deck;
    target.slides.forEach((entry) => {
      const index = next.slides.findIndex((slide) => slide.id === entry.id);
      if (index >= 0) next = updateSlide(next, index, { body: value });
    });
    return next;
  }

  const index = deck.slides.findIndex((slide) => slide.id === target.slide.id);
  if (index < 0) throw new StudioContentError("A página já não existe nesta apresentação.");

  if (target.kind === "SLIDE") return updateSlide(deck, index, { body: value });

  if (target.element.kind !== "text") {
    throw new StudioContentError(
      "Este elemento não é texto. Escolha o texto que quer alterar, ou peça outra operação.",
    );
  }
  return updateElement(deck, index, target.element.id, { text: value });
}

/**
 * Garante que o deck tem pelo menos uma página.
 *
 * Uma proposta acabado de criar não tem apresentação. O editor precisa de uma
 * página para mostrar, e esta função devolve a primeira — uma capa vazia — para
 * que o ADMIN comece a escrever em vez de ver um ecrã morto.
 */
function withFirstBlankSlide(deck: StudioDeck): StudioDeck {
  return addBlankSlide(deck, 0, "cover");
}

/** Grava o texto de um elemento `text` a partir do próprio canvas. */
function editElementText(
  change: (next: StudioDeck) => void,
  deck: StudioDeck,
  index: number,
  elementId: string,
  value: string,
): void {
  const element = deck.slides[index]?.elements.find((entry) => entry.id === elementId);
  // Só o elemento de texto tem texto. Um id que não corresponda a nada é
  // ignorado: pode ser um campo que acabou de ser removido.
  if (!element || element.kind !== "text") return;
  change(updateElement(deck, index, elementId, { text: value } satisfies Partial<StudioElement>));
}