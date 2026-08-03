import { Router } from 'express';
import { qcRepo } from '../../db/supabase-repositories';

/** QC-0/1: Roles, permisos, organizaciones, miembros, auditoría y dashboard */
const router = Router();
router.get('/roles', async (_req, res) => {
  try {
    const rows = await qcRepo.listRoles();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/permissions', async (_req, res) => {
  try {
    const rows = await qcRepo.listPermissions();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get('/orgs', async (req, res) => {
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

router.post('/orgs', async (req, res) => {
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

router.patch('/orgs/:orgId', async (req, res) => {
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

router.get('/orgs/:orgId/members', async (req, res) => {
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

router.post('/orgs/:orgId/members', async (req, res) => {
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

router.patch('/orgs/:orgId/members/:memberId', async (req, res) => {
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

// ── QC-5: Auditoría ────────────────────────────────────────────────────────

router.get('/orgs/:orgId/audit-logs', async (req, res) => {
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

// ── QC-7: Dashboard ────────────────────────────────────────────────────────

router.get('/orgs/:orgId/dashboard', async (req, res) => {
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

export { router as qcOrgsRouter };
