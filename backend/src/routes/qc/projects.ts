import { Router } from 'express';
import { qcRepo } from '../../db/supabase-repositories';

/** QC-2: Proyectos */
const router = Router();
const VALID_QC_STATUS = new Set(['borrador', 'activo', 'en_pausa', 'cerrado']);

router.get('/orgs/:orgId/projects', async (req, res) => {
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

router.post('/orgs/:orgId/projects', async (req, res) => {
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

router.patch('/orgs/:orgId/projects/:projectId', async (req, res) => {
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

router.delete('/orgs/:orgId/projects/:projectId', async (req, res) => {
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

export { router as qcProjectsRouter };
