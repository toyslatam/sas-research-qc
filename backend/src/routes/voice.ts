import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../lib/supabaseClient';
import {
  compareEmbedding,
  embedAudio,
  SpeakerServiceUnavailable,
  type CompareCandidate,
} from '../services/speakerClient';

/**
 * Módulo independiente "Verificación de Voz" — API consumida por AMBOS
 * clientes (web y app Android). Organizaciones propias del módulo
 * (`speaker_orgs`), roles encuestador/admin, grabaciones y dictámenes de QC.
 *
 * Auth: se monta detrás de requireQcAuth (verifica el JWT de Supabase y expone
 * req.authUserId). No toca Whispper ni QC. Requiere migraciones speaker_1..3.
 */

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const AUDIO_BUCKET = 'speaker-audio';

type Role = 'admin' | 'encuestador';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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

/** Rol del usuario dentro de una org del módulo, o null si no es miembro. */
async function memberRole(userId: string, orgId: string): Promise<Role | null> {
  const { data } = await supabase
    .from('speaker_org_members')
    .select('role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();
  return (data?.role as Role | undefined) ?? null;
}

// ── Organizaciones ─────────────────────────────────────────────────────────

// Crear org: el creador queda como admin.
router.post('/orgs', async (req, res) => {
  try {
    const userId = req.authUserId ?? '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }
    const { data: org, error } = await supabase
      .from('speaker_orgs')
      .insert({ name, created_by: userId })
      .select('*')
      .single();
    if (error) throw error;

    const { error: memberErr } = await supabase
      .from('speaker_org_members')
      .insert({ org_id: org.id, user_id: userId, role: 'admin' });
    if (memberErr) throw memberErr;

    res.status(201).json({ ...org, role: 'admin' });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// Listar las orgs donde el usuario es miembro, con su rol.
router.get('/orgs', async (req, res) => {
  try {
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    const { data, error } = await supabase
      .from('speaker_org_members')
      .select('role, speaker_orgs(id, name, created_at)')
      .eq('user_id', userId);
    if (error) throw error;
    const orgs = (data ?? [])
      .filter((r) => r.speaker_orgs)
      .map((r) => ({ ...(r.speaker_orgs as object), role: r.role }));
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// Admin agrega un miembro (por user_id de Supabase Auth) con un rol.
router.post('/orgs/:orgId/members', async (req, res) => {
  try {
    const userId = req.authUserId ?? '';
    const { orgId } = req.params;
    if ((await memberRole(userId, orgId)) !== 'admin') {
      res.status(403).json({ error: 'Solo un admin puede agregar miembros' });
      return;
    }
    const memberUserId = typeof req.body?.user_id === 'string' ? req.body.user_id : '';
    const role: Role = req.body?.role === 'admin' ? 'admin' : 'encuestador';
    if (!memberUserId) {
      res.status(400).json({ error: 'user_id es requerido' });
      return;
    }
    const { data, error } = await supabase
      .from('speaker_org_members')
      .upsert({ org_id: orgId, user_id: memberUserId, role }, { onConflict: 'org_id,user_id' })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// ── Grabaciones ────────────────────────────────────────────────────────────

// Crear grabación (encuestador o admin). El audio sube a Storage y se dispara
// el embedding si el microservicio está disponible; si no, queda 'uploaded'.
router.post('/orgs/:orgId/recordings', upload.single('file'), async (req, res) => {
  try {
    const userId = req.authUserId ?? '';
    const { orgId } = req.params;
    const role = await memberRole(userId, orgId);
    if (!role) {
      res.status(403).json({ error: 'No pertenece a esta organización' });
      return;
    }
    const interviewId = typeof req.body?.interview_id === 'string' ? req.body.interview_id.trim() : '';
    if (!interviewId) {
      res.status(400).json({ error: 'interview_id (ID de la entrevista) es obligatorio' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'archivo de audio (file) es requerido' });
      return;
    }

    // Subir a Storage. La ruta incluye la org para aislar por inquilino.
    const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase();
    const path = `${orgId}/${interviewId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (upErr) {
      res.status(502).json({ error: `No se pudo guardar el audio en Storage: ${upErr.message}` });
      return;
    }

    const { data: rec, error } = await supabase
      .from('speaker_recordings')
      .insert({
        org_id: orgId,
        surveyor_id: userId,
        interview_id: interviewId,
        storage_path: path,
        audio_format: req.file.mimetype || ext,
        status: 'uploaded',
      })
      .select('*')
      .single();
    if (error) throw error;

    // Intentar generar el embedding. Si el microservicio está apagado, la
    // grabación queda guardada igual (status 'uploaded') para procesar luego.
    let embeddingStatus = 'uploaded';
    try {
      const result = await embedAudio(req.file.buffer, req.file.originalname);
      await supabase.from('speaker_embeddings').insert({
        org_id: orgId,
        recording_id: String(rec.id),
        person_id: userId,
        embedding: toVectorLiteral(result.embedding),
        model_name: result.model_name,
        model_version: result.model_version,
        duration_used: result.duration_used,
        source_start_seconds: result.source_start_seconds,
        source_end_seconds: result.source_end_seconds,
      });
      await supabase.from('speaker_recordings').update({ status: 'embedded' }).eq('id', rec.id);
      embeddingStatus = 'embedded';
    } catch (err) {
      if (!(err instanceof SpeakerServiceUnavailable)) {
        await supabase.from('speaker_recordings').update({ status: 'failed' }).eq('id', rec.id);
        embeddingStatus = 'failed';
      }
    }

    res.status(201).json({ ...rec, embedding_status: embeddingStatus });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// Listar grabaciones: admin ve todas; encuestador solo las suyas.
router.get('/orgs/:orgId/recordings', async (req, res) => {
  try {
    const userId = req.authUserId ?? '';
    const { orgId } = req.params;
    const role = await memberRole(userId, orgId);
    if (!role) {
      res.status(403).json({ error: 'No pertenece a esta organización' });
      return;
    }
    let query = supabase
      .from('speaker_recordings')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (role === 'encuestador') query = query.eq('surveyor_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// Coincidencias de una grabación contra las demás de la misma org (admin).
router.get('/orgs/:orgId/recordings/:id/matches', async (req, res) => {
  try {
    const userId = req.authUserId ?? '';
    const { orgId, id } = req.params;
    if ((await memberRole(userId, orgId)) !== 'admin') {
      res.status(403).json({ error: 'Solo un admin puede ver coincidencias' });
      return;
    }
    const { data: own } = await supabase
      .from('speaker_embeddings')
      .select('embedding')
      .eq('org_id', orgId)
      .eq('recording_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!own) {
      res.status(404).json({ error: 'Esa grabación aún no tiene embedding' });
      return;
    }
    const { data: others } = await supabase
      .from('speaker_embeddings')
      .select('id, recording_id, person_id, embedding')
      .eq('org_id', orgId)
      .neq('recording_id', id);
    const candidates: CompareCandidate[] = (others ?? []).map((row) => ({
      embedding_id: row.id as number,
      person_id: row.person_id as string | null,
      recording_id: row.recording_id as string,
      embedding: parseVector(row.embedding),
    }));
    if (candidates.length === 0) {
      res.json({ recording_id: id, matches: [] });
      return;
    }
    const topK = typeof req.query.top_k === 'string' ? parseInt(req.query.top_k, 10) : 10;
    const matches = await compareEmbedding(parseVector(own.embedding), candidates, topK);
    res.json({ recording_id: id, matches });
  } catch (err) {
    if (err instanceof SpeakerServiceUnavailable) {
      res.status(503).json({ error: err.message, available: false });
      return;
    }
    res.status(500).json({ error: errMsg(err) });
  }
});

// Dictamen de QC: el admin marca aprobado/duplicado/rechazado.
router.post('/orgs/:orgId/recordings/:id/review', async (req, res) => {
  try {
    const userId = req.authUserId ?? '';
    const { orgId, id } = req.params;
    if ((await memberRole(userId, orgId)) !== 'admin') {
      res.status(403).json({ error: 'Solo un admin puede dictaminar' });
      return;
    }
    const disposition = req.body?.disposition;
    if (!['approved', 'duplicate', 'rejected', 'pending'].includes(disposition)) {
      res.status(400).json({ error: 'disposition inválido' });
      return;
    }
    const { data, error } = await supabase
      .from('speaker_recordings')
      .update({
        disposition,
        review_notes: typeof req.body?.notes === 'string' ? req.body.notes : '',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

export { router as voiceRouter };
