import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { networkInterfaces } from 'node:os';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const host = '0.0.0.0';
const healthHost = '127.0.0.1';
const previewPort = 4174;
const debugPort = 9224;
const healthUrl = `http://${healthHost}:${previewPort}`;
const networkHosts = Object.values(networkInterfaces()).flat().filter(Boolean).filter((entry) => entry.family === 'IPv4' && !entry.internal).map((entry) => entry.address);
const appUrlCandidates = [...new Set([process.env.RESINDB_UI_HOST, '127.0.0.1', 'localhost', ...networkHosts].filter(Boolean).map((candidate) => `http://${candidate}:${previewPort}`))];
const artifactDir = path.join(projectRoot, 'artifacts');
const screenshotPaths = {
  dashboard: path.join(artifactDir, 'ui-dashboard-zh-light.png'),
  emptyState: path.join(artifactDir, 'ui-empty-state.png'),
  productDetail: path.join(artifactDir, 'ui-product-detail.png'),
  analytics: path.join(artifactDir, 'ui-scientific-analytics.png'),
  scatter: path.join(artifactDir, 'ui-scatter-zh-light.png'),
  dependencyMap: path.join(artifactDir, 'ui-dependency-map.png'),
  dashboardEnDark: path.join(artifactDir, 'ui-dashboard-en-dark.png'),
  mobile: path.join(artifactDir, 'ui-mobile-dashboard.png'),
  copulaZh: path.join(artifactDir, 'ui-copula-zh.png'),
  copulaEn: path.join(artifactDir, 'ui-copula-en.png'),
  rsmZh: path.join(artifactDir, 'ui-rsm-zh.png'),
  rsmEn: path.join(artifactDir, 'ui-rsm-en.png'),
};

const chromeCandidates = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const chromeBin = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chromeBin) {
  throw new Error(
    `No Chromium-compatible browser found. Checked: ${chromeCandidates.join(', ')}`,
  );
}

