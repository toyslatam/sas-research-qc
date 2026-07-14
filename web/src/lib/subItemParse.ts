import type { Question } from '@whispper/shared';
import { isEmptyAnswer } from './answers';

export interface SubItemAnswerRow {
  /** Número de pregunta en el cuestionario (1-based, por sort_order) */
  questionNumber: number;
  /** Código visible: "3", "3.1", "3.2" */
  code: string;
  category: string;
  questionText: string;
  subItemText: string | null;
  answer: string;
  covered: boolean;
}

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^[\s•\-\*]+/, '').trim();
}

function sentenceExcerpt(answer: string, terms: string[]): string {
  const sentences = answer
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const normTerms = terms.map(normalize).filter(Boolean);

  const found =
    sentences.find((sentence) => {
      const n = normalize(sentence);
      return normTerms.some((term) => n.includes(term));
    }) ?? answer.trim();

  return found.length > 260 ? `${found.slice(0, 257)}...` : found;
}

export function cleanSubItemDetail(detail: string): string {
  const cleaned = detail
    .trim()
    .replace(/^mencionado\s*[—-]\s*/i, '')
    .replace(/^mencionado\s*:\s*/i, '')
    .replace(/^sí\s*[—-]\s*/i, '')
    .replace(/^si\s*[—-]\s*/i, '')
    .replace(/^se menciona que\s+/i, '')
    .replace(/^se confirma que\s+/i, '')
    .trim();

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Extrae mapa sub-ítem → detalle desde viñetas GPT o texto estructurado */
function parseBulletMap(answer: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = answer.split(/\r?\n/).map(stripBulletPrefix).filter(Boolean);

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!key) continue;

    map.set(normalize(key), value);
    map.set(key, value);
  }

  return map;
}

function findBulletForSubItem(subItem: string, bulletMap: Map<string, string>): string | null {
  const norm = normalize(subItem);

  if (bulletMap.has(norm)) return bulletMap.get(norm)!;

  for (const [key, value] of bulletMap.entries()) {
    const keyNorm = normalize(key);
    if (keyNorm === norm || keyNorm.includes(norm) || norm.includes(keyNorm)) {
      return value;
    }
  }

  return null;
}

function isMentioned(detail: string): boolean {
  const n = normalize(detail);
  if (!n || isEmptyAnswer(detail)) return false;
  return !(
    n.startsWith('no mencionado') ||
    n.startsWith('no se menciona') ||
    n.startsWith('sin evidencia') ||
    n === 'n/a'
  );
}

/** Heurística conservadora: el sub-ítem o sus palabras clave aparecen en el párrafo */
function detectInParagraph(subItem: string, answer: string): string | null {
  const answerNorm = normalize(answer);
  const subNorm = normalize(subItem);
  if (!answerNorm || !subNorm) return null;

  if (answerNorm.includes(subNorm)) {
    return sentenceExcerpt(answer, [subItem]);
  }

  const keywords = subNorm
    .split(/[^a-z0-9áéíóúñ]+/i)
    .filter((w) => w.length > 4)
    .slice(0, 4);

  if (keywords.length === 0) return null;

  const hits = keywords.filter((kw) => answerNorm.includes(kw));
  if (hits.length >= Math.min(2, keywords.length)) {
    return sentenceExcerpt(answer, hits);
  }

  return null;
}

function resolveSubItemAnswer(
  subItem: string,
  fullAnswer: string,
  bulletMap: Map<string, string>
): { answer: string; covered: boolean } {
  const fromBullet = findBulletForSubItem(subItem, bulletMap);
  if (fromBullet !== null) {
    const cleaned = cleanSubItemDetail(fromBullet);
    return {
      answer: cleaned,
      covered: isMentioned(cleaned),
    };
  }

  const fromParagraph = detectInParagraph(subItem, fullAnswer);
  if (fromParagraph) {
    return { answer: fromParagraph, covered: true };
  }

  return { answer: 'Sin evidencia específica', covered: false };
}

export function sortQuestions(questions: Question[]): Question[] {
  return [...questions].sort(
    (a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.id - b.id
  );
}

export function questionNumberBySort(questions: Question[]): Map<number, number> {
  const sorted = sortQuestions(questions);
  const map = new Map<number, number>();
  sorted.forEach((q, i) => map.set(q.id, i + 1));
  return map;
}

/** Desglosa una respuesta en filas con códigos 3.1, 3.2, etc. */
export function expandAnswerToSubItemRows(
  question: Question,
  questionNumber: number,
  rawAnswer: string | undefined
): SubItemAnswerRow[] {
  const category = question.category ?? 'General';
  const fullAnswer = rawAnswer?.trim() ?? '';
  const hasAnswer = !isEmptyAnswer(fullAnswer);
  const subItems = question.sub_items?.filter((s) => s.trim()) ?? [];

  if (subItems.length === 0) {
    return [{
      questionNumber,
      code: String(questionNumber),
      category,
      questionText: question.text,
      subItemText: null,
      answer: hasAnswer ? fullAnswer : '',
      covered: hasAnswer,
    }];
  }

  const bulletMap = hasAnswer ? parseBulletMap(fullAnswer) : new Map<string, string>();

  return subItems.map((subItem, idx) => {
    const { answer, covered } = hasAnswer
      ? resolveSubItemAnswer(subItem, fullAnswer, bulletMap)
      : { answer: '', covered: false };

    return {
      questionNumber,
      code: `${questionNumber}.${idx + 1}`,
      category,
      questionText: question.text,
      subItemText: subItem,
      answer: covered ? answer : (hasAnswer ? answer : ''),
      covered,
    };
  });
}

export function questionHasDisplayableAnswer(
  question: Question,
  rawAnswer: string | undefined
): boolean {
  const answer = rawAnswer?.trim() ?? '';
  const subItems = question.sub_items?.filter((s) => s.trim()) ?? [];
  if (subItems.length === 0) return !isEmptyAnswer(answer);

  const num = question.sort_order ?? question.id;
  const covered = expandAnswerToSubItemRows(question, num, answer).some((row) => row.covered);
  return covered || !isEmptyAnswer(answer);
}

export function buildSubItemRowsForInterview(
  questions: Question[],
  getAnswer: (question: Question) => string | undefined
): SubItemAnswerRow[] {
  const qNum = questionNumberBySort(questions);
  const rows: SubItemAnswerRow[] = [];

  for (const q of sortQuestions(questions)) {
    const num = qNum.get(q.id) ?? q.sort_order ?? q.id;
    rows.push(...expandAnswerToSubItemRows(q, num, getAnswer(q)));
  }

  return rows;
}
