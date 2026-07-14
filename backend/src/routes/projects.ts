import { Router } from 'express';
import { categoryRepo, projectRepo, questionRepo } from '../db/supabase-repositories';
import { parseSubItems } from '../utils/subItems';
import { categoriesRouter } from './categories';

export const projectsRouter = Router();

projectsRouter.use('/:projectId/categories', categoriesRouter);

projectsRouter.get('/', async (_req, res) => {
  try {
    res.json(await projectRepo.list());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

projectsRouter.post('/', async (req, res) => {
  try {
    const { name, client } = req.body as { name?: string; client?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }
    const project = await projectRepo.create(name.trim(), client?.trim() ?? '');
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

projectsRouter.get('/:id/questions', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!(await projectRepo.getById(id))) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }
    res.json(await questionRepo.listByProject(id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

projectsRouter.post('/:id/questions', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (!(await projectRepo.getById(projectId))) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const { text, category_id, sort_order, sub_items } = req.body as {
      text?: string;
      category_id?: number;
      sort_order?: number;
      sub_items?: string[] | string;
    };

    if (!text?.trim()) {
      res.status(400).json({ error: 'text es requerido' });
      return;
    }
    if (!category_id) {
      res.status(400).json({ error: 'category_id es requerido — elija una categoría' });
      return;
    }

    const cat = await categoryRepo.getById(category_id);
    if (!cat || cat.project_id !== projectId) {
      res.status(400).json({ error: 'Categoría no válida para este proyecto' });
      return;
    }

    const questions = await questionRepo.listByProject(projectId);
    const order = sort_order ?? questions.length + 1;

    const q = await questionRepo.create(
      projectId,
      text.trim(),
      order,
      category_id,
      parseSubItems(sub_items)
    );
    res.status(201).json(q);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

projectsRouter.patch('/:id/questions/:questionId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const questionId = parseInt(req.params.questionId, 10);

    if (!(await projectRepo.getById(projectId))) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const { text, category_id, sub_items } = req.body as {
      text?: string;
      category_id?: number;
      sub_items?: string[] | string;
    };

    if (text === undefined && category_id === undefined && sub_items === undefined) {
      res.status(400).json({ error: 'Envíe text, category_id y/o sub_items' });
      return;
    }

    const updated = await questionRepo.update(questionId, projectId, {
      text,
      category_id,
      sub_items: sub_items !== undefined ? parseSubItems(sub_items) : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Pregunta o categoría no válida' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

projectsRouter.delete('/:id/questions/:questionId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const questionId = parseInt(req.params.questionId, 10);

    if (!(await projectRepo.getById(projectId))) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }
    if (!(await questionRepo.delete(questionId, projectId))) {
      res.status(404).json({ error: 'Pregunta no encontrada' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
