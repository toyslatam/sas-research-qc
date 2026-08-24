import { Router } from 'express';
import { qcOrgsRouter } from './orgs';
import { qcClientsRouter } from './clients';
import { qcProjectsRouter } from './projects';
import { qcSurveysRouter } from './surveys';
import { qcRulesRouter } from './rules';
import { qcEvidencesRouter } from './evidences';
import { qcIntegrationsRouter } from './integrations';
import { qcWebhooksRouter } from './webhooks';
import { qcReportsRouter } from './reports';
import { qcRecruitRouter } from './recruit';

/**
 * Router raíz de QC. Ensambla los sub-routers por dominio.
 * La autenticación (JWT Supabase) se aplica al montar en index.ts:
 *   app.use('/api/qc', requireQcAuth, qcRouter)
 */
export const qcRouter = Router();

qcRouter.use(qcOrgsRouter);
qcRouter.use(qcClientsRouter);
qcRouter.use(qcProjectsRouter);
qcRouter.use(qcSurveysRouter);
qcRouter.use(qcRulesRouter);
qcRouter.use(qcEvidencesRouter);
qcRouter.use(qcIntegrationsRouter);
qcRouter.use(qcWebhooksRouter);
qcRouter.use(qcReportsRouter);
qcRouter.use(qcRecruitRouter);
