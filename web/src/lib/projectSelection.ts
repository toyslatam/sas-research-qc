export const PROJECT_STORAGE_KEY = 'whispper:selectedProjectId';

export function getStoredProjectId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

export function setStoredProjectId(id: number | null): void {
  if (typeof window === 'undefined') return;
  if (id == null) localStorage.removeItem(PROJECT_STORAGE_KEY);
  else localStorage.setItem(PROJECT_STORAGE_KEY, String(id));
}

export function pickDefaultProjectId(
  projects: { id: number }[],
  preferred?: number | null,
): number | null {
  if (preferred != null && projects.some((p) => p.id === preferred)) return preferred;
  const stored = getStoredProjectId();
  if (stored != null && projects.some((p) => p.id === stored)) return stored;
  if (projects.length === 1) return projects[0].id;
  return null;
}
