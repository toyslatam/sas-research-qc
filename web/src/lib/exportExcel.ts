import type { InterviewResponsesMatrix, Question } from '@whispper/shared';
import * as XLSX from 'xlsx';
import { isEmptyAnswer } from './answers';
import { resolveInterviewAnswer } from './resolveAnswer';
import {
  expandAnswerToSubItemRows,
  questionNumberBySort,
  sortQuestions,
  type SubItemAnswerRow,
} from './subItemParse';

function isEmpty(v: string | undefined): boolean {
  return isEmptyAnswer(v);
}

function interviewLabel(e: InterviewResponsesMatrix['entrevistas'][number]): string {
  const name = e.participant_name?.trim();
  if (name) return name;
  const short = e.external_id.length > 12 ? `${e.external_id.slice(0, 12)}…` : e.external_id;
  return `#${e.id} · ${short}`;
}

function resolveQuestions(matrix: InterviewResponsesMatrix, questions?: Question[]): Question[] {
  if (questions?.length) return sortQuestions(questions);
  return sortQuestions(
    matrix.preguntas.map((text, i) => ({
      id: i + 1,
      project_id: 0,
      text,
      category: 'General',
      category_id: null,
      sub_items: [],
      sort_order: i + 1,
    }))
  );
}

const DETAIL_HEADERS = [
  'ID entrevista',
  'Entrevistado',
  'Código',
  'Proyecto',
  'Fecha',
  'Categoría',
  'Nº pregunta',
  'Código pregunta-subítem',
  'Pregunta',
  'Sub-ítem',
  'Respuesta del sub-ítem',
  'Cobertura',
  'Respuesta completa (pregunta)',
] as const;

function detailRowFromSubItem(
  e: InterviewResponsesMatrix['entrevistas'][number],
  row: SubItemAnswerRow,
  fullAnswer: string
): (string | number)[] {
  return [
    e.id,
    e.participant_name?.trim() || '',
    e.external_id,
    e.proyecto,
    e.fecha,
    row.category,
    row.questionNumber,
    row.code,
    row.questionText,
    row.subItemText ?? '',
    row.answer,
    row.covered ? '✓' : '✗',
    fullAnswer,
  ];
}

function buildDetailSheet(
  matrix: InterviewResponsesMatrix,
  questions: Question[]
): (string | number)[][] {
  const rows: (string | number)[][] = [DETAIL_HEADERS as unknown as string[]];
  const qNums = questionNumberBySort(questions);

  for (const e of matrix.entrevistas) {
    for (const q of questions) {
      const num = qNums.get(q.id) ?? q.sort_order ?? q.id;
      const fullAnswer = resolveInterviewAnswer(e.respuestas, q) ?? '';
      const subRows = expandAnswerToSubItemRows(q, num, fullAnswer);
      const hasSubItems = (q.sub_items?.length ?? 0) > 0;
      const rowsToWrite = hasSubItems ? subRows.filter((row) => row.covered) : subRows;

      if (rowsToWrite.length > 0) {
        for (const row of rowsToWrite) {
          rows.push(detailRowFromSubItem(e, row, fullAnswer));
        }
      } else {
        rows.push(detailRowFromSubItem(e, {
          questionNumber: num,
          code: String(num),
          category: q.category ?? 'General',
          questionText: q.text,
          subItemText: null,
          answer: 'No mencionado',
          covered: false,
        }, fullAnswer));
      }
    }
  }

  return rows;
}

export function downloadResponsesExcel(
  matrix: InterviewResponsesMatrix,
  questions?: Question[],
  filenamePrefix = 'whispper-respuestas'
) {
  const qList = resolveQuestions(matrix, questions);
  const wb = XLSX.utils.book_new();

  // Hoja 1: resumen ancho (sin cambios)
  const headers = ['ID entrevista', 'Entrevistado', 'Código', 'Proyecto', 'Fecha', ...matrix.preguntas];
  const summaryRows = matrix.entrevistas.map((e) => [
    e.id,
    e.participant_name?.trim() || '',
    e.external_id,
    e.proyecto,
    e.fecha,
    ...matrix.preguntas.map((p) => e.respuestas[p] ?? ''),
  ]);

  const wsSummary = XLSX.utils.aoa_to_sheet([headers, ...summaryRows]);
  wsSummary['!cols'] = headers.map((h, i) => ({
    wch: i < 5 ? Math.min(28, Math.max(10, String(h).length)) : 40,
  }));
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen por pregunta');

  // Hoja 2: detalle con códigos 3.1, 3.2…
  const detailRows = buildDetailSheet(matrix, qList);
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 10 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 12 },
    { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 50 }, { wch: 36 },
    { wch: 50 }, { wch: 10 }, { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle sub-ítems');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}-${date}.xlsx`);
}

