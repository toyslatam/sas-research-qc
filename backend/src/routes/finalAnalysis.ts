import { Router } from 'express';
import {
  generateFinalAnalysisDraft,
  getFinalAnalysis,
  updateFinalAnalysisHeader,
  updateFinalAnalysisItem,
} from '../services/finalAnalysisService';

export const finalAnalysisRouter = Router();

finalAnalysisRouter.get('/', async (req, res) => {
  try {
    const projectId = parseInt(String(req.query.projectId), 10);
    const providerSlug = String(req.query.providerSlug ?? '');
    if (!projectId || !providerSlug) {
      res.status(400).json({ error: 'projectId y providerSlug requeridos' });
      return;
    }
    const data = await getFinalAnalysis(projectId, providerSlug);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

finalAnalysisRouter.post('/generate', async (req, res) => {
  try {
    const projectId = parseInt(String(req.body.projectId), 10);
    const providerName = String(req.body.providerName ?? '').trim();
    if (!projectId || !providerName) {
      res.status(400).json({ error: 'projectId y providerName requeridos' });
      return;
    }
    const data = await generateFinalAnalysisDraft(projectId, providerName);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

finalAnalysisRouter.patch('/items/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(String(req.params.itemId), 10);
    const data = await updateFinalAnalysisItem(itemId, req.body ?? {});
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

finalAnalysisRouter.patch('/:analysisId', async (req, res) => {
  try {
    const analysisId = parseInt(String(req.params.analysisId), 10);
    await updateFinalAnalysisHeader(analysisId, req.body ?? {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
