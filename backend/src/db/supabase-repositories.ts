/**
 * Repositorios Supabase — misma interfaz que repositories.ts pero async.
 * Reemplaza completamente el backend SQLite para producción.
 */
import type {
  AdminSettings,
  AiAnalysisTask,
  AiMeetingAnalysis,
  AuditLogEntry,
  Category,
  ConfiguredReport,
  ConfiguredReportRun,
  InsightsResult,
  InterviewStatus,
  ManagedProject,
  ManagedProjectStatus,
  MatchResult,
  ModuleProposal,
  ModuleProposalHistoryEntry,
  ModuleProposalStatus,
  ModuleProposalVersion,
  Project,
  QcMembershipStatus,
  QcOrgMembership,
  QcOrgStatus,
  QcOrganization,
  QcPermission,
  QcClient,
  QcDashboardStats,
  QcProject,
  QcProjectStatus,
  QcReviewEvent,
  QcReviewStage,
  QcReviewStageStatus,
  QcReviewStageType,
  QcRole,
  QcRule,
  QcRuleAction,
  QcRuleAppliedAction,
  QcRuleEvaluation,
  QcRuleHit,
  QcRuleOperator,
  QcRuleSeverity,
  QcRuleStageType,
  QcSurvey,
  QcSurveyStage,
  QcSurveyStatus,
  QcAuditLog,
  QcEvidence,
  QcEvidenceType,
  QcIntegration,
  QcIntegrationProvider,
  QcIntegrationRun,
  QcIntegrationRunStatus,
  QcIntegrationStatus,
  QcWebhook,
  QcWebhookEvent,
  QcReportExportLog,
  QcReportSummary,
  QcReportSurveyRow,
  Question,
  ReportRunStatus,
} from '@whispper/shared';
import { supabase } from '../lib/supabaseClient';
import { evaluateQcRules } from '../services/qcRulesEngine';
import {
  fetchQcIntegrationRows,
  type QcImportRow,
} from '../services/qcIntegrationSync';
import { deliverQcWebhook } from '../services/qcWebhooks';
import {
  createQcEvidenceSignedUrl,
  deleteQcEvidenceFile,
  guessEvidenceType,
  uploadQcEvidenceFile,
} from '../services/qcEvidenceStorage';

// ============================================================
// projectRepo
// ============================================================
export const projectRepo = {
  async list(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Project[];
  },

  async getById(id: number): Promise<Project | undefined> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as Project) ?? undefined;
  },

  async create(name: string, client: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, client })
      .select()
      .single();
    if (error) throw error;
    return data as Project;
  },
};

