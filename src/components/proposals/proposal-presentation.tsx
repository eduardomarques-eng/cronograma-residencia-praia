type Slide = { title?: string; body?: string };

/** Rótulos de seção da apresentação; o slide real continua vindo do ADMIN. */
const SECTION_LABELS = [
  "Entendimento das necessidades",
  "Direção do projeto",
  "Escopo contratado",
  "Como será desenvolvido",
  "Investimento",
  "Próximos passos",
];

function sectionLabel(index: number): string {
  return SECTION_LABELS[index] ?? "Proposta";
}

function SlideIndex({ current, total }: { current: number; total: number }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
      {String(current).padStart(2, "0")}
      <span className="mx-1 text-slate-300">/</span>
      {String(total).padStart(2, "0")}
    </p>
  );
}

/**
 * Tópicos 31 e 32 — camada editorial dentro da linguagem visual existente:
 * Montserrat, tokens de cor, `surface`/`surface-raised`, mesma hierarquia e
 * espaçamento. Sem efeitos extras e sem identidade nova.
 *
 * Responsividade: em telas pequenas o slide cresce com o conteúdo; a partir de
 * `sm` assume a proporção A3 paisagem (420×297) sem cortar texto.
 */
export function ProposalPresentation({
  clientName,
  projectName,
  title,
  slides,
}: {
  clientName: string;
  projectName: string;
  title: string;
  slides: Slide[];
}) {
  const total = slides.length;

  return (
    <section aria-label="Apresentação da proposta" className="space-y-5">
      <article className="surface-raised overflow-hidden rounded-3xl">
        <div className="flex min-h-[360px] flex-col justify-between gap-10 bg-slate-950 p-7 text-white sm:aspect-[420/297] sm:min-h-0 sm:p-12 lg:p-16">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-300">
              ArqVértice · proposta comercial
            </p>
            <h2 className="mt-6 max-w-3xl text-3xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {title}
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Uma leitura clara do escopo, das condições e do investimento do seu projeto.
            </p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6 border-t border-white/10 pt-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Projeto</p>
              <p className="mt-1 text-sm font-semibold">{projectName}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Preparado para</p>
              <p className="mt-1 text-sm font-semibold">{clientName}</p>
            </div>
          </div>
        </div>
      </article>

      {slides.map((slide, index) => (
        <article key={`${slide.title ?? "slide"}-${index}`} className="surface rounded-2xl">
          <div className="flex min-h-[200px] flex-col justify-between gap-6 p-6 sm:aspect-[420/297] sm:min-h-0 sm:p-12 lg:p-14">
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                  {sectionLabel(index)}
                </p>
                <SlideIndex current={index + 1} total={total} />
              </div>
              <h3 className="mt-4 max-w-3xl text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
                {slide.title}
              </h3>
              <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">
                {slide.body}
              </p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}