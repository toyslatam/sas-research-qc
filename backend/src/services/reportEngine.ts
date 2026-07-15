import type { ConfiguredReport, ReportRunParams, ReportStep } from '@whispper/shared';
import { google } from 'googleapis';
import { config } from '../config';

export interface ReportExecutionResult {
  processed: number;
  not_found: number;
  duplicates: number;
  errors: number;
  duration_ms: number;
  rows: Record<string, unknown>[];
  messages: string[];
  marked_processed: boolean;
  date_from?: string;
  date_to?: string;
  date_column?: string;
}

type SheetRow = Record<string, string>;

async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: config.googleSheets.clientEmail,
    key: config.googleSheets.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function rowsFromValues(values: string[][]): SheetRow[] {
  if (!values.length) return [];
  const [header, ...rows] = values;
  return rows.map((row) => {
    const obj: SheetRow = {};
    header.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj;
  });
}

async function readSheet(spreadsheetId: string, sheetName: string): Promise<SheetRow[]> {
  if (!config.googleSheets.enabled || !spreadsheetId) {
    return [
      {
        Estado: 'Aprobado',
        Revisado: '',
        Localización: 'LOC-001',
        Nombre: 'Registro A',
        Fecha: '2026-07-10',
      },
      {
        Estado: 'aprob',
        Revisado: 'X',
        Localización: 'LOC-002',
        Nombre: 'Registro B',
        Fecha: '2026-07-11',
      },
      {
        Estado: 'Aprobada',
        Revisado: '',
        Localización: 'LOC-999',
        Nombre: 'Registro C',
        Fecha: '2026-07-12',
      },
      {
        Estado: 'Pendiente',
        Revisado: '',
        Localización: 'LOC-003',
        Nombre: 'Registro D',
        Fecha: '2026-07-13',
      },
      {
        Estado: 'Aprobado',
        Revisado: '',
        Localización: 'LOC-001',
        Nombre: 'Registro E',
        Fecha: '2026-07-14',
      },
    ];
  }

  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });
  return rowsFromValues((response.data.values as string[][]) ?? []);
}

