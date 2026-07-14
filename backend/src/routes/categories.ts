import { Router } from 'express';
import { categoryRepo, projectRepo } from '../db/supabase-repositories';

export const categoriesRouter = Router({ mergeParams: true });

categoriesRouter.get('/', async (req, res) => {
  try {
    const projectId = parseInt((req.params as Record<string, string>).projectId, 10);
    if (!(await projectRepo.getById(projectId))) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }
    res.json(await categoryRepo.listByProject(projectId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

categoriesRouter.post('/', async (req, res) => {
  try {
    const projectId = parseInt((req.params as Record<string, string>).projectId, 10);
    if (!(await projectRepo.getById(projectId))) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const { name, description, sort_order } = req.body as {
      name?: string;
      description?: string;
      sort_order?: number;
    };
    if (!name?.trim()) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }

    const existing = await categoryRepo.listByProject(projectId);
    const order = sort_order ?? existing.length + 1;
    const cat = await categoryRepo.create(projectId, name.trim(), description?.trim() ?? '', order);
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

categoriesRouter.put('/:categoryId', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    if (!(await categoryRepo.getById(categoryId))) {
      res.status(404).json({ error: 'Categoría no encontrada' });
      return;
    }

    const { name, description, sort_order } = req.body as {
      name?: string;
      description?: string;
      sort_order?: number;
    };
    if (name !== undefined && !name.trim()) {
      res.status(400).json({ error: 'name no puede estar vacío' });
      return;
    }

    const updated = await categoryRepo.update(categoryId, {
      name: name?.trim(),
      description,
      sort_order,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

categoriesRouter.delete('/:categoryId', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    if (!(await categoryRepo.getById(categoryId))) {
      res.status(404).json({ error: 'Categoría no encontrada' });
      return;
    }
    const result = await categoryRepo.delete(categoryId);
    if (!result.ok) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
