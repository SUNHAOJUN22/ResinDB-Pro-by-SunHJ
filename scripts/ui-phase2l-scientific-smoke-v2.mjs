import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const previewPort = 4176;
const debugPort = 9226;
const artifactDir = path.join(root, 'artifacts');
const downloadDir = path.join('/tmp', `resindb-phase2l-v2-${process.pid}`);
const dependencyScreenshot = path.join(artifactDir, 'ui-phase2l-dependency-heatmap.png');
const rheologyScreenshot = path.join(artifactDir, 'ui-phase2l-rheology-proxy.png');
const manifestPath = path.join(artifactDir, 'ui-phase2l-manifest.json');
const networkHosts = Object.values(networkInterfaces()).flat().filter(Boolean)
  .filter((entry) => entry.family === 'IPv4' && !entry.internal)
  .map((entry) => entry.address);
const appCandidates = [...new Set([
  process.env.RESINDB_UI_HOST,
  '127.0.0.1',
  'localhost',
  ...networkHosts,
].filter(Boolean).map((host) => `http://${host}:${previewPort}`))];
const chromeCandidates = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chromeBin = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromeBin) throw new Error(`No Chromium-compatible browser found: ${chromeCandidates.join(', ')}`);

const preview = spawn(process.execPath, [
  vite, 'preview', '--host', '0.0.0.0', '--port', String(previewPort), '--strictPort',
], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const chrome = spawn(chromeBin, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--no-proxy-server',
  '--proxy-bypass-list=<-loopback>',
  '--hide-scrollbars',
  '--remote-allow-origins=*',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=/tmp/resindb-phase2l-v2-chrome-${process.pid}`,
  '--window-size=1600,1000',
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let previewError = '';
let chromeError = '';
preview.stdout.on('data', (chunk) => process.stdout.write(chunk));
preview.stderr.on('data', (chunk) => {
  previewError += chunk.toString();
  process.stderr.write(chunk);
});
chrome.stderr.on('data', (chunk) => { chromeError += chunk.toString(); });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForHttp(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // Continue until the preview/debug endpoint is ready.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpSession {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result || {});
      } else {
        this.events.push(message);
      }
    });
  }

  command(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(session, expression) {
  const response = await session.command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description
      || response.exceptionDetails.text
      || JSON.stringify(response.exceptionDetails),
    );
  }
  return response.result?.value;
}

async function waitForCondition(session, expression, description, attempts = 120) {
  let lastValue = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastValue = await evaluate(session, expression);
    if (lastValue === true) return;
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${description}; lastValue=${JSON.stringify(lastValue)}`);
}

async function clickByTitle(session, labels) {
  const clicked = await evaluate(session, `(() => {
    const labels = ${JSON.stringify(labels)};
    const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
      labels.some((label) => (candidate.title || '').includes(label))
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Button title not found: ${labels.join(', ')}`);
}

async function clickByText(session, labels) {
  const clicked = await evaluate(session, `(() => {
    const labels = ${JSON.stringify(labels)};
    const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
      labels.some((label) => (candidate.textContent || '').includes(label))
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Button text not found: ${labels.join(', ')}`);
}

async function capture(session, target) {
  const screenshot = await session.command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  writeFileSync(target, Buffer.from(screenshot.data, 'base64'));
}

async function exportPng(session, testId) {
  const before = readdirSync(downloadDir).filter((file) => file.endsWith('.png')).length;
  await evaluate(session, `document.querySelector('[data-testid="${testId}"]')?.click()`);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const files = readdirSync(downloadDir)
      .filter((file) => file.endsWith('.png') && !file.endsWith('.crdownload'))
      .sort();
    if (files.length > before) return files.at(-1);
    await sleep(125);
  }
  throw new Error(`PNG export failed for ${testId}`);
}

async function triggerTooltip(session, chartRoot, expectedText) {
  const rectangle = await evaluate(session, `(() => {
    const canvas = document.querySelector('${chartRoot} canvas');
    if (!canvas) return null;
    const box = canvas.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  })()`);
  if (!rectangle || rectangle.width < 200 || rectangle.height < 200) return false;

  for (const [xRatio, yRatio] of [[0.3, 0.35], [0.5, 0.5], [0.7, 0.55], [0.25, 0.7]]) {
    await session.command('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: rectangle.left + rectangle.width * xRatio,
      y: rectangle.top + rectangle.height * yRatio,
    });
    await sleep(200);
    const visible = await evaluate(session, `Array.from(document.querySelectorAll('div')).some((node) => {
      const text = node.innerText || '';
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.position === 'absolute'
        && style.pointerEvents === 'none'
        && box.width > 0
        && box.height > 0
        && ${JSON.stringify(expectedText)}.some((fragment) => text.includes(fragment));
    })`);
    if (visible) return true;
  }
  return false;
}

