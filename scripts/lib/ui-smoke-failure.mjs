import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Retry only recognized startup failures, never an application/policy failure. */
export function isRetryableBrowserStartupFailure(output) {
  if (typeof output !== 'string') return false;
  if (/System Alert|application-error-boundary|ERR_BLOCKED_BY_ADMINISTRATOR/i.test(output)) return false;
  return /Timed out waiting for https?:\/\/[^\s]+\/json\/version(?:\s|$)|Address already in use|EADDRINUSE/i.test(output);
}

/** Preserve browser error payloads without treating normal DevTools output as a failure. */
export function applicationRuntimeErrors(events) {
  return events.filter(event => event?.method === 'Runtime.exceptionThrown'
    || (event?.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error'));
}

/** Record the original application failure even when screenshot capture fails. */
export async function throwApplicationFailure(session, state, artifactDirectory) {
  const runtimeErrors = applicationRuntimeErrors(session.events);
  mkdirSync(artifactDirectory, { recursive: true });
  writeFileSync(path.join(artifactDirectory, 'ui-smoke-failure.json'), `${JSON.stringify({
    phase: 'authenticated-dashboard', reason: 'application-error-boundary',
    pageText: state.text, runtimeErrors,
  }, null, 2)}\n`, 'utf8');
  let timer;
  try {
    const screenshot = await Promise.race([
      session.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Failure screenshot timed out')), 3_000);
      }),
    ]);
    writeFileSync(path.join(artifactDirectory, 'ui-smoke-failure.png'), Buffer.from(screenshot.data, 'base64'));
  } catch (captureError) {
    console.error('Failure screenshot unavailable:', String(captureError));
  } finally {
    clearTimeout(timer);
  }
  throw new Error(`Authenticated UI rendered the System Alert error boundary: ${JSON.stringify(runtimeErrors)}`);
}
