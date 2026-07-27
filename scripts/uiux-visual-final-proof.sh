#!/usr/bin/env bash
set -uo pipefail
out=/tmp/resindb-uiux-visual-final-proof
logs="$out/logs"
rm -rf "$out"
mkdir -p "$logs"
overall=0
printf '%s\n' "${GITHUB_SHA:-unknown}" > "$out/validated-input-commit.txt"
{
  echo "node=$(node --version)"
  echo "npm=$(npm --version)"
  echo "python=$(python3 --version 2>&1)"
  echo "runner=${RUNNER_OS:-unknown}"
} > "$out/runtime.txt"
cp scripts/write-uiux-visual-evidence.py /tmp/write-uiux-visual-evidence.py
record() {
  local name="$1"
  shift
  set +e
  timeout 40m "$@" > "$logs/$name.txt" 2>&1
  local code=$?
  set -e
  printf '%s\n' "$code" > "$out/$name.status"
  cat "$logs/$name.txt"
  if [ "$code" -ne 0 ]; then overall=1; fi
}
record refine-layout python3 scripts/refine-uiux-visual-layout.py
rm -f .github/workflows/uiux-visual-final-proof-20260727.yml
rm -f .github/uiux-visual-final-proof-20260727.trigger
rm -f scripts/refine-uiux-visual-layout.py scripts/uiux-visual-final-proof.sh scripts/write-uiux-visual-evidence.py
record visuals-generate python3 scripts/generate-readme-visuals.py
record visuals-check python3 scripts/generate-readme-visuals.py --check
record npm-ci npm ci
if [ "$(cat "$out/npm-ci.status")" = "0" ]; then
  record validate-source npm run validate:source
  record lint npm run lint
  record typecheck npm run typecheck
  record test npm run test
  record test-unit npm run test:unit
  record test-science npm run test:science
  record test-coverage npm run test:coverage
  record build npm run build
  record smoke npm run smoke
  record test-ui npm run test:ui
  record audit-all npm run audit:all
  record audit-prod npm run audit:prod
fi
git ls-remote --heads origin | awk '{print $2}' | sed 's#refs/heads/##' | sort > "$out/remote-branches.txt"
if [ "$(cat "$out/remote-branches.txt")" = "main" ]; then
  printf '0\n' > "$out/only-main.status"
else
  printf '1\n' > "$out/only-main.status"
  overall=1
fi
set +e
git diff --check > "$logs/git-diff-check.txt" 2>&1
diff_code=$?
set -e
printf '%s\n' "$diff_code" > "$out/git-diff-check.status"
if [ "$diff_code" -ne 0 ]; then overall=1; fi
python3 /tmp/write-uiux-visual-evidence.py "$out"
record validate-docs npm run validate:docs
python3 /tmp/write-uiux-visual-evidence.py "$out"
if [ "$(cat "$out/result.txt")" != "success" ]; then
  exit 1
fi
