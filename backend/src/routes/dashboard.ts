import { Router } from 'express';
import {
  getDashboardStats,
  getInterviewResponsesMatrix,
  getWordCloud,
} from '../services/dashboardService';

export const dashboardRouter = Router();

function parseFilters(query: Record<string, unknown>) {
  const mt = query.moduleType ? String(query.moduleType) : undefined;
  return {
    projectId:  query.projectId ? parseInt(String(query.projectId), 10) : undefined,
    dateFrom:   query.dateFrom  ? String(query.dateFrom)  : undefined,
    dateTo:     query.dateTo    ? String(query.dateTo)    : undefined,
    segment:    query.segment   ? String(query.segment)   : undefined,
    moduleType: (mt === 'propuesta' || mt === 'exploratorio') ? (mt as 'propuesta' | 'exploratorio') : undefined,
  };
}

dashboardRouter.get('/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats(parseFilters(req.query as Record<string, unknown>));
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

dashboardRouter.get('/wordcloud', async (req, res) => {
  try {
    const words = await getWordCloud(parseFilters(req.query as Record<string, unknown>));
    res.json(words);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

dashboardRouter.get('/responses-matrix', async (req, res) => {
  try {
    const matrix = await getInterviewResponsesMatrix(
      parseFilters(req.query as Record<string, unknown>)
    );
    res.json(matrix);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
