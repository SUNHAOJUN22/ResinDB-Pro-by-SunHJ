#!/usr/bin/env python3
from __future__ import annotations
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1])
logs = root / 'logs'
summary_path = Path('reports/final-visual-upgrade-20260726/summary.json')
alias_path = Path('reports/ci-validation-latest.json')
report_path = Path('reports/final-visual-upgrade-20260726/REPORT.md')
statuses = {p.stem: int(p.read_text().strip()) for p in sorted(root.glob('*.status'))}
runtime = dict(line.split('=', 1) for line in (root / 'runtime.txt').read_text().splitlines() if '=' in line)
branches = (root / 'remote-branches.txt').read_text().splitlines() if (root / 'remote-branches.txt').exists() else []
commit = (root / 'validated-input-commit.txt').read_text().strip()
coverage_text = (logs / 'test-coverage.txt').read_text(errors='replace') if (logs / 'test-coverage.txt').exists() else ''
coverage_text = re.sub(r'\x1b\[[0-9;]*m', '', coverage_text)
tests = re.search(r'Tests\s+(\d+) passed', coverage_text)
files = re.search(r'Test Files\s+(\d+) passed', coverage_text)
coverage_match = re.search(r'All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)', coverage_text)
coverage = {}
if coverage_match:
    coverage = {
        'statements': float(coverage_match.group(1)),
        'branches': float(coverage_match.group(2)),
        'functions': float(coverage_match.group(3)),
        'lines': float(coverage_match.group(4)),
    }
visuals = sorted(p.name for p in Path('docs/assets').glob('resindb-*.svg'))
result = 'success' if statuses and all(code == 0 for code in statuses.values()) else 'failure'
completed = dt.datetime.now(dt.timezone.utc).isoformat()
patch_sha = subprocess.check_output(['bash', '-lc', 'git diff --binary HEAD | git hash-object --stdin'], text=True).strip()
proof = {
    'result': result,
    'validatedInputCommit': commit,
    'candidatePatchSha': patch_sha,
    'completedAt': completed,
    'runtime': runtime,
    'remoteBranches': branches,
    'statuses': statuses,
    'scope': 'UI UX Pro Max README visual system plus source, application, scientific, browser and dependency validation',
    'rawEvidenceArtifact': f'resindb-uiux-visual-final-proof-{commit}',
}
try:
    summary = json.loads(summary_path.read_text(encoding='utf-8'))
except Exception:
    summary = {'schemaVersion': 1, 'repository': 'SUNHAOJUN22/ResinDB-Pro-by-SunHJ', 'version': '3.0.0'}
summary.update({
    'result': result,
    'validatedInputCommit': commit,
    'candidatePatchSha': patch_sha,
    'completedAt': completed,
    'runtime': runtime,
    'remoteBranches': branches,
    'statuses': statuses,
    'testFilesPassed': int(files.group(1)) if files else summary.get('testFilesPassed'),
    'testsPassed': int(tests.group(1)) if tests else summary.get('testsPassed'),
    'coveragePercent': coverage or summary.get('coveragePercent', {}),
    'visualCount': len(visuals),
    'generatedVisuals': visuals,
    'visualDesignSystem': 'resindb-uiux-pro-max-v1',
    'visualDesignMethod': ['Swiss Modernism 2.0', 'Bento Grid', 'Accessible & Ethical', 'Dimensional Layering'],
    'visualDesignSources': ['nextlevelbuilder/ui-ux-pro-max-skill', 'bbylw/ui-ux-pro-max-skill-cn'],
    'rawEvidenceArtifact': proof['rawEvidenceArtifact'],
    'currentTreeVerification': proof,
})
payload = json.dumps(summary, ensure_ascii=False, indent=2) + '\n'
summary_path.parent.mkdir(parents=True, exist_ok=True)
summary_path.write_text(payload, encoding='utf-8')
alias_path.write_text(payload, encoding='utf-8')
lines = [
    '# ResinDB Pro UI/UX Pro Max visual validation report', '',
    f'- Result: **{result.upper()}**',
    f'- Validated input commit: `{commit}`',
    f'- Candidate patch SHA: `{patch_sha}`',
    f"- Runtime: `{runtime.get('node')}` / `{runtime.get('npm')}` / `{runtime.get('python')}` / `{runtime.get('runner')}`",
    f"- Remote branches: `{', '.join(branches)}`",
    f"- Tests: **{summary.get('testsPassed')}** across **{summary.get('testFilesPassed')}** files",
    f'- Deterministic visuals: **{len(visuals)}**',
    '- Visual design system: `resindb-uiux-pro-max-v1`', '',
    '## Design direction', '',
    '- Swiss Modernism 2.0', '- Bento Grid', '- Accessible & Ethical', '- Dimensional Layering',
    '- Dashboard density 8/10 and motion 2/10', '',
    '## Gate status', '', '| Gate | Exit code |', '|---|---:|',
]
lines.extend(f'| `{name}` | `{code}` |' for name, code in sorted(statuses.items()))
if summary.get('coveragePercent'):
    cov = summary['coveragePercent']
    lines.extend(['', '## Coverage', '', '| Metric | Percent |', '|---|---:|'])
    for key, label in [('statements','Statements'),('branches','Branches'),('functions','Functions'),('lines','Lines')]:
        if key in cov:
            lines.append(f'| {label} | {cov[key]:.2f}% |')
lines.extend(['', '## Visual inventory', ''])
lines.extend(f'- `{name}`' for name in visuals)
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
(root / 'result.txt').write_text(result + '\n')