const preview = spawn(
  process.execPath,
  [viteBin, 'preview', '--host', host, '--port', String(previewPort), '--strictPort'],
  {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

const chromeProfile = path.join('/tmp', `resindb-ui-smoke-${process.pid}`);
const chrome = spawn(
  chromeBin,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--no-proxy-server',
    '--proxy-bypass-list=<-loopback>',
    '--hide-scrollbars',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeProfile}`,
    '--window-size=1600,1000',
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

let previewError = '';
let chromeError = '';
preview.stdout.on('data', (chunk) => process.stdout.write(chunk));
preview.stderr.on('data', (chunk) => {
  previewError += chunk.toString();
  process.stderr.write(chunk);
});
chrome.stderr.on('data', (chunk) => {
  chromeError += chunk.toString();
});

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForHttp(url, attempts = 60) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return response;
    } catch {
      // Keep waiting until the process is ready.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpSession {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
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
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result || {});
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
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || JSON.stringify(response.exceptionDetails));
  }
  return response.result?.value;
}

async function waitForCondition(session, expression, description, attempts = 80) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await evaluate(session, expression)) return;
    await sleep(125);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function capture(session, targetPath) {
  const screenshot = await session.command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  writeFileSync(targetPath, Buffer.from(screenshot.data, 'base64'));
}

async function inspectAdvancedFigure(session, kind, language) {
  const labels = {
    copula: { zh: ['概率空间中的高斯 Copula 密度'], en: ['Gaussian-copula density in probability space'] },
    rsm: { zh: ['二次响应面模型', '观测数据'], en: ['Quadratic response-surface model', 'Observed data'] },
  };
  const expected = labels[kind][language];
  await waitForCondition(session, `(() => {
    const surface = document.querySelector('[data-scientific-chart-rendered="true"]');
    return surface?.querySelector('canvas') && ${JSON.stringify(expected)}.every(label => window.__resinDrawnText?.includes(label));
  })()`, `${kind} ${language} localized Canvas draw calls`, 160);
  if (language === 'en') {
    const panelText = await evaluate(session, `document.querySelector('[data-advanced-figure-panel="${kind}"]').innerText`);
    if (/\p{Script=Han}/u.test(panelText)) throw new Error(`${kind} retains Chinese system/property labels after switching to English: ${panelText}`);
  }
  const evidence = await evaluate(session, `(() => {
    const surface = document.querySelector('[data-scientific-chart-rendered="true"]');
    const canvas = surface.querySelector('canvas');
    const bounds = canvas.getBoundingClientRect();
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      if (pixels[index + 3] > 8 && pixels[index + 2] - pixels[index] > 20) colored++;
    }
    return { colored, width: canvas.width, height: canvas.height,
      aria: surface.getAttribute('aria-label'), drawnLabels: ${JSON.stringify(expected)}.filter(label => window.__resinDrawnText.includes(label)),
      cursor: { x: bounds.left + bounds.width * 0.5, y: bounds.top + bounds.height * 0.48 } };
  })()`);
  if (evidence.colored < 100 || evidence.width < 250 || evidence.height < 250
    || /\p{Script=Han}/u.test(evidence.aria || '') !== (language === 'zh')) {
    throw new Error(`${kind} ${language} has a blank or incorrectly localized figure: ${JSON.stringify(evidence)}`);
  }
  await session.command('Input.dispatchMouseEvent', { type: 'mouseMoved', ...evidence.cursor });
  const tooltipPattern = kind === 'copula'
    ? (language === 'zh' ? '拟合密度:' : 'Fitted density:')
    : (language === 'zh' ? '拟合值 ' : 'Fitted ');
  await waitForCondition(session, `document.body.innerText.includes(${JSON.stringify(tooltipPattern)})`, `${kind} ${language} localized hover tooltip`);
  evidence.tooltip = await evaluate(session, `(() => {
    const text = document.body.innerText;
    const start = text.lastIndexOf(${JSON.stringify(tooltipPattern)});
    return text.slice(Math.max(0, start - 100), start + 100);
  })()`);
  await capture(session, screenshotPaths[`${kind}${language === 'zh' ? 'Zh' : 'En'}`]);
  return evidence;
}

async function clickButtonByTitle(session, patterns) {
  const serialized = JSON.stringify(patterns);
  const clicked = await evaluate(session, `(() => {
    const patterns = ${serialized};
    const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
      patterns.some((pattern) => (candidate.title || '').includes(pattern))
    );
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Unable to find button title matching: ${patterns.join(', ')}`);
}

async function waitForDashboard(session) {
  for (let attempt = 1; attempt <= 80; attempt += 1) {
    const state = await evaluate(
      session,
      `(() => ({
        ready: document.readyState,
        count: Number(document.querySelector('[data-testid="record-count"]')?.dataset.count),
        text: document.body?.innerText || '',
        alert: (document.body?.innerText || '').includes('System Alert')
      }))()`,
    );
    if (state.alert) throw new Error('Authenticated UI rendered the System Alert error boundary');
    if (
      state.ready === 'complete' &&
      (state.text.includes('DATA WAREHOUSE') || state.text.includes('数据中心')) &&
      state.count === 13
    ) {
      return state.text;
    }
    await sleep(250);
  }
  throw new Error('Authenticated dashboard did not become ready');
}

function stop(processHandle) {
  if (processHandle.exitCode === null) processHandle.kill('SIGTERM');
}

try {
  await waitForHttp(healthUrl);
  await waitForHttp(`http://${healthHost}:${debugPort}/json/version`);
  const pages = await fetch(`http://${healthHost}:${debugPort}/json/list`).then((response) => response.json());
  const target = pages.find((page) => page.type === 'page');
  if (!target) throw new Error('Chromium did not expose a page target');

  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.open();
  await session.command('Page.enable');
  await session.command('Runtime.enable');
  await session.command('Log.enable');
  // Observe real Canvas text calls while still invoking the native drawing
  // methods. Pixel checks and screenshots independently verify painted output.
  await session.command('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__resinDrawnText = [];
    for (const method of ['fillText', 'strokeText']) {
      const native = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function (...args) {
        if (window.__resinDrawnText.length < 20000) window.__resinDrawnText.push(String(args[0]));
        return Reflect.apply(native, this, args);
      };
    }
  ` });
  await session.command('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  let appUrl = '';
  const navigationErrors = [];
  for (const candidate of appUrlCandidates) {
    const navigation = await session.command('Page.navigate', { url: candidate });
    if (navigation.errorText) {
      navigationErrors.push(`${candidate}: ${navigation.errorText}`);
      continue;
    }
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      const currentUrl = await evaluate(session, 'location.href');
      if (currentUrl.startsWith(candidate)) {
        appUrl = candidate;
        break;
      }
      await sleep(100);
    }
    if (appUrl) break;
    navigationErrors.push(`${candidate}: navigation did not settle`);
  }
  if (!appUrl) throw new Error(`Chromium could not reach preview. ${navigationErrors.join('; ')}`);

  const admin = JSON.stringify({
    id: 'demo-admin',
    name: 'Demo Admin',
    email: 'admin@example.invalid',
    role: 'admin',
  });
  await evaluate(
    session,
    `sessionStorage.setItem('resindb-session', ${JSON.stringify(admin)});
     localStorage.setItem('resindb-tour-completed', 'true');
     localStorage.setItem('resindb-language', 'zh');
     localStorage.setItem('resindb-theme', 'light');
     localStorage.setItem('resindb-color-theme', 'indigo');`,
  );
  await session.command('Page.reload', { ignoreCache: true });
  const bodyText = await waitForDashboard(session);

  const cjkFontEvidence = await evaluate(
    session,
    `(async () => {
      if (!document.fonts) return { available: false, family: null, status: 'unsupported' };
      await document.fonts.ready;
      const sample = '树脂数据库科学图表中文验收';
      const candidates = [
        'Noto Sans CJK SC',
        'Noto Sans SC',
        'Microsoft YaHei',
        'PingFang SC',
        'WenQuanYi Micro Hei'
      ];
      const family = candidates.find((name) => document.fonts.check('16px "' + name + '"', sample)) || null;
      return { available: Boolean(family), family, status: document.fonts.status };
    })()`,
  );
  if (!cjkFontEvidence.available) {
    throw new Error(`No usable CJK font is available to Chromium: ${JSON.stringify(cjkFontEvidence)}`);
  }

  const runtimeErrors = session.events.filter(
    (event) =>
      event.method === 'Runtime.exceptionThrown' ||
      (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error') ||
      (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'),
  );
  if (runtimeErrors.length > 0) {
    const summaries = runtimeErrors
      .map((event) => {
        const entry = event.params?.entry;
        const detail = entry?.url ? `${entry.text} (${entry.url})` : entry?.text;
        return detail || event.params?.exceptionDetails?.text || event.method;
      })
      .join('; ');
    throw new Error(`Browser console contains ${runtimeErrors.length} error(s): ${summaries}`);
  }

  mkdirSync(artifactDir, { recursive: true });
  await capture(session, screenshotPaths.dashboard);

  await evaluate(session, `(() => {
    const input = document.querySelector('#global-search-input');
    if (!input) throw new Error('Global search input is unavailable');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '__NO_MATCH_RESINDB_UI_TEST__');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await waitForCondition(session, `document.querySelectorAll('tbody tr[data-index]').length === 0 && !!Array.from(document.querySelectorAll('button')).find((button) => /重置|Reset/.test(button.textContent || ''))`, 'empty-state feedback');
  await capture(session, screenshotPaths.emptyState);

  await evaluate(session, `(() => {
    const input = document.querySelector('#global-search-input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await waitForCondition(session, `document.querySelectorAll('tbody tr[data-index]').length > 0`, 'data grid rows after clearing search');
  await evaluate(session, `(() => {
    const row = document.querySelector('tbody tr[data-index]');
    if (!row) throw new Error('No product row available');
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
    return true;
  })()`);
  await waitForCondition(session, `!!document.querySelector('button[aria-label="Close details"]')`, 'product detail drawer');
  await capture(session, screenshotPaths.productDetail);
  await evaluate(session, `document.querySelector('button[aria-label="Close details"]').click()`);
  await waitForCondition(session, `!document.querySelector('button[aria-label="Close details"]')`, 'product detail drawer close');

  await clickButtonByTitle(session, ['科研可视化', 'Scientific Visualization']);
  await waitForCondition(session, `document.body.innerText.includes('科学图表') || document.body.innerText.includes('Scientific Charts')`, 'scientific analytics view');
  await waitForCondition(session, `(() => {
    const canvas = document.querySelector('[data-scientific-chart-rendered="true"] canvas');
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    return rect.height >= 250 && rect.height <= innerHeight && rect.top + rect.height / 2 < innerHeight;
  })()`, 'visible radar viewport', 160);
  await evaluate(session, `(() => {
    const button = Array.from(document.querySelectorAll('button')).find(node => /CANVAS/i.test(node.textContent || ''));
    if (!button) throw new Error('Canvas scatter mode unavailable');
    button.click();
  })()`);
  await waitForCondition(session, `(() => {
    const graph = document.querySelector('[data-testid="canvas-scatter"]');
    const canvas = graph?.querySelector('canvas');
    return Number(graph?.dataset.eligiblePoints) >= 3 && canvas?.height >= 250;
  })()`, 'eligible scatter cohort and canvas');
  const scatterEvidence = await evaluate(session, `(() => {
    const graph = document.querySelector('[data-testid="canvas-scatter"]');
    const canvas = graph.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let plottedPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 30 && pixels[i + 2] - pixels[i] > 80 && pixels[i + 2] - pixels[i + 1] > 80) plottedPixels += 1;
    }
    const x = document.querySelector('[aria-label="散点图 X 轴"]')?.value;
    const y = document.querySelector('[aria-label="散点图 Y 轴"]')?.value;
    return { eligiblePoints: Number(graph.dataset.eligiblePoints), plottedPixels, width: canvas.width, height: canvas.height, x, y,
      visible: rect.height >= 250 && rect.height <= innerHeight && rect.top + rect.height / 2 < innerHeight };
  })()`);
  if (!scatterEvidence.visible || scatterEvidence.plottedPixels < 20 || scatterEvidence.x !== '密度' || scatterEvidence.y !== '熔体质量流动速率') {
    throw new Error('Scatter canvas lacks correct visible observations: ' + JSON.stringify(scatterEvidence));
  }
  await capture(session, screenshotPaths.scatter);
  const rheologyActivated = await evaluate(session, `(() => {
    const button = Array.from(document.querySelectorAll('button'))
      .find((candidate) => /RHEOLOGY/i.test(candidate.textContent || ''));
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!rheologyActivated) throw new Error('Unable to activate the rheology scientific chart');
  await waitForCondition(
    session,
    `(() => {
      const figure = Array.from(document.querySelectorAll('[data-scientific-figure="true"]'))
        .find((candidate) => candidate.dataset.scientificFigureState === 'ready'
          && Number(candidate.dataset.scientificFigurePoints || 0) > 0);
      const surface = figure?.querySelector('[data-scientific-chart-rendered="true"]');
      const canvas = surface?.querySelector('canvas');
      return Boolean(canvas && canvas.width >= 500 && canvas.height >= 250);
    })()`,
    'completed non-empty rheology chart rendering',
    160,
  );
  // A resize may start after the finished event; inspect current pixels inside
  // the bounded wait rather than reusing a readiness flag from an older frame.
  let analyticsEvidence = { ready: false, reason: 'render-pending' };
  for (let attempt = 0; attempt < 80; attempt += 1) {
    analyticsEvidence = await evaluate(session, `(() => {
      const figure = Array.from(document.querySelectorAll('[data-scientific-figure="true"]'))
        .find((candidate) => candidate.dataset.scientificFigureState === 'ready'
          && Number(candidate.dataset.scientificFigurePoints || 0) > 0);
      const canvas = figure?.querySelector('[data-scientific-chart-rendered="true"] canvas');
      if (!canvas) return { ready: false, reason: 'canvas-missing' };
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return { ready: false, reason: '2d-context-missing' };
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const pixelCount = canvas.width * canvas.height;
      const stride = Math.max(1, Math.floor(Math.sqrt(pixelCount / 120000)));
      let sampled = 0;
      let nonBackground = 0;
      let chromatic = 0;
      for (let y = 0; y < canvas.height; y += stride) {
        for (let x = 0; x < canvas.width; x += stride) {
          const index = (y * canvas.width + x) * 4;
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const alpha = pixels[index + 3];
          sampled += 1;
          if (alpha > 8 && Math.min(red, green, blue) < 242) nonBackground += 1;
          if (alpha > 8 && Math.max(red, green, blue) - Math.min(red, green, blue) > 12) chromatic += 1;
        }
      }
      return {
        ready: nonBackground > 500 && chromatic > 50,
        width: canvas.width,
        height: canvas.height,
        sampled,
        nonBackground,
        chromatic,
        points: Number(figure.dataset.scientificFigurePoints || 0)
      };
    })()`);
    if (analyticsEvidence.ready) break;
    await sleep(125);
  }
  if (!analyticsEvidence.ready) {
    throw new Error(`Scientific chart canvas is blank or lacks plotted signal: ${JSON.stringify(analyticsEvidence)}`);
  }
  await sleep(250);
  await capture(session, screenshotPaths.analytics);

  const advancedEvidence = {};
  for (const kind of ['copula', 'rsm']) {
    await evaluate(session, `(() => {
      window.__resinDrawnText = [];
      const mode = document.querySelector('[data-chart-mode="${kind}"]');
      if (!mode) throw new Error('Advanced chart selector missing: ${kind}');
      mode.click();
    })()`);
    await waitForCondition(session, `Boolean(document.querySelector('[aria-label="${kind === 'copula' ? 'Copula X' : 'RSM X1'}"]'))`, `${kind} input controls`);
    await evaluate(session, `(() => {
      const fields = ${JSON.stringify(kind === 'copula'
        ? { 'Copula X': '密度', 'Copula Y': '熔体质量流动速率' }
        : { 'RSM X1': '密度', 'RSM X2': '熔体质量流动速率', 'RSM Y': '拉伸屈服应力' })};
      for (const [label, value] of Object.entries(fields)) {
        const select = document.querySelector('[aria-label="' + label + '"]');
        if (!Array.from(select.options).some(option => option.value === value)) throw new Error('Required finite demo variable unavailable: ' + value);
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await evaluate(session, `(() => {
      const run = Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes(${JSON.stringify(kind === 'copula' ? '生成 Copula 概率密度' : '开始 RSM 拟合计算')}));
      if (!run || run.disabled) throw new Error('Advanced calculation is unavailable: ${kind}');
      run.click();
    })()`);
    advancedEvidence[`${kind}Zh`] = await inspectAdvancedFigure(session, kind, 'zh');
    if (kind === 'copula') {
      await waitForCondition(session, `['X', 'Y'].every(axis => document.querySelector('[aria-label="Copula ' + axis + ' 阈值"]') instanceof HTMLInputElement)`, 'mounted Copula threshold inputs');
      await evaluate(session, `(() => {
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        for (const axis of ['X', 'Y']) {
          const input = document.querySelector('[aria-label="Copula ' + axis + ' 阈值"]');
          if (!(input instanceof HTMLInputElement)) throw new Error('Copula threshold input missing: ' + axis + '; language=' + document.documentElement.lang + '; controls=' + JSON.stringify(Array.from(document.querySelectorAll('input')).map(item => item.getAttribute('aria-label'))));
          setValue.call(input, '1000');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`);
      await evaluate(session, `Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('计算联合概率积分')).click()`);
      await waitForCondition(session, `document.querySelector('[data-testid="copula-joint-probability"]')?.textContent.trim() === '100.00%' && document.querySelector('[data-testid="copula-independent-probability"]')?.textContent.includes('100.00')`, 'exact Copula upper boundary and independent ECDF comparison');
      advancedEvidence.copulaProbability = { thresholds: [1000, 1000], jointPercent: 100, independentPercent: 100 };
    }
    await evaluate(session, `(() => { window.__resinDrawnText = []; document.querySelector('[data-testid="language-control"]').click(); })()`);
    advancedEvidence[`${kind}En`] = await inspectAdvancedFigure(session, kind, 'en');
    await evaluate(session, `(() => { window.__resinDrawnText = []; document.querySelector('[data-testid="language-control"]').click(); })()`);
    await waitForCondition(session, `document.documentElement.lang === 'zh-CN'`, `${kind} return to Chinese`);
  }

  await clickButtonByTitle(session, ['依赖网络谱图', 'Dependency']);
  await waitForCondition(session, `!!document.querySelector('[data-testid="dependency-map-svg"]')`, 'dependency map');
  await evaluate(session, `(() => {
    const node = document.querySelector('[data-testid="dependency-map-svg"] g');
    if (!node) throw new Error('Dependency map has no clickable nodes');
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  })()`);
  await waitForCondition(session, `document.body.innerText.includes('CAS：') || document.body.innerText.includes('chemical') || document.body.innerText.includes('resin')`, 'dependency node details');
  await capture(session, screenshotPaths.dependencyMap);

  await clickButtonByTitle(session, ['数据仓库', 'Data Warehouse']);
  await waitForCondition(session, `Number(document.querySelector('[data-testid="record-count"]')?.dataset.count) === 13`, 'dashboard before responsive capture');
  await session.command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await sleep(500);
  await capture(session, screenshotPaths.mobile);
  await session.command('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const preferenceState = await evaluate(
    session,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const languageButton = document.querySelector('[data-testid="language-control"]');
      const themeButton = document.querySelector('[data-testid="theme-control"]');
      const paletteButton = document.querySelector('[data-testid="palette-control"]');
      if (!languageButton || !themeButton || !paletteButton) {
        throw new Error('Language/theme/palette controls are not visible in the top bar');
      }
      languageButton.click();
      themeButton.click();
      paletteButton.click();
      return true;
    })()`,
  );
  if (!preferenceState) throw new Error('Failed to activate preference controls');
  await sleep(500);

  await evaluate(
    session,
    `(() => {
      const emeraldButton = Array.from(document.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Emerald Bio'));
      if (!emeraldButton) throw new Error('Emerald palette option is unavailable');
      emeraldButton.click();
      return true;
    })()`,
  );
  await sleep(500);

  const savedPreferences = await evaluate(
    session,
    `(() => ({
      language: localStorage.getItem('resindb-language'),
      theme: localStorage.getItem('resindb-theme'),
      colorTheme: localStorage.getItem('resindb-color-theme'),
      htmlLanguage: document.documentElement.lang,
      dark: document.documentElement.classList.contains('dark')
    }))()`,
  );
  if (
    savedPreferences.language !== 'en' ||
    savedPreferences.theme !== 'dark' ||
    savedPreferences.colorTheme !== 'emerald' ||
    savedPreferences.htmlLanguage !== 'en' ||
    !savedPreferences.dark
  ) {
    throw new Error(`Preference controls did not persist correctly: ${JSON.stringify(savedPreferences)}`);
  }

  await clickButtonByTitle(session, ['Scientific Visualization', '科研可视化']);
  await clickButtonByTitle(session, ['Data Warehouse', '数据中心']);
  await sleep(500);
  await capture(session, screenshotPaths.dashboardEnDark);

  const finalRuntimeErrors = session.events.filter(
    (event) =>
      event.method === 'Runtime.exceptionThrown' ||
      (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error') ||
      (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'),
  );
  if (finalRuntimeErrors.length > 0) {
    const summaries = finalRuntimeErrors.map((event) => event.params?.entry?.text || event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text || event.method).join('; ');
    throw new Error(`Browser runtime emitted ${finalRuntimeErrors.length} error(s) during interactive flows: ${summaries}`);
  }

  const artifactManifest = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    appUrl,
    scatterCanvas: scatterEvidence,
    recordCount: await evaluate(session, `Number(document.querySelector('[data-testid="record-count"]')?.dataset.count)`),
    screenshots: Object.fromEntries(Object.entries(screenshotPaths).map(([name, file]) => [name, path.basename(file)])),
    preferences: savedPreferences,
    cjkFont: cjkFontEvidence,
    scientificCanvas: analyticsEvidence,
    advancedFigures: advancedEvidence,
  };
  writeFileSync(path.join(artifactDir, 'ui-smoke-manifest.json'), `${JSON.stringify(artifactManifest, null, 2)}
`);
  session.close();

  console.log(
    'UI smoke test passed: readable CJK typography, dashboard, empty state, product details, non-blank scientific chart, dependency map, responsive layout and preferences are interactive.',
  );
  console.log(`CJK font: ${cjkFontEvidence.family}`);
  console.log(`Scientific canvas evidence: ${JSON.stringify(analyticsEvidence)}`);
  console.log(`Screenshots: ${Object.values(screenshotPaths).join(', ')}`);
} catch (error) {
  const diagnostics = [
    error instanceof Error ? error.stack || error.message : String(error),
    previewError ? `\nPreview stderr:\n${previewError}` : '',
    chromeError ? `\nChromium stderr (tail):\n${chromeError.slice(-4_000)}` : '',
  ].join('');
  throw new Error(diagnostics);
} finally {
  stop(chrome);
  stop(preview);
}
