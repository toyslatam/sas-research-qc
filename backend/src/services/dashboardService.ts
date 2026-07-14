import type { DashboardStats, InterviewResponsesMatrix } from '@whispper/shared';
import { supabase } from '../lib/supabaseClient';

export interface DashboardFilters {
  projectId?: number;
  dateFrom?: string;
  dateTo?: string;
  segment?: string;
  moduleType?: 'propuesta' | 'exploratorio';
}

function toRpcParams(filters: DashboardFilters) {
  return {
    p_project_id:  filters.projectId  ?? null,
    p_date_from:   filters.dateFrom   ?? null,
    p_date_to:     filters.dateTo     ?? null,
    p_segment:     filters.segment    ?? null,
    p_module_type: filters.moduleType ?? null,
  };
}

type MatrixInterview = InterviewResponsesMatrix['entrevistas'][number];

async function rekeyResponsesByCurrentQuestionText(
  matrix: InterviewResponsesMatrix,
  filters: DashboardFilters
): Promise<InterviewResponsesMatrix> {
  const interviewIds = matrix.entrevistas.map((item) => item.id);
  if (interviewIds.length === 0) return matrix;

  const { data: interviews, error: interviewsError } = await supabase
    .from('interviews')
    .select('id, project_id')
    .in('id', interviewIds);
  if (interviewsError) throw interviewsError;

  const projectIds = Array.from(
    new Set((interviews ?? []).map((item) => item.project_id as number))
  );
  if (projectIds.length === 0) return matrix;

  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('id, text')
    .in('project_id', projectIds);
  if (questionsError) throw questionsError;

  let answersQuery = supabase
    .from('interview_answers')
    .select('interview_id, question_id, question_text, answer_text, category')
    .in('interview_id', interviewIds);

  if (filters.segment) {
    answersQuery = answersQuery.eq('category', filters.segment);
  }

  const { data: answers, error: answersError } = await answersQuery;
  if (answersError) throw answersError;

  const currentQuestionTextById = new Map(
    (questions ?? []).map((question) => [
      question.id as number,
      question.text as string,
    ])
  );

  const isPlaceholderAnswer = (text: string | null | undefined): boolean => {
    if (!text?.trim()) return true;
    const n = text.trim().toLowerCase();
    return n === 'no mencionado' || n === '—' || n === '-' || n === 'n/a';
  };

  const responsesByInterview = new Map<number, Record<string, string>>();
  for (const answer of answers ?? []) {
    const interviewId = answer.interview_id as number;
    const questionId = answer.question_id as number | null;
    const answerText = answer.answer_text as string;
    const responses = responsesByInterview.get(interviewId) ?? {};

    const keys: string[] = [];
    if (questionId !== null && currentQuestionTextById.has(questionId)) {
      keys.push(currentQuestionTextById.get(questionId)!);
      keys.push(`id:${questionId}`);
    }
    keys.push(answer.question_text as string);

    for (const key of keys) {
      if (!key) continue;
      const existing = responses[key];
      if (
        existing !== undefined &&
        !isPlaceholderAnswer(existing) &&
        isPlaceholderAnswer(answerText)
      ) {
        continue;
      }
      responses[key] = answerText;
    }

    responsesByInterview.set(interviewId, responses);
  }

  return {
    preguntas: matrix.preguntas,
    entrevistas: matrix.entrevistas.map((interview: MatrixInterview) => ({
      ...interview,
      respuestas: responsesByInterview.get(interview.id) ?? interview.respuestas,
    })),
  };
}

export async function getDashboardStats(
  filters: DashboardFilters = {}
): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('get_dashboard_stats', toRpcParams(filters));
  if (error) throw error;

  const raw = data as DashboardStats & { total_entrevistas: number };
  return {
    total_entrevistas: raw.total_entrevistas ?? 0,
    por_proyecto: raw.por_proyecto ?? [],
    sentimiento: raw.sentimiento ?? [],
    marcas_frecuentes: raw.marcas_frecuentes ?? [],
    lugares_compra: raw.lugares_compra ?? [],
    respuestas_por_pregunta: raw.respuestas_por_pregunta ?? [],
  };
}

export async function getInterviewResponsesMatrix(
  filters: DashboardFilters = {}
): Promise<InterviewResponsesMatrix> {
  const { data, error } = await supabase.rpc(
    'get_interview_responses_matrix',
    toRpcParams(filters)
  );
  if (error) throw error;

  const raw = data as InterviewResponsesMatrix;
  const matrix = {
    preguntas: raw?.preguntas ?? [],
    entrevistas: raw?.entrevistas ?? [],
  };
  return rekeyResponsesByCurrentQuestionText(matrix, filters);
}

export async function getWordCloud(
  filters: DashboardFilters = {}
): Promise<{ text: string; value: number }[]> {
  const { data, error } = await supabase.rpc('get_word_cloud', {
    p_project_id:  filters.projectId  ?? null,
    p_module_type: filters.moduleType ?? null,
  });
  if (error) throw error;
  return (data as { text: string; value: number }[]) ?? [];
}
