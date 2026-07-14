import type { InterviewResponsesMatrix, Question } from '@whispper/shared';
import { isEmptyAnswer } from '@/lib/answers';
import { resolveInterviewAnswer } from '@/lib/resolveAnswer';

export type EntrevistaRow = InterviewResponsesMatrix['entrevistas'][number];

export interface ProviderGroup {
  name: string;
  proposals: EntrevistaRow[];
  interviews: EntrevistaRow[];
}

export type QuestionCoverageStatus =
  | 'missing_both'
  | 'propuesta_only'
  | 'entrevista_only'
  | 'both_aligned'
  | 'both_differ';

/** Single source contribution for one question. */
export interface AnswerSource {
  /** Display label: 'Propuesta', 'R1 · Exploratoria', etc. */
  label: string;
  answer: string;
  /**
   * true  → this source is the FIRST to answer this question (adds new info).
   * false → a previous source already answered; this one complements/enriches.
   */
  isNew: boolean;
}

export interface QuestionAnalysis {
  question: Question;
  /** Best answer from proposals (first non-empty). */
  propuestaAnswer: string | null;
  /** Best answer merged across all interview stages (first non-empty in stage order). */
  entrevistaAnswer: string | null;
  /** Per meeting_stage answer. Key = full stage label. */
  stageAnswers: Map<string, string | null>;
  /** Ordered list of ALL sources that have a non-empty answer, with isNew flag. */
  answerSources: AnswerSource[];
  status: QuestionCoverageStatus;
}

/** How much one source contributes incrementally to total coverage. */
export interface IncrementalCoverage {
  /** Display label: 'Propuesta', 'R1 · Exploratoria', etc. */
  sourceLabel: string;
  /** Questions this source independently covers. */
  answered: number;
  /** Questions this source answers that NO previous source (in order) answered. */
  newAnswers: number;
  /** Running total of distinct questions covered up to and including this source. */
  accumulated: number;
  /** This source's independent coverage %. */
  pct: number;
  /** Running total coverage %. */
  accumulatedPct: number;
}

export interface StageCoverage {
  answered: number;
  pct: number;
}

