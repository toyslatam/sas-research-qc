const EMPTY_ANSWERS = new Set(['', '-', '--', '—', 'n/a', 'na', 'no aplica']);

const MISSING_PREFIXES = [
  'no mencionado',
  'no se menciona',
  'no se mencionan',
  'no informado',
  'no se informa',
  'no aplica',
  'no disponible',
  'sin informacion',
  'sin información',
];

export function isEmptyAnswer(value?: string | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (EMPTY_ANSWERS.has(normalized)) return true;
  // Párrafos con contexto útil no deben ocultarse aunque digan "no se menciona X".
  if (trimmed.length > 80) return false;
  return MISSING_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
