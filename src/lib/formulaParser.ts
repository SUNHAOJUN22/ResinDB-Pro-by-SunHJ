import { logger } from '@/lib/logger';
import { FormulaConfig, Product } from '@/types/index';

type PropertyDictionary = Record<string, number>;
type Evaluator = (properties: PropertyDictionary) => number;

type TokenType =
  | 'number'
  | 'property'
  | 'identifier'
  | 'operator'
  | 'leftParen'
  | 'rightParen'
  | 'comma'
  | 'eof';

interface Token {
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

function tokenize(expression: string): Token[] {
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
    const evaluator = this.parseAdditive();
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
          ? (properties) => previous(properties) + right(properties)
          : (properties) => previous(properties) - right(properties);
    }

    return left;
  }

  private parseMultiplicative(): Evaluator {
    let left = this.parsePower();

    while (
      this.current().type === 'operator' &&
      ['*', '/', '%'].includes(this.current().value)
    ) {
      const operator = this.consume().value;
      const right = this.parsePower();
      const previous = left;

      if (operator === '*') {
        left = (properties) => previous(properties) * right(properties);
      } else if (operator === '/') {
        left = (properties) => previous(properties) / right(properties);
      } else {
        left = (properties) => previous(properties) % right(properties);
      }
    }

    return left;
  }

  private parsePower(): Evaluator {
    const left = this.parseUnary();
    if (
      this.current().type === 'operator' &&
      (this.current().value === '**' || this.current().value === '^')
    ) {
      this.consume();
      const right = this.parsePower();
      return (properties) => Math.pow(left(properties), right(properties));
    }
    return left;
  }

  private parseUnary(): Evaluator {
    if (this.match('operator', '+')) return this.parseUnary();
    if (this.match('operator', '-')) {
      const operand = this.parseUnary();
      return (properties) => -operand(properties);
    }
    return this.parsePrimary();
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
      return (properties) => properties[propertyName] ?? 0;
    }

    if (token.type === 'leftParen') {
      this.consume();
      const expression = this.parseAdditive();
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
          args.push(this.parseAdditive());
        } while (this.match('comma'));
        this.expect('rightParen');
      }

      if (normalized in UNARY_FUNCTIONS) {
        if (args.length !== 1) {
          throw new Error(`${normalized} expects exactly one argument`);
        }
        const fn = UNARY_FUNCTIONS[normalized];
        return (properties) => fn(args[0](properties));
      }
      if (normalized === 'pow') {
        if (args.length !== 2) throw new Error('pow expects exactly two arguments');
        return (properties) => Math.pow(args[0](properties), args[1](properties));
      }
      if (normalized === 'min' || normalized === 'max') {
        if (args.length === 0) throw new Error(`${normalized} expects at least one argument`);
        const fn = normalized === 'min' ? Math.min : Math.max;
        return (properties) => fn(...args.map((argument) => argument(properties)));
      }

      throw new Error(`Unsupported identifier: ${token.value}`);
    }

    throw new Error(`Unexpected token "${token.value}" at position ${token.position}`);
  }
}

export class FormulaEngine {
  private static readonly MATH_FUNCTIONS = [
    'abs',
    'sqrt',
    'pow',
    'log',
    'log10',
    'exp',
    'sin',
    'cos',
    'tan',
    'min',
    'max',
  ];

  private cachedPlan: {
    formulasRef: FormulaConfig[];
    executor: (product: Product) => Record<string, number>;
  } | null = null;

