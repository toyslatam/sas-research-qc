import { apiUrl } from './apiBase';
import { createClient } from './supabase/client';

/**
 * Cliente del módulo "Verificación de Voz" (/api/voice). Aislado del api.ts
 * grande a propósito. Adjunta el JWT de Supabase; el backend deriva de él la
 * identidad y el rol dentro de la organización.
 */

export interface VoiceOrg {
  id: string;
  name: string;
  created_at: string;
  role: 'admin' | 'encuestador';
}

export interface VoiceRecording {
  id: number;
  org_id: string;
  surveyor_id: string | null;
  interview_id: string;
  storage_path: string | null;
  audio_format: string | null;
  duration_seconds: number | null;
  status: 'uploaded' | 'processing' | 'embedded' | 'failed';
  disposition: 'pending' | 'approved' | 'duplicate' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string;
  created_at: string;
  embedding_status?: string;
}

export interface VoiceMatch {
  embedding_id: number | null;
  person_id: string | null;
  recording_id: string | null;
  similarity_score: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  rank: number;
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = await authHeader();
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      cache: 'no-store',
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), ...auth },
    });
  } catch {
    throw new Error('No se pudo conectar con el backend.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export function listVoiceOrgs(): Promise<VoiceOrg[]> {
  return req('/api/voice/orgs');
}

export function createVoiceOrg(name: string): Promise<VoiceOrg> {
  return req('/api/voice/orgs', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ name }) });
}

export interface VoiceMember {
  id: number;
  user_id: string;
  role: 'admin' | 'encuestador';
  email: string | null;
  created_at: string;
}

export function listVoiceMembers(orgId: string): Promise<VoiceMember[]> {
  return req(`/api/voice/orgs/${orgId}/members`);
}

export function addVoiceMemberByEmail(
  orgId: string,
  email: string,
  role: 'admin' | 'encuestador',
): Promise<VoiceMember> {
  return req(`/api/voice/orgs/${orgId}/members`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, role }),
  });
}

export function removeVoiceMember(orgId: string, memberUserId: string): Promise<void> {
  return req(`/api/voice/orgs/${orgId}/members/${memberUserId}`, { method: 'DELETE' });
}

export function listVoiceRecordings(orgId: string): Promise<VoiceRecording[]> {
  return req(`/api/voice/orgs/${orgId}/recordings`);
}

export async function createVoiceRecording(
  orgId: string,
  opts: { interviewId: string; file: Blob; filename: string },
): Promise<VoiceRecording & { embedding_status: string }> {
  const form = new FormData();
  form.append('interview_id', opts.interviewId);
  form.append('file', opts.file, opts.filename);
  // Nota: NO fijar Content-Type; el navegador pone el boundary del multipart.
  return req(`/api/voice/orgs/${orgId}/recordings`, { method: 'POST', body: form });
}

export function getVoiceMatches(
  orgId: string,
  recordingId: number,
  topK = 10,
): Promise<{ recording_id: string; matches: VoiceMatch[] }> {
  return req(`/api/voice/orgs/${orgId}/recordings/${recordingId}/matches?top_k=${topK}`);
}

export function reviewVoiceRecording(
  orgId: string,
  recordingId: number,
  disposition: VoiceRecording['disposition'],
  notes = '',
): Promise<VoiceRecording> {
  return req(`/api/voice/orgs/${orgId}/recordings/${recordingId}/review`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ disposition, notes }),
  });
}
