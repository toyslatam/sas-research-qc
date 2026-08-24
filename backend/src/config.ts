import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** Raíz del monorepo (Whispper_App), independiente del cwd al arrancar npm */
const root = path.resolve(__dirname, '../..');

/** Rutas relativas en .env se resuelven siempre desde la raíz del proyecto */
function resolveProjectPath(envValue: string | undefined, defaultRelative: string): string {
  if (!envValue) return path.join(root, defaultRelative);
  return path.isAbsolute(envValue) ? envValue : path.resolve(root, envValue);
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    whisperModel: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
    gptModel: process.env.OPENAI_GPT_MODEL || 'gpt-4o-mini',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  },
  googleSheets: {
    enabled: process.env.GOOGLE_SHEETS_ENABLED === 'true',
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '',
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  googleOAuth: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    redirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      'http://localhost:4001/api/qc/recruit/gmail/callback',
  },
  webAppUrl: process.env.WEB_APP_URL || 'http://localhost:3000',
  paths: {
    database: resolveProjectPath(process.env.DATABASE_PATH, 'data/whispper.db'),
    recordings: resolveProjectPath(process.env.RECORDINGS_DIR, 'recordings'),
    transcripts: resolveProjectPath(process.env.TRANSCRIPTS_DIR, 'transcripts'),
    schema: path.join(root, 'database', 'schema.sql'),
  },
};
