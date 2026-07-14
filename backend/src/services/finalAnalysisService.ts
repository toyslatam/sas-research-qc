import type { ProviderFinalAnalysis, FinalAnalysisItem } from '@whispper/shared';
import { supabase } from '../lib/supabaseClient';
import { getInterviewResponsesMatrix } from './dashboardService';
import {
  buildFinalAnalysisDraftItems,
  computeWeightedGlobalScore,
  toProviderSlug,
} from './finalAnalysisBuild';

function mapItem(row: Record<string, unknown>): FinalAnalysisItem {
  return {
    id: row.id as number,
    analysis_id: row.analysis_id as number,
    question_id: (row.question_id as number) ?? null,
    sub_item_index: (row.sub_item_index as number) ?? null,
    code: row.code as string,
    category: row.category as string,
    question_text: row.question_text as string,
    sub_item_text: (row.sub_item_text as string) ?? null,
    answer_propuesta: (row.answer_propuesta as string) ?? '',
    answer_r1: (row.answer_r1 as string) ?? '',
    answer_r2: (row.answer_r2 as string) ?? '',
    answer_r3: (row.answer_r3 as string) ?? '',
    synthesis: (row.synthesis as string) ?? '',
    relevance: row.relevance as FinalAnalysisItem['relevance'],
    relevance_note: (row.relevance_note as string) ?? null,
    coverage_status: (row.coverage_status as string) ?? null,
    item_score: row.item_score != null ? Number(row.item_score) : null,
    reviewer_note: (row.reviewer_note as string) ?? null,
    sort_order: (row.sort_order as number) ?? 0,
  };
}

function mapAnalysis(
  row: Record<string, unknown>,
  items: FinalAnalysisItem[],
): ProviderFinalAnalysis {
  return {
    id: row.id as number,
    project_id: row.project_id as number,
    provider_name: row.provider_name as string,
    provider_slug: row.provider_slug as string,
    status: row.status as ProviderFinalAnalysis['status'],
    global_score: row.global_score != null ? Number(row.global_score) : null,
    category_weights: (row.category_weights as Record<string, number>) ?? {},
    reviewer_notes: (row.reviewer_notes as string) ?? null,
    version: (row.version as number) ?? 1,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    items,
  };
}

function normalizeProviderKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function getFinalAnalysis(
  projectId: number,
  providerSlug: string,
): Promise<ProviderFinalAnalysis | null> {
  const { data, error } = await supabase
    .from('provider_final_analyses')
    .select('*')
    .eq('project_id', projectId)
    .eq('provider_slug', providerSlug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: items, error: itemsError } = await supabase
    .from('provider_final_analysis_items')
    .select('*')
    .eq('analysis_id', data.id)
    .order('sort_order', { ascending: true });
  if (itemsError) throw itemsError;

  return mapAnalysis(data, (items ?? []).map(mapItem));
}

