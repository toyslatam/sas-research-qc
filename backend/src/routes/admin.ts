import { Router } from 'express';
import { adminRepo } from '../db/supabase-repositories';
import { config } from '../config';

export const adminRouter = Router();

adminRouter.get('/settings', async (_req, res) => {
  try {
    const settings = await adminRepo.getSettings();
    res.json({
      ...settings,
      runtime: {
        openai_configured: Boolean(config.openai.apiKey),
        openai_model_env: config.openai.gptModel,
        google_sheets_env: config.googleSheets.enabled,
        google_drive_env: process.env.GOOGLE_DRIVE_ENABLED === 'true',
        supabase_configured: Boolean(config.supabase.url && config.supabase.serviceRoleKey),
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

adminRouter.patch('/settings', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const updated = await adminRepo.updateSettings({
      openai_model: typeof body.openai_model === 'string' ? body.openai_model : undefined,
      google_sheets_enabled: typeof body.google_sheets_enabled === 'boolean' ? body.google_sheets_enabled : undefined,
      google_drive_enabled: typeof body.google_drive_enabled === 'boolean' ? body.google_drive_enabled : undefined,
      general_notes: typeof body.general_notes === 'string' ? body.general_notes : undefined,
    });
    await adminRepo.addAuditLog({
      action: 'settings_updated',
      entity: 'admin_settings',
      detail: 'Configuración general actualizada',
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

adminRouter.get('/audit-logs', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    res.json(await adminRepo.listAuditLogs(limit));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

adminRouter.get('/modules', (_req, res) => {
  res.json([
    { id: 'whispper-research', name: 'Research Intelligence', visible: true },
    { id: 'projects', name: 'Proyectos', visible: true },
    { id: 'ai', name: 'IA', visible: true },
    { id: 'proposals-v2', name: 'Propuestas', visible: true },
    { id: 'configured-reports', name: 'Informes Configurados', visible: true },
  ]);
});

adminRouter.get('/overview', async (_req, res) => {
  try {
    const [settings, logs] = await Promise.all([
      adminRepo.getSettings(),
      adminRepo.listAuditLogs(20),
    ]);
    res.json({
      settings,
      recent_logs: logs,
      roles: ['super_admin', 'admin', 'researcher', 'viewer'],
      permissions: [
        'research:read',
        'projects:read',
        'ai:read',
        'proposals:read',
        'reports:read',
        'admin:write',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
