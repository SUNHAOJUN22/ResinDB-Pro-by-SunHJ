import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applicationRuntimeErrors, isRetryableBrowserStartupFailure, throwApplicationFailure } from '../lib/ui-smoke-failure.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawnOwnedProcess } from '../lib/owned-process.mjs';

const options = { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] };
const liveProgram = "process.send('ready'); setInterval(() => {}, 1000);";

async function ready(owned) {
  const [message] = await once(owned.child, 'message');
  assert.equal(message, 'ready');
}

test('cleanup only stops the owned process group, including its descendants', { skip: process.platform === 'win32' }, async t => {
  const unrelated = spawnOwnedProcess(process.execPath, ['-e', liveProgram, '--', 'vite.js', 'preview', '--port', '4174'], options);
  t.after(() => unrelated.stop());
  await ready(unrelated);
  const owned = spawnOwnedProcess(process.execPath, ['-e', `
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, ['-e', "process.send('ready'); setInterval(() => {}, 1000)"], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    child.on('message', () => process.send({ descendant: child.pid }));
    process.on('SIGTERM', () => child.once('exit', () => process.exit(0)));
  `], options);
  t.after(() => owned.stop());
  const [{ descendant }] = await once(owned.child, 'message');
  assert.ok(Number.isInteger(descendant));
  const exited = once(owned.child, 'exit');
  await owned.stop();
  await exited;
  assert.throws(() => process.kill(descendant, 0), { code: 'ESRCH' });
  assert.equal(unrelated.child.exitCode, null);
  assert.equal(unrelated.child.signalCode, null);
  assert.doesNotThrow(() => process.kill(unrelated.child.pid, 0));
});

test('a failed spawn has no cleanup authority over an unrelated process', async t => {
  const unrelated = spawnOwnedProcess(process.execPath, ['-e', liveProgram], options);
  t.after(() => unrelated.stop());
  await ready(unrelated);
  const failed = spawnOwnedProcess('resindb-nonexistent-fixture-command', [], options);
  const [error] = await once(failed.child, 'error');
  assert.equal(error.code, 'ENOENT');
  assert.equal(failed.child.pid, undefined);
  await failed.stop();
  assert.equal(unrelated.child.exitCode, null);
  assert.equal(unrelated.child.signalCode, null);
});

test('port-conflict cleanup does not terminate the existing server', async t => {
  const server = spawnOwnedProcess(process.execPath, ['-e', `
    const server = require('node:net').createServer();
    server.listen(0, '127.0.0.1', () => process.send(server.address().port));
  `], options);
  t.after(() => server.stop());
  const [port] = await once(server.child, 'message');
  const conflicting = spawnOwnedProcess(process.execPath, ['-e', `
    const server = require('node:net').createServer();
    server.on('error', error => { process.send(error.code); process.exitCode = 1; });
    server.listen(${port}, '127.0.0.1');
  `], options);
  t.after(() => conflicting.stop());
  const exit = once(conflicting.child, 'exit');
  const [code] = await once(conflicting.child, 'message');
  assert.equal(code, 'EADDRINUSE');
  const [exitCode] = await exit;
  assert.equal(exitCode, 1);
  await conflicting.stop();
  assert.equal(server.child.exitCode, null);
  assert.equal(server.child.signalCode, null);
});


test('normal DevTools startup cannot make application or policy failures retryable', () => {
  const ready = 'DevTools listening on ws://127.0.0.1:9224/devtools/browser/example';
  for (const reason of [
    'Authenticated UI rendered the System Alert error boundary',
    'application-error-boundary', 'net::ERR_BLOCKED_BY_ADMINISTRATOR',
    'Unable to find required chart', 'Scientific canvas evidence failed',
  ]) assert.equal(isRetryableBrowserStartupFailure(`${reason}\n${ready}`), false);
  assert.equal(isRetryableBrowserStartupFailure(ready), false);
  assert.equal(isRetryableBrowserStartupFailure(null), false);
});

test('only recognized startup failure messages are eligible for a bounded retry', () => {
  for (const reason of ['Timed out waiting for http://127.0.0.1:34567/json/version',
    'bind() failed: Address already in use', 'listen EADDRINUSE: 127.0.0.1:4174']) {
    assert.equal(isRetryableBrowserStartupFailure(reason), true);
    assert.equal(isRetryableBrowserStartupFailure(`${reason}\nSystem Alert`), false);
  }
  assert.equal(isRetryableBrowserStartupFailure('Timed out waiting for http://127.0.0.1:4174/'), false);
});

test('browser failure evidence retains exception and error-console payloads only', () => {
  const exception = { method: 'Runtime.exceptionThrown', params: { exceptionDetails: { text: 'boom' } } };
  const consoleError = { method: 'Runtime.consoleAPICalled', params: { type: 'error', args: [{ description: 'stack' }] } };
  const events = [null, exception, { method: 'Runtime.consoleAPICalled', params: { type: 'log' } },
    consoleError, { method: 'Page.loadEventFired' }];
  assert.deepEqual(applicationRuntimeErrors(events), [exception, consoleError]);
  assert.equal(events.length, 5);
});


test('an unavailable diagnostic screenshot cannot mask the original application failure', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'resindb-failure-contract-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const event = { method: 'Runtime.exceptionThrown', params: { exceptionDetails: { text: 'fixture error' } } };
  const session = { events: [event], command: async () => { throw new Error('fixture capture failure'); } };
  await assert.rejects(throwApplicationFailure(session, { text: 'System Alert' }, directory),
    /Authenticated UI rendered the System Alert error boundary.*fixture error/);
  const evidence = JSON.parse(readFileSync(path.join(directory, 'ui-smoke-failure.json'), 'utf8'));
  assert.equal(evidence.reason, 'application-error-boundary');
  assert.deepEqual(evidence.runtimeErrors, [event]);
});