// ============================================================
// managedProjectRepo (Fase 4: módulo Proyectos)
// ============================================================
export const managedProjectRepo = {
  async list(filters?: {
    search?: string;
    status?: ManagedProjectStatus;
    client?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<ManagedProject[]> {
    let query = supabase
      .from('managed_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`name.ilike.${term},description.ilike.${term}`);
    }
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.client?.trim()) query = query.ilike('client', `%${filters.client.trim()}%`);
    if (filters?.dateFrom) query = query.gte('start_date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('start_date', filters.dateTo);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ManagedProject[];
  },

  async getById(id: number): Promise<ManagedProject | undefined> {
    const { data, error } = await supabase
      .from('managed_projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as ManagedProject) ?? undefined;
  },

  async create(payload: {
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
    const insertRow = {
      name: payload.name.trim(),
      description: payload.description?.trim() ?? '',
      client: payload.client?.trim() ?? '',
      status: payload.status ?? 'borrador',
      start_date: payload.start_date ?? null,
      participants: payload.participants ?? [],
      files_count: payload.files_count ?? 0,
      audios_count: payload.audios_count ?? 0,
      proposals_count: payload.proposals_count ?? 0,
      analysis_count: payload.analysis_count ?? 0,
    };

    const { data, error } = await supabase
      .from('managed_projects')
      .insert(insertRow)
      .select('*')
      .single();
    if (error) throw error;
    return data as ManagedProject;
  },

  async update(
    id: number,
    payload: {
      name?: string;
      description?: string;
      client?: string;
      status?: ManagedProjectStatus;
      start_date?: string | null;
      participants?: string[];
      files_count?: number;
      audios_count?: number;
      proposals_count?: number;
      analysis_count?: number;
    },
  ): Promise<ManagedProject | undefined> {
    const existing = await managedProjectRepo.getById(id);
    if (!existing) return undefined;

    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.description !== undefined) updates.description = payload.description.trim();
    if (payload.client !== undefined) updates.client = payload.client.trim();
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.start_date !== undefined) updates.start_date = payload.start_date;
    if (payload.participants !== undefined) updates.participants = payload.participants;
    if (payload.files_count !== undefined) updates.files_count = payload.files_count;
    if (payload.audios_count !== undefined) updates.audios_count = payload.audios_count;
    if (payload.proposals_count !== undefined) updates.proposals_count = payload.proposals_count;
    if (payload.analysis_count !== undefined) updates.analysis_count = payload.analysis_count;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('managed_projects')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return (data as ManagedProject) ?? undefined;
  },

  async delete(id: number): Promise<boolean> {
    const existing = await managedProjectRepo.getById(id);
    if (!existing) return false;
    const { error } = await supabase.from('managed_projects').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};

// ============================================================
// aiMeetingAnalysisRepo (Fase 5: módulo IA)
// ============================================================
export const aiMeetingAnalysisRepo = {
  async listByProject(managedProjectId?: number): Promise<AiMeetingAnalysis[]> {
    let query = supabase
      .from('ai_meeting_analyses')
      .select('*')
      .order('created_at', { ascending: false });

    if (managedProjectId) {
      query = query.eq('managed_project_id', managedProjectId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AiMeetingAnalysis[];
  },

  async create(payload: {
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
  }): Promise<AiMeetingAnalysis> {
    const { data, error } = await supabase
      .from('ai_meeting_analyses')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data as AiMeetingAnalysis;
  },
};

// ============================================================
// moduleProposalRepo (Fase 7)
// ============================================================
export const moduleProposalRepo = {
  async list(managedProjectId?: number): Promise<ModuleProposal[]> {
    let query = supabase
      .from('module_proposals')
      .select('*')
      .order('updated_at', { ascending: false });
    if (managedProjectId) query = query.eq('managed_project_id', managedProjectId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ModuleProposal[];
  },

  async getById(id: number): Promise<ModuleProposal | undefined> {
    const { data, error } = await supabase
      .from('module_proposals')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return undefined;

    const [versions, history] = await Promise.all([
      moduleProposalRepo.listVersions(id),
      moduleProposalRepo.listHistory(id),
    ]);

    return { ...(data as ModuleProposal), versions, history };
  },

  async listVersions(proposalId: number): Promise<ModuleProposalVersion[]> {
    const { data, error } = await supabase
      .from('module_proposal_versions')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('version', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ModuleProposalVersion[];
  },

  async listHistory(proposalId: number): Promise<ModuleProposalHistoryEntry[]> {
    const { data, error } = await supabase
      .from('module_proposal_history')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ModuleProposalHistoryEntry[];
  },

  async create(payload: {
    managed_project_id: number;
    title: string;
    client?: string;
    status?: ModuleProposalStatus;
    file_name?: string;
    file_content?: string;
    notes?: string;
  }): Promise<ModuleProposal> {
    const shareToken = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await supabase
      .from('module_proposals')
      .insert({
        managed_project_id: payload.managed_project_id,
        title: payload.title.trim(),
        client: payload.client?.trim() ?? '',
        status: payload.status ?? 'borrador',
        current_version: 1,
        share_token: shareToken,
      })
      .select('*')
      .single();
    if (error) throw error;

    const proposal = data as ModuleProposal;
    const { data: version, error: vErr } = await supabase
      .from('module_proposal_versions')
      .insert({
        proposal_id: proposal.id,
        version: 1,
        status: proposal.status,
        client: proposal.client,
        file_name: payload.file_name ?? '',
        file_content: payload.file_content ?? '',
        notes: payload.notes ?? '',
      })
      .select('*')
      .single();
    if (vErr) throw vErr;

    await supabase.from('module_proposal_history').insert({
      proposal_id: proposal.id,
      version_id: (version as ModuleProposalVersion).id,
      action: 'created',
      detail: 'Propuesta creada (v1)',
    });

    return moduleProposalRepo.getById(proposal.id) as Promise<ModuleProposal>;
  },

  async addVersion(
    proposalId: number,
    payload: {
      status?: ModuleProposalStatus;
      client?: string;
      file_name?: string;
      file_content?: string;
      notes?: string;
    },
  ): Promise<ModuleProposal | undefined> {
    const current = await moduleProposalRepo.getById(proposalId);
    if (!current) return undefined;
    const nextVersion = current.current_version + 1;

    const { data: version, error: vErr } = await supabase
      .from('module_proposal_versions')
      .insert({
        proposal_id: proposalId,
        version: nextVersion,
        status: payload.status ?? current.status,
        client: payload.client ?? current.client,
        file_name: payload.file_name ?? '',
        file_content: payload.file_content ?? '',
        notes: payload.notes ?? '',
      })
      .select('*')
      .single();
    if (vErr) throw vErr;

    const { error } = await supabase
      .from('module_proposals')
      .update({
        current_version: nextVersion,
        status: payload.status ?? current.status,
        client: payload.client ?? current.client,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId);
    if (error) throw error;

    await supabase.from('module_proposal_history').insert({
      proposal_id: proposalId,
      version_id: (version as ModuleProposalVersion).id,
      action: 'version_added',
      detail: `Nueva versión v${nextVersion}`,
    });

    return moduleProposalRepo.getById(proposalId);
  },

  async updateStatus(id: number, status: ModuleProposalStatus): Promise<ModuleProposal | undefined> {
    const { error } = await supabase
      .from('module_proposals')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await supabase.from('module_proposal_history').insert({
      proposal_id: id,
      action: 'status_changed',
      detail: `Estado → ${status}`,
    });
    return moduleProposalRepo.getById(id);
  },

  async setDriveFileId(id: number, driveFileId: string): Promise<void> {
    const { error } = await supabase
      .from('module_proposals')
      .update({ drive_file_id: driveFileId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await supabase.from('module_proposal_history').insert({
      proposal_id: id,
      action: 'drive_saved',
      detail: `Guardado en Drive: ${driveFileId}`,
    });
  },

  async delete(id: number): Promise<boolean> {
    const existing = await moduleProposalRepo.getById(id);
    if (!existing) return false;
    const { error } = await supabase.from('module_proposals').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};

// ============================================================
// configuredReportRepo (Fases 8–10)
// ============================================================
export const configuredReportRepo = {
  async list(): Promise<ConfiguredReport[]> {
    const { data, error } = await supabase
      .from('configured_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ConfiguredReport[];
  },

  async getById(id: number): Promise<ConfiguredReport | undefined> {
    const { data, error } = await supabase
      .from('configured_reports')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as ConfiguredReport) ?? undefined;
  },

  async create(payload: Partial<ConfiguredReport> & { name: string }): Promise<ConfiguredReport> {
    const { data, error } = await supabase
      .from('configured_reports')
      .insert({
        name: payload.name.trim(),
        description: payload.description ?? '',
        status: payload.status ?? 'activo',
        source_spreadsheet_id: payload.source_spreadsheet_id ?? '',
        source_sheet: payload.source_sheet ?? '',
        configuration: payload.configuration ?? {},
        steps: payload.steps ?? [],
        process_key: payload.process_key ?? 'generic',
        responsible: payload.responsible ?? '',
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as ConfiguredReport;
  },

  async update(id: number, payload: Partial<ConfiguredReport>): Promise<ConfiguredReport | undefined> {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.source_spreadsheet_id !== undefined) updates.source_spreadsheet_id = payload.source_spreadsheet_id;
    if (payload.source_sheet !== undefined) updates.source_sheet = payload.source_sheet;
    if (payload.configuration !== undefined) updates.configuration = payload.configuration;
    if (payload.steps !== undefined) updates.steps = payload.steps;
    if (payload.process_key !== undefined) updates.process_key = payload.process_key;
    if (payload.responsible !== undefined) updates.responsible = payload.responsible;
    if (payload.last_run_status !== undefined) updates.last_run_status = payload.last_run_status;
    if (payload.last_run_at !== undefined) updates.last_run_at = payload.last_run_at;

    const { data, error } = await supabase
      .from('configured_reports')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return (data as ConfiguredReport) ?? undefined;
  },

  async delete(id: number): Promise<boolean> {
    const existing = await configuredReportRepo.getById(id);
    if (!existing) return false;
    const { error } = await supabase.from('configured_reports').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async listRuns(reportId: number): Promise<ConfiguredReportRun[]> {
    const { data, error } = await supabase
      .from('configured_report_runs')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ConfiguredReportRun[];
  },

  async createRun(payload: {
    report_id: number;
    status: ReportRunStatus;
    processed: number;
    not_found: number;
    duplicates: number;
    errors: number;
    duration_ms: number;
    result_payload: Record<string, unknown>;
    marked_processed: boolean;
  }): Promise<ConfiguredReportRun> {
    const { data, error } = await supabase
      .from('configured_report_runs')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data as ConfiguredReportRun;
  },
};

// ============================================================
// adminRepo (Fase 11)
// ============================================================
export const adminRepo = {
  async getSettings(): Promise<AdminSettings> {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as AdminSettings;
    const { data: created, error: cErr } = await supabase
      .from('admin_settings')
      .insert({
        openai_model: 'gpt-4o-mini',
        google_sheets_enabled: false,
        google_drive_enabled: false,
        general_notes: '',
      })
      .select('*')
      .single();
    if (cErr) throw cErr;
    return created as AdminSettings;
  },

  async updateSettings(payload: Partial<AdminSettings>): Promise<AdminSettings> {
    const current = await adminRepo.getSettings();
    const { data, error } = await supabase
      .from('admin_settings')
      .update({
        openai_model: payload.openai_model ?? current.openai_model,
        google_sheets_enabled: payload.google_sheets_enabled ?? current.google_sheets_enabled,
        google_drive_enabled: payload.google_drive_enabled ?? current.google_drive_enabled,
        general_notes: payload.general_notes ?? current.general_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as AdminSettings;
  },

  async listAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AuditLogEntry[];
  },

  async addAuditLog(entry: { actor?: string; action: string; entity?: string; detail?: string }): Promise<void> {
    const { error } = await supabase.from('audit_logs').insert({
      actor: entry.actor ?? 'system',
      action: entry.action,
      entity: entry.entity ?? '',
      detail: entry.detail ?? '',
    });
    if (error) throw error;
  },
};

// ============================================================
// categoryRepo
// ============================================================
export const categoryRepo = {
  async listByProject(projectId: number): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Category[];
  },

  async getById(id: number): Promise<Category | undefined> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as Category) ?? undefined;
  },

  async create(
    projectId: number,
    name: string,
    description: string,
    sortOrder: number
  ): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert({ project_id: projectId, name, description, sort_order: sortOrder })
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },

  async update(
    id: number,
    payload: { name?: string; description?: string; sort_order?: number }
  ): Promise<Category | undefined> {
    const current = await categoryRepo.getById(id);
    if (!current) return undefined;

    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.sort_order !== undefined) updates.sort_order = payload.sort_order;

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    if (payload.name) {
      await supabase
        .from('questions')
        .update({ category: payload.name })
        .eq('category_id', id);
    }

    return (data as Category) ?? undefined;
  },

  async delete(id: number): Promise<{ ok: boolean; error?: string }> {
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Hay ${count} pregunta(s) usando esta categoría. Reasígnalas antes de eliminar.`,
      };
    }

    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  },
};

// ============================================================
// questionRepo
// ============================================================
function mapQuestionRow(row: Record<string, unknown>): Question {
  const subItems = row.sub_items;
  return {
    id: row.id as number,
    project_id: row.project_id as number,
    text: row.text as string,
    category: (row.category_name as string) ?? (row.category as string) ?? 'general',
    category_id: (row.category_id as number | null) ?? null,
    sub_items: Array.isArray(subItems) ? (subItems as string[]) : [],
    sort_order: row.sort_order as number,
  };
}

export const questionRepo = {
  async listByProject(projectId: number): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*, categories(name)')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) =>
      mapQuestionRow({
        ...row,
        category_name: (row.categories as { name: string } | null)?.name,
      } as Record<string, unknown>)
    );
  },

  async getById(id: number): Promise<Question | undefined> {
    const { data, error } = await supabase
      .from('questions')
      .select('*, categories(name)')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return undefined;
    return mapQuestionRow({
      ...data,
      category_name: (data.categories as { name: string } | null)?.name,
    } as Record<string, unknown>);
  },

  async create(
    projectId: number,
    text: string,
    sortOrder: number,
    categoryId?: number | null,
    subItems: string[] = []
  ): Promise<Question> {
    let categoryName = 'general';
    let catId: number | null = categoryId ?? null;

    if (categoryId) {
      const cat = await categoryRepo.getById(categoryId);
      if (cat && cat.project_id === projectId) {
        categoryName = cat.name;
      } else {
        catId = null;
      }
    }

    const { data, error } = await supabase
      .from('questions')
      .insert({
        project_id: projectId,
        text,
        category: categoryName,
        category_id: catId,
        sub_items: subItems.length ? subItems : null,
        sort_order: sortOrder,
      })
      .select()
      .single();
    if (error) throw error;
    return mapQuestionRow(data as Record<string, unknown>);
  },

  async update(
    questionId: number,
    projectId: number,
    payload: { text?: string; category_id?: number; sub_items?: string[] }
  ): Promise<Question | undefined> {
    const existing = await questionRepo.getById(questionId);
    if (!existing || existing.project_id !== projectId) return undefined;
    if (payload.text !== undefined && !payload.text.trim()) return undefined;

    const updates: Record<string, unknown> = {};
    if (payload.text !== undefined) updates.text = payload.text.trim();
    if (payload.sub_items !== undefined) {
      updates.sub_items = payload.sub_items.length ? payload.sub_items : null;
    }
    if (payload.category_id !== undefined) {
      const cat = await categoryRepo.getById(payload.category_id);
      if (!cat || cat.project_id !== projectId) return undefined;
      updates.category_id = payload.category_id;
      updates.category = cat.name;
    }

    const { error } = await supabase
      .from('questions')
      .update(updates)
      .eq('id', questionId);
    if (error) throw error;
    return questionRepo.getById(questionId);
  },

  async delete(questionId: number, projectId: number): Promise<boolean> {
    const existing = await questionRepo.getById(questionId);
    if (!existing || existing.project_id !== projectId) return false;
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (error) throw error;
    return true;
  },
};

// ============================================================
// interviewRepo
// ============================================================
export const interviewRepo = {
  async create(
    projectId: number,
    externalId: string,
    filename: string,
    durationSec?: number,
    participantName?: string,
    moduleType: 'propuesta' | 'exploratorio' = 'exploratorio',
    sourceType: 'audio' | 'pdf' | 'docx' | 'xlsx' = 'audio',
    meetingStage?: string | null
  ): Promise<number> {
    const { data, error } = await supabase
      .from('interviews')
      .insert({
        project_id: projectId,
        external_id: externalId,
        participant_name: participantName ?? '',
        filename,
        duration_sec: durationSec ?? null,
        status: 'uploaded',
        module_type: moduleType,
        source_type: sourceType,
        meeting_stage:
          moduleType === 'exploratorio'
            ? meetingStage?.trim() || 'Reunión #1 Exploratoria'
            : null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  },

  async updateParticipant(id: number, participantName: string): Promise<void> {
    const { error } = await supabase
      .from('interviews')
      .update({ participant_name: participantName })
      .eq('id', id);
    if (error) throw error;
  },

  async updateFields(
    id: number,
    fields: { participant_name?: string; contact?: string; interview_date?: string; meeting_stage?: string | null }
  ): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (fields.participant_name !== undefined) updates.participant_name = fields.participant_name;
    if (fields.contact !== undefined) updates.contact = fields.contact;
    if (fields.interview_date !== undefined) updates.interview_date = fields.interview_date || null;
    if (fields.meeting_stage !== undefined) updates.meeting_stage = fields.meeting_stage || null;
    if (Object.keys(updates).length === 0) return;
    const { error } = await supabase.from('interviews').update(updates).eq('id', id);
    if (error) throw error;
  },

  async updateStatus(
    id: number,
    status: InterviewStatus,
    errorMessage?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('interviews')
      .update({ status, error_message: errorMessage ?? null })
      .eq('id', id);
    if (error) throw error;
  },

  async updateAudioPath(id: number, audioStoragePath: string): Promise<void> {
    const { error } = await supabase
      .from('interviews')
      .update({ audio_storage_path: audioStoragePath })
      .eq('id', id);
    if (error) throw error;
  },

  async list(projectId?: number): Promise<Record<string, unknown>[]> {
    let query = supabase
      .from('interviews')
      .select('*, projects(name)')
      .order('created_at', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => ({
      ...row,
      project_name: (row.projects as { name: string } | null)?.name ?? '',
      projects: undefined,
    }));
  },

  async getById(id: number): Promise<Record<string, unknown> | undefined> {
    const { data, error } = await supabase
      .from('interviews')
      .select('*, projects(name)')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return undefined;
    return {
      ...data,
      project_name: (data.projects as { name: string } | null)?.name ?? '',
      projects: undefined,
    };
  },

  async getByExternalId(externalId: string): Promise<Record<string, unknown> | undefined> {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('external_id', externalId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ?? undefined;
  },
};

// ============================================================
// transcriptRepo
// ============================================================
export const transcriptRepo = {
  async save(
    interviewId: number,
    fullText: string,
    storagePath: string | null
  ): Promise<void> {
    const { error } = await supabase
      .from('transcripts')
      .upsert(
        { interview_id: interviewId, full_text: fullText, storage_path: storagePath },
        { onConflict: 'interview_id' }
      );
    if (error) throw error;
  },

  async getByInterviewId(
    interviewId: number
  ): Promise<{ full_text: string; storage_path: string | null } | null> {
    const { data, error } = await supabase
      .from('transcripts')
      .select('full_text, storage_path')
      .eq('interview_id', interviewId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  },
};

// ============================================================
// answerRepo
// ============================================================
export const answerRepo = {
  async saveFromMatch(
    interviewId: number,
    match: MatchResult,
    questions: Question[]
  ): Promise<void> {
    await supabase.from('interview_answers').delete().eq('interview_id', interviewId);

    const rows = match.preguntas.map((item) => {
      const normalized = item.pregunta.trim().toLowerCase();
      const q =
        questions.find((x) => x.text === item.pregunta) ??
        questions.find((x) => x.text.trim().toLowerCase() === normalized);
      return {
        interview_id: interviewId,
        question_id: q?.id ?? null,
        question_text: q?.text ?? item.pregunta ?? 'Pregunta sin texto',
        answer_text: item.respuesta || 'No mencionado',
        category: item.categoria ?? q?.category ?? 'general',
        sentiment: 'neutral',
        confidence: typeof item.confianza === 'number' ? item.confianza : 0.85,
      };
    });

    if (rows.length === 0) return;
    const { error } = await supabase.from('interview_answers').insert(rows);
    if (error) throw error;
  },

  async listByInterview(interviewId: number): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('interview_answers')
      .select('*')
      .eq('interview_id', interviewId);
    if (error) throw error;
    return data ?? [];
  },
};

// ============================================================
// insightsRepo
// ============================================================
export const insightsRepo = {
  async save(interviewId: number, payload: InsightsResult): Promise<void> {
    const { error } = await supabase
      .from('insights')
      .upsert(
        { interview_id: interviewId, json_payload: payload },
        { onConflict: 'interview_id' }
      );
    if (error) throw error;
  },

  async get(interviewId: number): Promise<InsightsResult | null> {
    const { data, error } = await supabase
      .from('insights')
      .select('json_payload')
      .eq('interview_id', interviewId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data?.json_payload as InsightsResult) ?? null;
  },
};

// ============================================================
// qcRepo — Control de Calidad (independiente de Whispper)
// ============================================================
function slugifyOrg(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `org-${Date.now()}`;
}

export const qcRepo = {
  async listRoles(): Promise<QcRole[]> {
    const { data, error } = await supabase
      .from('qc_roles')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []) as QcRole[];
  },

  async listPermissions(): Promise<QcPermission[]> {
    const { data, error } = await supabase.from('qc_permissions').select('*').order('key');
    if (error) throw error;
    return (data ?? []) as QcPermission[];
  },

  async listOrgsForUser(userId: string): Promise<QcOrganization[]> {
    const { data: memberships, error: mErr } = await supabase
      .from('qc_org_memberships')
      .select('org_id')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (mErr) throw mErr;
    const orgIds = (memberships ?? []).map((m) => m.org_id as string);
    if (orgIds.length === 0) return [];

    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, legal_name, status, settings, created_at')
      .in('id', orgIds)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      legal_name: (row.legal_name as string) ?? '',
      status: (row.status as QcOrgStatus) ?? 'active',
      settings: (row.settings as Record<string, unknown>) ?? {},
      created_at: row.created_at as string,
    }));
  },

  async createOrgWithAdmin(input: {
    name: string;
    slug?: string;
    legal_name?: string;
    userId: string;
  }): Promise<QcOrganization> {
    const baseSlug = slugifyOrg(input.slug || input.name);
    let slug = baseSlug;
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${i + 2}`;
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({
        name: input.name,
        slug,
        legal_name: input.legal_name ?? '',
        status: 'active',
        settings: {},
      })
      .select('id, name, slug, legal_name, status, settings, created_at')
      .single();
    if (error) throw error;

    const { error: memErr } = await supabase.from('qc_org_memberships').insert({
      org_id: org.id,
      user_id: input.userId,
      role_key: 'admin',
      status: 'active',
    });
    if (memErr) throw memErr;

    // Vincula perfil a la org sin tocar role de Whispper
    await supabase.from('profiles').update({ org_id: org.id }).eq('id', input.userId);

    return {
      id: org.id as string,
      name: org.name as string,
      slug: org.slug as string,
      legal_name: (org.legal_name as string) ?? '',
      status: (org.status as QcOrgStatus) ?? 'active',
      settings: (org.settings as Record<string, unknown>) ?? {},
      created_at: org.created_at as string,
    };
  },

  async updateOrg(
    orgId: string,
    patch: { name?: string; legal_name?: string; status?: QcOrgStatus },
  ): Promise<QcOrganization | undefined> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.legal_name !== undefined) payload.legal_name = patch.legal_name;
    if (patch.status !== undefined) payload.status = patch.status;
    if (Object.keys(payload).length === 0) {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, slug, legal_name, status, settings, created_at')
        .eq('id', orgId)
        .maybeSingle();
      if (!data) return undefined;
      return {
        id: data.id as string,
        name: data.name as string,
        slug: data.slug as string,
        legal_name: (data.legal_name as string) ?? '',
        status: (data.status as QcOrgStatus) ?? 'active',
        settings: (data.settings as Record<string, unknown>) ?? {},
        created_at: data.created_at as string,
      };
    }

    const { data, error } = await supabase
      .from('organizations')
      .update(payload)
      .eq('id', orgId)
      .select('id, name, slug, legal_name, status, settings, created_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return {
      id: data.id as string,
      name: data.name as string,
      slug: data.slug as string,
      legal_name: (data.legal_name as string) ?? '',
      status: (data.status as QcOrgStatus) ?? 'active',
      settings: (data.settings as Record<string, unknown>) ?? {},
      created_at: data.created_at as string,
    };
  },

  async isOrgMember(userId: string, orgId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('qc_org_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },

  async userHasPermission(userId: string, orgId: string, permission: string): Promise<boolean> {
    const { data: membership, error } = await supabase
      .from('qc_org_memberships')
      .select('role_key')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    if (!membership) return false;

    const { data: perm, error: pErr } = await supabase
      .from('qc_role_permissions')
      .select('permission_key')
      .eq('role_key', membership.role_key)
      .eq('permission_key', permission)
      .maybeSingle();
    if (pErr) throw pErr;
    return Boolean(perm);
  },

  async listMembers(orgId: string): Promise<QcOrgMembership[]> {
    const { data, error } = await supabase
      .from('qc_org_memberships')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const userIds = rows.map((r) => r.user_id as string);
    const profileMap = new Map<string, { full_name: string }>();
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id as string, { full_name: (p.full_name as string) ?? '' });
      }
    }

    const enriched: QcOrgMembership[] = [];
    for (const row of rows) {
      const userId = row.user_id as string;
      let email: string | null = null;
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        email = authUser.user?.email ?? null;
      } catch {
        email = null;
      }
      enriched.push({
        id: row.id as number,
        org_id: row.org_id as string,
        user_id: userId,
        role_key: row.role_key as string,
        status: row.status as QcMembershipStatus,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        user_email: email,
        user_full_name: profileMap.get(userId)?.full_name ?? null,
      });
    }
    return enriched;
  },

  async addMemberByEmail(
    orgId: string,
    email: string,
    roleKey: string,
  ): Promise<QcOrgMembership> {
    const normalized = email.trim().toLowerCase();
    const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw listErr;
    const found = (listed.users ?? []).find((u) => (u.email ?? '').toLowerCase() === normalized);
    if (!found) {
      throw new Error(`Usuario con email ${email} no encontrado en Auth`);
    }

    const { data, error } = await supabase
      .from('qc_org_memberships')
      .upsert(
        {
          org_id: orgId,
          user_id: found.id,
          role_key: roleKey,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,user_id' },
      )
      .select('*')
      .single();
    if (error) throw error;

    return {
      id: data.id as number,
      org_id: data.org_id as string,
      user_id: data.user_id as string,
      role_key: data.role_key as string,
      status: data.status as QcMembershipStatus,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      user_email: found.email ?? null,
      user_full_name: null,
    };
  },

  async updateMember(
    orgId: string,
    memberId: number,
    patch: { role_key?: string; status?: QcMembershipStatus },
  ): Promise<QcOrgMembership | undefined> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.role_key !== undefined) payload.role_key = patch.role_key;
    if (patch.status !== undefined) payload.status = patch.status;

    const { data, error } = await supabase
      .from('qc_org_memberships')
      .update(payload)
      .eq('id', memberId)
      .eq('org_id', orgId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return {
      id: data.id as number,
      org_id: data.org_id as string,
      user_id: data.user_id as string,
      role_key: data.role_key as string,
      status: data.status as QcMembershipStatus,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
    };
  },

  // ── Clientes ────────────────────────────────────────────────────────────

  mapClient(row: Record<string, unknown>): QcClient {
    return {
      id: row.id as number,
      org_id: row.org_id as string,
      name: row.name as string,
      code: (row.code as string) ?? '',
      status: (row.status as 'active' | 'inactive') ?? 'active',
      contact_name: (row.contact_name as string) ?? '',
      contact_email: (row.contact_email as string) ?? '',
      notes: (row.notes as string) ?? '',
      created_at: row.created_at as string,
      updated_at: row.updated_at as string | undefined,
    };
  },

  async listClients(orgId: string, opts?: { search?: string; status?: string }): Promise<QcClient[]> {
    let query = supabase
      .from('qc_clients')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (opts?.status) query = query.eq('status', opts.status);
    if (opts?.search?.trim()) {
      const term = `%${opts.search.trim().replace(/[%_,]/g, ' ')}%`;
      query = query.or(`name.ilike.${term},code.ilike.${term},contact_email.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => this.mapClient(row as Record<string, unknown>));
  },

  async createClient(
    orgId: string,
    input: {
      name: string;
      code?: string;
      status?: 'active' | 'inactive';
      contact_name?: string;
      contact_email?: string;
      notes?: string;
    },
  ): Promise<QcClient> {
    const { data, error } = await supabase
      .from('qc_clients')
      .insert({
        org_id: orgId,
        name: input.name,
        code: input.code ?? '',
        status: input.status ?? 'active',
        contact_name: input.contact_name ?? '',
        contact_email: input.contact_email ?? '',
        notes: input.notes ?? '',
      })
      .select('*')
      .single();
    if (error) throw error;
    return this.mapClient(data as Record<string, unknown>);
  },

  async updateClient(
    orgId: string,
    clientId: number,
    patch: Partial<{
      name: string;
      code: string;
      status: 'active' | 'inactive';
      contact_name: string;
      contact_email: string;
      notes: string;
    }>,
  ): Promise<QcClient | undefined> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.code !== undefined) payload.code = patch.code;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.contact_name !== undefined) payload.contact_name = patch.contact_name;
    if (patch.contact_email !== undefined) payload.contact_email = patch.contact_email;
    if (patch.notes !== undefined) payload.notes = patch.notes;

    const { data, error } = await supabase
      .from('qc_clients')
      .update(payload)
      .eq('id', clientId)
      .eq('org_id', orgId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return this.mapClient(data as Record<string, unknown>);
  },

  async deleteClient(orgId: string, clientId: number): Promise<boolean> {
    const { error, count } = await supabase
      .from('qc_clients')
      .delete({ count: 'exact' })
      .eq('id', clientId)
      .eq('org_id', orgId);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  // ── Proyectos QC ────────────────────────────────────────────────────────

  mapProject(row: Record<string, unknown>, clientName?: string | null): QcProject {
    return {
      id: row.id as number,
      org_id: row.org_id as string,
      client_id: (row.client_id as number | null) ?? null,
      name: row.name as string,
      code: (row.code as string) ?? '',
      description: (row.description as string) ?? '',
      status: (row.status as QcProjectStatus) ?? 'borrador',
      country: (row.country as string) ?? '',
      methodology: (row.methodology as string) ?? '',
      start_date: (row.start_date as string | null) ?? null,
      end_date: (row.end_date as string | null) ?? null,
      settings: (row.settings as Record<string, unknown>) ?? {},
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      client_name: clientName ?? null,
    };
  },

  async listProjects(
    orgId: string,
    opts?: { search?: string; status?: string; clientId?: number },
  ): Promise<QcProject[]> {
    let query = supabase
      .from('qc_projects')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });

    if (opts?.status) query = query.eq('status', opts.status);
    if (opts?.clientId) query = query.eq('client_id', opts.clientId);
    if (opts?.search?.trim()) {
      const term = `%${opts.search.trim().replace(/[%_,]/g, ' ')}%`;
      query = query.or(`name.ilike.${term},code.ilike.${term},country.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const clientIds = Array.from(
      new Set(rows.map((r) => r.client_id as number | null).filter((id): id is number => id != null)),
    );
    const clientNames = new Map<number, string>();
    if (clientIds.length) {
      const { data: clients } = await supabase
        .from('qc_clients')
        .select('id, name')
        .in('id', clientIds);
      for (const c of clients ?? []) {
        clientNames.set(c.id as number, c.name as string);
      }
    }

    return rows.map((row) => {
      const cid = row.client_id as number | null;
      return this.mapProject(row, cid != null ? clientNames.get(cid) ?? null : null);
    });
  },

  async getProject(orgId: string, projectId: number): Promise<QcProject | undefined> {
    const { data, error } = await supabase
      .from('qc_projects')
      .select('*')
      .eq('id', projectId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;

    let clientName: string | null = null;
    if (data.client_id) {
      const { data: client } = await supabase
        .from('qc_clients')
        .select('name')
        .eq('id', data.client_id)
        .maybeSingle();
      clientName = (client?.name as string) ?? null;
    }
    return this.mapProject(data as Record<string, unknown>, clientName);
  },

  async createProject(
    orgId: string,
    input: {
      name: string;
      code?: string;
      description?: string;
      status?: QcProjectStatus;
      client_id?: number | null;
      country?: string;
      methodology?: string;
      start_date?: string | null;
      end_date?: string | null;
    },
  ): Promise<QcProject> {
    if (input.client_id != null) {
      const { data: client } = await supabase
        .from('qc_clients')
        .select('id')
        .eq('id', input.client_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (!client) throw new Error('Cliente no pertenece a esta organización');
    }

    const { data, error } = await supabase
      .from('qc_projects')
      .insert({
        org_id: orgId,
        name: input.name,
        code: input.code ?? '',
        description: input.description ?? '',
        status: input.status ?? 'borrador',
        client_id: input.client_id ?? null,
        country: input.country ?? '',
        methodology: input.methodology ?? '',
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        settings: {},
      })
      .select('*')
      .single();
    if (error) throw error;
    return this.mapProject(data as Record<string, unknown>);
  },

  async updateProject(
    orgId: string,
    projectId: number,
    patch: Partial<{
      name: string;
      code: string;
      description: string;
      status: QcProjectStatus;
      client_id: number | null;
      country: string;
      methodology: string;
      start_date: string | null;
      end_date: string | null;
    }>,
  ): Promise<QcProject | undefined> {
    if (patch.client_id != null) {
      const { data: client } = await supabase
        .from('qc_clients')
        .select('id')
        .eq('id', patch.client_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (!client) throw new Error('Cliente no pertenece a esta organización');
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.code !== undefined) payload.code = patch.code;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.client_id !== undefined) payload.client_id = patch.client_id;
    if (patch.country !== undefined) payload.country = patch.country;
    if (patch.methodology !== undefined) payload.methodology = patch.methodology;
    if (patch.start_date !== undefined) payload.start_date = patch.start_date;
    if (patch.end_date !== undefined) payload.end_date = patch.end_date;

    const { data, error } = await supabase
      .from('qc_projects')
      .update(payload)
      .eq('id', projectId)
      .eq('org_id', orgId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return this.mapProject(data as Record<string, unknown>);
  },

  async deleteProject(orgId: string, projectId: number): Promise<boolean> {
    const { error, count } = await supabase
      .from('qc_projects')
      .delete({ count: 'exact' })
      .eq('id', projectId)
      .eq('org_id', orgId);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  // ── Encuestas / revisión (QC-3) ─────────────────────────────────────────

  mapSurvey(row: Record<string, unknown>, projectName?: string | null): QcSurvey {
    return {
      id: row.id as number,
      org_id: row.org_id as string,
      project_id: row.project_id as number,
      external_id: (row.external_id as string) ?? '',
      respondent_code: (row.respondent_code as string) ?? '',
      interviewer: (row.interviewer as string) ?? '',
      phone: (row.phone as string) ?? '',
      address: (row.address as string) ?? '',
      latitude: (row.latitude as number | null) ?? null,
      longitude: (row.longitude as number | null) ?? null,
      collected_at: (row.collected_at as string | null) ?? null,
      status: (row.status as QcSurveyStatus) ?? 'pendiente',
      current_stage: (row.current_stage as QcSurveyStage) ?? 'ubicacion',
      answers: (row.answers as Record<string, unknown>) ?? {},
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      project_name: projectName ?? null,
    };
  },

  mapReviewStage(row: Record<string, unknown>): QcReviewStage {
    return {
      id: row.id as number,
      org_id: row.org_id as string,
      survey_id: row.survey_id as number,
      stage_type: row.stage_type as QcReviewStageType,
      status: (row.status as QcReviewStageStatus) ?? 'pendiente',
      reviewer_id: (row.reviewer_id as string | null) ?? null,
      notes: (row.notes as string) ?? '',
      reviewed_at: (row.reviewed_at as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  },

  async listSurveys(
    orgId: string,
    opts?: { projectId?: number; status?: string; search?: string },
  ): Promise<QcSurvey[]> {
    let query = supabase
      .from('qc_surveys')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });

    if (opts?.projectId) query = query.eq('project_id', opts.projectId);
    if (opts?.status) query = query.eq('status', opts.status);
    if (opts?.search?.trim()) {
      const term = `%${opts.search.trim().replace(/[%_,]/g, ' ')}%`;
      query = query.or(
        `external_id.ilike.${term},respondent_code.ilike.${term},interviewer.ilike.${term},phone.ilike.${term}`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;

    const projectIds = Array.from(new Set(rows.map((r) => r.project_id as number)));
    const names = new Map<number, string>();
    if (projectIds.length) {
      const { data: projects } = await supabase
        .from('qc_projects')
        .select('id, name')
        .in('id', projectIds);
      for (const p of projects ?? []) names.set(p.id as number, p.name as string);
    }

    return rows.map((row) =>
      this.mapSurvey(row, names.get(row.project_id as number) ?? null),
    );
  },

  async getSurvey(orgId: string, surveyId: number): Promise<QcSurvey | undefined> {
    const { data, error } = await supabase
      .from('qc_surveys')
      .select('*')
      .eq('id', surveyId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;

    let projectName: string | null = null;
    const { data: project } = await supabase
      .from('qc_projects')
      .select('name')
      .eq('id', data.project_id)
      .maybeSingle();
    projectName = (project?.name as string) ?? null;

    const { data: stages, error: sErr } = await supabase
      .from('qc_review_stages')
      .select('*')
      .eq('survey_id', surveyId)
      .order('id', { ascending: true });
    if (sErr) throw sErr;

    const survey = this.mapSurvey(data as Record<string, unknown>, projectName);
    survey.stages = (stages ?? []).map((s) => this.mapReviewStage(s as Record<string, unknown>));
    return survey;
  },

  async createSurvey(
    orgId: string,
    input: {
      project_id: number;
      external_id?: string;
      respondent_code?: string;
      interviewer?: string;
      phone?: string;
      address?: string;
      latitude?: number | null;
      longitude?: number | null;
      collected_at?: string | null;
      answers?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<QcSurvey> {
    const { data: project } = await supabase
      .from('qc_projects')
      .select('id, name')
      .eq('id', input.project_id)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!project) throw new Error('Proyecto QC no pertenece a esta organización');

    const { data, error } = await supabase
      .from('qc_surveys')
      .insert({
        org_id: orgId,
        project_id: input.project_id,
        external_id: input.external_id ?? '',
        respondent_code: input.respondent_code ?? '',
        interviewer: input.interviewer ?? '',
        phone: input.phone ?? '',
        address: input.address ?? '',
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        collected_at: input.collected_at ?? null,
        status: 'pendiente',
        current_stage: 'ubicacion',
        answers: input.answers ?? {},
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;

    const stageTypes: QcReviewStageType[] = ['ubicacion', 'contenido', 'telefono'];
    const { error: stErr } = await supabase.from('qc_review_stages').insert(
      stageTypes.map((stage_type) => ({
        org_id: orgId,
        survey_id: data.id,
        stage_type,
        status: 'pendiente',
      })),
    );
    if (stErr) throw stErr;

    const created = await this.getSurvey(orgId, data.id as number);
    if (!created) throw new Error('Encuesta creada pero no se pudo releer');
    await this.writeAudit({
      orgId,
      action: 'survey.create',
      entityType: 'qc_survey',
      entityId: String(created.id),
      surveyId: created.id,
      projectId: created.project_id,
      detail: created.external_id || created.respondent_code || `#${created.id}`,
    });
    return created;
  },

  async updateSurvey(
    orgId: string,
    surveyId: number,
    patch: Partial<{
      external_id: string;
      respondent_code: string;
      interviewer: string;
      phone: string;
      address: string;
      latitude: number | null;
      longitude: number | null;
      collected_at: string | null;
      answers: Record<string, unknown>;
      metadata: Record<string, unknown>;
      status: QcSurveyStatus;
    }>,
  ): Promise<QcSurvey | undefined> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'external_id',
      'respondent_code',
      'interviewer',
      'phone',
      'address',
      'latitude',
      'longitude',
      'collected_at',
      'answers',
      'metadata',
      'status',
    ] as const) {
      if (patch[key] !== undefined) payload[key] = patch[key];
    }

    const { data, error } = await supabase
      .from('qc_surveys')
      .update(payload)
      .eq('id', surveyId)
      .eq('org_id', orgId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return this.getSurvey(orgId, surveyId);
  },

  async deleteSurvey(orgId: string, surveyId: number): Promise<boolean> {
    const { error, count } = await supabase
      .from('qc_surveys')
      .delete({ count: 'exact' })
      .eq('id', surveyId)
      .eq('org_id', orgId);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  computeSurveyProgress(stages: QcReviewStage[]): {
    status: QcSurveyStatus;
    current_stage: QcSurveyStage;
  } {
    const order: QcReviewStageType[] = ['ubicacion', 'contenido', 'telefono'];
    const byType = new Map(stages.map((s) => [s.stage_type, s]));

    if (stages.some((s) => s.status === 'rechazada')) {
      const rejected = order.find((t) => byType.get(t)?.status === 'rechazada') ?? 'ubicacion';
      return { status: 'rechazada', current_stage: rejected };
    }

    const nextPending = order.find((t) => {
      const s = byType.get(t);
      return !s || s.status === 'pendiente' || s.status === 'observacion';
    });

    if (!nextPending) {
      return { status: 'aprobada', current_stage: 'completada' };
    }

    const anyDone = stages.some((s) => s.status === 'aprobada' || s.status === 'observacion');
    return {
      status: anyDone ? 'en_revision' : 'pendiente',
      current_stage: nextPending,
    };
  },

  async submitReview(
    orgId: string,
    surveyId: number,
    stageType: QcReviewStageType,
    input: {
      status: Exclude<QcReviewStageStatus, 'pendiente'>;
      notes?: string;
      reviewerId: string;
      skipWebhooks?: boolean;
    },
  ): Promise<QcSurvey> {
    const survey = await this.getSurvey(orgId, surveyId);
    if (!survey) throw new Error('Encuesta no encontrada');

    const { data: stage, error } = await supabase
      .from('qc_review_stages')
      .update({
        status: input.status,
        notes: input.notes ?? '',
        reviewer_id: input.reviewerId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('survey_id', surveyId)
      .eq('org_id', orgId)
      .eq('stage_type', stageType)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!stage) throw new Error('Etapa de revisión no encontrada');

    await supabase.from('qc_review_events').insert({
      org_id: orgId,
      survey_id: surveyId,
      stage_type: stageType,
      action: input.status,
      actor_id: input.reviewerId,
      detail: input.notes ?? '',
    });

    const { data: allStages, error: listErr } = await supabase
      .from('qc_review_stages')
      .select('*')
      .eq('survey_id', surveyId);
    if (listErr) throw listErr;

    const mapped = (allStages ?? []).map((s) => this.mapReviewStage(s as Record<string, unknown>));
    const progress = this.computeSurveyProgress(mapped);

    await supabase
      .from('qc_surveys')
      .update({
        status: progress.status,
        current_stage: progress.current_stage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', surveyId)
      .eq('org_id', orgId);

    const updated = await this.getSurvey(orgId, surveyId);
    if (!updated) throw new Error('Encuesta no encontrada tras revisión');
    await this.writeAudit({
      orgId,
      actorId: input.reviewerId,
      action: `review.${input.status}`,
      entityType: 'qc_review_stage',
      entityId: stageType,
      surveyId,
      projectId: updated.project_id,
      detail: input.notes ?? '',
      metadata: { stage_type: stageType, status: input.status },
    });

    if (!input.skipWebhooks) {
      if (input.status === 'rechazada') {
        void this.dispatchWebhooks(orgId, 'survey.rejected', {
          survey_id: surveyId,
          project_id: updated.project_id,
          stage_type: stageType,
          source: 'manual',
        });
      } else if (input.status === 'observacion') {
        void this.dispatchWebhooks(orgId, 'survey.observation', {
          survey_id: surveyId,
          project_id: updated.project_id,
          stage_type: stageType,
          source: 'manual',
        });
      }
    }

    return updated;
  },

  async listReviewEvents(orgId: string, surveyId: number): Promise<QcReviewEvent[]> {
    const { data, error } = await supabase
      .from('qc_review_events')
      .select('*')
      .eq('org_id', orgId)
      .eq('survey_id', surveyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as number,
      org_id: row.org_id as string,
      survey_id: row.survey_id as number,
      stage_type: row.stage_type as string,
      action: row.action as string,
      actor_id: (row.actor_id as string | null) ?? null,
      detail: (row.detail as string) ?? '',
      created_at: row.created_at as string,
    }));
  },

  // ── Reglas (QC-4) ───────────────────────────────────────────────────────

  mapRule(row: Record<string, unknown>, projectName?: string | null): QcRule {
    return {
      id: row.id as number,
      org_id: row.org_id as string,
      project_id: (row.project_id as number | null) ?? null,
      name: row.name as string,
      description: (row.description as string) ?? '',
      stage_type: (row.stage_type as QcRuleStageType) ?? 'any',
      field_key: row.field_key as string,
      operator: row.operator as QcRuleOperator,
      value_text: (row.value_text as string) ?? '',
      severity: (row.severity as QcRuleSeverity) ?? 'warning',
      action: (row.action as QcRuleAction) ?? 'flag',
      enabled: Boolean(row.enabled),
      sort_order: (row.sort_order as number) ?? 0,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      project_name: projectName ?? null,
    };
  },

  async listRules(
    orgId: string,
    opts?: { projectId?: number | null; enabledOnly?: boolean },
  ): Promise<QcRule[]> {
    let query = supabase
      .from('qc_rules')
      .select('*')
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (opts?.enabledOnly) query = query.eq('enabled', true);
    if (opts?.projectId === null) {
      query = query.is('project_id', null);
    } else if (typeof opts?.projectId === 'number') {
      // Reglas del proyecto + globales de la org
      query = query.or(`project_id.eq.${opts.projectId},project_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;

    const projectIds = Array.from(
      new Set(rows.map((r) => r.project_id as number | null).filter((id): id is number => id != null)),
    );
    const names = new Map<number, string>();
    if (projectIds.length) {
      const { data: projects } = await supabase
        .from('qc_projects')
        .select('id, name')
        .in('id', projectIds);
      for (const p of projects ?? []) names.set(p.id as number, p.name as string);
    }

    return rows.map((row) => {
      const pid = row.project_id as number | null;
      return this.mapRule(row, pid != null ? names.get(pid) ?? null : 'Global org');
    });
  },

  async createRule(
    orgId: string,
    input: {
      name: string;
      description?: string;
      project_id?: number | null;
      stage_type?: QcRuleStageType;
      field_key: string;
      operator: QcRuleOperator;
      value_text?: string;
      severity?: QcRuleSeverity;
      action?: QcRuleAction;
      enabled?: boolean;
      sort_order?: number;
    },
  ): Promise<QcRule> {
    if (input.project_id != null) {
      const { data: project } = await supabase
        .from('qc_projects')
        .select('id')
        .eq('id', input.project_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (!project) throw new Error('Proyecto QC no pertenece a esta organización');
    }

    const { data, error } = await supabase
      .from('qc_rules')
      .insert({
        org_id: orgId,
        project_id: input.project_id ?? null,
        name: input.name,
        description: input.description ?? '',
        stage_type: input.stage_type ?? 'any',
        field_key: input.field_key,
        operator: input.operator,
        value_text: input.value_text ?? '',
        severity: input.severity ?? 'warning',
        action: input.action ?? 'flag',
        enabled: input.enabled ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .select('*')
      .single();
    if (error) throw error;
    return this.mapRule(data as Record<string, unknown>);
  },

  async updateRule(
    orgId: string,
    ruleId: number,
    patch: Partial<{
      name: string;
      description: string;
      project_id: number | null;
      stage_type: QcRuleStageType;
      field_key: string;
      operator: QcRuleOperator;
      value_text: string;
      severity: QcRuleSeverity;
      action: QcRuleAction;
      enabled: boolean;
      sort_order: number;
    }>,
  ): Promise<QcRule | undefined> {
    if (patch.project_id != null) {
      const { data: project } = await supabase
        .from('qc_projects')
        .select('id')
        .eq('id', patch.project_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (!project) throw new Error('Proyecto QC no pertenece a esta organización');
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of [
      'name',
      'description',
      'project_id',
      'stage_type',
      'field_key',
      'operator',
      'value_text',
      'severity',
      'action',
      'enabled',
      'sort_order',
    ] as const) {
      if (patch[key] !== undefined) payload[key] = patch[key];
    }

    const { data, error } = await supabase
      .from('qc_rules')
      .update(payload)
      .eq('id', ruleId)
      .eq('org_id', orgId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return this.mapRule(data as Record<string, unknown>);
  },

  async deleteRule(orgId: string, ruleId: number): Promise<boolean> {
    const { error, count } = await supabase
      .from('qc_rules')
      .delete({ count: 'exact' })
      .eq('id', ruleId)
      .eq('org_id', orgId);
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async evaluateSurveyRules(
    orgId: string,
    surveyId: number,
    opts?: { apply?: boolean; actorId?: string | null },
  ): Promise<QcRuleEvaluation> {
    const survey = await this.getSurvey(orgId, surveyId);
    if (!survey) throw new Error('Encuesta no encontrada');

    const rules = await this.listRules(orgId, {
      projectId: survey.project_id,
      enabledOnly: true,
    });
    const hits = evaluateQcRules(rules, survey);
    const base: QcRuleEvaluation = {
      survey_id: surveyId,
      hits,
      has_block: hits.some((h) => h.severity === 'block'),
      has_error: hits.some((h) => h.severity === 'error' || h.severity === 'block'),
      applied_actions: [],
      survey,
    };

    if (!opts?.apply) return base;

    // No auto-aplicar si ya está cerrada
    if (survey.status === 'aprobada' || survey.status === 'rechazada') {
      return {
        ...base,
        applied_actions: [],
      };
    }

    const applied = await this.applyRuleHits(orgId, survey, hits, opts.actorId ?? null);
    const refreshed = await this.getSurvey(orgId, surveyId);

    if (applied.some((a) => !a.skipped)) {
      await this.dispatchWebhooks(orgId, 'rules.applied', {
        survey_id: surveyId,
        project_id: survey.project_id,
        hits: hits.map((h) => ({
          rule_id: h.rule_id,
          action: h.action,
          severity: h.severity,
          message: h.message,
        })),
        applied_actions: applied.filter((a) => !a.skipped),
      });

      if (applied.some((a) => !a.skipped && a.status === 'rechazada')) {
        await this.dispatchWebhooks(orgId, 'survey.rejected', {
          survey_id: surveyId,
          project_id: survey.project_id,
          source: 'rules.auto',
          applied_actions: applied.filter((a) => a.status === 'rechazada' && !a.skipped),
        });
      }
      if (applied.some((a) => !a.skipped && a.status === 'observacion')) {
        await this.dispatchWebhooks(orgId, 'survey.observation', {
          survey_id: surveyId,
          project_id: survey.project_id,
          source: 'rules.auto',
          applied_actions: applied.filter((a) => a.status === 'observacion' && !a.skipped),
        });
      }
    }

    return {
      ...base,
      applied_actions: applied,
      survey: refreshed ?? survey,
      has_block: hits.some((h) => h.severity === 'block'),
      has_error: hits.some((h) => h.severity === 'error' || h.severity === 'block'),
    };
  },

  /**
   * QC-9: convierte hits auto_* en submitReview por etapa.
   * Prioridad: auto_rechazar > auto_observacion. flag no aplica.
   */
  async applyRuleHits(
    orgId: string,
    survey: QcSurvey,
    hits: QcRuleHit[],
    actorId: string | null,
  ): Promise<QcRuleAppliedAction[]> {
    type Planned = {
      status: 'rechazada' | 'observacion';
      notes: string[];
      rule_id: number;
      rule_name: string;
      action: QcRuleAction;
    };
    const byStage = new Map<QcReviewStageType, Planned>();

    const resolveStage = (hit: QcRuleHit): QcReviewStageType => {
      if (hit.stage_type === 'ubicacion' || hit.stage_type === 'contenido' || hit.stage_type === 'telefono') {
        return hit.stage_type;
      }
      if (
        survey.current_stage === 'ubicacion' ||
        survey.current_stage === 'contenido' ||
        survey.current_stage === 'telefono'
      ) {
        return survey.current_stage;
      }
      return 'ubicacion';
    };

    for (const hit of hits) {
      if (hit.action !== 'auto_rechazar' && hit.action !== 'auto_observacion') continue;
      const stage = resolveStage(hit);
      const nextStatus: 'rechazada' | 'observacion' =
        hit.action === 'auto_rechazar' ? 'rechazada' : 'observacion';
      const existing = byStage.get(stage);
      if (!existing) {
        byStage.set(stage, {
          status: nextStatus,
          notes: [hit.message],
          rule_id: hit.rule_id,
          rule_name: hit.rule_name,
          action: hit.action,
        });
        continue;
      }
      // rechazar gana
      if (existing.status !== 'rechazada' && nextStatus === 'rechazada') {
        existing.status = 'rechazada';
        existing.action = 'auto_rechazar';
        existing.rule_id = hit.rule_id;
        existing.rule_name = hit.rule_name;
      }
      existing.notes.push(hit.message);
    }

    const applied: QcRuleAppliedAction[] = [];
    let stages = [...(survey.stages ?? [])];

    for (const [stageType, plan] of byStage) {
      const stage = stages.find((s) => s.stage_type === stageType);
      if (!stage) {
        applied.push({
          rule_id: plan.rule_id,
          rule_name: plan.rule_name,
          action: plan.action,
          stage_type: stageType,
          status: plan.status,
          skipped: true,
          reason: 'Etapa no encontrada',
        });
        continue;
      }
      if (stage.status === 'aprobada' || stage.status === 'rechazada') {
        applied.push({
          rule_id: plan.rule_id,
          rule_name: plan.rule_name,
          action: plan.action,
          stage_type: stageType,
          status: plan.status,
          skipped: true,
          reason: `Etapa ya ${stage.status}`,
        });
        continue;
      }
      if (stage.status === plan.status) {
        applied.push({
          rule_id: plan.rule_id,
          rule_name: plan.rule_name,
          action: plan.action,
          stage_type: stageType,
          status: plan.status,
          skipped: true,
          reason: 'Ya aplicado',
        });
        continue;
      }

      if (!actorId) {
        applied.push({
          rule_id: plan.rule_id,
          rule_name: plan.rule_name,
          action: plan.action,
          stage_type: stageType,
          status: plan.status,
          skipped: true,
          reason: 'Sin actor para registrar revisión automática',
        });
        continue;
      }

      const notes = `[auto] ${plan.notes.join(' · ')}`.slice(0, 2000);
      const updatedSurvey = await this.submitReview(orgId, survey.id, stageType, {
        status: plan.status,
        notes,
        reviewerId: actorId,
        skipWebhooks: true,
      });
      stages = updatedSurvey.stages ?? stages;
      applied.push({
        rule_id: plan.rule_id,
        rule_name: plan.rule_name,
        action: plan.action,
        stage_type: stageType,
        status: plan.status,
      });
    }

    await this.writeAudit({
      orgId,
      actorId,
      action: 'rules.apply',
      entityType: 'qc_survey',
      entityId: String(survey.id),
      surveyId: survey.id,
      projectId: survey.project_id,
      detail: `Aplicadas ${applied.filter((a) => !a.skipped).length} acciones auto`,
      metadata: { applied },
    });

    return applied;
  },

  async seedDefaultRules(orgId: string, projectId?: number | null): Promise<QcRule[]> {
    const existing = await this.listRules(orgId, {
      projectId: projectId === undefined ? undefined : projectId ?? null,
    });
    if (existing.length > 0) return existing;

    const defaults: Array<{
      name: string;
      description: string;
      stage_type: QcRuleStageType;
      field_key: string;
      operator: QcRuleOperator;
      severity: QcRuleSeverity;
      action: QcRuleAction;
      sort_order: number;
    }> = [
      {
        name: 'GPS obligatorio',
        description: 'La encuesta debe tener latitud y longitud.',
        stage_type: 'ubicacion',
        field_key: 'latitude',
        operator: 'coords_present',
        severity: 'block',
        action: 'auto_rechazar',
        sort_order: 10,
      },
      {
        name: 'Dirección requerida',
        description: 'Debe registrarse una dirección o referencia de ubicación.',
        stage_type: 'ubicacion',
        field_key: 'address',
        operator: 'required',
        severity: 'error',
        action: 'auto_observacion',
        sort_order: 20,
      },
      {
        name: 'Teléfono requerido',
        description: 'Debe existir un teléfono para validación.',
        stage_type: 'telefono',
        field_key: 'phone',
        operator: 'required',
        severity: 'error',
        action: 'flag',
        sort_order: 30,
      },
      {
        name: 'Entrevistador requerido',
        description: 'Toda encuesta debe tener entrevistador asignado.',
        stage_type: 'contenido',
        field_key: 'interviewer',
        operator: 'required',
        severity: 'warning',
        action: 'flag',
        sort_order: 40,
      },
    ];

    const created: QcRule[] = [];
    for (const d of defaults) {
      created.push(
        await this.createRule(orgId, {
          ...d,
          project_id: projectId ?? null,
        }),
      );
    }
    return created;
  },

  // ── Evidencias / auditoría (QC-5) ───────────────────────────────────────

  async writeAudit(input: {
    orgId: string;
    actorId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    surveyId?: number | null;
    projectId?: number | null;
    detail?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await supabase.from('qc_audit_logs').insert({
      org_id: input.orgId,
      actor_id: input.actorId ?? null,
      action: input.action,
      entity_type: input.entityType ?? 'qc',
      entity_id: input.entityId ?? '',
      survey_id: input.surveyId ?? null,
      project_id: input.projectId ?? null,
      detail: input.detail ?? '',
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.warn('[qc.audit]', error.message);
    }
  },

  mapEvidence(row: Record<string, unknown>): QcEvidence {
    return {
      id: row.id as number,
      org_id: row.org_id as string,
      survey_id: row.survey_id as number,
      stage_type: (row.stage_type as QcEvidence['stage_type']) ?? null,
      evidence_type: (row.evidence_type as QcEvidenceType) ?? 'link',
      title: (row.title as string) ?? '',
      url: (row.url as string) ?? '',
      notes: (row.notes as string) ?? '',
      storage_path: (row.storage_path as string) ?? '',
      file_name: (row.file_name as string) ?? '',
      mime_type: (row.mime_type as string) ?? '',
      file_size: (row.file_size as number | null) ?? null,
      uploaded_by: (row.uploaded_by as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  },

  async listEvidences(orgId: string, surveyId: number): Promise<QcEvidence[]> {
    const { data, error } = await supabase
      .from('qc_evidences')
      .select('*')
      .eq('org_id', orgId)
      .eq('survey_id', surveyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []).map((row) => this.mapEvidence(row as Record<string, unknown>));
    // Firmar URLs de archivos en Storage
    for (const ev of rows) {
      if (ev.storage_path) {
        const signed = await createQcEvidenceSignedUrl(ev.storage_path);
        if (signed) ev.url = signed;
      }
    }
    return rows;
  },

  async createEvidence(
    orgId: string,
    surveyId: number,
    input: {
      evidence_type: QcEvidenceType;
      title?: string;
      url?: string;
      notes?: string;
      stage_type?: 'ubicacion' | 'contenido' | 'telefono' | null;
      uploadedBy?: string | null;
      storage_path?: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number | null;
    },
  ): Promise<QcEvidence> {
    const survey = await this.getSurvey(orgId, surveyId);
    if (!survey) throw new Error('Encuesta no encontrada');

    const { data, error } = await supabase
      .from('qc_evidences')
      .insert({
        org_id: orgId,
        survey_id: surveyId,
        evidence_type: input.evidence_type,
        title: input.title ?? '',
        url: input.url ?? '',
        notes: input.notes ?? '',
        stage_type: input.stage_type ?? null,
        uploaded_by: input.uploadedBy ?? null,
        storage_path: input.storage_path ?? '',
        file_name: input.file_name ?? '',
        mime_type: input.mime_type ?? '',
        file_size: input.file_size ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;

    await this.writeAudit({
      orgId,
      actorId: input.uploadedBy,
      action: 'evidence.create',
      entityType: 'qc_evidence',
      entityId: String(data.id),
      surveyId,
      projectId: survey.project_id,
      detail: input.title || input.file_name || input.evidence_type,
      metadata: {
        storage_path: input.storage_path ?? '',
        file_size: input.file_size ?? null,
      },
    });

    const mapped = this.mapEvidence(data as Record<string, unknown>);
    if (mapped.storage_path) {
      const signed = await createQcEvidenceSignedUrl(mapped.storage_path);
      if (signed) mapped.url = signed;
    }
    return mapped;
  },

  async uploadEvidenceFile(
    orgId: string,
    surveyId: number,
    input: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      title?: string;
      notes?: string;
      stage_type?: 'ubicacion' | 'contenido' | 'telefono' | null;
      evidence_type?: QcEvidenceType;
      uploadedBy?: string | null;
    },
  ): Promise<QcEvidence> {
    const uploaded = await uploadQcEvidenceFile({
      orgId,
      surveyId,
      buffer: input.buffer,
      originalName: input.originalName,
      mimeType: input.mimeType,
    });

    const evidence_type =
      input.evidence_type && input.evidence_type !== 'link' && input.evidence_type !== 'note'
        ? input.evidence_type
        : guessEvidenceType(uploaded.mime_type, 'document');

    return this.createEvidence(orgId, surveyId, {
      evidence_type,
      title: input.title || uploaded.file_name,
      url: uploaded.public_or_signed_url,
      notes: input.notes ?? '',
      stage_type: input.stage_type ?? null,
      uploadedBy: input.uploadedBy,
      storage_path: uploaded.storage_path,
      file_name: uploaded.file_name,
      mime_type: uploaded.mime_type,
      file_size: uploaded.file_size,
    });
  },

  async deleteEvidence(
    orgId: string,
    evidenceId: number,
    actorId?: string | null,
  ): Promise<boolean> {
    const { data: existing } = await supabase
      .from('qc_evidences')
      .select('id, survey_id, title, storage_path')
      .eq('id', evidenceId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!existing) return false;

    const { error, count } = await supabase
      .from('qc_evidences')
      .delete({ count: 'exact' })
      .eq('id', evidenceId)
      .eq('org_id', orgId);
    if (error) throw error;

    await deleteQcEvidenceFile((existing.storage_path as string) || '');

    await this.writeAudit({
      orgId,
      actorId,
      action: 'evidence.delete',
      entityType: 'qc_evidence',
      entityId: String(evidenceId),
      surveyId: existing.survey_id as number,
      detail: (existing.title as string) || String(evidenceId),
    });

    return (count ?? 0) > 0;
  },

  async listAuditLogs(
    orgId: string,
    opts?: { limit?: number; surveyId?: number; action?: string },
  ): Promise<QcAuditLog[]> {
    let query = supabase
      .from('qc_audit_logs')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 100);

    if (opts?.surveyId) query = query.eq('survey_id', opts.surveyId);
    if (opts?.action?.trim()) query = query.ilike('action', `%${opts.action.trim()}%`);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const enriched: QcAuditLog[] = [];
    for (const row of rows) {
      let email: string | null = null;
      const actorId = row.actor_id as string | null;
      if (actorId) {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(actorId);
          email = authUser.user?.email ?? null;
        } catch {
          email = null;
        }
      }
      enriched.push({
        id: row.id as number,
        org_id: row.org_id as string,
        actor_id: actorId,
        action: row.action as string,
        entity_type: (row.entity_type as string) ?? 'qc',
        entity_id: (row.entity_id as string) ?? '',
        survey_id: (row.survey_id as number | null) ?? null,
        project_id: (row.project_id as number | null) ?? null,
        detail: (row.detail as string) ?? '',
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        created_at: row.created_at as string,
        actor_email: email,
      });
    }
    return enriched;
  },

  // ── Integraciones (QC-6) ────────────────────────────────────────────────

  mapIntegration(row: Record<string, unknown>, projectName?: string | null): QcIntegration {
    return {
      id: row.id as number,
      org_id: row.org_id as string,
      project_id: (row.project_id as number | null) ?? null,
      provider: row.provider as QcIntegrationProvider,
      name: row.name as string,
      status: (row.status as QcIntegrationStatus) ?? 'inactive',
      config: (row.config as Record<string, unknown>) ?? {},
      last_sync_at: (row.last_sync_at as string | null) ?? null,
      last_sync_status: (row.last_sync_status as QcIntegrationRunStatus | null) ?? null,
      last_sync_message: (row.last_sync_message as string) ?? '',
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      project_name: projectName ?? null,
    };
  },

  async listIntegrations(orgId: string): Promise<QcIntegration[]> {
    const { data, error } = await supabase
      .from('qc_integrations')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const projectIds = Array.from(
      new Set(rows.map((r) => r.project_id as number | null).filter((id): id is number => id != null)),
    );
    const names = new Map<number, string>();
    if (projectIds.length) {
      const { data: projects } = await supabase
        .from('qc_projects')
        .select('id, name')
        .in('id', projectIds);
      for (const p of projects ?? []) names.set(p.id as number, p.name as string);
    }
    return rows.map((row) => {
      const pid = row.project_id as number | null;
      return this.mapIntegration(row, pid != null ? names.get(pid) ?? null : null);
    });
  },

  async getIntegration(orgId: string, id: number): Promise<QcIntegration | undefined> {
    const { data, error } = await supabase
      .from('qc_integrations')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return this.mapIntegration(data as Record<string, unknown>);
  },

  async createIntegration(
    orgId: string,
    input: {
      name: string;
      provider: QcIntegrationProvider;
      project_id?: number | null;
      status?: QcIntegrationStatus;
      config?: Record<string, unknown>;
      actorId?: string | null;
    },
  ): Promise<QcIntegration> {
    if (input.project_id != null) {
      const { data: project } = await supabase
        .from('qc_projects')
        .select('id')
        .eq('id', input.project_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (!project) throw new Error('Proyecto QC no pertenece a esta organización');
    }

    const { data, error } = await supabase
      .from('qc_integrations')
      .insert({
        org_id: orgId,
        name: input.name,
        provider: input.provider,
        project_id: input.project_id ?? null,
        status: input.status ?? 'inactive',
        config: input.config ?? {},
      })
      .select('*')
      .single();
    if (error) throw error;

    await this.writeAudit({
      orgId,
      actorId: input.actorId,
      action: 'integration.create',
      entityType: 'qc_integration',
      entityId: String(data.id),
      projectId: input.project_id ?? null,
      detail: `${input.provider}: ${input.name}`,
    });

    return this.mapIntegration(data as Record<string, unknown>);
  },

  async updateIntegration(
    orgId: string,
    id: number,
    patch: Partial<{
      name: string;
      project_id: number | null;
      status: QcIntegrationStatus;
      config: Record<string, unknown>;
    }>,
    actorId?: string | null,
  ): Promise<QcIntegration | undefined> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.project_id !== undefined) payload.project_id = patch.project_id;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.config !== undefined) payload.config = patch.config;

    const { data, error } = await supabase
      .from('qc_integrations')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;

    await this.writeAudit({
      orgId,
      actorId,
      action: 'integration.update',
      entityType: 'qc_integration',
      entityId: String(id),
      detail: patch.name || String(id),
    });

    return this.mapIntegration(data as Record<string, unknown>);
  },

  async deleteIntegration(orgId: string, id: number, actorId?: string | null): Promise<boolean> {
    const { error, count } = await supabase
      .from('qc_integrations')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('org_id', orgId);
    if (error) throw error;
    if ((count ?? 0) > 0) {
      await this.writeAudit({
        orgId,
        actorId,
        action: 'integration.delete',
        entityType: 'qc_integration',
        entityId: String(id),
      });
    }
    return (count ?? 0) > 0;
  },

  async listIntegrationRuns(orgId: string, integrationId: number): Promise<QcIntegrationRun[]> {
    const { data, error } = await supabase
      .from('qc_integration_runs')
      .select('*')
      .eq('org_id', orgId)
      .eq('integration_id', integrationId)
      .order('started_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as number,
      org_id: row.org_id as string,
      integration_id: row.integration_id as number,
      status: row.status as QcIntegrationRunStatus,
      imported_count: (row.imported_count as number) ?? 0,
      skipped_count: (row.skipped_count as number) ?? 0,
      error_count: (row.error_count as number) ?? 0,
      message: (row.message as string) ?? '',
      result_payload: (row.result_payload as Record<string, unknown>) ?? {},
      started_at: row.started_at as string,
      finished_at: row.finished_at as string,
    }));
  },

  /**
   * QC-8: crea o actualiza encuesta por org + external_id.
   * No resetea status/etapas si ya existe (solo datos de campo).
   * Encuestas aprobadas/rechazadas se omiten (skipped).
   */
  async upsertSurveyFromImport(
    orgId: string,
    projectId: number,
    row: QcImportRow,
    meta: { integration_id: number; provider: string },
  ): Promise<{ outcome: 'created' | 'updated' | 'skipped'; surveyId: number | null }> {
    const { data: existing, error: findErr } = await supabase
      .from('qc_surveys')
      .select('id, status, answers, metadata')
      .eq('org_id', orgId)
      .eq('external_id', row.external_id)
      .maybeSingle();
    if (findErr) throw findErr;

    const importMeta = {
      source: meta.provider,
      integration_id: meta.integration_id,
      imported_at: new Date().toISOString(),
    };

    if (existing) {
      const status = existing.status as string;
      if (status === 'aprobada' || status === 'rechazada') {
        return { outcome: 'skipped', surveyId: existing.id as number };
      }
      const prevAnswers =
        existing.answers && typeof existing.answers === 'object'
          ? (existing.answers as Record<string, unknown>)
          : {};
      const prevMeta =
        existing.metadata && typeof existing.metadata === 'object'
          ? (existing.metadata as Record<string, unknown>)
          : {};

      const patch: Record<string, unknown> = {
        answers: { ...prevAnswers, ...row.answers },
        metadata: { ...prevMeta, ...importMeta },
        updated_at: new Date().toISOString(),
      };
      if (row.respondent_code) patch.respondent_code = row.respondent_code;
      if (row.interviewer) patch.interviewer = row.interviewer;
      if (row.phone) patch.phone = row.phone;
      if (row.address) patch.address = row.address;
      if (row.latitude != null) patch.latitude = row.latitude;
      if (row.longitude != null) patch.longitude = row.longitude;
      if (row.collected_at) patch.collected_at = row.collected_at;

      const { error: upErr } = await supabase
        .from('qc_surveys')
        .update(patch)
        .eq('id', existing.id as number)
        .eq('org_id', orgId);
      if (upErr) throw upErr;
      return { outcome: 'updated', surveyId: existing.id as number };
    }

    const created = await this.createSurvey(orgId, {
      project_id: projectId,
      external_id: row.external_id,
      respondent_code: row.respondent_code,
      interviewer: row.interviewer,
      phone: row.phone,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      collected_at: row.collected_at,
      answers: row.answers,
      metadata: importMeta,
    });
    return { outcome: 'created', surveyId: created.id };
  },

  async syncIntegration(
    orgId: string,
    integrationId: number,
    actorId?: string | null,
  ): Promise<{ integration: QcIntegration; run: QcIntegrationRun }> {
    const integration = await this.getIntegration(orgId, integrationId);
    if (!integration) throw new Error('Integración no encontrada');

    const startedAt = new Date().toISOString();
    const fetched = await fetchQcIntegrationRows(integration);

    let imported_count = 0;
    let updated_count = 0;
    let skipped_count = fetched.skipped_count;
    let error_count = fetched.error_count;
    let status: QcIntegrationRunStatus = fetched.status;
    let message = fetched.message;
    const errors: string[] = [];

    if (fetched.status !== 'error' && fetched.status !== 'skipped') {
      if (!integration.project_id) {
        status = 'error';
        error_count += 1;
        message = 'Asigna un proyecto QC a la integración antes de sincronizar';
      } else {
        const touchedIds: number[] = [];
        let rules_applied = 0;
        for (const row of fetched.rows) {
          try {
            const { outcome, surveyId } = await this.upsertSurveyFromImport(
              orgId,
              integration.project_id,
              row,
              { integration_id: integration.id, provider: integration.provider },
            );
            if (outcome === 'created') imported_count += 1;
            else if (outcome === 'updated') updated_count += 1;
            else skipped_count += 1;
            if ((outcome === 'created' || outcome === 'updated') && surveyId) {
              touchedIds.push(surveyId);
            }
          } catch (err) {
            error_count += 1;
            errors.push(
              `${row.external_id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        // QC-9: auto-aplicar reglas tras import
        if (actorId && touchedIds.length) {
          for (const sid of touchedIds) {
            try {
              const evalResult = await this.evaluateSurveyRules(orgId, sid, {
                apply: true,
                actorId,
              });
              const n = (evalResult.applied_actions ?? []).filter((a) => !a.skipped).length;
              rules_applied += n;
            } catch (err) {
              errors.push(
                `rules#${sid}: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        }

        if (error_count > 0 && (imported_count > 0 || updated_count > 0)) {
          status = 'partial';
        } else if (error_count > 0) {
          status = 'error';
        } else if (fetched.status === 'partial') {
          status = 'partial';
        } else {
          status = 'success';
        }

        message = `Import: ${imported_count} nuevas, ${updated_count} actualizadas, ${skipped_count} omitidas`;
        if (rules_applied) message += `, ${rules_applied} auto-acciones`;
        if (error_count) message += `, ${error_count} errores`;
        if (fetched.result_payload?.demo) {
          message += ' (modo demo sin Google Sheets)';
        }

        (fetched.result_payload as Record<string, unknown>).rules_applied = rules_applied;
        (fetched.result_payload as Record<string, unknown>).touched = touchedIds.length;
      }
    }

    await this.dispatchWebhooks(orgId, 'integration.sync', {
      integration_id: integrationId,
      status: fetched.status,
      created: imported_count,
      updated: updated_count,
    }).catch(() => undefined);

    const finishedAt = new Date().toISOString();
    const result_payload: Record<string, unknown> = {
      ...fetched.result_payload,
      created: imported_count,
      updated: updated_count,
      skipped: skipped_count,
      errors: errors.slice(0, 20),
    };

    const { data: run, error } = await supabase
      .from('qc_integration_runs')
      .insert({
        org_id: orgId,
        integration_id: integrationId,
        status,
        imported_count: imported_count + updated_count,
        skipped_count,
        error_count,
        message,
        result_payload,
        started_at: startedAt,
        finished_at: finishedAt,
      })
      .select('*')
      .single();
    if (error) throw error;

    const nextStatus: QcIntegrationStatus =
      status === 'error' ? 'error' : integration.status === 'inactive' ? 'inactive' : 'active';

    const { data: updated, error: uErr } = await supabase
      .from('qc_integrations')
      .update({
        last_sync_at: finishedAt,
        last_sync_status: status,
        last_sync_message: message,
        status: nextStatus === 'inactive' ? integration.status : nextStatus,
        updated_at: finishedAt,
      })
      .eq('id', integrationId)
      .eq('org_id', orgId)
      .select('*')
      .single();
    if (uErr) throw uErr;

    await this.writeAudit({
      orgId,
      actorId,
      action: 'integration.sync',
      entityType: 'qc_integration',
      entityId: String(integrationId),
      detail: message,
      metadata: {
        status,
        created: imported_count,
        updated: updated_count,
        skipped: skipped_count,
        errors: error_count,
      },
    });

    return {
      integration: this.mapIntegration(updated as Record<string, unknown>),
      run: {
        id: run.id as number,
        org_id: run.org_id as string,
        integration_id: run.integration_id as number,
        status: run.status as QcIntegrationRunStatus,
        imported_count: (run.imported_count as number) ?? 0,
        skipped_count: (run.skipped_count as number) ?? 0,
        error_count: (run.error_count as number) ?? 0,
        message: (run.message as string) ?? '',
        result_payload: (run.result_payload as Record<string, unknown>) ?? {},
        started_at: run.started_at as string,
        finished_at: run.finished_at as string,
      },
    };
  },

  async getDashboard(orgId: string): Promise<QcDashboardStats> {
    const [
      projectsRes,
      clientsRes,
      surveysRes,
      evidencesRes,
      rulesRes,
      integrationsRes,
    ] = await Promise.all([
      supabase.from('qc_projects').select('id, name').eq('org_id', orgId),
      supabase.from('qc_clients').select('id').eq('org_id', orgId),
      supabase
        .from('qc_surveys')
        .select(
          'id, project_id, external_id, respondent_code, status, current_stage, latitude, longitude, updated_at',
        )
        .eq('org_id', orgId)
        .order('updated_at', { ascending: false }),
      supabase.from('qc_evidences').select('id').eq('org_id', orgId),
      supabase.from('qc_rules').select('id').eq('org_id', orgId).eq('enabled', true),
      supabase.from('qc_integrations').select('id, status').eq('org_id', orgId),
    ]);

    for (const res of [
      projectsRes,
      clientsRes,
      surveysRes,
      evidencesRes,
      rulesRes,
      integrationsRes,
    ]) {
      if (res.error) throw res.error;
    }

    const projects = (projectsRes.data ?? []) as Array<{ id: number; name: string }>;
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));
    const surveys = (surveysRes.data ?? []) as Array<{
      id: number;
      project_id: number;
      external_id: string;
      respondent_code: string;
      status: string;
      current_stage: string;
      latitude: number | null;
      longitude: number | null;
      updated_at: string;
    }>;
    const integrations = (integrationsRes.data ?? []) as Array<{ id: number; status: string }>;

    const statusKeys = ['pendiente', 'en_revision', 'aprobada', 'rechazada', 'en_auditoria'] as const;
    const stageKeys = ['ubicacion', 'contenido', 'telefono', 'completada'] as const;
    const statusLabels: Record<string, string> = {
      pendiente: 'Pendiente',
      en_revision: 'En revisión',
      aprobada: 'Aprobada',
      rechazada: 'Rechazada',
      en_auditoria: 'En auditoría',
    };
    const stageLabels: Record<string, string> = {
      ubicacion: 'Ubicación',
      contenido: 'Contenido',
      telefono: 'Teléfono',
      completada: 'Completada',
    };

    const byStatus = new Map<string, number>();
    const byStage = new Map<string, number>();
    for (const s of surveys) {
      byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
      byStage.set(s.current_stage, (byStage.get(s.current_stage) ?? 0) + 1);
    }

    const projectStats = new Map<
      number,
      {
        total: number;
        pendiente: number;
        en_revision: number;
        aprobada: number;
        rechazada: number;
        en_auditoria: number;
      }
    >();
    for (const p of projects) {
      projectStats.set(p.id, {
        total: 0,
        pendiente: 0,
        en_revision: 0,
        aprobada: 0,
        rechazada: 0,
        en_auditoria: 0,
      });
    }
    for (const s of surveys) {
      const row = projectStats.get(s.project_id) ?? {
        total: 0,
        pendiente: 0,
        en_revision: 0,
        aprobada: 0,
        rechazada: 0,
        en_auditoria: 0,
      };
      row.total += 1;
      if (s.status in row) {
        (row as Record<string, number>)[s.status] =
          ((row as Record<string, number>)[s.status] ?? 0) + 1;
      }
      projectStats.set(s.project_id, row);
    }

    return {
      totals: {
        projects: projects.length,
        clients: (clientsRes.data ?? []).length,
        surveys: surveys.length,
        evidences: (evidencesRes.data ?? []).length,
        rules_active: (rulesRes.data ?? []).length,
        integrations_active: integrations.filter((i) => i.status === 'active').length,
      },
      surveys_by_status: statusKeys.map((key) => ({
        key,
        label: statusLabels[key],
        count: byStatus.get(key) ?? 0,
      })),
      surveys_by_stage: stageKeys.map((key) => ({
        key,
        label: stageLabels[key],
        count: byStage.get(key) ?? 0,
      })),
      projects_breakdown: Array.from(projectStats.entries())
        .map(([project_id, stats]) => ({
          project_id,
          project_name: projectNames.get(project_id) ?? `Proyecto ${project_id}`,
          ...stats,
        }))
        .sort((a, b) => b.total - a.total),
      recent_surveys: surveys.slice(0, 8).map((s) => ({
        id: s.id,
        label: s.external_id || s.respondent_code || `Encuesta #${s.id}`,
        status: s.status,
        current_stage: s.current_stage,
        project_name: projectNames.get(s.project_id) ?? null,
        updated_at: s.updated_at,
      })),
      attention: {
        pending_review:
          (byStatus.get('pendiente') ?? 0) + (byStatus.get('en_revision') ?? 0),
        rejected: byStatus.get('rechazada') ?? 0,
        missing_gps: surveys.filter(
          (s) =>
            (s.status === 'pendiente' || s.status === 'en_revision') &&
            (s.latitude == null || s.longitude == null),
        ).length,
        integration_errors: integrations.filter((i) => i.status === 'error').length,
      },
    };
  },

  // ── QC-9: Webhooks ───────────────────────────────────────────────────────

  mapWebhook(row: Record<string, unknown>): QcWebhook {
    const events = Array.isArray(row.events)
      ? (row.events as string[]).filter(Boolean) as QcWebhookEvent[]
      : [];
    return {
      id: row.id as number,
      org_id: row.org_id as string,
      name: row.name as string,
      url: row.url as string,
      secret: (row.secret as string) ?? '',
      events,
      enabled: Boolean(row.enabled),
      last_delivery_at: (row.last_delivery_at as string | null) ?? null,
      last_delivery_status: (row.last_delivery_status as string) ?? '',
      last_delivery_message: (row.last_delivery_message as string) ?? '',
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  },

  async listWebhooks(orgId: string): Promise<QcWebhook[]> {
    const { data, error } = await supabase
      .from('qc_webhooks')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => this.mapWebhook(r as Record<string, unknown>));
  },

  async createWebhook(
    orgId: string,
    input: {
      name: string;
      url: string;
      secret?: string;
      events?: QcWebhookEvent[];
      enabled?: boolean;
    },
    actorId?: string | null,
  ): Promise<QcWebhook> {
    const { data, error } = await supabase
      .from('qc_webhooks')
      .insert({
        org_id: orgId,
        name: input.name.trim(),
        url: input.url.trim(),
        secret: input.secret ?? '',
        events: input.events?.length
          ? input.events
          : (['rules.applied'] as QcWebhookEvent[]),
        enabled: input.enabled ?? true,
      })
      .select('*')
      .single();
    if (error) throw error;
    await this.writeAudit({
      orgId,
      actorId,
      action: 'webhook.create',
      entityType: 'qc_webhook',
      entityId: String(data.id),
      detail: input.name,
    });
    return this.mapWebhook(data as Record<string, unknown>);
  },

  async updateWebhook(
    orgId: string,
    id: number,
    patch: Partial<{
      name: string;
      url: string;
      secret: string;
      events: QcWebhookEvent[];
      enabled: boolean;
    }>,
    actorId?: string | null,
  ): Promise<QcWebhook | undefined> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.url !== undefined) payload.url = patch.url;
    if (patch.secret !== undefined) payload.secret = patch.secret;
    if (patch.events !== undefined) payload.events = patch.events;
    if (patch.enabled !== undefined) payload.enabled = patch.enabled;

    const { data, error } = await supabase
      .from('qc_webhooks')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    await this.writeAudit({
      orgId,
      actorId,
      action: 'webhook.update',
      entityType: 'qc_webhook',
      entityId: String(id),
    });
    return this.mapWebhook(data as Record<string, unknown>);
  },

  async deleteWebhook(orgId: string, id: number, actorId?: string | null): Promise<boolean> {
    const { error, count } = await supabase
      .from('qc_webhooks')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('org_id', orgId);
    if (error) throw error;
    if ((count ?? 0) > 0) {
      await this.writeAudit({
        orgId,
        actorId,
        action: 'webhook.delete',
        entityType: 'qc_webhook',
        entityId: String(id),
      });
    }
    return (count ?? 0) > 0;
  },

  async dispatchWebhooks(
    orgId: string,
    event: QcWebhookEvent,
    data: Record<string, unknown>,
  ): Promise<void> {
    const hooks = await this.listWebhooks(orgId);
    const targets = hooks.filter((h) => h.enabled && h.events.includes(event));
    if (!targets.length) return;

    const occurred_at = new Date().toISOString();
    await Promise.all(
      targets.map(async (hook) => {
        const result = await deliverQcWebhook(hook, {
          event,
          org_id: orgId,
          occurred_at,
          data,
        });
        await supabase
          .from('qc_webhooks')
          .update({
            last_delivery_at: occurred_at,
            last_delivery_status: result.status,
            last_delivery_message: result.message,
            updated_at: occurred_at,
          })
          .eq('id', hook.id)
          .eq('org_id', orgId);
      }),
    );
  },

  // ── QC-11: Reportes ──────────────────────────────────────────────────────

  async buildReport(
    orgId: string,
    opts?: { projectId?: number; status?: string },
  ): Promise<QcReportSummary> {
    let surveyQuery = supabase
      .from('qc_surveys')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });
    if (opts?.projectId) surveyQuery = surveyQuery.eq('project_id', opts.projectId);
    if (opts?.status) surveyQuery = surveyQuery.eq('status', opts.status);

    const [surveysRes, projectsRes, evidencesRes, stagesRes] = await Promise.all([
      surveyQuery,
      supabase.from('qc_projects').select('id, name').eq('org_id', orgId),
      supabase.from('qc_evidences').select('id, survey_id').eq('org_id', orgId),
      supabase.from('qc_review_stages').select('survey_id, stage_type, status').eq('org_id', orgId),
    ]);
    for (const r of [surveysRes, projectsRes, evidencesRes, stagesRes]) {
      if (r.error) throw r.error;
    }

    const projectNames = new Map(
      ((projectsRes.data ?? []) as Array<{ id: number; name: string }>).map((p) => [
        p.id,
        p.name,
      ]),
    );
    const evidenceCount = new Map<number, number>();
    for (const e of evidencesRes.data ?? []) {
      const sid = e.survey_id as number;
      evidenceCount.set(sid, (evidenceCount.get(sid) ?? 0) + 1);
    }
    const stageMap = new Map<string, string>();
    for (const s of stagesRes.data ?? []) {
      stageMap.set(`${s.survey_id}:${s.stage_type}`, s.status as string);
    }

    const surveys = (surveysRes.data ?? []) as Array<Record<string, unknown>>;
    const rows: QcReportSurveyRow[] = surveys.map((s) => {
      const id = s.id as number;
      const project_id = s.project_id as number;
      return {
        id,
        project_id,
        project_name: projectNames.get(project_id) ?? `Proyecto ${project_id}`,
        external_id: (s.external_id as string) ?? '',
        respondent_code: (s.respondent_code as string) ?? '',
        interviewer: (s.interviewer as string) ?? '',
        phone: (s.phone as string) ?? '',
        address: (s.address as string) ?? '',
        latitude: (s.latitude as number | null) ?? null,
        longitude: (s.longitude as number | null) ?? null,
        status: (s.status as string) ?? '',
        current_stage: (s.current_stage as string) ?? '',
        collected_at: (s.collected_at as string | null) ?? null,
        created_at: s.created_at as string,
        updated_at: s.updated_at as string,
        evidences_count: evidenceCount.get(id) ?? 0,
        stage_ubicacion: stageMap.get(`${id}:ubicacion`) ?? 'pendiente',
        stage_contenido: stageMap.get(`${id}:contenido`) ?? 'pendiente',
        stage_telefono: stageMap.get(`${id}:telefono`) ?? 'pendiente',
      };
    });

    const by_status: Record<string, number> = {};
    const by_stage: Record<string, number> = {};
    const byProjectMap = new Map<number, number>();
    for (const r of rows) {
      by_status[r.status] = (by_status[r.status] ?? 0) + 1;
      by_stage[r.current_stage] = (by_stage[r.current_stage] ?? 0) + 1;
      byProjectMap.set(r.project_id, (byProjectMap.get(r.project_id) ?? 0) + 1);
    }

    return {
      generated_at: new Date().toISOString(),
      filters: {
        project_id: opts?.projectId ?? null,
        status: opts?.status ?? null,
      },
      totals: {
        surveys: rows.length,
        evidences: rows.reduce((acc, r) => acc + r.evidences_count, 0),
        by_status,
        by_stage,
        by_project: Array.from(byProjectMap.entries())
          .map(([project_id, count]) => ({
            project_id,
            project_name: projectNames.get(project_id) ?? `Proyecto ${project_id}`,
            count,
          }))
          .sort((a, b) => b.count - a.count),
      },
      rows,
    };
  },

  reportToCsv(summary: QcReportSummary): string {
    const headers = [
      'id',
      'project_name',
      'external_id',
      'respondent_code',
      'interviewer',
      'phone',
      'address',
      'latitude',
      'longitude',
      'status',
      'current_stage',
      'stage_ubicacion',
      'stage_contenido',
      'stage_telefono',
      'evidences_count',
      'collected_at',
      'created_at',
      'updated_at',
    ];
    const escape = (v: unknown): string => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(',')];
    for (const r of summary.rows) {
      lines.push(
        headers
          .map((h) => escape((r as unknown as Record<string, unknown>)[h]))
          .join(','),
      );
    }
    return lines.join('\n');
  },

  async logReportExport(
    orgId: string,
    input: {
      actorId?: string | null;
      format: 'csv' | 'json' | 'summary';
      filters: Record<string, unknown>;
      rowCount: number;
    },
  ): Promise<void> {
    const { error } = await supabase.from('qc_report_exports').insert({
      org_id: orgId,
      actor_id: input.actorId ?? null,
      format: input.format,
      filters: input.filters,
      row_count: input.rowCount,
    });
    if (error) console.warn('[qc.report]', error.message);
    await this.writeAudit({
      orgId,
      actorId: input.actorId,
      action: 'report.export',
      entityType: 'qc_report',
      detail: `${input.format} · ${input.rowCount} filas`,
      metadata: input.filters,
    });
  },

  async listReportExports(orgId: string, limit = 20): Promise<QcReportExportLog[]> {
    const { data, error } = await supabase
      .from('qc_report_exports')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id as number,
      org_id: row.org_id as string,
      actor_id: (row.actor_id as string | null) ?? null,
      format: row.format as QcReportExportLog['format'],
      filters: (row.filters as Record<string, unknown>) ?? {},
      row_count: (row.row_count as number) ?? 0,
      created_at: row.created_at as string,
    }));
  },
};
