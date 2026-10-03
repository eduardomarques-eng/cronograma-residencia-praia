import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { createRequestContext, logError } from "@/server/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { requestId } = createRequestContext(request);

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        service: "arqvertice-flow",
        database: "ok",
        version: process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
        requestId,
      },
      {
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
