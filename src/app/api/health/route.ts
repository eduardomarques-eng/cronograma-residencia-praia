import { NextResponse } from "next/server";
import { createRequestContext, logError } from "@/server/observability";
import { checkDatabase } from "@/server/services/database-status";

export const dynamic = "force-dynamic";

/**
 * Health check.
 *
 * Antes usava apenas `SELECT 1`, que só prova que o socket liga. Com a
 * `DATABASE_URL` a apontar para uma base vazia devolvia `database: "ok"` e
 * 200 — escondendo precisamente o caso que mais importa (migrations por
 * aplicar). Passou a usar `checkDatabase()`, que confirma que as tabelas existem.
 *
 * A resposta distingue os três estados: sem `DATABASE_URL`, ligação recusada, ou
 * tabelas em falta. `reason` nunca inclui a URL, que carrega utilizador e senha.
 */
export async function GET(request: Request) {
  const { requestId } = createRequestContext(request);

  try {
    const database = await checkDatabase();
    return NextResponse.json(
      {
        status: database.ok ? "ok" : "degraded",
        service: "arqvertice-flow",
        database: database.ok ? "ok" : "unavailable",
        reason: database.reason,
        version: process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
        requestId,
      },
      {
        status: database.ok ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    logError("health_check_failed", error, { requestId });
    return NextResponse.json(
      { status: "degraded", service: "arqvertice-flow", database: "unavailable", requestId },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  }
}
