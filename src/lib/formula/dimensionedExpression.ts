import { tokenize, type Token } from './expressionParser';

export type Dimension = readonly [number, number, number, number];
export interface DimensionedValue { value: number; dimension: Dimension }
export interface UnitDefinition { factor: number; dimension: Dimension }
const scalar: Dimension = [0, 0, 0, 0];
const pressure: Dimension = [1, -1, -2, 0];
const density: Dimension = [1, -3, 0, 0];
const registry: Record<string, UnitDefinition> = {
  '1': { factor: 1, dimension: scalar }, dimensionless: { factor: 1, dimension: scalar }, fraction: { factor: 1, dimension: scalar }, '%': { factor: 0.01, dimension: scalar },
  Pa: { factor: 1, dimension: pressure }, kPa: { factor: 1e3, dimension: pressure }, MPa: { factor: 1e6, dimension: pressure }, GPa: { factor: 1e9, dimension: pressure },
  'g/cm3': { factor: 1e3, dimension: density }, 'kg/m3': { factor: 1, dimension: density },
  'g/10min': { factor: 1 / 600000, dimension: [1, 0, -1, 0] },
  'J/m2': { factor: 1, dimension: [1, 0, -2, 0] }, 'kJ/m2': { factor: 1e3, dimension: [1, 0, -2, 0] },
  'MPa*cm3/g': { factor: 1e3, dimension: [0, 2, -2, 0] },
  'MPa*kJ/m2': { factor: 1e9, dimension: [2, -1, -4, 0] },
  kg: { factor: 1, dimension: [1, 0, 0, 0] }, g: { factor: 0.001, dimension: [1, 0, 0, 0] },
  m: { factor: 1, dimension: [0, 1, 0, 0] }, s: { factor: 1, dimension: [0, 0, 1, 0] }, K: { factor: 1, dimension: [0, 0, 0, 1] },
};

export function unitDefinition(unit: string): UnitDefinition | undefined {
  const normalized = unit.normalize('NFKC').replace(/\s+/g, '').replace(/[·⋅]/g, '*').replace(/\^([23])/g, '$1');
  return Object.hasOwn(registry, normalized) ? registry[normalized] : undefined;
}
export function sameDimension(left: Dimension, right: Dimension): boolean {
  return left.every((value, index) => Math.abs(value - right[index]) <= 1e-12);
}
function checked(value: number, nonzero = false): number {
  if (!Number.isFinite(value) || (nonzero && value === 0)) throw new Error('NONFINITE_OR_UNDERFLOW');
  return value;
}
export function toSI(value: number, unit: UnitDefinition): DimensionedValue {
  return { value: checked(value * unit.factor, value !== 0), dimension: unit.dimension };
}
export function fromSI(value: DimensionedValue, unit: UnitDefinition): number {
  if (!sameDimension(value.dimension, unit.dimension)) throw new Error('INCOMPATIBLE_OUTPUT_DIMENSION');
  return checked(value.value / unit.factor, value.value !== 0);
}
type Evaluator = (properties: Record<string, DimensionedValue>) => DimensionedValue;
function requireSame(left: DimensionedValue, right: DimensionedValue): void {
  if (!sameDimension(left.dimension, right.dimension)) throw new Error('INCOMPATIBLE_DIMENSIONS');
}
function binary(operator: string, a: DimensionedValue, b: DimensionedValue): DimensionedValue {
  if (['+', '-', '%', '||', '&&'].includes(operator)) {
    requireSame(a, b);
    const value = operator === '+' ? a.value + b.value : operator === '-' ? a.value - b.value : operator === '%' ? a.value % b.value : operator === '||' ? a.value || b.value : a.value && b.value;
    return { value: checked(value), dimension: a.dimension };
  }
  if (operator === '*' || operator === '/') {
    const value = operator === '*' ? a.value * b.value : a.value / b.value;
    return { value: checked(value, a.value !== 0 && b.value !== 0), dimension: a.dimension.map((v, i) => v + (operator === '*' ? 1 : -1) * b.dimension[i]) as unknown as Dimension };
  }
  if (!sameDimension(b.dimension, scalar)) throw new Error('DIMENSIONED_EXPONENT');
  return { value: checked(a.value ** b.value, a.value !== 0), dimension: a.dimension.map(v => v * b.value) as unknown as Dimension };
}

/** Reuses the bounded expression lexer; no dynamic JavaScript execution. */
export function compileDimensionedExpression(expression: string): Evaluator {
  const tokens = tokenize(expression);
  let cursor = 0;
  const current = () => tokens[cursor];
  const take = () => tokens[cursor++];
  const expect = (type: Token['type']) => { if (take().type !== type) throw new Error(`Expected ${type}`); };
  const precedence: Record<string, number> = { '||': 1, '&&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '%': 4, '^': 5, '**': 5 };
  function primary(): Evaluator {
    const token = take();
    if (token.type === 'number') return () => ({ value: Number(token.value), dimension: scalar });
    if (token.type === 'property') return properties => {
      const value = properties[token.value];
      if (!value) throw new Error(`MISSING_TYPED_DEPENDENCY:${token.value}`);
      return value;
    };
    if (token.type === 'operator' && ['+', '-'].includes(token.value)) {
      const operand = parse(5);
      return properties => { const value = operand(properties); return { ...value, value: (token.value === '-' ? -1 : 1) * value.value }; };
    }
    if (token.type === 'leftParen') { const value = parse(0); expect('rightParen'); return value; }
    if (token.type === 'identifier') {
      const name = token.value.replace(/^Math\./, '');
      if (name === 'PI' || name === 'E') return () => ({ value: name === 'PI' ? Math.PI : Math.E, dimension: scalar });
      expect('leftParen');
      const args: Evaluator[] = [];
      if (current().type !== 'rightParen') {
        args.push(parse(0));
        while (current().type === 'comma') { take(); args.push(parse(0)); }
      }
      expect('rightParen');
      return properties => {
        const values = args.map(arg => arg(properties));
        const first = values[0];
        if (!first) throw new Error('MISSING_FUNCTION_ARGUMENT');
        if (name === 'pow' && values.length === 2) return binary('^', first, values[1]);
        if (name === 'min' || name === 'max') {
          values.forEach(value => requireSame(first, value));
          return { ...first, value: checked(values.reduce((best, value) => name === 'min' ? Math.min(best, value.value) : Math.max(best, value.value), first.value)) };
        }
        if (values.length !== 1) throw new Error('INVALID_FUNCTION_ARITY');
        if (name === 'abs') return { ...first, value: Math.abs(first.value) };
        if (name === 'sqrt') return binary('^', first, { value: 0.5, dimension: scalar });
        if (!sameDimension(first.dimension, scalar)) throw new Error('FUNCTION_REQUIRES_DIMENSIONLESS_ARGUMENT');
        const functions: Record<string, (value: number) => number> = { log: Math.log, log10: Math.log10, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan };
        if (!functions[name]) throw new Error('UNSUPPORTED_FUNCTION');
        return { value: checked(functions[name](first.value), name === 'exp'), dimension: scalar };
      };
    }
    throw new Error(`Unsupported token ${token.value}`);
  }
  function parse(minimum: number): Evaluator {
    let left = primary();
    while (current().type === 'operator' && (precedence[current().value] ?? -1) >= minimum) {
      const operator = take().value;
      const right = parse(precedence[operator] + (['^', '**'].includes(operator) ? 0 : 1));
      const previous = left;
      left = properties => binary(operator, previous(properties), right(properties));
    }
    return left;
  }
  const evaluator = parse(0);
  expect('eof');
  return evaluator;
}
