import { Router } from 'express';
import { qcRepo } from '../../db/supabase-repositories';

/** QC-11: Reportes / export CSV-JSON */
const router = Router();
async function canReadQcReports(userId: string, orgId: string): Promise<boolean> {
  return (
    (await qcRepo.userHasPermission(userId, orgId, 'qc:reports:read')) ||
    (await qcRepo.userHasPermission(userId, orgId, 'qc:projects:read')) ||
    (await qcRepo.userHasPermission(userId, orgId, 'qc:surveys:read'))
  );
}

router.get('/orgs/:orgId/reports/summary', async (req, res) => {
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

router.get('/orgs/:orgId/reports/export.csv', async (req, res) => {
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

router.get('/orgs/:orgId/reports/export.json', async (req, res) => {
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

router.get('/orgs/:orgId/reports/exports', async (req, res) => {
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

export { router as qcReportsRouter };