export { interviewLabel, isEmpty };

export function downloadCoverageExcel(
  matrix: InterviewResponsesMatrix,
  questions?: Question[],
  filenamePrefix = 'whispper-cobertura'
) {
  const qList = resolveQuestions(matrix, questions);
  const wb = XLSX.utils.book_new();
  const total = matrix.entrevistas.length;

  // Hoja 1: Matriz ✓/✗ por pregunta
  const matrixHeaders = ['Pregunta', ...matrix.entrevistas.map((e) => interviewLabel(e))];
  const matrixRows = matrix.preguntas.map((p) => [
    p,
    ...matrix.entrevistas.map((e) => (isEmpty(e.respuestas[p]) ? '✗' : '✓')),
  ]);
  const wsMatrix = XLSX.utils.aoa_to_sheet([matrixHeaders, ...matrixRows]);
  wsMatrix['!cols'] = [{ wch: 60 }, ...matrix.entrevistas.map(() => ({ wch: 20 }))];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Matriz cobertura');

  // Hoja 2: Matriz ✓/✗ por sub-ítem (3.1, 3.2…)
  const qNums = questionNumberBySort(qList);
  const subItemMatrixRows: (string | number)[][] = [];

  for (const q of qList) {
    const num = qNums.get(q.id) ?? q.sort_order ?? q.id;
    const templates = expandAnswerToSubItemRows(q, num, '');

    for (const template of templates) {
      const label = template.subItemText
        ? `${template.code} — ${template.subItemText}`
        : `${template.code} — ${q.text}`;
      subItemMatrixRows.push([
        label,
        ...matrix.entrevistas.map((e) => {
          const expanded = expandAnswerToSubItemRows(q, num, resolveInterviewAnswer(e.respuestas, q));
          const match = expanded.find((r) => r.code === template.code);
          return match?.covered ? '✓' : '✗';
        }),
      ]);
    }
  }

  const wsSubMatrix = XLSX.utils.aoa_to_sheet([
    ['Código — Sub-ítem / Pregunta', ...matrix.entrevistas.map((e) => interviewLabel(e))],
    ...subItemMatrixRows,
  ]);
  wsSubMatrix['!cols'] = [{ wch: 55 }, ...matrix.entrevistas.map(() => ({ wch: 20 }))];
  XLSX.utils.book_append_sheet(wb, wsSubMatrix, 'Cobertura sub-ítems');

  // Hoja 3: Preguntas con más faltantes
  const qRows = matrix.preguntas
    .map((p) => {
      const answered = matrix.entrevistas.filter((e) => !isEmpty(e.respuestas[p])).length;
      const missing = matrix.entrevistas
        .filter((e) => isEmpty(e.respuestas[p]))
        .map((e) => interviewLabel(e))
        .join(', ');
      return { p, answered, pct: total ? Math.round((answered / total) * 100) : 0, missing };
    })
    .sort((a, b) => a.pct - b.pct);

  const wsQ = XLSX.utils.aoa_to_sheet([
    ['Pregunta', 'Respondidas', 'Total', 'Cobertura %', 'Faltante en'],
    ...qRows.map((r) => [r.p, r.answered, total, `${r.pct}%`, r.missing]),
  ]);
  wsQ['!cols'] = [{ wch: 60 }, { wch: 12 }, { wch: 8 }, { wch: 13 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsQ, 'Preguntas faltantes');

  // Hoja 4: Entrevistas incompletas
  const eRows = matrix.entrevistas
    .map((e) => {
      const answered = matrix.preguntas.filter((p) => !isEmpty(e.respuestas[p])).length;
      const missing = matrix.preguntas.filter((p) => isEmpty(e.respuestas[p])).join('\n');
      return {
        label: interviewLabel(e),
        proyecto: e.proyecto,
        fecha: e.fecha,
        answered,
        pct: matrix.preguntas.length ? Math.round((answered / matrix.preguntas.length) * 100) : 0,
        missing,
      };
    })
    .sort((a, b) => a.pct - b.pct);

  const wsE = XLSX.utils.aoa_to_sheet([
    ['Entrevistado', 'Proyecto', 'Fecha', 'Respondidas', 'Total', 'Cobertura %', 'Preguntas faltantes'],
    ...eRows.map((r) => [r.label, r.proyecto, r.fecha, r.answered, matrix.preguntas.length, `${r.pct}%`, r.missing]),
  ]);
  wsE['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 13 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsE, 'Entrevistas incompletas');

  // Hoja 5: Detalle largo (misma estructura que export por entrevista)
  const detailRows = buildDetailSheet(matrix, qList);
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 10 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 12 },
    { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 50 }, { wch: 36 },
    { wch: 50 }, { wch: 10 }, { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle sub-ítems');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}-${date}.xlsx`);
}
