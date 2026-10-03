import { NextResponse } from "next/server";
import { signIn } from "@/server/auth";
import { createRequestContext, logError } from "@/server/observability";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { requestId } = createRequestContext(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    // Tópico 35: limita tentativas por IP e por e-mail, sem revelar qual dos dois falhou.
    const limit = checkRateLimit(`login:${ip}:${email}`, { limit: 8, windowMs: 5 * 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Muitas tentativas de acesso. Tente novamente em alguns minutos.", requestId },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "X-Request-Id": requestId } },
      );
    }
    return NextResponse.json(
      { user: await signIn(email, String(body.password ?? "")) },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (error) {
    logError("login_failed", error, { requestId });
    return NextResponse.json(
      { error: "E-mail ou senha inválidos.", requestId },
      { status: 401, headers: { "X-Request-Id": requestId } },
    );
  }
}
