import { Router } from 'express';
import { qcRepo } from '../../db/supabase-repositories';

/** QC-3: Encuestas, revisiones, eventos y evaluación/aplicación de reglas */
const router = Router();
const VALID_SURVEY_STATUS = new Set([
  'pendiente',
  'en_revision',
  'aprobada',
  'rechazada',
  'en_auditoria',
]);
const VALID_STAGE = new Set(['ubicacion', 'contenido', 'telefono']);
const VALID_REVIEW_STATUS = new Set(['aprobada', 'rechazada', 'observacion']);

router.get('/orgs/:orgId/surveys', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const canRead =
      (await qcRepo.userHasPermission(userId, orgId, 'qc:surveys:read')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read'));
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso qc:surveys:read' });
      return;
    }
    const projectIdRaw =
      typeof req.query.projectId === 'string' ? parseInt(req.query.projectId, 10) : NaN;
    const rows = await qcRepo.listSurveys(orgId, {
      projectId: Number.isFinite(projectIdRaw) ? projectIdRaw : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/orgs/:orgId/surveys', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed =
      (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:surveys:review')) ||
      (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:projects:write'));
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso para crear encuestas' });
      return;
    }
    const projectId =
      typeof body.project_id === 'number'
        ? body.project_id
        : typeof body.project_id === 'string'
          ? parseInt(body.project_id, 10)
          : NaN;
    if (!Number.isFinite(projectId)) {
      res.status(400).json({ error: 'project_id es requerido' });
      return;
    }
    const row = await qcRepo.createSurvey(orgId, {
      project_id: projectId,
      external_id: typeof body.external_id === 'string' ? body.external_id : '',
      respondent_code: typeof body.respondent_code === 'string' ? body.respondent_code : '',
      interviewer: typeof body.interviewer === 'string' ? body.interviewer : '',
      phone: typeof body.phone === 'string' ? body.phone : '',
      address: typeof body.address === 'string' ? body.address : '',
      latitude: typeof body.latitude === 'number' ? body.latitude : null,
      longitude: typeof body.longitude === 'number' ? body.longitude : null,
      collected_at: typeof body.collected_at === 'string' ? body.collected_at : null,
      answers:
        body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
          ? (body.answers as Record<string, unknown>)
          : {},
      metadata:
        body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : {},
    });
    res.status(201).json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('Proyecto') ? 400 : 500).json({ error: msg });
  }
});

