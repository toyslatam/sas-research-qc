import type {
  AiMeetingAnalysis,
  Category,
  ConfiguredReport,
  ConfiguredReportRun,
  DashboardStats,
  InterviewResponsesMatrix,
  ManagedProject,
  ManagedProjectStatus,
  MeetingStage,
  ModuleProposal,
  ModuleProposalStatus,
  Project,
  ProviderFinalAnalysis,
  QcClient,
  QcOrgMembership,
  QcOrganization,
  QcPermission,
  QcProject,
  QcReviewStageType,
  QcRole,
  QcRule,
  QcRuleEvaluation,
  QcSurvey,
  QcAuditLog,
  QcEvidence,
  QcDashboardStats,
  QcIntegration,
  QcIntegrationRun,
  QcWebhook,
  QcWebhookEvent,
  QcReportExportLog,
  QcReportSummary,
  QcRecruitCandidate,
  QcRecruitContacto,
  QcRecruitEtapa,
  QcRecruitImportRow,
  QcRecruitImportRun,
  QcRecruitMunicipio,
  QcRecruitPublicacion,
  Question,
  ReportStep,
} from '@whispper/shared';
import { apiUrl } from './apiBase';
import { createClient } from './supabase/client';

/**
 * Cabecera Authorization con el JWT de la sesión Supabase.
 * El backend (/api/qc) verifica este token y deriva de él la identidad del
 * usuario; ya no se confía en `userId`/`actorUserId` enviados por el cliente.
 * Si no hay sesión (o estamos en SSR), devuelve {} y la petición va sin token.
 */
async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** fetch con token de sesión adjunto y `no-store` por defecto. */
async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const auth = await authHeader();
  return fetch(url, {
    cache: 'no-store',
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...auth },
  });
}

