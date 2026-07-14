import { google } from 'googleapis';
import { config } from '../config';

/**
 * Google Drive (opcional). Reutiliza la cuenta de servicio de Sheets.
 * Scope adicional: drive.file
 */
export class GoogleDriveService {
  isEnabled(): boolean {
    return Boolean(
      config.googleSheets.clientEmail &&
        config.googleSheets.privateKey &&
        process.env.GOOGLE_DRIVE_ENABLED === 'true',
    );
  }

  private async getDriveClient() {
    const auth = new google.auth.JWT({
      email: config.googleSheets.clientEmail,
      key: config.googleSheets.privateKey,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });
    return google.drive({ version: 'v3', auth });
  }

  async uploadTextFile(
    fileName: string,
    content: string,
  ): Promise<{ ok: boolean; fileId?: string; webViewLink?: string; error?: string }> {
    if (!this.isEnabled()) {
      return {
        ok: false,
        error: 'Google Drive deshabilitado. Configura GOOGLE_DRIVE_ENABLED=true y la cuenta de servicio.',
      };
    }

    try {
      const drive = await this.getDriveClient();
      const created = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: 'text/plain',
        },
        media: {
          mimeType: 'text/plain',
          body: content,
        },
        fields: 'id, webViewLink',
      });

      return {
        ok: true,
        fileId: created.data.id ?? undefined,
        webViewLink: created.data.webViewLink ?? undefined,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const googleDriveService = new GoogleDriveService();
