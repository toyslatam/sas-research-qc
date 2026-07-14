import type { QcRule, QcRuleHit, QcSurvey } from '@whispper/shared';

function resolveField(survey: QcSurvey, fieldKey: string): unknown {
  const key = fieldKey.trim();
  if (!key) return undefined;

  if (key.startsWith('answers.')) {
    return survey.answers?.[key.slice('answers.'.length)];
  }
  if (key.startsWith('metadata.')) {
    return survey.metadata?.[key.slice('metadata.'.length)];
  }

  const map: Record<string, unknown> = {
    external_id: survey.external_id,
    respondent_code: survey.respondent_code,
    interviewer: survey.interviewer,
    phone: survey.phone,
    address: survey.address,
    latitude: survey.latitude,
    longitude: survey.longitude,
    status: survey.status,
    current_stage: survey.current_stage,
  };
  return map[key];
}

function asString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function evaluateOne(rule: QcRule, survey: QcSurvey): boolean {
  const raw = resolveField(survey, rule.field_key);
  const text = asString(raw).trim();
  const expected = rule.value_text;
  const num = asNumber(raw);
  const expectedNum = asNumber(expected);

  switch (rule.operator) {
    case 'required':
    case 'is_not_empty':
      return text.length > 0;
    case 'is_empty':
      return text.length === 0;
    case 'equals':
      return text.toLowerCase() === expected.trim().toLowerCase();
    case 'not_equals':
      return text.toLowerCase() !== expected.trim().toLowerCase();
    case 'contains':
      return text.toLowerCase().includes(expected.trim().toLowerCase());
    case 'not_contains':
      return !text.toLowerCase().includes(expected.trim().toLowerCase());
    case 'regex': {
      try {
        return new RegExp(expected).test(text);
      } catch {
        return false;
      }
    }
    case 'gt':
      return num != null && expectedNum != null && num > expectedNum;
    case 'gte':
      return num != null && expectedNum != null && num >= expectedNum;
    case 'lt':
      return num != null && expectedNum != null && num < expectedNum;
    case 'lte':
      return num != null && expectedNum != null && num <= expectedNum;
    case 'coords_present':
      return survey.latitude != null && survey.longitude != null;
    default:
      return true;
  }
}

/**
 * Las reglas "pass" significan que la condición se cumple.
 * Para required/coords_present, true = OK.
 * Para is_empty, true = el campo está vacío (posible problema).
 * Convención: un hit se genera cuando la condición es TRUE y la regla
 * está pensada como detector de problema, EXCEPTO required/is_not_empty/coords_present/gt...
 * donde un hit es cuando la condición FALLA.
 */
function isFailure(rule: QcRule, passed: boolean): boolean {
  const okWhenTrue = new Set([
    'required',
    'is_not_empty',
    'equals',
    'contains',
    'regex',
    'gt',
    'gte',
    'lt',
    'lte',
    'coords_present',
    'not_equals',
    'not_contains',
  ]);
  // is_empty: true = vacío = fallo si usamos "campo no debe estar vacío"... 
  // En nuestro modelo is_empty como detector: hit cuando está vacío (passed=true)
  if (rule.operator === 'is_empty') return passed;
  if (okWhenTrue.has(rule.operator)) return !passed;
  return !passed;
}

export function evaluateQcRules(rules: QcRule[], survey: QcSurvey): QcRuleHit[] {
  const applicable = rules
    .filter((r) => r.enabled)
    .filter((r) => r.stage_type === 'any' || r.stage_type === survey.current_stage)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const hits: QcRuleHit[] = [];
  for (const rule of applicable) {
    const passed = evaluateOne(rule, survey);
    if (!isFailure(rule, passed)) continue;
    hits.push({
      rule_id: rule.id,
      rule_name: rule.name,
      stage_type: rule.stage_type,
      field_key: rule.field_key,
      operator: rule.operator,
      severity: rule.severity,
      action: rule.action,
      message:
        rule.description?.trim() ||
        `Regla «${rule.name}» falló en ${rule.field_key} (${rule.operator})`,
    });
  }
  return hits;
}
