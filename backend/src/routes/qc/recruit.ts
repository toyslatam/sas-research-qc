import { Router } from 'express';
import type { QcRecruitEtapa, QcRecruitImportRow } from '@whispper/shared';
import { qcRepo } from '../../db/supabase-repositories';
import { config } from '../../config';
import {
  buildGmailAuthUrl,
  exchangeGmailCode,
  getGmailMessage,
  getGoogleUserEmail,
  listGmailCandidateMessages,
  refreshGmailAccessToken,
  signGmailState,
  suggestCandidateFromMessage,
  verifyGmailState,
} from '../../services/qcRecruitGmail';

/** QC-12: Seguimiento Encuestadores (reclutamiento de campo) */
const router = Router();

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

const VALID_ETAPA = new Set<QcRecruitEtapa>([
  'nuevo',
  'contactado',
  'interesado',
  'en_activacion',
  'activo',
  'inactivo',
]);
const VALID_PRIORIDAD = new Set(['alta', 'media', 'baja']);
const VALID_FUENTE = new Set(['indeed', 'computrabajo', 'referido', 'otro']);
const VALID_PORTAL = new Set(['indeed', 'computrabajo', 'otro']);
const VALID_ESTADO_PUB = new Set(['activa', 'pausada', 'cerrada']);

async function canRead(userId: string, orgId: string): Promise<boolean> {
  return (
    (await qcRepo.userHasPermission(userId, orgId, 'qc:recruit:read')) ||
    (await qcRepo.userHasPermission(userId, orgId, 'qc:recruit:manage'))
  );
}

// ── Municipios ───────────────────────────────────────────────────────────

