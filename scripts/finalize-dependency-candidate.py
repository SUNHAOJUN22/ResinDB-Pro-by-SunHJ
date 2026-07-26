#!/usr/bin/env python3
"""Prepare ResinDB Pro's final dependency-remediation candidate."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} anchor is missing")
    return text.replace(old, new, 1)


def patch_readme() -> None:
    path = ROOT / "README.md"
    text = path.read_text(encoding="utf-8")
    text = text.replace("生产依赖审计组成的质量门", "完整依赖审计组成的质量门")
    text = text.replace("\nnpm run audit:prod\n", "\nnpm run audit:all\n")
    source_note = (
        "`validate:source` 只扫描 `src/` 下的生产 TypeScript/JavaScript，拒绝 TypeScript/ESLint 抑制、"
        "任意代码执行、危险 HTML 注入和未完成标记。用于证明公式引擎拒绝恶意表达式的负向安全样本"
        "保留在 `tests/`，不会再被错误当成生产风险。"
    )
    audit_note = (
        "\n\n`audit:all` 审计生产依赖与开发工具链中的 high/critical 漏洞；"
        "`audit:prod` 可单独核验生产依赖。本次通过非强制 lockfile 修复关闭 "
        "`brace-expansion` 开发依赖链漏洞，`package.json` 的应用依赖声明保持不变。"
    )
    if audit_note.strip() not in text:
        text = replace_once(text, source_note, source_note + audit_note, "README source-hygiene paragraph")
    path.write_text(text, encoding="utf-8")


def patch_validation_contract() -> None:
    path = ROOT / "docs" / "VALIDATION.md"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "production build, HTTP smoke, Chromium UI smoke and dependency audit.",
        "production build, HTTP smoke, Chromium UI smoke and full production/development dependency audit.",
    )
    text = text.replace(
        "13. `npm run audit:prod` finds no high-severity production dependency vulnerability.",
        "13. `npm run audit:all` finds no high- or critical-severity vulnerability across production and development dependencies; `npm run audit:prod` separately confirms the production subset.",
    )
    text = text.replace(
        "Chromium UI smoke and the production dependency audit as separate attributable stages.",
        "Chromium UI smoke and the full dependency audit as separate attributable stages.",
    )
    text = text.replace(
        "Dependency installation and production audit include bounded retries for transient registry failures;",
        "Dependency installation and full dependency audit include bounded retries for transient registry failures;",
    )
    section = """## Dependency audit contract

`npm run audit:all` is the release gate and covers production plus development dependencies at `high` severity or above. `npm run audit:prod` remains available as an explicit production-only subset check. Lockfile remediation must not silently alter `package.json`; any required direct-dependency upgrade must be reviewed as a separate source change.

"""
    if "## Dependency audit contract" not in text:
        text = replace_once(text, "## Current verified baseline\n", section + "## Current verified baseline\n", "validation baseline")
    path.write_text(text, encoding="utf-8")


def patch_visual_generator() -> None:
    path = ROOT / "scripts" / "generate-readme-visuals.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        '("Security", "production dependency audit")',
        '("Security", "all dependencies • high gate")',
    )
    text = text.replace(
        "runtime smoke and dependency audit.",
        "runtime smoke and full dependency audit.",
    )
    path.write_text(text, encoding="utf-8")


def patch_repository_validator() -> None:
    path = ROOT / "scripts" / "validate-repository-docs.py"
    text = path.read_text(encoding="utf-8")
    forbidden_anchor = '    "docs/MIGRATION_v3.1.0.md",\n'
    forbidden_entries = (
        '    ".github/final-dependency-remediation-20260726.trigger",\n'
        '    ".github/workflows/final-dependency-remediation-20260726.yml",\n'
        '    ".github/dependency-audit-diagnostic-20260726.trigger",\n'
        '    ".github/workflows/dependency-audit-diagnostic-20260726.yml",\n'
        '    "scripts/finalize-dependency-candidate.py",\n'
        '    "reports/dependency-audit-diagnostic-20260726.json",\n'
        '    "reports/dependency-audit-diagnostic-20260726.md",\n'
    )
    if '"reports/dependency-audit-diagnostic-20260726.json"' not in text:
        text = replace_once(text, forbidden_anchor, forbidden_entries + forbidden_anchor, "validator forbidden paths")

    scripts_anchor = '        "validate:source": "python3 scripts/validate-source-hygiene.py",\n'
    scripts_insert = (
        scripts_anchor
        + '        "audit:all": "npm audit --audit-level=high",\n'
        + '        "audit:prod": "npm audit --omit=dev --audit-level=high",\n'
    )
    if '"audit:all": "npm audit --audit-level=high"' not in text:
        text = replace_once(text, scripts_anchor, scripts_insert, "validator required scripts")

    validate_anchor = (
        '    if "npm run validate:source" not in validate_script:\n'
        '        fail("package.json validate must include npm run validate:source")\n'
    )
    validate_insert = (
        validate_anchor
        + '    if "npm run audit:all" not in scripts.get("validate:ci", ""):\n'
        + '        fail("package.json validate:ci must include npm run audit:all")\n'
    )
    if "package.json validate:ci must include npm run audit:all" not in text:
        text = replace_once(text, validate_anchor, validate_insert, "validator validate chain")

    ci_anchor = (
        '    if "npm run validate:source" not in ci:\n'
        '        fail("permanent CI must execute npm run validate:source")\n'
    )
    ci_insert = (
        ci_anchor
        + '    if "npm run audit:all" not in ci:\n'
        + '        fail("permanent CI must execute npm run audit:all")\n'
        + '    if "contents: write" in ci or "EMBEDDED DEPENDENCY REMEDIATION" in ci:\n'
        + '        fail("permanent CI must remain read-only and non-self-modifying")\n'
    )
    if "permanent CI must execute npm run audit:all" not in text:
        text = replace_once(text, ci_anchor, ci_insert, "validator CI contract")

    path.write_text(text, encoding="utf-8")


def main() -> None:
    patch_readme()
    patch_validation_contract()
    patch_visual_generator()
    patch_repository_validator()
    print("prepared dependency-remediation candidate")


if __name__ == "__main__":
    main()
