#!/usr/bin/env python3
"""Generate accessible, repository-owned SVG diagrams for the ResinDB Pro README."""

from __future__ import annotations

from html import escape
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets"

W = 1200
FONT = "Inter,Segoe UI,Arial,sans-serif"

DEFS = """
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#06111f"/>
    <stop offset="0.55" stop-color="#0b1830"/>
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
  <linearGradient id="violet" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#c084fc"/>
    <stop offset="1" stop-color="#7c3aed"/>
  </linearGradient>
  <linearGradient id="amber" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fbbf24"/>
    <stop offset="1" stop-color="#f97316"/>
  </linearGradient>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="7" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
    <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#020617" flood-opacity=".45"/>
  </filter>
  <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
    <path d="M36 0H0V36" fill="none" stroke="#94a3b8" stroke-opacity=".055" stroke-width="1"/>
  </pattern>
  <marker id="arrow-cyan" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
    <path d="M0 0L10 5L0 10Z" fill="#38bdf8"/>
  </marker>
  <marker id="arrow-muted" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
    <path d="M0 0L10 5L0 10Z" fill="#64748b"/>
  </marker>
</defs>
"""


def t(x: float, y: float, text: str, size: int = 22, fill: str = "#e2e8f0",
      weight: int = 500, anchor: str = "start", opacity: float = 1.0) -> str:
    return (
        f'<text x="{x}" y="{y}" fill="{fill}" fill-opacity="{opacity}" '
        f'font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
        f'text-anchor="{anchor}">{escape(text)}</text>'
    )


def panel(x: float, y: float, w: float, h: float, title: str, subtitle: str = "",
          accent: str = "#38bdf8") -> str:
    return f"""
<g filter="url(#shadow)">
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="24" fill="#0f213b" stroke="#334155"/>
  <rect x="{x}" y="{y}" width="7" height="{h}" rx="3.5" fill="{accent}"/>
  {t(x + 28, y + 42, title, 21, "#f8fafc", 750)}
  {t(x + 28, y + 70, subtitle, 14, "#94a3b8", 500)}
</g>
"""


def chip(x: float, y: float, text: str, accent: str = "#38bdf8", width: float | None = None) -> str:
    width = width or max(92, len(text) * 8.3 + 34)
    return f"""
<g>
  <rect x="{x}" y="{y}" width="{width}" height="34" rx="17" fill="{accent}" fill-opacity=".13" stroke="{accent}" stroke-opacity=".55"/>
  {t(x + width / 2, y + 23, text, 13, "#e2e8f0", 650, "middle")}
</g>
"""


def arrow(x1: float, y1: float, x2: float, y2: float, muted: bool = False, dashed: bool = False) -> str:
    color = "#64748b" if muted else "#38bdf8"
    marker = "arrow-muted" if muted else "arrow-cyan"
    dash = ' stroke-dasharray="8 8"' if dashed else ""
    return (
        f'<path d="M{x1} {y1}L{x2} {y2}" fill="none" stroke="{color}" stroke-width="3" '
        f'stroke-linecap="round" marker-end="url(#{marker})"{dash}/>'
    )


def node(x: float, y: float, r: float, label: str, color: str, size: int = 15) -> str:
    return f"""
<g filter="url(#glow)">
  <circle cx="{x}" cy="{y}" r="{r}" fill="{color}" fill-opacity=".18" stroke="{color}" stroke-width="2"/>
  <circle cx="{x}" cy="{y}" r="{r * .38}" fill="{color}" fill-opacity=".9"/>
</g>
{t(x, y + r + 26, label, size, "#e2e8f0", 650, "middle")}
"""


def header(title: str, subtitle: str) -> str:
    return (
        t(72, 70, title, 36, "#f8fafc", 800)
        + t(72, 104, subtitle, 16, "#94a3b8", 500)
        + '<path d="M72 126H1128" stroke="#334155" stroke-width="1"/>'
    )


def document(title_id: str, title: str, desc: str, body: str, height: int = 640) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{height}" viewBox="0 0 {W} {height}" role="img" aria-labelledby="{title_id} {title_id}-desc">
<title id="{title_id}">{escape(title)}</title>
<desc id="{title_id}-desc">{escape(desc)}</desc>
{DEFS}
<rect width="{W}" height="{height}" rx="28" fill="url(#bg)"/>
<rect width="{W}" height="{height}" rx="28" fill="url(#grid)"/>
<circle cx="1040" cy="80" r="190" fill="#2563eb" fill-opacity=".07"/>
<circle cx="110" cy="{height - 20}" r="210" fill="#10b981" fill-opacity=".05"/>
{body}
</svg>
"""


def hero() -> str:
    body = header("ResinDB Pro", "Local-first resin intelligence • scientific workers • auditable AI assistance")
    body += """
