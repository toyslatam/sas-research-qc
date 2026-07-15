import cors from 'cors';
import express from 'express';
import fs from 'fs';
import { config } from './config';
import { aiRouter } from './routes/ai';
import { adminRouter } from './routes/admin';
import { configuredReportsRouter } from './routes/configuredReports';
import { dashboardRouter } from './routes/dashboard';
import { finalAnalysisRouter } from './routes/finalAnalysis';
import { healthRouter } from './routes/health';
import { interviewsRouter } from './routes/interviews';
import { moduleProjectsRouter } from './routes/moduleProjects';
import { moduleProposalsRouter } from './routes/moduleProposals';
import { projectsRouter } from './routes/projects';
import { qcRouter } from './routes/qc';

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : []),
];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return true;
  if (/\.vercel\.app$/i.test(origin)) return true;
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({
    service: 'sas-research-api',
    status: 'ok',
    hint: 'Esta URL es el backend. Abre la app en Vercel. Health: /api/health',
    endpoints: [
      '/api/health',
      '/api/projects',
      '/api/module-projects',
      '/api/module-proposals',
      '/api/configured-reports',
      '/api/qc',
      '/api/interviews',
      '/api/dashboard',
      '/api/final-analysis',
      '/api/ai',
      '/api/admin',
    ],
  });
});

app.use('/api/health', healthRouter);
app.use('/api/ai', aiRouter);
app.use('/api/admin', adminRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/module-projects', moduleProjectsRouter);
app.use('/api/module-proposals', moduleProposalsRouter);
app.use('/api/configured-reports', configuredReportsRouter);
app.use('/api/qc', qcRouter);
app.use('/api/interviews', interviewsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/final-analysis', finalAnalysisRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(config.port, () => {
  for (const dir of [config.paths.recordings, config.paths.transcripts]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  console.log(`SAS RESEARCH API en http://localhost:${config.port}`);
  console.log(`Supabase URL: ${config.supabase.url || '⚠ no configurada'}`);
});
