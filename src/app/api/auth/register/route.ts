import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { createRequestContext, logError } from "@/server/observability";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPassword } from "@/server/auth";

export async function POST(request: Request) {
  const { requestId } = createRequestContext(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  try {
    const body = await request.json().catch(() => ({}));
    const limit = checkRateLimit(`register:${ip}`, { limit: 5, windowMs: 15 * 60_000 });
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente em alguns minutos.", requestId },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "X-Request-Id": requestId } },
      );
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");

    if (name.length < 3) return NextResponse.json({ error: "Indique o nome completo.", requestId }, { status: 422 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "E-mail inválido.", requestId }, { status: 422 });
    // `hashPassword` aplica a política real (>=12 caracteres) e nunca grava
    // a senha em claro.
    let passwordHash: string;
    try {
      passwordHash = hashPassword(password);
    } catch {
      return NextResponse.json({ error: "A senha deve ter pelo menos 12 caracteres.", requestId }, { status: 422 });
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Já existe uma conta com este e-mail.", requestId }, { status: 409 });
    }

    // Registo + Cliente na mesma transacção. O `User` fica SEM `clientId`:
    // o Admin é que o associa a um cliente/projeto, impedindo que um registo
    // aceda a dados de terceiros.
    await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name,
          fullName: name,
          email,
          phone: phone || null,
          status: "ACTIVE",
        },
      });
      await tx.user.create({ data: { name, email, passwordHash, role: "CLIENT", clientId: client.id } });
    });

    return NextResponse.json({ ok: true, requestId }, { status: 201, headers: { "X-Request-Id": requestId } });
  } catch (error) {
    logError("register_failed", error, { requestId });
    return NextResponse.json({ error: "Não foi possível criar a conta agora.", requestId }, { status: 500, headers: { "X-Request-Id": requestId } });
  }
}