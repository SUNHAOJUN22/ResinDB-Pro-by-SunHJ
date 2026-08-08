import { copyFileSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const images = [
  'ui-dashboard-zh-light.png',
  'ui-dashboard-en-dark.png',
  'ui-product-detail.png',
  'ui-scientific-analytics.png',
  'ui-phase2l-rheology-proxy.png',
  'ui-phase2l-dependency-heatmap.png',
  'ui-kmeans-profile-audit.png',
  'ui-kmeans-device-calibration.png',
];
for (const image of images) {
  const source = `artifacts/${image}`;
  const target = `docs/images/${image}`;
  if (statSync(source).size < 20_000) {
    throw new Error(`Runtime screenshot is unexpectedly small: ${source}`);
  }
  copyFileSync(source, target);
}

const manifest = JSON.parse(readFileSync('artifacts/ui-smoke-manifest.json', 'utf8'));
if (manifest.schemaVersion !== 2 || !manifest.cjkFont?.available || !manifest.cjkFont?.family) {
  throw new Error(`CJK runtime evidence is incomplete: ${JSON.stringify(manifest.cjkFont)}`);
}
if (
  !manifest.scientificCanvas?.ready
  || manifest.scientificCanvas.points <= 0
  || manifest.scientificCanvas.nonBackground <= 500
  || manifest.scientificCanvas.chromatic <= 50
) {
  throw new Error(
    `Scientific Canvas evidence is incomplete: ${JSON.stringify(manifest.scientificCanvas)}`,
  );
}

const evidence = {
  schemaVersion: 'resindb-readme-runtime-visual-evidence-1.0.0',
  generatedAt: manifest.generatedAt,
  cjkFont: manifest.cjkFont,
  scientificCanvas: manifest.scientificCanvas,
  screenshots: manifest.screenshots,
};
writeFileSync(
  'docs/README_RUNTIME_VISUAL_EVIDENCE.json',
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8',
);

rmSync(fileURLToPath(import.meta.url), { force: true });
console.log(JSON.stringify(evidence, null, 2));
