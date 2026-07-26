import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const host = '127.0.0.1';
const previewPort = 4174;
const debugPort = 9224;
const appUrl = `http://${host}:${previewPort}`;
const artifactDir = path.join(projectRoot, 'artifacts');
const screenshotZhPath = path.join(artifactDir, 'ui-smoke-dashboard-zh.png');
const screenshotEnDarkPath = path.join(artifactDir, 'ui-smoke-dashboard-en-dark.png');

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
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
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

async function waitForHttp(url, attempts = 120) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (url === appUrl && preview.exitCode !== null) {
      throw new Error(`Preview exited before ${url} became ready (code ${preview.exitCode})`);
    }
    if (url.includes(`:${debugPort}/`) && chrome.exitCode !== null) {
      throw new Error(`Chromium exited before the debug endpoint became ready (code ${chrome.exitCode})`);
    }
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
    throw new Error(response.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return response.result?.value;
}

async function waitForDashboard(session) {
  for (let attempt = 1; attempt <= 120; attempt += 1) {
    const state = await evaluate(
      session,
      `(() => ({
        ready: document.readyState,
        text: document.body?.innerText || '',
        alert: (document.body?.innerText || '').includes('System Alert')
      }))()`,
    );
    if (state.alert) throw new Error('Authenticated UI rendered the System Alert error boundary');
    if (
      state.ready === 'complete' &&
      (state.text.includes('DATA WAREHOUSE') || state.text.includes('数据中心')) &&
      state.text.includes('13 RECORDS')
    ) {
      return state.text;
    }
    await sleep(250);
  }
  throw new Error('Authenticated dashboard did not become ready');
}

async function waitForPageTarget(attempts = 120) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (chrome.exitCode !== null) {
      throw new Error(`Chromium exited before exposing a page target (code ${chrome.exitCode})`);
    }
    try {
      const pages = await fetch(`http://${host}:${debugPort}/json/list`, {
        signal: AbortSignal.timeout(1_000),
      }).then((response) => response.json());
      const target = pages.find((page) => page.type === 'page');
      if (target) return target;
    } catch {
      // The remote debugging target can lag behind the version endpoint.
    }
    await sleep(250);
  }
  throw new Error('Chromium did not expose a page target');
}

function stop(processHandle) {
  if (processHandle.exitCode === null) processHandle.kill('SIGTERM');
}

try {
  await waitForHttp(appUrl);
  await waitForHttp(`http://${host}:${debugPort}/json/version`);
  const target = await waitForPageTarget();

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
  await session.command('Page.navigate', { url: appUrl });
  await sleep(1_500);

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
  const screenshotZh = await session.command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  writeFileSync(screenshotZhPath, Buffer.from(screenshotZh.data, 'base64'));

  const preferenceState = await evaluate(
    session,
    `(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const languageButton = buttons.find((button) => button.title?.includes('Switch to English'));
      const themeButton = buttons.find((button) => button.title?.includes('深色夜间模式'));
      const paletteButton = buttons.find((button) => button.title?.includes('皮肤配色主题'));
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

  const screenshotEnDark = await session.command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  writeFileSync(screenshotEnDarkPath, Buffer.from(screenshotEnDark.data, 'base64'));
  session.close();

  console.log(
    `UI smoke test passed: authenticated dashboard rendered ${bodyText.includes('13 RECORDS') ? '13 records' : 'successfully'} and persisted language/theme/palette controls.`,
  );
  console.log(`Screenshots: ${screenshotZhPath}, ${screenshotEnDarkPath}`);
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