router.get('/orgs/:orgId/surveys/:surveyId', async (req, res) => {
  try {
    const { orgId, surveyId: rawId } = req.params;
    const surveyId = parseInt(rawId, 10);
    const userId = req.authUserId ?? '';
    if (!Number.isFinite(surveyId)) {
      res.status(400).json({ error: 'surveyId inválido' });
      return;
    }
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const canRead =
      (await qcRepo.userHasPermission(userId, orgId, 'qc:surveys:read')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read'));
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso qc:surveys:read' });
      return;
    }
    const row = await qcRepo.getSurvey(orgId, surveyId);
    if (!row) {
      res.status(404).json({ error: 'Encuesta no encontrada' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.patch('/orgs/:orgId/surveys/:surveyId', async (req, res) => {
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
      res.status(403).json({ error: 'Sin permiso para editar encuestas' });
      return;
    }
    if (body.status && (typeof body.status !== 'string' || !VALID_SURVEY_STATUS.has(body.status))) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }
    const nextStatus =
      typeof body.status === 'string' && VALID_SURVEY_STATUS.has(body.status)
        ? (body.status as
            | 'pendiente'
            | 'en_revision'
            | 'aprobada'
            | 'rechazada'
            | 'en_auditoria')
        : undefined;
    const updated = await qcRepo.updateSurvey(orgId, surveyId, {
      external_id: typeof body.external_id === 'string' ? body.external_id : undefined,
      respondent_code:
        typeof body.respondent_code === 'string' ? body.respondent_code : undefined,
      interviewer: typeof body.interviewer === 'string' ? body.interviewer : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      address: typeof body.address === 'string' ? body.address : undefined,
      latitude:
        body.latitude === null
          ? null
          : typeof body.latitude === 'number'
            ? body.latitude
            : undefined,
      longitude:
        body.longitude === null
          ? null
          : typeof body.longitude === 'number'
            ? body.longitude
            : undefined,
      collected_at:
        body.collected_at === null
          ? null
          : typeof body.collected_at === 'string'
            ? body.collected_at
            : undefined,
      status: nextStatus,
    });
    if (!updated) {
      res.status(404).json({ error: 'Encuesta no encontrada' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.delete('/orgs/:orgId/surveys/:surveyId', async (req, res) => {
  try {
    const { orgId, surveyId: rawId } = req.params;
    const surveyId = parseInt(rawId, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(surveyId)) {
      res.status(400).json({ error: 'surveyId inválido' });
      return;
    }
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:projects:write');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:projects:write' });
      return;
    }
    const ok = await qcRepo.deleteSurvey(orgId, surveyId);
    if (!ok) {
      res.status(404).json({ error: 'Encuesta no encontrada' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/orgs/:orgId/surveys/:surveyId/reviews/:stageType', async (req, res) => {
  try {
    const { orgId, surveyId: rawId, stageType } = req.params;
    const surveyId = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(surveyId)) {
      res.status(400).json({ error: 'surveyId inválido' });
      return;
    }
    if (!VALID_STAGE.has(stageType)) {
      res.status(400).json({ error: 'stageType inválido' });
      return;
    }
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:surveys:review');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:surveys:review' });
      return;
    }
    if (typeof body.status !== 'string' || !VALID_REVIEW_STATUS.has(body.status)) {
      res.status(400).json({ error: 'status de revisión inválido' });
      return;
    }
    const updated = await qcRepo.submitReview(
      orgId,
      surveyId,
      stageType as 'ubicacion' | 'contenido' | 'telefono',
      {
        status: body.status as 'aprobada' | 'rechazada' | 'observacion',
        notes: typeof body.notes === 'string' ? body.notes : '',
        reviewerId: actorUserId,
      },
    );
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('no encontrada') ? 404 : 500).json({ error: msg });
  }
});

router.get('/orgs/:orgId/surveys/:surveyId/events', async (req, res) => {
  try {
    const { orgId, surveyId: rawId } = req.params;
    const surveyId = parseInt(rawId, 10);
    const userId = req.authUserId ?? '';
    if (!Number.isFinite(surveyId) || !userId) {
      res.status(400).json({ error: 'surveyId y userId son requeridos' });
      return;
    }
    const canRead = await qcRepo.userHasPermission(userId, orgId, 'qc:surveys:read');
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const rows = await qcRepo.listReviewEvents(orgId, surveyId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/orgs/:orgId/surveys/:surveyId/evaluate-rules', async (req, res) => {
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
      (await qcRepo.userHasPermission(userId, orgId, 'qc:rules:manage'));
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const result = await qcRepo.evaluateSurveyRules(orgId, surveyId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('no encontrada') ? 404 : 500).json({ error: msg });
  }
});

// QC-9: evaluar + aplicar auto_rechazar / auto_observacion
router.post('/orgs/:orgId/surveys/:surveyId/apply-rules', async (req, res) => {
  try {
    const { orgId, surveyId: rawId } = req.params;
    const surveyId = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(surveyId) || !actorUserId) {
      res.status(400).json({ error: 'surveyId y actorUserId son requeridos' });
      return;
    }
    const canApply =
      (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:surveys:review')) ||
      (await qcRepo.userHasPermission(actorUserId, orgId, 'qc:rules:manage'));
    if (!canApply) {
      res.status(403).json({ error: 'Sin permiso qc:surveys:review' });
      return;
    }
    const result = await qcRepo.evaluateSurveyRules(orgId, surveyId, {
      apply: true,
      actorId: actorUserId,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('no encontrada') ? 404 : 500).json({ error: msg });
  }
});

export { router as qcSurveysRouter };
