/* eslint-disable no-console */
import { randomUUID } from "node:crypto";

export type RequestContext = {
  requestId: string;
};

type LogContext = Record<string, boolean | number | string | undefined>;

export function createRequestContext(request: Request): RequestContext {
  return {
    requestId: request.headers.get("x-request-id")?.slice(0, 128) || randomUUID(),
  };
}

function writeLog(level: "error" | "info" | "warn", event: string, context: LogContext = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.info(JSON.stringify(entry));
  }
}

export function logError(event: string, error: unknown, context: LogContext = {}) {
  writeLog("error", event, {
    ...context,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : "Erro não identificável.",
  });
}

export function logInfo(event: string, context?: LogContext) {
  writeLog("info", event, context);
}
