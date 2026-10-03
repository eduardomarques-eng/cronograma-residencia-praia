const TEMPLATE_VARIABLE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Normaliza `{{ cliente_nome }}` para a chave canônica `CLIENTE_NOME`. */
export function normalizeTemplateKey(rawKey: string): string {
  return rawKey.trim().toUpperCase();
}

/** Lista as chaves usadas por um template, normalizadas e sem repetição. */
export function extractTemplateKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const match of text.matchAll(TEMPLATE_VARIABLE)) keys.add(normalizeTemplateKey(match[1]));
  return [...keys].sort();
}

export type TemplateRenderResult = {
  text: string;
  /** Variáveis sem valor; permanecem no texto para o ADMIN corrigir. */
  missing: string[];
  used: string[];
};

/**
 * Substitui `{{VARIAVEL}}` pelos valores informados. Variáveis sem valor não são
 * inventadas pelo sistema: permanecem no texto e são devolvidas em `missing`.
 */
export function renderTemplate(
  body: string,
  values: Record<string, string | number | null | undefined>,
): TemplateRenderResult {
  const missing = new Set<string>();
  const used = new Set<string>();
  const text = body.replace(TEMPLATE_VARIABLE, (match, rawKey: string) => {
    const key = normalizeTemplateKey(rawKey);
    const value = values[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      missing.add(key);
      return match;
    }
    used.add(key);
    return String(value);
  });
  return { text, missing: [...missing].sort(), used: [...used].sort() };
}

export function missingRequiredVariables(requiredKeys: string[], missing: string[]): string[] {
  const required = new Set(requiredKeys.map(normalizeTemplateKey));
  return missing.filter((key) => required.has(normalizeTemplateKey(key)));
}