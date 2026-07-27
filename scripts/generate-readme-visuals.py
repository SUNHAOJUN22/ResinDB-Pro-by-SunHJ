#!/usr/bin/env python3
"""Generate accessible, deterministic ResinDB Pro README diagrams.

The visual language follows the UI/UX Pro Max workflow for a dense scientific
analytics dashboard: Swiss modernism, Bento structure, accessible semantic
colors, a strict 8-point spacing rhythm, vector-only icons and low visual noise.
"""

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
MONO = "JetBrains Mono,SFMono-Regular,Consolas,monospace"

TOKENS = {
    "canvas": "#F8FAFC",
    "surface": "#FFFFFF",
    "surface_alt": "#F1F5F9",
    "ink": "#0F172A",
    "body": "#334155",
    "muted": "#64748B",
    "border": "#CBD5E1",
    "border_soft": "#E2E8F0",
    "primary": "#2563EB",
    "cyan": "#0E7490",
    "teal": "#0F766E",
    "violet": "#6D28D9",
    "amber": "#B45309",
    "rose": "#BE123C",
    "green": "#15803D",
    "navy": "#0F172A",
}
ACCENTS = (
    TOKENS["primary"], TOKENS["teal"], TOKENS["violet"],
    TOKENS["amber"], TOKENS["rose"], TOKENS["cyan"],
)

DEFS = f"""
<defs>
  <filter id="shadow-sm" x="-15%" y="-20%" width="130%" height="150%">
    <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#0F172A" flood-opacity=".08"/>
  </filter>
  <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
    <circle cx="1" cy="1" r="1" fill="#CBD5E1" fill-opacity=".38"/>
  </pattern>
  <marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
    <path d="M0 0L9 4.5L0 9Z" fill="{TOKENS['primary']}"/>
  </marker>
  <marker id="arrow-muted" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
    <path d="M0 0L9 4.5L0 9Z" fill="{TOKENS['muted']}"/>
  </marker>
</defs>
"""


@dataclass(frozen=True)
class Item:
    icon: str
    title: str
    subtitle: str


@dataclass(frozen=True)
class Visual:
    filename: str
    title_id: str
    eyebrow: str
    title: str
    subtitle: str
    description: str
    layout: str
    items: tuple[Item, ...]
    footer: tuple[str, ...] = ()


def text(x: float, y: float, value: str, size: int = 16, color: str | None = None,
         weight: int = 500, anchor: str = "start", family: str = FONT,
         letter_spacing: float | None = None) -> str:
    color = color or TOKENS["body"]
    tracking = f' letter-spacing="{letter_spacing}"' if letter_spacing is not None else ""
    return (
        f'<text x="{x}" y="{y}" fill="{color}" font-family="{family}" '
        f'font-size="{size}" font-weight="{weight}" text-anchor="{anchor}"{tracking}>'
        f'{escape(value)}</text>'
    )


def line(x1: float, y1: float, x2: float, y2: float, color: str | None = None,
         width: float = 2, dashed: bool = False, marker: str | None = None) -> str:
    color = color or TOKENS["border"]
    dash = ' stroke-dasharray="6 6"' if dashed else ""
    marker_attr = f' marker-end="url(#{marker})"' if marker else ""
    return (
        f'<path d="M{x1} {y1}L{x2} {y2}" fill="none" stroke="{color}" '
        f'stroke-width="{width}" stroke-linecap="round"{dash}{marker_attr}/>'
    )


