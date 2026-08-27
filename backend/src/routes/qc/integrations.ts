import { Router } from 'express';
import { qcRepo } from '../../db/supabase-repositories';

/** QC-6/8: Integraciones (Sheets/Zoho) + sync */
const router = Router();
const VALID_PROVIDER = new Set(['google_sheets', 'zoho']);
const VALID_INT_STATUS = new Set(['inactive', 'active', 'error']);

router.get('/orgs/:orgId/integrations', async (req, res) => {
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

router.post('/orgs/:orgId/integrations', async (req, res) => {
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

router.patch('/orgs/:orgId/integrations/:id', async (req, res) => {
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

router.delete('/orgs/:orgId/integrations/:id', async (req, res) => {
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

router.get('/orgs/:orgId/integrations/:id/runs', async (req, res) => {
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

router.post('/orgs/:orgId/integrations/:id/sync', async (req, res) => {
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

export { router as qcIntegrationsRouter };
