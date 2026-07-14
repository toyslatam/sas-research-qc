import { qcModule } from '@/modules/qc/config';
import type { ModuleConfig, ResolvedModule } from '@/platform/types/module';

/**
 * Registry SAS RESEARCH QC — solo Control de Calidad.
 * (App separada de Whispper; mismo Supabase si se comparte proyecto.)
 */
export const moduleRegistry: ModuleConfig[] = [qcModule];

export function getModuleById(id: string): ModuleConfig | undefined {
  return moduleRegistry.find((m) => m.id === id);
}

export function getModuleByPath(pathname: string): ModuleConfig | undefined {
  return moduleRegistry.find(
    (m) => pathname === m.basePath || pathname.startsWith(`${m.basePath}/`),
  );
}

export function getModuleEntryHref(module: ModuleConfig): string {
  if (module.defaultPath) {
    return `${module.basePath}/${module.defaultPath}`;
  }
  return module.basePath;
}

export function resolveModules(): ResolvedModule[] {
  return moduleRegistry.map((module) => ({
    ...module,
    href: getModuleEntryHref(module),
    enabled: module.status === 'active',
  }));
}

export function isPlatformRoute(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/m/')) return true;
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/profile')) return true;
  if (pathname.startsWith('/login')) return false;
  if (pathname.startsWith('/forgot-password')) return false;
  if (pathname.startsWith('/reset-password')) return false;
  return false;
}

export function isAuthRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/auth/callback')
  );
}