async function chartState(session, rootTestId, chartName) {
  return evaluate(session, `(() => {
    const root = document.querySelector('[data-testid="${rootTestId}"]');
    const chart = root?.querySelector('[data-phase2l-chart="${chartName}"]');
    const canvas = root?.querySelector('canvas');
    const box = canvas?.getBoundingClientRect();
    return {
      exists: !!root,
      legacyWrapper: root?.dataset.legacyWrapper ?? null,
      scientificBoundary: root?.dataset.scientificBoundary ?? null,
      readyCount: Number(chart?.dataset.phase2lReadyCount ?? '0'),
      width: box?.width ?? 0,
      height: box?.height ?? 0,
      text: root?.innerText ?? '',
    };
  })()`);
}

async function assertResizeDoesNotReinitialize(session, rootTestId, chartName, initialCount, width, height) {
  await session.command('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(400);
  await session.command('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(400);
  const after = await chartState(session, rootTestId, chartName);
  if (after.readyCount !== initialCount) {
    throw new Error(`Chart reinitialized across resize: ${chartName}; before=${initialCount}; after=${after.readyCount}`);
  }
  if (after.width < 250 || after.height < 200) {
    throw new Error(`Chart lost visible dimensions after resize: ${chartName}; state=${JSON.stringify(after)}`);
  }
  return after;
}

function browserErrors(session) {
  return session.events.filter((event) =>
    event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error')
    || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
  );
}

function stop(processHandle) {
  if (processHandle.exitCode === null) processHandle.kill('SIGTERM');
}

try {
  await waitForHttp(`http://127.0.0.1:${previewPort}`);
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
  const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
  const target = targets.find((candidate) => candidate.type === 'page');
  if (!target) throw new Error('Chromium did not expose a page target');

  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.open();
  await session.command('Page.enable');
  await session.command('Runtime.enable');
  await session.command('Log.enable');
  await session.command('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  mkdirSync(artifactDir, { recursive: true });
  mkdirSync(downloadDir, { recursive: true });
  await session.command('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir,
    eventsEnabled: true,
  });

  let appUrl = '';
  for (const candidate of appCandidates) {
    const navigation = await session.command('Page.navigate', { url: candidate });
    if (navigation.errorText) continue;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if ((await evaluate(session, 'location.href')).startsWith(candidate)) {
        appUrl = candidate;
        break;
      }
      await sleep(100);
    }
    if (appUrl) break;
  }
  if (!appUrl) throw new Error('Chromium could not reach the preview');

  const administrator = JSON.stringify({
    id: 'demo-admin',
    name: 'Demo Admin',
    email: 'admin@example.invalid',
    role: 'admin',
  });
  await evaluate(session, `sessionStorage.setItem('resindb-session', ${JSON.stringify(administrator)});
    localStorage.setItem('resindb-tour-completed', 'true');
    localStorage.setItem('resindb-language', 'zh');
    localStorage.setItem('resindb-theme', 'light');
    localStorage.setItem('resindb-color-theme', 'indigo');`);
  await session.command('Page.reload', { ignoreCache: true });
  await waitForCondition(session, `(document.body?.innerText || '').includes('13 RECORDS')`, 'authenticated dashboard');

  await clickByTitle(session, ['性能指数引擎', 'Performance Index Engine']);
  await waitForCondition(session, `document.body.innerText.includes('Performance Index Engine')`, 'formula editor');
  await clickByText(session, ['Dependencies Heatmap']);
  await waitForCondition(session, `!!document.querySelector('[data-testid="dependency-heatmap-migrated"]')`, 'DependencyHeatmap');
  await evaluate(session, `document.querySelector('[data-testid="dependency-heatmap-migrated"]')?.scrollIntoView({ block: 'start' })`);

  let dependency = await chartState(session, 'dependency-heatmap-migrated', 'dependency-heatmap');
  for (let attempt = 0; attempt < 120 && (dependency.readyCount < 1 || dependency.width < 250 || dependency.height < 200); attempt += 1) {
    await sleep(125);
    dependency = await chartState(session, 'dependency-heatmap-migrated', 'dependency-heatmap');
  }
  if (
    dependency.legacyWrapper !== 'false'
    || dependency.scientificBoundary !== 'local-perturbation-not-causality'
    || dependency.readyCount < 1
    || dependency.width < 250
    || dependency.height < 200
  ) {
    throw new Error(`Dependency shared lifecycle failed: ${JSON.stringify(dependency)}`);
  }
  const dependencySemantics = {
    boundary: dependency.text.includes('不是统计相关') || dependency.text.includes('Statistical association is not computed'),
    missing: dependency.text.includes('不会伪装成零') || dependency.text.includes('never as zero'),
    formula: dependency.text.includes('公式依赖') || dependency.text.includes('formula-dependency'),
    proxy: dependency.text.includes('规则生成代理') || dependency.text.includes('rule-generated proxies'),
    options: await evaluate(session, `document.querySelector('[data-testid="dependency-keyboard-cell-selector"]')?.options?.length || 0`),
  };
  if (
    !dependencySemantics.boundary
    || !dependencySemantics.missing
    || !dependencySemantics.formula
    || !dependencySemantics.proxy
    || dependencySemantics.options < 2
  ) {
    throw new Error(`Dependency scientific semantics failed: ${JSON.stringify(dependencySemantics)}`);
  }
  await evaluate(session, `(() => {
    const selector = document.querySelector('[data-testid="dependency-keyboard-cell-selector"]');
    const option = Array.from(selector.options).find((candidate) => candidate.value.includes('mfr::formula')) || selector.options[1];
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selector, option.value);
    selector.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitForCondition(session, `!!document.querySelector('[data-testid="dependency-selection-summary"]')`, 'dependency keyboard selection');
  if (!await triggerTooltip(session, '[data-testid="dependency-heatmap-scientific-chart"]', ['证据类型', 'Evidence type'])) {
    throw new Error('Dependency tooltip evidence type was not visible');
  }
  const dependencyInitialReady = dependency.readyCount;
  dependency = await assertResizeDoesNotReinitialize(
    session,
    'dependency-heatmap-migrated',
    'dependency-heatmap',
    dependencyInitialReady,
    1380,
    900,
  );
  await evaluate(session, `window.dispatchEvent(new CustomEvent('resindb-theme-change', { detail: 'dark' }))`);
  await waitForCondition(session, `document.documentElement.classList.contains('dark')`, 'dependency dark theme');
  const dependencyPng = await exportPng(session, 'dependency-export-png');
  await capture(session, dependencyScreenshot);
  await evaluate(session, `window.dispatchEvent(new CustomEvent('resindb-theme-change', { detail: 'light' }))`);
  await waitForCondition(session, `!document.documentElement.classList.contains('dark')`, 'dependency light theme');
  await evaluate(session, `(() => {
    const modal = Array.from(document.querySelectorAll('div.fixed.inset-0')).find((node) =>
      (node.innerText || '').includes('Performance Index Engine'));
    const closeButton = Array.from(modal?.querySelectorAll('button') || []).find((button) => button.querySelector('svg.lucide-x'));
    if (!closeButton) throw new Error('Formula editor close button is missing');
    closeButton.click();
  })()`);
  await waitForCondition(session, `!document.querySelector('[data-testid="dependency-heatmap-migrated"]')`, 'formula editor close');

  await clickByTitle(session, ['科研可视化', 'Scientific Visualization']);
  await waitForCondition(
    session,
    `document.body.innerText.includes('科学图表') || document.body.innerText.includes('Scientific Charts')`,
    'scientific analytics',
  );
  await clickByText(session, ['流变动力学', 'Rheology Curve']);
  await waitForCondition(session, `!!document.querySelector('[data-testid="rheology-graph-migrated"]')`, 'RheologyGraph');

  let rheology = await chartState(session, 'rheology-graph-migrated', 'rheology-graph');
  for (let attempt = 0; attempt < 160 && (rheology.readyCount < 1 || rheology.width < 250 || rheology.height < 200); attempt += 1) {
    await sleep(125);
    rheology = await chartState(session, 'rheology-graph-migrated', 'rheology-graph');
  }
  if (
    rheology.legacyWrapper !== 'false'
    || rheology.scientificBoundary !== 'mfr-derived-proxy-not-measurement'
    || rheology.readyCount < 1
    || rheology.width < 250
    || rheology.height < 200
  ) {
    throw new Error(`Rheology shared lifecycle failed: ${JSON.stringify(rheology)}`);
  }
  await waitForCondition(session, `(() => {
    const text = document.querySelector('[data-testid="rheology-graph-migrated"]')?.innerText || '';
    return text.includes('R² =') || text.includes('No positive proxy points') || text.includes('没有可拟合');
  })()`, 'rheology fit state', 160);
  rheology = await chartState(session, 'rheology-graph-migrated', 'rheology-graph');
  const rheologySemantics = {
    boundary: rheology.text.includes('不是实测流变') || rheology.text.includes('not measured rheology'),
    proxy: rheology.text.includes('MFR 派生') || rheology.text.includes('MFR-derived'),
    fitted: rheology.text.includes('代理点') || rheology.text.includes('proxy points'),
    units: rheology.text.includes('Pa·s'),
  };
  if (!rheologySemantics.boundary || !rheologySemantics.proxy || !rheologySemantics.fitted || !rheologySemantics.units) {
    throw new Error(`Rheology scientific semantics failed: ${JSON.stringify(rheologySemantics)}`);
  }
  if (!await triggerTooltip(session, '[data-testid="rheology-scientific-chart"]', ['筛选代理', 'Screening proxy'])) {
    throw new Error('Rheology tooltip evidence was not visible');
  }
  const rheologyInitialReady = rheology.readyCount;
  rheology = await assertResizeDoesNotReinitialize(
    session,
    'rheology-graph-migrated',
    'rheology-graph',
    rheologyInitialReady,
    1420,
    920,
  );
  await evaluate(session, `window.dispatchEvent(new CustomEvent('resindb-theme-change', { detail: 'dark' }))`);
  await waitForCondition(session, `document.documentElement.classList.contains('dark')`, 'rheology dark theme');
  const rheologyPng = await exportPng(session, 'rheology-export-png');
  await capture(session, rheologyScreenshot);

  const errors = browserErrors(session);
  if (errors.length > 0) {
    throw new Error(`Chromium emitted ${errors.length} error(s): ${errors.map((event) =>
      event.params?.entry?.text
      || event.params?.exceptionDetails?.exception?.description
      || event.method).join('; ')}`);
  }

  const manifest = {
    schemaVersion: 'phase2l-chromium-evidence-1.1.0',
    generatedAt: new Date().toISOString(),
    appUrl,
    dependencyHeatmap: {
      sharedScientificEChart: true,
      legacyWrapperRemoved: true,
      scientificBoundaryVisible: true,
      missingEvidenceNotZero: true,
      keyboardSelectionVerified: true,
      tooltipVerified: true,
      initialReadyCount: dependencyInitialReady,
      resizeReinitializationCount: dependency.readyCount - dependencyInitialReady,
      finalCanvas: { width: dependency.width, height: dependency.height },
      lightAndDarkThemeVerified: true,
      pngExport: dependencyPng,
      screenshot: path.basename(dependencyScreenshot),
    },
    rheologyGraph: {
      sharedScientificEChart: true,
      legacyWrapperRemoved: true,
      proxyAndFitSemanticsVerified: true,
      logarithmicUnitsVisible: true,
      tooltipVerified: true,
      initialReadyCount: rheologyInitialReady,
      resizeReinitializationCount: rheology.readyCount - rheologyInitialReady,
      finalCanvas: { width: rheology.width, height: rheology.height },
      lightAndDarkThemeVerified: true,
      pngExport: rheologyPng,
      screenshot: path.basename(rheologyScreenshot),
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  session.close();
  console.log('Phase 2L Chromium v2 smoke passed: lifecycle, semantics, tooltip, theme and PNG evidence are verified.');
} catch (error) {
  throw new Error([
    error instanceof Error ? error.stack || error.message : String(error),
    previewError ? `\nPreview stderr:\n${previewError}` : '',
    chromeError ? `\nChromium stderr tail:\n${chromeError.slice(-4_000)}` : '',
  ].join(''));
} finally {
  stop(chrome);
  stop(preview);
}
