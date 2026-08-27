import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabaseClient';
import {
  compareEmbedding,
  embedAudio,
  isSpeakerServiceHealthy,
  SpeakerServiceUnavailable,
  type CompareCandidate,
} from '../services/speakerClient';

/**
 * Rutas de reconocimiento de hablante — Fase 1 (aisladas).
 *
 * Se montan bajo /api/speaker. Si el microservicio Python está apagado, cada
 * endpoint responde 503 con un mensaje claro y NADA más del backend se ve
 * afectado. No tocan tablas ni flujos de Whispper.
 */

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

/** pgvector se guarda/lee como texto "[a,b,c]"; helpers para convertir. */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
function parseVector(value: unknown): number[] {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as number[];
    } catch {
      return [];
    }
  }
  return [];
}

function handleErr(res: import('express').Response, err: unknown): void {
  if (err instanceof SpeakerServiceUnavailable) {
    res.status(503).json({ error: err.message, available: false });
    return;
  }
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
}

// ── Health: ¿está vivo el microservicio? ───────────────────────────────────
router.get('/health', async (_req, res) => {
  const available = await isSpeakerServiceHealthy();
  res.json({ available });
});

// ── Embed + guardar en speaker_embeddings ──────────────────────────────────
router.post('/embed', upload.single('file'), async (req, res) => {
  try {
    const recordingId = typeof req.body.recording_id === 'string' ? req.body.recording_id : '';
    const personId = typeof req.body.person_id === 'string' && req.body.person_id ? req.body.person_id : null;
    if (!recordingId) {
      res.status(400).json({ error: 'recording_id es requerido' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'archivo de audio (file) es requerido' });
      return;
    }

    const result = await embedAudio(req.file.buffer, req.file.originalname);

    const { data, error } = await supabase
      .from('speaker_embeddings')
      .insert({
        recording_id: recordingId,
        person_id: personId,
        embedding: toVectorLiteral(result.embedding),
        model_name: result.model_name,
        duration_used: result.duration_used,
      })
      .select('id')
      .single();
    if (error) throw error;

    res.status(201).json({
      id: data.id,
      recording_id: recordingId,
      person_id: personId,
      model_name: result.model_name,
      dim: result.dim,
      duration_used: result.duration_used,
    });
  } catch (err) {
    handleErr(res, err);
  }
});

// ── Comparar una grabación contra las demás ────────────────────────────────
router.post('/compare/:recordingId', async (req, res) => {
  try {
    const recordingId = req.params.recordingId;

    const { data: own, error: ownErr } = await supabase
      .from('speaker_embeddings')
      .select('embedding')
      .eq('recording_id', recordingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ownErr) throw ownErr;
    if (!own) {
      res.status(404).json({ error: 'No hay embedding para esa grabación' });
      return;
    }

    const { data: others, error: othersErr } = await supabase
      .from('speaker_embeddings')
      .select('recording_id, person_id, embedding')
      .neq('recording_id', recordingId);
    if (othersErr) throw othersErr;

    const candidates: CompareCandidate[] = (others ?? []).map((row) => ({
      person_id: row.person_id as string | null,
      recording_id: row.recording_id as string,
      embedding: parseVector(row.embedding),
    }));

    if (candidates.length === 0) {
      res.json({ recording_id: recordingId, matches: [] });
      return;
    }

    const topK = typeof req.body?.top_k === 'number' ? req.body.top_k : 5;
    const matches = await compareEmbedding(parseVector(own.embedding), candidates, topK);

    // Persistir las coincidencias (best-effort; si falla no rompe la respuesta).
    if (matches.length > 0) {
      await supabase.from('speaker_matches').insert(
        matches.map((m) => ({
          recording_id: recordingId,
          matched_person_id: m.person_id,
          matched_recording_id: m.recording_id,
          similarity_score: m.similarity_score,
          confidence: m.confidence,
          rank: m.rank,
        })),
      );
    }

    res.json({ recording_id: recordingId, matches });
  } catch (err) {
    handleErr(res, err);
  }
});

export { router as speakerRouter };
