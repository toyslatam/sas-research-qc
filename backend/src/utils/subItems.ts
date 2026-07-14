/** Convierte texto multilínea o array en lista de sub-ítems */
export function parseSubItems(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((s) => s.trim()).filter(Boolean);
  }
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+(\.\d+)*\.?\s*/, '').trim())
    .filter(Boolean);
}

export function serializeSubItems(items: string[]): string | null {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  return clean.length ? JSON.stringify(clean) : null;
}

export function deserializeSubItems(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch {
    return parseSubItems(raw);
  }
  return [];
}