export interface ProviderAnalysis {
  provider: ProviderGroup;
  totalQuestions: number;
  propuestaAnswered: number;
  entrevistaAnswered: number;
  combinedAnswered: number;
  propuestaPct: number;
  entrevistaPct: number;
  combinedPct: number;
  /** Ordered distinct meeting stages present in interviews. */
  stageLabels: string[];
  /** Coverage per stage (keyed by full stage label). */
  stageCoverage: Map<string, StageCoverage>;
  /** Incremental coverage funnel: Propuesta → R1 → R2 → R3. */
  incrementalCoverage: IncrementalCoverage[];
  missingBoth: QuestionAnalysis[];
  propuestaOnly: QuestionAnalysis[];
  entrevistaOnly: QuestionAnalysis[];
  bothAnswered: QuestionAnalysis[];
  conflicts: QuestionAnalysis[];
  byCategory: Map<string, QuestionAnalysis[]>;
  summary: string;
  followUpSuggestions: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const STAGE_ORDER = [
  'Reunión #1 Exploratoria',
  'Reunión #2 Cotización',
  'Reunión #3 De clausura',
] as const;

export const STAGE_SHORT: Record<string, string> = {
  'Reunión #1 Exploratoria': 'R1 · Exploratoria',
  'Reunión #2 Cotización':   'R2 · Cotización',
  'Reunión #3 De clausura':  'R3 · Clausura',
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function normalizeProviderName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeName(name: string): string {
  return normalizeProviderName(name);
}

export function buildProviders(matrix: InterviewResponsesMatrix): ProviderGroup[] {
  const map = new Map<string, ProviderGroup>();
  const displayNames = new Map<string, string>();

  for (const e of matrix.entrevistas) {
    const displayName = e.participant_name?.trim() || `#${e.id}`;
    const key = normalizeName(displayName);

    if (!map.has(key)) {
      map.set(key, { name: displayName, proposals: [], interviews: [] });
      displayNames.set(key, displayName);
    } else {
      const existing = displayNames.get(key)!;
      if (displayName.length > existing.length) {
        map.get(key)!.name = displayName;
        displayNames.set(key, displayName);
      }
    }

    if (e.module_type === 'propuesta') map.get(key)!.proposals.push(e);
    else map.get(key)!.interviews.push(e);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es')
  );
}

function bestAnswer(entries: EntrevistaRow[], question: Question): string | null {
  for (const e of entries) {
    const a = resolveInterviewAnswer(e.respuestas, question);
    if (!isEmptyAnswer(a)) return a ?? null;
  }
  return null;
}

function bestAnswerForStage(
  interviews: EntrevistaRow[],
  stage: string,
  question: Question
): string | null {
  const rows = interviews.filter(
    (e) => (e.meeting_stage ?? 'Reunión #1 Exploratoria') === stage
  );
  return bestAnswer(rows, question);
}

function getStageLabels(interviews: EntrevistaRow[]): string[] {
  const present = new Set(
    interviews.map((e) => e.meeting_stage ?? 'Reunión #1 Exploratoria')
  );
  return STAGE_ORDER.filter((s) => present.has(s));
}

function normalizeForCompare(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function classifyQuestion(
  _question: Question,
  propuestaAnswer: string | null,
  entrevistaAnswer: string | null
): QuestionCoverageStatus {
  const hasP = !!propuestaAnswer;
  const hasE = !!entrevistaAnswer;
  if (!hasP && !hasE) return 'missing_both';
  if (hasP && !hasE)  return 'propuesta_only';
  if (!hasP && hasE)  return 'entrevista_only';
  if (normalizeForCompare(propuestaAnswer!) === normalizeForCompare(entrevistaAnswer!)) {
    return 'both_aligned';
  }
  return 'both_differ';
}

/**
 * Build the incremental coverage funnel.
 * Order: Propuesta → R1 → R2 → R3
 * A question is "new" for source S if no earlier source answered it.
 */
function buildIncrementalCoverage(
  items: QuestionAnalysis[],
  stageLabels: string[],
  totalQuestions: number
): IncrementalCoverage[] {
  const round = (n: number) =>
    totalQuestions ? Math.round((n / totalQuestions) * 100) : 0;

  const result: IncrementalCoverage[] = [];
  const covered = new Set<number>(); // question IDs covered so far

  // ── Propuesta ──
  let propAnswered = 0;
  const propNew: number[] = [];
  for (const item of items) {
    if (item.propuestaAnswer) {
      propAnswered++;
      if (!covered.has(item.question.id)) {
        propNew.push(item.question.id);
        covered.add(item.question.id);
      }
    }
  }
  result.push({
    sourceLabel: 'Propuesta',
    answered: propAnswered,
    newAnswers: propNew.length,
    accumulated: covered.size,
    pct: round(propAnswered),
    accumulatedPct: round(covered.size),
  });

  // ── Per stage ──
  for (const stage of stageLabels) {
    const prevSize = covered.size;
    let stageAnswered = 0;
    for (const item of items) {
      const ans = item.stageAnswers.get(stage);
      if (!isEmptyAnswer(ans ?? '')) {
        stageAnswered++;
        covered.add(item.question.id);
      }
    }
    result.push({
      sourceLabel: STAGE_SHORT[stage] ?? stage,
      answered: stageAnswered,
      newAnswers: covered.size - prevSize,
      accumulated: covered.size,
      pct: round(stageAnswered),
      accumulatedPct: round(covered.size),
    });
  }

  return result;
}

// ── Main export ────────────────────────────────────────────────────────────

export function analyzeProvider(provider: ProviderGroup, questions: Question[]): ProviderAnalysis {
  const stageLabels = getStageLabels(provider.interviews);

  const items: QuestionAnalysis[] = questions.map((question) => {
    const propuestaAnswer = bestAnswer(provider.proposals, question);

    // Per-stage answers
    const stageAnswers = new Map<string, string | null>();
    for (const stage of stageLabels) {
      stageAnswers.set(stage, bestAnswerForStage(provider.interviews, stage, question));
    }

    // Merged entrevista (first non-empty in stage order)
    const entrevistaAnswer = bestAnswer(provider.interviews, question);

    // Build answerSources with isNew flag (ordered: propuesta → R1 → R2 → R3)
    const answerSources: AnswerSource[] = [];
    let alreadyCovered = false;

    if (propuestaAnswer) {
      answerSources.push({ label: 'Propuesta', answer: propuestaAnswer, isNew: !alreadyCovered });
      alreadyCovered = true;
    }
    for (const stage of stageLabels) {
      const ans = stageAnswers.get(stage);
      if (ans && !isEmptyAnswer(ans)) {
        answerSources.push({
          label: STAGE_SHORT[stage] ?? stage,
          answer: ans,
          isNew: !alreadyCovered,
        });
        alreadyCovered = true;
      }
    }

    return {
      question,
      propuestaAnswer,
      entrevistaAnswer,
      stageAnswers,
      answerSources,
      status: classifyQuestion(question, propuestaAnswer, entrevistaAnswer),
    };
  });

  const totalQuestions = questions.length;
  const propuestaAnswered = items.filter((i) => i.propuestaAnswer).length;
  const entrevistaAnswered = items.filter((i) => i.entrevistaAnswer).length;
  const combinedAnswered = items.filter((i) => i.propuestaAnswer || i.entrevistaAnswer).length;
  const pct = (n: number) => (totalQuestions ? Math.round((n / totalQuestions) * 100) : 0);

  // Per-stage coverage
  const stageCoverage = new Map<string, StageCoverage>();
  for (const stage of stageLabels) {
    const answered = items.filter(
      (i) => !isEmptyAnswer(i.stageAnswers.get(stage) ?? '')
    ).length;
    stageCoverage.set(stage, { answered, pct: pct(answered) });
  }

  // Incremental funnel
  const incrementalCoverage = buildIncrementalCoverage(items, stageLabels, totalQuestions);

  const missingBoth    = items.filter((i) => i.status === 'missing_both');
  const propuestaOnly  = items.filter((i) => i.status === 'propuesta_only');
  const entrevistaOnly = items.filter((i) => i.status === 'entrevista_only');
  const bothAnswered   = items.filter((i) => i.status === 'both_aligned' || i.status === 'both_differ');
  const conflicts      = items.filter((i) => i.status === 'both_differ');

  const byCategory = new Map<string, QuestionAnalysis[]>();
  for (const item of items) {
    const cat = item.question.category ?? 'General';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }

  const hasProposal  = provider.proposals.length > 0;
  const hasInterview = provider.interviews.length > 0;

  const summaryParts: string[] = [];
  if (hasProposal && hasInterview) {
    summaryParts.push(
      `Propuesta + ${provider.interviews.length} entrevista${provider.interviews.length > 1 ? 's' : ''} (${stageLabels.length} etapa${stageLabels.length > 1 ? 's' : ''}).`
    );
  } else if (hasProposal) {
    summaryParts.push('Solo propuesta documental; conviene agendar entrevista exploratoria.');
  } else if (hasInterview) {
    summaryParts.push('Solo entrevistas; conviene solicitar propuesta formal por escrito.');
  }
  summaryParts.push(
    `Cobertura combinada ${pct(combinedAnswered)}% (${combinedAnswered}/${totalQuestions}).`,
    `Propuesta: ${propuestaAnswered}/${totalQuestions}. Entrevistas: ${entrevistaAnswered}/${totalQuestions}.`
  );
  if (missingBoth.length > 0)
    summaryParts.push(`${missingBoth.length} preguntas sin respuesta en ninguna fuente.`);
  if (conflicts.length > 0)
    summaryParts.push(`${conflicts.length} preguntas con diferencias entre propuesta y entrevistas.`);

  const followUpSuggestions: string[] = [];

  if (!hasInterview && hasProposal && missingBoth.length + propuestaOnly.length > 0) {
    followUpSuggestions.push('Agendar Reunión #1 Exploratoria para validar y completar vacíos.');
  }
  if (hasInterview && !stageLabels.includes('Reunión #2 Cotización') && missingBoth.length > 0) {
    followUpSuggestions.push('Agendar Reunión #2 Cotización para profundizar en preguntas sin cobertura.');
  }

  if (missingBoth.length > 0) {
    followUpSuggestions.push(
      `Priorizar ${missingBoth.length} pregunta${missingBoth.length > 1 ? 's' : ''} sin cobertura:`
    );
    for (const item of missingBoth.slice(0, 12))
      followUpSuggestions.push(`• [${item.question.category}] ${item.question.text}`);
    if (missingBoth.length > 12)
      followUpSuggestions.push(`• … y ${missingBoth.length - 12} más.`);
  }
  if (propuestaOnly.length > 0) {
    followUpSuggestions.push(
      `Confirmar en reunión ${propuestaOnly.length} respuesta${propuestaOnly.length > 1 ? 's' : ''} solo en propuesta:`
    );
    for (const item of propuestaOnly.slice(0, 5))
      followUpSuggestions.push(`• [${item.question.category}] ${item.question.text}`);
  }
  if (entrevistaOnly.length > 0) {
    followUpSuggestions.push(
      `Formalizar ${entrevistaOnly.length} punto${entrevistaOnly.length > 1 ? 's' : ''} solo mencionados en entrevistas:`
    );
    for (const item of entrevistaOnly.slice(0, 5))
      followUpSuggestions.push(`• [${item.question.category}] ${item.question.text}`);
  }
  if (conflicts.length > 0) {
    followUpSuggestions.push('Aclarar diferencias en:');
    for (const item of conflicts.slice(0, 5))
      followUpSuggestions.push(`• [${item.question.category}] ${item.question.text}`);
  }
  if (followUpSuggestions.length === 0 && combinedAnswered === totalQuestions) {
    followUpSuggestions.push('Cobertura completa. Usar la próxima reunión para negociar condiciones finales.');
  }

  return {
    provider,
    totalQuestions,
    propuestaAnswered,
    entrevistaAnswered,
    combinedAnswered,
    propuestaPct: pct(propuestaAnswered),
    entrevistaPct: pct(entrevistaAnswered),
    combinedPct: pct(combinedAnswered),
    stageLabels,
    stageCoverage,
    incrementalCoverage,
    missingBoth,
    propuestaOnly,
    entrevistaOnly,
    bothAnswered,
    conflicts,
    byCategory,
    summary: summaryParts.join(' '),
    followUpSuggestions,
  };
}

export function averageCombinedCoverage(analyses: ProviderAnalysis[]): number {
  if (!analyses.length) return 0;
  return Math.round(analyses.reduce((acc, a) => acc + a.combinedPct, 0) / analyses.length);
}
