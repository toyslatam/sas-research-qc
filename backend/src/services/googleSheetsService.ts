import { google } from 'googleapis';
import type { InsightsResult, MatchResult } from '@whispper/shared';
import { config } from '../config';

export interface SheetRow {
  interviewId: string;
  fecha: string;
  proyecto: string;
  pregunta: string;
  respuesta: string;
  categoria: string;
  sentimiento: string;
}

/**
 * Integración Google Sheets API v4 (cuenta de servicio).
 * Inserta una fila por cada pregunta-respuesta.
 */
export class GoogleSheetsService {
  private enabled: boolean;

  constructor() {
    this.enabled =
      config.googleSheets.enabled &&
      !!config.googleSheets.spreadsheetId &&
      !!config.googleSheets.clientEmail &&
      !!config.googleSheets.privateKey;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async getSheetsClient() {
    const auth = new google.auth.JWT({
      email: config.googleSheets.clientEmail,
      key: config.googleSheets.privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  }

  /** Asegura encabezados en la primera fila */
  async ensureHeaders(): Promise<void> {
    if (!this.enabled) return;

    const sheets = await this.getSheetsClient();
    const headers = [
      'ID Entrevista',
      'Fecha',
      'Proyecto',
      'Pregunta',
      'Respuesta',
      'Categoría',
      'Sentimiento',
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSheets.spreadsheetId,
      range: 'A1:G1',
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  async appendRows(rows: SheetRow[]): Promise<void> {
    if (!this.enabled || rows.length === 0) {
      console.log('[GoogleSheets] Deshabilitado o sin filas — omitiendo sync');
      return;
    }

    const sheets = await this.getSheetsClient();
    const values = rows.map((r) => [
      r.interviewId,
      r.fecha,
      r.proyecto,
      r.pregunta,
      r.respuesta,
      r.categoria,
      r.sentimiento,
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheets.spreadsheetId,
      range: 'A:G',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });

    console.log(`[GoogleSheets] ${rows.length} filas insertadas`);
  }

  buildRowsFromInterview(
    interviewId: string,
    fecha: string,
    proyecto: string,
    match: MatchResult,
    insights: InsightsResult
  ): SheetRow[] {
    const sentiment = insights.sentimiento_general;
    return match.preguntas.map((p) => ({
      interviewId,
      fecha,
      proyecto,
      pregunta: p.pregunta,
      respuesta: p.respuesta,
      categoria: p.categoria ?? '',
      sentimiento: sentiment,
    }));
  }
}

export const googleSheetsService = new GoogleSheetsService();
