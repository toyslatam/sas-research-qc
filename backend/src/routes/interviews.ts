import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  answerRepo,
  insightsRepo,
  interviewRepo,
  transcriptRepo,
} from '../db/supabase-repositories';
import { config } from '../config';
import {
  processInterviewPipeline,
  saveRecordingFile,
} from '../services/pipelineService';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

export const interviewsRouter = Router();

interviewsRouter.get('/', async (req, res) => {
  try {
    const projectId = req.query.projectId
      ? parseInt(String(req.query.projectId), 10)
      : undefined;
    res.json(await interviewRepo.list(projectId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

interviewsRouter.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }
    if (!(await interviewRepo.getById(id))) {
      res.status(404).json({ error: 'Entrevista no encontrada' });
      return;
    }
    const fields: { participant_name?: string; contact?: string; interview_date?: string; meeting_stage?: string | null } = {};
    if (req.body.participantName !== undefined)
      fields.participant_name = String(req.body.participantName).trim();
    if (req.body.contact !== undefined)
      fields.contact = String(req.body.contact).trim();
    if (req.body.interviewDate !== undefined)
      fields.interview_date = String(req.body.interviewDate).trim();
    if (req.body.meetingStage !== undefined)
      fields.meeting_stage = String(req.body.meetingStage).trim() || null;
    await interviewRepo.updateFields(id, fields);
    res.json({ id, ...fields });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

interviewsRouter.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const interview = await interviewRepo.getById(id);
    if (!interview) {
      res.status(404).json({ error: 'Entrevista no encontrada' });
      return;
    }

    const [transcript, answers, insights] = await Promise.all([
      transcriptRepo.getByInterviewId(id),
      answerRepo.listByInterview(id),
      insightsRepo.get(id),
    ]);

    // Si solo existe en Supabase, volcar copia local bajo demanda
    if (transcript?.full_text) {
      const localPath = path.join(
        config.paths.transcripts,
        `entrevista_${id}_${(interview as { external_id?: string }).external_id ?? 'export'}.txt`
      );
      if (!fs.existsSync(localPath)) {
        if (!fs.existsSync(config.paths.transcripts)) {
          fs.mkdirSync(config.paths.transcripts, { recursive: true });
        }
        fs.writeFileSync(localPath, transcript.full_text, 'utf-8');
      }
    }

    res.json({ ...interview, transcript, answers, insights });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * Sube audio y ejecuta el pipeline completo (transcripción + match + insights).
 */
interviewsRouter.post(
  '/process',
  upload.single('audio'),
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.body.projectId), 10);
      const rawDuration = req.body.durationSec;
      const durationSec =
        rawDuration !== undefined && rawDuration !== null && String(rawDuration).trim() !== ''
          ? parseFloat(String(rawDuration))
          : undefined;

      if (!projectId || !req.file) {
        res.status(400).json({ error: 'projectId y archivo audio son requeridos' });
        return;
      }

      const externalId = uuidv4().slice(0, 8);
      const { filename, fullPath } = saveRecordingFile(
        req.file.buffer,
        req.file.originalname || 'recording.webm'
      );

      const participantName = String(req.body.participantName ?? '').trim();
      const meetingStage = String(req.body.meetingStage ?? '').trim() || undefined;

      const interviewId = await interviewRepo.create(
        projectId,
        externalId,
        filename,
        durationSec,
        participantName,
        'exploratorio',
        'audio',
        meetingStage
      );

      const result = await processInterviewPipeline(interviewId, fullPath);

      res.status(201).json({
        message: 'Pipeline completado',
        interviewId: result.interviewId,
        externalId,
        filename,
        participantName,
        transcriptLength: result.transcriptLength,
        transcriptPreview: result.transcriptPreview,
        answersTotal: result.answersTotal,
        answersWithContent: result.answersWithContent,
        audioSizeKb: Math.round(result.audioSizeBytes / 1024),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[interviews/process]', message);
      res.status(500).json({ error: message });
    }
  }
);
