import { Router } from 'express';
import { qcRepo } from '../../db/supabase-repositories';

/** QC-2: Clientes */
const router = Router();
router.get('/orgs/:orgId/clients', async (req, res) => {
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

router.post('/orgs/:orgId/clients', async (req, res) => {
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

router.patch('/orgs/:orgId/clients/:clientId', async (req, res) => {
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

router.delete('/orgs/:orgId/clients/:clientId', async (req, res) => {
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

export { router as qcClientsRouter };
