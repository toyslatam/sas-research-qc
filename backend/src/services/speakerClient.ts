import { config } from '../config';

/**
 * Cliente del microservicio Python de reconocimiento de hablante.
 *
 * AISLAMIENTO: si el servicio no está configurado o no responde, estas
 * funciones lanzan `SpeakerServiceUnavailable`. Ningún otro flujo del backend
 * (Whispper, transcripción, QC) depende de esto; si el microservicio está
 * apagado, todo lo demás sigue igual.
 */

export class SpeakerServiceUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeakerServiceUnavailable';
  }
}

export interface EmbedResult {
  embedding: number[];
  model_name: string;
  dim: number;
  duration_used: number;
  sample_rate: number;
}

export interface SpeakerMatch {
  person_id: string | null;
  recording_id: string | null;
  similarity_score: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  rank: number;
}

export interface CompareCandidate {
  person_id?: string | null;
  recording_id?: string | null;
  embedding: number[];
}

function baseUrl(): string {
  if (!config.speakerService.enabled) {
    throw new SpeakerServiceUnavailable('SPEAKER_SERVICE_URL no está configurada');
  }
  return config.speakerService.url.replace(/\/+$/, '');
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.speakerService.timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SpeakerServiceUnavailable('El microservicio de voz no respondió a tiempo');
    }
    if (err instanceof SpeakerServiceUnavailable) throw err;
    throw new SpeakerServiceUnavailable(
      `No se pudo contactar el microservicio de voz: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** ¿El microservicio está vivo? No lanza: devuelve false si no. */
export async function isSpeakerServiceHealthy(): Promise<boolean> {
  if (!config.speakerService.enabled) return false;
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${baseUrl()}/health`, { signal });
      return res.ok;
    });
  } catch {
    return false;
  }
}

/** Genera el embedding de un audio. `audio` es el binario del archivo. */
export async function embedAudio(audio: Buffer, filename = 'audio'): Promise<EmbedResult> {
  return withTimeout(async (signal) => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)]), filename);
    const res = await fetch(`${baseUrl()}/embed`, { method: 'POST', body: form, signal });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new SpeakerServiceUnavailable(`/embed devolvió ${res.status}: ${detail}`);
    }
    return (await res.json()) as EmbedResult;
  });
}

/** Rankea candidatos frente a un embedding de consulta. */
export async function compareEmbedding(
  embedding: number[],
  candidates: CompareCandidate[],
  topK = 5,
): Promise<SpeakerMatch[]> {
  return withTimeout(async (signal) => {
    const res = await fetch(`${baseUrl()}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embedding, candidates, top_k: topK }),
      signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new SpeakerServiceUnavailable(`/compare devolvió ${res.status}: ${detail}`);
    }
    return (await res.json()) as SpeakerMatch[];
  });
}
