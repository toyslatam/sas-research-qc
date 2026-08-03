import { Router } from 'express';
import { qcRepo } from '../../db/supabase-repositories';

/** QC-4: Reglas */
const router = Router();
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

router.get('/orgs/:orgId/rules', async (req, res) => {
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

router.post('/orgs/:orgId/rules', async (req, res) => {
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

router.post('/orgs/:orgId/rules/seed-defaults', async (req, res) => {
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

router.patch('/orgs/:orgId/rules/:ruleId', async (req, res) => {
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

router.delete('/orgs/:orgId/rules/:ruleId', async (req, res) => {
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

export { router as qcRulesRouter };
