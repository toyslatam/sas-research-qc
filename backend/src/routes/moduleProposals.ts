import { Router } from 'express';
import type { ModuleProposalStatus } from '@whispper/shared';
import { managedProjectRepo, moduleProposalRepo } from '../db/supabase-repositories';
import { googleDriveService } from '../services/googleDriveService';

const VALID_STATUS: ModuleProposalStatus[] = [
  'borrador',
  'enviada',
  'en_revision',
  'aprobada',
  'rechazada',
];

export const moduleProposalsRouter = Router();

moduleProposalsRouter.get('/', async (req, res) => {
  try {
    const managedProjectId = req.query.managedProjectId
      ? parseInt(String(req.query.managedProjectId), 10)
      : undefined;
    res.json(await moduleProposalRepo.list(managedProjectId));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.get('/shared/:token', async (req, res) => {
  try {
    const all = await moduleProposalRepo.list();
    const found = all.find((p) => p.share_token === req.params.token);
    if (!found) {
      res.status(404).json({ error: 'Enlace no válido' });
      return;
    }
    const full = await moduleProposalRepo.getById(found.id);
    res.json(full);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: 'id inválido' });
      return;
    }
    const row = await moduleProposalRepo.getById(id);
    if (!row) {
      res.status(404).json({ error: 'Propuesta no encontrada' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.post('/', async (req, res) => {
  try {
    const {
      managed_project_id,
      title,
      client,
      status,
      file_name,
      file_content,
      notes,
    } = req.body as Record<string, unknown>;

    const projectId = Number(managed_project_id);
    if (!Number.isFinite(projectId)) {
      res.status(400).json({ error: 'managed_project_id es requerido' });
      return;
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title es requerido' });
      return;
    }
    if (!(await managedProjectRepo.getById(projectId))) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }
    if (status && !VALID_STATUS.includes(status as ModuleProposalStatus)) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }

    const created = await moduleProposalRepo.create({
      managed_project_id: projectId,
      title,
      client: typeof client === 'string' ? client : '',
      status: status as ModuleProposalStatus | undefined,
      file_name: typeof file_name === 'string' ? file_name : '',
      file_content: typeof file_content === 'string' ? file_content : '',
      notes: typeof notes === 'string' ? notes : '',
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.post('/:id/versions', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const payload = req.body as Record<string, unknown>;
    if (payload.status && !VALID_STATUS.includes(payload.status as ModuleProposalStatus)) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }
    const updated = await moduleProposalRepo.addVersion(id, {
      status: payload.status as ModuleProposalStatus | undefined,
      client: typeof payload.client === 'string' ? payload.client : undefined,
      file_name: typeof payload.file_name === 'string' ? payload.file_name : undefined,
      file_content: typeof payload.file_content === 'string' ? payload.file_content : undefined,
      notes: typeof payload.notes === 'string' ? payload.notes : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Propuesta no encontrada' });
      return;
    }
    res.status(201).json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.patch('/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: ModuleProposalStatus };
    if (!status || !VALID_STATUS.includes(status)) {
      res.status(400).json({ error: 'status inválido' });
      return;
    }
    const updated = await moduleProposalRepo.updateStatus(id, status);
    if (!updated) {
      res.status(404).json({ error: 'Propuesta no encontrada' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.get('/:id/compare', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const a = parseInt(String(req.query.a ?? '1'), 10);
    const b = parseInt(String(req.query.b ?? '0'), 10);
    const proposal = await moduleProposalRepo.getById(id);
    if (!proposal) {
      res.status(404).json({ error: 'Propuesta no encontrada' });
      return;
    }
    const versions = proposal.versions ?? [];
    const va = versions.find((v) => v.version === a);
    const vb = versions.find((v) => v.version === (b || proposal.current_version));
    if (!va || !vb) {
      res.status(400).json({ error: 'Versiones no encontradas' });
      return;
    }
    res.json({
      proposal_id: id,
      version_a: va,
      version_b: vb,
      content_equal: va.file_content === vb.file_content,
      diff_summary: {
        a_length: va.file_content.length,
        b_length: vb.file_content.length,
        a_status: va.status,
        b_status: vb.status,
        a_notes: va.notes,
        b_notes: vb.notes,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.get('/:id/export-pdf', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const proposal = await moduleProposalRepo.getById(id);
    if (!proposal) {
      res.status(404).json({ error: 'Propuesta no encontrada' });
      return;
    }
    const latest = (proposal.versions ?? []).find((v) => v.version === proposal.current_version);
    const lines = [
      `Propuesta: ${proposal.title}`,
      `Cliente: ${proposal.client}`,
      `Estado: ${proposal.status}`,
      `Versión: v${proposal.current_version}`,
      '',
      'Contenido:',
      latest?.file_content || '(sin contenido)',
      '',
      'Notas:',
      latest?.notes || '(sin notas)',
    ];
    // PDF simple (texto) — compatible sin dependencias nuevas
    const body = lines.join('\n');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="propuesta-${id}-v${proposal.current_version}.pdf"`);
    res.send(Buffer.from(
      `%PDF-1.1\n1 0 obj<<>>endobj\n2 0 obj<< /Length ${body.length + 50} >>stream\nBT /F1 10 Tf 40 750 Td (${body.replace(/[()\\]/g, ' ')}) Tj ET\nendstream\nendobj\ntrailer<< /Root 1 0 R >>\n%%EOF`,
      'utf-8',
    ));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.post('/:id/share', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const proposal = await moduleProposalRepo.getById(id);
    if (!proposal) {
      res.status(404).json({ error: 'Propuesta no encontrada' });
      return;
    }
    const token = proposal.share_token || `p-${id}`;
    const shareUrl = `${req.protocol}://${req.get('host')}/api/module-proposals/shared/${token}`;
    res.json({ share_token: token, share_url: shareUrl });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.post('/:id/drive', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const proposal = await moduleProposalRepo.getById(id);
    if (!proposal) {
      res.status(404).json({ error: 'Propuesta no encontrada' });
      return;
    }
    const latest = (proposal.versions ?? []).find((v) => v.version === proposal.current_version);
    const result = await googleDriveService.uploadTextFile(
      `${proposal.title}-v${proposal.current_version}.txt`,
      latest?.file_content || '',
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Google Drive no configurado' });
      return;
    }
    await moduleProposalRepo.setDriveFileId(id, result.fileId!);
    res.json({ drive_file_id: result.fileId, web_view_link: result.webViewLink });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

moduleProposalsRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = await moduleProposalRepo.delete(id);
    if (!ok) {
      res.status(404).json({ error: 'Propuesta no encontrada' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
