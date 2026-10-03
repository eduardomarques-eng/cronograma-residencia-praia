/**
 * Marca da ARQVERTICE: logótipo + nome completo.
 *
 * Usada no ecrã de login e na recuperação de senha, para que os dois pontos de
 * entrada tenham exatamente a mesma identidade. `compact` reduz a marca para
 * ecrãs pequenos; `className` deixa o invólucro ocupar a área pretendida.
 */
export function Brand({
  compact = false,
  showTagline = true,
  className = "",
  decorative = false,
}: {
  compact?: boolean;
  showTagline?: boolean;
  className?: string;
  /** Marca de água decorativa: ignorada por leitores de ecrã. */
  decorative?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-3 ${className}`}
      {...(decorative ? { "aria-hidden": true as const } : {})}
    >
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-2xl bg-slate-900 ${compact ? "h-9 w-9" : "h-11 w-11"}`}
      >
        <svg viewBox="0 0 64 64" className={compact ? "h-5 w-5" : "h-6 w-6"} fill="none">
          <path d="M18 45V19h8v18h20v8H18Z" fill="#fff" />
          <path d="M34 19h12v8H34z" fill="#2563eb" />
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className={`font-bold tracking-tight text-slate-900 ${compact ? "text-base" : "text-lg"}`}>
          ARQVERTICE
          <span className="text-blue-600">.</span>
        </span>
        {showTagline ? (
          <span className={`text-slate-500 ${compact ? "text-[11px]" : "text-xs"}`}>Arquitetura e Engenharia</span>
        ) : null}
      </span>
    </span>
  );
}