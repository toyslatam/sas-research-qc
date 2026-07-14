import { Router } from 'express';
import type { ManagedProjectStatus } from '@whispper/shared';
import { managedProjectRepo } from '../db/supabase-repositories';

const VALID_STATUS: ManagedProjectStatus[] = ['borrador', 'activo', 'en_pausa', 'cerrado'];

export const moduleProjectsRouter = Router();

moduleProjectsRouter.get('/', async (req, res) => {
  try {
    const {
      search,
      status,
      client,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string | undefined>;

    if (status && !VALID_STATUS.includes(status as ManagedProjectStatus)) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }

    const rows = await managedProjectRepo.list({
      search,
      status: status as ManagedProjectStatus | undefined,
      client,
      dateFrom,
      dateTo,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProjectsRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      client,
      status,
      start_date,
      participants,
      files_count,
      audios_count,
      proposals_count,
      analysis_count,
    } = req.body as Record<string, unknown>;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name es requerido' });
      return;
    }
    if (status && (typeof status !== 'string' || !VALID_STATUS.includes(status as ManagedProjectStatus))) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }

    const row = await managedProjectRepo.create({
      name,
      description: typeof description === 'string' ? description : '',
      client: typeof client === 'string' ? client : '',
      status: status as ManagedProjectStatus | undefined,
      start_date: typeof start_date === 'string' ? start_date : null,
      participants: Array.isArray(participants)
        ? participants.filter((p): p is string => typeof p === 'string').map((p) => p.trim()).filter(Boolean)
        : [],
      files_count: typeof files_count === 'number' ? files_count : 0,
      audios_count: typeof audios_count === 'number' ? audios_count : 0,
      proposals_count: typeof proposals_count === 'number' ? proposals_count : 0,
      analysis_count: typeof analysis_count === 'number' ? analysis_count : 0,
    });

    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProjectsRouter.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }

    const payload = req.body as Record<string, unknown>;

    if (payload.status && (typeof payload.status !== 'string' || !VALID_STATUS.includes(payload.status as ManagedProjectStatus))) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }

    const updated = await managedProjectRepo.update(id, {
      name: typeof payload.name === 'string' ? payload.name : undefined,
      description: typeof payload.description === 'string' ? payload.description : undefined,
      client: typeof payload.client === 'string' ? payload.client : undefined,
      status: payload.status as ManagedProjectStatus | undefined,
      start_date:
        payload.start_date === null
          ? null
          : typeof payload.start_date === 'string'
            ? payload.start_date
            : undefined,
      participants: Array.isArray(payload.participants)
        ? payload.participants.filter((p): p is string => typeof p === 'string').map((p) => p.trim()).filter(Boolean)
        : undefined,
      files_count: typeof payload.files_count === 'number' ? payload.files_count : undefined,
      audios_count: typeof payload.audios_count === 'number' ? payload.audios_count : undefined,
      proposals_count: typeof payload.proposals_count === 'number' ? payload.proposals_count : undefined,
      analysis_count: typeof payload.analysis_count === 'number' ? payload.analysis_count : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProjectsRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    const ok = await managedProjectRepo.delete(id);
    if (!ok) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

