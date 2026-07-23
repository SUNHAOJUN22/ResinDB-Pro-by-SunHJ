import { logger } from '@/lib/logger';
import { FormulaConfig, Product } from '@/types/index';
import { compileFormulaExpression, type Evaluator, type PropertyDictionary } from '@/lib/formula/expressionParser';

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
      compileFormulaExpression(expression);
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

    const compiled = orderedFormulas.map((formula) => {
      let evaluate: Evaluator;
      try {
        evaluate = compileFormulaExpression(formula.expression);
      } catch (error) {
        logger.error(`Formula parse failed for "${formula.name}":`, error);
        evaluate = () => 0;
      }
      return {
        id: formula.id,
        name: formula.name,
        evaluate,
      };
    });

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
