/**
 * Construye filas de borrador para Análisis Final (pregunta + sub-ítems separados).
 */
import type { InterviewResponsesMatrix, Question } from '@whispper/shared';

const STAGE_ORDER = [
  'Reunión #1 Exploratoria',
  'Reunión #2 Cotización',
  'Reunión #3 De clausura',
] as const;

const STAGE_KEY: Record<string, 'r1' | 'r2' | 'r3'> = {
  'Reunión #1 Exploratoria': 'r1',
  'Reunión #2 Cotización': 'r2',
  'Reunión #3 De clausura': 'r3',
};

const EMPTY = new Set(['', '-', '--', '—', 'n/a', 'na', 'no aplica']);
const MISSING = [
  'no mencionado', 'no se menciona', 'no se mencionan', 'no informado',
  'sin informacion', 'sin información', 'no aplica', 'no disponible',
];

export function isEmptyAnswer(value?: string | null): boolean {
  if (!value) return true;
  const t = value.trim();
  const n = t.toLowerCase();
  if (EMPTY.has(n)) return true;
  if (t.length > 80) return false;
  return MISSING.some((p) => n.startsWith(p));
}

function normalize(text: string): string {
  return text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');
}

function questionIdKey(id: number): string {
  return `id:${id}`;
}

function resolveAnswer(respuestas: Record<string, string>, question: Question): string {
  const byId = respuestas[questionIdKey(question.id)];
  if (byId !== undefined) return byId;
  const direct = respuestas[question.text];
  if (direct !== undefined) return direct;
  const target = normalize(question.text);
  for (const [key, value] of Object.entries(respuestas)) {
    if (!key.startsWith('id:') && normalize(key) === target) return value;
  }
  return '';
}

function bestAnswer(rows: InterviewResponsesMatrix['entrevistas'], question: Question): string {
  for (const e of rows) {
    const a = resolveAnswer(e.respuestas, question);
    if (!isEmptyAnswer(a)) return a;
  }
  return '';
}

function answerForStage(
  interviews: InterviewResponsesMatrix['entrevistas'],
  stage: string,
  question: Question,
): string {
  const rows = interviews.filter(
    (e) => (e.meeting_stage ?? 'Reunión #1 Exploratoria') === stage,
  );
  return bestAnswer(rows, question);
}

function stripBullet(line: string): string {
  return line.replace(/^[\s•\-\*]+/, '').trim();
}

function parseBulletMap(answer: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of answer.split(/\r?\n/).map(stripBullet).filter(Boolean)) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (key) {
      map.set(normalize(key), val);
      map.set(key, val);
    }
  }
  return map;
}

function findBullet(subItem: string, map: Map<string, string>): string | null {
  const n = normalize(subItem);
  if (map.has(n)) return map.get(n)!;
  for (const [k, v] of map.entries()) {
    const kn = normalize(k);
    if (kn === n || kn.includes(n) || n.includes(kn)) return v;
  }
  return null;
}

function subAnswer(subItem: string, full: string): string {
  if (isEmptyAnswer(full)) return '';
  const bullet = findBullet(subItem, parseBulletMap(full));
  if (bullet && !isEmptyAnswer(bullet)) return bullet.trim();
  const fn = normalize(full);
  const sn = normalize(subItem);
  if (fn.includes(sn)) return full.trim().slice(0, 400);
  return '';
}

export interface DraftItemInput {
  question_id: number;
  sub_item_index: number | null;
  code: string;
  category: string;
  question_text: string;
  sub_item_text: string | null;
  answer_propuesta: string;
  answer_r1: string;
  answer_r2: string;
  answer_r3: string;
  coverage_status: string | null;
  relevance: 'pendiente' | 'sin_dato';
  sort_order: number;
}

export interface ProviderMatrixSlice {
  proposals: InterviewResponsesMatrix['entrevistas'];
  interviews: InterviewResponsesMatrix['entrevistas'];
}

function classifyCoverage(prop: string, ent: string): string | null {
  const hp = !isEmptyAnswer(prop);
  const he = !isEmptyAnswer(ent);
  if (!hp && !he) return 'sin_cobertura';
  if (hp && !he) return 'solo_propuesta';
  if (!hp && he) return 'solo_entrevista';
  if (normalize(prop) === normalize(ent)) return 'coincide';
  return 'difiere';
}

function sortQuestions(questions: Question[]): Question[] {
  return [...questions].sort(
    (a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.id - b.id,
  );
}

export function buildFinalAnalysisDraftItems(
  questions: Question[],
  slice: ProviderMatrixSlice,
): DraftItemInput[] {
  const sorted = sortQuestions(questions);
  const items: DraftItemInput[] = [];
  let sortOrder = 0;

  sorted.forEach((question, idx) => {
    const qNum = idx + 1;
    const prop = bestAnswer(slice.proposals, question);
    const r1 = answerForStage(slice.interviews, STAGE_ORDER[0], question);
    const r2 = answerForStage(slice.interviews, STAGE_ORDER[1], question);
    const r3 = answerForStage(slice.interviews, STAGE_ORDER[2], question);
    const entMerged = bestAnswer(slice.interviews, question);
    const coverage = classifyCoverage(prop, entMerged);
    const subs = (question.sub_items ?? []).filter((s) => s.trim());

    if (subs.length === 0) {
      const any = [prop, r1, r2, r3].some((a) => !isEmptyAnswer(a));
      items.push({
        question_id: question.id,
        sub_item_index: null,
        code: String(qNum),
        category: question.category ?? 'general',
        question_text: question.text,
        sub_item_text: null,
        answer_propuesta: prop,
        answer_r1: r1,
        answer_r2: r2,
        answer_r3: r3,
        coverage_status: coverage,
        relevance: any ? 'pendiente' : 'sin_dato',
        sort_order: sortOrder++,
      });
      return;
    }

    subs.forEach((sub, subIdx) => {
      const ap = subAnswer(sub, prop);
      const a1 = subAnswer(sub, r1);
      const a2 = subAnswer(sub, r2);
      const a3 = subAnswer(sub, r3);
      const any = [ap, a1, a2, a3].some((a) => !isEmptyAnswer(a));
      items.push({
        question_id: question.id,
        sub_item_index: subIdx,
        code: `${qNum}.${subIdx + 1}`,
        category: question.category ?? 'general',
        question_text: question.text,
        sub_item_text: sub,
        answer_propuesta: ap,
        answer_r1: a1,
        answer_r2: a2,
        answer_r3: a3,
        coverage_status: coverage,
        relevance: any ? 'pendiente' : 'sin_dato',
        sort_order: sortOrder++,
      });
    });
  });

  return items;
}

export function computeWeightedGlobalScore(
  items: { category: string; item_score: number | null }[],
): number | null {
  const scored = items.filter((i) => i.item_score != null && !Number.isNaN(i.item_score));
  if (!scored.length) return null;

  const byCat = new Map<string, number[]>();
  for (const item of scored) {
    const list = byCat.get(item.category) ?? [];
    list.push(item.item_score!);
    byCat.set(item.category, list);
  }

  const categoryAvgs: number[] = [];
  for (const scores of byCat.values()) {
    categoryAvgs.push(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  const avg = categoryAvgs.reduce((a, b) => a + b, 0) / categoryAvgs.length;
  return Math.round(avg * 100) / 100;
}

export function toProviderSlug(name: string): string {
  return encodeURIComponent(
    name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s+/g, '-'),
  );
}
