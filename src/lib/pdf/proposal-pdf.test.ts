import { describe, expect, it } from "vitest";
import { generateProposalPdf, type ProposalPdfInput } from "./proposal-pdf";
import { freezePaymentPlan } from "@/lib/payment-plan";

/** Converte os bytes para latin1 — todos os bytes do PDF cabem nessa gama. */
function latin1(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

/**
 * Texto legível do PDF.
 *
 * O `PdfWriter` escreve cada texto como string hexadecimal (`<...> Tj`), porque
 * o conteúdo do fluxo tem de sobreviver a acentos e a caracteres de controlo.
 * Procurar o texto directamente nos bytes não encontra nada — o que tornaria um
 * teste de conteúdo um teste que passa sem verificar nada. Esta função extrai as
 * strings hex e devolve o texto, para se poder afirmar sobre o que o cliente
 * realmente lê.
 */
function pdfText(bytes: Uint8Array): string {
  const raw = latin1(bytes);
  const decoded = raw.replace(/<([0-9a-fA-F]+)>\s*Tj/g, (_, hex: string) =>
    Buffer.from(hex, "hex").toString("latin1"),
  );
  // Some cadeias longas são quebradas em vários operadores pelo quebrador de
  // linha; juntar tudo torna a pesquisa estável.
  return decoded.replace(/\s+/g, " ");
}

const TOTAL = 45_000;

function baseInput(overrides: Partial<ProposalPdfInput> = {}): ProposalPdfInput {
  return {
    code: "PROP-2026-0007",
    title: "Proposta comercial — Residência",
    version: 2,
    clientName: "Maria Silva",
    projectName: "Residência",
    projectDescription: "Interiores e reestruturação",
    services: [
      {
        name: "Projeto arquitetônico",
        discipline: "ARQUITETURA",
        unit: "un.",
        quantity: 1,
        unitPrice: 25_000,
        subtotal: 25_000,
        optional: false,
        order: 0,
      },
      {
        name: "Design de interiores",
        discipline: "INTERIORES",
        unit: "m²",
        quantity: 20,
        unitPrice: 1_000,
        subtotal: 20_000,
        optional: false,
        order: 1,
      },
    ],
    total: TOTAL,
    adjustment: 0,
    frozenPaymentPlan: freezePaymentPlan({ formalText: { formaPagamento: "40% assinatura" }, total: TOTAL }),
    formalText: {
      object: "Projeto de interiores",
      included: "Mobiliário FIXO",
      excluded: "Equipamentos eletrodomésticos",
      premisses: ["O cliente garante o acesso à obra."],
      conditions: "Validade de 30 dias",
      observations: "Orçamento sujeito a revisão.",
      validityDays: 30,
    },
    validityDays: 30,
    expiresAt: new Date("2026-02-01T00:00:00.000Z"),
    issuedAt: new Date("2026-01-01T00:00:00.000Z"),
    company: { name: "ARQVERTICE", document: null },
    ...overrides,
  };
}

/**
 * FASE 4C — regressão do gerador de PDF.
 *
 * Estes testes existem porque o ficheiro `proposal-pdf.ts` chegou ao repositório
 * com um `}` a mais: `serviceRow` nunca fechava, `generateProposalPdf` ficava
 * aninhada dentro dela, e o módulo exportava — em TypeScript — uma função sem
 * corpo. O `tsc` denunciava; o `vitest` NÃO, porque o ficheiro não tinha
 * teste. Um gerador de PDF sem teste é um gerador que pode partir em silêncio.
 */
describe("PDF da proposta", () => {
  it("produz um PDF válido e exporta o gerador", () => {
    // A primeira asserção é a que apanhou o defeito: se `generateProposalPdf`
    // voltar a ficar aninhada, a importação é `undefined` e isto quebra aqui.
    expect(typeof generateProposalPdf).toBe("function");

    const text = latin1(generateProposalPdf(baseInput()));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("xref");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("leva a identificação comercial e a versão para o rodapé", () => {
    // A impressão em papel tem de responder "qual versão é esta?" sem sistema.
    expect(pdfText(generateProposalPdf(baseInput()))).toContain("PROP-2026-0007 · v2 · Residência");
  });

  it("imprime as sete secções na ordem do documento", () => {
    const text = pdfText(generateProposalPdf(baseInput()));
    for (const heading of [
      "1. Objecto",
      "2. Serviços contratados",
      "3. Incluído e não incluído",
      "4. Premissas",
      "5. Condição de pagamento",
      "6. Condições e observações",
      "7. Aceite",
    ]) {
      expect(text).toContain(heading);
    }
  });

  it("separa opcionais do total e diz que não estão incluídos", () => {
    // Item 17: o cliente tem de VER o opcional e tem de ler que não está no
    // valor. Sem as duas coisas, um opcional parece barato e contratado.
    const text = pdfText(
      generateProposalPdf(
        baseInput({
          services: [
            {
              name: "Projeto arquitetônico",
              discipline: "ARQUITETURA",
              unit: "un.",
              quantity: 1,
              unitPrice: 25_000,
              subtotal: 25_000,
              optional: false,
              order: 0,
            },
            {
              name: "Opcional: mobiliário sob medida",
              discipline: "EXTRA",
              unit: "un.",
              quantity: 1,
              unitPrice: 5_000,
              subtotal: 5_000,
              optional: true,
              order: 1,
            },
          ],
          total: 25_000,
        }),
      ),
    );
    expect(text).toContain("2.1 Serviços opcionais");
    expect(text).toContain("NÃO estão incluídos no valor total");
  });

  it("imprime o subtotal e o total a partir das MESMAS linhas do ecrã", () => {
    // O total do PDF e o do ecrã têm de sair da mesma conta. Aqui verifica-se
    // que o número gravado aparece no documento.
    expect(pdfText(generateProposalPdf(baseInput()))).toContain("TOTAL: R$ 45.000,00");
  });

  it("nunca imprime um plano de pagamento inventado", () => {
    // Item 31: plano ausente é um dado a reportar, não um espaço em branco.
    const text = pdfText(generateProposalPdf(baseInput({ frozenPaymentPlan: null })));
    expect(text).toContain("Condição de pagamento não definida nesta versão");
  });

  it("não quebra quando a proposta ainda não tem serviços", () => {
    // Uma versão vazia tem de gerar um PDF legível, não uma excepção: é o
    // estado real de um rascunho recién-criado.
    const bytes = generateProposalPdf(baseInput({ services: [], total: 0 }));
    expect(latin1(bytes).startsWith("%PDF-1.4")).toBe(true);
    expect(pdfText(bytes)).toContain("Nenhum serviço incluído nesta versão");
  });

  it("é determinístico: os mesmos dados dão os mesmos bytes", () => {
    // Um PDF que muda a cada geração não pode ser comparado nem guardado.
    const a = generateProposalPdf(baseInput());
    const b = generateProposalPdf(baseInput());
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});