#!/usr/bin/env node
/** Deterministic bilingual documentation; figures describe contracts, not runs. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PROFILE = {
  "slug": "resindb",
  "title": "ResinDB Pro",
  "readmes": [{"path":"README.md","lang":"bi"},{"path":"README.zh-CN.md","lang":"zh"},{"path":"README.en.md","lang":"en"}],
  "zh": {
    "tagline": "从可追溯树脂数据、有限数值与计算能力探测到可验证科学可视化",
    "stages": [["数据合同","Schema、来源、状态与单位"],["数值内核","有限性、尺度与相似度"],["计算调度","Worker、WASM、GPU 与降级"],["科学图形","标签、finished 与非空画布"],["导出与审计","语言、哈希、回执与边界"]],
    "boundary": "ResinDB Pro 是本地优先的科学数据与分析工作台，不是经认证的 LIMS/ERP、商业力场、工业牌号放行系统或自动科研批准器。",
    "strategy": ["先核对安装环境、输入结构、单位、有效范围与执行权限。","按上面的源码锚点区分原生实现、解释性合同和外部执行要求。","先运行快速回归和完整质量门，再用固定提交执行长期回归。","逐项保存原始日志、机器报告和限制；任何缺失证据不得写成 PASS。"]
  },
  "en": {
    "tagline": "From traceable resin data, finite numerics and compute-capability probes to verifiable scientific visualization",
    "stages": [["Data contract","Schema, source, status and units"],["Numerical core","Finiteness, scaling and similarity"],["Compute dispatch","Workers, WASM, GPU and fallback"],["Scientific figures","Labels, finished events and nonblank canvas"],["Export and audit","Language, hashes, receipts and boundaries"]],
    "boundary": "ResinDB Pro is a local-first scientific data and analysis workbench, not a certified LIMS/ERP, commercial force field, industrial grade-release system or automatic scientific approval engine.",
    "strategy": ["Check the installation environment, input structure, units, applicability and execution permissions.","Use the source mappings above to distinguish native implementation, explanatory contracts and external execution requirements.","Run focused regression and full quality gates before long-duration testing of pinned commits.","Preserve original logs, machine-readable reports and limitations; missing evidence must never be reported as PASS."]
  },
  "code": ["src/data/dataContract.ts","src/services/mathUtils.ts","src/compute/capabilityProbe.ts"],
  "math": [
    {
      "latex": "\\widehat f(x,y)=\\frac{1}{2\\pi n h_xh_y}\\sum_{i=1}^n\\exp\\!\\left[-\\frac12\\left(\\frac{x-x_i}{h_x}\\right)^2-\\frac12\\left(\\frac{y-y_i}{h_y}\\right)^2\\right]",
      "plain": ["f̂(x,y) = Σ K((x−x_i)/h_x,(y−y_i)/h_y)","/ (n · h_x · h_y)"],
      "zh": {"name":"连续坐标的核密度","note":"二维独立高斯核使用正带宽；密度具有 x、y 单位乘积的倒数单位。新绘图层使用连续坐标自定义单元格，保留原始密度，不把坐标冒充类别索引。有限显示窗口的积分一般小于 1；颜色强度或“相对最大值”不是概率。"},
      "en": {"name":"Continuous-coordinate KDE","note":"The separable bivariate Gaussian kernel requires positive bandwidths; density has inverse-product coordinate units. The figure layer uses custom cells on continuous axes and preserves original density rather than treating coordinates as category indices. A finite display window generally integrates to less than one; color intensity or relative maximum is not probability."},
      "code": ["src/compute/gaussianKde.ts","src/components/charts/kdeFigure.ts"]
    },
    {
      "latex": "F(v)=1-e^{-(v/\\eta)^m},\\qquad \\ln[-\\ln(1-F(v))]=m\\ln v-m\\ln\\eta,\\qquad B_5=\\eta[-\\ln(0.95)]^{1/m}",
      "plain": ["F(v) = 1 − exp[−(v/η)^m]","B₅ = η [−ln(0.95)]^(1/m)"],
      "zh": {"name":"Weibull 中位秩拟合","note":"v、η 必须为正，m 为形状参数。界面采用 Bernard 中位秩的普通最小二乘线性化，而非极大似然估计（not MLE）。B5 是模型的 5% 失效分位数，不是 95% 参数置信下限，也不是安全放行保证。中文与英文标题、图例及提示随语言切换。"},
      "en": {"name":"Weibull median-rank fit","note":"Positive v and η are required; m is the shape parameter. The UI uses ordinary least-squares linearization of Bernard median ranks, not maximum-likelihood estimation (not MLE). B5 is the fitted 5% failure quantile, not a 95% parameter-confidence bound or a safety-release guarantee. Titles, legends and tooltips follow the selected language."},
      "code": ["src/components/charts/WeibullChart.tsx"]
    },
    {
      "latex": "C_{\\mathrm{figure}}=C_{\\mathrm{finite}}\\land C_{\\mathrm{labels}}\\land C_{\\mathrm{finished}}\\land C_{\\mathrm{nonblank}}",
      "plain": ["figure = finite ∧ labeled","∧ finished ∧ nonblank"],
      "zh": {"name":"图形交付门","note":"这是绘图验收的解释性合同：记录有限数据量、轴标签、完成事件和非空画布证据，并区分无数据与图形引擎不可用。它不是只凭截图就能推定成立的科学正确性证明；浏览器、主题、语言与重新打开图表均需测试。"},
      "en": {"name":"Figure delivery gate","note":"This explanatory figure contract combines finite-data counts, labels, completion events and nonblank-canvas evidence, while distinguishing no data from an unavailable renderer. A screenshot alone is not proof of scientific correctness; test browser behavior, themes, locales and reopening charts."},
      "code": ["src/components/charts/ScientificEChart.tsx"]
    }
  ],
  "commands": ["npm ci","npm run validate:ci"],
  "accent": "#5eead4"
};
const START = '<!-- CURRENT_MAIN_ACCEPTANCE_V2:START -->';
const END = '<!-- CURRENT_MAIN_ACCEPTANCE_V2:END -->';
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const normalized = (value) => value.normalize('NFC').replaceAll('\r\n', '\n');

// Conservative em-width estimates determine wrapping; browser QA checks glyph bounds.
function widthEm(text) {
  return [...text].reduce((sum, char) => sum + (/\p{Script=Han}/u.test(char) ? 1 : /[MW@%]/u.test(char) ? 0.95 : /[il.,:;!| ]/u.test(char) ? 0.34 : 0.65), 0);
}
function lines(text, width, size) {
  const output = []; let line = '';
  for (const word of String(text).match(/\p{Script=Han}|[^\p{Script=Han}\s]+|\s+/gu) ?? []) {
    if (line && widthEm(line + word) * size > width) { output.push(line.trim()); line = ''; }
    if (widthEm(word) * size > width) {
      for (const char of word) {
        if (line && widthEm(line + char) * size > width) { output.push(line.trim()); line = ''; }
        line += char;
      }
    } else line += word;
  }
  if (line.trim()) output.push(line.trim());
  return output;
}
function textBlock(value, x, baseline, width, size, leading, maxLines, color = '#dbeafe', weight = 400) {
  const wrapped = lines(value, width, size);
  if (wrapped.length > maxLines) throw Error(`Text exceeds its layout box: ${value}`);
  return `<text x="${x}" y="${baseline}" font-size="${size}" font-weight="${weight}" fill="${color}" data-box="${x},${baseline - size * 1.3},${width},${leading * maxLines + size * 0.5}">${wrapped.map((line, index) => `<tspan x="${x}" dy="${index ? leading : 0}">${esc(line)}</tspan>`).join('')}</text>`;
}
function visual(lang) {
  const t = PROFILE[lang], zh = lang === 'zh', accent = PROFILE.accent;
  const stages = t.stages.map(([heading, detail], index) => {
    const x = 46 + 307 * index;
    return `<g><rect x="${x}" y="246" width="278" height="220" rx="20" fill="#0f2038" stroke="${accent}" stroke-opacity=".5"/><circle cx="${x + 31}" cy="279" r="15" fill="${accent}" fill-opacity=".16"/><text x="${x + 31}" y="284" text-anchor="middle" font-size="13" fill="${accent}">0${index + 1}</text>${textBlock(heading, x + 20, 326, 237, 23, 28, 2, '#f8fafc', 700)}${textBlock(detail, x + 20, 399, 237, 17, 25, 2)}</g>`;
  }).join('');
  const arrows = [0, 1, 2, 3].map((index) => `<path d="M${327 + 307 * index} 357h21" fill="none" stroke="${accent}" stroke-width="2" marker-end="url(#arrow)"/>`).join('');
  const equations = PROFILE.math.map((formula, index) => {
    const x = 46 + 506 * index;
    return `<g><rect x="${x}" y="510" width="476" height="161" rx="20" fill="#101827" stroke="#64748b" stroke-opacity=".65"/>${textBlock(`${String(index + 1).padStart(2, '0')}  ${formula[lang].name}`, x + 22, 544, 432, 17, 22, 1, accent, 650)}${formula.plain.map((line, row) => textBlock(line, x + 22, 588 + row * 29, 432, 19, 26, 1, '#f8fafc')).join('')}</g>`;
  }).join('');
  const boundary = textBlock(t.boundary, 73, 767, 1440, 18, 27, 2);
  return normalized(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc" lang="${zh ? 'zh-CN' : 'en'}">
<title id="title">${esc(PROFILE.title)} — ${zh ? '代码与数学合同' : 'Code and mathematical contracts'}</title>
<desc id="desc">${esc(t.tagline)} ${esc(t.boundary)}</desc>
<defs><linearGradient id="background" x2="1" y2="1"><stop stop-color="#070e1d"/><stop offset="1" stop-color="#172338"/></linearGradient><pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#cbd5e1" stroke-opacity=".055"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L9 5L0 9" fill="none" stroke="${accent}" stroke-width="1.4"/></marker><style>text{font-family:"Noto Sans CJK SC","Microsoft YaHei","PingFang SC","Noto Sans",Arial,sans-serif}</style></defs>
<rect width="1600" height="900" fill="url(#background)"/><rect width="1600" height="900" fill="url(#grid)"/><circle cx="1444" cy="70" r="178" fill="${accent}" opacity=".07"/>
<path d="M1350 26L1480 75L1410 162L1539 203M1480 75L1570 20M1410 162L1310 175" fill="none" stroke="${accent}" stroke-opacity=".22" stroke-width="2"/>
${textBlock(PROFILE.title, 48, 82, 1400, 49, 54, 1, '#f8fafc', 750)}
${textBlock(t.tagline, 49, 130, 1465, 22, 30, 2, accent)}
${textBlock(zh ? '概念架构图 · 非测量数据 · 不代表外部求解已经执行' : 'CONCEPTUAL ARCHITECTURE · NOT MEASURED DATA · NOT PROOF OF EXTERNAL EXECUTION', 49, 214, 1470, 15, 23, 1, '#94a3b8')}
${arrows}${stages}${equations}
<rect x="46" y="712" width="1488" height="111" rx="18" fill="#080f1b" stroke="#334155"/>
${textBlock(zh ? '资格与解释边界' : 'QUALIFICATION AND INTERPRETATION', 73, 741, 1440, 13, 20, 1, accent, 650)}${boundary}
${textBlock(zh ? '固定源码 · 有限数值 · 可复现证据 · 人工审阅' : 'PINNED SOURCE · FINITE NUMERICS · REPRODUCIBLE EVIDENCE · HUMAN REVIEW', 49, 871, 1470, 14, 20, 1, '#94a3b8')}
</svg>
`);
}
function mathSection(lang) {
  return PROFILE.math.map((formula) => {
    const t = formula[lang];
    return `#### ${t.name}\n\n$$\n${formula.latex}\n$$\n\n${t.note}\n\n${lang === 'zh' ? '源码对应' : 'Source mapping'}: ${formula.code.map((path) => `[\`${path}\`](${path})`).join(' · ')}`;
  }).join('\n\n');
}
function section(lang, markers = true) {
  const zh = lang === 'zh', t = PROFILE[lang];
  return [markers ? START : '', `## ${zh ? '当前实现：代码、数学与使用策略' : 'Current implementation: code, mathematics and usage'}`, '',
    `![${zh ? '中文代码与数学合同概念图' : 'English code and mathematical-contract concept'}](docs/current-main/${PROFILE.slug}-current-main-${lang}.svg)`, '',
    `> ${t.boundary}`, '', mathSection(lang), '', `### ${zh ? '使用与验收顺序' : 'Usage and acceptance sequence'}`, '',
    ...t.strategy.map((item, index) => `${index + 1}. ${item}`), '', '```bash', ...PROFILE.commands, '```', '',
    zh ? '每次修复均须绑定新提交重新测试。基线回归、两段各三小时的重复回归、浏览器图形检查和外部工程认证是不同证据，不可互相替代。没有原始回执时，不宣称已完成六小时验收。' : 'Retest every changed commit. Baseline regression, two three-hour regression segments, browser visual checks and external engineering qualification are distinct evidence classes. Without original receipts, no six-hour completion is claimed.', '',
    `${zh ? '源码锚点' : 'Implementation anchors'}: ${PROFILE.code.map((path) => `[\`${path}\`](${path})`).join(' · ')}`, '', markers ? END : '',
  ].join('\n').trim();
}
function inject(original, generated) {
  const start = original.indexOf(START), end = original.indexOf(END);
  if ((start === -1) !== (end === -1) || end < start) throw Error('Unbalanced generated-section markers');
  const text = start === -1 ? `${original.trimEnd()}\n\n${generated}\n` : original.slice(0, start) + generated + original.slice(end + END.length);
  return normalized(text.trimEnd() + '\n');
}
const output = new Map(['zh', 'en'].map((lang) => [`docs/current-main/${PROFILE.slug}-current-main-${lang}.svg`, visual(lang)]));
for (const spec of PROFILE.readmes) {
  const content = spec.lang === 'bi' ? `${START}\n${section('zh', false)}\n\n${section('en', false)}\n${END}` : section(spec.lang);
  output.set(spec.path, inject(readFileSync(join(ROOT, spec.path), 'utf8'), content));
}
output.set('docs/CURRENT_MAIN_ACCEPTANCE.md', `# ${PROFILE.title} — code-backed documentation\n\n${PROFILE.code.map((path) => `- [\`${path}\`](../${path})`).join('\n')}\n\n${PROFILE.zh.boundary}\n\n${PROFILE.en.boundary}\n\nThe equations and diagrams document the declared implementation and its interpretation limits. They are not an execution attestation.\n`);
for (const path of new Set([...PROFILE.code, ...PROFILE.math.flatMap((formula) => formula.code)])) if (!existsSync(join(ROOT, path))) throw Error(`Missing source mapping: ${path}`);
const bad = [String.fromCodePoint(0xfffd), String.fromCodePoint(0x951f, 0x65a4, 0x62f7)];
for (const [path, content] of output) {
  if (bad.some((token) => content.includes(token))) throw Error(`Invalid text: ${path}`);
  if (path.endsWith('.svg') && /<script\b|<foreignObject\b|\son[a-z]+\s*=|javascript:|(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/|data:)/iu.test(content)) throw Error(`Active or external SVG content: ${path}`);
}
if (process.argv.includes('--write')) for (const [path, content] of output) { mkdirSync(dirname(join(ROOT, path)), { recursive: true }); writeFileSync(join(ROOT, path), content, 'utf8'); }
const stale = [...output].filter(([path, content]) => !existsSync(join(ROOT, path)) || readFileSync(join(ROOT, path), 'utf8') !== content).map(([path]) => path);
if (stale.length) throw Error(`Stale documentation: ${stale.join(', ')}`);
console.log(JSON.stringify({ schemaVersion: 'readme-mathematics-v6', project: PROFILE.title, files: [...output.keys()], status: 'PASS', scope: 'source mapping, deterministic generation and text integrity; not external scientific acceptance' }, null, 2));
