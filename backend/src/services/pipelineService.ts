import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../config';
import {
  answerRepo,
  categoryRepo,
  insightsRepo,
  interviewRepo,
  projectRepo,
  questionRepo,
  transcriptRepo,
} from '../db/supabase-repositories';
import { googleSheetsService } from './googleSheetsService';
import { insightsService } from './insightsService';
import { matchService } from './matchService';
import { transcriptionService } from './transcriptionService';

/**
 * Orquesta el pipeline completo post-grabación:
 * Whisper → Match → Insights → Supabase → Google Sheets
 */
export async function processInterviewPipeline(
  interviewDbId: number,
  audioPath: string
): Promise<{
  success: boolean;
  interviewId: number;
  transcriptLength: number;
  transcriptPreview: string;
  answersTotal: number;
  answersWithContent: number;
  audioSizeBytes: number;
}> {
  const interview = await interviewRepo.getById(interviewDbId) as {
    id: number;
    external_id: string;
    project_id: number;
    created_at: string;
  } | undefined;

  if (!interview) {
    throw new Error(`Entrevista ${interviewDbId} no encontrada`);
  }

  const [project, questions, categories] = await Promise.all([
    projectRepo.getById(interview.project_id),
    questionRepo.listByProject(interview.project_id),
    categoryRepo.listByProject(interview.project_id),
  ]);

  if (questions.length === 0) {
    throw new Error('El proyecto no tiene preguntas configuradas');
  }

  const audioSizeBytes = fs.existsSync(audioPath) ? fs.statSync(audioPath).size : 0;

  try {
    await interviewRepo.updateStatus(interviewDbId, 'transcribing');
    const { text, transcriptPath } = await transcriptionService.transcribeFile(
      audioPath,
      interview.external_id,
      interviewDbId
    );
    await transcriptRepo.save(interviewDbId, text, transcriptPath);
    console.log(
      `[Pipeline] Entrevista #${interviewDbId}: audio ${(audioSizeBytes / 1024).toFixed(1)} KB, transcripción ${text.length} caracteres`
    );

    await interviewRepo.updateStatus(interviewDbId, 'matching');
    const match = await matchService.extractAnswers(
      interview.external_id,
      text,
      questions,
      categories
    );
    await answerRepo.saveFromMatch(interviewDbId, match, questions);

    const answersTotal = match.preguntas.length;
    const answersWithContent = match.preguntas.filter(
      (p) => p.respuesta.trim() && !/^no mencionado$/i.test(p.respuesta.trim())
    ).length;

    await interviewRepo.updateStatus(interviewDbId, 'insights');
    const insights = await insightsService.generate(text, match);
    await insightsRepo.save(interviewDbId, insights);

    if (googleSheetsService.isEnabled()) {
      const rows = googleSheetsService.buildRowsFromInterview(
        interview.external_id,
        interview.created_at,
        project?.name ?? '',
        match,
        insights
      );
      await googleSheetsService.appendRows(rows);
    }

    await interviewRepo.updateStatus(interviewDbId, 'completed');
    return {
      success: true,
      interviewId: interviewDbId,
      transcriptLength: text.length,
      transcriptPreview: text.slice(0, 280).replace(/\s+/g, ' ').trim(),
      answersTotal,
      answersWithContent,
      audioSizeBytes,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await interviewRepo.updateStatus(interviewDbId, 'error', message);
    throw err;
  }
}

/** Guarda el buffer de audio en un directorio temporal y devuelve la ruta */
export function saveRecordingFile(
  buffer: Buffer,
  originalName: string
): { filename: string; fullPath: string } {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  const ext = path.extname(originalName) || '.webm';
  const filename = `entrevista_${stamp}${ext}`;

  // Dev: carpeta del proyecto (recordings/). Producción: /tmp o RECORDINGS_DIR
  const dir =
    process.env.NODE_ENV === 'production'
      ? process.env.RECORDINGS_DIR
        ? path.resolve(process.env.RECORDINGS_DIR)
        : os.tmpdir()
      : config.paths.recordings;

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, buffer);

  return { filename, fullPath };
}
