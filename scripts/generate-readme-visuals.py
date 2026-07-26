#!/usr/bin/env python3
"""Generate accessible, deterministic SVG diagrams for the ResinDB Pro README."""

from __future__ import annotations

import argparse
import filecmp
import tempfile
from dataclasses import dataclass
from html import escape
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "docs" / "assets"
WIDTH = 1200
HEIGHT = 640
FONT = "Inter,Segoe UI,Arial,sans-serif"
COLORS = ("#38bdf8", "#34d399", "#a78bfa", "#fbbf24", "#fb7185", "#22d3ee")

DEFS = """
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#06111f"/>
    <stop offset=".56" stop-color="#0b1830"/>
    <stop offset="1" stop-color="#111b35"/>
  </linearGradient>
  <linearGradient id="cyan" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#22d3ee"/>
    <stop offset="1" stop-color="#2563eb"/>
  </linearGradient>
  <linearGradient id="emerald" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#34d399"/>
    <stop offset="1" stop-color="#059669"/>
  </linearGradient>
  <filter id="shadow" x="-25%" y="-25%" width="150%" height="170%">
    <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#020617" flood-opacity=".46"/>
  </filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="7" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
    <path d="M36 0H0V36" fill="none" stroke="#94a3b8" stroke-opacity=".055"/>
  </pattern>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
    <path d="M0 0L10 5L0 10Z" fill="#38bdf8"/>
  </marker>
  <marker id="arrow-muted" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
    <path d="M0 0L10 5L0 10Z" fill="#64748b"/>
  </marker>
</defs>
"""


@dataclass(frozen=True)
class Visual:
    filename: str
    title_id: str
    title: str
    subtitle: str
    description: str
    layout: str
    items: tuple[tuple[str, str], ...]
    footer: tuple[str, ...] = ()


def text(x: float, y: float, value: str, size: int = 20, color: str = "#e2e8f0",
         weight: int = 500, anchor: str = "start") -> str:
    return (
        f'<text x="{x}" y="{y}" fill="{color}" font-family="{FONT}" '
        f'font-size="{size}" font-weight="{weight}" text-anchor="{anchor}">'
        f'{escape(value)}</text>'
    )


def panel(x: float, y: float, width: float, height: float, title: str, subtitle: str,
          accent: str) -> str:
    return f"""
<g filter="url(#shadow)">
  <rect x="{x}" y="{y}" width="{width}" height="{height}" rx="24" fill="#0f213b" stroke="#334155"/>
  <rect x="{x}" y="{y}" width="7" height="{height}" rx="3.5" fill="{accent}"/>
  {text(x + 26, y + 42, title, 20, "#f8fafc", 760)}
  {text(x + 26, y + 70, subtitle, 13, "#94a3b8", 520)}
</g>
"""


def chip(x: float, y: float, label: str, accent: str, width: float) -> str:
    return f"""
<g>
  <rect x="{x}" y="{y}" width="{width}" height="34" rx="17" fill="{accent}" fill-opacity=".13"
        stroke="{accent}" stroke-opacity=".55"/>
  {text(x + width / 2, y + 23, label, 13, "#e2e8f0", 650, "middle")}
</g>
"""


def arrow(x1: float, y1: float, x2: float, y2: float, muted: bool = False,
          dashed: bool = False) -> str:
    color = "#64748b" if muted else "#38bdf8"
    marker = "arrow-muted" if muted else "arrow"
    dash = ' stroke-dasharray="8 8"' if dashed else ""
    return (
        f'<path d="M{x1} {y1}L{x2} {y2}" fill="none" stroke="{color}" '
        f'stroke-width="3" stroke-linecap="round" marker-end="url(#{marker})"{dash}/>'
    )


def header(visual: Visual) -> str:
    return (
        text(72, 70, visual.title, 36, "#f8fafc", 820)
        + text(72, 104, visual.subtitle, 16, "#94a3b8", 520)
        + '<path d="M72 126H1128" stroke="#334155"/>'
    )


def footer_chips(labels: tuple[str, ...], y: float = 548) -> str:
    if not labels:
        return ""
    total = 1000
    gap = 18
    width = (total - gap * (len(labels) - 1)) / len(labels)
    x = 100
    result = ""
    for index, label in enumerate(labels):
        result += chip(x, y, label, COLORS[index % len(COLORS)], width)
        x += width + gap
    return result


