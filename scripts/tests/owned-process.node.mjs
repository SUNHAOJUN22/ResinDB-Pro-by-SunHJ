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
