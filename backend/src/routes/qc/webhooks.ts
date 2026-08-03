import { Router } from 'express';
import type { QcWebhookEvent } from '@whispper/shared';
import { qcRepo } from '../../db/supabase-repositories';

/** QC-9: Webhooks */
const router = Router();
const VALID_WEBHOOK_EVENTS = new Set([
  'rules.applied',
  'survey.rejected',
  'survey.observation',
  'integration.sync',
]);

router.get('/orgs/:orgId/webhooks', async (req, res) => {
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

router.post('/orgs/:orgId/webhooks', async (req, res) => {
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

router.patch('/orgs/:orgId/webhooks/:id', async (req, res) => {
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

router.delete('/orgs/:orgId/webhooks/:id', async (req, res) => {
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

router.post('/orgs/:orgId/webhooks/:id/test', async (req, res) => {
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

export { router as qcWebhooksRouter };
