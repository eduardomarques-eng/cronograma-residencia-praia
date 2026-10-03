import { describe, expect, it } from "vitest";
import { buildWhatsAppLink, buildWhatsAppMessage, normalizeWhatsAppPhone } from "./whatsapp";

describe("whatsapp da proposta comercial", () => {
  it("substitui placeholders e preserva chaves desconhecidas", () => {
    const rendered = buildWhatsAppMessage("Oi {{cliente}}, valor {{valor}} {{naoExiste}}", {
      CLIENTE: "Ana",
      VALOR: "R$ 10,00",
    });
    expect(rendered.text).toBe("Oi Ana, valor R$ 10,00 {{naoExiste}}");
    expect(rendered.missing).toEqual(["NAOEXISTE"]);
  });

  it("normaliza o telefone e rejeita números curtos", () => {
    expect(normalizeWhatsAppPhone("(11) 98888-7777")).toBe("11988887777");
    expect(normalizeWhatsAppPhone("+55 11 98888-7777")).toBe("5511988887777");
    expect(normalizeWhatsAppPhone("123")).toBeNull();
    expect(normalizeWhatsAppPhone(null)).toBeNull();
  });

  it("monta o link wa.me com a mensagem escapada", () => {
    const link = buildWhatsAppLink("(11) 98888-7777", "Olá, tudo bem?");
    expect(link).toBe("https://wa.me/11988887777?text=Ol%C3%A1%2C%20tudo%20bem%3F");
  });

  it("lança erro ao montar link sem telefone válido", () => {
    expect(() => buildWhatsAppLink("", "oi")).toThrow("Telefone inválido");
  });

  it("sinaliza as variáveis obrigatórias ausentes para bloquear o envio", () => {
    const rendered = buildWhatsAppMessage("Olá {{cliente}}! {{link}}", { CLIENTE: "Ana" });
    expect(rendered.missingRequired).toEqual(["LINK"]);
  });

  it("considera o template completo quando as obrigatórias estão presentes", () => {
    const rendered = buildWhatsAppMessage("Olá {{cliente}}! {{link}}", {
      CLIENTE: "Ana",
      LINK: "https://app.exemplo/briefing-proposta/token-seguro",
    });
    expect(rendered.missingRequired).toEqual([]);
    expect(rendered.text).not.toContain("{{");
  });
});