<g transform="translate(600 334)" filter="url(#glow)">
  <path d="M0-112L97-56V56L0 112L-97 56V-56Z" fill="#0b2b4f" stroke="#38bdf8" stroke-width="3"/>
  <path d="M0-66L57-33V33L0 66L-57 33V-33Z" fill="url(#cyan)" fill-opacity=".26" stroke="#67e8f9" stroke-width="2"/>
  <circle r="18" fill="#e0f2fe"/>
  <circle cx="-38" cy="-23" r="9" fill="#34d399"/>
  <circle cx="42" cy="-20" r="9" fill="#c084fc"/>
  <circle cx="0" cy="47" r="9" fill="#fbbf24"/>
  <path d="M-30-18L-8-5M34-16L9-4M0 37V17" stroke="#e0f2fe" stroke-width="4" stroke-linecap="round"/>
</g>
"""
    items = [
        (86, 182, "Data workspace", "CRUD • import • snapshots", "#38bdf8"),
        (86, 398, "Visual analytics", "dashboard • pivot • network", "#a78bfa"),
        (862, 182, "Scientific engine", "rheology • kinetics • statistics", "#34d399"),
        (862, 398, "AI copilot", "optional endpoint • human review", "#fbbf24"),
    ]
    for x, y, a, b, c in items:
        body += panel(x, y, 252, 126, a, b, c)
    body += arrow(338, 245, 482, 298) + arrow(338, 462, 482, 374)
    body += arrow(718, 298, 862, 245) + arrow(718, 374, 862, 462)
    body += chip(431, 517, "IndexedDB", "#38bdf8", 122)
    body += chip(568, 517, "Web Workers", "#34d399", 138)
    body += chip(721, 517, "Bilingual UI", "#a78bfa", 136)
    return document(
        "hero-title",
        "ResinDB Pro platform overview",
        "An overview of the local-first resin data platform, scientific analysis engine, visual analytics and optional AI copilot.",
        body,
    )


def ai_loop() -> str:
    body = header("AI-assisted analysis loop", "AI proposes; deterministic tools calculate; researchers approve")
    steps = [
        (92, "Question", "Research intent"),
        (285, "Evidence", "Selected records"),
        (478, "Compute", "Workers + formulas"),
        (671, "Explain", "AI synthesis"),
        (864, "Review", "Human decision"),
    ]
    for i, (x, title, subtitle) in enumerate(steps):
        color = ["#38bdf8", "#34d399", "#a78bfa", "#fbbf24", "#fb7185"][i]
        body += panel(x, 218, 156, 142, title, subtitle, color)
        body += f'<circle cx="{x + 78}" cy="398" r="21" fill="{color}" fill-opacity=".16" stroke="{color}"/>'
        body += t(x + 78, 405, str(i + 1), 15, "#f8fafc", 800, "middle")
        if i < len(steps) - 1:
            body += arrow(x + 156, 289, steps[i + 1][0] - 14, 289)
    body += """
