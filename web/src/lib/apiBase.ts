/**
 * En el navegador: rutas relativas /api/* (proxy de Next.js → backend, sin CORS).
 * En servidor: URL completa del backend.
 */
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return '';
  }
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000'
  );
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
