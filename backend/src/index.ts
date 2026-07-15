import cors from 'cors';
import express from 'express';
import { config } from './config';
import { healthRouter } from './routes/health';
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

// Raíz informativa — esta app es solo API (la web va en Vercel)
app.get('/', (_req, res) => {
  res.json({
    service: 'sas-research-qc-api',
    status: 'ok',
    hint: 'Esta URL es el backend. Abre la app en Vercel. Health: /api/health',
    endpoints: ['/api/health', '/api/qc'],
  });
});

app.use('/api/health', healthRouter);
app.use('/api/qc', qcRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(config.port, () => {
  console.log(`SAS RESEARCH QC API en http://localhost:${config.port}`);
  console.log(`Supabase URL: ${config.supabase.url || '⚠ no configurada'}`);
});
