import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const chunks = ['scripts/.phase2l-payload-00.txt', 'scripts/.phase2l-payload-01.txt', 'scripts/.phase2l-payload-02.txt', 'scripts/.phase2l-payload-03.txt', 'scripts/.phase2l-payload-04.txt', 'scripts/.phase2l-payload-05.txt', 'scripts/.phase2l-payload-06-07.txt', 'scripts/.phase2l-payload-08-09.txt', 'scripts/.phase2l-payload-10-11.txt', 'scripts/.phase2l-payload-12-13.txt', 'scripts/.phase2l-payload-14-15.txt', 'scripts/.phase2l-payload-16-17.txt', 'scripts/.phase2l-payload-18-19.txt', 'scripts/.phase2l-payload-20-21.txt'];
const payload = chunks.map((path) => readFileSync(path, 'utf8')).join('');
const archive = '/tmp/resindb-phase2l-final-files.tar.gz';
writeFileSync(archive, Buffer.from(payload, 'base64'));
execFileSync('tar', ['-xzf', archive, '-C', process.cwd()], { stdio: 'inherit' });
for (const path of [
  ...chunks,
  '.github/workflows/phase2l-bootstrap.yml',
  'scripts/ui-phase2l-scientific-smoke-v2.mjs',
  'scripts/phase2l-apply-final.mjs',
]) {
  try { unlinkSync(path); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
}
execFileSync('git', ['config', 'user.name', 'ResinDB CI Closure'], { stdio: 'inherit' });
execFileSync('git', ['config', 'user.email', 'resindb-ci-closure@users.noreply.github.com'], { stdio: 'inherit' });
execFileSync('git', ['add', '-A'], { stdio: 'inherit' });
execFileSync('git', ['diff', '--cached', '--check'], { stdio: 'inherit' });
execFileSync('git', ['commit', '-m', 'fix: close phase 2l wrapper migration'], { stdio: 'inherit' });
execFileSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' });