def render_flow(visual: Visual) -> str:
    count = len(visual.items)
    gap = 28
    width = (1030 - gap * (count - 1)) / count
    x0 = 85
    y = 220
    body = header(visual)
    for index, (title, subtitle) in enumerate(visual.items):
        x = x0 + index * (width + gap)
        color = COLORS[index % len(COLORS)]
        body += panel(x, y, width, 150, title, subtitle, color)
        body += f'<circle cx="{x + width / 2}" cy="{y + 112}" r="22" fill="{color}" fill-opacity=".18" stroke="{color}"/>'
        body += text(x + width / 2, y + 119, str(index + 1), 16, "#f8fafc", 800, "middle")
        if index < count - 1:
            body += arrow(x + width, y + 75, x + width + gap - 8, y + 75)
    body += footer_chips(visual.footer)
    return body


def render_grid(visual: Visual) -> str:
    columns = 3
    x0, y0 = 80, 174
    width, height = 320, 154
    xgap, ygap = 40, 42
    body = header(visual)
    for index, (title, subtitle) in enumerate(visual.items):
        row, col = divmod(index, columns)
        x = x0 + col * (width + xgap)
        y = y0 + row * (height + ygap)
        color = COLORS[index % len(COLORS)]
        body += panel(x, y, width, height, title, subtitle, color)
        body += (
            f'<path d="M{x + 32} {y + 112}C{x + 88} {y + 78},'
            f'{x + 144} {y + 142},{x + 200} {y + 103}S{x + 270} {y + 80},'
            f'{x + 288} {y + 116}" fill="none" stroke="{color}" stroke-width="3"/>'
        )
    body += footer_chips(visual.footer, 558)
    return body


def render_hub(visual: Visual) -> str:
    body = header(visual)
    center_x, center_y = 600, 334
    body += """
<g transform="translate(600 334)" filter="url(#glow)">
  <path d="M0-82L71-41V41L0 82L-71 41V-41Z" fill="#0b2b4f" stroke="#38bdf8" stroke-width="3"/>
  <path d="M0-44L38-22V22L0 44L-38 22V-22Z" fill="url(#cyan)" fill-opacity=".28" stroke="#67e8f9"/>
  <circle r="13" fill="#e0f2fe"/>
</g>
"""
    positions = ((230, 205), (600, 170), (970, 205), (230, 455), (600, 505), (970, 455))
    for index, ((title, subtitle), (x, y)) in enumerate(zip(visual.items, positions)):
        color = COLORS[index % len(COLORS)]
        body += arrow(center_x, center_y, x, y, muted=True, dashed=True)
        body += f'<circle cx="{x}" cy="{y}" r="52" fill="{color}" fill-opacity=".16" stroke="{color}" stroke-width="2"/>'
        body += f'<circle cx="{x}" cy="{y}" r="18" fill="{color}" fill-opacity=".9"/>'
        body += text(x, y + 80, title, 15, "#f8fafc", 700, "middle")
        body += text(x, y + 101, subtitle, 12, "#94a3b8", 520, "middle")
    return body


