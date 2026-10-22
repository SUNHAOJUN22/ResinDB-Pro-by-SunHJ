import type { PropertyValue } from '@/types/index';
import { admittedPropertyValue } from '@/lib/propertyAdmission';
import { parseFiniteReal } from '@/lib/quantityRecord';

type PropertyCondition =
  | { operator: 'text'; value: string }
  | { operator: 'range'; value: number; max: number }
  | { operator: '>' | '>=' | '<' | '<=' | '='; value: number }
  | { operator: 'invalid' };
const NUMBER_SOURCE = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const NUMERIC = new RegExp(`^${NUMBER_SOURCE}$`);
const RANGE = new RegExp(`^(${NUMBER_SOURCE})-(${NUMBER_SOURCE})$`);

/** Parse a whole condition; comparison typos never become prefix numbers. */
export function parsePropertyCondition(input: string): PropertyCondition {
  const text = input.trim();
  const range = RANGE.exec(text);
  if (range) {
    const value = parseFiniteReal(range[1]);
    const max = parseFiniteReal(range[2]);
    return value !== null && max !== null && value <= max ? { operator: 'range', value, max } : { operator: 'invalid' };
  }
  const comparison = /^(>=|<=|>|<|=)(.*)$/.exec(text);
  if (comparison) {
    const value = parseFiniteReal(comparison[2]);
    return value === null ? { operator: 'invalid' } : { operator: comparison[1] as '>' | '>=' | '<' | '<=' | '=', value };
  }
  const value = parseFiniteReal(text);
  if (value !== null) return { operator: '=', value };
  if (NUMERIC.test(text) || !text) return { operator: 'invalid' };
  return { operator: 'text', value: text.toLowerCase() };
}

export function matchesPropertyCondition(property: PropertyValue | undefined, condition: PropertyCondition): boolean {
  if (!property || condition.operator === 'invalid') return false;
  if (condition.operator === 'text') return String(property.value).toLowerCase().includes(condition.value);
  const value = admittedPropertyValue(property);
  if (value === null) return false;
  switch (condition.operator) {
    case '>': return value > condition.value;
    case '>=': return value >= condition.value;
    case '<': return value < condition.value;
    case '<=': return value <= condition.value;
    case '=': return value === condition.value;
    case 'range': return value >= condition.value && value <= condition.max;
  }
}
