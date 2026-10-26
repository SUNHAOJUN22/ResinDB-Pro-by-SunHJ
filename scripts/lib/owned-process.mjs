import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null || !child.pid;
}

/** Clean up a live handle owned by the caller; never search global process names. */
export async function stopOwnedChild(child, graceMs = 2_000) {
  if (hasExited(child)) return;
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    if (result.error) throw result.error;
    if (result.status !== 0 && !hasExited(child)) throw new Error(`Unable to stop owned process ${child.pid}`);
  } else {
    child.kill('SIGTERM');
  }
  const deadline = Date.now() + graceMs;
  while (!hasExited(child) && Date.now() < deadline) await delay(25);
  if (!hasExited(child)) child.kill('SIGKILL');
}

/** POSIX descendants inherit this new process group. The closure retains its
 * ownership token even when the script exits before its children. Windows uses
 * taskkill only for a still-live owned handle; runtime finally blocks clean up
 * each directly owned preview/browser tree before exiting.
 */
export function spawnOwnedProcess(command, args, options = {}) {
  const child = spawn(command, args, { ...options, detached: process.platform !== 'win32' });
  let stopping;
  const stop = () => {
    if (stopping) return stopping;
    stopping = (async () => {
      if (process.platform === 'win32') return stopOwnedChild(child);
      const groupId = child.pid;
      if (!Number.isSafeInteger(groupId) || groupId <= 0) return;
      const signalGroup = signal => {
        try { process.kill(-groupId, signal); return true; }
        catch (error) { if (error.code === 'ESRCH') return false; throw error; }
      };
      if (!signalGroup('SIGTERM')) return;
      const deadline = Date.now() + 2_000;
      while (Date.now() < deadline) {
        await delay(25);
        if (!signalGroup(0)) return;
      }
      signalGroup('SIGKILL');
    })();
    return stopping;
  };
  return { child, stop };
}