def render_split(visual: Visual) -> str:
    body = header(visual)
    left = visual.items[: len(visual.items) // 2]
    right = visual.items[len(visual.items) // 2 :]
    body += panel(80, 180, 430, 330, "Local / deterministic", "Browser-owned execution boundary", "#38bdf8")
    body += panel(690, 180, 430, 330, "Optional / governed", "Explicit service boundary", "#fbbf24")
    for index, (title, subtitle) in enumerate(left):
        body += chip(120, 270 + index * 64, f"{title} — {subtitle}", COLORS[index % len(COLORS)], 350)
    for index, (title, subtitle) in enumerate(right):
        body += chip(730, 270 + index * 64, f"{title} — {subtitle}", COLORS[(index + 3) % len(COLORS)], 350)
    body += """
<g transform="translate(600 350)">
  <path d="M0-65L58-42V2C58 47 27 77 0 91C-27 77-58 47-58 2V-42Z"
        fill="url(#emerald)" fill-opacity=".17" stroke="#34d399" stroke-width="2"/>
  <path d="M-22 6l16 16 31-40" fill="none" stroke="#a7f3d0" stroke-width="6"
        stroke-linecap="round" stroke-linejoin="round"/>
</g>
"""
    body += footer_chips(visual.footer, 558)
    return body


def render_layers(visual: Visual) -> str:
    body = header(visual)
    y = 172
    for index, (title, subtitle) in enumerate(visual.items):
        x = 120 + index * 38
        width = 960 - index * 76
        color = COLORS[index % len(COLORS)]
        body += f'<rect x="{x}" y="{y}" width="{width}" height="70" rx="22" fill="{color}" fill-opacity=".12" stroke="{color}" stroke-opacity=".7"/>'
        body += text(x + 28, y + 31, title, 18, "#f8fafc", 740)
        body += text(x + 28, y + 55, subtitle, 13, "#94a3b8", 520)
        y += 82
    body += footer_chips(visual.footer, 558)
    return body


RENDERERS = {
    "flow": render_flow,
    "grid": render_grid,
    "hub": render_hub,
    "split": render_split,
    "layers": render_layers,
}

VISUALS = (
    Visual(
        "resindb-ai-platform-overview.svg", "platform-title",
        "ResinDB Pro", "Local-first resin intelligence • scientific workers • auditable AI assistance",
        "Platform overview of resin data management, analytics, scientific computation, optional AI and evidence export.",
        "hub",
        (
            ("Data workspace", "CRUD + snapshots"),
            ("Visual analytics", "dashboard + pivot"),
            ("Scientific engine", "models + statistics"),
            ("AI copilot", "optional endpoint"),
            ("Evidence export", "portable reports"),
            ("Quality gates", "tests + audit"),
        ),
    ),
    Visual(
        "resindb-data-lifecycle.svg", "lifecycle-title",
        "Resin data lifecycle", "Validate at every boundary • preserve provenance • export without lock-in",
        "Lifecycle from file import through validation, normalization, persistence, analysis and portable export.",
        "flow",
        (
            ("Import", "CSV • JSON • TXT"),
            ("Validate", "shape • IDs • ranges"),
            ("Normalize", "taxonomy • units"),
            ("Persist", "IndexedDB • snapshots"),
            ("Analyze", "charts • workers"),
            ("Export", "CSV • JSON • XML • PDF"),
        ),
        ("Deterministic fallback", "No silent remote write fallback", "Source review required"),
    ),
    Visual(
        "resindb-data-governance.svg", "governance-title",
        "Data governance and provenance", "Catalog separation makes source, status and ownership reviewable",
        "Governance view for taxonomies, aliases, property groups, manufacturers, references and record universes.",
        "layers",
        (
            ("Record universes", "polymer database • laboratory • open-market records"),
            ("Reference catalogs", "manufacturers • sources • relationship network"),
            ("Semantic dictionaries", "taxonomy • aliases • property groups"),
            ("Validation envelope", "schemaVersion • sourceType • recordStatus • updatedAt"),
        ),
        ("Demo ≠ measured", "Stable IDs", "Cycle + duplicate checks"),
    ),
    Visual(
        "resindb-scientific-engine.svg", "science-title",
        "Scientific computation engine", "Dedicated modules cover rheology, kinetics, reliability and uncertainty",
        "Scientific engine capabilities grouped by physical model and statistical purpose.",
        "grid",
        (
            ("Rheology & relaxation", "Carreau • WLF • Prony"),
            ("Kinetics & reliability", "Arrhenius • Kissinger • Avrami • Weibull"),
            ("Uncertainty", "Monte Carlo • Sobol • Copula • KDE"),
            ("Similarity", "Mahalanobis • Spearman • K-Means • PCA"),
            ("Optimization", "Pareto • MOO • RSM • SPC"),
            ("Safeguards", "finite outputs • isolated errors • reproducible inputs"),
        ),
    ),
    Visual(
        "resindb-worker-architecture.svg", "worker-title",
        "Web Worker execution architecture", "Heavy numerical work stays off the interactive React thread",
        "Architecture of UI hooks, worker messages, numerical workers, finite-result checks and chart rendering.",
        "flow",
        (
            ("React view", "user intent"),
            ("Worker hook", "typed request"),
            ("Worker manager", "lifecycle + timeout"),
            ("Scientific worker", "numerical compute"),
            ("Result guard", "finite + shaped"),
            ("Chart / report", "rendered evidence"),
        ),
        ("Failure isolation", "Responsive UI", "Explicit cancellation"),
    ),
    Visual(
        "resindb-formula-engine.svg", "formula-title",
        "Whitelist formula engine", "Parse approved syntax; never execute arbitrary JavaScript",
        "Formula engine stages from tokenization through parsing, variable binding, evaluation and isolated error reporting.",
        "flow",
        (
            ("Tokenize", "numbers • names • operators"),
            ("Parse", "precedence • grouping"),
            ("Bind", "approved variables"),
            ("Evaluate", "arithmetic • comparison"),
            ("Short-circuit", "&& • ||"),
            ("Isolate", "one bad formula only"),
        ),
        ("No eval", "No new Function", "Finite-result checks"),
    ),
    Visual(
        "resindb-knowledge-network.svg", "network-title",
        "Resin knowledge network", "Explore relationships without confusing adjacency with causality",
        "Network connecting resin grades with polymer families, manufacturers, processes, references and comparable grades.",
        "hub",
        (
            ("Polymer family", "taxonomy"),
            ("Property group", "semantic fields"),
            ("Manufacturer", "catalog entry"),
            ("Process route", "context"),
            ("Comparable grade", "similarity"),
            ("Reference", "evidence source"),
        ),
    ),
    Visual(
        "resindb-comparison-decision.svg", "comparison-title",
        "Grade comparison and decision support", "Combine normalized properties, uncertainty and reviewable rankings",
        "Decision-support flow from comparable candidates to normalized metrics, visualization, ranking and human review.",
        "flow",
        (
            ("Candidates", "filtered grades"),
            ("Normalize", "units + scales"),
            ("Visualize", "radar • scatter • parallel"),
            ("Score", "similarity • TOPSIS"),
            ("Trade-offs", "Pareto frontier"),
            ("Review", "human decision"),
        ),
        ("Ranking ≠ certification", "Show missing data", "Keep raw values"),
    ),
    Visual(
        "resindb-ai-workflow.svg", "ai-title",
        "AI-assisted analysis loop", "AI proposes; deterministic tools calculate; researchers approve",
        "Five-stage AI-assisted workflow from question and evidence selection to computation, explanation and human sign-off.",
        "flow",
        (
            ("Question", "research intent"),
            ("Evidence", "selected records"),
            ("Compute", "workers + formulas"),
            ("Explain", "AI synthesis"),
            ("Challenge", "limits + alternatives"),
            ("Approve", "human sign-off"),
        ),
        ("Optional endpoint", "No hidden execution", "Source-aware output"),
    ),
    Visual(
        "resindb-local-first-privacy.svg", "privacy-title",
        "Local-first privacy architecture", "Browser storage by default; remote services are explicit and bounded",
        "Privacy boundary between browser-resident data and optional governed AI and remote REST gateways.",
        "split",
        (
            ("IndexedDB", "records"),
            ("Preferences", "theme + language"),
            ("Feedback queue", "local export"),
            ("AI gateway", "optional"),
            ("Remote REST", "explicit adapter"),
            ("Server controls", "auth + rate limits"),
        ),
        ("VITE_* is public", "No privileged client secret", "Export backups"),
    ),
    Visual(
        "resindb-import-export.svg", "exchange-title",
        "Import, export and report pipeline", "Portable formats reduce lock-in and preserve review packages",
        "Data exchange pipeline for parsed imports, validation, editable records, charts, QA reports and portable exports.",
        "flow",
        (
            ("Parse", "CSV • JSON • TXT"),
            ("Map", "columns • fields"),
            ("Validate", "shape • values"),
            ("Edit", "grid • batch actions"),
            ("Report", "charts • QA PDF"),
            ("Export", "CSV • JSON • XML • PDF"),
        ),
        ("No fake upload success", "Explicit parse errors", "User-controlled files"),
    ),
    Visual(
        "resindb-quality-gates.svg", "quality-title",
        "Quality and validation gates", "A release is accepted only after every deterministic gate is green",
        "Permanent gates for documentation, production-source hygiene, static analysis, regression, runtime smoke and full dependency audit.",
        "grid",
        (
            ("Documentation", "links • SVGs • evidence"),
            ("Source hygiene", "production code • no injection"),
            ("Static", "ESLint • TypeScript"),
            ("Regression", "unit • science • workers"),
            ("Runtime", "Vite • HTTP • Chromium"),
            ("Security", "all dependencies • high gate"),
        ),
        ("Sole main branch", "No migration residue", "Artifacts retained temporarily"),
    ),
    Visual(
        "resindb-research-workflow.svg", "research-title",
        "From material question to evidence package", "A repeatable workflow for exploratory polymer research",
        "Research workflow from question definition and data curation through computation, comparison, reporting and review.",
        "flow",
        (
            ("Define", "question + criteria"),
            ("Curate", "select + validate"),
            ("Analyze", "models + uncertainty"),
            ("Compare", "charts + rankings"),
            ("Report", "portable package"),
            ("Review", "professional sign-off"),
        ),
        ("Traceable inputs", "Reproducible settings", "Human approval"),
    ),
    Visual(
        "resindb-security-deployment.svg", "deployment-title",
        "Security and deployment boundary", "The browser demo is not an authentication or quality-release system",
        "Layered deployment boundary for browser UI, server gateway, identity controls, remote data and operational audit.",
        "layers",
        (
            ("Browser application", "demo roles • CSP • no privileged secrets"),
            ("Server gateway", "authentication • authorization • validation • rate limiting"),
            ("Data services", "remote database • backup • retention • audit"),
            ("Operational governance", "HTTPS • monitoring • incident response • professional review"),
        ),
        ("Demo roles ≠ auth", "AI output ≠ release", "Operator owns compliance"),
    ),
)


def svg_document(visual: Visual) -> str:
    renderer = RENDERERS[visual.layout]
    body = renderer(visual)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}"
 viewBox="0 0 {WIDTH} {HEIGHT}" role="img"
 aria-labelledby="{visual.title_id} {visual.title_id}-desc">
<title id="{visual.title_id}">{escape(visual.title)}</title>
<desc id="{visual.title_id}-desc">{escape(visual.description)}</desc>
{DEFS}
<rect width="{WIDTH}" height="{HEIGHT}" rx="28" fill="url(#bg)"/>
<rect width="{WIDTH}" height="{HEIGHT}" rx="28" fill="url(#grid)"/>
<circle cx="1040" cy="80" r="190" fill="#2563eb" fill-opacity=".07"/>
<circle cx="110" cy="{HEIGHT - 20}" r="210" fill="#10b981" fill-opacity=".05"/>
{body}
</svg>
"""


def validate_svg(content: str, filename: str) -> None:
    root = ET.fromstring(content)
    namespace = "{http://www.w3.org/2000/svg}"
    if root.tag != f"{namespace}svg":
        raise ValueError(f"{filename}: root is not SVG")
    if root.attrib.get("role") != "img" or not root.attrib.get("aria-labelledby"):
        raise ValueError(f"{filename}: missing accessible role/aria-labelledby")
    if not root.findall(f"{namespace}title") or not root.findall(f"{namespace}desc"):
        raise ValueError(f"{filename}: missing title or desc")


def generate(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    expected = {visual.filename for visual in VISUALS}
    for stale in output.glob("resindb-*.svg"):
        if stale.name not in expected:
            stale.unlink()
    for visual in VISUALS:
        content = svg_document(visual)
        validate_svg(content, visual.filename)
        (output / visual.filename).write_text(content, encoding="utf-8")
        print(f"generated {visual.filename}")


def check() -> None:
    with tempfile.TemporaryDirectory(prefix="resindb-visuals-") as temp:
        generated = Path(temp)
        generate(generated)
        expected = {visual.filename for visual in VISUALS}
        actual = {path.name for path in DEFAULT_OUTPUT.glob("resindb-*.svg")}
        if actual != expected:
            missing = sorted(expected - actual)
            extra = sorted(actual - expected)
            raise SystemExit(f"visual inventory mismatch; missing={missing}, extra={extra}")
        changed = [
            name for name in sorted(expected)
            if not filecmp.cmp(generated / name, DEFAULT_OUTPUT / name, shallow=False)
        ]
        if changed:
            raise SystemExit(f"visuals are not deterministic/current: {changed}")
    print(f"validated {len(VISUALS)} deterministic README visuals")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="regenerate in a temporary directory and compare")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if args.check:
        check()
    else:
        generate(args.output)


if __name__ == "__main__":
    main()