<path d="M942 440C942 535 257 535 257 425" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="10 9" marker-end="url(#arrow-muted)"/>
"""
    body += chip(132, 476, "No hidden execution", "#38bdf8", 184)
    body += chip(354, 476, "Finite-result checks", "#34d399", 178)
    body += chip(570, 476, "Source-aware output", "#a78bfa", 184)
    body += chip(792, 476, "Human sign-off", "#fbbf24", 168)
    return document(
        "ai-loop-title",
        "AI-assisted polymer research workflow",
        "A five-step workflow from research question to evidence selection, deterministic computation, AI explanation and human review.",
        body,
    )


def data_lifecycle() -> str:
    body = header("Resin data lifecycle", "Normalize once • validate at every boundary • export without lock-in")
    stages = [
        (86, "Import", "CSV • JSON • TXT", "#38bdf8"),
        (314, "Validate", "shape • IDs • ranges", "#34d399"),
        (542, "Normalize", "taxonomy • units", "#a78bfa"),
        (770, "Persist", "IndexedDB • snapshots", "#fbbf24"),
        (998, "Export", "CSV • JSON • XML • PDF", "#fb7185"),
    ]
    for i, (x, title, sub, color) in enumerate(stages):
        body += node(x, 278, 52, title, color, 16)
        body += t(x, 372, sub, 13, "#94a3b8", 500, "middle")
        if i < len(stages) - 1:
            body += arrow(x + 58, 278, stages[i + 1][0] - 64, 278)
    body += panel(214, 438, 772, 112, "Versioned source catalogs", "taxonomy • aliases • property groups • manufacturers • references • network • record universes", "#38bdf8")
    for x, label, c in [
        (250, "schemaVersion", "#38bdf8"),
        (420, "sourceType", "#34d399"),
        (570, "recordStatus", "#a78bfa"),
        (730, "updatedAt", "#fbbf24"),
        (860, "data", "#fb7185"),
    ]:
        body += chip(x, 500, label, c)
    return document(
        "data-lifecycle-title",
        "ResinDB Pro data lifecycle",
        "The lifecycle of resin data from import through validation, normalization, local persistence and portable export.",
        body,
    )


def scientific_engine() -> str:
    body = header("Scientific computation engine", "Dedicated workers isolate heavy calculations from the interface")
    groups = [
        (80, 176, 320, 156, "Rheology & relaxation", "Carreau • WLF • Prony", "#38bdf8"),
        (440, 176, 320, 156, "Kinetics & reliability", "Arrhenius • Kissinger • Avrami • Weibull", "#34d399"),
        (800, 176, 320, 156, "Statistics & uncertainty", "Monte Carlo • Sobol • Copula • KDE", "#a78bfa"),
        (80, 380, 320, 156, "Similarity & structure", "Mahalanobis • Spearman • K-Means", "#fbbf24"),
        (440, 380, 320, 156, "Optimization & quality", "Pareto • MOO • RSM • SPC", "#fb7185"),
        (800, 380, 320, 156, "Execution safeguards", "finite outputs • isolated errors • reproducible inputs", "#38bdf8"),
    ]
    for x, y, w, h, title, sub, color in groups:
        body += panel(x, y, w, h, title, sub, color)
        body += f'<path d="M{x + 34} {y + 112}C{x + 90} {y + 78},{x + 142} {y + 145},{x + 198} {y + 103}S{x + 270} {y + 78},{x + 286} {y + 118}" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round"/>'
    return document(
        "science-title",
        "ResinDB Pro scientific computation engine",
        "Six groups of scientific capabilities covering rheology, kinetics, reliability, uncertainty, similarity, optimization and execution safeguards.",
        body,
    )


def knowledge_network() -> str:
    body = header("Resin knowledge network", "Explore relationships between families, grades, properties, processes and evidence")
    center = (600, 330)
    body += node(*center, 74, "Resin grade", "#38bdf8", 18)
    satellites = [
        (280, 206, 48, "Polymer family", "#34d399"),
        (920, 206, 48, "Manufacturer", "#fbbf24"),
        (250, 454, 48, "Process route", "#a78bfa"),
        (950, 454, 48, "Reference", "#fb7185"),
        (600, 164, 44, "Property group", "#38bdf8"),
        (600, 520, 44, "Comparable grade", "#34d399"),
    ]
    for x, y, r, label, color in satellites:
        body += arrow(center[0], center[1], x, y, muted=True)
        body += node(x, y, r, label, color, 14)
    for x1, y1, x2, y2 in [
        (280, 206, 600, 164), (600, 164, 920, 206),
        (250, 454, 600, 520), (600, 520, 950, 454),
        (280, 206, 250, 454), (920, 206, 950, 454),
    ]:
        body += f'<path d="M{x1} {y1}Q600 330 {x2} {y2}" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="7 8"/>'
    return document(
        "network-title",
        "ResinDB Pro knowledge network",
        "A network view connecting resin grades to polymer families, manufacturers, processes, references, properties and comparable grades.",
        body,
    )


def quality_gates() -> str:
    body = header("Quality and validation gates", "A release is accepted only after every deterministic gate is green")
    gates = [
        ("Install", "npm ci", "#38bdf8"),
        ("Static", "lint + typecheck", "#34d399"),
        ("Science", "79 regression tests", "#a78bfa"),
        ("Build", "Vite + HTTP smoke", "#fbbf24"),
        ("Browser", "Chromium UI smoke", "#fb7185"),
        ("Security", "production audit", "#38bdf8"),
    ]
    x0, y0 = 92, 185
    for i, (title, sub, color) in enumerate(gates):
        x = x0 + (i % 3) * 354
        y = y0 + (i // 3) * 176
        body += panel(x, y, 310, 128, title, sub, color)
        body += f'<circle cx="{x + 272}" cy="{y + 36}" r="16" fill="{color}" fill-opacity=".18" stroke="{color}"/>'
        body += f'<path d="M{x + 264} {y + 36}l6 6 11-14" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    body += """
<g transform="translate(600 552)">
  <path d="M0-46L42-30V2C42 33 20 54 0 64C-20 54-42 33-42 2V-30Z" fill="url(#emerald)" fill-opacity=".2" stroke="#34d399" stroke-width="2"/>
  <path d="M-17 5l12 12 24-30" fill="none" stroke="#a7f3d0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</g>
