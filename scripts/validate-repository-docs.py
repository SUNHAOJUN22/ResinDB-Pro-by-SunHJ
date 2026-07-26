#!/usr/bin/env python3
"""Validate README links, visual assets, version claims and repository hygiene."""

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
ASSETS = ROOT / "docs" / "assets"

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
    "docs/MIGRATION_v3.1.0.md",
    "docs/RELEASE_NOTES_v3.1.0.md",
    "reports/patch-diagnostic.json",
    "reports/release-baseline-v3.1.0.json",
    "reports/automated-audit-20260726",
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


def validate_version_and_scripts(readme_text: str, validation_text: str) -> None:
    package = json.loads(PACKAGE.read_text(encoding="utf-8"))
    version = package.get("version")
    scripts = package.get("scripts", {})
    required_scripts = {
        "visuals:generate": "python3 scripts/generate-readme-visuals.py",
        "visuals:check": "python3 scripts/generate-readme-visuals.py --check",
        "validate:docs": "python3 scripts/validate-repository-docs.py",
    }
    for name, command in required_scripts.items():
        if scripts.get(name) != command:
            fail(f"package.json script {name!r} must equal {command!r}")
    if "npm run validate:docs" not in scripts.get("validate", ""):
        fail("package.json validate must include npm run validate:docs")
    if f"version-{version}-" not in readme_text:
        fail(f"README version badge is not aligned with package version {version}")
    if f"`{version}`" not in validation_text:
        fail(f"docs/VALIDATION.md does not identify package version {version}")
    if "十四张" not in readme_text and "14 张" not in readme_text:
        fail("README must state that the visual system contains 14 diagrams")


def validate_ci() -> None:
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    if "npm run validate:docs" not in ci:
        fail("permanent CI must execute npm run validate:docs")
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
    validate_version_and_scripts(readme_text, validation_text)
    validate_ci()
    validate_hygiene()
    subprocess.run(
        ["python3", "scripts/generate-readme-visuals.py", "--check"],
        cwd=ROOT,
        check=True,
    )
    print(
        f"validated README, {len(EXPECTED_VISUALS)} deterministic visuals, "
        "version/scripts, CI contract and repository hygiene"
    )


if __name__ == "__main__":
    main()
