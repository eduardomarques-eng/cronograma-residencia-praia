/**
 * Tópico 35 — camada de cabeçalhos de segurança.
 *
 * Funções puras e determinísticas: o mesmo conjunto de cabeçalhos é aplicado em
 * desenvolvimento e em produção, e pode ser verificado por teste unitário sem
 * subir o Next.js. O middleware consome apenas estas funções.
 */

export const SECURITY_HEADER_NAMES = {
  contentSecurityPolicy: "Content-Security-Policy",
  strictTransportSecurity: "Strict-Transport-Security",
  xContentTypeOptions: "X-Content-Type-Options",
  xFrameOptions: "X-Frame-Options",
  referrerPolicy: "Referrer-Policy",
  permissionsPolicy: "Permissions-Policy",
  crossOriginOpenerPolicy: "Cross-Origin-Opener-Policy",
  crossOriginResourcePolicy: "Cross-Origin-Resource-Policy",
  xDnsPrefetchControl: "X-DNS-Prefetch-Control",
} as const;

export type SecurityHeaderOptions = {
  /** Em produção o nonce é obrigatório: sem ele a CSP bloqueia o Next.js. */
  nonce?: string | null;
  isDevelopment?: boolean;
  /** HSTS só faz sentido em conexões HTTPS; em `http://localhost` quebra o teste local. */
  isSecureContext?: boolean;
};

/** Nonce por resposta: nunca reutilizado, sempre aleatório. */
export function createSecurityNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isValidNonce(nonce: unknown): nonce is string {
  return typeof nonce === "string" && /^[A-Za-z0-9+/=_-]{16,}$/.test(nonce);
}

/**
 * Tópico 35 / Prompt Master 9 — CSP restritiva.
 *
 * ⚠️ `'unsafe-inline'` PERMANECE em `script-src`. Não é descuido: foi
 * verificado empiricamente que não pode ser removido hoje.
 *
 * Motivo exacto: o nonce só é aplicado pelo Next.js em páginas renderizadas
 * NO PEDIDO. As páginas marcadas como estáticas no build (○ em `next build`,
 * com `x-nextjs-prerender: 1`) têm o HTML gerado em BUILD TIME, antes de o
 * middleware correr — não existe nonce que lhes chegue. `/login` é uma delas:
 * 16 `<script>`, 0 com nonce.
 *
 * Consequência de remover: em `/login` o browser bloquearia todos os scripts e
 * a aplicação ficaria sem JavaScript — login, decisões e formulários morreriam.
 *
 * O QUE JÁ FOI CORRIGIDO: o middleware passou a construir um `Headers` NOVO.
 * Mutar `request.headers` não propaga no Next.js 15 e fazia a CSP ser
 * decorativa mesmo nas páginas dinâmicas.
 *
 * CAMINHO para remover o `'unsafe-inline'`, por ordem:
 *   1. tornar dinâmicas as páginas que precisam do nonce (remover
 *      `export const dynamic = "force-static"`/prerender, ou marcar `force-dynamic`);
 *   2. confirmar por medição que 100% dos `<script>` leva o nonce;
 *   3. só então remover `'unsafe-inline'` de `script-src`.
 *
 * `style-src` mantém `'unsafe-inline'` por outro motivo: o React emite
 * `style="..."` inline nos componentes, que não é controlável por nonce.
 */
export function buildContentSecurityPolicy(options: SecurityHeaderOptions = {}): string {
  const { nonce, isDevelopment = false } = options;
  const scriptSources = ["'self'", "'unsafe-inline'"];
  if (isValidNonce(nonce)) scriptSources.push(`'nonce-${nonce}'`);
  if (isDevelopment) scriptSources.push("'unsafe-eval'");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    // Tailwind e os estilos inline dos componentes exigem isto.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

/**
 * Conjunto completo de cabeçalhos. Nenhum valor depende do ambiente exceto a
 * CSP e o HSTS, ambos com justificativa explícita acima.
 */
export function buildSecurityHeaders(options: SecurityHeaderOptions = {}): Record<string, string> {
  const { isSecureContext = false } = options;
  const headers: Record<string, string> = {
    [SECURITY_HEADER_NAMES.contentSecurityPolicy]: buildContentSecurityPolicy(options),
    [SECURITY_HEADER_NAMES.xContentTypeOptions]: "nosniff",
    [SECURITY_HEADER_NAMES.xFrameOptions]: "DENY",
    [SECURITY_HEADER_NAMES.referrerPolicy]: "strict-origin-when-cross-origin",
    [SECURITY_HEADER_NAMES.permissionsPolicy]:
      "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    [SECURITY_HEADER_NAMES.crossOriginOpenerPolicy]: "same-origin",
    [SECURITY_HEADER_NAMES.crossOriginResourcePolicy]: "same-origin",
    [SECURITY_HEADER_NAMES.xDnsPrefetchControl]: "off",
  };

  if (isSecureContext) {
    headers[SECURITY_HEADER_NAMES.strictTransportSecurity] =
      "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}

/** Caminhos que exigem sessão. Avaliados só como filtro antecipado no middleware. */
export const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/clientes",
  "/projetos",
  "/propostas",
  "/portal",
  "/relatorio",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Tópico 35 — rotas públicas por token. São acessíveis sem sessão porque a
 * autorização vem do segredo do link; nunca devem ser bloqueadas aqui.
 */
export function isPublicTokenPath(pathname: string): boolean {
  // Prompt 19, item 51: o mesmo limite superior do token da proposta. Sem
  // ele, um link com path de vários megabytes passava o teste e ainda era
  // hasheado no banco.
  return /^\/(briefing|briefing-proposta)\/[A-Za-z0-9_-]{40,128}$/.test(pathname);

}