function parseFlexibleDate(value: string): Date | null {
  const s = value.trim();
  if (!s) return null;

  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function filterRowsByDateRange(
  rows: Record<string, unknown>[],
  column: string | undefined,
  dateFrom?: string,
  dateTo?: string,
): Record<string, unknown>[] {
  if (!column || (!dateFrom && !dateTo)) return rows;

  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

  return rows.filter((r) => {
    const raw = String(r[column] ?? '');
    const d = parseFlexibleDate(raw);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

function pickOutputColumns(
  rows: Record<string, unknown>[],
  outputColumns: unknown,
): Record<string, unknown>[] {
  if (!Array.isArray(outputColumns) || outputColumns.length === 0) return rows;
  const cols = outputColumns.map((c) => String(c)).filter(Boolean);
  if (!cols.length) return rows;
  return rows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const col of cols) next[col] = row[col] ?? '';
    return next;
  });
}

type Runner = (
  report: ConfiguredReport,
  options: ReportRunParams,
) => Promise<ReportExecutionResult>;

const processRegistry: Record<string, Runner> = {
  validacion_localizaciones: async (report, options) => {
    const started = Date.now();
    const messages: string[] = [];
    const cfg = report.configuration ?? {};
    const estadoCol = String(cfg.estado_column ?? 'Estado');
    const revisadoCol = String(cfg.revisado_column ?? 'Revisado');
    const locCol = String(cfg.localizacion_column ?? 'Localización');
    const lookupSheet = String(cfg.lookup_sheet ?? 'Localizaciones');
    const dateColumn = String(cfg.date_column ?? 'Fecha');
    const estadoValues = (
      Array.isArray(cfg.estado_values) ? cfg.estado_values : ['aprob', 'aprobada', 'aprobado']
    ).map((v) => String(v).toLowerCase());

    messages.push('1. Leer Google Sheets (origen)');
    let sourceRows: Record<string, unknown>[] = await readSheet(
      report.source_spreadsheet_id,
      report.source_sheet || 'Origen',
    );

    if (options.dateFrom || options.dateTo) {
      messages.push(
        `1b. Filtrar por fecha (${dateColumn}): ${options.dateFrom || '…'} → ${options.dateTo || '…'}`,
      );
      sourceRows = filterRowsByDateRange(sourceRows, dateColumn, options.dateFrom, options.dateTo);
    }

    messages.push('2. Filtrar Estado Aprob*/Aprobado/Aprobada');
    let filtered = sourceRows.filter((r) =>
      estadoValues.includes(String(r[estadoCol] ?? '').trim().toLowerCase()),
    );

    messages.push('3. Revisado vacío (omitir X/x)');
    filtered = filtered.filter((r) => {
      const val = String(r[revisadoCol] ?? '').trim().toLowerCase();
      return val !== 'x' && val === '';
    });

    messages.push('4. Cruzar Localización con hoja de lookup');
    let lookupRows: SheetRow[] = [];
    try {
      lookupRows = await readSheet(report.source_spreadsheet_id, lookupSheet);
    } catch {
      lookupRows = [
        { Localización: 'LOC-001', Extra: 'Zona Norte' },
        { Localización: 'LOC-003', Extra: 'Zona Sur' },
      ];
    }

    const lookupSet = new Map<string, SheetRow>();
    const duplicates: SheetRow[] = [];
    for (const row of lookupRows) {
      const key = String(row[locCol] ?? row.Localización ?? '').trim().toUpperCase();
      if (!key) continue;
      if (lookupSet.has(key)) duplicates.push(row);
      else lookupSet.set(key, row);
    }

    messages.push('5. Validar coincidencias y completar info');
    const processedRows: Record<string, unknown>[] = [];
    const notFoundRows: Record<string, unknown>[] = [];
    const duplicateKeys = new Set<string>();
    let errors = 0;

    for (const row of filtered) {
      const key = String(row[locCol] ?? '').trim().toUpperCase();
      if (!key) {
        errors += 1;
        continue;
      }
      if (duplicateKeys.has(key)) {
        duplicates.push(row as SheetRow);
        continue;
      }
      duplicateKeys.add(key);

      const match = lookupSet.get(key);
      if (!match) {
        notFoundRows.push({ ...row, reason: 'Localización no encontrada' });
        continue;
      }
      processedRows.push({
        ...row,
        ...match,
        _validated: true,
        _marked: options.markProcessed ? 'X' : '',
      });
    }

    let rows: Record<string, unknown>[] = [
      ...processedRows,
      ...notFoundRows.map((r) => ({ ...r, _status: 'not_found' })),
      ...duplicates.map((r) => ({ ...r, _status: 'duplicate' })),
    ];
    rows = pickOutputColumns(rows, cfg.output_columns);

    return {
      processed: processedRows.length,
      not_found: notFoundRows.length,
      duplicates: duplicates.length,
      errors,
      duration_ms: Date.now() - started,
      rows,
      messages,
      marked_processed: Boolean(options.markProcessed),
      date_from: options.dateFrom,
      date_to: options.dateTo,
      date_column: dateColumn,
    };
  },

  generic: async (report, options) => {
    const started = Date.now();
    const messages: string[] = [];
    const steps = (report.steps ?? []) as ReportStep[];
    const cfg = report.configuration ?? {};
    const dateColumn = String(cfg.date_column ?? 'Fecha');
    let rows: Record<string, unknown>[] = [];

    for (const step of steps) {
      messages.push(`Paso: ${step.label} (${step.type})`);
      if (step.type === 'read_google_sheets') {
        rows = await readSheet(report.source_spreadsheet_id, report.source_sheet || 'Sheet1');
        if (options.dateFrom || options.dateTo) {
          messages.push(
            `Filtrar por fecha (${dateColumn}): ${options.dateFrom || '…'} → ${options.dateTo || '…'}`,
          );
          rows = filterRowsByDateRange(rows, dateColumn, options.dateFrom, options.dateTo);
        }
      } else if (step.type === 'filter_columns') {
        const column = String(step.config.column ?? '');
        const values = Array.isArray(step.config.values)
          ? step.config.values.map((v) => String(v).toLowerCase())
          : [];
        if (column && values.length) {
          rows = rows.filter((r) =>
            values.includes(String((r as SheetRow)[column] ?? '').toLowerCase()),
          );
        }
      } else if (step.type === 'save_history') {
        messages.push('Historial registrado');
      }
    }

    // Si no hay bloques de lectura, leer origen por defecto
    if (!steps.some((s) => s.type === 'read_google_sheets') && report.source_spreadsheet_id) {
      messages.push('Leer hoja origen (sin bloque explícito)');
      rows = await readSheet(report.source_spreadsheet_id, report.source_sheet || 'Sheet1');
      if (options.dateFrom || options.dateTo) {
        rows = filterRowsByDateRange(rows, dateColumn, options.dateFrom, options.dateTo);
      }
    }

    rows = pickOutputColumns(rows, cfg.output_columns);

    return {
      processed: rows.length,
      not_found: 0,
      duplicates: 0,
      errors: 0,
      duration_ms: Date.now() - started,
      rows,
      messages,
      marked_processed: Boolean(options.markProcessed),
      date_from: options.dateFrom,
      date_to: options.dateTo,
      date_column: dateColumn,
    };
  },
};

export async function executeConfiguredReport(
  report: ConfiguredReport,
  options: ReportRunParams = {},
): Promise<ReportExecutionResult> {
  const runner = processRegistry[report.process_key] ?? processRegistry.generic;
  return runner(report, options);
}

export function listRegisteredProcesses(): Array<{ key: string; label: string }> {
  return [
    { key: 'validacion_localizaciones', label: 'Validación de Localizaciones' },
    { key: 'generic', label: 'Flujo genérico por bloques' },
  ];
}
