import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aggregateStatus,
  isFiniteScientificNumber,
  mayClaimExternalAcceptance,
  validateScientificQuantity,
} from '../skillInteroperabilityV19';

function loadJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(process.cwd(), relative), 'utf8')) as Record<string, unknown>;
}

describe('V19 Skill interoperability and routing contracts', () => {
  it('keeps missing and Boolean values distinct from physical zero', () => {
    expect(isFiniteScientificNumber(0)).toBe(true);
    expect(isFiniteScientificNumber(true)).toBe(false);
    expect(isFiniteScientificNumber(Number.NaN)).toBe(false);
    expect(validateScientificQuantity({ value: true, unit: 'MPa', dimension: 'pressure', conditions: [], uncertainty: {}, provenance_refs: [] })).not.toEqual([]);
  });

  it('aggregates status fail closed and never grants external acceptance', () => {
    expect(aggregateStatus(['PASS', 'HOLD'])).toBe('HOLD');
    expect(aggregateStatus(['PASS', 'FAIL'])).toBe('FAIL');
    expect(aggregateStatus([])).toBe('NOT_EVALUATED');
    expect(mayClaimExternalAcceptance('PASS')).toBe(false);
  });

  it('validates bilingual static routing cases without claiming model execution', () => {
    const base = '.agents/skills/resindb-science-screening-audit/evals';
    const evals = loadJson(`${base}/evals.json`);
    const status = loadJson(`${base}/MODEL_EVAL_STATUS.json`);
    const capture = loadJson(`${base}/MODEL_CAPTURE_TEMPLATE.json`);
    const cases = evals.cases as Array<Record<string, unknown>>;
    expect(cases).toHaveLength(6);
    expect(new Set(cases.map((item) => item.id)).size).toBe(6);
    expect(new Set(cases.map((item) => item.language))).toEqual(new Set(['en', 'zh']));
    expect(new Set(cases.map((item) => item.split))).toEqual(new Set(['train', 'validation']));
    expect(new Set(cases.map((item) => item.category))).toEqual(new Set(['workflow', 'boundary', 'negative']));
    expect(status.status).toBe('NOT_RUN');
    expect(capture.status).toBe('NOT_RUN');
  });
});
