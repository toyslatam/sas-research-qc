import type { DashboardStats, InterviewResponsesMatrix } from '@whispper/shared';
import { isEmptyAnswer } from '@/lib/answers';
import { normalizeProviderName } from '@/lib/providerAnalysis';

const STOP_WORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'del', 'que', 'por', 'con', 'un', 'una',
  'para', 'es', 'al', 'se', 'su', 'sus', 'no', 'como', 'más', 'pero', 'son', 'ser', 'está',
]);

export function filterMatrixByProviders(
  matrix: InterviewResponsesMatrix,
  providerNames: string[] | undefined,
): InterviewResponsesMatrix {
  if (!providerNames?.length) return matrix;
  const keys = new Set(providerNames.map(normalizeProviderName));
  return {
    ...matrix,
    entrevistas: matrix.entrevistas.filter((e) =>
      keys.has(normalizeProviderName(e.participant_name?.trim() || `#${e.id}`)),
    ),
  };
}

export function wordCloudFromMatrix(
  matrix: InterviewResponsesMatrix,
  limit = 40,
): { text: string; value: number }[] {
  const freq = new Map<string, number>();
  for (const e of matrix.entrevistas) {
    for (const val of Object.values(e.respuestas)) {
      if (isEmptyAnswer(val)) continue;
      const tokens = val
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 3 && !STOP_WORDS.has(t));
      for (const t of tokens) {
        freq.set(t, (freq.get(t) ?? 0) + 1);
      }
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([text, value]) => ({ text, value }));
}

export function gapQuestionsFromMatrix(matrix: InterviewResponsesMatrix): string[] {
  if (!matrix.preguntas.length) return [];
  return matrix.preguntas.filter((q) =>
    !matrix.entrevistas.some((e) => !isEmptyAnswer(e.respuestas[q])),
  );
}

export function gapQuestionsFromStats(stats: DashboardStats): string[] {
  return stats.respuestas_por_pregunta
    .filter((b) => b.respuestas.every((r) => r.valor === 'No mencionado' || !r.valor))
    .map((b) => b.pregunta);
}
