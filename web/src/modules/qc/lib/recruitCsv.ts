import type { QcRecruitFuente, QcRecruitImportRow } from '@whispper/shared';

/**
 * Un export real de Indeed/Computrabajo no se parece al CSV de ejemplo: trae
 * campos entre comillas con comas adentro ("Cúcuta, Norte de Santander"),
 * encabezados propios del portal (y en inglés según la cuenta), y a veces ';'
 * como separador cuando pasa por Excel en español. Por eso se tokeniza de
 * verdad y las columnas se mapean en vez de exigir nombres fijos.
 */

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

/** Campos del importador; `null` = "esta columna no viene en el archivo". */
export interface ColumnMap {
  nombre: number | null;
  celular: number | null;
  email: number | null;
  municipio: number | null;
  fuente: number | null;
}

export const COLUMN_FIELDS: { id: keyof ColumnMap; label: string; required: boolean }[] = [
  { id: 'nombre', label: 'Nombre', required: true },
  { id: 'celular', label: 'Celular', required: true },
  { id: 'email', label: 'Email', required: false },
  { id: 'municipio', label: 'Municipio', required: false },
  { id: 'fuente', label: 'Fuente', required: false },
];

/** Excel en español exporta con ';'. Se cuenta fuera de comillas para no confundir separadores con comas de contenido. */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  let best = ',';
  for (const d of Object.keys(counts)) {
    if (counts[d] > counts[best]) best = d;
  }
  return best;
}

/** Tokenizador estilo RFC 4180: respeta comillas, `""` escapado y saltos de línea dentro del campo. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ''));
}

export function parseCsvTable(text: string): CsvTable {
  if (!text.trim()) return { headers: [], rows: [] };
  const all = parseDelimited(text, detectDelimiter(text));
  if (all.length === 0) return { headers: [], rows: [] };
  return { headers: all[0], rows: all.slice(1) };
}

// Construido con RegExp para que el rango de acentos quede como escapes \u y no
// como caracteres combinantes literales dentro del archivo.
const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '');
}

const COLUMN_ALIASES: Record<keyof ColumnMap, string[]> = {
  nombre: ['nombre', 'nombres', 'nombre completo', 'name', 'full name', 'candidato', 'candidate', 'applicant', 'applicant name'],
  celular: ['celular', 'telefono', 'tel', 'movil', 'phone', 'phone number', 'mobile', 'numero de telefono', 'numero de contacto', 'contacto'],
  email: ['email', 'e-mail', 'correo', 'correo electronico', 'email address'],
  municipio: ['municipio', 'ciudad', 'city', 'ubicacion', 'location', 'lugar'],
  fuente: ['fuente', 'source', 'portal', 'origen'],
};

/** Adivina el mapeo por nombre de encabezado; lo que no reconoce queda en `null` para que el usuario lo elija. */
export function autoDetectMapping(headers: string[]): ColumnMap {
  const norm = headers.map(normalizeHeader);
  const pick = (field: keyof ColumnMap): number | null => {
    const aliases = COLUMN_ALIASES[field];
    const exact = norm.findIndex((h) => aliases.includes(h));
    if (exact >= 0) return exact;
    const partial = norm.findIndex((h) => h !== '' && aliases.some((a) => h.includes(a)));
    return partial >= 0 ? partial : null;
  };
  return {
    nombre: pick('nombre'),
    celular: pick('celular'),
    email: pick('email'),
    municipio: pick('municipio'),
    fuente: pick('fuente'),
  };
}

/**
 * El celular es la llave de deduplicación, así que "+57 318 220 8667" y
 * "3182208667" tienen que quedar idénticos o se importaría dos veces la misma
 * persona. Se dejan solo dígitos y se quita el indicativo de Colombia.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('57')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('057')) return digits.slice(3);
  return digits;
}

/** Indeed manda "Ciudad, Departamento" en una sola celda; el municipio es la primera parte. */
function normalizeMunicipio(raw: string): string {
  return raw.split(',')[0].trim();
}

const VALID_FUENTES: QcRecruitFuente[] = ['indeed', 'computrabajo', 'referido', 'otro'];

export function buildImportRows(table: CsvTable, map: ColumnMap): QcRecruitImportRow[] {
  const at = (cols: string[], idx: number | null): string => (idx === null ? '' : (cols[idx] ?? '').trim());
  return table.rows.map((cols) => {
    const fuenteRaw = normalizeHeader(at(cols, map.fuente));
    const municipio = normalizeMunicipio(at(cols, map.municipio));
    const email = at(cols, map.email);
    return {
      nombre: at(cols, map.nombre),
      celular: normalizePhone(at(cols, map.celular)),
      email: email || undefined,
      municipio: municipio || undefined,
      fuente: VALID_FUENTES.includes(fuenteRaw as QcRecruitFuente)
        ? (fuenteRaw as QcRecruitFuente)
        : undefined,
    };
  });
}
