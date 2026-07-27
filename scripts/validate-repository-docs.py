#!/usr/bin/env python3
"""Validate README links, visual assets, evidence, version claims and repository hygiene."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
PACKAGE = ROOT / "package.json"
VALIDATION = ROOT / "docs" / "VALIDATION.md"
VISUAL_DESIGN_SYSTEM = ROOT / "docs" / "README_VISUAL_DESIGN_SYSTEM.md"
ASSETS = ROOT / "docs" / "assets"
LATEST_REPORT = ROOT / "reports" / "final-visual-upgrade-20260726" / "REPORT.md"
LATEST_SUMMARY = ROOT / "reports" / "final-visual-upgrade-20260726" / "summary.json"
LATEST_ALIAS = ROOT / "reports" / "ci-validation-latest.json"

EXPECTED_VISUALS = (
    "resindb-ai-platform-overview.svg",
    "resindb-data-lifecycle.svg",
    "resindb-data-governance.svg",
    "resindb-scientific-engine.svg",
    "resindb-worker-architecture.svg",
    "resindb-formula-engine.svg",
    "resindb-knowledge-network.svg",
    "resindb-comparison-decision.svg",
    "resindb-ai-workflow.svg",
    "resindb-local-first-privacy.svg",
    "resindb-import-export.svg",
    "resindb-quality-gates.svg",
    "resindb-research-workflow.svg",
    "resindb-security-deployment.svg",
)

FORBIDDEN_PATHS = (
    ".github/.resindb-main-update",
    ".github/.resindb-v310-patch",
    ".github/final-reaudit-20260726.trigger",
    ".github/source-hygiene-finalization-20260726.trigger",
    ".github/workflows/apply-resindb-main-update.yml",
    ".github/workflows/apply-v310-patch.yml",
    ".github/workflows/diagnose-v310-patch.yml",
    ".github/workflows/finalize-resindb-main-update.yml",
    ".github/workflows/repository-audit-20260726.yml",
    ".github/workflows/finalize-repository-20260726.yml",
    ".github/workflows/finalize-repository-v2-20260726.yml",
    ".github/workflows/final-proof-20260726.yml",
    ".github/workflows/final-proof-docs-20260726.yml",
    ".github/workflows/reaudit-20260726.yml",
    ".github/workflows/final-reaudit-20260726.yml",
    ".github/workflows/source-hygiene-finalization-20260726.yml",
    ".github/workflows/ultimate-readme-audit-20260726.yml",
    ".github/ultimate-readme-audit-20260726.trigger",
    ".github/final-dependency-remediation-20260726.trigger",
    ".github/workflows/final-dependency-remediation-20260726.yml",
    ".github/dependency-audit-diagnostic-20260726.trigger",
    ".github/workflows/dependency-audit-diagnostic-20260726.yml",
    "scripts/finalize-dependency-candidate.py",
    "reports/dependency-audit-diagnostic-20260726.json",
    "reports/dependency-audit-diagnostic-20260726.md",
    ".github/final-eslint-remediation-20260726.trigger",
    ".github/workflows/final-eslint-remediation-20260726.yml",
    ".github/current-audit-diagnostic-20260726.trigger",
    ".github/workflows/current-audit-diagnostic-20260726.yml",
    "reports/current-audit-diagnostic-20260726.json",
    ".github/final-compatible-lint-stack-20260726.trigger",
    ".github/workflows/final-compatible-lint-stack-20260726.yml",
    ".github/npm-ci-peer-diagnostic-20260726.trigger",
    ".github/workflows/npm-ci-peer-diagnostic-20260726.yml",
    "reports/npm-ci-peer-diagnostic-20260726.txt",
    ".github/final-lockfile-rebuild-20260726.trigger",
    ".github/workflows/final-lockfile-rebuild-20260726.yml",
    ".github/lint-stack-install-diagnostic-20260726.trigger",
    ".github/workflows/lint-stack-install-diagnostic-20260726.yml",
    "scripts/finalize-lockfile-rebuild.sh",
    "reports/lint-stack-install-diagnostic-20260726.txt",
    ".github/final-current-tree-proof-20260726.trigger",
    ".github/workflows/final-current-tree-proof-20260726.yml",
    "scripts/final-current-tree-proof.sh",
    ".github/fresh-lockfile-rebuild-20260726.trigger",
    ".github/workflows/fresh-lockfile-rebuild-20260726.yml",
    ".github/lockfile-rebuild-diagnostic-20260726.trigger",
    ".github/workflows/lockfile-rebuild-diagnostic-20260726.yml",
    "reports/lockfile-rebuild-diagnostic-20260726.txt",
    "reports/fresh-lockfile-rebuild-failure-20260726.md",
    ".github/uiux-design-system-research-20260727.trigger",
    ".github/workflows/uiux-design-system-research-20260727.yml",
    ".github/uiux-readme-visual-redesign-20260727.trigger",
    ".github/workflows/uiux-readme-visual-redesign-20260727.yml",
    "scripts/apply-uiux-readme-visual-system.py",
    "docs/MIGRATION_v3.1.0.md",
    "docs/RELEASE_NOTES_v3.1.0.md",
    "reports/patch-diagnostic.json",
    "reports/release-baseline-v3.1.0.json",
    "reports/automated-audit-20260726",
    "reports/final-reaudit-20260726",
)

LOCAL_LINK_PATTERNS = (
    re.compile(r'<(?:img|a)\b[^>]*(?:src|href)="([^"]+)"', re.IGNORECASE),
    re.compile(r'!?\[[^\]]*]\(([^)]+)\)'),
)


def fail(message: str) -> None:
    raise SystemExit(message)


def strip_target(raw: str) -> str:
    target = raw.strip().split(maxsplit=1)[0].strip("<>")
    target = target.split("#", 1)[0].split("?", 1)[0]
    return target


def validate_local_links(readme_text: str) -> None:
    missing: list[str] = []
    seen: set[str] = set()
    for pattern in LOCAL_LINK_PATTERNS:
        for raw in pattern.findall(readme_text):
            target = strip_target(raw)
            if not target or target.startswith(("http://", "https://", "mailto:", "data:", "#")):
                continue
            if target in seen:
                continue
            seen.add(target)
            if not (ROOT / target).exists():
                missing.append(target)
    if missing:
        fail(f"README contains missing local targets: {sorted(missing)}")


def validate_visual_inventory(readme_text: str) -> None:
    expected = set(EXPECTED_VISUALS)
    actual = {path.name for path in ASSETS.glob("resindb-*.svg")}
    if actual != expected:
        fail(
            "README visual inventory mismatch: "
            f"missing={sorted(expected - actual)}, extra={sorted(actual - expected)}"
        )
    namespace = "{http://www.w3.org/2000/svg}"
    for filename in EXPECTED_VISUALS:
        relative = f"docs/assets/{filename}"
        if readme_text.count(relative) != 1:
            fail(f"{relative} must be referenced exactly once in README")
        root = ET.parse(ASSETS / filename).getroot()
        if root.attrib.get("role") != "img" or not root.attrib.get("aria-labelledby"):
            fail(f"{filename}: missing role=img or aria-labelledby")
        if not root.findall(f"{namespace}title") or not root.findall(f"{namespace}desc"):
            fail(f"{filename}: missing title or desc")
        if not root.findall(f"{namespace}metadata"):
            fail(f"{filename}: missing design-system metadata")
        if root.attrib.get("data-design-system") != "resindb-uiux-pro-max-v1":
            fail(f"{filename}: missing ResinDB UI/UX Pro Max design-system marker")
        if filename == "resindb-quality-gates.svg":
            svg_text = (ASSETS / filename).read_text(encoding="utf-8")
            for phrase in ("Source hygiene", "production code • no injection"):
                if phrase not in svg_text:
                    fail(f"{filename}: quality-gate semantics are missing {phrase!r}")


def validate_visual_design_system(readme_text: str) -> None:
    if not VISUAL_DESIGN_SYSTEM.is_file():
        fail("README visual design-system document is missing")
    if "docs/README_VISUAL_DESIGN_SYSTEM.md" not in readme_text:
        fail("README must link the visual design-system document")
    design_text = VISUAL_DESIGN_SYSTEM.read_text(encoding="utf-8")
    required = (
        "UI/UX Pro Max",
        "Swiss Modernism 2.0",
        "Bento Grid",
        "Accessible & Ethical",
        "8-point",
        "data-design-system=\"resindb-uiux-pro-max-v1\"",
    )
    missing = [value for value in required if value not in design_text]
    if missing:
        fail(f"README visual design system is incomplete: {missing}")


def validate_version_and_scripts(readme_text: str, validation_text: str) -> None:
    package = json.loads(PACKAGE.read_text(encoding="utf-8"))
    version = package.get("version")
    scripts = package.get("scripts", {})
    required_scripts = {
        "visuals:generate": "python3 scripts/generate-readme-visuals.py",
        "visuals:check": "python3 scripts/generate-readme-visuals.py --check",
        "validate:docs": "python3 scripts/validate-repository-docs.py",
        "validate:source": "python3 scripts/validate-source-hygiene.py",
        "audit:all": "npm audit --audit-level=high",
        "audit:prod": "npm audit --omit=dev --audit-level=high",
    }
    for name, command in required_scripts.items():
        if scripts.get(name) != command:
            fail(f"package.json script {name!r} must equal {command!r}")
    validate_script = scripts.get("validate", "")
    if "npm run validate:docs" not in validate_script:
        fail("package.json validate must include npm run validate:docs")
    if "npm run validate:source" not in validate_script:
        fail("package.json validate must include npm run validate:source")
    if "npm run audit:all" not in scripts.get("validate:ci", ""):
        fail("package.json validate:ci must include npm run audit:all")
    if f"version-{version}-" not in readme_text:
        fail(f"README version badge is not aligned with package version {version}")
    if f"`{version}`" not in validation_text:
        fail(f"docs/VALIDATION.md does not identify package version {version}")
    expected_dev_dependencies = {
        "eslint": "^10.8.0",
        "@typescript-eslint/eslint-plugin": "^8.65.0",
        "@typescript-eslint/parser": "^8.65.0",
        "typescript-eslint": "^8.65.0",
        "eslint-plugin-react-hooks": "^7.1.1",
        "eslint-plugin-react-refresh": "^0.5.3",
    }
    dev_dependencies = package.get("devDependencies", {})
    for name, expected in expected_dev_dependencies.items():
        if dev_dependencies.get(name) != expected:
            fail(f"development toolchain drift: {name} must equal {expected}")
    if "十四张" not in readme_text and "14 张" not in readme_text:
        fail("README must state that the visual system contains 14 diagrams")


def validate_status_block(name: str, proof: object) -> None:
    if not isinstance(proof, dict):
        fail(f"{name} evidence is missing or malformed")
    if proof.get("result") != "success":
        fail(f"{name} result is not success")
    if proof.get("remoteBranches") != ["main"]:
        fail(f"{name} does not prove main is the sole remote branch")
    statuses = proof.get("statuses")
    if not isinstance(statuses, dict) or not statuses:
        fail(f"{name} contains no validation statuses")
    if any(not isinstance(code, int) or code != 0 for code in statuses.values()):
        fail(f"{name} contains a non-zero validation status")


def validate_latest_evidence(readme_text: str, validation_text: str) -> None:
    expected_paths = (
        "reports/final-visual-upgrade-20260726/REPORT.md",
        "reports/final-visual-upgrade-20260726/summary.json",
        "reports/ci-validation-latest.json",
    )
    for relative in expected_paths:
        if not (ROOT / relative).is_file():
            fail(f"latest durable validation evidence is missing: {relative}")
    if expected_paths[0] not in readme_text or expected_paths[2] not in readme_text:
        fail("README must link the current report and machine-readable alias")
    for relative in expected_paths:
        if relative not in validation_text:
            fail(f"docs/VALIDATION.md must identify current evidence: {relative}")
    for stale_prefix in (
        "reports/final-validation-20260726/",
        "reports/final-reaudit-20260726/",
    ):
        if stale_prefix in readme_text or stale_prefix in validation_text:
            fail(f"README or validation contract still points at superseded evidence: {stale_prefix}")

    summary = json.loads(LATEST_SUMMARY.read_text(encoding="utf-8"))
    alias = json.loads(LATEST_ALIAS.read_text(encoding="utf-8"))
    if summary != alias:
        fail("latest evidence alias differs from the fixed durable summary")
    validate_status_block("baseline", summary)
    current_tree = summary.get("currentTreeVerification")
    if current_tree is not None:
        validate_status_block("currentTreeVerification", current_tree)
    if summary.get("visualCount") != len(EXPECTED_VISUALS):
        fail("latest durable validation evidence does not cover all visuals")
    if sorted(summary.get("generatedVisuals", [])) != sorted(EXPECTED_VISUALS):
        fail("latest durable validation evidence visual inventory is incomplete")


def validate_ci() -> None:
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    if "npm run validate:docs" not in ci:
        fail("permanent CI must execute npm run validate:docs")
    if "npm run validate:source" not in ci:
        fail("permanent CI must execute npm run validate:source")
    if "npm run audit:all" not in ci:
        fail("permanent CI must execute npm run audit:all")
    if "contents: write" in ci or "EMBEDDED DEPENDENCY REMEDIATION" in ci:
        fail("permanent CI must remain read-only and non-self-modifying")
    if "branches: [main]" not in ci:
        fail("permanent CI is not restricted to main")
    if "contents: read" not in ci:
        fail("permanent CI must retain read-only contents permission")


def validate_hygiene() -> None:
    present = [path for path in FORBIDDEN_PATHS if (ROOT / path).exists()]
    if present:
        fail(f"forbidden migration/diagnostic residue remains: {present}")


def main() -> None:
    readme_text = README.read_text(encoding="utf-8")
    validation_text = VALIDATION.read_text(encoding="utf-8")
    validate_local_links(readme_text)
    validate_visual_inventory(readme_text)
    validate_visual_design_system(readme_text)
    validate_version_and_scripts(readme_text, validation_text)
    validate_latest_evidence(readme_text, validation_text)
    validate_ci()
    validate_hygiene()
    subprocess.run(
        ["python3", "scripts/generate-readme-visuals.py", "--check"],
        cwd=ROOT,
        check=True,
    )
    print(
        f"validated README, {len(EXPECTED_VISUALS)} deterministic visuals, "
        "version/scripts, UI/UX Pro Max visual system, source hygiene contract, durable evidence, CI contract and repository hygiene"
    )


if __name__ == "__main__":
    main()
