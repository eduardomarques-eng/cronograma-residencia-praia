import { NextResponse } from "next/server";
import { createRequestContext, logError } from "@/server/observability";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/server/services/password-reset-service";

export async function POST(request: Request) {
  const { requestId } = createRequestContext(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    // Limite por IP e por e-mail, como no login: sem ele, este endpoint
    // transformava-se num disparador de e-mails para endereços arbitrários.
    const key = `forgot:${ip}:${email || "vazio"}`;
    const limit = checkRateLimit(key, { limit: 5, windowMs: 15 * 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em alguns minutos.", requestId },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "X-Request-Id": requestId } },
      );
    }
    const result = await requestPasswordReset(email);
    // A resposta é a mesma exista ou não a conta (anti-enumeração). `emailDelivered`
    // só é verdade quando havia conta — nunca se expõe ao cliente.
    return NextResponse.json(
      { message: result.message, requestId },
      { status: 202, headers: { "X-Request-Id": requestId } },
    );
  } catch (error) {
    logError("password_reset_request_failed", error, { requestId });
    return NextResponse.json(
      { error: "Não foi possível processar o pedido agora.", requestId },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }
}