async function fetchJson<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(apiUrl(path));
  } catch {
    throw new Error('No se pudo conectar con el backend. Verifica que `npm run dev:backend` esté activo.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

type ModuleType = 'propuesta' | 'exploratorio';

interface DashboardParams {
  projectId?: number;
  dateFrom?: string;
  dateTo?: string;
  segment?: string;
  moduleType?: ModuleType;
}

function dashboardQuery(params: DashboardParams): string {
  const q = new URLSearchParams();
  if (params.projectId)  q.set('projectId',  String(params.projectId));
  if (params.dateFrom)   q.set('dateFrom',   params.dateFrom);
  if (params.dateTo)     q.set('dateTo',     params.dateTo);
  if (params.segment)    q.set('segment',    params.segment);
  if (params.moduleType) q.set('moduleType', params.moduleType);
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export function getProjects(): Promise<Project[]> {
  return fetchJson('/api/projects');
}

export function getQuestions(projectId: number): Promise<Question[]> {
  return fetchJson(`/api/projects/${projectId}/questions`);
}

export function getCategories(projectId: number): Promise<Category[]> {
  return fetchJson(`/api/projects/${projectId}/categories`);
}

export function getDashboardStats(params: DashboardParams): Promise<DashboardStats> {
  return fetchJson(`/api/dashboard/stats${dashboardQuery(params)}`);
}

export function getWordCloud(params: { projectId?: number; moduleType?: ModuleType }): Promise<{ text: string; value: number }[]> {
  const q = new URLSearchParams();
  if (params.projectId)  q.set('projectId',  String(params.projectId));
  if (params.moduleType) q.set('moduleType', params.moduleType);
  const qs = q.toString();
  return fetchJson(`/api/dashboard/wordcloud${qs ? `?${qs}` : ''}`);
}

export function getInterviewResponsesMatrix(params: DashboardParams): Promise<InterviewResponsesMatrix> {
  return fetchJson(`/api/dashboard/responses-matrix${dashboardQuery(params)}`);
}

interface ManagedProjectFilters {
  search?: string;
  status?: ManagedProjectStatus;
  client?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function listManagedProjects(filters: ManagedProjectFilters): Promise<ManagedProject[]> {
  const q = new URLSearchParams();
  if (filters.search?.trim()) q.set('search', filters.search.trim());
  if (filters.status) q.set('status', filters.status);
  if (filters.client?.trim()) q.set('client', filters.client.trim());
  if (filters.dateFrom) q.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) q.set('dateTo', filters.dateTo);
  const qs = q.toString();
  return fetchJson(`/api/module-projects${qs ? `?${qs}` : ''}`);
}

export async function createManagedProject(payload: {
  name: string;
  description?: string;
  client?: string;
  status?: ManagedProjectStatus;
  start_date?: string | null;
  participants?: string[];
  files_count?: number;
  audios_count?: number;
  proposals_count?: number;
  analysis_count?: number;
}): Promise<ManagedProject> {
  const res = await apiFetch(apiUrl('/api/module-projects'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<ManagedProject>;
}

export async function updateManagedProject(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    client: string;
    status: ManagedProjectStatus;
    start_date: string | null;
    participants: string[];
    files_count: number;
    audios_count: number;
    proposals_count: number;
    analysis_count: number;
  }>,
): Promise<ManagedProject> {
  const res = await apiFetch(apiUrl(`/api/module-projects/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<ManagedProject>;
}

export async function deleteManagedProject(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/api/module-projects/${id}`), {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export function listAiAnalyses(managedProjectId?: number): Promise<AiMeetingAnalysis[]> {
  const q = new URLSearchParams();
  if (managedProjectId) q.set('managedProjectId', String(managedProjectId));
  const qs = q.toString();
  return fetchJson(`/api/ai/analyses${qs ? `?${qs}` : ''}`);
}

export async function analyzeMeetingAudio(payload: {
  managedProjectId: number;
  meetingTitle: string;
  targetLanguage: string;
  audioFile: File;
}): Promise<AiMeetingAnalysis> {
  const form = new FormData();
  form.append('managedProjectId', String(payload.managedProjectId));
  form.append('meetingTitle', payload.meetingTitle);
  form.append('targetLanguage', payload.targetLanguage);
  form.append('audio', payload.audioFile);

  let res: Response;
  try {
    res = await apiFetch(apiUrl('/api/ai/analyze-audio'), {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new Error('No se pudo conectar con el backend. Verifica que `npm run dev:backend` esté activo.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<AiMeetingAnalysis>;
}

export function getFinalAnalysis(
  projectId: number,
  providerSlug: string,
): Promise<ProviderFinalAnalysis | null> {
  const q = new URLSearchParams({
    projectId: String(projectId),
    providerSlug,
  });
  return fetchJson(`/api/final-analysis?${q}`);
}

export async function generateFinalAnalysisDraft(
  projectId: number,
  providerName: string,
): Promise<ProviderFinalAnalysis> {
  const res = await apiFetch(apiUrl('/api/final-analysis/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, providerName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<ProviderFinalAnalysis>;
}

export async function updateInterviewParticipant(
  interviewId: number,
  participantName: string
): Promise<void> {
  await updateInterviewFields(interviewId, { participantName });
}

export async function updateInterviewFields(
  interviewId: number,
  fields: { participantName?: string; contact?: string; interviewDate?: string; meetingStage?: MeetingStage | null }
): Promise<void> {
  const res = await apiFetch(apiUrl(`/api/interviews/${interviewId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ── Fase 7: Propuestas ─────────────────────────────────────────────────────

export function listModuleProposals(managedProjectId?: number): Promise<ModuleProposal[]> {
  const q = new URLSearchParams();
  if (managedProjectId) q.set('managedProjectId', String(managedProjectId));
  const qs = q.toString();
  return fetchJson(`/api/module-proposals${qs ? `?${qs}` : ''}`);
}

export function getModuleProposal(id: number): Promise<ModuleProposal> {
  return fetchJson(`/api/module-proposals/${id}`);
}

export async function createModuleProposal(payload: {
  managed_project_id: number;
  title: string;
  client?: string;
  status?: ModuleProposalStatus;
  file_name?: string;
  file_content?: string;
  notes?: string;
}): Promise<ModuleProposal> {
  const res = await apiFetch(apiUrl('/api/module-proposals'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function addModuleProposalVersion(
  id: number,
  payload: {
    status?: ModuleProposalStatus;
    client?: string;
    file_name?: string;
    file_content?: string;
    notes?: string;
  },
): Promise<ModuleProposal> {
  const res = await apiFetch(apiUrl(`/api/module-proposals/${id}/versions`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function compareModuleProposalVersions(
  id: number,
  a: number,
  b: number,
): Promise<Record<string, unknown>> {
  return fetchJson(`/api/module-proposals/${id}/compare?a=${a}&b=${b}`);
}

export function exportModuleProposalPdfUrl(id: number): string {
  return apiUrl(`/api/module-proposals/${id}/export-pdf`);
}

export async function shareModuleProposal(id: number): Promise<{ share_token: string; share_url: string }> {
  const res = await apiFetch(apiUrl(`/api/module-proposals/${id}/share`), { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function saveModuleProposalToDrive(id: number): Promise<{ drive_file_id: string; web_view_link?: string }> {
  const res = await apiFetch(apiUrl(`/api/module-proposals/${id}/drive`), { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteModuleProposal(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/api/module-proposals/${id}`), { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ── Fases 8–10: Informes ───────────────────────────────────────────────────

export function listConfiguredReports(): Promise<ConfiguredReport[]> {
  return fetchJson('/api/configured-reports');
}

export function getConfiguredReport(id: number): Promise<ConfiguredReport & { runs?: ConfiguredReportRun[] }> {
  return fetchJson(`/api/configured-reports/${id}`);
}

export function listReportProcesses(): Promise<Array<{ key: string; label: string }>> {
  return fetchJson('/api/configured-reports/processes');
}

export async function createConfiguredReport(payload: Partial<ConfiguredReport> & { name: string }): Promise<ConfiguredReport> {
  const res = await apiFetch(apiUrl('/api/configured-reports'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateConfiguredReport(
  id: number,
  payload: Partial<ConfiguredReport>,
): Promise<ConfiguredReport> {
  const res = await apiFetch(apiUrl(`/api/configured-reports/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function runConfiguredReport(
  id: number,
  params: { markProcessed?: boolean; dateFrom?: string; dateTo?: string } = {},
): Promise<{ run: ConfiguredReportRun; result: Record<string, unknown> }> {
  const res = await apiFetch(apiUrl(`/api/configured-reports/${id}/run`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      markProcessed: Boolean(params.markProcessed),
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteConfiguredReport(id: number): Promise<void> {
  const res = await apiFetch(apiUrl(`/api/configured-reports/${id}`), { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export type { ReportStep };

// ── Fase 11: Admin ─────────────────────────────────────────────────────────

export function getAdminOverview(): Promise<Record<string, unknown>> {
  return fetchJson('/api/admin/overview');
}

export function getAdminSettings(): Promise<Record<string, unknown>> {
  return fetchJson('/api/admin/settings');
}

export async function updateAdminSettings(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await apiFetch(apiUrl('/api/admin/settings'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export function listAuditLogs(limit = 100): Promise<Array<Record<string, unknown>>> {
  return fetchJson(`/api/admin/audit-logs?limit=${limit}`);
}

// ── QC-0 / QC-1: Control de Calidad ────────────────────────────────────────

export function listQcRoles(): Promise<QcRole[]> {
  return fetchJson('/api/qc/roles');
}

export function listQcPermissions(): Promise<QcPermission[]> {
  return fetchJson('/api/qc/permissions');
}

export function listQcOrganizations(userId: string): Promise<QcOrganization[]> {
  return fetchJson(`/api/qc/orgs?userId=${encodeURIComponent(userId)}`);
}

export async function createQcOrganization(payload: {
  name: string;
  slug?: string;
  legal_name?: string;
  userId: string;
}): Promise<QcOrganization> {
  const res = await apiFetch(apiUrl('/api/qc/orgs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcOrganization(
  orgId: string,
  payload: { name?: string; legal_name?: string; status?: string; userId: string },
): Promise<QcOrganization> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export function listQcMembers(orgId: string, userId: string): Promise<QcOrgMembership[]> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/members?userId=${encodeURIComponent(userId)}`,
  );
}

export async function addQcMember(
  orgId: string,
  payload: { email: string; role_key: string; actorUserId: string },
): Promise<QcOrgMembership> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/members`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcMember(
  orgId: string,
  memberId: number,
  payload: { role_key?: string; status?: string; actorUserId: string },
): Promise<QcOrgMembership> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/members/${memberId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

// ── QC-2: Clientes y proyectos ─────────────────────────────────────────────

export function listQcClients(
  orgId: string,
  userId: string,
  filters?: { search?: string; status?: string },
): Promise<QcClient[]> {
  const params = new URLSearchParams({ userId });
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  return fetchJson(`/api/qc/orgs/${orgId}/clients?${params}`);
}

export async function createQcClient(
  orgId: string,
  payload: Partial<QcClient> & { name: string; actorUserId: string },
): Promise<QcClient> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/clients`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcClient(
  orgId: string,
  clientId: number,
  payload: Partial<QcClient> & { actorUserId: string },
): Promise<QcClient> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/clients/${clientId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcClient(
  orgId: string,
  clientId: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(`/api/qc/orgs/${orgId}/clients/${clientId}?actorUserId=${encodeURIComponent(actorUserId)}`),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export function listQcProjects(
  orgId: string,
  userId: string,
  filters?: { search?: string; status?: string; clientId?: number },
): Promise<QcProject[]> {
  const params = new URLSearchParams({ userId });
  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.clientId != null) params.set('clientId', String(filters.clientId));
  return fetchJson(`/api/qc/orgs/${orgId}/projects?${params}`);
}

export async function createQcProject(
  orgId: string,
  payload: Partial<QcProject> & { name: string; actorUserId: string },
): Promise<QcProject> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/projects`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcProject(
  orgId: string,
  projectId: number,
  payload: Partial<QcProject> & { actorUserId: string },
): Promise<QcProject> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/projects/${projectId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcProject(
  orgId: string,
  projectId: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(
      `/api/qc/orgs/${orgId}/projects/${projectId}?actorUserId=${encodeURIComponent(actorUserId)}`,
    ),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

// ── QC-3: Encuestas y revisión ─────────────────────────────────────────────

export function listQcSurveys(
  orgId: string,
  userId: string,
  filters?: { projectId?: number; status?: string; search?: string },
): Promise<QcSurvey[]> {
  const params = new URLSearchParams({ userId });
  if (filters?.projectId != null) params.set('projectId', String(filters.projectId));
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  return fetchJson(`/api/qc/orgs/${orgId}/surveys?${params}`);
}

export function getQcSurvey(orgId: string, surveyId: number, userId: string): Promise<QcSurvey> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/surveys/${surveyId}?userId=${encodeURIComponent(userId)}`,
  );
}

export async function createQcSurvey(
  orgId: string,
  payload: Partial<QcSurvey> & { project_id: number; actorUserId: string },
): Promise<QcSurvey> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/surveys`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcSurvey(
  orgId: string,
  surveyId: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(
      `/api/qc/orgs/${orgId}/surveys/${surveyId}?actorUserId=${encodeURIComponent(actorUserId)}`,
    ),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function submitQcReview(
  orgId: string,
  surveyId: number,
  stageType: QcReviewStageType,
  payload: {
    status: 'aprobada' | 'rechazada' | 'observacion';
    notes?: string;
    actorUserId: string;
  },
): Promise<QcSurvey> {
  const res = await apiFetch(
    apiUrl(`/api/qc/orgs/${orgId}/surveys/${surveyId}/reviews/${stageType}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

// ── QC-4: Reglas ───────────────────────────────────────────────────────────

export function listQcRules(
  orgId: string,
  userId: string,
  filters?: { projectId?: number | null },
): Promise<QcRule[]> {
  const params = new URLSearchParams({ userId });
  if (filters?.projectId === null) params.set('scope', 'global');
  else if (typeof filters?.projectId === 'number') params.set('projectId', String(filters.projectId));
  return fetchJson(`/api/qc/orgs/${orgId}/rules?${params}`);
}

export async function createQcRule(
  orgId: string,
  payload: Partial<QcRule> & {
    name: string;
    field_key: string;
    operator: string;
    actorUserId: string;
  },
): Promise<QcRule> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/rules`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcRule(
  orgId: string,
  ruleId: number,
  payload: Partial<QcRule> & { actorUserId: string },
): Promise<QcRule> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/rules/${ruleId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcRule(
  orgId: string,
  ruleId: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(`/api/qc/orgs/${orgId}/rules/${ruleId}?actorUserId=${encodeURIComponent(actorUserId)}`),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function seedQcDefaultRules(
  orgId: string,
  actorUserId: string,
  projectId?: number | null,
): Promise<QcRule[]> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/rules/seed-defaults`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorUserId, project_id: projectId ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export function evaluateQcSurveyRules(
  orgId: string,
  surveyId: number,
  userId: string,
): Promise<QcRuleEvaluation> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/surveys/${surveyId}/evaluate-rules?userId=${encodeURIComponent(userId)}`,
  );
}

export async function applyQcSurveyRules(
  orgId: string,
  surveyId: number,
  actorUserId: string,
): Promise<QcRuleEvaluation> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/surveys/${surveyId}/apply-rules`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorUserId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

// ── QC-5: Evidencias y auditoría ───────────────────────────────────────────

export function listQcEvidences(
  orgId: string,
  surveyId: number,
  userId: string,
): Promise<QcEvidence[]> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/surveys/${surveyId}/evidences?userId=${encodeURIComponent(userId)}`,
  );
}

export async function createQcEvidence(
  orgId: string,
  surveyId: number,
  payload: Partial<QcEvidence> & { evidence_type: string; actorUserId: string },
): Promise<QcEvidence> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/surveys/${surveyId}/evidences`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

/** QC-10: sube archivo a Storage vía backend */
export async function uploadQcEvidence(
  orgId: string,
  surveyId: number,
  payload: {
    file: File;
    actorUserId: string;
    title?: string;
    notes?: string;
    stage_type?: string;
    evidence_type?: string;
  },
): Promise<QcEvidence> {
  const form = new FormData();
  form.append('file', payload.file);
  form.append('actorUserId', payload.actorUserId);
  if (payload.title) form.append('title', payload.title);
  if (payload.notes) form.append('notes', payload.notes);
  if (payload.stage_type) form.append('stage_type', payload.stage_type);
  if (payload.evidence_type) form.append('evidence_type', payload.evidence_type);

  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/surveys/${surveyId}/evidences/upload`), {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcEvidence(
  orgId: string,
  evidenceId: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(
      `/api/qc/orgs/${orgId}/evidences/${evidenceId}?actorUserId=${encodeURIComponent(actorUserId)}`,
    ),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export function listQcAuditLogs(
  orgId: string,
  userId: string,
  filters?: { limit?: number; surveyId?: number; action?: string },
): Promise<QcAuditLog[]> {
  const params = new URLSearchParams({ userId });
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.surveyId) params.set('surveyId', String(filters.surveyId));
  if (filters?.action) params.set('action', filters.action);
  return fetchJson(`/api/qc/orgs/${orgId}/audit-logs?${params}`);
}

// ── QC-6: Integraciones ────────────────────────────────────────────────────

export function listQcIntegrations(orgId: string, userId: string): Promise<QcIntegration[]> {
  return fetchJson(`/api/qc/orgs/${orgId}/integrations?userId=${encodeURIComponent(userId)}`);
}

export async function createQcIntegration(
  orgId: string,
  payload: Partial<QcIntegration> & {
    name: string;
    provider: string;
    actorUserId: string;
  },
): Promise<QcIntegration> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/integrations`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcIntegration(
  orgId: string,
  id: number,
  payload: Partial<QcIntegration> & { actorUserId: string },
): Promise<QcIntegration> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/integrations/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcIntegration(
  orgId: string,
  id: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(
      `/api/qc/orgs/${orgId}/integrations/${id}?actorUserId=${encodeURIComponent(actorUserId)}`,
    ),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export function listQcIntegrationRuns(
  orgId: string,
  id: number,
  userId: string,
): Promise<QcIntegrationRun[]> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/integrations/${id}/runs?userId=${encodeURIComponent(userId)}`,
  );
}

export async function syncQcIntegration(
  orgId: string,
  id: number,
  actorUserId: string,
): Promise<{ integration: QcIntegration; run: QcIntegrationRun }> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/integrations/${id}/sync`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorUserId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

// ── QC-7: Dashboard ────────────────────────────────────────────────────────

export function getQcDashboard(orgId: string, userId: string): Promise<QcDashboardStats> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/dashboard?userId=${encodeURIComponent(userId)}`,
  );
}

// ── QC-9: Webhooks ─────────────────────────────────────────────────────────

export function listQcWebhooks(orgId: string, userId: string): Promise<QcWebhook[]> {
  return fetchJson(`/api/qc/orgs/${orgId}/webhooks?userId=${encodeURIComponent(userId)}`);
}

export async function createQcWebhook(
  orgId: string,
  payload: {
    name: string;
    url: string;
    secret?: string;
    events?: QcWebhookEvent[];
    enabled?: boolean;
    actorUserId: string;
  },
): Promise<QcWebhook> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/webhooks`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcWebhook(
  orgId: string,
  id: number,
  payload: Partial<QcWebhook> & { actorUserId: string },
): Promise<QcWebhook> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/webhooks/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcWebhook(
  orgId: string,
  id: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(`/api/qc/orgs/${orgId}/webhooks/${id}?actorUserId=${encodeURIComponent(actorUserId)}`),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function testQcWebhook(
  orgId: string,
  id: number,
  actorUserId: string,
): Promise<QcWebhook> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/webhooks/${id}/test`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorUserId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

// ── QC-11: Reportes ────────────────────────────────────────────────────────

export function getQcReportSummary(
  orgId: string,
  userId: string,
  filters?: { projectId?: number; status?: string },
): Promise<QcReportSummary> {
  const q = new URLSearchParams({ userId });
  if (filters?.projectId) q.set('projectId', String(filters.projectId));
  if (filters?.status) q.set('status', filters.status);
  return fetchJson(`/api/qc/orgs/${orgId}/reports/summary?${q}`);
}

export function listQcReportExports(
  orgId: string,
  userId: string,
): Promise<QcReportExportLog[]> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/reports/exports?userId=${encodeURIComponent(userId)}`,
  );
}

/**
 * Descarga un export de reportes QC.
 *
 * Antes eran enlaces `<a href>` con `userId` en la URL; como el backend ahora
 * exige el JWT de sesión y una navegación por href no puede enviar la cabecera
 * Authorization, la descarga se hace por fetch autenticado y se materializa el
 * blob en el navegador. Así el token nunca viaja en la URL.
 */
export async function downloadQcReport(
  orgId: string,
  format: 'csv' | 'json',
  filters?: { projectId?: number; status?: string },
): Promise<void> {
  const q = new URLSearchParams();
  if (filters?.projectId) q.set('projectId', String(filters.projectId));
  if (filters?.status) q.set('status', filters.status);
  const qs = q.toString();
  const res = await apiFetch(
    apiUrl(`/api/qc/orgs/${orgId}/reports/export.${format}${qs ? `?${qs}` : ''}`),
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qc-report-${orgId}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── QC-12: Seguimiento Encuestadores ────────────────────────────────────────

export function listQcRecruitMunicipios(
  orgId: string,
  userId: string,
): Promise<QcRecruitMunicipio[]> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/recruit/municipios?userId=${encodeURIComponent(userId)}`,
  );
}

export async function createQcRecruitMunicipio(
  orgId: string,
  payload: Partial<QcRecruitMunicipio> & { nombre: string; actorUserId: string },
): Promise<QcRecruitMunicipio> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/recruit/municipios`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcRecruitMunicipio(
  orgId: string,
  id: number,
  payload: Partial<QcRecruitMunicipio> & { actorUserId: string },
): Promise<QcRecruitMunicipio> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/recruit/municipios/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcRecruitMunicipio(
  orgId: string,
  id: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(
      `/api/qc/orgs/${orgId}/recruit/municipios/${id}?actorUserId=${encodeURIComponent(actorUserId)}`,
    ),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export function listQcRecruitCandidates(
  orgId: string,
  userId: string,
  filters?: { search?: string; etapa?: QcRecruitEtapa; municipioId?: number },
): Promise<QcRecruitCandidate[]> {
  const params = new URLSearchParams({ userId });
  if (filters?.search) params.set('search', filters.search);
  if (filters?.etapa) params.set('etapa', filters.etapa);
  if (filters?.municipioId) params.set('municipioId', String(filters.municipioId));
  return fetchJson(`/api/qc/orgs/${orgId}/recruit/candidates?${params}`);
}

export async function createQcRecruitCandidate(
  orgId: string,
  payload: Partial<QcRecruitCandidate> & { nombre: string; celular: string; actorUserId: string },
): Promise<QcRecruitCandidate> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/recruit/candidates`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcRecruitCandidate(
  orgId: string,
  id: number,
  payload: Partial<QcRecruitCandidate> & { actorUserId: string },
): Promise<QcRecruitCandidate> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/recruit/candidates/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcRecruitCandidate(
  orgId: string,
  id: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(
      `/api/qc/orgs/${orgId}/recruit/candidates/${id}?actorUserId=${encodeURIComponent(actorUserId)}`,
    ),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export function listQcRecruitContactos(
  orgId: string,
  candidateId: number,
  userId: string,
): Promise<QcRecruitContacto[]> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/recruit/candidates/${candidateId}/contactos?userId=${encodeURIComponent(userId)}`,
  );
}

export async function changeQcRecruitCandidateStage(
  orgId: string,
  candidateId: number,
  payload: { etapa: QcRecruitEtapa; comentario?: string; actorUserId: string },
): Promise<QcRecruitCandidate> {
  const res = await apiFetch(
    apiUrl(`/api/qc/orgs/${orgId}/recruit/candidates/${candidateId}/etapa`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function addQcRecruitContactComment(
  orgId: string,
  candidateId: number,
  payload: { comentario: string; actorUserId: string },
): Promise<QcRecruitContacto> {
  const res = await apiFetch(
    apiUrl(`/api/qc/orgs/${orgId}/recruit/candidates/${candidateId}/contactos`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export function listQcRecruitPublicaciones(
  orgId: string,
  userId: string,
): Promise<QcRecruitPublicacion[]> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/recruit/publicaciones?userId=${encodeURIComponent(userId)}`,
  );
}

export async function createQcRecruitPublicacion(
  orgId: string,
  payload: Partial<QcRecruitPublicacion> & { titulo: string; actorUserId: string },
): Promise<QcRecruitPublicacion> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/recruit/publicaciones`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function updateQcRecruitPublicacion(
  orgId: string,
  id: number,
  payload: Partial<QcRecruitPublicacion> & { actorUserId: string },
): Promise<QcRecruitPublicacion> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/recruit/publicaciones/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function deleteQcRecruitPublicacion(
  orgId: string,
  id: number,
  actorUserId: string,
): Promise<void> {
  const res = await apiFetch(
    apiUrl(
      `/api/qc/orgs/${orgId}/recruit/publicaciones/${id}?actorUserId=${encodeURIComponent(actorUserId)}`,
    ),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function importQcRecruitCandidates(
  orgId: string,
  payload: { rows: QcRecruitImportRow[]; source?: 'csv' | 'gmail'; actorUserId: string },
): Promise<QcRecruitImportRun> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/recruit/import`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export function listQcRecruitImportRuns(
  orgId: string,
  userId: string,
): Promise<QcRecruitImportRun[]> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/recruit/import/runs?userId=${encodeURIComponent(userId)}`,
  );
}

export interface QcRecruitGmailStatus {
  connected: boolean;
  email: string | null;
}

export function getQcRecruitGmailStatus(
  orgId: string,
  userId: string,
): Promise<QcRecruitGmailStatus> {
  return fetchJson(
    `/api/qc/orgs/${orgId}/recruit/gmail/status?userId=${encodeURIComponent(userId)}`,
  );
}

export async function getQcRecruitGmailAuthUrl(
  orgId: string,
  actorUserId: string,
): Promise<{ url: string }> {
  const res = await apiFetch(
    apiUrl(`/api/qc/orgs/${orgId}/recruit/gmail/auth-url?userId=${encodeURIComponent(actorUserId)}`),
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function disconnectQcRecruitGmail(orgId: string, actorUserId: string): Promise<void> {
  const res = await apiFetch(
    apiUrl(
      `/api/qc/orgs/${orgId}/recruit/gmail/connection?actorUserId=${encodeURIComponent(actorUserId)}`,
    ),
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export interface QcRecruitGmailMessagePreview {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  cvUrl: string | null;
  suggested: { nombre: string; celular: string; email: string; municipio: string };
}

export async function previewQcRecruitGmail(
  orgId: string,
  actorUserId: string,
): Promise<{ messages: QcRecruitGmailMessagePreview[] }> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/recruit/gmail/preview`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorUserId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function importQcRecruitGmailRows(
  orgId: string,
  payload: { rows: QcRecruitImportRow[]; actorUserId: string },
): Promise<QcRecruitImportRun> {
  const res = await apiFetch(apiUrl(`/api/qc/orgs/${orgId}/recruit/gmail/import`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}
