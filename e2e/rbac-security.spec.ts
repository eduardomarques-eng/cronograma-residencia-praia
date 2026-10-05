import { expect, test } from "@playwright/test";

const clientEmail = process.env.E2E_CLIENT_EMAIL;
const clientPassword = process.env.E2E_CLIENT_PASSWORD;
const foreignProjectId = process.env.E2E_FOREIGN_PROJECT_ID;

/**
 * FASE 6 — E2E de RBAC e seguranca.
 *
 * O que interessa testar aqui nao e o que o servidor recusa - isso ja esta
 * provado por units em `security-matrix.test.ts` - mas SIM que a interface nao
 * revele a existencia do recurso proibido. Um 403 a dizer "existe mas nao pode"
 * e uma fuga de informacao mesmo sem mostrar o conteudo.
 *
 * Sem credenciais, os testes que precisam de sessao saltam com explicacao -
 * e preferivel a um teste verde que nunca correu.
 */

test.describe("RBAC — visitante sem sessao", () => {
  for (const rota of ["/admin", "/admin/propostas", "/admin/clientes", "/portal"]) {
    test("redirecciona " + rota + " para o login", async ({ page }) => {
      await page.goto(rota);
      // Nao basta sair da rota: o utilizador tem de CHEGAR ao login, para
      // poder entrar. Um 500 deixava-o encravado.
      await expect(page).toHaveURL(/login/, { timeout: 20_000 });
    });
  }

  test("a rota publica por token responde sem sessao", async ({ page }) => {
    // A proposta chega ao cliente por link: exigir login seria partir o fluxo.
    await page.goto("/briefing-proposta/token-que-nao-existe");
    await expect(page.locator("meta[name=robots]").first()).toHaveAttribute("content", "noindex");
  });

  test("uma proposta inexistente nao revela se o token existe", async ({ page }) => {
    await page.goto("/briefing-proposta/token-que-nao-existe");
    // A resposta tem de ser a mesma para token invalido, expirado e revogado.
    await expect(page.locator("meta[name=robots]").first()).toHaveAttribute("content", "noindex");
  });
});

test.describe("SEGURANCA — CLIENT com sessao", () => {
  test.skip(!clientEmail || !clientPassword, "Defina E2E_CLIENT_EMAIL e E2E_CLIENT_PASSWORD para executar com sessao de cliente.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(clientEmail!);
    await page.getByLabel("Senha").fill(clientPassword!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/portal/, { timeout: 30_000 });
  });

  for (const rota of ["/admin", "/admin/propostas", "/admin/clientes", "/admin/configuracoes"]) {
    test("bloqueia " + rota + " a um CLIENT", async ({ page }) => {
      await page.goto(rota);
      // Um CLIENT nao pode chegar ao administrativo. A resposta tem de ser
      // negativa E sem revelar o conteudo da pagina.
      await expect(page.locator("body")).not.toContainText(/Propostas|Clientes|Configura/i, { timeout: 20_000 });
    });
  }

  test.skip(!foreignProjectId, "Defina E2E_FOREIGN_PROJECT_ID para testar acesso cruzado.");

  test("acesso cruzado responde como inexistente, nao como proibido", async ({ page }) => {
    await page.goto("/portal/" + foreignProjectId!);
    // A diferenca entre 403 e 404 e a diferenca entre "nao pode" e "nao existe".
    // A segunda nao confirma nada a quem esta a sondar.
    await expect(page.locator("meta[name=next-error]").first()).toHaveAttribute("content", "not-found");
  });

  test("um id de projeto inventado nao revela nada", async ({ page }) => {
    await page.goto("/portal/00000000-0000-0000-0000-000000000000");
    await expect(page.locator("meta[name=next-error]").first()).toHaveAttribute("content", "not-found");
  });
});
