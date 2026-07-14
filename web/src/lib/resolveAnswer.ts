import type { Question } from '@whispper/shared';

export function normalizeQuestionText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function questionIdKey(questionId: number): string {
  return `id:${questionId}`;
}

/** Score 0–1: how closely two question texts match (tolerates minor catalog drift). */
function questionTextSimilarity(a: string, b: string): number {
  const wa = normalizeQuestionText(a).split(' ').filter(Boolean);
  const wb = normalizeQuestionText(b).split(' ').filter(Boolean);
  if (!wa.length || !wb.length) return 0;
  if (wa.join(' ') === wb.join(' ')) return 1;

  const maxLen = Math.max(wa.length, wb.length);
  let score = 0;
  for (let i = 0; i < Math.min(wa.length, wb.length); i++) {
    if (wa[i] === wb[i]) score += 1;
    else if (
      wa[i].length > 2 &&
      wb[i].length > 2 &&
      (wa[i].includes(wb[i]) || wb[i].includes(wa[i]))
    ) {
      score += 0.75;
    }
  }
  return score / maxLen;
}

const SIMILARITY_THRESHOLD = 0.88;

/** Busca respuesta por id, texto exacto, texto normalizado o similitud alta. */
export function resolveInterviewAnswer(
  respuestas: Record<string, string>,
  question: Pick<Question, 'id' | 'text'>,
): string | undefined {
  const byId = respuestas[questionIdKey(question.id)];
  if (byId !== undefined) return byId;

  const direct = respuestas[question.text];
  if (direct !== undefined) return direct;

  const target = normalizeQuestionText(question.text);
  for (const [key, value] of Object.entries(respuestas)) {
    if (key.startsWith('id:')) continue;
    if (normalizeQuestionText(key) === target) return value;
  }

  let best: { value: string; score: number } | null = null;
  for (const [key, value] of Object.entries(respuestas)) {
    if (key.startsWith('id:')) continue;
    const score = questionTextSimilarity(key, question.text);
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { value, score };
    }
  }
  return best?.value;
}

/** Lookup when only the catalog question text is available (e.g. matrix.preguntas). */
export function resolveAnswerByQuestionText(
  respuestas: Record<string, string>,
  questionText: string,
): string | undefined {
  return resolveInterviewAnswer(respuestas, { id: 0, text: questionText });
}
