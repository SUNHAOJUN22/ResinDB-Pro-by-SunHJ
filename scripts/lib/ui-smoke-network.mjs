import { networkInterfaces } from 'node:os';

/** Keep the preview bind address consistent with available browser targets. */
export function uiSmokeNetwork(previewPort, {
  uiHost = process.env.RESINDB_UI_HOST,
  getInterfaces = networkInterfaces,
  warn = console.warn,
} = {}) {
  if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65535) {
    throw new RangeError('UI smoke preview port must be a valid TCP port');
  }
  let host = '0.0.0.0';
  let networkHosts = [];
  try {
    networkHosts = Object.values(getInterfaces()).flat().filter(Boolean)
      .filter(entry => entry.family === 'IPv4' && !entry.internal)
      .map(entry => entry.address);
  } catch (error) {
    // Vite also enumerates interfaces for a wildcard bind. A loopback candidate
    // alone is insufficient: the preview must bind to loopback as well.
    host = '127.0.0.1';
    const message = error instanceof Error ? error.message : String(error);
    warn(`Unable to enumerate IPv4 interfaces; binding UI smoke preview to loopback: ${message}`);
  }
  return {
    host,
    healthHost: '127.0.0.1',
    healthUrl: `http://127.0.0.1:${previewPort}`,
    appUrlCandidates: [...new Set([
      uiHost, '127.0.0.1', 'localhost', ...networkHosts,
    ].filter(Boolean).map(candidate => `http://${candidate}:${previewPort}`))],
  };
}
