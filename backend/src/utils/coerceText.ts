/** Convierte cualquier valor de GPT a texto plano para SQLite y la UI. */
export function coerceToText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => coerceToText(v, '')).filter(Boolean);
    return parts.length ? parts.join('; ') : fallback;
  }
  if (typeof value === 'object') {
    try {
      const parts = Object.entries(value as Record<string, unknown>).map(
        ([k, v]) => `${k}: ${coerceToText(v, '')}`
      );
      const joined = parts.filter((p) => p.length > 2).join(' | ');
      return joined || fallback;
    } catch {
      return fallback;
    }
  }
  return String(value).trim() || fallback;
}