router.get('/orgs/:orgId/recruit/municipios', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    if (!(await canRead(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:read' });
      return;
    }
    res.json(await qcRepo.listRecruitMunicipios(orgId));
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/orgs/:orgId/recruit/municipios', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
      res.status(400).json({ error: 'nombre es requerido' });
      return;
    }
    const prioridad =
      typeof body.prioridad === 'string' && VALID_PRIORIDAD.has(body.prioridad)
        ? (body.prioridad as 'alta' | 'media' | 'baja')
        : undefined;
    const row = await qcRepo.createRecruitMunicipio(orgId, {
      nombre: body.nombre.trim(),
      departamento: typeof body.departamento === 'string' ? body.departamento : undefined,
      zona: typeof body.zona === 'string' ? body.zona : undefined,
      prioridad,
      meta: typeof body.meta === 'number' ? body.meta : undefined,
    });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.patch('/orgs/:orgId/recruit/municipios/:id', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    const updated = await qcRepo.updateRecruitMunicipio(orgId, id, {
      nombre: typeof body.nombre === 'string' ? body.nombre : undefined,
      departamento: typeof body.departamento === 'string' ? body.departamento : undefined,
      zona: typeof body.zona === 'string' ? body.zona : undefined,
      prioridad:
        typeof body.prioridad === 'string' && VALID_PRIORIDAD.has(body.prioridad)
          ? (body.prioridad as 'alta' | 'media' | 'baja')
          : undefined,
      meta: typeof body.meta === 'number' ? body.meta : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Municipio no encontrado' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.delete('/orgs/:orgId/recruit/municipios/:id', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    const ok = await qcRepo.deleteRecruitMunicipio(orgId, id);
    if (!ok) {
      res.status(404).json({ error: 'Municipio no encontrado' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// ── Candidatos ───────────────────────────────────────────────────────────

router.get('/orgs/:orgId/recruit/candidates', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    if (!(await canRead(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:read' });
      return;
    }
    const etapa =
      typeof req.query.etapa === 'string' && VALID_ETAPA.has(req.query.etapa as QcRecruitEtapa)
        ? (req.query.etapa as QcRecruitEtapa)
        : undefined;
    const municipioId =
      typeof req.query.municipioId === 'string' && req.query.municipioId
        ? parseInt(req.query.municipioId, 10)
        : undefined;
    const rows = await qcRepo.listRecruitCandidates(orgId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      etapa,
      municipioId,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/orgs/:orgId/recruit/candidates', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
      res.status(400).json({ error: 'nombre es requerido' });
      return;
    }
    if (typeof body.celular !== 'string' || !body.celular.trim()) {
      res.status(400).json({ error: 'celular es requerido' });
      return;
    }
    const fuente =
      typeof body.fuente === 'string' && VALID_FUENTE.has(body.fuente)
        ? (body.fuente as 'indeed' | 'computrabajo' | 'referido' | 'otro')
        : undefined;
    const row = await qcRepo.createRecruitCandidate(orgId, {
      nombre: body.nombre.trim(),
      celular: body.celular.trim(),
      email: typeof body.email === 'string' ? body.email.trim() : undefined,
      municipio_id: typeof body.municipio_id === 'number' ? body.municipio_id : null,
      fuente,
      notas: typeof body.notas === 'string' ? body.notas : undefined,
      actorId: actorUserId,
    });
    res.status(201).json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg.includes('Ya existe') ? 409 : 500).json({ error: msg });
  }
});

router.patch('/orgs/:orgId/recruit/candidates/:id', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    const updated = await qcRepo.updateRecruitCandidate(orgId, id, {
      nombre: typeof body.nombre === 'string' ? body.nombre : undefined,
      celular: typeof body.celular === 'string' ? body.celular : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      municipio_id:
        body.municipio_id === null
          ? null
          : typeof body.municipio_id === 'number'
            ? body.municipio_id
            : undefined,
      fuente:
        typeof body.fuente === 'string' && VALID_FUENTE.has(body.fuente)
          ? (body.fuente as 'indeed' | 'computrabajo' | 'referido' | 'otro')
          : undefined,
      notas: typeof body.notas === 'string' ? body.notas : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Candidato no encontrado' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.delete('/orgs/:orgId/recruit/candidates/:id', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    const ok = await qcRepo.deleteRecruitCandidate(orgId, id);
    if (!ok) {
      res.status(404).json({ error: 'Candidato no encontrado' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// ── Control individual: etapa + conversación de contactos ──────────────────

router.get('/orgs/:orgId/recruit/candidates/:id/contactos', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const userId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !userId) {
      res.status(400).json({ error: 'id y userId son requeridos' });
      return;
    }
    if (!(await canRead(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:read' });
      return;
    }
    res.json(await qcRepo.listRecruitContactos(orgId, id));
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/orgs/:orgId/recruit/candidates/:id/etapa', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    if (typeof body.etapa !== 'string' || !VALID_ETAPA.has(body.etapa as QcRecruitEtapa)) {
      res.status(400).json({ error: 'etapa inválida' });
      return;
    }
    const updated = await qcRepo.changeRecruitCandidateStage(orgId, id, {
      etapa: body.etapa as QcRecruitEtapa,
      comentario: typeof body.comentario === 'string' ? body.comentario : undefined,
      actorId: actorUserId,
    });
    if (!updated) {
      res.status(404).json({ error: 'Candidato no encontrado' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/orgs/:orgId/recruit/candidates/:id/contactos', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    if (typeof body.comentario !== 'string' || !body.comentario.trim()) {
      res.status(400).json({ error: 'comentario es requerido' });
      return;
    }
    const row = await qcRepo.addRecruitContactComment(orgId, id, {
      comentario: body.comentario.trim(),
      actorId: actorUserId,
    });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// ── Publicaciones ────────────────────────────────────────────────────────

router.get('/orgs/:orgId/recruit/publicaciones', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    if (!(await canRead(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:read' });
      return;
    }
    res.json(await qcRepo.listRecruitPublicaciones(orgId));
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/orgs/:orgId/recruit/publicaciones', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    if (typeof body.titulo !== 'string' || !body.titulo.trim()) {
      res.status(400).json({ error: 'titulo es requerido' });
      return;
    }
    const row = await qcRepo.createRecruitPublicacion(orgId, {
      titulo: body.titulo.trim(),
      portal:
        typeof body.portal === 'string' && VALID_PORTAL.has(body.portal)
          ? (body.portal as 'indeed' | 'computrabajo' | 'otro')
          : undefined,
      municipio_id: typeof body.municipio_id === 'number' ? body.municipio_id : null,
      fecha_publicacion: typeof body.fecha_publicacion === 'string' ? body.fecha_publicacion : null,
      vistas: typeof body.vistas === 'number' ? body.vistas : undefined,
      postulaciones: typeof body.postulaciones === 'number' ? body.postulaciones : undefined,
      estado:
        typeof body.estado === 'string' && VALID_ESTADO_PUB.has(body.estado)
          ? (body.estado as 'activa' | 'pausada' | 'cerrada')
          : undefined,
    });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.patch('/orgs/:orgId/recruit/publicaciones/:id', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    const updated = await qcRepo.updateRecruitPublicacion(orgId, id, {
      titulo: typeof body.titulo === 'string' ? body.titulo : undefined,
      portal:
        typeof body.portal === 'string' && VALID_PORTAL.has(body.portal)
          ? (body.portal as 'indeed' | 'computrabajo' | 'otro')
          : undefined,
      municipio_id:
        body.municipio_id === null
          ? null
          : typeof body.municipio_id === 'number'
            ? body.municipio_id
            : undefined,
      fecha_publicacion:
        body.fecha_publicacion === null
          ? null
          : typeof body.fecha_publicacion === 'string'
            ? body.fecha_publicacion
            : undefined,
      vistas: typeof body.vistas === 'number' ? body.vistas : undefined,
      postulaciones: typeof body.postulaciones === 'number' ? body.postulaciones : undefined,
      estado:
        typeof body.estado === 'string' && VALID_ESTADO_PUB.has(body.estado)
          ? (body.estado as 'activa' | 'pausada' | 'cerrada')
          : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: 'Publicación no encontrada' });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.delete('/orgs/:orgId/recruit/publicaciones/:id', async (req, res) => {
  try {
    const { orgId, id: rawId } = req.params;
    const id = parseInt(rawId, 10);
    const actorUserId = req.authUserId ?? '';
    if (!Number.isFinite(id) || !actorUserId) {
      res.status(400).json({ error: 'id y actorUserId son requeridos' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    const ok = await qcRepo.deleteRecruitPublicacion(orgId, id);
    if (!ok) {
      res.status(404).json({ error: 'Publicación no encontrada' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// ── Automatización: importar candidatos (CSV hoy, Gmail más adelante) ──────

router.post('/orgs/:orgId/recruit/import', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      res.status(400).json({ error: 'rows es requerido (arreglo no vacío)' });
      return;
    }
    const rows: QcRecruitImportRow[] = body.rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        nombre: typeof r.nombre === 'string' ? r.nombre : '',
        celular: typeof r.celular === 'string' ? r.celular : '',
        email: typeof r.email === 'string' ? r.email : undefined,
        municipio: typeof r.municipio === 'string' ? r.municipio : undefined,
        fuente:
          typeof r.fuente === 'string' && VALID_FUENTE.has(r.fuente)
            ? (r.fuente as 'indeed' | 'computrabajo' | 'referido' | 'otro')
            : undefined,
      }));
    const run = await qcRepo.importRecruitCandidates(orgId, rows, {
      actorId: actorUserId,
      source: body.source === 'gmail' ? 'gmail' : 'csv',
    });
    res.status(201).json(run);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/orgs/:orgId/recruit/import/runs', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    if (!(await canRead(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:read' });
      return;
    }
    res.json(await qcRepo.listRecruitImportRuns(orgId));
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// ── Gmail: conectar, previsualizar (solo lectura) e importar ──────────────

router.get('/orgs/:orgId/recruit/gmail/auth-url', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    if (!config.googleOAuth.clientId || !config.googleOAuth.clientSecret) {
      res.status(500).json({ error: 'Google OAuth no está configurado en el backend' });
      return;
    }
    const url = buildGmailAuthUrl(signGmailState(orgId, actorUserId));
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.get('/orgs/:orgId/recruit/gmail/status', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const userId = req.authUserId ?? '';
    if (!userId) {
      res.status(400).json({ error: 'userId es requerido' });
      return;
    }
    if (!(await canRead(userId, orgId))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:read' });
      return;
    }
    const conn = await qcRepo.getRecruitGmailConnection(orgId);
    res.json({ connected: !!conn, email: conn?.email ?? null });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.delete('/orgs/:orgId/recruit/gmail/connection', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    await qcRepo.deleteRecruitGmailConnection(orgId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/orgs/:orgId/recruit/gmail/preview', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    const conn = await qcRepo.getRecruitGmailConnection(orgId);
    if (!conn) {
      res.status(404).json({ error: 'No hay una cuenta de Gmail conectada' });
      return;
    }
    const { access_token } = await refreshGmailAccessToken(conn.refresh_token);
    const ids = await listGmailCandidateMessages(access_token, 20);
    const messages = await Promise.all(
      ids.map(async (id) => {
        const msg = await getGmailMessage(access_token, id);
        return {
          id: msg.id,
          from: msg.from,
          subject: msg.subject,
          date: msg.date,
          snippet: msg.snippet,
          cvUrl: msg.cvUrl,
          suggested: suggestCandidateFromMessage(msg),
        };
      }),
    );
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

router.post('/orgs/:orgId/recruit/gmail/import', async (req, res) => {
  try {
    const orgId = req.params.orgId;
    const body = req.body as Record<string, unknown>;
    const actorUserId = req.authUserId ?? '';
    if (!actorUserId) {
      res.status(400).json({ error: 'actorUserId es requerido' });
      return;
    }
    if (!(await qcRepo.userHasPermission(actorUserId, orgId, 'qc:recruit:manage'))) {
      res.status(403).json({ error: 'Sin permiso qc:recruit:manage' });
      return;
    }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      res.status(400).json({ error: 'rows es requerido (arreglo no vacío)' });
      return;
    }
    const rows: QcRecruitImportRow[] = body.rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .map((r) => ({
        nombre: typeof r.nombre === 'string' ? r.nombre : '',
        celular: typeof r.celular === 'string' ? r.celular : '',
        email: typeof r.email === 'string' ? r.email : undefined,
        municipio: typeof r.municipio === 'string' ? r.municipio : undefined,
        fuente:
          typeof r.fuente === 'string' && VALID_FUENTE.has(r.fuente)
            ? (r.fuente as 'indeed' | 'computrabajo' | 'referido' | 'otro')
            : undefined,
      }));
    const run = await qcRepo.importRecruitCandidates(orgId, rows, {
      actorId: actorUserId,
      source: 'gmail',
    });
    res.status(201).json(run);
  } catch (err) {
    res.status(500).json({ error: errMsg(err) });
  }
});

// Callback de Google: sin JWT (Google redirige el navegador directo), por eso
// se exporta aparte y se monta en index.ts ANTES del middleware requireQcAuth.
const gmailCallbackRouter = Router();

gmailCallbackRouter.get('/callback', async (req, res) => {
  const redirectBase = `${config.webAppUrl}/m/qc/encuestadores`;
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
    if (oauthError) {
      res.redirect(`${redirectBase}?tab=importar&gmail=error&reason=${encodeURIComponent(oauthError)}`);
      return;
    }
    const parsed = verifyGmailState(state);
    if (!parsed || !code) {
      res.redirect(`${redirectBase}?tab=importar&gmail=error&reason=invalid_state`);
      return;
    }
    const tokens = await exchangeGmailCode(code);
    if (!tokens.refresh_token) {
      res.redirect(`${redirectBase}?tab=importar&gmail=error&reason=no_refresh_token`);
      return;
    }
    const email = await getGoogleUserEmail(tokens.access_token);
    await qcRepo.saveRecruitGmailConnection(parsed.orgId, {
      email,
      refreshToken: tokens.refresh_token,
      connectedBy: parsed.userId,
    });
    res.redirect(`${redirectBase}?tab=importar&gmail=connected`);
  } catch (err) {
    res.redirect(`${redirectBase}?tab=importar&gmail=error&reason=${encodeURIComponent(errMsg(err))}`);
  }
});

export { router as qcRecruitRouter, gmailCallbackRouter as qcRecruitGmailCallbackRouter };
