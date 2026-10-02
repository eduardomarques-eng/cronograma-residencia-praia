export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "INTEGRITY",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function notFound(entity: string): never {
  throw new DomainError(`${entity} não encontrado.`, "NOT_FOUND");
}
