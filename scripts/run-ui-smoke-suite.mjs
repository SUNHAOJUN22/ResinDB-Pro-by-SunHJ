import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runScript(relativePath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, relativePath)], {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, output }));
  });
}

const mainSmoke = 'scripts/ui-smoke-test.mjs';
let result = await runScript(mainSmoke);
if (
  result.code !== 0
  && result.output.includes('Timed out waiting for http://127.0.0.1:9224/json/version')
) {
  console.warn('Chromium remote-debugging startup timed out; retrying the unchanged UI smoke once.');
  result = await runScript(mainSmoke);
}
if (result.code !== 0) {
  throw new Error(`Primary Chromium UI smoke failed${result.signal ? ` (${result.signal})` : ''}`);
}

const calibration = await runScript('scripts/ui-kmeans-calibration-smoke.mjs');
if (calibration.code !== 0) {
  throw new Error(`K-Means calibration Chromium smoke failed${calibration.signal ? ` (${calibration.signal})` : ''}`);
}

const phase2l = await runScript('scripts/ui-phase2l-scientific-smoke-v2.mjs');
if (phase2l.code !== 0) {
  throw new Error(`Phase 2L scientific Chromium smoke failed${phase2l.signal ? ` (${phase2l.signal})` : ''}`);
}

console.log('Complete Chromium UI smoke suite passed.');