def icon_path(name: str, cx: float, cy: float, color: str) -> str:
    """Small Lucide-like outline icons with a consistent 2px stroke."""
    s = f'fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    if name == "database":
        return f'<g {s}><ellipse cx="{cx}" cy="{cy-9}" rx="12" ry="5"/><path d="M{cx-12} {cy-9}v18c0 3 5 5 12 5s12-2 12-5v-18"/><path d="M{cx-12} {cy}c0 3 5 5 12 5s12-2 12-5"/></g>'
    if name == "chart":
        return f'<g {s}><path d="M{cx-14} {cy+13}V{cy-13}M{cx-14} {cy+13}H{cx+15}"/><path d="M{cx-9} {cy+7}l7-8 6 4 9-12"/><circle cx="{cx-2}" cy="{cy-1}" r="2" fill="{color}" stroke="none"/><circle cx="{cx+4}" cy="{cy+3}" r="2" fill="{color}" stroke="none"/></g>'
    if name == "science":
        return f'<g {s}><ellipse cx="{cx}" cy="{cy}" rx="16" ry="6"/><ellipse cx="{cx}" cy="{cy}" rx="16" ry="6" transform="rotate(60 {cx} {cy})"/><ellipse cx="{cx}" cy="{cy}" rx="16" ry="6" transform="rotate(120 {cx} {cy})"/><circle cx="{cx}" cy="{cy}" r="3" fill="{color}" stroke="none"/></g>'
    if name == "spark":
        return f'<g {s}><path d="M{cx} {cy-16}l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/><path d="M{cx+11} {cy+5}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></g>'
    if name == "file":
        return f'<g {s}><path d="M{cx-10} {cy-15}h13l8 8v22h-21z"/><path d="M{cx+3} {cy-15}v8h8M{cx-5} {cy+1}h11M{cx-5} {cy+7}h8"/></g>'
    if name == "shield":
        return f'<g {s}><path d="M{cx} {cy-16}l14 5v10c0 10-6 16-14 20-8-4-14-10-14-20v-10z"/><path d="M{cx-7} {cy+1}l5 5 10-11"/></g>'
    if name == "worker":
        return f'<g {s}><rect x="{cx-13}" y="{cy-13}" width="26" height="26" rx="5"/><path d="M{cx-5} {cy-5}h10v10h-10zM{cx-18} {cy-7}h5M{cx-18} {cy}h5M{cx-18} {cy+7}h5M{cx+13} {cy-7}h5M{cx+13} {cy}h5M{cx+13} {cy+7}h5"/></g>'
    if name == "formula":
        return f'<g {s}>{text(cx, cy+7, "fx", 22, color, 750, "middle", MONO)}</g>'
    if name == "network":
        return f'<g {s}><path d="M{cx-10} {cy-8}L{cx+9} {cy-12}L{cx+13} {cy+9}L{cx-7} {cy+13}Z"/><circle cx="{cx-10}" cy="{cy-8}" r="4" fill="{TOKENS["surface"]}"/><circle cx="{cx+9}" cy="{cy-12}" r="4" fill="{TOKENS["surface"]}"/><circle cx="{cx+13}" cy="{cy+9}" r="4" fill="{TOKENS["surface"]}"/><circle cx="{cx-7}" cy="{cy+13}" r="4" fill="{TOKENS["surface"]}"/></g>'
    if name == "compare":
        return f'<g {s}><path d="M{cx} {cy-14}v28M{cx-13} {cy-9}h26"/><path d="M{cx-13} {cy-9}l-7 13h14zM{cx+13} {cy-9}l-7 13h14z"/></g>'
    if name == "lock":
        return f'<g {s}><rect x="{cx-12}" y="{cy-2}" width="24" height="18" rx="4"/><path d="M{cx-7} {cy-2}v-5a7 7 0 0114 0v5"/><circle cx="{cx}" cy="{cy+7}" r="2" fill="{color}" stroke="none"/></g>'
    if name == "import":
        return f'<g {s}><path d="M{cx-12} {cy-14}h14l9 9v19h-23zM{cx+2} {cy-14}v9h9"/><path d="M{cx} {cy-1}v13M{cx-6} {cy+6}l6 6 6-6"/></g>'
    if name == "check":
        return f'<g {s}><circle cx="{cx}" cy="{cy}" r="15"/><path d="M{cx-8} {cy}l6 6 11-13"/></g>'
    if name == "flask":
        return f'<g {s}><path d="M{cx-6} {cy-16}h12M{cx-4} {cy-16}v10l-10 18a5 5 0 004 7h20a5 5 0 004-7l-10-18v-10"/><path d="M{cx-10} {cy+7}h20"/></g>'
    if name == "server":
        return f'<g {s}><rect x="{cx-15}" y="{cy-14}" width="30" height="11" rx="3"/><rect x="{cx-15}" y="{cy+3}" width="30" height="11" rx="3"/><circle cx="{cx-9}" cy="{cy-8.5}" r="1.5" fill="{color}" stroke="none"/><circle cx="{cx-9}" cy="{cy+8.5}" r="1.5" fill="{color}" stroke="none"/></g>'
    if name == "tag":
        return f'<g {s}><path d="M{cx-14} {cy-10}h14l14 14-10 10-14-14v-14z"/><circle cx="{cx-7}" cy="{cy-4}" r="2"/></g>'
    if name == "filter":
        return f'<g {s}><path d="M{cx-15} {cy-12}h30l-11 12v12l-8 4v-16z"/></g>'
    if name == "layers":
        return f'<g {s}><path d="M{cx} {cy-15}l16 8-16 8-16-8zM{cx-16} {cy}l16 8 16-8M{cx-16} {cy+8}l16 8 16-8"/></g>'
    return f'<g {s}><circle cx="{cx}" cy="{cy}" r="14"/><path d="M{cx-6} {cy}h12M{cx} {cy-6}v12"/></g>'


