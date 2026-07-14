/** Clave localStorage para la organización QC activa (tenant). */
export const QC_ACTIVE_ORG_KEY = 'qc.activeOrgId';

export function getStoredQcOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(QC_ACTIVE_ORG_KEY);
}

export function setStoredQcOrgId(orgId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(QC_ACTIVE_ORG_KEY, orgId);
}
