import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const execFileAsync = promisify(execFile);

/** Límite seguro de Whisper API (25 MB). Usamos 24 MB con margen. */
export const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

/** Tamaño objetivo por fragmento al dividir audio. */
const CHUNK_TARGET_BYTES = 20 * 1024 * 1024;

const COMPRESS_BITRATES = ['64k', '48k', '32k'] as const;

function getFfmpegPath(): string {
  if (!ffmpegPath) {
    throw new Error(
      'ffmpeg no disponible. Instala ffmpeg en el sistema o verifica la dependencia ffmpeg-static.'
    );
  }
  return ffmpegPath;
}

function getFfprobePath(): string {
  const probePath = (ffprobeStatic as { path?: string }).path;
  if (!probePath) {
    throw new Error('ffprobe no disponible (ffprobe-static).');
  }
  return probePath;
}

async function runFfmpeg(args: string[]): Promise<void> {
  const bin = getFfmpegPath();
  await execFileAsync(bin, args, { maxBuffer: 10 * 1024 * 1024 });
}

async function getDurationSec(filePath: string): Promise<number> {
  const probe = getFfprobePath();
  const { stdout } = await execFileAsync(probe, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`No se pudo obtener duración del audio: ${filePath}`);
  }
  return duration;
}

async function compressAudio(inputPath: string, outputPath: string, bitrate: string): Promise<void> {
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    bitrate,
    outputPath,
  ]);
}

async function splitAudio(
  inputPath: string,
  outputPattern: string,
  segmentTimeSec: number
): Promise<string[]> {
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-f',
    'segment',
    '-segment_time',
    String(Math.max(30, Math.floor(segmentTimeSec))),
    '-c',
    'copy',
    outputPattern,
  ]);

  const dir = path.dirname(outputPattern);
  const prefix = path.basename(outputPattern).split('%03d')[0];
  const chunks = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.mp3'))
    .sort()
    .map((name) => path.join(dir, name));

  if (chunks.length === 0) {
    throw new Error('No se generaron fragmentos de audio para transcribir.');
  }
  return chunks;
}

export interface PreparedAudio {
  /** Rutas listas para enviar a Whisper, en orden. */
  paths: string[];
  /** Archivos temporales a eliminar al terminar. */
  tempFiles: string[];
  /** true si se comprimió o dividió el original. */
  preprocessed: boolean;
}

/**
 * Prepara audio para Whisper: si supera 24 MB, comprime y/o divide en partes.
 */
export async function prepareAudioForWhisper(audioPath: string): Promise<PreparedAudio> {
  const originalSize = fs.statSync(audioPath).size;
  if (originalSize <= WHISPER_MAX_BYTES) {
    return { paths: [audioPath], tempFiles: [], preprocessed: false };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whispper-audio-'));
  const tempFiles: string[] = [tempDir];
  const baseName = path.basename(audioPath, path.extname(audioPath));

  console.log(
    `[AudioPreprocessor] Archivo ${(originalSize / 1024 / 1024).toFixed(1)} MB supera límite Whisper; comprimiendo...`
  );

  let workingPath = audioPath;
  let compressedPath: string | null = null;

  for (const bitrate of COMPRESS_BITRATES) {
    const candidate = path.join(tempDir, `${baseName}_${bitrate}.mp3`);
    await compressAudio(audioPath, candidate, bitrate);
    tempFiles.push(candidate);

    const candidateSize = fs.statSync(candidate).size;
    console.log(
      `[AudioPreprocessor] Compresión ${bitrate}: ${(candidateSize / 1024 / 1024).toFixed(1)} MB`
    );

    if (candidateSize <= WHISPER_MAX_BYTES) {
      return { paths: [candidate], tempFiles, preprocessed: true };
    }

    workingPath = candidate;
    compressedPath = candidate;
  }

  const compressedSize = fs.statSync(workingPath).size;
  const durationSec = await getDurationSec(workingPath);
  const chunkCount = Math.max(2, Math.ceil(compressedSize / CHUNK_TARGET_BYTES));
  const segmentTimeSec = durationSec / chunkCount;

  console.log(
    `[AudioPreprocessor] Aún grande (${(compressedSize / 1024 / 1024).toFixed(1)} MB); dividiendo en ${chunkCount} partes (~${Math.round(segmentTimeSec)}s c/u)`
  );

  const chunkPattern = path.join(tempDir, `${baseName}_chunk_%03d.mp3`);
  const chunks = await splitAudio(workingPath, chunkPattern, segmentTimeSec);
  tempFiles.push(...chunks);

  if (compressedPath && compressedPath !== audioPath) {
    // Ya está en tempFiles
  }

  return { paths: chunks, tempFiles, preprocessed: true };
}

export function cleanupPreparedAudio(tempFiles: string[]): void {
  for (const file of tempFiles) {
    try {
      if (fs.existsSync(file)) {
        const stat = fs.statSync(file);
        if (stat.isDirectory()) {
          fs.rmSync(file, { recursive: true, force: true });
        } else {
          fs.unlinkSync(file);
        }
      }
    } catch (err) {
      console.warn('[AudioPreprocessor] No se pudo eliminar temporal:', file, err);
    }
  }
}
