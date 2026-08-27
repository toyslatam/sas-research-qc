import { Router } from 'express';
import multer from 'multer';
import { qcRepo } from '../../db/supabase-repositories';

/** QC-5/10: Evidencias (incluye upload a Storage) */
const router = Router();
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const VALID_EVIDENCE_TYPE = new Set(['photo', 'audio', 'document', 'link', 'note']);
const VALID_EVIDENCE_STAGE = new Set(['ubicacion', 'contenido', 'telefono']);

router.get('/orgs/:orgId/surveys/:surveyId/evidences', async (req, res) => {
  try {
    const { orgId, surveyId: rawId } = req.params;
    const surveyId = parseInt(rawId, 10);
    const userId = req.authUserId ?? '';
    if (!Number.isFinite(surveyId) || !userId) {
      res.status(400).json({ error: 'surveyId y userId son requeridos' });
      return;
    }
    const canRead =
      (await qcRepo.userHasPermission(userId, orgId, 'qc:surveys:read')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read'));
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const rows = await qcRepo.listEvidences(orgId, surveyId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/orgs/:orgId/surveys/:surveyId/evidences', async (req, res) => {
  try {
    const { orgId, surveyId: rawId } = req.params;
    const surveyId = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(surveyId)) {
      res.status(400).json({ error: 'surveyId inválido' });
      return;
    }
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed =
      (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:surveys:review')) ||
      (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:projects:write'));
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso para agregar evidencias' });
      return;
    }
    if (typeof body.evidence_type !== 'string' || !VALID_EVIDENCE_TYPE.has(body.evidence_type)) {
      res.status(400).json({ error: 'evidence_type inválido' });
      return;
    }
    if (
      body.stage_type != null &&
      body.stage_type !== '' &&
      (typeof body.stage_type !== 'string' || !VALID_EVIDENCE_STAGE.has(body.stage_type))
    ) {
      res.status(400).json({ error: 'stage_type inválido' });
      return;
    }

    const row = await qcRepo.createEvidence(orgId, surveyId, {
      evidence_type: body.evidence_type as 'photo' | 'audio' | 'document' | 'link' | 'note',
      title: typeof body.title === 'string' ? body.title : '',
      url: typeof body.url === 'string' ? body.url : '',
      notes: typeof body.notes === 'string' ? body.notes : '',
      stage_type:
        typeof body.stage_type === 'string' && body.stage_type
          ? (body.stage_type as 'ubicacion' | 'contenido' | 'telefono')
          : null,
      uploadedBy: actorUserId,
    });
    res.status(201).json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('no encontrada') ? 404 : 500).json({ error: msg });
  }
});

// QC-10: upload de archivo a Storage
router.post(
  '/orgs/:orgId/surveys/:surveyId/evidences/upload',
  evidenceUpload.single('file'),
  async (req, res) => {
    try {
      const { orgId, surveyId: rawId } = req.params;
      const surveyId = parseInt(rawId, 10);
      const actorUserId = req.authUserId ?? '';
      if (!Number.isFinite(surveyId) || !actorUserId) {
        res.status(400).json({ error: 'surveyId y actorUserId son requeridos' });
        return;
      }
      const allowed =
        (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:surveys:review')) ||
        (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:projects:write'));
      if (!allowed) {
        res.status(403).json({ error: 'Sin permiso para subir evidencias' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: 'Archivo requerido (campo file)' });
        return;
      }

      let evidence_type:
        | 'photo'
        | 'audio'
        | 'document'
        | 'link'
        | 'note'
        | undefined;
      if (
        typeof req.body.evidence_type === 'string' &&
        VALID_EVIDENCE_TYPE.has(req.body.evidence_type)
      ) {
        evidence_type = req.body.evidence_type as typeof evidence_type;
      }

      let stage_type: 'ubicacion' | 'contenido' | 'telefono' | null = null;
      if (
        typeof req.body.stage_type === 'string' &&
        req.body.stage_type &&
        VALID_EVIDENCE_STAGE.has(req.body.stage_type)
      ) {
        stage_type = req.body.stage_type as 'ubicacion' | 'contenido' | 'telefono';
      }

      const row = await qcRepo.uploadEvidenceFile(orgId, surveyId, {
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        title: typeof req.body.title === 'string' ? req.body.title : '',
        notes: typeof req.body.notes === 'string' ? req.body.notes : '',
        stage_type,
        evidence_type,
        uploadedBy: actorUserId,
      });
      res.status(201).json(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(msg.includes('no encontrada') ? 404 : 500).json({ error: msg });
    }
  },
);

router.delete('/orgs/:orgId/evidences/:evidenceId', async (req, res) => {
  try {
    const { orgId, evidenceId: rawId } = req.params;
    const evidenceId = parseInt(rawId, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(evidenceId) || !actorUserId) {
      res.status(400).json({ error: 'evidenceId y actorUserId son requeridos' });
      return;
    }
    const allowed =
      (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:surveys:review')) ||
      (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:projects:write'));
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const ok = await qcRepo.deleteEvidence(orgId, evidenceId, actorUserId);
    if (!ok) {
      res.status(404).json({ error: 'Evidencia no encontrada' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export { router as qcEvidencesRouter };