def icon_badge(x: float, y: float, icon: str, accent: str, size: float = 48) -> str:
    cx, cy = x + size / 2, y + size / 2
    return (
        f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="14" '
        f'fill="{accent}" fill-opacity=".10" stroke="{accent}" stroke-opacity=".28"/>'
        + icon_path(icon, cx, cy, accent)
    )


def header(visual: Visual) -> str:
    return (
        f'<rect x="0" y="0" width="{WIDTH}" height="142" fill="{TOKENS["navy"]}"/>'
        + text(64, 38, "RESINDB PRO", 12, "#93C5FD", 750, letter_spacing=1.6)
        + text(64, 82, visual.title, 32, "#FFFFFF", 760)
        + text(64, 112, visual.subtitle, 15, "#CBD5E1", 450)
        + text(1136, 38, visual.eyebrow.upper(), 11, "#94A3B8", 650, "end", MONO, 1.0)
        + f'<rect x="64" y="132" width="90" height="4" rx="2" fill="{TOKENS["primary"]}"/>'
    )


def footer(visual: Visual) -> str:
    if not visual.footer:
        return ""
    x = 64
    result = ""
    for index, label in enumerate(visual.footer):
        width = max(150, 28 + len(label) * 7.3)
        accent = ACCENTS[index % len(ACCENTS)]
        result += (
            f'<rect x="{x}" y="580" width="{width}" height="32" rx="16" '
            f'fill="{TOKENS["surface"]}" stroke="{TOKENS["border"]}"/>'
            f'<circle cx="{x+16}" cy="596" r="4" fill="{accent}"/>'
            + text(x + 28, 601, label, 12, TOKENS["body"], 600)
        )
        x += width + 12
    return result


def card(x: float, y: float, width: float, height: float, item: Item, accent: str,
         number: int | None = None) -> str:
    number_markup = ""
    if number is not None:
        number_markup = (
            f'<rect x="{x+width-52}" y="{y+18}" width="32" height="24" rx="12" fill="{TOKENS["surface_alt"]}"/>'
            + text(x + width - 36, y + 35, f"{number:02d}", 11, TOKENS["muted"], 700, "middle", MONO)
        )
    return (
        f'<g filter="url(#shadow-sm)">'
        f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="18" fill="{TOKENS["surface"]}" stroke="{TOKENS["border_soft"]}"/>'
        f'<rect x="{x}" y="{y}" width="6" height="{height}" rx="3" fill="{accent}"/>'
        f'</g>'
        + icon_badge(x + 24, y + 22, item.icon, accent, 46)
        + text(x + 84, y + 43, item.title, 17, TOKENS["ink"], 720)
        + text(x + 84, y + 66, item.subtitle, 12, TOKENS["muted"], 500)
        + number_markup
    )


