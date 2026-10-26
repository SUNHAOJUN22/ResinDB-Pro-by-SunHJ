import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Product, PropertyValue } from '@/types/index';
import { canonicalizeCoreProperty } from '@/lib/quantityRecord';
import { assessProductForScreening } from '@/lib/qaScreening';
import { PdfQaReportTemplate } from '@/components/features/Export/PdfQaReportTemplate';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'en' }) }));

const thresholds = { mfrMin: 1, mfrMax: 20, tensileMinMpa: 20 };
const mfr = (): PropertyValue => ({
  value: 10, unit: 'g/10 min', method: 'ISO 1133', temperature: 230, load: 2.16,
  referenceId: 'fixture://mfr', sampleId: 'synthetic-S1',
});
const tensile = (value = 30, unit = 'MPa'): PropertyValue => ({
  value, unit, method: 'ISO 527', referenceId: 'fixture://tensile', sampleId: 'synthetic-S1',
});
function product(stress = tensile(), flow = mfr()): Product {
  return {
    id: 'synthetic-P1', gradeName: 'Synthetic local specimen', manufacturerId: 'fixture', manufacturer: 'Fixture',
    categoryIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    properties: { MFR: flow, 'Tensile yield strength': stress },
  };
}
function withQuantity(key: string, property: PropertyValue): PropertyValue {
  return { ...property, quantity: canonicalizeCoreProperty(key, property) };
}
function rejected(key: string, property: PropertyValue, status: 'UNKNOWN' | 'INVALID'): PropertyValue {
  const governed = withQuantity(key, property);
  governed.quantity = {
    raw: governed.quantity!.raw, status, reasonCodes: ['FIXTURE_EXPLICIT_REJECTION'], provenanceRefs: [],
  };
  return governed;
}

describe('QA export observation admission', () => {
  it.each([
    [30_000_000, 'Pa'], [30_000, 'kPa'], [30, 'MPa'], [0.03, 'GPa'],
  ])('converts the declared legacy pressure %s %s using SI prefixes', (value, unit) => {
    const input = product(tensile(value as number, unit as string));
    const original = structuredClone(input);
    const result = assessProductForScreening(input, thresholds);
    expect(result.status).toBe('ASSESSED_WITHIN_DECLARED_THRESHOLD');
    expect(result.criteria[1].canonicalValue).toBeCloseTo(30, 12);
    expect(input).toEqual(original);
  });

  it.each(['g/10 min', 'g/10 mins', 'g/(10 min)', 'g*10min-1'])(
    'keeps the existing explicit legacy MFR spelling %s with its conditions', unit => {
      const result = assessProductForScreening(product(tensile(), { ...mfr(), value: '10', unit }), thresholds);
      expect(result.status).toBe('ASSESSED_WITHIN_DECLARED_THRESHOLD');
      expect(result.criteria[0].canonicalValue).toBe(10);
    },
  );

  it.each([
    ['MFR', 'UNKNOWN'], ['MFR', 'INVALID'], ['TENSILE', 'UNKNOWN'], ['TENSILE', 'INVALID'],
  ] as const)('keeps %s %s authoritative instead of resurrecting raw data', (criterion, status) => {
    const input = criterion === 'MFR'
      ? product(tensile(), rejected('mfr', mfr(), status))
      : product(rejected('tensileYield', tensile(), status));
    const original = structuredClone(input);
    const result = assessProductForScreening(input, thresholds);
    const rejectedCriterion = result.criteria[criterion === 'MFR' ? 0 : 1];
    expect(result.status).toBe('NOT_ASSESSED');
    expect(rejectedCriterion.status).toBe('NOT_ASSESSED');
    expect(rejectedCriterion.canonicalValue).toBeNull();
    expect(input).toEqual(original);
  });

  it.each([false, true])('refuses mPa as MPa, with stored quantity=%s', stored => {
    const raw = tensile(30, 'mPa');
    const result = assessProductForScreening(product(stored ? withQuantity('tensileYield', raw) : raw), thresholds);
    expect(result.status).toBe('NOT_ASSESSED');
    expect(result.criteria[1].canonicalValue).toBeNull();
    // Independent SI scale: milli / mega, not the implementation's unit helper.
    expect(30 * 1e-3 / 1e6).toBe(3e-8);
  });

  it('rejects a forged VALID canonical value rather than recomputing a passing result', () => {
    const stress = withQuantity('tensileYield', tensile());
    stress.quantity!.canonical!.value = 300;
    const result = assessProductForScreening(product(stress), thresholds);
    expect(result.status).toBe('NOT_ASSESSED');
    expect(result.criteria[1].canonicalValue).toBeNull();
  });

  it('rejects a VALID MFR whose displayed temperature disagrees with its raw observation', () => {
    const flow = { ...withQuantity('mfr', mfr()), temperature: 190 };
    const result = assessProductForScreening(product(tensile(), flow), thresholds);
    expect(result.status).toBe('NOT_ASSESSED');
    expect(result.criteria[0].canonicalValue).toBeNull();
  });

  it('keeps a verified canonical display with the original GPa observation', () => {
    const stress = { ...withQuantity('tensileYield', tensile(0.03, 'GPa')), value: 30, unit: 'MPa' };
    const result = assessProductForScreening(product(stress), thresholds);
    expect(result.status).toBe('ASSESSED_WITHIN_DECLARED_THRESHOLD');
    expect(result.criteria[1].canonicalValue).toBe(30);
  });

  it.each(['control', 'mPa', 'UNKNOWN', 'INVALID'] as const)(
    'renders the actual PDF worksheet with an honest %s observation status', scenario => {
      const stress = scenario === 'control' ? tensile()
        : scenario === 'mPa' ? withQuantity('tensileYield', tensile(30, 'mPa'))
          : rejected('tensileYield', tensile(), scenario);
      const container = document.createElement('div');
      container.innerHTML = renderToStaticMarkup(<PdfQaReportTemplate
        products={[product(stress)]} analyst="Synthetic fixture" worksheetNo="FIXTURE" notes="" thresholds={thresholds}
      />);
      const articleStatus = container.querySelector('article > div > span')?.textContent;
      const stressCells = container.querySelectorAll('tbody tr')[1].querySelectorAll('td');
      expect(articleStatus).toBe(scenario === 'control' ? 'Assessed: within declared threshold' : 'Not assessed');
      expect(stressCells[2].textContent).toBe(scenario === 'control' ? '30 MPa' : '—');
      expect(stressCells[4].textContent).toContain(scenario === 'control' ? 'Assessed: within declared threshold' : 'Not assessed');
      expect(container.textContent).toContain('No material-release or regulatory decision is made');
    },
  );
});
