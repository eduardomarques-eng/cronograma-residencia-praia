import { NextResponse } from "next/server";
import { createRequestContext, logError } from "@/server/observability";
import { checkRateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/server/errors";
import { consumePasswordReset } from "@/server/services/password-reset-service";

export async function POST(request: Request) {
  const { requestId } = createRequestContext(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token ?? "");
    // Limite apertado por IP. O token tem 256 bits, por isso adivinhá-lo é
    // inviável; o limite existe para travar tentativas repetidas em massa.
    const limit = checkRateLimit(`reset:${ip}`, { limit: 20, windowMs: 15 * 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em alguns minutos.", requestId },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "X-Request-Id": requestId } },
      );
    }
    await consumePasswordReset(token, String(body.password ?? ""));
    return NextResponse.json({ ok: true, requestId }, { status: 200, headers: { "X-Request-Id": requestId } });
  } catch (error) {
    // `DomainError` de token inválido/expirado é 404; política de senha é 422.
    if (error instanceof DomainError) {
      const status = error.code === "VALIDATION" ? 422 : 404;
      return NextResponse.json({ error: error.message, requestId }, { status, headers: { "X-Request-Id": requestId } });
    }
    logError("password_reset_consume_failed", error, { requestId });
    return NextResponse.json(
      { error: "Não foi possível redefinir a senha agora.", requestId },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }
}