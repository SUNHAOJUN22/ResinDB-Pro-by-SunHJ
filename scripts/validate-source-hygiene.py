#!/usr/bin/env python3
"""Reject unsafe production-source constructs without flagging negative test fixtures."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "src"
SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs"}
RULES = (
    ("TypeScript suppression", re.compile(r"@ts-(?:ignore|nocheck)")),
    ("ESLint suppression", re.compile(r"eslint-disable")),
    ("dynamic HTML injection", re.compile(r"dangerouslySetInnerHTML")),
    ("eval execution", re.compile(r"(?<![A-Za-z0-9_$])eval\s*\(")),
    ("Function constructor execution", re.compile(r"\bnew\s+Function\s*\(")),
    ("unfinished marker", re.compile(r"\b(?:TODO|FIXME|HACK)\b")),
)


def main() -> None:
    if not SOURCE_ROOT.is_dir():
        raise SystemExit(f"production source directory is missing: {SOURCE_ROOT}")

    findings: list[str] = []
    scanned_files = 0
    for path in sorted(SOURCE_ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in SOURCE_SUFFIXES:
            continue
        scanned_files += 1
        text = path.read_text(encoding="utf-8", errors="replace")
        for line_number, line in enumerate(text.splitlines(), start=1):
            for name, pattern in RULES:
                if pattern.search(line):
                    findings.append(
                        f"{path.relative_to(ROOT)}:{line_number}: {name}: {line.strip()}"
                    )

    if scanned_files == 0:
        raise SystemExit("production source hygiene scanned zero source files")
    if findings:
        raise SystemExit("production source hygiene failed:\n" + "\n".join(findings))

    print(
        f"validated production source hygiene across {scanned_files} files; "
        "negative security fixtures remain test-scoped"
    )


if __name__ == "__main__":
    main()
