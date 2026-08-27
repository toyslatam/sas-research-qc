import path from 'path';
import fs from 'fs';
import { chromium, type BrowserContext } from 'playwright';

/**
 * Contexto de navegador persistente.
 *
 * La sesión NO se renueva automáticamente: el login lo hace el usuario a mano
 * la primera vez (y cuando caduque). El perfil queda en disco, así que las
 * corridas siguientes abren ya autenticadas sin volver a pedir credenciales.
 * Este es el mecanismo que hace viable lo desatendido — automatizar el login
 * sería justo lo que dispara verificaciones.
 */

/** Un perfil por plataforma; nunca se mezclan sesiones. */
export type Platform = 'indeed' | 'computrabajo';

const ROOT = path.resolve(__dirname, '../..');

export function profileDir(platform: Platform): string {
  return path.join(ROOT, '.sessions', platform);
}

export function reportsDir(): string {
  return path.join(ROOT, 'reports');
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export interface OpenOptions {
  /** Visible por defecto: es más estable y permite que el usuario intervenga. */
  headless?: boolean;
}

export async function openPersistentContext(
  platform: Platform,
  opts: OpenOptions = {},
): Promise<BrowserContext> {
  const dir = profileDir(platform);
  ensureDir(dir);
  const existed = fs.existsSync(path.join(dir, 'Default'));

  const context = await chromium.launchPersistentContext(dir, {
    headless: opts.headless ?? false,
    viewport: { width: 1440, height: 900 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    args: ['--start-maximized'],
  });

  console.log(
    existed
      ? `→ Perfil existente de ${platform}: debería abrir ya autenticado.`
      : `→ Perfil nuevo de ${platform}: vas a tener que iniciar sesión a mano.`,
  );
  return context;
}

/** Pausa hasta que el usuario confirme; devuelve lo que haya escrito antes del ENTER. */
export function waitForEnter(mensaje: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(`\n${mensaje}\n> `);
    process.stdin.resume();
    process.stdin.once('data', (chunk: Buffer) => {
      process.stdin.pause();
      resolve(chunk.toString('utf8').trim().toLowerCase());
    });
  });
}
