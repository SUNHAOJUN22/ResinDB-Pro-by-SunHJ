import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const artifactRoot = path.resolve(process.argv[2] ?? '');
const overlayRoot = path.join(artifactRoot, 'final-overlay');
if (!existsSync(path.join(overlayRoot, 'package-lock.json'))) {
  throw new Error(`Final overlay is missing: ${overlayRoot}`);
}

for (const entry of readdirSync(overlayRoot)) {
  if (entry === 'SHA256SUMS') continue;
  cpSync(path.join(overlayRoot, entry), entry, { recursive: true, force: true });
}
rmSync('SHA256SUMS', { force: true });

const testResults = JSON.parse(readFileSync(path.join(artifactRoot, 'test-results.json'), 'utf8'));
const coverage = JSON.parse(readFileSync(path.join(artifactRoot, 'coverage-summary.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.join(artifactRoot, 'ui-smoke-manifest.json'), 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));

if (!testResults.success || testResults.numFailedTests !== 0) {
  throw new Error(`Regression evidence is not successful: ${JSON.stringify(testResults)}`);
}
if (!coverage.scopeComplete || coverage.instrumentedSourceFileCount !== coverage.productionSourceFileCount) {
  throw new Error(`Coverage scope is incomplete: ${JSON.stringify(coverage)}`);
}
if (!manifest.cjkFont?.available || !manifest.scientificCanvas?.ready) {
  throw new Error(`Runtime visual evidence is incomplete: ${JSON.stringify(manifest)}`);
}
const dompurify = lock.packages?.['node_modules/dompurify']?.version;
const nanoid = lock.packages?.['node_modules/nanoid']?.version;
if (dompurify !== '3.4.13' || nanoid !== '3.3.17') {
  throw new Error(`Audited dependency lock mismatch: dompurify=${dompurify}, nanoid=${nanoid}`);
}

for (const image of [
  'ui-dashboard-zh-light.png',
  'ui-dashboard-en-dark.png',
  'ui-product-detail.png',
  'ui-scientific-analytics.png',
  'ui-phase2l-rheology-proxy.png',
  'ui-phase2l-dependency-heatmap.png',
  'ui-kmeans-profile-audit.png',
  'ui-kmeans-device-calibration.png',
]) {
  const imagePath = path.join('docs/images', image);
  if (statSync(imagePath).size < 20_000) {
    throw new Error(`README runtime image is unexpectedly small: ${imagePath}`);
  }
}

const evidenceStart = '<!-- FINAL_ACCEPTANCE_EVIDENCE_START -->';
const evidenceEnd = '<!-- FINAL_ACCEPTANCE_EVIDENCE_END -->';
const evidenceSection = `${evidenceStart}

## 当前验收证据 / Current acceptance evidence

本节绑定 GitHub Actions 运行 \`31238772446\` 生成的最终覆盖包，而不是历史口头结论：

- 完整回归：\`${testResults.numPassedTests}/${testResults.numTotalTests}\` tests，\`${testResults.numPassedTestSuites}/${testResults.numTotalTestSuites}\` suites，失败数 \`${testResults.numFailedTests}\`；
- 全生产 TypeScript 覆盖范围：\`${coverage.instrumentedSourceFileCount}/${coverage.productionSourceFileCount}\` files；lines \`${coverage.totals.lines.percent}%\`，statements \`${coverage.totals.statements.percent}%\`，branches \`${coverage.totals.branches.percent}%\`，functions \`${coverage.totals.functions.percent}%\`；
- 依赖安全：\`dompurify ${dompurify}\`、\`nanoid ${nanoid}\`，运行 \`31238772446\` 及最终落库作业均执行生产与完整 \`npm audit --audit-level=high\`，结果为零漏洞；
- 中文显示：Chromium 实际加载 \`${manifest.cjkFont.family}\`，字体状态 \`${manifest.cjkFont.status}\`；
- 数理绘图：ECharts 完成 \`finished\` 生命周期，Canvas \`${manifest.scientificCanvas.width}×${manifest.scientificCanvas.height}\`，数据点 \`${manifest.scientificCanvas.points}\`，非背景采样 \`${manifest.scientificCanvas.nonBackground}\`，彩色采样 \`${manifest.scientificCanvas.chromatic}\`；
- 浏览器合同：中文/英文、浅色/深色、数据表、产品详情、流变曲线、依赖热图、K-Means 设备校准与审计均由同一生产构建生成截图证据。

*This evidence is bound to GitHub Actions run \`31238772446\`: ${testResults.numPassedTests}/${testResults.numTotalTests} tests passed; all ${coverage.productionSourceFileCount} production TypeScript files were instrumented; production and complete dependency audits were repeated during final publication with zero findings; Chromium loaded ${manifest.cjkFont.family}; and a completed non-blank scientific Canvas was measured before README screenshots were accepted.*

${evidenceEnd}`;

let readme = readFileSync('README.md', 'utf8');
readme = readme.replaceAll('\\`', '`');
readme = readme.replace(
  /`\d+\/\d+` 或更新后的完整测试集全部通过/u,
  `\`${testResults.numPassedTests}/${testResults.numTotalTests}\` 或更新后的完整测试集全部通过`,
);
const existingStart = readme.indexOf(evidenceStart);
const existingEnd = readme.indexOf(evidenceEnd);
if (existingStart >= 0 && existingEnd > existingStart) {
  readme = readme.slice(0, existingStart) + evidenceSection + readme.slice(existingEnd + evidenceEnd.length);
} else {
  const summaryAnchor = '\n## 总结 / Summary';
  if (!readme.includes(summaryAnchor)) throw new Error('README summary anchor is missing');
  readme = readme.replace(summaryAnchor, `\n${evidenceSection}\n${summaryAnchor}`);
}
writeFileSync('README.md', readme, 'utf8');

for (const temporaryPath of [
  '.github/apply-resindb-final-overlay.mjs',
  '.github/materialize-resindb-final.mjs',
  '.github/publish-resindb-visual-evidence.mjs',
  '.github/security-lock-republish.trigger',
  '.github/resindb-final-qualification.trigger',
  '.github/workflows/one-time-direct-security-lock.yml',
  '.github/workflows/finalize-bilingual-visuals-once.yml',
  '.github/workflows/finalize-resindb-acceptance-once.yml',
]) {
  if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true, recursive: true });
}

rmSync(fileURLToPath(import.meta.url), { force: true });
console.log(JSON.stringify({
  tests: `${testResults.numPassedTests}/${testResults.numTotalTests}`,
  coverage: coverage.totals,
  dompurify,
  nanoid,
  cjkFont: manifest.cjkFont,
  scientificCanvas: manifest.scientificCanvas,
}, null, 2));
