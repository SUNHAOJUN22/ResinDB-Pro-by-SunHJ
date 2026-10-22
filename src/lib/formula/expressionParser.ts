import { parseFiniteReal } from '@/lib/quantityRecord';
export type PropertyDictionary = Record<string, number>;
export type Evaluator = (properties: PropertyDictionary) => number;

type TokenType =
  | 'number'
  | 'property'
  | 'identifier'
  | 'operator'
  | 'leftParen'
  | 'rightParen'
  | 'comma'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const UNARY_FUNCTIONS: Readonly<Record<string, (value: number) => number>> = {
  abs: Math.abs,
  sqrt: Math.sqrt,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};

function checked(value: number, nonzero = false): number {
  if (!Number.isFinite(value) || (nonzero && value === 0)) throw new Error('NONFINITE_OR_UNDERFLOW');
  return value;
}
function checkedPower(base: number, exponent: number): number {
  return checked(Math.pow(base, exponent), base !== 0);
}

export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;

  while (position < expression.length) {
    const source = expression.slice(position);
    const whitespace = source.match(/^\s+/);
    if (whitespace) {
      position += whitespace[0].length;
      continue;
    }

    const property = source.match(/^(?:props|p)\[(['"])(.*?)\1\]/i);
    if (property) {
      tokens.push({ type: 'property', value: property[2], position });
      position += property[0].length;
      continue;
    }

    const number = source.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      if (parseFiniteReal(number[0]) === null) throw new Error(`Non-finite or underflowing numeric literal at ${position}`);
      tokens.push({ type: 'number', value: number[0], position });
      position += number[0].length;
      continue;
    }

    const identifier = source.match(/^[A-Za-z_][A-Za-z0-9_.]*/);
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0], position });
      position += identifier[0].length;
      continue;
    }

    if (source.startsWith('**')) {
      tokens.push({ type: 'operator', value: '**', position });
      position += 2;
      continue;
    }

    if (source.startsWith('||')) {
      tokens.push({ type: 'operator', value: '||', position });
      position += 2;
      continue;
    }

    if (source.startsWith('&&')) {
      tokens.push({ type: 'operator', value: '&&', position });
      position += 2;
      continue;
    }

    const character = expression[position];
    if ('+-*/%^'.includes(character)) {
      tokens.push({ type: 'operator', value: character, position });
      position += 1;
      continue;
    }
    if (character === '(') {
      tokens.push({ type: 'leftParen', value: character, position });
      position += 1;
      continue;
    }
    if (character === ')') {
      tokens.push({ type: 'rightParen', value: character, position });
      position += 1;
      continue;
    }
    if (character === ',') {
      tokens.push({ type: 'comma', value: character, position });
      position += 1;
      continue;
    }

    throw new Error(`Unsupported token at position ${position}: ${character}`);
  }

  tokens.push({ type: 'eof', value: '', position: expression.length });
  return tokens;
}

class ArithmeticParser {
  private readonly tokens: Token[];
  private cursor = 0;

  constructor(expression: string) {
    this.tokens = tokenize(expression);
  }

  parse(): Evaluator {
    const evaluator = this.parseLogicalOr();
    this.expect('eof');
    return evaluator;
  }

  private current(): Token {
    return this.tokens[this.cursor];
  }

  private consume(): Token {
    const token = this.current();
    this.cursor += 1;
    return token;
  }