def render_flow(visual: Visual) -> str:
    body = header(visual)
    count = len(visual.items)
    gap = 22
    width = (1072 - gap * (count - 1)) / count
    y = 204
    for index, item in enumerate(visual.items):
        x = 64 + index * (width + gap)
        accent = ACCENTS[index % len(ACCENTS)]
        body += (
  f'<g filter="url(#shadow-sm)">'
  f'<rect x="{x}" y="{y}" width="{width}" height="204" rx="18" fill="{TOKENS["surface"]}" stroke="{TOKENS["border_soft"]}"/>'
  f'<rect x="{x}" y="{y}" width="{width}" height="5" rx="2.5" fill="{accent}"/>'
  f'</g>'
  + icon_badge(x + width / 2 - 24, y + 26, item.icon, accent, 48)
  + text(x + width - 24, y + 31, f"{index + 1:02d}", 11, TOKENS["muted"], 700, "middle", MONO)
  + text(x + width / 2, y + 105, item.title, 14, TOKENS["ink"], 720, "middle")
        )
        subtitle_parts = item.subtitle.split(" • ")
        if len(subtitle_parts) > 1:
  body += text(x + width / 2, y + 132, subtitle_parts[0], 11, TOKENS["muted"], 500, "middle")
  body += text(x + width / 2, y + 151, " • ".join(subtitle_parts[1:]), 11, TOKENS["muted"], 500, "middle")
        else:
  body += text(x + width / 2, y + 139, item.subtitle, 11, TOKENS["muted"], 500, "middle")
        body += f'<circle cx="{x + width / 2}" cy="{y + 178}" r="4" fill="{accent}"/>'
        if index < count - 1:
  body += line(x + width + 4, y + 102, x + width + gap - 5, y + 102,
               TOKENS["primary"], 2, False, "arrow")
    body += (
        f'<rect x="64" y="442" width="1072" height="92" rx="18" fill="{TOKENS["surface_alt"]}" stroke="{TOKENS["border_soft"]}"/>'
        + text(88, 473, "DESIGN INTENT", 11, TOKENS["primary"], 750, family=MONO, letter_spacing=1.0)
        + text(88, 503, visual.description, 14, TOKENS["body"], 500)
    )
    return body + footer(visual)

def render_grid(visual: Visual) -> str:
    body = header(visual)
    width, height = 334, 154
    x_positions = (64, 433, 802)
    y_positions = (176, 354)
    for index, item in enumerate(visual.items):
        row, col = divmod(index, 3)
        x, y = x_positions[col], y_positions[row]
        accent = ACCENTS[index % len(ACCENTS)]
        body += card(x, y, width, height, item, accent)
        # Non-color-only mini metric glyph.
        body += line(x + 26, y + 118, x + 306, y + 118, TOKENS["border_soft"], 1)
        points = [(x + 32, y + 124), (x + 94, y + 107), (x + 152, y + 116), (x + 220, y + 91), (x + 296, y + 102)]
        path = "M" + "L".join(f"{px} {py}" for px, py in points)
        body += f'<path d="{path}" fill="none" stroke="{accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'
        for px, py in points:
            body += f'<circle cx="{px}" cy="{py}" r="3" fill="{TOKENS["surface"]}" stroke="{accent}" stroke-width="2"/>'
    return body + footer(visual)


def render_bento(visual: Visual) -> str:
    body = header(visual)
    positions = (
        (64, 176, 500, 174), (586, 176, 260, 174), (868, 176, 268, 174),
        (64, 372, 268, 164), (354, 372, 492, 164), (868, 372, 268, 164),
    )
    for index, (item, (x, y, width, height)) in enumerate(zip(visual.items, positions)):
        accent = ACCENTS[index % len(ACCENTS)]
        body += card(x, y, width, height, item, accent, index + 1)
    return body + footer(visual)


def render_hub(visual: Visual) -> str:
    body = header(visual)
    center_x, center_y = 600, 355
    body += (
        f'<rect x="480" y="272" width="240" height="166" rx="24" fill="{TOKENS["navy"]}"/>'
        + icon_badge(576, 294, "database", "#93C5FD", 48)
        + text(center_x, 374, "Resin knowledge graph", 18, "#FFFFFF", 720, "middle")
        + text(center_x, 399, "relations stay reviewable", 12, "#CBD5E1", 500, "middle")
    )
    positions = ((90, 190), (450, 172), (880, 190), (90, 438), (450, 474), (880, 438))
    for index, (item, (x, y)) in enumerate(zip(visual.items, positions)):
        width, height = 230, 104
        accent = ACCENTS[index % len(ACCENTS)]
        target_x = x + width / 2
        target_y = y + height / 2
        body += line(center_x, center_y, target_x, target_y, TOKENS["muted"], 1.5, True, "arrow-muted")
        body += card(x, y, width, height, item, accent)
    return body + footer(visual)


