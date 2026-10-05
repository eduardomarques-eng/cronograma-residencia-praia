import { describe, expect, it } from "vitest";
import { whatsappContactUrl, whatsappShareUrl } from "./whatsapp-links";

describe("item 51 — WhatsApp como canal principal", () => {
  it("preenche a mensagem e o link na partilha", () => {
    const url = whatsappShareUrl("Uma casa ao entardecer");
    expect(url).toContain("https://wa.me/?text=");
    expect(url).toContain(encodeURIComponent("Uma casa"));
  });

  it("codifica o texto — um & solto mudaria a mensagem sem aviso", () => {
    // `encodeURI` deixaria passar `&` e `#`, que o WhatsApp leria como
    // separadores: o cliente enviaria metade da mensagem.
    const url = whatsappShareUrl("Preço & condições #urgente");
    expect(url).toContain("%26");
    expect(url).toContain("%23");
  });

  it("não deixa o link partir a mensagem", () => {
    // O link viaja CODIFICADO dentro do texto. Se o `&` do query string
    // escapasse, o WhatsApp leria-o como separador de parâmetro e o cliente
    // receberia a mensagem cortada a meio do endereço.
    const link = "https://exemplo.pt/proposta?token=abc&x=1";
    const url = whatsappShareUrl(`Veja ${link}`);
    expect(url).toContain(encodeURIComponent(link));
    // Um `&x=1` solto no query string do `wa.me` seria o bug em forma visível.
    expect(url).not.toContain("&x=1");
  });

  it("constrói conversa directa a partir do telefone", () => {
    const url = whatsappContactUrl("+351 912 345 678", "Olá");
    // O WhatsApp exige o número limpo, com indicativo e sem `+`.
    expect(url).toContain("/351912345678");
  });

  it("aceita um número já em formato internacional", () => {
    expect(whatsappContactUrl("00351912345678", "Olá")).toContain("/351912345678");
  });

  it("um telefone com espaços e parênteses não quebra o link", () => {
    expect(whatsappContactUrl("(351) 912-345-678", "Olá")).toContain("/351912345678");
  });
});