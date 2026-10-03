const baseUrl = process.env.SMOKE_BASE_URL?.replace(/\/+$/, "");
if (!baseUrl) throw new Error("SMOKE_BASE_URL não configurada.");

async function check(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (response.status !== expectedStatus) throw new Error(`${path}: esperado HTTP ${expectedStatus}, recebido ${response.status}`);
  return response;
}

await check("/login");
await check("/api/health");
const invalidBriefing = await check("/briefing/not-a-real-briefing-token");
const html = await invalidBriefing.text();
if (html.includes("Vamos construir esse projeto juntos")) throw new Error("Token inválido abriu o formulário de briefing.");
console.log(`Smoke test remoto aprovado: ${baseUrl}`);
