import type { NextFunction, Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';

/**
 * Autenticación para /api/qc.
 *
 * Antes, cada handler confiaba en `userId`/`actorUserId` recibidos del cliente
 * (query o body) y el backend opera con service-role (sin RLS), por lo que
 * cualquiera podía suplantar a otro usuario. Este middleware exige un JWT de
 * Supabase válido, lo verifica contra el Auth server y expone el id REAL del
 * usuario en `req.authUserId`. Los handlers deben usar SIEMPRE ese valor como
 * identidad del que llama, nunca lo que venga en el body/query.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Id de usuario verificado a partir del JWT de Supabase. */
      authUserId?: string;
    }
  }
}

function extractToken(req: Request): string {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match) return match[1].trim();
  }
  return '';
}

export async function requireQcAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'No autenticado: falta el token de sesión' });
      return;
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      res.status(401).json({ error: 'Sesión inválida o expirada' });
      return;
    }

    req.authUserId = data.user.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'No autenticado' });
  }
}