def render_split(visual: Visual) -> str:
    body = header(visual)
    left = visual.items[:3]
    right = visual.items[3:]
    body += (
        f'<rect x="64" y="176" width="508" height="360" rx="22" fill="{TOKENS["surface"]}" stroke="{TOKENS["border_soft"]}"/>'
        f'<rect x="628" y="176" width="508" height="360" rx="22" fill="{TOKENS["surface"]}" stroke="{TOKENS["border_soft"]}"/>'
        + text(90, 213, "LOCAL / DETERMINISTIC", 12, TOKENS["primary"], 750, family=MONO, letter_spacing=1.0)
        + text(654, 213, "OPTIONAL / GOVERNED", 12, TOKENS["amber"], 750, family=MONO, letter_spacing=1.0)
        + line(600, 190, 600, 524, TOKENS["border"], 2, True)
    )
    for side, items in enumerate((left, right)):
        x = 88 if side == 0 else 652
        for index, item in enumerate(items):
            y = 235 + index * 92
            accent = ACCENTS[(index + side * 3) % len(ACCENTS)]
            body += card(x, y, 460, 76, item, accent)
    body += text(600, 552, "explicit boundary", 11, TOKENS["muted"], 650, "middle", MONO)
    return body + footer(visual)


def render_layers(visual: Visual) -> str:
    body = header(visual)
    y = 176
    for index, item in enumerate(visual.items):
        x = 64 + index * 34
        width = 1072 - index * 68
        height = 78
        accent = ACCENTS[index % len(ACCENTS)]
        body += card(x, y, width, height, item, accent, index + 1)
        y += 92
    return body + footer(visual)


RENDERERS = {
    "flow": render_flow,
    "grid": render_grid,
    "bento": render_bento,
    "hub": render_hub,
    "split": render_split,
    "layers": render_layers,
}


def I(icon: str, title: str, subtitle: str) -> Item:
    return Item(icon, title, subtitle)


