import { Router } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import type { AiAnalysisTask } from '@whispper/shared';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import {
  aiMeetingAnalysisRepo,
  managedProjectRepo,
} from '../db/supabase-repositories';
import { saveRecordingFile } from '../services/pipelineService';
import { transcriptionService } from '../services/transcriptionService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const ANALYSIS_PROMPT = `Eres un consultor senior de reuniones ejecutivas.
Analiza la transcripción y responde SOLO JSON válido con esta estructura:
{
  "summary": "string breve",
  "agreements": ["string"],
  "tasks": [
    { "title": "string", "owner": "string", "due_date": "YYYY-MM-DD|null" }
  ],
  "risks": ["string"],
  "decisions": ["string"]
}
Reglas:
- Máximo 10 elementos por lista.
- Si no hay datos, devuelve listas vacías.
- due_date debe ser null si no existe fecha explícita.
- Idioma de salida: español.`;

function getOpenAIClient(): OpenAI {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY no configurada');
  }
  return new OpenAI({ apiKey: config.openai.apiKey });
}

async function translateText(
  client: OpenAI,
  text: string,
  targetLanguage: string,
): Promise<string> {
  if (!text.trim()) return '';
  if (targetLanguage.toLowerCase() === 'es') return text;

  const completion = await client.chat.completions.create({
    model: config.openai.gptModel,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content:
          `Traduce fielmente el texto al idioma "${targetLanguage}". ` +
          'Devuelve solo el texto traducido, sin comentarios extra.',
      },
      { role: 'user', content: text.slice(0, 120000) },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

async function analyzeMeeting(
  client: OpenAI,
  transcriptText: string,
): Promise<{
  summary: string;
  agreements: string[];
  tasks: AiAnalysisTask[];
  risks: string[];
  decisions: string[];
}> {
  const completion = await client.chat.completions.create({
    model: config.openai.gptModel,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: ANALYSIS_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({ transcript: transcriptText.slice(0, 120000) }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('OpenAI no devolvió análisis');

  const parsed = JSON.parse(raw) as {
    summary?: string;
    agreements?: unknown[];
    tasks?: unknown[];
    risks?: unknown[];
    decisions?: unknown[];
  };

  const safeTasks: AiAnalysisTask[] = Array.isArray(parsed.tasks)
    ? parsed.tasks.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          title: typeof row.title === 'string' ? row.title : '',
          owner: typeof row.owner === 'string' ? row.owner : '',
          due_date:
            typeof row.due_date === 'string'
              ? row.due_date
              : row.due_date === null
                ? null
                : null,
        };
      }).filter((t) => t.title.trim().length > 0)
    : [];

  const toStringArray = (arr: unknown[] | undefined): string[] =>
    Array.isArray(arr)
      ? arr.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
      : [];

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    agreements: toStringArray(parsed.agreements),
    tasks: safeTasks,
    risks: toStringArray(parsed.risks),
    decisions: toStringArray(parsed.decisions),
  };
}

export const aiRouter = Router();

aiRouter.get('/analyses', async (req, res) => {
  try {
    const managedProjectId = req.query.managedProjectId
      ? parseInt(String(req.query.managedProjectId), 10)
      : undefined;
    const rows = await aiMeetingAnalysisRepo.listByProject(managedProjectId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

aiRouter.post('/analyze-audio', upload.single('audio'), async (req, res) => {
  try {
    const managedProjectId = parseInt(String(req.body.managedProjectId), 10);
    const meetingTitle = String(req.body.meetingTitle ?? '').trim() || 'Reunión sin título';
    const targetLanguage = String(req.body.targetLanguage ?? 'en').trim() || 'en';

    if (!Number.isFinite(managedProjectId)) {
      res.status(400).json({ error: 'managedProjectId es requerido' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'archivo audio es requerido' });
      return;
    }

    const project = await managedProjectRepo.getById(managedProjectId);
    if (!project) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const { fullPath, filename } = saveRecordingFile(
      req.file.buffer,
      req.file.originalname || `ai_audio_${Date.now()}.webm`,
    );

    const externalId = `ai-${uuidv4().slice(0, 8)}`;
    const { text: transcriptText } = await transcriptionService.transcribeFile(
      fullPath,
      externalId,
    );

    const openai = getOpenAIClient();
    const translatedText = await translateText(openai, transcriptText, targetLanguage);
    const analysis = await analyzeMeeting(openai, transcriptText);

    const saved = await aiMeetingAnalysisRepo.create({
      managed_project_id: managedProjectId,
      meeting_title: meetingTitle,
      source_filename: filename,
      transcript_text: transcriptText,
      translated_text: translatedText,
      target_language: targetLanguage,
      summary: analysis.summary,
      agreements: analysis.agreements,
      tasks: analysis.tasks,
      risks: analysis.risks,
      decisions: analysis.decisions,
    });

    res.status(201).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ai/analyze-audio]', message);
    res.status(500).json({ error: message });
  }
});

