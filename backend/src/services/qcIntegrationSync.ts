import type {
  QcIntegration,
  QcIntegrationProvider,
  QcIntegrationRunStatus,
} from '@whispper/shared';
import { google } from 'googleapis';
import { config } from '../config';

/** Fila normalizada lista para upsert en qc_surveys (QC-8). */
export type QcImportRow = {
  external_id: string;
  respondent_code: string;
  interviewer: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  collected_at: string | null;
  answers: Record<string, unknown>;
};

export type QcFetchResult = {
  status: QcIntegrationRunStatus;
  message: string;
  rows: QcImportRow[];
  skipped_count: number;
  error_count: number;
  result_payload: Record<string, unknown>;
};

function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

function asDateIso(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_');
}

/** Alias de columnas → campo QC. */
const FIELD_ALIASES: Record<string, keyof Omit<QcImportRow, 'answers'>> = {
  external_id: 'external_id',
  id: 'external_id',
  encuesta_id: 'external_id',
  survey_id: 'external_id',
  folio: 'external_id',
  codigo_encuesta: 'external_id',
  respondent_code: 'respondent_code',
  codigo: 'respondent_code',
  code: 'respondent_code',
  codigo_respondente: 'respondent_code',
  interviewer: 'interviewer',
  encuestador: 'interviewer',
  interviewer_name: 'interviewer',
  phone: 'phone',
  telefono: 'phone',
  celular: 'phone',
  mobile: 'phone',
  address: 'address',
  direccion: 'address',
  domicilio: 'address',
  latitude: 'latitude',
  lat: 'latitude',
  latitud: 'latitude',
  longitude: 'longitude',
  lng: 'longitude',
  lon: 'longitude',
  longitud: 'longitude',
  collected_at: 'collected_at',
  fecha: 'collected_at',
  fecha_recoleccion: 'collected_at',
  date: 'collected_at',
};

function sheetsConfigured(): boolean {
  return (
    config.googleSheets.enabled &&
    !!config.googleSheets.clientEmail &&
    !!config.googleSheets.privateKey
  );
}

async function readGoogleSheetRange(
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const auth = new google.auth.JWT({
    email: config.googleSheets.clientEmail,
    key: config.googleSheets.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as string[][] | undefined) ?? [];
}

function mapObjectToImportRow(raw: Record<string, unknown>): QcImportRow | null {
  const mapped: Partial<QcImportRow> = { answers: {} };
  const answers: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    const norm = normalizeHeader(key);
    const field = FIELD_ALIASES[norm];
    if (field === 'latitude' || field === 'longitude') {
      mapped[field] = asNumber(value);
    } else if (field === 'collected_at') {
      mapped.collected_at = asDateIso(value);
    } else if (field) {
      mapped[field] = asString(value);
    } else if (norm) {
      answers[key] = value;
    }
  }

  const external_id = asString(mapped.external_id);
  if (!external_id) return null;

  return {
    external_id,
    respondent_code: asString(mapped.respondent_code),
    interviewer: asString(mapped.interviewer),
    phone: asString(mapped.phone),
    address: asString(mapped.address),
    latitude: mapped.latitude ?? null,
    longitude: mapped.longitude ?? null,
    collected_at: mapped.collected_at ?? null,
    answers,
  };
}

function mapSheetRows(header: string[], dataRows: string[][]): {
  rows: QcImportRow[];
  skipped_count: number;
} {
  const rows: QcImportRow[] = [];
  let skipped_count = 0;
  for (const cells of dataRows) {
    if (!cells.some((c) => asString(c))) {
      skipped_count += 1;
      continue;
    }
    const obj: Record<string, unknown> = {};
    header.forEach((h, i) => {
      if (h) obj[h] = cells[i] ?? '';
    });
    const row = mapObjectToImportRow(obj);
    if (!row) {
      skipped_count += 1;
      continue;
    }
    rows.push(row);
  }
  return { rows, skipped_count };
}

function demoRows(): QcImportRow[] {
  const stamp = Date.now().toString(36);
  return [
    {
      external_id: `DEMO-${stamp}-001`,
      respondent_code: 'R-001',
      interviewer: 'Demo Encuestador',
      phone: '5551001001',
      address: 'Calle Demo 1',
      latitude: 19.4326,
      longitude: -99.1332,
      collected_at: new Date().toISOString(),
      answers: { q1: 'sí', source: 'demo' },
    },
    {
      external_id: `DEMO-${stamp}-002`,
      respondent_code: 'R-002',
      interviewer: 'Demo Encuestador',
      phone: '5551001002',
      address: 'Calle Demo 2',
      latitude: 19.4285,
      longitude: -99.1277,
      collected_at: new Date().toISOString(),
      answers: { q1: 'no', source: 'demo' },
    },
  ];
}

