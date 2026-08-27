/** Organización activa del módulo Voz, recordada por navegador (localStorage). */
const KEY = 'voice.activeOrgId';

export function getStoredVoiceOrgId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoredVoiceOrgId(orgId: string): void {
  try {
    localStorage.setItem(KEY, orgId);
  } catch {
    /* almacenamiento no disponible: se sigue sin recordar */
  }
}