VISUALS = (
    Visual(
        "resindb-ai-platform-overview.svg", "platform-title", "Platform / Bento overview",
        "ResinDB Pro", "Scientific resin intelligence with explicit evidence boundaries",
        "A local-first research workspace connecting governed data, deterministic computation, visual analytics, optional AI and export evidence.",
        "bento",
        (
            I("database", "Data workspace", "records • taxonomy • snapshots"),
            I("chart", "Visual analytics", "dashboard • pivot • charts"),
            I("science", "Scientific engine", "models • statistics • workers"),
            I("spark", "AI copilot", "optional • bounded • reviewable"),
            I("file", "Evidence export", "CSV • JSON • XML • PDF"),
            I("shield", "Quality gates", "tests • audit • provenance"),
        ),
        ("Local-first", "Deterministic compute", "Human approval"),
    ),
    Visual(
        "resindb-data-lifecycle.svg", "lifecycle-title", "Data / Lifecycle",
        "Resin data lifecycle", "Validate each boundary and preserve provenance",
        "The lifecycle keeps source, schema, validation, persistence, analysis and portable export visible as separate stages.",
        "flow",
        (
            I("import", "Import", "CSV • JSON • TXT"),
            I("check", "Validate", "shape • IDs • ranges"),
            I("tag", "Normalize", "taxonomy • aliases • units"),
            I("database", "Persist", "IndexedDB • snapshots"),
            I("chart", "Analyze", "filters • charts • workers"),
            I("file", "Export", "portable evidence package"),
        ),
        ("No silent fallback", "Stable IDs", "Explicit parse errors"),
    ),
    Visual(
        "resindb-data-governance.svg", "governance-title", "Data / Governance",
        "Data governance and provenance", "Separate records, references, semantics and validation metadata",
        "Governance layers keep demo, measured, imported and reference data distinguishable and reviewable.",
        "layers",
        (
            I("database", "Record universes", "catalog • laboratory • open market"),
            I("file", "Reference catalogs", "manufacturers • sources • network"),
            I("tag", "Semantic dictionaries", "taxonomy • aliases • property groups"),
            I("shield", "Validation envelope", "schemaVersion • sourceType • status • date"),
        ),
        ("Demo ≠ measured", "Duplicate checks", "Cycle checks"),
    ),
    Visual(
        "resindb-scientific-engine.svg", "science-title", "Compute / Scientific engine",
        "Scientific computation engine", "Models are grouped by physical and statistical purpose",
        "Dedicated workers and finite-result guards isolate numerical tasks from the interactive application thread.",
        "grid",
        (
            I("science", "Rheology & relaxation", "Carreau • WLF • Prony"),
            I("chart", "Kinetics & reliability", "Arrhenius • Avrami • Weibull"),
            I("formula", "Uncertainty", "Monte Carlo • Sobol • KDE"),
            I("compare", "Similarity", "Mahalanobis • PCA • K-Means"),
            I("filter", "Optimization", "Pareto • MOO • RSM • SPC"),
            I("shield", "Safeguards", "finite output • isolated failure"),
        ),
        ("Numerical parity", "Worker isolation", "Reproducible inputs"),
    ),
    Visual(
        "resindb-worker-architecture.svg", "worker-title", "Compute / Worker architecture",
        "Web Worker execution architecture", "Heavy computation stays outside the React interaction budget",
        "Typed requests, lifecycle control, finite-result validation and explicit errors form the worker execution contract.",
        "flow",
        (
            I("chart", "React view", "intent • controls"),
            I("worker", "Worker hook", "typed request"),
            I("layers", "Manager", "lifecycle • timeout"),
            I("science", "Scientific worker", "numerical compute"),
            I("shield", "Result guard", "shape • finite values"),
            I("file", "Chart / report", "reviewable output"),
        ),
        ("Responsive UI", "Failure isolation", "Explicit cancellation"),
    ),
    Visual(
        "resindb-formula-engine.svg", "formula-title", "Compute / Formula safety",
        "Whitelist formula engine", "Parse approved syntax; never execute arbitrary JavaScript",
        "Tokenization, parsing, binding, evaluation, short-circuiting and error isolation remain explicit stages.",
        "flow",
        (
            I("filter", "Tokenize", "numbers • names • operators"),
            I("layers", "Parse", "precedence • grouping"),
            I("tag", "Bind", "approved properties"),
            I("formula", "Evaluate", "arithmetic • comparison"),
            I("compare", "Short-circuit", "logical && • ||"),
            I("shield", "Isolate", "one bad formula only"),
        ),
        ("No eval", "No new Function", "Finite-result checks"),
    ),
    Visual(
        "resindb-knowledge-network.svg", "network-title", "Explore / Knowledge graph",
        "Resin knowledge network", "Explore adjacency without claiming causality",
        "Relations connect grades to families, property groups, manufacturers, routes, comparable grades and references.",
        "hub",
        (
            I("layers", "Polymer family", "taxonomy"),
            I("tag", "Property group", "semantic fields"),
            I("database", "Manufacturer", "catalog entry"),
            I("science", "Process route", "context"),
            I("compare", "Comparable grade", "similarity"),
            I("file", "Reference", "evidence source"),
        ),
        ("Adjacency ≠ causality", "Source review", "Stable identifiers"),
    ),
    Visual(
        "resindb-comparison-decision.svg", "comparison-title", "Analyze / Decision support",
        "Grade comparison and decision support", "Preserve raw values while exposing normalized trade-offs",
        "Candidates move through normalization, visualization, scoring, Pareto analysis and human review.",
        "flow",
        (
            I("database", "Candidates", "filtered grades"),
            I("formula", "Normalize", "units • scales"),
            I("chart", "Visualize", "radar • scatter • parallel"),
            I("compare", "Score", "similarity • TOPSIS"),
            I("filter", "Trade-offs", "Pareto frontier"),
            I("check", "Review", "human decision"),
        ),
        ("Ranking ≠ certification", "Missing data visible", "Raw values retained"),
    ),
    Visual(
        "resindb-ai-workflow.svg", "ai-title", "Assist / AI workflow",
        "AI-assisted analysis loop", "AI explains; deterministic tools calculate; researchers approve",
        "Evidence selection and deterministic calculation precede AI synthesis, challenge and professional sign-off.",
        "flow",
        (
            I("file", "Question", "research intent"),
            I("database", "Evidence", "selected records"),
            I("science", "Compute", "workers • formulas"),
            I("spark", "Explain", "AI synthesis"),
            I("shield", "Challenge", "limits • alternatives"),
            I("check", "Approve", "human sign-off"),
        ),
        ("Optional endpoint", "No hidden execution", "Source-aware output"),
    ),
    Visual(
        "resindb-local-first-privacy.svg", "privacy-title", "Architecture / Privacy boundary",
        "Local-first privacy architecture", "Browser storage by default; remote services are explicit",
        "The design separates browser-owned deterministic state from optional governed AI and remote REST boundaries.",
        "split",
        (
            I("database", "IndexedDB", "records • snapshots"),
            I("tag", "Preferences", "theme • language"),
            I("file", "Feedback queue", "local export"),
            I("spark", "AI gateway", "optional endpoint"),
            I("server", "Remote REST", "explicit adapter"),
            I("shield", "Server controls", "auth • rate limit • audit"),
        ),
        ("VITE_* is public", "No privileged client secret", "Portable backups"),
    ),
    Visual(
        "resindb-import-export.svg", "exchange-title", "Data / Exchange",
        "Import, export and report pipeline", "Portable formats reduce lock-in and preserve review packages",
        "Parsed files move through mapping, validation, editing, reporting and portable export with explicit errors.",
        "flow",
        (
            I("import", "Parse", "CSV • JSON • TXT"),
            I("tag", "Map", "columns • fields"),
            I("check", "Validate", "shape • values"),
            I("database", "Edit", "grid • batch actions"),
            I("chart", "Report", "charts • QA PDF"),
            I("file", "Export", "CSV • JSON • XML • PDF"),
        ),
        ("No fake upload success", "Explicit parse errors", "User-controlled files"),
    ),
    Visual(
        "resindb-quality-gates.svg", "quality-title", "Delivery / Quality gates",
        "Quality and validation gates", "A release is accepted only after every deterministic gate is green",
        "Documentation, source hygiene, static analysis, regression, runtime and security checks remain independently attributable.",
        "grid",
        (
            I("file", "Documentation", "links • SVGs • evidence"),
            I("shield", "Source hygiene", "production code • no injection"),
            I("check", "Static", "ESLint • TypeScript"),
            I("science", "Regression", "unit • science • workers"),
            I("server", "Runtime", "Vite • HTTP • Chromium"),
            I("lock", "Security", "all dependencies • high gate"),
        ),
        ("Sole main branch", "No migration residue", "Artifacts retained temporarily"),
    ),
    Visual(
        "resindb-research-workflow.svg", "research-title", "Workflow / Research evidence",
        "From material question to evidence package", "A repeatable workflow for exploratory polymer research",
        "Question definition and curation precede computation, comparison, reporting and professional review.",
        "flow",
        (
            I("file", "Define", "question • criteria"),
            I("database", "Curate", "select • validate"),
            I("science", "Analyze", "models • uncertainty"),
            I("compare", "Compare", "charts • rankings"),
            I("file", "Report", "portable package"),
            I("check", "Review", "professional sign-off"),
        ),
        ("Traceable inputs", "Reproducible settings", "Human approval"),
    ),
    Visual(
        "resindb-security-deployment.svg", "deployment-title", "Architecture / Deployment boundary",
        "Security and deployment boundary", "The browser demo is not an authentication or release system",
        "Operational security is layered across browser UI, server gateway, data services and organizational governance.",
        "layers",
        (
            I("chart", "Browser application", "demo roles • CSP • no privileged secrets"),
            I("shield", "Server gateway", "authentication • validation • rate limiting"),
            I("server", "Data services", "database • backup • retention • audit"),
            I("check", "Operational governance", "HTTPS • monitoring • incident response"),
        ),
        ("Demo roles ≠ auth", "AI output ≠ release", "Operator owns compliance"),
    ),
)


