import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  createSecurityNonce,
  isProtectedPath,
  isPublicTokenPath,
  isValidNonce,
  SECURITY_HEADER_NAMES,
} from "./security-headers";

describe("nonce", () => {
  it("gera nonces distintos a cada chamada", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createSecurityNonce()));
    expect(nonces.size).toBe(50);
  });

  it("gera um valor hexadecimal de comprimento suficiente", () => {
    expect(createSecurityNonce()).toMatch(/^[0-9a-f]{32}$/);
    expect(isValidNonce(createSecurityNonce())).toBe(true);
  });

  it("rejeita nonces malformados vindos de cabeçalhos", () => {
    expect(isValidNonce("curto")).toBe(false);
    expect(isValidNonce("")).toBe(false);
    expect(isValidNonce(null)).toBe(false);
    expect(isValidNonce(undefined)).toBe(false);
    expect(isValidNonce("'; script-src 'unsafe-inline'")).toBe(false);
  });
});

describe("content security policy", () => {
  it("proíbe embedding e objetos em qualquer ambiente", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("restringe as origens a 'self' por omissão", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("apenas em desenvolvimento libera eval e websockets", () => {
    expect(buildContentSecurityPolicy({ isDevelopment: true })).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ isDevelopment: false })).not.toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ isDevelopment: true })).toContain("ws:");
    expect(buildContentSecurityPolicy({ isDevelopment: false })).not.toContain("ws:");
  });

  it("incorpora o nonce quando é válido e o ignora quando não é", () => {
    expect(buildContentSecurityPolicy({ nonce: "abc123abc123abc123" })).toContain("'nonce-abc123abc123abc123'");
    // Um nonce adulterado não pode ser interpolado na política.
    expect(buildContentSecurityPolicy({ nonce: "'unsafe-inline'" })).not.toContain("nonce-'unsafe");
  });
});

describe("security headers", () => {
  it("define o conjunto completo exigido pelo Tópico 35", () => {
    const headers = buildSecurityHeaders();
    expect(headers[SECURITY_HEADER_NAMES.xContentTypeOptions]).toBe("nosniff");
    expect(headers[SECURITY_HEADER_NAMES.xFrameOptions]).toBe("DENY");
    expect(headers[SECURITY_HEADER_NAMES.referrerPolicy]).toBe("strict-origin-when-cross-origin");
    expect(headers[SECURITY_HEADER_NAMES.crossOriginOpenerPolicy]).toBe("same-origin");
    expect(headers[SECURITY_HEADER_NAMES.crossOriginResourcePolicy]).toBe("same-origin");
    expect(headers[SECURITY_HEADER_NAMES.xDnsPrefetchControl]).toBe("off");
  });

  it("câmara, microfone e geolocalização ficam bloqueados", () => {
    const permissions = buildSecurityHeaders()[SECURITY_HEADER_NAMES.permissionsPolicy];
    expect(permissions).toContain("camera=()");
    expect(permissions).toContain("microphone=()");
    expect(permissions).toContain("geolocation=()");
  });

  it("HSTS só é enviado em contexto seguro", () => {
    // Emitir HSTS em http://localhost deixaria o navegador mais picky e a app
    // local inacessível, por isso a condição é explícita.
    expect(buildSecurityHeaders()[SECURITY_HEADER_NAMES.strictTransportSecurity]).toBeUndefined();
    expect(
      buildSecurityHeaders({ isSecureContext: true })[SECURITY_HEADER_NAMES.strictTransportSecurity],
    ).toContain("max-age=63072000");
  });
});

describe("classificação de rotas", () => {
  it("trata como protegidas as áreas administrativas e do portal", () => {
    for (const path of ["/admin", "/admin/servicos", "/clientes", "/projetos", "/propostas", "/portal/abc"]) {
      expect(isProtectedPath(path)).toBe(true);
    }
  });

  it("não confunde prefixos parecidos com rotas protegidas", () => {
    for (const path of ["/", "/login", "/briefing/xyz", "/api/documents/1", "/administracao"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });

  it("reconhece apenas os links públicos com token bem formado", () => {
    expect(isPublicTokenPath(`/briefing-proposta/${"a".repeat(43)}`)).toBe(true);
    expect(isPublicTokenPath(`/briefing/${"b".repeat(43)}`)).toBe(true);
    expect(isPublicTokenPath("/briefing-proposta/curto")).toBe(false);
    expect(isPublicTokenPath("/briefing-proposta")).toBe(false);
    expect(isPublicTokenPath("/propostas/abc")).toBe(false);
  });
});
