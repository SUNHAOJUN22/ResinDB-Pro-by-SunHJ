import { spawnSync } from 'node:child_process';

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  executable,
  ['vitest', 'run', 'tests/performance/performance-regression.test.ts', '--pool=forks', '--maxWorkers=1'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PERFORMANCE_REPORT_PATH:
        process.env.PERFORMANCE_REPORT_PATH || 'reports/performance-audit-20260727/final-benchmarks.json',
    },
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
