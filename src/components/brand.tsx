import Image from "next/image";

/**
 * Dimensões reais de `public/logo.png` (1000x1000). Declaradas para o
 * `next/image` nunca ter de adivinhar a proporção.
 */
const LOGO_SIZE = { width: 1000, height: 1000 } as const;

/**
 * Marca da ARQVERTICE: logotipo oficial + nome.
 *
 * A imagem vem de `public/logo.png` — o ficheiro entregue pelo ADMIN. Não é
 * redesenhada em CSS nem recriada em SVG: é usada como foi fornecida e apenas
 * redimensionada pelo `next/image`, que preserva a proporção.
 *
 * Usada no ecrã de login, na recuperação de senha e como marca de água.
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
      <Image
        src="/logo.png"
        alt={decorative ? "" : "ARQVERTICE Arquitetura e Engenharia"}
        {...LOGO_SIZE}
        priority
        className={`shrink-0 object-contain ${compact ? "h-9 w-9" : "h-12 w-12"}`}
      />
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
