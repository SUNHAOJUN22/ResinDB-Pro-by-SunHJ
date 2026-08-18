from __future__ import annotations

import json
import re
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
START = "<!-- TSAO_SKILL_NATIVE_V15_START -->"
END = "<!-- TSAO_SKILL_NATIVE_V15_END -->"
OLD = re.compile(r"<!-- TSAO_SKILL_NATIVE_V(?:1[0-4]|[1-9])_START -->.*?<!-- TSAO_SKILL_NATIVE_V(?:1[0-4]|[1-9])_END -->\s*", re.DOTALL)


def clean(value: str) -> str:
    return textwrap.dedent(value).strip() + "\n"


def write(path: str, value: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(clean(value), encoding="utf-8", newline="\n")


def merge(path: str, block: str, title: str) -> None:
    target = ROOT / path
    current = target.read_text(encoding="utf-8") if target.exists() else f"# {title}\n\n"
    current = OLD.sub("", current).rstrip() + "\n\n"
    target.write_text(current + START + "\n" + clean(block) + END + "\n", encoding="utf-8", newline="\n")


skill = r'''
---
name: resindb-science-screening-audit
description: Audit ResinDB quantity conversion, formula states, ranking eligibility, provenance, AI egress, screening reports, and release boundaries. Use for code or data-quality changes and scientific screening validation. Do not issue certificates, regulatory compliance, material release, laboratory accreditation, or approved status from incomplete records or software-only checks.
---

# ResinDB science screening audit

## Quantity contract

Preserve the raw declaration and derive a canonical quantity only through an explicit dimensional conversion:

\[
q_{canonical}=q_{raw}\,s_{raw\to canonical}.
\]

Changing a unit label without changing the value is invalid. Method-dependent properties such as MFR remain `UNKNOWN` when method, temperature, or load is missing.

## Formula and ranking states

A computed property returns `OK`, `UNKNOWN`, or `INVALID`; missing dependency, cycle, parse error, domain error, overflow, and non-finite output never become physical zero.

A ranking record is eligible only when every required criterion is valid or an explicit, provenance-bound imputation policy is declared. Removing a cost criterion must not improve a record's rank.

## Output boundary

The report is a data-quality and threshold-screening worksheet. It never emits certification, regulatory compliance, accredited-laboratory, approved, or material-release conclusions.

## AI egress

Every request shows the exact field allowlist, purpose, provider boundary, provenance, and one-time consent. Browser production secrets are prohibited.
'''

dod = r'''
# Definition of done

- Raw and canonical quantities are separate and both retain units.
- Conversion changes value and unit together and verifies dimension compatibility.
- Boolean, NaN, infinity, unknown units, and missing method conditions are not accepted as valid quantities.
- Formula failures never become zero.
- TOPSIS and other rankings use an explicit missing-data policy and exclude ineligible records by default.
- `sourceType`, `recordStatus`, `confidentiality`, `license`, and `provenanceRefs` survive load, store, rank, AI, PDF, and export paths.
- AI egress uses an exact preview/allowlist match and one-time consent.
- Screening reports contain no certificate, compliance, approval, accreditation, or material-release authority.
'''

openai_yaml = r'''
interface:
  display_name: "ResinDB Scientific Screening Audit"
  short_description: "Quantity-safe data quality, provenance, and screening boundaries"
  default_prompt: "Audit quantities, formula states, missing-data ranking policy, provenance, AI egress, and screening output without issuing certification or release authority."
policy:
  allow_implicit_invocation: true
  truth_boundary: "Software screening cannot certify regulatory compliance or material release."
'''

evals = {"schema": "resindb.skill-routing.v15", "skill": "resindb-science-screening-audit", "cases": [
    {"id": "en-unit", "language": "en", "prompt": "Fix the density conversion that relabels 905 kg/m3 as 905 g/cm3.", "expected": "TRIGGER"},
    {"id": "zh-unit", "language": "zh", "prompt": "修复把905 kg/m3只换标签成905 g/cm3的单位转换错误。", "expected": "TRIGGER"},
    {"id": "en-ranking", "language": "en", "prompt": "Audit TOPSIS so missing cost data cannot improve a material ranking.", "expected": "TRIGGER"},
    {"id": "zh-ranking", "language": "zh", "prompt": "核验TOPSIS，缺失成本数据不能让材料排名变好。", "expected": "TRIGGER"},
    {"id": "en-negative", "language": "en", "prompt": "Recommend a polymer for a garden chair.", "expected": "NO_TRIGGER"},
    {"id": "zh-negative", "language": "zh", "prompt": "推荐一种做花园椅的塑料。", "expected": "NO_TRIGGER"}
]}

validator = r'''
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] ?? '.');
const required = [
  '.agents/skills/resindb-science-screening-audit/SKILL.md',
  '.agents/skills/resindb-science-screening-audit/agents/openai.yaml',
  '.agents/skills/resindb-science-screening-audit/references/definition-of-done.md',
  '.agents/skills/resindb-science-screening-audit/evals/evals.json',
  'assets/diagrams/vision-en.svg',
  'assets/diagrams/vision-zh.svg',
];
const errors = [];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
const skillPath = path.join(root, required[0]);
if (fs.existsSync(skillPath)) {
  const text = fs.readFileSync(skillPath, 'utf8');
  if (!text.startsWith('---\n') || !text.slice(0, 900).includes('name: resindb-science-screening-audit')) errors.push('invalid SKILL.md');
  if (!text.slice(0, 1400).includes('Do not issue certificates')) errors.push('anti-trigger boundary missing');
}
const bad = ['\u0000', '\ufffd', 'Ã', 'Â', 'â€'];
const extensions = new Set(['.md', '.ts', '.tsx', '.js', '.mjs', '.json', '.yaml', '.yml', '.svg']);
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory() && !['node_modules', 'dist', '.git'].includes(entry.name)) walk(full); else if (entry.isFile() && extensions.has(path.extname(entry.name))) { const value = fs.readFileSync(full, 'utf8'); if (bad.some((marker) => value.includes(marker))) errors.push(`Unicode failure in ${path.relative(root, full)}`); } } }
walk(root);
const evalPath = path.join(root, required[3]);
if (fs.existsSync(evalPath)) { const cases = JSON.parse(fs.readFileSync(evalPath, 'utf8')).cases ?? []; const states = new Set(cases.map((c) => c.expected)); if (cases.length < 6 || !states.has('TRIGGER') || !states.has('NO_TRIGGER')) errors.push('routing evals incomplete'); }
const report = { schema: 'resindb.skill-validation.v15', status: errors.length ? 'FAIL' : 'PASS', errors };
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/skill-validation-v15.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (errors.length) process.exit(1);
'''

contracts = r'''
export type QuantityStatus = 'VALID' | 'UNKNOWN' | 'INVALID';
export type FormulaStatus = 'OK' | 'UNKNOWN' | 'INVALID';

export interface RawQuantity {
  value: number | null;
  unit: string | null;
  method?: string | null;
  conditions?: Readonly<Record<string, string | number>>;
}

export interface CanonicalQuantity {
  value: number;
  unit: string;
  dimension: 'density' | 'stress';
}

export interface QuantityEnvelope {
  raw: RawQuantity;
  canonical: CanonicalQuantity | null;
  status: QuantityStatus;
  reasonCodes: readonly string[];
  provenanceRefs: readonly string[];
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const conversions: Readonly<Record<string, CanonicalQuantity & { scale: number }>> = {
  'kg/m3': { value: 0, unit: 'g/cm3', dimension: 'density', scale: 0.001 },
  'g/cm3': { value: 0, unit: 'g/cm3', dimension: 'density', scale: 1 },
  GPa: { value: 0, unit: 'MPa', dimension: 'stress', scale: 1000 },
  MPa: { value: 0, unit: 'MPa', dimension: 'stress', scale: 1 },
};

export function canonicalizeQuantity(raw: RawQuantity, provenanceRefs: readonly string[] = []): QuantityEnvelope {
  if (!finiteNumber(raw.value)) return { raw, canonical: null, status: raw.value === null ? 'UNKNOWN' : 'INVALID', reasonCodes: ['VALUE_NOT_FINITE'], provenanceRefs };
  if (!raw.unit || !(raw.unit in conversions)) return { raw, canonical: null, status: 'UNKNOWN', reasonCodes: ['UNIT_UNKNOWN'], provenanceRefs };
  const conversion = conversions[raw.unit];
  return { raw, canonical: { value: raw.value * conversion.scale, unit: conversion.unit, dimension: conversion.dimension }, status: 'VALID', reasonCodes: [], provenanceRefs };
}

export type FormulaResult =
  | { status: 'OK'; value: number; reasonCodes: readonly string[] }
  | { status: 'UNKNOWN' | 'INVALID'; value: null; reasonCodes: readonly string[] };

export function evaluateRatio(numerator: number | null, denominator: number | null): FormulaResult {
  if (numerator === null || denominator === null) return { status: 'UNKNOWN', value: null, reasonCodes: ['DEPENDENCY_MISSING'] };
  if (!finiteNumber(numerator) || !finiteNumber(denominator)) return { status: 'INVALID', value: null, reasonCodes: ['DEPENDENCY_NON_FINITE'] };
  if (denominator === 0) return { status: 'INVALID', value: null, reasonCodes: ['DIVISION_BY_ZERO'] };
  const value = numerator / denominator;
  return Number.isFinite(value) ? { status: 'OK', value, reasonCodes: [] } : { status: 'INVALID', value: null, reasonCodes: ['RESULT_NON_FINITE'] };
}

export interface RankingRecord { id: string; criteria: Readonly<Record<string, number | null>>; }
export interface RankingEligibility { eligible: boolean; missingCriteria: readonly string[]; }

export function rankingEligibility(record: RankingRecord, requiredCriteria: readonly string[]): RankingEligibility {
  const missingCriteria = requiredCriteria.filter((criterion) => !finiteNumber(record.criteria[criterion]));
  return { eligible: missingCriteria.length === 0, missingCriteria };
}

export interface ScreeningDecision {
  status: 'ASSESSED_WITHIN_DECLARED_THRESHOLD' | 'ASSESSED_OUTSIDE_DECLARED_THRESHOLD' | 'NOT_ASSESSED';
  conclusionAllowed: false;
  reasonCodes: readonly string[];
}

export function screenThreshold(quantity: QuantityEnvelope, minimum: number, maximum: number): ScreeningDecision {
  if (quantity.status !== 'VALID' || quantity.canonical === null || !finiteNumber(minimum) || !finiteNumber(maximum) || minimum > maximum) {
    return { status: 'NOT_ASSESSED', conclusionAllowed: false, reasonCodes: ['INSUFFICIENT_VALID_EVIDENCE'] };
  }
  const inside = quantity.canonical.value >= minimum && quantity.canonical.value <= maximum;
  return { status: inside ? 'ASSESSED_WITHIN_DECLARED_THRESHOLD' : 'ASSESSED_OUTSIDE_DECLARED_THRESHOLD', conclusionAllowed: false, reasonCodes: [] };
}
'''

tests = r'''
import { describe, expect, it } from 'vitest';
import { canonicalizeQuantity, evaluateRatio, rankingEligibility, screenThreshold } from '../scientificContractsV15';

describe('scientificContractsV15', () => {
  it('converts density value and unit together', () => {
    const result = canonicalizeQuantity({ value: 905, unit: 'kg/m3' }, ['source:batch-1']);
    expect(result.status).toBe('VALID');
    expect(result.canonical).toEqual({ value: 0.905, unit: 'g/cm3', dimension: 'density' });
  });

  it('converts GPa to MPa', () => {
    expect(canonicalizeQuantity({ value: 1.5, unit: 'GPa' }).canonical?.value).toBe(1500);
  });

  it('does not turn missing formula dependencies into zero', () => {
    expect(evaluateRatio(null, 2)).toEqual({ status: 'UNKNOWN', value: null, reasonCodes: ['DEPENDENCY_MISSING'] });
  });

  it('excludes incomplete ranking records by default', () => {
    expect(rankingEligibility({ id: 'x', criteria: { cost: null, strength: 40 } }, ['cost', 'strength'])).toEqual({ eligible: false, missingCriteria: ['cost'] });
  });

  it('never grants regulatory or release authority', () => {
    const quantity = canonicalizeQuantity({ value: 1.0, unit: 'g/cm3' });
    const decision = screenThreshold(quantity, 0.8, 1.2);
    expect(decision.status).toBe('ASSESSED_WITHIN_DECLARED_THRESHOLD');
    expect(decision.conclusionAllowed).toBe(false);
  });
});
'''

workflow = r'''
name: Skill-native portability
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  validate:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-24.04, windows-2025]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: npm
      - run: npm ci
      - run: node scripts/validate-skill-v15.mjs .
      - run: npx vitest run src/lib/__tests__/scientificContractsV15.test.ts --pool=forks --maxWorkers=1
'''

svg_en = r'''
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#07152d"/><stop offset=".52" stop-color="#173a5f"/><stop offset="1" stop-color="#071122"/></linearGradient><linearGradient id="c" x2="1" y2="1"><stop stop-color="#1c4c71"/><stop offset="1" stop-color="#10263f"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><g opacity=".16" stroke="#71dfff"><path d="M0 180H1600M0 360H1600M0 540H1600M0 720H1600"/><path d="M200 0V900M500 0V900M800 0V900M1100 0V900M1400 0V900"/></g><text x="80" y="100" fill="#fff" font-family="Arial" font-size="50" font-weight="700">ResinDB Pro · Evidence-First Materials Screening</text><text x="85" y="148" fill="#b2eaff" font-family="Arial" font-size="24">Raw declaration → canonical quantity → formula state → ranking eligibility → screening worksheet</text><g transform="translate(75 225)"><rect width="450" height="405" rx="28" fill="url(#c)" stroke="#55d9ff" stroke-width="2"/><text x="35" y="65" fill="#fff" font-family="Arial" font-size="29" font-weight="700">Quantity envelope</text><text x="35" y="125" fill="#c8efff" font-family="Arial" font-size="22">raw value · unit · method</text><text x="35" y="165" fill="#c8efff" font-family="Arial" font-size="22">canonical value · dimension</text><text x="35" y="230" fill="#75f0bd" font-family="Arial" font-size="21">905 kg/m³ → 0.905 g/cm³</text><text x="35" y="270" fill="#75f0bd" font-family="Arial" font-size="21">1.5 GPa → 1500 MPa</text><text x="35" y="340" fill="#fff" font-family="Arial" font-size="21">Value and unit change together.</text></g><g transform="translate(575 225)"><rect width="450" height="405" rx="28" fill="url(#c)" stroke="#b79cff" stroke-width="2"/><text x="35" y="65" fill="#fff" font-family="Arial" font-size="29" font-weight="700">Formula & ranking states</text><text x="35" y="125" fill="#e2d9ff" font-family="Arial" font-size="22">OK · UNKNOWN · INVALID</text><text x="35" y="185" fill="#d9f2ff" font-family="Arial" font-size="21">missing ≠ 0</text><text x="35" y="225" fill="#d9f2ff" font-family="Arial" font-size="21">cycle / domain / overflow fail closed</text><text x="35" y="295" fill="#75f0bd" font-family="Arial" font-size="21">Incomplete TOPSIS records</text><text x="35" y="335" fill="#75f0bd" font-family="Arial" font-size="21">are excluded by default.</text></g><g transform="translate(1075 225)"><rect width="450" height="405" rx="28" fill="url(#c)" stroke="#ffbd65" stroke-width="2"/><text x="35" y="65" fill="#fff" font-family="Arial" font-size="29" font-weight="700">Screening boundary</text><text x="35" y="125" fill="#ffe0ad" font-family="Arial" font-size="21">data quality · declared threshold</text><text x="35" y="185" fill="#d9f2ff" font-family="Arial" font-size="21">source · status · confidentiality</text><text x="35" y="225" fill="#d9f2ff" font-family="Arial" font-size="21">license · provenance · AI egress</text><text x="35" y="295" fill="#75f0bd" font-family="Arial" font-size="21">No certificate, compliance,</text><text x="35" y="335" fill="#75f0bd" font-family="Arial" font-size="21">approval, or material release.</text></g><rect x="75" y="695" width="1450" height="115" rx="24" fill="#071b34" stroke="#4bcdf2"/><text x="115" y="746" fill="#fff" font-family="Arial" font-size="25" font-weight="700">AI egress</text><text x="310" y="746" fill="#c7edff" font-family="Arial" font-size="22">exact field preview = actual allowlist · one-time consent · no browser production secret</text><text x="115" y="790" fill="#ffcf75" font-family="Arial" font-size="21">Truth boundary: SOFTWARE_VALIDATED_FOR_SCREENING.</text></svg>
'''

svg_zh = r'''
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#07152d"/><stop offset=".52" stop-color="#173a5f"/><stop offset="1" stop-color="#071122"/></linearGradient><linearGradient id="c" x2="1" y2="1"><stop stop-color="#1c4c71"/><stop offset="1" stop-color="#10263f"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><g opacity=".16" stroke="#71dfff"><path d="M0 180H1600M0 360H1600M0 540H1600M0 720H1600"/><path d="M200 0V900M500 0V900M800 0V900M1100 0V900M1400 0V900"/></g><text x="80" y="100" fill="#fff" font-family="Microsoft YaHei,Arial" font-size="50" font-weight="700">ResinDB Pro · 证据优先材料筛查</text><text x="85" y="148" fill="#b2eaff" font-family="Microsoft YaHei,Arial" font-size="24">原始声明 → 规范量 → 公式状态 → 排名资格 → 筛查工作表</text><g transform="translate(75 225)"><rect width="450" height="405" rx="28" fill="url(#c)" stroke="#55d9ff" stroke-width="2"/><text x="35" y="65" fill="#fff" font-family="Microsoft YaHei,Arial" font-size="29" font-weight="700">量值封装</text><text x="35" y="125" fill="#c8efff" font-family="Microsoft YaHei,Arial" font-size="22">原始值 · 单位 · 方法</text><text x="35" y="165" fill="#c8efff" font-family="Microsoft YaHei,Arial" font-size="22">规范值 · 量纲</text><text x="35" y="230" fill="#75f0bd" font-family="Arial" font-size="21">905 kg/m³ → 0.905 g/cm³</text><text x="35" y="270" fill="#75f0bd" font-family="Arial" font-size="21">1.5 GPa → 1500 MPa</text><text x="35" y="340" fill="#fff" font-family="Microsoft YaHei,Arial" font-size="21">数值与单位必须同步变化</text></g><g transform="translate(575 225)"><rect width="450" height="405" rx="28" fill="url(#c)" stroke="#b79cff" stroke-width="2"/><text x="35" y="65" fill="#fff" font-family="Microsoft YaHei,Arial" font-size="29" font-weight="700">公式与排名状态</text><text x="35" y="125" fill="#e2d9ff" font-family="Arial" font-size="22">OK · UNKNOWN · INVALID</text><text x="35" y="185" fill="#d9f2ff" font-family="Microsoft YaHei,Arial" font-size="21">缺失 ≠ 物理零</text><text x="35" y="225" fill="#d9f2ff" font-family="Microsoft YaHei,Arial" font-size="21">循环/定义域/溢出均阻断</text><text x="35" y="295" fill="#75f0bd" font-family="Microsoft YaHei,Arial" font-size="21">TOPSIS缺项记录</text><text x="35" y="335" fill="#75f0bd" font-family="Microsoft YaHei,Arial" font-size="21">默认不参与排名</text></g><g transform="translate(1075 225)"><rect width="450" height="405" rx="28" fill="url(#c)" stroke="#ffbd65" stroke-width="2"/><text x="35" y="65" fill="#fff" font-family="Microsoft YaHei,Arial" font-size="29" font-weight="700">筛查边界</text><text x="35" y="125" fill="#ffe0ad" font-family="Microsoft YaHei,Arial" font-size="21">数据质量 · 声明阈值</text><text x="35" y="185" fill="#d9f2ff" font-family="Microsoft YaHei,Arial" font-size="21">来源 · 状态 · 保密</text><text x="35" y="225" fill="#d9f2ff" font-family="Microsoft YaHei,Arial" font-size="21">许可 · 谱系 · AI出站</text><text x="35" y="295" fill="#75f0bd" font-family="Microsoft YaHei,Arial" font-size="21">不签发证书、合规、批准</text><text x="35" y="335" fill="#75f0bd" font-family="Microsoft YaHei,Arial" font-size="21">或材料放行结论</text></g><rect x="75" y="695" width="1450" height="115" rx="24" fill="#071b34" stroke="#4bcdf2"/><text x="115" y="746" fill="#fff" font-family="Microsoft YaHei,Arial" font-size="25" font-weight="700">AI出站</text><text x="310" y="746" fill="#c7edff" font-family="Microsoft YaHei,Arial" font-size="22">字段预览 = 实际白名单 · 单次同意 · 浏览器不得保存生产密钥</text><text x="115" y="790" fill="#ffcf75" font-family="Microsoft YaHei,Arial" font-size="21">真实性边界：仅完成软件筛查验证。</text></svg>
'''

readme_en = r'''
## Skill-native scientific screening

![ResinDB evidence-first screening architecture](assets/diagrams/vision-en.svg)

The canonical audit Skill is `.agents/skills/resindb-science-screening-audit/SKILL.md`. ResinDB remains a React/TypeScript application; the Skill provides a precise maintenance and audit interface.

A raw quantity is retained and converted as \(q_c=q_r s_{r\to c}\). Formula failures return `UNKNOWN` or `INVALID`, never physical zero. Records missing a required criterion are excluded from ranking unless an explicit provenance-bound imputation policy exists. All report decisions have `conclusionAllowed=false` for certification, compliance, approval, and material release.

```bash
node scripts/validate-skill-v15.mjs .
npx vitest run src/lib/__tests__/scientificContractsV15.test.ts --pool=forks --maxWorkers=1
```
'''

readme_zh = r'''
## Skill 原生科学筛查

![ResinDB 证据优先筛查架构](assets/diagrams/vision-zh.svg)

规范审计 Skill 位于 `.agents/skills/resindb-science-screening-audit/SKILL.md`。ResinDB 仍是 React/TypeScript 应用，Skill 只提供精确的维护与审计接口。

保留原始量并按 \(q_c=q_r s_{r\to c}\) 转换。公式失败返回 `UNKNOWN` 或 `INVALID`，绝不写成物理零。缺少必要指标的记录默认不参与排名，除非存在显式且绑定来源谱系的插补策略。所有报告对认证、合规、批准和材料放行均固定 `conclusionAllowed=false`。

```bash
node scripts/validate-skill-v15.mjs .
npx vitest run src/lib/__tests__/scientificContractsV15.test.ts --pool=forks --maxWorkers=1
```
'''

write(".agents/skills/resindb-science-screening-audit/SKILL.md",skill)
write(".agents/skills/resindb-science-screening-audit/references/definition-of-done.md",dod)
write(".agents/skills/resindb-science-screening-audit/agents/openai.yaml",openai_yaml)
write(".agents/skills/resindb-science-screening-audit/evals/evals.json",json.dumps(evals,ensure_ascii=False,indent=2))
write("scripts/validate-skill-v15.mjs",validator)
write("src/lib/scientificContractsV15.ts",contracts)
write("src/lib/__tests__/scientificContractsV15.test.ts",tests)
write(".github/workflows/skill-native-ci.yml",workflow)
write("assets/diagrams/vision-en.svg",svg_en)
write("assets/diagrams/vision-zh.svg",svg_zh)
merge("README.md",readme_en,"ResinDB Pro")
zh="README.zh-CN.md" if (ROOT/"README.zh-CN.md").exists() else "README_CN.md"; merge(zh,readme_zh,"ResinDB Pro 中文说明")
print(json.dumps({"status":"APPLIED","version":"15.0.0"},ensure_ascii=False))
