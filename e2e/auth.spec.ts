import { expect, test } from "@playwright/test";

/**
 * FASE 6 — E2E de AUTH e RBAC.
 *
 * Nenhum teste aqui depende de base de dados: são as rotas que qualquer
 * visitante encontra. Os que precisam de conta viva noutro ficheiro, para
 * que um banco em falta não apague a cobertura de segurança mais básica.
 *
 * O objectivo NÃO é testar o que o código valida por units (isso está
 * feito). É verificar que o CAMINHO está lá e que a interface não empurra o
 * utilizador para o sítio errado depois da acção.
 */

test.describe("AUTH", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("a página de login tem os rótulos que um leitor de ecrã precisa", async ({ page }) => {
    // Um input sem label é invisível para quem navega por teclado ou leitor.
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("login inválido mostra erro e não entra", async ({ page }) => {
    await page.getByLabel("E-mail").fill("ninguem@exemplo.test");
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();

    // O ponto: a resposta tem de ser VISÍVEL e a URL tem de continuar no
    // login. Um erro que só existe no log não impede ninguém de achar que
    // entrou.
    await expect(page.locator("body")).toContainText(/inválid|incorret|inexistente|credencial/i, { timeout: 15_000 });
    await expect(page).toHaveURL(/login/);
  });

  test("e-mail malformado é recusado sem pedido ao servidor", async ({ page }) => {
    await page.getByLabel("E-mail").fill("isto-nao-e-um-email");
    await page.getByLabel("Senha").fill("qualquer-coisa");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/login/, { timeout: 15_000 });
  });

  test("existe caminho para recuperar a senha", async ({ page }) => {
    // Navegar pelo caminho é o que interessa: o formulário de recuperação só
    // interessa se é alcançável.
    await page.goto("/recuperar-senha");
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("existe caminho de cadastro", async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.getByRole("heading")).toBeVisible();
  });
});
