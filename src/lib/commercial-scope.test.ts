import { describe, expect, it } from "vitest";
import { extractDisciplines, normalizeDiscipline, selectContractTemplateForScope } from "./commercial-scope";

describe("contratos por disciplina/escopo", () => {
  it("normaliza rótulos livres para as disciplinas canônicas", () => {
    expect(normalizeDiscipline("Arquitetura")).toBe("ARQUITETURA");
    expect(normalizeDiscipline("3D / Render")).toBe("3D_RENDER");
    expect(normalizeDiscipline("Hidrossanitário")).toBe("COMPLEMENTARES");
    expect(normalizeDiscipline("desconhecido")).toBeNull();
    expect(normalizeDiscipline(42)).toBeNull();
  });

  it("extrai apenas as disciplinas efetivamente contratadas", () => {
    const services = [{ discipline: "Arquitetura" }, { disciplina: "Estrutural" }, { name: "Sem disciplina" }];
    expect(extractDisciplines(services)).toEqual(["ARQUITETURA", "ESTRUTURAL"]);
  });

  it("escolhe o template mais específico cujo escopo está contratado", () => {
    const templates = [
      { id: "default", scopeKey: null, disciplines: [], isDefault: true },
      { id: "arq", scopeKey: "arquitetura", disciplines: ["ARQUITETURA"], isDefault: false },
      {
        id: "arq-estrutural",
        scopeKey: "arquitetura-estrutural",
        disciplines: ["ARQUITETURA", "ESTRUTURAL"],
        isDefault: false,
      },
    ];
    const selection = selectContractTemplateForScope(templates, [
      { discipline: "ARQUITETURA" },
      { discipline: "Estrutural" },
    ]);
    expect(selection.template?.id).toBe("arq-estrutural");
    expect(selection.matched).toEqual(["ARQUITETURA", "ESTRUTURAL"]);
    expect(selection.reason).toContain("Escopo específico");
  });

  it("cai para o template padrão quando nenhum template cobre o escopo", () => {
    const templates = [
      { id: "default", scopeKey: null, disciplines: [], isDefault: true },
      { id: "arq", scopeKey: "arquitetura", disciplines: ["ARQUITETURA"], isDefault: false },
    ];
    const selection = selectContractTemplateForScope(templates, [{ discipline: "Interiores" }]);
    expect(selection.template?.id).toBe("default");
    expect(selection.reason).toContain("Template padrão");
  });

  it("informa quando não existe template algum", () => {
    const selection = selectContractTemplateForScope([], []);
    expect(selection.template).toBeNull();
    expect(selection.reason).toContain("Nenhum template contratual ativo");
  });
});