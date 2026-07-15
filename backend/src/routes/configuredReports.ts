import { Router } from 'express';
import type { ConfiguredReportStatus, ReportStep } from '@whispper/shared';
import { adminRepo, configuredReportRepo } from '../db/supabase-repositories';
import {
  executeConfiguredReport,
  listRegisteredProcesses,
} from '../services/reportEngine';

const VALID_STATUS: ConfiguredReportStatus[] = ['activo', 'pausado', 'archivado'];

export const configuredReportsRouter = Router();

configuredReportsRouter.get('/processes', (_req, res) => {
  res.json(listRegisteredProcesses());
});

configuredReportsRouter.get('/', async (_req, res) => {
  try {
    res.json(await configuredReportRepo.list());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

configuredReportsRouter.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await configuredReportRepo.getById(id);
    if (!row) {
      res.status(404).json({ error: 'Informe no encontrado' });
      return;
    }
    const runs = await configuredReportRepo.listRuns(id);
    res.json({ ...row, runs });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

configuredReportsRouter.post('/', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    if (!body.name || typeof body.name !== 'string') {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }
    if (body.status && !VALID_STATUS.includes(body.status as ConfiguredReportStatus)) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }

    const created = await configuredReportRepo.create({
      name: body.name,
      description: typeof body.description === 'string' ? body.description : '',
      status: body.status as ConfiguredReportStatus | undefined,
      source_spreadsheet_id: typeof body.source_spreadsheet_id === 'string' ? body.source_spreadsheet_id : '',
      source_sheet: typeof body.source_sheet === 'string' ? body.source_sheet : '',
      configuration: (body.configuration as Record<string, unknown>) ?? {},
      steps: Array.isArray(body.steps) ? (body.steps as ReportStep[]) : [],
      process_key: typeof body.process_key === 'string' ? body.process_key : 'generic',
      responsible: typeof body.responsible === 'string' ? body.responsible : '',
    });

    await adminRepo.addAuditLog({
      action: 'report_created',
      entity: 'configured_reports',
      detail: `Informe #${created.id}: ${created.name}`,
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

configuredReportsRouter.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const body = req.body as Record<string, unknown>;
    if (body.status && !VALID_STATUS.includes(body.status as ConfiguredReportStatus)) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }

    const updated = await configuredReportRepo.update(id, {
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      status: body.status as ConfiguredReportStatus | undefined,
      source_spreadsheet_id: typeof body.source_spreadsheet_id === 'string' ? body.source_spreadsheet_id : undefined,
      source_sheet: typeof body.source_sheet === 'string' ? body.source_sheet : undefined,
      configuration: body.configuration as Record<string, unknown> | undefined,
      steps: Array.isArray(body.steps) ? (body.steps as ReportStep[]) : undefined,
      process_key: typeof body.process_key === 'string' ? body.process_key : undefined,
      responsible: typeof body.responsible === 'string' ? body.responsible : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: 'Informe no encontrado' });
      return;
    }

    await adminRepo.addAuditLog({
      action: 'report_updated',
      entity: 'configured_reports',
      detail: `Informe #${id} actualizado`,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

configuredReportsRouter.post('/:id/run', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const body = (req.body ?? {}) as {
      markProcessed?: boolean;
      dateFrom?: string;
      dateTo?: string;
    };
    const markProcessed = Boolean(body.markProcessed);
    const dateFrom = typeof body.dateFrom === 'string' ? body.dateFrom.trim() : undefined;
    const dateTo = typeof body.dateTo === 'string' ? body.dateTo.trim() : undefined;

    const report = await configuredReportRepo.getById(id);
    if (!report) {
      res.status(404).json({ error: 'Informe no encontrado' });
      return;
    }

    await configuredReportRepo.update(id, {
      last_run_status: 'running',
      last_run_at: new Date().toISOString(),
    });

    const result = await executeConfiguredReport(report, {
      markProcessed,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });

    const run = await configuredReportRepo.createRun({
      report_id: id,
      status: 'success',
      processed: result.processed,
      not_found: result.not_found,
      duplicates: result.duplicates,
      errors: result.errors,
      duration_ms: result.duration_ms,
      result_payload: result as unknown as Record<string, unknown>,
      marked_processed: result.marked_processed,
    });

    await configuredReportRepo.update(id, {
      last_run_status: 'success',
      last_run_at: new Date().toISOString(),
    });

    await adminRepo.addAuditLog({
      action: 'report_run',
      entity: 'configured_reports',
      detail: `Informe #${id} ejecutado (${result.processed} procesados)${
        dateFrom || dateTo ? ` fechas ${dateFrom || '…'}→${dateTo || '…'}` : ''
      }`,
    });

    res.json({ run, result });
  } catch (err) {
    const id = parseInt(req.params.id, 10);
    await configuredReportRepo.update(id, {
      last_run_status: 'error',
      last_run_at: new Date().toISOString(),
    }).catch(() => undefined);
    res.status(500).json({ error: String(err) });
  }
});

configuredReportsRouter.get('/:id/runs', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    res.json(await configuredReportRepo.listRuns(id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

configuredReportsRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = await configuredReportRepo.delete(id);
    if (!ok) {
      res.status(404).json({ error: 'Informe no encontrado' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
