import { Router } from 'express';
import multer from 'multer';
import type { QcWebhookEvent } from '@whispper/shared';
import { qcRepo } from '../db/supabase-repositories';

export const qcRouter = Router();

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

qcRouter.get('/roles', async (_req, res) => {
  try {
    const rows = await qcRepo.listRoles();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.get('/permissions', async (_req, res) => {
  try {
    const rows = await qcRepo.listPermissions();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.get('/orgs', async (req, res) => {
  try {
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const rows = await qcRepo.listOrgsForUser(userId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.post('/orgs', async (req, res) => {
  try {
    const { name, slug, legal_name } = req.body as Record<string, unknown>;
    const userId = req.authUserId ?? '';
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const org = await qcRepo.createOrgWithAdmin({
      name: name.trim(),
      slug: typeof slug === 'string' ? slug.trim() : undefined,
      legal_name: typeof legal_name === 'string' ? legal_name.trim() : '',
      userId,
    });
    res.status(201).json(org);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.patch('/orgs/:orgId', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const { name, legal_name, status } = req.body as Record<string, unknown>;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(userId, orgId, 'qc:org:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:org:manage' });
      return;
    }
    const updated = await qcRepo.updateOrg(orgId, {
      name: typeof name === 'string' ? name : undefined,
      legal_name: typeof legal_name === 'string' ? legal_name : undefined,
      status: typeof status === 'string' ? (status as 'active' | 'suspended' | 'trial') : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Organización no encontrada' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.get('/orgs/:orgId/members', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const isMember = await qcRepo.isOrgMember(userId, orgId);
    if (!isMember) {
      res.status(403).json({ error: 'No perteneces a esta organización' });
      return;
    }
    const rows = await qcRepo.listMembers(orgId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.post('/orgs/:orgId/members', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const { email, role_key } = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    if (typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'email es requerido' });
      return;
    }
    if (typeof role_key !== 'string' || !role_key) {
      res.status(400).json({ error: 'role_key es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:members:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:members:manage' });
      return;
    }
    const member = await qcRepo.addMemberByEmail(orgId, email.trim(), role_key);
    res.status(201).json(member);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('no encontrado') ? 404 : 500).json({ error: msg });
  }
});

qcRouter.patch('/orgs/:orgId/members/:memberId', async (req, res) => {
  try {
    const { orgId, memberId: memberIdRaw } = req.params;
    const memberId = parseInt(memberIdRaw, 10);
    const { role_key, status } = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(memberId)) {
      res.status(400).json({ error: 'memberId inválido' });
      return;
    }
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:members:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:members:manage' });
      return;
    }
    const updated = await qcRepo.updateMember(orgId, memberId, {
      role_key: typeof role_key === 'string' ? role_key : undefined,
      status:
        typeof status === 'string'
          ? (status as 'active' | 'invited' | 'suspended')
          : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Miembro no encontrado' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── QC-2: Clientes ─────────────────────────────────────────────────────────

qcRouter.get('/orgs/:orgId/clients', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const canRead = await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read');
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso qc:projects:read' });
      return;
    }
    const rows = await qcRepo.listClients(orgId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.post('/orgs/:orgId/clients', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:projects:write');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:projects:write' });
      return;
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }
    const row = await qcRepo.createClient(orgId, {
      name: body.name.trim(),
      code: typeof body.code === 'string' ? body.code.trim() : '',
      status: body.status === 'inactive' ? 'inactive' : 'active',
      contact_name: typeof body.contact_name === 'string' ? body.contact_name : '',
      contact_email: typeof body.contact_email === 'string' ? body.contact_email : '',
      notes: typeof body.notes === 'string' ? body.notes : '',
    });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.patch('/orgs/:orgId/clients/:clientId', async (req, res) => {
  try {
    const { orgId, clientId: rawId } = req.params;
    const clientId = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(clientId)) {
      res.status(400).json({ error: 'clientId inválido' });
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
    const updated = await qcRepo.updateClient(orgId, clientId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      code: typeof body.code === 'string' ? body.code : undefined,
      status:
        body.status === 'active' || body.status === 'inactive' ? body.status : undefined,
      contact_name: typeof body.contact_name === 'string' ? body.contact_name : undefined,
      contact_email: typeof body.contact_email === 'string' ? body.contact_email : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.delete('/orgs/:orgId/clients/:clientId', async (req, res) => {
  try {
    const { orgId, clientId: rawId } = req.params;
    const clientId = parseInt(rawId, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(clientId)) {
      res.status(400).json({ error: 'clientId inválido' });
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
    const ok = await qcRepo.deleteClient(orgId, clientId);
    if (!ok) {
      res.status(404).json({ error: 'Cliente no encontrado' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── QC-2: Proyectos ────────────────────────────────────────────────────────

const VALID_QC_STATUS = new Set(['borrador', 'activo', 'en_pausa', 'cerrado']);

qcRouter.get('/orgs/:orgId/projects', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const canRead = await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read');
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso qc:projects:read' });
      return;
    }
    const clientIdRaw =
      typeof req.query.clientId === 'string' ? parseInt(req.query.clientId, 10) : NaN;
    const rows = await qcRepo.listProjects(orgId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      clientId: Number.isFinite(clientIdRaw) ? clientIdRaw : undefined,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.post('/orgs/:orgId/projects', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:projects:write');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:projects:write' });
      return;
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }
    if (body.status && (typeof body.status !== 'string' || !VALID_QC_STATUS.has(body.status))) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }
    const row = await qcRepo.createProject(orgId, {
      name: body.name.trim(),
      code: typeof body.code === 'string' ? body.code.trim() : '',
      description: typeof body.description === 'string' ? body.description : '',
      status:
        typeof body.status === 'string'
          ? (body.status as 'borrador' | 'activo' | 'en_pausa' | 'cerrado')
          : undefined,
      client_id:
        body.client_id === null
          ? null
          : typeof body.client_id === 'number'
            ? body.client_id
            : typeof body.client_id === 'string' && body.client_id
              ? parseInt(body.client_id, 10)
              : null,
      country: typeof body.country === 'string' ? body.country : '',
      methodology: typeof body.methodology === 'string' ? body.methodology : '',
      start_date: typeof body.start_date === 'string' ? body.start_date : null,
      end_date: typeof body.end_date === 'string' ? body.end_date : null,
    });
    res.status(201).json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('Cliente') ? 400 : 500).json({ error: msg });
  }
});

qcRouter.patch('/orgs/:orgId/projects/:projectId', async (req, res) => {
  try {
    const { orgId, projectId: rawId } = req.params;
    const projectId = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(projectId)) {
      res.status(400).json({ error: 'projectId inválido' });
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
    if (body.status && (typeof body.status !== 'string' || !VALID_QC_STATUS.has(body.status))) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }
    const updated = await qcRepo.updateProject(orgId, projectId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      code: typeof body.code === 'string' ? body.code : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      status:
        typeof body.status === 'string'
          ? (body.status as 'borrador' | 'activo' | 'en_pausa' | 'cerrado')
          : undefined,
      client_id:
        body.client_id === null
          ? null
          : typeof body.client_id === 'number'
            ? body.client_id
            : typeof body.client_id === 'string' && body.client_id
              ? parseInt(body.client_id, 10)
              : undefined,
      country: typeof body.country === 'string' ? body.country : undefined,
      methodology: typeof body.methodology === 'string' ? body.methodology : undefined,
      start_date:
        body.start_date === null
          ? null
          : typeof body.start_date === 'string'
            ? body.start_date
            : undefined,
      end_date:
        body.end_date === null
          ? null
          : typeof body.end_date === 'string'
            ? body.end_date
            : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('Cliente') ? 400 : 500).json({ error: msg });
  }
});

qcRouter.delete('/orgs/:orgId/projects/:projectId', async (req, res) => {
  try {
    const { orgId, projectId: rawId } = req.params;
    const projectId = parseInt(rawId, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(projectId)) {
      res.status(400).json({ error: 'projectId inválido' });
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
    const ok = await qcRepo.deleteProject(orgId, projectId);
    if (!ok) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── QC-3: Encuestas ────────────────────────────────────────────────────────

const VALID_SURVEY_STATUS = new Set([
  'pendiente',
  'en_revision',
  'aprobada',
  'rechazada',
  'en_auditoria',
]);
const VALID_STAGE = new Set(['ubicacion', 'contenido', 'telefono']);
const VALID_REVIEW_STATUS = new Set(['aprobada', 'rechazada', 'observacion']);

qcRouter.get('/orgs/:orgId/surveys', async (req, res) => {
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

qcRouter.post('/orgs/:orgId/surveys', async (req, res) => {
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

qcRouter.get('/orgs/:orgId/surveys/:surveyId', async (req, res) => {
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

qcRouter.patch('/orgs/:orgId/surveys/:surveyId', async (req, res) => {
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

qcRouter.delete('/orgs/:orgId/surveys/:surveyId', async (req, res) => {
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

qcRouter.post('/orgs/:orgId/surveys/:surveyId/reviews/:stageType', async (req, res) => {
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

qcRouter.get('/orgs/:orgId/surveys/:surveyId/events', async (req, res) => {
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

// ── QC-4: Reglas ───────────────────────────────────────────────────────────

const VALID_RULE_STAGE = new Set(['any', 'ubicacion', 'contenido', 'telefono']);
const VALID_RULE_OP = new Set([
  'required',
  'is_empty',
  'is_not_empty',
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'regex',
  'gt',
  'gte',
  'lt',
  'lte',
  'coords_present',
]);
const VALID_SEVERITY = new Set(['info', 'warning', 'error', 'block']);
const VALID_ACTION = new Set(['flag', 'auto_observacion', 'auto_rechazar']);

qcRouter.get('/orgs/:orgId/rules', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const canRead =
      (await qcRepo.userHasPermission(userId, orgId, 'qc:rules:manage')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:surveys:read')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read'));
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }

    let projectId: number | null | undefined;
    if (req.query.projectId === 'null' || req.query.scope === 'global') {
      projectId = null;
    } else if (typeof req.query.projectId === 'string' && req.query.projectId) {
      const n = parseInt(req.query.projectId, 10);
      projectId = Number.isFinite(n) ? n : undefined;
    }

    const rows = await qcRepo.listRules(orgId, { projectId });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.post('/orgs/:orgId/rules', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:rules:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:rules:manage' });
      return;
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }
    if (typeof body.field_key !== 'string' || !body.field_key.trim()) {
      res.status(400).json({ error: 'field_key es requerido' });
      return;
    }
    if (typeof body.operator !== 'string' || !VALID_RULE_OP.has(body.operator)) {
      res.status(400).json({ error: 'operator inválido' });
      return;
    }
    if (body.stage_type && (typeof body.stage_type !== 'string' || !VALID_RULE_STAGE.has(body.stage_type))) {
      res.status(400).json({ error: 'stage_type inválido' });
      return;
    }
    if (body.severity && (typeof body.severity !== 'string' || !VALID_SEVERITY.has(body.severity))) {
      res.status(400).json({ error: 'severity inválida' });
      return;
    }
    if (body.action && (typeof body.action !== 'string' || !VALID_ACTION.has(body.action))) {
      res.status(400).json({ error: 'action inválida' });
      return;
    }

    const row = await qcRepo.createRule(orgId, {
      name: body.name.trim(),
      description: typeof body.description === 'string' ? body.description : '',
      project_id:
        body.project_id === null
          ? null
          : typeof body.project_id === 'number'
            ? body.project_id
            : typeof body.project_id === 'string' && body.project_id
              ? parseInt(body.project_id, 10)
              : null,
      stage_type:
        typeof body.stage_type === 'string'
          ? (body.stage_type as 'any' | 'ubicacion' | 'contenido' | 'telefono')
          : 'any',
      field_key: body.field_key.trim(),
      operator: body.operator as
        | 'required'
        | 'is_empty'
        | 'is_not_empty'
        | 'equals'
        | 'not_equals'
        | 'contains'
        | 'not_contains'
        | 'regex'
        | 'gt'
        | 'gte'
        | 'lt'
        | 'lte'
        | 'coords_present',
      value_text: typeof body.value_text === 'string' ? body.value_text : '',
      severity:
        typeof body.severity === 'string'
          ? (body.severity as 'info' | 'warning' | 'error' | 'block')
          : 'warning',
      action:
        typeof body.action === 'string'
          ? (body.action as 'flag' | 'auto_observacion' | 'auto_rechazar')
          : 'flag',
      enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
    });
    res.status(201).json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('Proyecto') ? 400 : 500).json({ error: msg });
  }
});

qcRouter.post('/orgs/:orgId/rules/seed-defaults', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:rules:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:rules:manage' });
      return;
    }
    const projectId =
      body.project_id === null
        ? null
        : typeof body.project_id === 'number'
          ? body.project_id
          : typeof body.project_id === 'string' && body.project_id
            ? parseInt(body.project_id, 10)
            : null;
    const rows = await qcRepo.seedDefaultRules(orgId, projectId);
    res.status(201).json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.patch('/orgs/:orgId/rules/:ruleId', async (req, res) => {
  try {
    const { orgId, ruleId: rawId } = req.params;
    const ruleId = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(ruleId)) {
      res.status(400).json({ error: 'ruleId inválido' });
      return;
    }
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:rules:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:rules:manage' });
      return;
    }
    if (body.operator && (typeof body.operator !== 'string' || !VALID_RULE_OP.has(body.operator))) {
      res.status(400).json({ error: 'operator inválido' });
      return;
    }
    if (body.stage_type && (typeof body.stage_type !== 'string' || !VALID_RULE_STAGE.has(body.stage_type))) {
      res.status(400).json({ error: 'stage_type inválido' });
      return;
    }
    if (body.severity && (typeof body.severity !== 'string' || !VALID_SEVERITY.has(body.severity))) {
      res.status(400).json({ error: 'severity inválida' });
      return;
    }
    if (body.action && (typeof body.action !== 'string' || !VALID_ACTION.has(body.action))) {
      res.status(400).json({ error: 'action inválida' });
      return;
    }

    const updated = await qcRepo.updateRule(orgId, ruleId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      project_id:
        body.project_id === null
          ? null
          : typeof body.project_id === 'number'
            ? body.project_id
            : typeof body.project_id === 'string' && body.project_id
              ? parseInt(body.project_id, 10)
              : undefined,
      stage_type:
        typeof body.stage_type === 'string'
          ? (body.stage_type as 'any' | 'ubicacion' | 'contenido' | 'telefono')
          : undefined,
      field_key: typeof body.field_key === 'string' ? body.field_key : undefined,
      operator:
        typeof body.operator === 'string'
          ? (body.operator as
              | 'required'
              | 'is_empty'
              | 'is_not_empty'
              | 'equals'
              | 'not_equals'
              | 'contains'
              | 'not_contains'
              | 'regex'
              | 'gt'
              | 'gte'
              | 'lt'
              | 'lte'
              | 'coords_present')
          : undefined,
      value_text: typeof body.value_text === 'string' ? body.value_text : undefined,
      severity:
        typeof body.severity === 'string'
          ? (body.severity as 'info' | 'warning' | 'error' | 'block')
          : undefined,
      action:
        typeof body.action === 'string'
          ? (body.action as 'flag' | 'auto_observacion' | 'auto_rechazar')
          : undefined,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      sort_order: typeof body.sort_order === 'number' ? body.sort_order : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Regla no encontrada' });
      return;
    }
    res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('Proyecto') ? 400 : 500).json({ error: msg });
  }
});

qcRouter.delete('/orgs/:orgId/rules/:ruleId', async (req, res) => {
  try {
    const { orgId, ruleId: rawId } = req.params;
    const ruleId = parseInt(rawId, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(ruleId) || !actorUserId) {
      res.status(400).json({ error: 'ruleId y actorUserId son requeridos' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:rules:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:rules:manage' });
      return;
    }
    const ok = await qcRepo.deleteRule(orgId, ruleId);
    if (!ok) {
      res.status(404).json({ error: 'Regla no encontrada' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.get('/orgs/:orgId/surveys/:surveyId/evaluate-rules', async (req, res) => {
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
qcRouter.post('/orgs/:orgId/surveys/:surveyId/apply-rules', async (req, res) => {
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

// ── QC-5: Evidencias ───────────────────────────────────────────────────────

const VALID_EVIDENCE_TYPE = new Set(['photo', 'audio', 'document', 'link', 'note']);
const VALID_EVIDENCE_STAGE = new Set(['ubicacion', 'contenido', 'telefono']);

qcRouter.get('/orgs/:orgId/surveys/:surveyId/evidences', async (req, res) => {
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

qcRouter.post('/orgs/:orgId/surveys/:surveyId/evidences', async (req, res) => {
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
qcRouter.post(
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

qcRouter.delete('/orgs/:orgId/evidences/:evidenceId', async (req, res) => {
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

// ── QC-5: Auditoría ────────────────────────────────────────────────────────

qcRouter.get('/orgs/:orgId/audit-logs', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const canRead =
      (await qcRepo.userHasPermission(userId, orgId, 'qc:audit:read')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:org:manage'));
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso qc:audit:read' });
      return;
    }
    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;
    const surveyIdRaw =
      typeof req.query.surveyId === 'string' ? parseInt(req.query.surveyId, 10) : NaN;
    const rows = await qcRepo.listAuditLogs(orgId, {
      limit: Number.isFinite(limitRaw) ? Math.min(limitRaw, 500) : 100,
      surveyId: Number.isFinite(surveyIdRaw) ? surveyIdRaw : undefined,
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── QC-6: Integraciones ────────────────────────────────────────────────────

const VALID_PROVIDER = new Set(['google_sheets', 'zoho']);
const VALID_INT_STATUS = new Set(['inactive', 'active', 'error']);

qcRouter.get('/orgs/:orgId/integrations', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const canRead =
      (await qcRepo.userHasPermission(userId, orgId, 'qc:integrations:manage')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read'));
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const rows = await qcRepo.listIntegrations(orgId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.post('/orgs/:orgId/integrations', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:integrations:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:integrations:manage' });
      return;
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }
    if (typeof body.provider !== 'string' || !VALID_PROVIDER.has(body.provider)) {
      res.status(400).json({ error: 'provider inválido' });
      return;
    }
    const row = await qcRepo.createIntegration(orgId, {
      name: body.name.trim(),
      provider: body.provider as 'google_sheets' | 'zoho',
      project_id:
        body.project_id === null
          ? null
          : typeof body.project_id === 'number'
            ? body.project_id
            : typeof body.project_id === 'string' && body.project_id
              ? parseInt(body.project_id, 10)
              : null,
      status:
        typeof body.status === 'string' && VALID_INT_STATUS.has(body.status)
          ? (body.status as 'inactive' | 'active' | 'error')
          : 'inactive',
      config:
        body.config && typeof body.config === 'object' && !Array.isArray(body.config)
          ? (body.config as Record<string, unknown>)
          : {},
      actorId: actorUserId,
    });
    res.status(201).json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('Proyecto') ? 400 : 500).json({ error: msg });
  }
});

qcRouter.patch('/orgs/:orgId/integrations/:id', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:integrations:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:integrations:manage' });
      return;
    }
    if (body.status && (typeof body.status !== 'string' || !VALID_INT_STATUS.has(body.status))) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }
    const updated = await qcRepo.updateIntegration(
      orgId,
      id,
      {
        name: typeof body.name === 'string' ? body.name : undefined,
        project_id:
          body.project_id === null
            ? null
            : typeof body.project_id === 'number'
              ? body.project_id
              : typeof body.project_id === 'string' && body.project_id
                ? parseInt(body.project_id, 10)
                : undefined,
        status:
          typeof body.status === 'string'
            ? (body.status as 'inactive' | 'active' | 'error')
            : undefined,
        config:
          body.config && typeof body.config === 'object' && !Array.isArray(body.config)
            ? (body.config as Record<string, unknown>)
            : undefined,
      },
      actorUserId,
    );
    if (!updated) {
      res.status(404).json({ error: 'Integración no encontrada' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.delete('/orgs/:orgId/integrations/:id', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:integrations:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const ok = await qcRepo.deleteIntegration(orgId, id, actorUserId);
    if (!ok) {
      res.status(404).json({ error: 'Integración no encontrada' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.get('/orgs/:orgId/integrations/:id/runs', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const userId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !userId) {
      res.status(400).json({ error: 'id y userId son requeridos' });
      return;
    }
    const canRead = await qcRepo.userHasPermission(userId, orgId, 'qc:integrations:manage');
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const rows = await qcRepo.listIntegrationRuns(orgId, id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.post('/orgs/:orgId/integrations/:id/sync', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    const allowed = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:integrations:manage');
    if (!allowed) {
      res.status(403).json({ error: 'Sin permiso qc:integrations:manage' });
      return;
    }
    const result = await qcRepo.syncIntegration(orgId, id, actorUserId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('no encontrada') ? 404 : 500).json({ error: msg });
  }
});

// ── QC-7: Dashboard ────────────────────────────────────────────────────────

qcRouter.get('/orgs/:orgId/dashboard', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const canRead =
      (await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:surveys:read')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:reports:read'));
    if (!canRead) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const stats = await qcRepo.getDashboard(orgId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── QC-9: Webhooks ─────────────────────────────────────────────────────────

const VALID_WEBHOOK_EVENTS = new Set([
  'rules.applied',
  'survey.rejected',
  'survey.observation',
  'integration.sync',
]);

qcRouter.get('/orgs/:orgId/webhooks', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    const can =
      (await qcRepo.userHasPermission(userId, orgId, 'qc:integrations:manage')) ||
      (await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read'));
    if (!can) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    res.json(await qcRepo.listWebhooks(orgId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.post('/orgs/:orgId/webhooks', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    const can = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:integrations:manage');
    if (!can) {
      res.status(403).json({ error: 'Sin permiso qc:integrations:manage' });
      return;
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!name || !url) {
      res.status(400).json({ error: 'name y url son requeridos' });
      return;
    }
    let events: string[] | undefined;
    if (Array.isArray(body.events)) {
      events = body.events.filter(
        (e): e is string => typeof e === 'string' && VALID_WEBHOOK_EVENTS.has(e),
      );
    }
    const row = await qcRepo.createWebhook(
      orgId,
      {
        name,
        url,
        secret: typeof body.secret === 'string' ? body.secret : '',
        events: events as QcWebhookEvent[] | undefined,
        enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
      },
      actorUserId,
    );
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.patch('/orgs/:orgId/webhooks/:id', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const id = parseInt(req.params.id, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    const can = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:integrations:manage');
    if (!can) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    let events: QcWebhookEvent[] | undefined;
    if (Array.isArray(body.events)) {
      events = body.events.filter(
        (e): e is QcWebhookEvent => typeof e === 'string' && VALID_WEBHOOK_EVENTS.has(e),
      );
    }
    const updated = await qcRepo.updateWebhook(
      orgId,
      id,
      {
        name: typeof body.name === 'string' ? body.name : undefined,
        url: typeof body.url === 'string' ? body.url : undefined,
        secret: typeof body.secret === 'string' ? body.secret : undefined,
        events,
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      },
      actorUserId,
    );
    if (!updated) {
      res.status(404).json({ error: 'Webhook no encontrado' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.delete('/orgs/:orgId/webhooks/:id', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const id = parseInt(req.params.id, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    const can = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:integrations:manage');
    if (!can) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const ok = await qcRepo.deleteWebhook(orgId, id, actorUserId);
    if (!ok) {
      res.status(404).json({ error: 'Webhook no encontrado' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.post('/orgs/:orgId/webhooks/:id/test', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const id = parseInt(req.params.id, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    const can = await qcRepo.userHasPermission(actorUserId, orgId, 'qc:integrations:manage');
    if (!can) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const hooks = await qcRepo.listWebhooks(orgId);
    const hook = hooks.find((h) => h.id === id);
    if (!hook) {
      res.status(404).json({ error: 'Webhook no encontrado' });
      return;
    }
    await qcRepo.dispatchWebhooks(orgId, hook.events[0] ?? 'rules.applied', {
      test: true,
      webhook_id: id,
      message: 'Ping de prueba SAS RESEARCH QC',
    });
    const refreshed = (await qcRepo.listWebhooks(orgId)).find((h) => h.id === id);
    res.json(refreshed ?? hook);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── QC-11: Reportes / export ───────────────────────────────────────────────

async function canReadQcReports(userId: string, orgId: string): Promise<boolean> {
  return (
    (await qcRepo.userHasPermission(userId, orgId, 'qc:reports:read')) ||
    (await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read')) ||
    (await qcRepo.userHasPermission(userId, orgId, 'qc:surveys:read'))
  );
}

qcRouter.get('/orgs/:orgId/reports/summary', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    if (!(await canReadQcReports(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const projectId =
      typeof req.query.projectId === 'string' && req.query.projectId
        ? parseInt(req.query.projectId, 10)
        : undefined;
    const status =
      typeof req.query.status === 'string' && req.query.status
        ? req.query.status
        : undefined;
    const summary = await qcRepo.buildReport(orgId, {
      projectId: Number.isFinite(projectId) ? projectId : undefined,
      status,
    });
    await qcRepo.logReportExport(orgId, {
      actorId: userId,
      format: 'summary',
      filters: summary.filters,
      rowCount: summary.rows.length,
    });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.get('/orgs/:orgId/reports/export.csv', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    if (!(await canReadQcReports(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const projectId =
      typeof req.query.projectId === 'string' && req.query.projectId
        ? parseInt(req.query.projectId, 10)
        : undefined;
    const status =
      typeof req.query.status === 'string' && req.query.status
        ? req.query.status
        : undefined;
    const summary = await qcRepo.buildReport(orgId, {
      projectId: Number.isFinite(projectId) ? projectId : undefined,
      status,
    });
    await qcRepo.logReportExport(orgId, {
      actorId: userId,
      format: 'csv',
      filters: summary.filters,
      rowCount: summary.rows.length,
    });
    const csv = qcRepo.reportToCsv(summary);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qc-report-${orgId.slice(0, 8)}.csv"`,
    );
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.get('/orgs/:orgId/reports/export.json', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    if (!(await canReadQcReports(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    const projectId =
      typeof req.query.projectId === 'string' && req.query.projectId
        ? parseInt(req.query.projectId, 10)
        : undefined;
    const status =
      typeof req.query.status === 'string' && req.query.status
        ? req.query.status
        : undefined;
    const summary = await qcRepo.buildReport(orgId, {
      projectId: Number.isFinite(projectId) ? projectId : undefined,
      status,
    });
    await qcRepo.logReportExport(orgId, {
      actorId: userId,
      format: 'json',
      filters: summary.filters,
      rowCount: summary.rows.length,
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qc-report-${orgId.slice(0, 8)}.json"`,
    );
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

qcRouter.get('/orgs/:orgId/reports/exports', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    if (!(await canReadQcReports(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso' });
      return;
    }
    res.json(await qcRepo.listReportExports(orgId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