def svg_document(visual: Visual) -> str:
    renderer = RENDERERS[visual.layout]
    body = renderer(visual)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}"
 viewBox="0 0 {WIDTH} {HEIGHT}" role="img"
 aria-labelledby="{visual.title_id} {visual.title_id}-desc"
 data-design-system="resindb-uiux-pro-max-v1" shape-rendering="geometricPrecision">
<title id="{visual.title_id}">{escape(visual.title)}</title>
<desc id="{visual.title_id}-desc">{escape(visual.description)}</desc>
<metadata>ResinDB UI UX Pro Max design system: Swiss modernism, Bento structure, WCAG-aware semantic colors, vector-only icons, 8-point spacing.</metadata>
{DEFS}
<rect width="{WIDTH}" height="{HEIGHT}" rx="24" fill="{TOKENS['canvas']}"/>
<rect x="0" y="142" width="{WIDTH}" height="498" fill="url(#dot-grid)"/>
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
    if root.attrib.get("data-design-system") != "resindb-uiux-pro-max-v1":
        raise ValueError(f"{filename}: missing design-system marker")
    if not root.findall(f"{namespace}title") or not root.findall(f"{namespace}desc"):
        raise ValueError(f"{filename}: missing title or desc")
    if not root.findall(f"{namespace}metadata"):
        raise ValueError(f"{filename}: missing design-system metadata")


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
    print(f"validated {len(VISUALS)} deterministic UI UX Pro Max README visuals")


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
