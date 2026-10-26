import { spawnOwnedProcess } from './lib/owned-process.mjs';
import {
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptsDirectory = path.join(root, 'scripts');
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let runtimeSequence = 0;

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to reserve a Chromium debugging port'));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`${label}: expected exactly one source match`);
  }
  return source.replace(pattern, replacement);
}

function buildHardenedRuntimeCopy(relativePath) {
  const sourcePath = path.join(root, relativePath);
  let source = readFileSync(sourcePath, 'utf8');
  source = `import { stopOwnedChild } from './lib/owned-process.mjs';\n${source}`;
  source = replaceExactlyOnce(
    source,
    /const debugPort = \d+;/g,
    `const debugPort = Number.parseInt(process.env.RESINDB_CHROME_DEBUG_PORT ?? '', 10);\nif (!Number.isInteger(debugPort) || debugPort < 1024 || debugPort > 65535) {\n  throw new Error('RESINDB_CHROME_DEBUG_PORT must be an available TCP port');\n}`,
    `${relativePath} debug-port contract`,
  );
  source = source.replace(
    /async function waitForHttp\(url, attempts = \d+\)/,
    'async function waitForHttp(url, attempts = 160)',
  );
  source = source.replace(
    /async function waitHttp\(url, attempts = \d+\)/,
    'async function waitHttp(url, attempts = 160)',
  );
  if (!source.includes('--remote-debugging-address=127.0.0.1')) {
    source = replaceExactlyOnce(
      source,
      /(['"]--remote-allow-origins=\*['"],?\s*\n)(\s*)(`--remote-debugging-port=\$\{debugPort\}`)/g,
      `$1$2'--remote-debugging-address=127.0.0.1',\n$2$3`,
      `${relativePath} loopback debugging contract`,
    );
  }
  source = replaceExactlyOnce(
    source,
    /function stop\(processHandle\) \{\s*if \(processHandle\.exitCode === null\) processHandle\.kill\('SIGTERM'\);\s*\}/g,
    `async function stop(processHandle) {\n  await stopOwnedChild(processHandle);\n}`,
    `${relativePath} process cleanup contract`,
  );
  source = replaceExactlyOnce(
    source,
    /\} finally \{\s*stop\(chrome\);\s*stop\(preview\);\s*\}/g,
    `} finally {\n  await stop(chrome);\n  await stop(preview);\n}`,
    `${relativePath} awaited cleanup contract`,
  );

  runtimeSequence += 1;
  const runtimePath = path.join(
    scriptsDirectory,
    `.resindb-ui-runtime-${process.pid}-${runtimeSequence}.mjs`,
  );
  writeFileSync(runtimePath, source, 'utf8');
  return runtimePath;
}

const activeRuns = new Set();
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => {
    void Promise.allSettled([...activeRuns].map(run => run.stop())).then(() => process.exit(code));
  });
}

async function cleanupRun({ owned, profilePrefix, runtimePath }) {
  await owned.stop();
  activeRuns.delete(owned);
  // A failed spawn has no process ID and could not create a browser profile.
  if (owned.child.pid) {
    const profilePath = path.join('/tmp', `${profilePrefix}-${owned.child.pid}`);
    rmSync(profilePath, { recursive: true, force: true });
  }
  rmSync(runtimePath, { force: true });
}

async function runHardenedScript({ relativePath, profilePrefix }) {
  const debugPort = await reserveLoopbackPort();
  const runtimePath = buildHardenedRuntimeCopy(relativePath);
  return new Promise((resolve, reject) => {
    const owned = spawnOwnedProcess(process.execPath, [runtimePath], {
      cwd: root,
      env: {
        ...process.env,
        RESINDB_CHROME_DEBUG_PORT: String(debugPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    activeRuns.add(owned);
    const { child } = owned;
    let settled = false;
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    const finish = async (code, signal, error) => {
      if (settled) return;
      settled = true;
      try {
        await cleanupRun({ owned, profilePrefix, runtimePath });
        if (error) throw error;
        resolve({ code: code ?? 1, signal, output, debugPort });
      } catch (cleanupError) { reject(cleanupError); }
    };
    // exit is emitted even when orphaned descendants still hold stdio pipes.
    child.once('exit', (code, signal) => { void finish(code, signal); });
    child.once('error', error => { void finish(1, null, error); });
  });
}

const primaryContract = {
  relativePath: 'scripts/ui-smoke-test.mjs',
  previewPort: 4174,
  profilePrefix: 'resindb-ui-smoke',
};
let primaryResult;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  primaryResult = await runHardenedScript(primaryContract);
  if (primaryResult.code === 0) break;
  const retryable = /Timed out waiting for .*json\/version|Address already in use|DevTools/i
    .test(primaryResult.output);
  if (!retryable || attempt === 3) break;
  console.warn(
    `Chromium startup contract failed on dynamic port ${primaryResult.debugPort}; retrying after bounded cleanup (${attempt}/3).`,
  );
  await sleep(1_500);
}
if (!primaryResult || primaryResult.code !== 0) {
  throw new Error(
    `Primary Chromium UI smoke failed${primaryResult?.signal ? ` (${primaryResult.signal})` : ''}`,
  );
}

const calibration = await runHardenedScript({
  relativePath: 'scripts/ui-kmeans-calibration-smoke.mjs',
  previewPort: 4175,
  profilePrefix: 'resindb-kmeans-calibration',
});
if (calibration.code !== 0) {
  throw new Error(
    `K-Means calibration Chromium smoke failed${calibration.signal ? ` (${calibration.signal})` : ''}`,
  );
}

const phase2l = await runHardenedScript({
  relativePath: 'scripts/ui-phase2l-scientific-smoke.mjs',
  previewPort: 4176,
  profilePrefix: 'resindb-phase2l-chrome',
});
if (phase2l.code !== 0) {
  throw new Error(
    `Phase 2L scientific Chromium smoke failed${phase2l.signal ? ` (${phase2l.signal})` : ''}`,
  );
}

console.log('Complete Chromium UI smoke suite passed with isolated dynamic debugging ports.');
