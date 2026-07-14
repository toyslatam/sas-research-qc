/** Tipos compartidos entre desktop, backend y web */

export interface Project {
  id: number;
  name: string;
  client: string;
  created_at: string;
}

export type ManagedProjectStatus = 'borrador' | 'activo' | 'en_pausa' | 'cerrado';

export interface ManagedProject {
  id: number;
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
  created_at: string;
  updated_at: string;
}

export interface AiAnalysisTask {
  title: string;
  owner: string;
  due_date: string | null;
}

export interface AiMeetingAnalysis {
  id: number;
  managed_project_id: number;
  meeting_title: string;
  source_filename: string;
  transcript_text: string;
  translated_text: string;
  target_language: string;
  summary: string;
  agreements: string[];
  tasks: AiAnalysisTask[];
  risks: string[];
  decisions: string[];
  created_at: string;
}

/** Tema o bloque temático del cuestionario (ej. estructura de precios EOR) */
export interface Category {
  id: number;
  project_id: number;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface Question {
  id: number;
  project_id: number;
  text: string;
  category: string;
  category_id: number | null;
  /** Sub-ítems o opciones (ej. 2.1 Nómina, 2.2 Impuestos) — uno por verificar en la entrevista */
  sub_items: string[];
  sort_order: number;
}

export type InterviewStatus =
  | 'recording'
  | 'uploaded'
  | 'transcribing'
  | 'matching'
  | 'insights'
  | 'completed'
  | 'error';

export type ModuleType = 'propuesta' | 'exploratorio';
export type SourceType = 'audio' | 'pdf' | 'docx' | 'xlsx';
export type MeetingStage =
  | 'Reunión #1 Exploratoria'
  | 'Reunión #2 Cotización'
  | 'Reunión #3 De clausura';

export interface Interview {
  id: number;
  project_id: number;
  external_id: string;
  participant_name: string;
  contact?: string;
  interview_date?: string;
  meeting_stage?: MeetingStage | null;
  module_type: ModuleType;
  source_type: SourceType;
  filename: string;
  duration_sec: number | null;
  status: InterviewStatus;
  created_at: string;
  project_name?: string;
}

export interface Transcript {
  interview_id: number;
  full_text: string;
  file_path: string | null;
}

export interface MatchedAnswer {
  pregunta: string;
  respuesta: string;
  categoria?: string;
  confianza?: number;
}

export interface MatchResult {
  entrevista: string;
  preguntas: MatchedAnswer[];
}

export interface InsightsResult {
  resumen_ejecutivo: string;
  principales_hallazgos: string[];
  temas_recurrentes: string[];
  sentimiento_general: 'positivo' | 'neutral' | 'negativo' | 'mixto';
  palabras_clave: string[];
  oportunidades_detectadas: string[];
}

export interface DashboardStats {
  total_entrevistas: number;
  por_proyecto: { proyecto: string; count: number }[];
  sentimiento: { label: string; count: number }[];
  marcas_frecuentes: { term: string; count: number }[];
  lugares_compra: { term: string; count: number }[];
  respuestas_por_pregunta: { pregunta: string; respuestas: { valor: string; count: number }[] }[];
}

/** Tabla: una fila por entrevista, columnas por pregunta del cuestionario */
export interface InterviewResponsesMatrix {
  preguntas: string[];
  entrevistas: {
    id: number;
    external_id: string;
    participant_name: string;
    module_type: ModuleType;
    source_type: SourceType;
    meeting_stage?: MeetingStage | null;
    proyecto: string;
    fecha: string;
    respuestas: Record<string, string>;
  }[];
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

export type FinalAnalysisStatus = 'borrador' | 'en_revision' | 'aprobado';

export type FinalAnalysisRelevance =
  | 'pendiente'
  | 'alineada'
  | 'parcial'
  | 'desalineada'
  | 'sin_dato';

export interface FinalAnalysisItem {
  id: number;
  analysis_id: number;
  question_id: number | null;
  sub_item_index: number | null;
  code: string;
  category: string;
  question_text: string;
  sub_item_text: string | null;
  answer_propuesta: string;
  answer_r1: string;
  answer_r2: string;
  answer_r3: string;
  synthesis: string;
  relevance: FinalAnalysisRelevance;
  relevance_note: string | null;
  coverage_status: string | null;
  item_score: number | null;
  reviewer_note: string | null;
  sort_order: number;
}

export interface ProviderFinalAnalysis {
  id: number;
  project_id: number;
  provider_name: string;
  provider_slug: string;
  status: FinalAnalysisStatus;
  global_score: number | null;
  category_weights: Record<string, number>;
  reviewer_notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  items: FinalAnalysisItem[];
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  durationMs: number;
  filename: string | null;
}

// ── Fase 7: Propuestas ─────────────────────────────────────────────────────

export type ModuleProposalStatus =
  | 'borrador'
  | 'enviada'
  | 'en_revision'
  | 'aprobada'
  | 'rechazada';

export interface ModuleProposalVersion {
  id: number;
  proposal_id: number;
  version: number;
  status: ModuleProposalStatus;
  client: string;
  file_name: string;
  file_content: string;
  notes: string;
  created_at: string;
}

export interface ModuleProposalHistoryEntry {
  id: number;
  proposal_id: number;
  version_id: number | null;
  action: string;
  detail: string;
  created_at: string;
}

export interface ModuleProposal {
  id: number;
  managed_project_id: number;
  title: string;
  client: string;
  current_version: number;
  status: ModuleProposalStatus;
  share_token: string | null;
  drive_file_id: string | null;
  created_at: string;
  updated_at: string;
  versions?: ModuleProposalVersion[];
  history?: ModuleProposalHistoryEntry[];
}

// ── Fase 8–10: Informes configurados ───────────────────────────────────────

export type ConfiguredReportStatus = 'activo' | 'pausado' | 'archivado';
export type ReportRunStatus = 'pending' | 'running' | 'success' | 'error';

export type ReportStepType =
  | 'read_google_sheets'
  | 'filter_columns'
  | 'lookup_match'
  | 'cross_sheet'
  | 'update_columns'
  | 'add_columns'
  | 'delete_records'
  | 'send_email'
  | 'save_pdf'
  | 'call_openai'
  | 'call_api'
  | 'custom_javascript'
  | 'save_history';

export interface ReportStep {
  id: string;
  type: ReportStepType;
  label: string;
  config: Record<string, unknown>;
}

export interface ConfiguredReport {
  id: number;
  name: string;
  description: string;
  status: ConfiguredReportStatus;
  source_spreadsheet_id: string;
  source_sheet: string;
  configuration: Record<string, unknown>;
  steps: ReportStep[];
  process_key: string;
  last_run_status: ReportRunStatus | null;
  last_run_at: string | null;
  responsible: string;
  created_at: string;
  updated_at: string;
}

export interface ConfiguredReportRun {
  id: number;
  report_id: number;
  status: ReportRunStatus;
  processed: number;
  not_found: number;
  duplicates: number;
  errors: number;
  duration_ms: number;
  result_payload: Record<string, unknown>;
  marked_processed: boolean;
  created_at: string;
}

// ── Fase 11: Admin ─────────────────────────────────────────────────────────

export interface AdminSettings {
  id: number;
  openai_model: string;
  google_sheets_enabled: boolean;
  google_drive_enabled: boolean;
  general_notes: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor: string;
  action: string;
  entity: string;
  detail: string;
  created_at: string;
}

// ── QC-0 / QC-1: Control de Calidad (multiempresa) ─────────────────────────

export type QcOrgStatus = 'active' | 'suspended' | 'trial';
export type QcMembershipStatus = 'active' | 'invited' | 'suspended';
export type QcRoleKey =
  | 'admin'
  | 'supervisor'
  | 'coordinador'
  | 'revisor'
  | 'auditor'
  | 'cliente';

export interface QcOrganization {
  id: string;
  name: string;
  slug: string;
  legal_name: string;
  status: QcOrgStatus;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface QcRole {
  key: QcRoleKey | string;
  name: string;
  description: string;
  sort_order: number;
}

export interface QcPermission {
  key: string;
  name: string;
  description: string;
  module: string;
}

export interface QcOrgMembership {
  id: number;
  org_id: string;
  user_id: string;
  role_key: QcRoleKey | string;
  status: QcMembershipStatus;
  created_at: string;
  updated_at: string;
  /** Enriquecido por API cuando está disponible */
  user_email?: string | null;
  user_full_name?: string | null;
  org_name?: string | null;
}

export interface QcClient {
  id: number;
  org_id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  contact_name: string;
  contact_email: string;
  notes: string;
  created_at: string;
  updated_at?: string;
}

export type QcProjectStatus = 'borrador' | 'activo' | 'en_pausa' | 'cerrado';

export interface QcProject {
  id: number;
  org_id: string;
  client_id: number | null;
  name: string;
  code: string;
  description: string;
  status: QcProjectStatus;
  country: string;
  methodology: string;
  start_date: string | null;
  end_date: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Enriquecido por API */
  client_name?: string | null;
}

// ── QC-3: Encuestas y revisión ─────────────────────────────────────────────

export type QcSurveyStatus =
  | 'pendiente'
  | 'en_revision'
  | 'aprobada'
  | 'rechazada'
  | 'en_auditoria';

export type QcSurveyStage = 'ubicacion' | 'contenido' | 'telefono' | 'completada';

export type QcReviewStageType = 'ubicacion' | 'contenido' | 'telefono';

export type QcReviewStageStatus = 'pendiente' | 'aprobada' | 'rechazada' | 'observacion';

export interface QcSurvey {
  id: number;
  org_id: string;
  project_id: number;
  external_id: string;
  respondent_code: string;
  interviewer: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  collected_at: string | null;
  status: QcSurveyStatus;
  current_stage: QcSurveyStage;
  answers: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  project_name?: string | null;
  stages?: QcReviewStage[];
}

export interface QcReviewStage {
  id: number;
  org_id: string;
  survey_id: number;
  stage_type: QcReviewStageType;
  status: QcReviewStageStatus;
  reviewer_id: string | null;
  notes: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QcReviewEvent {
  id: number;
  org_id: string;
  survey_id: number;
  stage_type: string;
  action: string;
  actor_id: string | null;
  detail: string;
  created_at: string;
}

// ── QC-4: Motor de reglas ──────────────────────────────────────────────────

export type QcRuleStageType = 'any' | 'ubicacion' | 'contenido' | 'telefono';

export type QcRuleOperator =
  | 'required'
  | 'is_empty'
  | 'is_not_empty'
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'regex'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'coords_present';

export type QcRuleSeverity = 'info' | 'warning' | 'error' | 'block';
export type QcRuleAction = 'flag' | 'auto_observacion' | 'auto_rechazar';

export interface QcRule {
  id: number;
  org_id: string;
  project_id: number | null;
  name: string;
  description: string;
  stage_type: QcRuleStageType;
  field_key: string;
  operator: QcRuleOperator;
  value_text: string;
  severity: QcRuleSeverity;
  action: QcRuleAction;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  project_name?: string | null;
}

export interface QcRuleHit {
  rule_id: number;
  rule_name: string;
  stage_type: QcRuleStageType;
  field_key: string;
  operator: QcRuleOperator;
  severity: QcRuleSeverity;
  action: QcRuleAction;
  message: string;
}

export interface QcRuleEvaluation {
  survey_id: number;
  hits: QcRuleHit[];
  has_block: boolean;
  has_error: boolean;
  /** QC-9: acciones aplicadas (vacío si solo se evaluó) */
  applied_actions?: QcRuleAppliedAction[];
  survey?: QcSurvey | null;
}

export interface QcRuleAppliedAction {
  rule_id: number;
  rule_name: string;
  action: QcRuleAction;
  stage_type: QcReviewStageType;
  status: 'observacion' | 'rechazada';
  skipped?: boolean;
  reason?: string;
}

// ── QC-5: Evidencias y auditoría ───────────────────────────────────────────

export type QcEvidenceType = 'photo' | 'audio' | 'document' | 'link' | 'note';

export interface QcEvidence {
  id: number;
  org_id: string;
  survey_id: number;
  stage_type: 'ubicacion' | 'contenido' | 'telefono' | null;
  evidence_type: QcEvidenceType;
  title: string;
  url: string;
  notes: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QcAuditLog {
  id: number;
  org_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  survey_id: number | null;
  project_id: number | null;
  detail: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_email?: string | null;
}

// ── QC-6: Integraciones ────────────────────────────────────────────────────

export type QcIntegrationProvider = 'google_sheets' | 'zoho';
export type QcIntegrationStatus = 'inactive' | 'active' | 'error';
export type QcIntegrationRunStatus = 'success' | 'error' | 'partial' | 'skipped';

export interface QcIntegration {
  id: number;
  org_id: string;
  project_id: number | null;
  provider: QcIntegrationProvider;
  name: string;
  status: QcIntegrationStatus;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  last_sync_status: QcIntegrationRunStatus | null;
  last_sync_message: string;
  created_at: string;
  updated_at: string;
  project_name?: string | null;
}

export interface QcIntegrationRun {
  id: number;
  org_id: string;
  integration_id: number;
  status: QcIntegrationRunStatus;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  message: string;
  result_payload: Record<string, unknown>;
  started_at: string;
  finished_at: string;
}

// ── QC-7: Dashboard ────────────────────────────────────────────────────────

export interface QcDashboardCountItem {
  key: string;
  label: string;
  count: number;
}

export interface QcDashboardProjectRow {
  project_id: number;
  project_name: string;
  total: number;
  pendiente: number;
  en_revision: number;
  aprobada: number;
  rechazada: number;
  en_auditoria: number;
}

export interface QcDashboardStats {
  totals: {
    projects: number;
    clients: number;
    surveys: number;
    evidences: number;
    rules_active: number;
    integrations_active: number;
  };
  surveys_by_status: QcDashboardCountItem[];
  surveys_by_stage: QcDashboardCountItem[];
  projects_breakdown: QcDashboardProjectRow[];
  recent_surveys: Array<{
    id: number;
    label: string;
    status: string;
    current_stage: string;
    project_name: string | null;
    updated_at: string;
  }>;
  attention: {
    pending_review: number;
    rejected: number;
    missing_gps: number;
    integration_errors: number;
  };
}

// ── QC-8: Import sync (Sheets/Zoho → qc_surveys) ───────────────────────────
// El upsert vive en backend (qcRepo.upsertSurveyFromImport).
// result_payload de QcIntegrationRun puede incluir: created, updated, skipped, errors.

// ── QC-9: Webhooks / notificaciones ────────────────────────────────────────

export type QcWebhookEvent =
  | 'rules.applied'
  | 'survey.rejected'
  | 'survey.observation'
  | 'integration.sync';

export interface QcWebhook {
  id: number;
  org_id: string;
  name: string;
  url: string;
  secret: string;
  events: QcWebhookEvent[];
  enabled: boolean;
  last_delivery_at: string | null;
  last_delivery_status: string;
  last_delivery_message: string;
  created_at: string;
  updated_at: string;
}

// ── QC-11: Reportes ────────────────────────────────────────────────────────

export interface QcReportSurveyRow {
  id: number;
  project_id: number;
  project_name: string;
  external_id: string;
  respondent_code: string;
  interviewer: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  current_stage: string;
  collected_at: string | null;
  created_at: string;
  updated_at: string;
  evidences_count: number;
  stage_ubicacion: string;
  stage_contenido: string;
  stage_telefono: string;
}

export interface QcReportSummary {
  generated_at: string;
  filters: {
    project_id: number | null;
    status: string | null;
  };
  totals: {
    surveys: number;
    evidences: number;
    by_status: Record<string, number>;
    by_stage: Record<string, number>;
    by_project: Array<{ project_id: number; project_name: string; count: number }>;
  };
  rows: QcReportSurveyRow[];
}

export interface QcReportExportLog {
  id: number;
  org_id: string;
  actor_id: string | null;
  format: 'csv' | 'json' | 'summary';
  filters: Record<string, unknown>;
  row_count: number;
  created_at: string;
}