/**
 * QC-8: obtiene filas normalizadas desde Sheets / Zoho.
 * No escribe en DB (eso lo hace qcRepo.syncIntegration).
 */
export async function fetchQcIntegrationRows(
  integration: QcIntegration,
): Promise<QcFetchResult> {
  const startedPayload: Record<string, unknown> = {
    provider: integration.provider,
    integration_id: integration.id,
  };

  if (integration.status === 'inactive') {
    return {
      status: 'skipped',
      message: 'Integración inactiva',
      rows: [],
      skipped_count: 0,
      error_count: 0,
      result_payload: startedPayload,
    };
  }

  if (integration.provider === 'google_sheets') {
    const spreadsheetId =
      asString(integration.config.spreadsheet_id) || config.googleSheets.spreadsheetId;
    const sheetName = asString(integration.config.sheet_name) || 'QC';
    const range = asString(integration.config.range) || `${sheetName}!A1:Z1000`;

    if (!spreadsheetId) {
      return {
        status: 'error',
        message: 'Falta spreadsheet_id en la configuración',
        rows: [],
        skipped_count: 0,
        error_count: 1,
        result_payload: { ...startedPayload, sheetName, range },
      };
    }

    if (!sheetsConfigured()) {
      const rows = demoRows();
      return {
        status: 'partial',
        message: `Google Sheets no configurado · import demo de ${rows.length} filas`,
        rows,
        skipped_count: 0,
        error_count: 0,
        result_payload: {
          ...startedPayload,
          spreadsheetId,
          range,
          demo: true,
          expected_headers: [
            'external_id',
            'respondent_code',
            'interviewer',
            'phone',
            'address',
            'latitude',
            'longitude',
            'collected_at',
          ],
        },
      };
    }

    try {
      const matrix = await readGoogleSheetRange(spreadsheetId, range);
      const header = (matrix[0] ?? []).map((h) => asString(h));
      const dataRows = matrix.slice(1);
      const { rows, skipped_count } = mapSheetRows(header, dataRows);
      return {
        status: rows.length ? 'success' : skipped_count ? 'partial' : 'success',
        message: `Leídas ${rows.length} filas válidas desde ${sheetName}`,
        rows,
        skipped_count,
        error_count: 0,
        result_payload: {
          ...startedPayload,
          spreadsheetId,
          range,
          header,
          preview: rows.slice(0, 5),
        },
      };
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
        rows: [],
        skipped_count: 0,
        error_count: 1,
        result_payload: { ...startedPayload, spreadsheetId, range },
      };
    }
  }

  if (integration.provider === 'zoho') {
    const apiUrl = asString(integration.config.api_url);
    const token = asString(integration.config.access_token);
    if (!apiUrl || !token) {
      return {
        status: 'error',
        message: 'Zoho requiere api_url y access_token en config',
        rows: [],
        skipped_count: 0,
        error_count: 1,
        result_payload: startedPayload,
      };
    }

    try {
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        return {
          status: 'error',
          message: `Zoho respondió ${res.status}`,
          rows: [],
          skipped_count: 0,
          error_count: 1,
          result_payload: { ...startedPayload, apiUrl, http_status: res.status },
        };
      }
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const data = Array.isArray(body.data)
        ? body.data
        : Array.isArray(body)
          ? body
          : [];
      const rows: QcImportRow[] = [];
      let skipped_count = 0;
      for (const item of data) {
        if (!item || typeof item !== 'object') {
          skipped_count += 1;
          continue;
        }
        const row = mapObjectToImportRow(item as Record<string, unknown>);
        if (!row) {
          skipped_count += 1;
          continue;
        }
        rows.push(row);
      }
      return {
        status: rows.length ? 'success' : 'partial',
        message: `Zoho OK · ${rows.length} registros válidos`,
        rows,
        skipped_count,
        error_count: 0,
        result_payload: {
          ...startedPayload,
          apiUrl,
          preview: rows.slice(0, 5),
        },
      };
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
        rows: [],
        skipped_count: 0,
        error_count: 1,
        result_payload: { ...startedPayload, apiUrl },
      };
    }
  }

  return {
    status: 'error',
    message: `Proveedor no soportado: ${integration.provider as QcIntegrationProvider}`,
    rows: [],
    skipped_count: 0,
    error_count: 1,
    result_payload: startedPayload,
  };
}

/** @deprecated usar fetchQcIntegrationRows + upsert en repo (QC-8) */
export async function runQcIntegrationSync(
  integration: QcIntegration,
): Promise<{
  status: QcIntegrationRunStatus;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  message: string;
  result_payload: Record<string, unknown>;
}> {
  const fetched = await fetchQcIntegrationRows(integration);
  return {
    status: fetched.status,
    imported_count: fetched.rows.length,
    skipped_count: fetched.skipped_count,
    error_count: fetched.error_count,
    message: fetched.message,
    result_payload: fetched.result_payload,
  };
}
