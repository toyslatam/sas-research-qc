import fs from 'fs';
import os from 'os';
import OpenAI from 'openai';
import path from 'path';
import { config } from '../config';
import {
  cleanupPreparedAudio,
  prepareAudioForWhisper,
} from './audioPreprocessor';

/** Carpeta persistente del proyecto. Solo /tmp en despliegue cloud (Railway/Render). */
function getTranscriptsDir(): string {
  const isCloud = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RENDER);
  if (process.env.NODE_ENV === 'production' && isCloud) {
    return path.join(os.tmpdir(), 'whispper-transcripts');
  }
  return config.paths.transcripts;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Servicio de transcripción con OpenAI Whisper API.
 * Comprime o divide audio >24 MB antes de enviar. Incluye reintentos y guardado en /transcripts/.
 */
export class TranscriptionService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      if (!config.openai.apiKey) {
        throw new Error('OPENAI_API_KEY no configurada');
      }
      this.client = new OpenAI({ apiKey: config.openai.apiKey });
    }
    return this.client;
  }

  private async transcribeSingleFile(audioPath: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const stream = fs.createReadStream(audioPath);
        const response = await this.getClient().audio.transcriptions.create({
          file: stream as unknown as File,
          model: config.openai.whisperModel,
          language: 'es',
          response_format: 'verbose_json',
        });

        const text =
          typeof response === 'string'
            ? response
            : (response as { text?: string }).text ?? '';

        if (!text.trim()) {
          throw new Error('Whisper devolvió transcripción vacía');
        }

        return text;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[TranscriptionService] Intento ${attempt}/${MAX_RETRIES} falló (${path.basename(audioPath)}):`,
          lastError.message
        );
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw new Error(
      `Transcripción fallida tras ${MAX_RETRIES} intentos: ${lastError?.message}`
    );
  }

  /**
   * Transcribe un archivo de audio y guarda el .txt en transcripts/.
   */
  async transcribeFile(
    audioPath: string,
    interviewExternalId: string,
    interviewDbId?: number
  ): Promise<{ text: string; transcriptPath: string }> {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Archivo de audio no encontrado: ${audioPath}`);
    }

    const originalSize = fs.statSync(audioPath).size;
    const prepared = await prepareAudioForWhisper(audioPath);

    try {
      if (prepared.preprocessed) {
        console.log(
          `[Transcription] Audio original ${(originalSize / 1024 / 1024).toFixed(1)} MB → ${prepared.paths.length} parte(s) para Whisper`
        );
      }

      const parts: string[] = [];
      for (let i = 0; i < prepared.paths.length; i++) {
        const partPath = prepared.paths[i];
        const partText = await this.transcribeSingleFile(partPath);
        parts.push(partText.trim());
        if (prepared.paths.length > 1) {
          console.log(
            `[Transcription] Parte ${i + 1}/${prepared.paths.length} transcrita (${partText.length} caracteres)`
          );
        }
      }

      const text = parts.join('\n\n');

      const transcriptFilename = interviewDbId
        ? `entrevista_${interviewDbId}_${interviewExternalId}.txt`
        : `entrevista_${interviewExternalId}.txt`;
      const transcriptsDir = getTranscriptsDir();
      const transcriptPath = path.join(transcriptsDir, transcriptFilename);

      if (!fs.existsSync(transcriptsDir)) {
        fs.mkdirSync(transcriptsDir, { recursive: true });
      }

      fs.writeFileSync(transcriptPath, text, 'utf-8');
      console.log(`[Transcription] Guardado localmente: ${transcriptPath} (${text.length} caracteres)`);

      return { text, transcriptPath };
    } finally {
      cleanupPreparedAudio(prepared.tempFiles);
    }
  }
}

export const transcriptionService = new TranscriptionService();