  public extractDependencies(expression: string): string[] {
    const dependencies = new Set<string>();
    const regex = /(?:props|p)\[['"](.+?)['"]\]/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(expression)) !== null) {
      if (match[1]) dependencies.add(match[1]);
    }
    return Array.from(dependencies);
  }

  /**
   * Kept for backwards-compatible previews in the formula editor. Execution no
   * longer uses this string; formulas are parsed into a numeric evaluator.
   */
  public sanitize(expression: string): string {
    let sanitized = expression.replace(
      /(?:props|p)\[['"](.+?)['"]\]/gi,
      (_, propertyName: string) => `(p['${propertyName.replace(/'/g, "\\'")}'] || 0)`,
    );

    for (const functionName of FormulaEngine.MATH_FUNCTIONS) {
      sanitized = sanitized.replace(
        new RegExp(`(^|[^.\\w])${functionName}\\(`, 'g'),
        `$1Math.${functionName}(`,
      );
    }
    sanitized = sanitized.replace(/(^|[^.\w])PI\b/g, '$1Math.PI');
    return sanitized;
  }

  public buildTopologicalOrder(formulas: FormulaConfig[]): FormulaConfig[] {
    const graph = new Map<string, string[]>();
    const formulaNames = new Set(formulas.map((formula) => formula.name));
    const formulaMap = new Map(formulas.map((formula) => [formula.name, formula]));

    for (const formula of formulas) {
      graph.set(
        formula.name,
        this.extractDependencies(formula.expression).filter((dependency) =>
          formulaNames.has(dependency),
        ),
      );
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: FormulaConfig[] = [];

    const visit = (node: string, path: string[]) => {
      if (visiting.has(node)) {
        throw new Error(`Cyclic dependency detected: ${[...path, node].join(' -> ')}`);
      }
      if (visited.has(node)) return;

      visiting.add(node);
      for (const dependency of graph.get(node) || []) {
        visit(dependency, [...path, node]);
      }
      visiting.delete(node);
      visited.add(node);

      const formula = formulaMap.get(node);
      if (formula) order.push(formula);
    };

    for (const node of graph.keys()) visit(node, []);
    return order;
  }

  public validate(
    expression: string,
    currentName?: string,
    allFormulas: FormulaConfig[] = [],
  ): string | null {
    if (!expression.trim()) return 'Expression cannot be empty';

    const forbiddenKeywords = [
      'window',
      'document',
      'globalThis',
      'fetch',
      'XMLHttpRequest',
      'eval',
      'Function',
      'setTimeout',
      'setInterval',
      'alert',
      'cookie',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'constructor',
      '__proto__',
      'prototype',
    ];

    for (const keyword of forbiddenKeywords) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(expression)) {
        return `Security violation: Forbidden keyword "${keyword}" detected`;
      }
    }

    try {
      new ArithmeticParser(expression).parse();
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid expression';
    }

    if (currentName) {
      const candidate: FormulaConfig = {
        id: 'formula-validation-candidate',
        name: currentName,
        expression,
        unit: '',
      };
      try {
        this.buildTopologicalOrder([
          ...allFormulas.filter((formula) => formula.name !== currentName),
          candidate,
        ]);
      } catch (error) {
        return error instanceof Error ? error.message : 'Cyclical dependency error';
      }
    }

    return null;
  }

  private areFormulasEqual(left: FormulaConfig[], right: FormulaConfig[]): boolean {
    return (
      left.length === right.length &&
      left.every(
        (formula, index) =>
          formula.id === right[index].id &&
          formula.name === right[index].name &&
          formula.expression === right[index].expression &&
          formula.unit === right[index].unit,
      )
    );
  }

  public compileGraph(
    formulas: FormulaConfig[],
  ): (product: Product) => Record<string, number> {
    if (
      this.cachedPlan &&
      (this.cachedPlan.formulasRef === formulas ||
        this.areFormulasEqual(this.cachedPlan.formulasRef, formulas))
    ) {
      return this.cachedPlan.executor;
    }

    let orderedFormulas: FormulaConfig[];
    try {
      orderedFormulas = this.buildTopologicalOrder(formulas);
    } catch (error) {
      logger.error('Formula graph compilation failed', error);
      const failedExecutor = () =>
        Object.fromEntries(formulas.map((formula) => [formula.id, 0]));
      this.cachedPlan = { formulasRef: formulas, executor: failedExecutor };
      return failedExecutor;
    }

    const compiled = orderedFormulas.map((formula) => ({
      id: formula.id,
      name: formula.name,
      evaluate: new ArithmeticParser(formula.expression).parse(),
    }));

    const executor = (product: Product) => {
      const properties: PropertyDictionary = {};
      for (const [key, property] of Object.entries(product.properties)) {
        const numericValue =
          typeof property.value === 'number'
            ? property.value
            : Number.parseFloat(String(property.value));
        properties[key] = Number.isFinite(numericValue) ? numericValue : 0;
      }

      const results: Record<string, number> = {};
      for (const step of compiled) {
        const calculated = step.evaluate(properties);
        const value = Number.isFinite(calculated) ? calculated : 0;
        properties[step.name] = value;
        results[step.id] = value;
      }
      return results;
    };

    this.cachedPlan = { formulasRef: formulas, executor };
    return executor;
  }

  public clearCache(): void {
    this.cachedPlan = null;
  }
}

export const formulaEngine = new FormulaEngine();
