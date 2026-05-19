import { Product, FormulaConfig } from "../types";

/**
 * Fast, sandboxed formula evaluator using Directed Acyclic Graph (DAG) for safe topological evaluation.
 * Compiles a set of user-defined string expressions into a high-performance execution plan.
 */
export class FormulaEngine {
  private static readonly MATH_FUNCS = [
    "abs", "sqrt", "pow", "log", "log10", "exp", "sin", "cos", "tan", "min", "max", "PI",
  ];

  /**
   * Extracts dependent property names or computed column names from an expression.
   */
  public extractDependencies(expression: string): string[] {
    const deps = new Set<string>();
    const regex = /(?:props|Props|p|P)\[['"](.+?)['"]\]/gi;
    let match;
    while ((match = regex.exec(expression)) !== null) {
      if (match[1]) deps.add(match[1]);
    }
    return Array.from(deps);
  }

  /**
   * Translates a formula like "Props['Density'] * 10" into a safe internal expression.
   */
  public sanitize(expression: string): string {
    let sanitized = expression.replace(
      /(?:props|Props|p|P)\[['"](.+?)['"]\]/gi,
      (_, pName) => {
        const safePName = pName.replace(/'/g, "\\'");
        return `(__p['${safePName}'] || 0)`;
      },
    );

    sanitized = sanitized.replace(/[;| &<>{} `$]/g, (match) => {
      return match === " " ? " " : "";
    });

    FormulaEngine.MATH_FUNCS.forEach((func) => {
      const regex = new RegExp(`\\b${func}\\(`, "g");
      sanitized = sanitized.replace(regex, `Math.${func}(`);
    });

    return sanitized.replace(/__p/g, "p");
  }

  /**
   * Compiles the DAG of all formulas to ensure there are no cycles, and returns a topologically sorted list.
   * Throws an error with the cycle path if a cyclic dependency is detected.
   */
  public buildTopologicalOrder(formulas: FormulaConfig[]): FormulaConfig[] {
    const graph = new Map<string, string[]>();
    const formulaNames = new Set(formulas.map(f => f.name));
    const formulaMap = new Map<string, FormulaConfig>();

    for (const f of formulas) {
      formulaMap.set(f.name, f);
      // Depenencies are only those that refer to other formulas
      const deps = this.extractDependencies(f.expression).filter(d => formulaNames.has(d));
      graph.set(f.name, deps);
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: FormulaConfig[] = [];

    const dfs = (node: string, path: string[]) => {
      if (visiting.has(node)) {
        throw new Error(`Cyclic dependency detected: ${path.join(' -> ')} -> ${node}`);
      }
      if (visited.has(node)) return;

      visiting.add(node);
      path.push(node);

      const deps = graph.get(node) || [];
      for (const dep of deps) {
        dfs(dep, path);
      }

      path.pop();
      visiting.delete(node);
      visited.add(node);
      
      const config = formulaMap.get(node);
      if (config) order.push(config);
    };

    for (const [node] of graph) {
      if (!visited.has(node)) {
         dfs(node, []);
      }
    }

    return order;
  }

  /**
   * Validates a single expression against the current set of formulas to ensure no cycles are created.
   * Returns a string error message if invalid, or null if valid.
   */
  public validate(expression: string, currentName?: string, allFormulas: FormulaConfig[] = []): string | null {
    if (!expression.trim()) return "Expression cannot be empty";
    
    if (expression.includes('constructor') || expression.includes('__proto__') || expression.includes('prototype')) {
      return "Security violation: Forbidden keywords detected";
    }

    const body = this.sanitize(expression);
    try {
      new Function("p", `return ${body}`);
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid syntax";
    }

    if (currentName) {
      const tempFormulas = [
        ...allFormulas.filter(f => f.name !== currentName),
        { id: "temp_test_id", name: currentName, expression, unit: "" } as FormulaConfig
      ];
      try {
        this.buildTopologicalOrder(tempFormulas);
      } catch (err) {
        return err instanceof Error ? err.message : "Cyclical dependency error";
      }
    }

    return null;
  }

  // Caching the execution plan
  private _cachedPlan: {
    formulasRef: FormulaConfig[];
    executor: (product: Product) => Record<string, number>;
  } | null = null;

  /**
   * Creates an execution plan for evaluating a product across all compiled formulas.
   */
  public compileGraph(formulas: FormulaConfig[]): (product: Product) => Record<string, number> {
    if (this._cachedPlan && this._cachedPlan.formulasRef === formulas) {
      return this._cachedPlan.executor;
    }

    let order: FormulaConfig[] = [];
    try {
      order = this.buildTopologicalOrder(formulas);
    } catch (e) {
      console.error(e);
      order = formulas; // Fallback to raw if cyclic exists (though validate should prevent this)
    }

    const compiledFns = order.map(f => {
       const body = this.sanitize(f.expression);
       const fn = new Function(
         "p",
         `try { const res = Number(${body}); return Number.isFinite(res) ? res : 0; } catch(e) { return 0; }`
       ) as (p: Record<string, number>) => number;
       return { id: f.id, name: f.name, fn };
    });

    const executor = (product: Product) => {
      const pDict: Record<string, number> = {};
      // Base properties
      for (const key in product.properties) {
        const val = product.properties[key].value;
        pDict[key] = typeof val === "number" ? val : parseFloat(String(val)) || 0;
      }

      const results: Record<string, number> = {};
      // Evaluate in topological order
      for (const step of compiledFns) {
         const val = step.fn(pDict);
         pDict[step.name] = val; // Store back in dict for subsequent formulas to consume via Props['name']
         results[step.id] = val;
      }
      return results;
    };

    this._cachedPlan = {
      formulasRef: formulas,
      executor
    };

    return executor;
  }

  public clearCache() {
    this._cachedPlan = null;
  }
}

export const formulaEngine = new FormulaEngine();