"""
    return document(
        "quality-title",
        "ResinDB Pro quality gates",
        "The validation gates for installation, static checks, science tests, production build, browser smoke and dependency security.",
        body,
        660,
    )


def privacy() -> str:
    body = header("Local-first privacy architecture", "Browser storage by default; remote services are explicit, optional and bounded")
    body += panel(92, 188, 300, 316, "Browser workspace", "Default execution boundary", "#38bdf8")
    body += chip(126, 286, "IndexedDB records", "#38bdf8", 222)
    body += chip(126, 342, "Preferences + history", "#34d399", 222)
    body += chip(126, 398, "Feedback queue", "#a78bfa", 222)
    body += panel(808, 188, 300, 316, "Optional gateways", "Configured by the operator", "#fbbf24")
    body += chip(842, 286, "OpenAI-compatible API", "#fbbf24", 232)
    body += chip(842, 342, "Remote REST adapter", "#fb7185", 232)
    body += chip(842, 398, "Server-side controls", "#38bdf8", 232)
    body += """
<g transform="translate(600 332)" filter="url(#shadow)">
  <rect x="-112" y="-92" width="224" height="184" rx="30" fill="#0f213b" stroke="#475569"/>
  <path d="M-42-16V-38C-42-91 42-91 42-38V-16" fill="none" stroke="#34d399" stroke-width="9" stroke-linecap="round"/>
  <rect x="-64" y="-22" width="128" height="94" rx="20" fill="url(#emerald)" fill-opacity=".18" stroke="#34d399" stroke-width="2"/>
  <circle cy="18" r="12" fill="#a7f3d0"/>
  <path d="M0 30V48" stroke="#a7f3d0" stroke-width="6" stroke-linecap="round"/>
</g>
"""
    body += arrow(392, 346, 477, 346, muted=True, dashed=True)
    body += arrow(723, 346, 808, 346, muted=True, dashed=True)
    body += t(600, 486, "VITE_* values are public build-time configuration — never store production secrets in the client.", 15, "#fbbf24", 650, "middle")
    return document(
        "privacy-title",
        "ResinDB Pro local-first privacy architecture",
        "A browser workspace stores records locally while optional AI and remote REST services are accessed through explicitly configured gateways.",
        body,
    )


def research_workflow() -> str:
    body = header("From material question to evidence package", "A repeatable workflow for exploratory polymer research and engineering review")
    cards = [
        (68, 178, "1", "Define", "Question + acceptance criteria", "#38bdf8"),
        (292, 178, "2", "Curate", "Select and validate records", "#34d399"),
        (516, 178, "3", "Analyze", "Models + uncertainty", "#a78bfa"),
        (740, 178, "4", "Compare", "Charts + ranked alternatives", "#fbbf24"),
        (964, 178, "5", "Report", "Export + review package", "#fb7185"),
    ]
    for i, (x, y, n, title, sub, color) in enumerate(cards):
        body += panel(x, y, 168, 170, title, sub, color)
        body += f'<circle cx="{x + 84}" cy="{y + 112}" r="28" fill="{color}" fill-opacity=".18" stroke="{color}"/>'
        body += t(x + 84, y + 121, n, 22, "#f8fafc", 800, "middle")
        if i < len(cards) - 1:
            body += arrow(x + 168, y + 85, cards[i + 1][0] - 10, y + 85)
    body += panel(160, 424, 880, 112, "Evidence package", "filtered dataset • formula settings • plots • QA report • exported records • reviewer notes", "#38bdf8")
    body += chip(224, 488, "Traceable inputs", "#38bdf8", 170)
    body += chip(420, 488, "Reproducible settings", "#34d399", 196)
    body += chip(642, 488, "Portable outputs", "#a78bfa", 164)
    body += chip(832, 488, "Human approval", "#fbbf24", 150)
    return document(
        "research-title",
        "ResinDB Pro research workflow",
        "A repeatable five-step workflow from defining a material question through curation, analysis, comparison and report export.",
        body,
    )


FILES = {
    "resindb-ai-platform-overview.svg": hero,
    "resindb-ai-workflow.svg": ai_loop,
    "resindb-data-lifecycle.svg": data_lifecycle,
    "resindb-scientific-engine.svg": scientific_engine,
    "resindb-knowledge-network.svg": knowledge_network,
    "resindb-quality-gates.svg": quality_gates,
    "resindb-local-first-privacy.svg": privacy,
    "resindb-research-workflow.svg": research_workflow,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for filename, factory in FILES.items():
        content = factory()
        ET.fromstring(content)
        (OUT / filename).write_text(content, encoding="utf-8")
        print(f"generated {filename}")


if __name__ == "__main__":
    main()
