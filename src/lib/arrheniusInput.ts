import type { Product } from '@/types/index';
import { canonicalizeQuantity, parseFiniteReal, type QuantityContract } from '@/lib/quantityRecord';

/** This is an input contract, not evidence that Arrhenius extrapolation is valid. */
const LIFETIME_HOURS: QuantityContract = {
  key: 'time-to-failure', dimension: 'time', canonicalUnit: 'h',
  factors: { s: 1 / 3600, sec: 1 / 3600, min: 1 / 60, h: 1, hr: 1, d: 24 },
  strictlyPositive: true, requiresMethod: true,
};

function rejectObservation(key: string, reason: string): never {
  throw new Error(`${key}: ${reason}`);
}

function declaredText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export interface ArrheniusLifetimeInput {
  points: { tempC: number; time: number }[];
  sourceKeys: string[];
  observations: { key: string; sampleId?: string; batchId?: string; provenanceRefs: string[] }[];
  failureCriterion: string;
  seriesId: string;
  method: string;
}

/** Accept only explicit time-to-failure declarations from one test series.
 * OIT is an induction-time assay and is never automatically promoted to life.
 * Existing raw values, quantities and product records are not mutated.
 */
export function extractArrheniusLifetimePoints(product: Product): ArrheniusLifetimeInput {
  const points: ArrheniusLifetimeInput['points'] = [];
  const sourceKeys: string[] = [];
  const observations: ArrheniusLifetimeInput['observations'] = [];
  let cohort: Pick<ArrheniusLifetimeInput, 'failureCriterion' | 'seriesId' | 'method'> | undefined;
  for (const [key, property] of Object.entries(product.properties)) {
    const quantity = property.quantity;
    const raw = quantity?.raw;
    const conditions = raw?.conditions;
    if (conditions?.observationKind !== 'time-to-failure') continue;
    if (/(?:\boit\b|氧化诱导)/i.test(key.replace(/_/g, ' '))) rejectObservation(key, 'OIT is not a time-to-failure observation.');
    if (!quantity || quantity.status !== 'VALID' || !raw) rejectObservation(key, 'A VALID time quantity is required.');
    const criterion = declaredText(conditions.failureCriterion);
    const seriesId = declaredText(conditions.agingSeriesId);
    const method = declaredText(raw.method ?? raw.standard);
    const tempC = parseFiniteReal(conditions.temperatureC);
    if (!criterion || !seriesId || !method || tempC === null || tempC <= -273.15) {
      rejectObservation(key, 'Declare failureCriterion, agingSeriesId, method/standard and temperatureC above absolute zero.');
    }
    if (/(?:\boit\b|oxidation[ -]*induction|氧化诱导)/i.test([key, method, raw.standard, criterion].join(' ').replace(/_/g, ' '))) {
      rejectObservation(key, 'Induction-time assays cannot be automatically used as time-to-failure data.');
    }
    // Reject disagreement between the displayed property and its original record.
    if (parseFiniteReal(property.value) !== parseFiniteReal(raw.value)
        || property.unit !== raw.unit
        || (property.method !== undefined && property.method !== raw.method)
        || (property.standard !== undefined && property.standard !== raw.standard)) {
      rejectObservation(key, 'Displayed value/unit/method must match the raw time declaration.');
    }
    // Unit spellings are explicit; do not reinterpret a different physical unit.
    if (!raw.unit || !Object.hasOwn(LIFETIME_HOURS.factors, raw.unit.trim())) rejectObservation(key, 'Unsupported time unit; use s, sec, min, h, hr or d.');
    const converted = canonicalizeQuantity(raw, LIFETIME_HOURS, quantity.provenanceRefs);
    const canonical = quantity.canonical;
    const stored = canonical ? canonicalizeQuantity({ value: canonical.value, unit: canonical.unit, method }, LIFETIME_HOURS) : null;
    const value = converted.canonical?.value;
    const storedValue = stored?.canonical?.value;
    if (converted.status !== 'VALID' || canonical?.dimension !== 'time'
        || stored?.status !== 'VALID' || value === undefined || storedValue === undefined
        || Math.abs(value - storedValue) > 8 * Number.EPSILON * Math.max(Math.abs(value), Math.abs(storedValue))) {
      rejectObservation(key, 'Canonical time does not agree with the declared raw measurement.');
    }
    const current = { failureCriterion: criterion!, seriesId: seriesId!, method: method! };
    if (cohort && (cohort.failureCriterion !== current.failureCriterion
        || cohort.seriesId !== current.seriesId || cohort.method !== current.method)) {
      rejectObservation(key, 'All extracted points must share the same failure criterion, test series and method.');
    }
    cohort = current;
    points.push({ tempC: tempC!, time: value! });
    sourceKeys.push(key);
    observations.push({ key, sampleId: raw.sampleId, batchId: raw.batchId, provenanceRefs: [...quantity.provenanceRefs] });
  }
  if (!cohort || points.length < 2 || new Set(points.map(point => point.tempC)).size < 2) {
    throw new Error('At least two explicit time-to-failure observations at distinct temperatures are required; temperature-tagged OIT or strength values are not lifetime data.');
  }
  return { points, sourceKeys, observations, ...cohort };
}
