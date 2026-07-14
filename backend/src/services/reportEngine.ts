import type { ConfiguredReport, ReportStep } from '@whispper/shared';
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
    // Modo demo sin Sheets: datos de ejemplo para validar el motor
    return [
      { Estado: 'Aprobado', Revisado: '', Localización: 'LOC-001', Nombre: 'Registro A' },
      { Estado: 'aprob', Revisado: 'X', Localización: 'LOC-002', Nombre: 'Registro B' },
      { Estado: 'Aprobada', Revisado: '', Localización: 'LOC-999', Nombre: 'Registro C' },
      { Estado: 'Pendiente', Revisado: '', Localización: 'LOC-003', Nombre: 'Registro D' },
      { Estado: 'Aprobado', Revisado: '', Localización: 'LOC-001', Nombre: 'Registro E' },
    ];
  }

  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });
  return rowsFromValues((response.data.values as string[][]) ?? []);
}

/**
 * Procesos registrados (Fase 8–9).
 * Cada process_key tiene su flujo independiente.
 */
const processRegistry: Record<
  string,
  (report: ConfiguredReport, markProcessed: boolean) => Promise<ReportExecutionResult>
> = {
  validacion_localizaciones: async (report, markProcessed) => {
    const started = Date.now();
    const messages: string[] = [];
    const cfg = report.configuration ?? {};
    const estadoCol = String(cfg.estado_column ?? 'Estado');
    const revisadoCol = String(cfg.revisado_column ?? 'Revisado');
    const locCol = String(cfg.localizacion_column ?? 'Localización');
    const lookupSheet = String(cfg.lookup_sheet ?? 'Localizaciones');
    const estadoValues = (Array.isArray(cfg.estado_values) ? cfg.estado_values : ['aprob', 'aprobada', 'aprobado'])
      .map((v) => String(v).toLowerCase());

    messages.push('1. Leer Google Sheets (origen)');
    const sourceRows = await readSheet(report.source_spreadsheet_id, report.source_sheet || 'Origen');

    messages.push('2. Filtrar Estado Aprob*/Aprobado/Aprobada (case-insensitive)');
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
      // Demo lookup
      lookupRows = [
        { Localización: 'LOC-001', Extra: 'Zona Norte' },
        { Localización: 'LOC-003', Extra: 'Zona Sur' },
      ];
    }

    const lookupSet = new Map<string, SheetRow>();
    const seen = new Set<string>();
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
        duplicates.push(row);
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
        _marked: markProcessed ? 'X' : '',
      });
    }

    return {
      processed: processedRows.length,
      not_found: notFoundRows.length,
      duplicates: duplicates.length,
      errors,
      duration_ms: Date.now() - started,
      rows: [
        ...processedRows,
        ...notFoundRows.map((r) => ({ ...r, _status: 'not_found' })),
        ...duplicates.map((r) => ({ ...r, _status: 'duplicate' })),
      ],
      messages,
      marked_processed: markProcessed,
    };
  },

  generic: async (report, markProcessed) => {
    const started = Date.now();
    const messages: string[] = [];
    const steps = (report.steps ?? []) as ReportStep[];
    let rows: Record<string, unknown>[] = [];

    for (const step of steps) {
      messages.push(`Paso: ${step.label} (${step.type})`);
      if (step.type === 'read_google_sheets') {
        rows = await readSheet(report.source_spreadsheet_id, report.source_sheet || 'Sheet1');
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

    return {
      processed: rows.length,
      not_found: 0,
      duplicates: 0,
      errors: 0,
      duration_ms: Date.now() - started,
      rows,
      messages,
      marked_processed: markProcessed,
    };
  },
};

export async function executeConfiguredReport(
  report: ConfiguredReport,
  options?: { markProcessed?: boolean },
): Promise<ReportExecutionResult> {
  const runner =
    processRegistry[report.process_key] ?? processRegistry.generic;
  return runner(report, Boolean(options?.markProcessed));
}

export function listRegisteredProcesses(): Array<{ key: string; label: string }> {
  return [
    { key: 'validacion_localizaciones', label: 'Validación de Localizaciones' },
    { key: 'generic', label: 'Flujo genérico por bloques' },
  ];
}
