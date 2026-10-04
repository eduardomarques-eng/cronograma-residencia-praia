import { expect, test } from "@playwright/test";

const clientEmail = process.env.E2E_CLIENT_EMAIL;
const clientPassword = process.env.E2E_CLIENT_PASSWORD;
const ownProjectId = process.env.E2E_OWN_PROJECT_ID;
const foreignProjectId = process.env.E2E_FOREIGN_PROJECT_ID;
const briefingToken = process.env.E2E_BRIEFING_TOKEN;

/**
 * A primeira visita a uma rota nunca compilada em `next dev` pode ser abortada
 * pelo Chromium (`ERR_ABORTED`) sem que a página tenha falhado. Repetimos uma
 * vez: à segunda o módulo já está compilado.
 */
async function abrir(page: import("@playwright/test").Page, caminho: string) {
  try {
    await page.goto(caminho, { waitUntil: "domcontentloaded" });
  } catch (erro) {
    if (!String(erro).includes("ERR_ABORTED")) throw erro;
    await page.goto(caminho, { waitUntil: "domcontentloaded" });
  }
}

test.describe("isolamento do portal", () => {
  test("nega token de briefing inválido sem expor dados", async ({ page }) => {
    await page.goto("/briefing/not-a-real-briefing-token");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", "noindex");
    await expect(page.locator('meta[name="next-error"]').first()).toHaveAttribute("content", "not-found");
    await expect(page.getByRole("heading", { name: "Vamos construir esse projeto juntos" })).not.toBeVisible();
  });

  test.describe("com cliente e projetos de fixture", () => {
    test.skip(
      !clientEmail || !clientPassword || !ownProjectId || !foreignProjectId,
      "Defina E2E_CLIENT_EMAIL, E2E_CLIENT_PASSWORD, E2E_OWN_PROJECT_ID e E2E_FOREIGN_PROJECT_ID para executar contra um banco de teste.",
    );

    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
      await page.getByLabel("E-mail").fill(clientEmail!);
      await page.getByLabel("Senha").fill(clientPassword!);
      await page.getByRole("button", { name: "Entrar" }).click();
      // A entrada por papel manda o CLIENT para o portal. Isto já não pode
      // esperar "/" como antes da Fase 2, quando "/" era o painel do cliente.
      // Em `next dev` a primeira visita a `/portal` compila a rota, e essa
      // compilação pode demorar mais do que os 5s por omissão do Playwright.
      await expect(page).toHaveURL(/\/portal/, { timeout: 30_000 });
    });

    test("permite o projeto autorizado", async ({ page }) => {
      await abrir(page, `/portal/${ownProjectId}`);
      // Scope a `main`: a expressão também aparece no cabeçalho, no rodapé e
      // no selo, e o modo estrito do Playwright rejeita a ambiguidade.
      await expect(page.getByRole("main").getByText("Portal do cliente")).toBeVisible();
      await expect(page).not.toHaveURL(/login/);
    });

    test("bloqueia projeto de outro cliente mesmo com ID conhecido", async ({ page }) => {
      await abrir(page, `/portal/${foreignProjectId}`);
      await expect(page.locator('meta[name="next-error"]').first()).toHaveAttribute("content", "not-found");
      await expect(page).toHaveURL(new RegExp(`/portal/${foreignProjectId}`));
      await expect(page.getByText("Portal do cliente")).not.toBeVisible();
    });
  });
});

test.describe("briefing por link seguro", () => {
  test.skip(
    !briefingToken,
    "Defina E2E_BRIEFING_TOKEN com um token de fixture não finalizado para executar o fluxo do briefing.",
  );

  test("abre, salva automaticamente, retoma e permite revisar", async ({ page }) => {
    await page.goto(`/briefing/${briefingToken}`);
    await expect(page.getByRole("heading", { name: "Vamos construir esse projeto juntos" })).toBeVisible();

    const firstTextArea = page.locator("textarea").first();
    await firstTextArea.fill("Resposta E2E persistida");
    // O indicador passa por "Salvando…", "Salvo agora" e, no erro,
    // "Não foi possível salvar". Qualquer um destes prova que o estado de
    // gravação é mostr ao cliente.
    await expect(page.getByRole("status")).toContainText(/Salvo|Salvando|Não foi possível salvar/);
    await expect(page.getByText(/Resposta E2E persistida/)).toBeVisible();

    await page.reload();
    await expect(page.locator("textarea").first()).toHaveValue("Resposta E2E persistida");

    const nextSection = page.getByRole("button", { name: /Próxima seção/ });
    while (await nextSection.isVisible()) {
      await nextSection.click();
    }
    await page.getByRole("button", { name: /Revisar respostas/ }).click();
    await expect(page.getByRole("heading", { name: "Revise antes de enviar" })).toBeVisible();
    await expect(page.getByText("Resposta E2E persistida")).toBeVisible();
  });
});
