import type { FormulaConfig } from "@/types/index";

const defaults = [
  {
    "id": "f_default_spec_strength",
    "name": "Specific Strength (比强度)",
    "previous": "(props['拉伸屈服应力'] || props['Tensile Strength'] || 0) / (props['密度'] || props['Density'] || 1)",
    "expression": "props['拉伸屈服应力'] / props['密度']",
    "previousUnit": "MPa·cm³/g",
    "unit": "MPa·cm³/g"
  },
  {
    "id": "f_default_spec_modulus",
    "name": "Specific Modulus (比模量)",
    "previous": "(props['弯曲模量'] || props['Flexural Modulus'] || 0) / (props['密度'] || props['Density'] || 1)",
    "expression": "props['弯曲模量'] / props['密度']",
    "previousUnit": "MPa·cm³/g",
    "unit": "MPa·cm³/g"
  },
  {
    "id": "f_default_toughness_index",
    "name": "Toughness Balance Index (刚韧平衡指数)",
    "previous": "((props['简支梁缺口冲击强度'] || props['Izod Impact'] || 0) * (props['弯曲模量'] || props['Flexural Modulus'] || 0)) / 10000",
    "expression": "props['简支梁缺口冲击强度'] * props['弯曲模量'] / 10000",
    "previousUnit": "Index",
    "unit": "MPa·kJ/m²"
  }
];

export function migrateDefaultFormulas(formulas: FormulaConfig[]): FormulaConfig[] {
  return formulas.map(formula => {
    const preset = defaults.find(item => item.id === formula.id && item.name === formula.name && item.previous === formula.expression && item.previousUnit === formula.unit);
    if (!preset) return formula;
    return { ...formula, expression: preset.expression, unit: preset.unit, history: [...(formula.history ?? []), { date: new Date().toISOString(), name: formula.name, expression: formula.expression, unit: formula.unit, description: formula.description }] };
  });
}
export function defaultFormulas(): FormulaConfig[] {
  return defaults.map(({ id, name, expression, unit }) => ({ id, name, expression, unit }));
}