export async function generateFinalAnalysisDraft(
  projectId: number,
  providerName: string,
): Promise<ProviderFinalAnalysis> {
  const providerSlug = toProviderSlug(providerName);
  const matrix = await getInterviewResponsesMatrix({ projectId });

  const key = normalizeProviderKey(providerName);
  const proposals = matrix.entrevistas.filter(
    (e) => e.module_type === 'propuesta' && normalizeProviderKey(e.participant_name) === key,
  );
  const interviews = matrix.entrevistas.filter(
    (e) => e.module_type === 'exploratorio' && normalizeProviderKey(e.participant_name) === key,
  );

  if (!proposals.length && !interviews.length) {
    throw new Error(`Proveedor no encontrado en proyecto: ${providerName}`);
  }

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });
  if (qErr) throw qErr;

  const draftItems = buildFinalAnalysisDraftItems(
    (questions ?? []).map((q) => ({
      ...q,
      sub_items: Array.isArray(q.sub_items) ? q.sub_items : [],
    })),
    { proposals, interviews },
  );

  const displayName =
    proposals[0]?.participant_name ?? interviews[0]?.participant_name ?? providerName;

  const { data: existing } = await supabase
    .from('provider_final_analyses')
    .select('id, version')
    .eq('project_id', projectId)
    .eq('provider_slug', providerSlug)
    .maybeSingle();

  let analysisId: number;
  const version = existing ? (existing.version as number) + 1 : 1;

  if (existing) {
    await supabase
      .from('provider_final_analysis_items')
      .delete()
      .eq('analysis_id', existing.id);
    const { data: updated, error: upErr } = await supabase
      .from('provider_final_analyses')
      .update({
        provider_name: displayName,
        status: 'borrador',
        global_score: null,
        version,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (upErr) throw upErr;
    analysisId = updated.id;
  } else {
    const { data: created, error: crErr } = await supabase
      .from('provider_final_analyses')
      .insert({
        project_id: projectId,
        provider_name: displayName,
        provider_slug: providerSlug,
        status: 'borrador',
        version: 1,
      })
      .select('id')
      .single();
    if (crErr) throw crErr;
    analysisId = created.id;
  }

  const rows = draftItems.map((item) => ({
    analysis_id: analysisId,
    ...item,
    synthesis: '',
    relevance_note: null,
    item_score: null,
    reviewer_note: null,
  }));

  const { error: insErr } = await supabase.from('provider_final_analysis_items').insert(rows);
  if (insErr) throw insErr;

  const result = await getFinalAnalysis(projectId, providerSlug);
  if (!result) throw new Error('No se pudo cargar el análisis generado');
  return result;
}

export async function updateFinalAnalysisItem(
  itemId: number,
  patch: Partial<Pick<FinalAnalysisItem, 'synthesis' | 'relevance' | 'relevance_note' | 'item_score' | 'reviewer_note'>>,
): Promise<FinalAnalysisItem> {
  const updates: Record<string, unknown> = {};
  if (patch.synthesis !== undefined) updates.synthesis = patch.synthesis;
  if (patch.relevance !== undefined) updates.relevance = patch.relevance;
  if (patch.relevance_note !== undefined) updates.relevance_note = patch.relevance_note;
  if (patch.item_score !== undefined) updates.item_score = patch.item_score;
  if (patch.reviewer_note !== undefined) updates.reviewer_note = patch.reviewer_note;

  const { data, error } = await supabase
    .from('provider_final_analysis_items')
    .update(updates)
    .eq('id', itemId)
    .select('*')
    .single();
  if (error) throw error;

  const { data: itemRow } = await supabase
    .from('provider_final_analysis_items')
    .select('analysis_id')
    .eq('id', itemId)
    .single();

  if (itemRow?.analysis_id) {
    await recalcGlobalScore(itemRow.analysis_id as number);
  }

  return mapItem(data);
}

export async function updateFinalAnalysisHeader(
  analysisId: number,
  patch: Partial<Pick<ProviderFinalAnalysis, 'status' | 'reviewer_notes'>>,
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.reviewer_notes !== undefined) updates.reviewer_notes = patch.reviewer_notes;
  const { error } = await supabase
    .from('provider_final_analyses')
    .update(updates)
    .eq('id', analysisId);
  if (error) throw error;
}

async function recalcGlobalScore(analysisId: number): Promise<void> {
  const { data: items, error } = await supabase
    .from('provider_final_analysis_items')
    .select('category, item_score')
    .eq('analysis_id', analysisId);
  if (error) throw error;

  const global = computeWeightedGlobalScore(
    (items ?? []).map((i) => ({
      category: i.category as string,
      item_score: i.item_score != null ? Number(i.item_score) : null,
    })),
  );

  await supabase
    .from('provider_final_analyses')
    .update({ global_score: global, updated_at: new Date().toISOString() })
    .eq('id', analysisId);
}