  private match(type: TokenType, value?: string): boolean {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      return false;
    }
    this.cursor += 1;
    return true;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      const expected = value === undefined ? type : `${type} "${value}"`;
      throw new Error(
        `Expected ${expected} at position ${token.position}, received ${token.type} "${token.value}"`,
      );
    }
    return this.consume();
  }

  private parseLogicalOr(): Evaluator {
    let left = this.parseLogicalAnd();

    while (
      this.current().type === 'operator' &&
      this.current().value === '||'
    ) {
      this.consume();
      const right = this.parseLogicalAnd();
      const previous = left;
      left = (properties) => {
        const valL = checked(previous(properties));
        if (Number.isFinite(valL) && valL !== 0) return valL;
        return right(properties);
      };
    }

    return left;
  }

  private parseLogicalAnd(): Evaluator {
    let left = this.parseAdditive();

    while (
      this.current().type === 'operator' &&
      this.current().value === '&&'
    ) {
      this.consume();
      const right = this.parseAdditive();
      const previous = left;
      left = (properties) => {
        const valL = checked(previous(properties));
        if (!Number.isFinite(valL) || valL === 0) return valL;
        return right(properties);
      };
    }

    return left;
  }

  private parseAdditive(): Evaluator {
    let left = this.parseMultiplicative();

    while (
      this.current().type === 'operator' &&
      (this.current().value === '+' || this.current().value === '-')
    ) {
      const operator = this.consume().value;
      const right = this.parseMultiplicative();
      const previous = left;
      left =
        operator === '+'
          ? (properties) => checked(previous(properties) + right(properties))
          : (properties) => checked(previous(properties) - right(properties));
    }

    return left;
  }

  private parseMultiplicative(): Evaluator {
    let left = this.parseUnary();

    while (
      this.current().type === 'operator' &&
      ['*', '/', '%'].includes(this.current().value)
    ) {
      const operator = this.consume().value;
      const right = this.parseUnary();
      const previous = left;

      if (operator === '*') {
        left = (properties) => { const a = previous(properties), b = right(properties); return checked(a * b, a !== 0 && b !== 0); };
      } else if (operator === '/') {
        left = (properties) => { const a = previous(properties), b = right(properties); return checked(a / b, a !== 0); };
      } else {
        left = (properties) => checked(previous(properties) % right(properties));
      }
    }

    return left;
  }

  private parsePower(): Evaluator {
    const left = this.parsePrimary();
    if (
      this.current().type === 'operator' &&
      (this.current().value === '**' || this.current().value === '^')
    ) {
      this.consume();
      const right = this.parseUnary();
      return (properties) => checkedPower(left(properties), right(properties));
    }
    return left;
  }

  private parseUnary(): Evaluator {
    if (this.match('operator', '+')) return this.parseUnary();
    if (this.match('operator', '-')) {
      const operand = this.parseUnary();
      return (properties) => -operand(properties);
    }
    return this.parsePower();
  }

  private parsePrimary(): Evaluator {
    const token = this.current();

    if (token.type === 'number') {
      this.consume();
      const value = Number(token.value);
      return () => value;
    }

    if (token.type === 'property') {
      this.consume();
      const propertyName = token.value;
      return (properties) => checked(properties[propertyName]);
    }

    if (token.type === 'leftParen') {
      this.consume();
      const expression = this.parseLogicalOr();
      this.expect('rightParen');
      return expression;
    }

    if (token.type === 'identifier') {
      this.consume();
      const normalized = token.value.replace(/^Math\./, '');
      if (normalized === 'PI') return () => Math.PI;
      if (normalized === 'E') return () => Math.E;

      this.expect('leftParen');
      const args: Evaluator[] = [];
      if (!this.match('rightParen')) {
        do {
          args.push(this.parseLogicalOr());
        } while (this.match('comma'));
        this.expect('rightParen');
      }

      if (normalized in UNARY_FUNCTIONS) {
        if (args.length !== 1) {
          throw new Error(`${normalized} expects exactly one argument`);
        }
        const fn = UNARY_FUNCTIONS[normalized];
        return (properties) => checked(fn(args[0](properties)), normalized === 'exp');
      }
      if (normalized === 'pow') {
        if (args.length !== 2) throw new Error('pow expects exactly two arguments');
        return (properties) => checkedPower(args[0](properties), args[1](properties));
      }
      if (normalized === 'min' || normalized === 'max') {
        if (args.length === 0) throw new Error(`${normalized} expects at least one argument`);
        const fn = normalized === 'min' ? Math.min : Math.max;
        return (properties) => args.map(argument => checked(argument(properties))).reduce((a, b) => fn(a, b));
      }

      throw new Error(`Unsupported identifier: ${token.value}`);
    }

    throw new Error(`Unexpected token "${token.value}" at position ${token.position}`);
  }
}

export function compileFormulaExpression(expression: string): Evaluator {
  return new ArithmeticParser(expression).parse();
}
