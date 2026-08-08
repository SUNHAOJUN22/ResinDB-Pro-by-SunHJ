import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workflowPath = '.github/workflows/ci.yml';
let workflow = readFileSync(workflowPath, 'utf8');
const temporaryJobStart = workflow.indexOf('  security-lock:\n');
const permanentJobStart = workflow.indexOf('  validate:\n');
if (temporaryJobStart >= 0) {
  if (permanentJobStart <= temporaryJobStart) {
    throw new Error('Unable to isolate temporary security-lock job');
  }
  workflow = workflow.slice(0, temporaryJobStart) + workflow.slice(permanentJobStart);
}

const fontStepName = 'Install CJK fonts for deterministic visual evidence';
if (!workflow.includes(fontStepName)) {
  const setupAnchor = [
    '      - name: Set up Node.js',
    '        uses: actions/setup-node@v4',
    '',
  ].join('\n');
  if (!workflow.includes(setupAnchor)) {
    throw new Error('Permanent CI Node setup anchor is missing');
  }
  const fontStep = [
    `      - name: ${fontStepName}`,
    '        shell: bash',
    '        run: |',
    '          set -euo pipefail',
    '          sudo apt-get update',
    '          sudo apt-get install -y --no-install-recommends fonts-noto-cjk',
    '          fc-cache -f',
    "          fc-match 'Noto Sans CJK SC'",
    '          fc-list :lang=zh | grep -q .',
    '',
  ].join('\n');
  workflow = workflow.replace(setupAnchor, fontStep + setupAnchor);
}
if (workflow.includes('contents: write')) {
  throw new Error('Permanent CI must remain read-only');
}
writeFileSync(workflowPath, workflow, 'utf8');

const readmePath = 'README.md';
let readme = readFileSync(readmePath, 'utf8');
if (!readme.includes('Linux CJK font and screenshot acceptance')) {
  readme += String.raw`

## Linux 中文字体与截图验收 / Linux CJK font and screenshot acceptance

中文界面与科研图表只有在实际字体和真实绘制同时成立时才允许进入 README。永久 CI 安装并验证 Noto CJK，Chromium 随后检查字体可用性、ECharts \`finished\` 生命周期、非零数据点、Canvas 尺寸与非空彩色像素；仅存在 \`canvas\` 或 SVG 图标不再视为图表通过。

*Chinese UI and scientific figures are accepted only when a real CJK font and a completed non-blank plot are both observable. Permanent CI installs and verifies Noto CJK, then requires Chromium font evidence, the ECharts \`finished\` lifecycle, non-zero data points, a sized Canvas, and non-background chromatic pixels.*

Minimal Ubuntu/Debian runtime prerequisite:

\`\`\`bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends fonts-noto-cjk
fc-cache -f
\`\`\`

Windows uses the governed fallback chain headed by Microsoft YaHei; Linux uses Noto Sans CJK SC/Noto Sans SC. README screenshots are regenerated from the same production build after these checks.
`;
}
writeFileSync(readmePath, readme, 'utf8');

for (const path of [
  '.github/security-lock-republish.trigger',
  '.github/resindb-final-qualification.trigger',
  '.github/workflows/one-time-direct-security-lock.yml',
  '.github/workflows/finalize-bilingual-visuals-once.yml',
  '.github/workflows/finalize-resindb-acceptance-once.yml',
]) {
  if (existsSync(path)) rmSync(path, { force: true });
}

rmSync(fileURLToPath(import.meta.url), { force: true });
console.log('Materialized permanent read-only CI and bilingual CJK visual contract.');
